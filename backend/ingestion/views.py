from datetime import datetime
from .scope_classifier import classify_record
from django.db import transaction
from rest_framework.authentication import TokenAuthentication, SessionAuthentication
from rest_framework.exceptions import PermissionDenied
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
import json
from core.models import Audit_log
from .models import Ingestion, RawRecord, NormalizedRecord
from .normalizers.sap import parse_sap_csv, normalize_sap_record
from .normalizers.utility import parse_utility_csv, normalize_utility_record
from .normalizers.navan import parse_navan_response, normalize_navan_record



class ClientScopedMixin:
    authentication_classes = [TokenAuthentication, SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get_client(self):
        client = getattr(self.request.user, 'client', None)
        if not client:
            raise PermissionDenied("User is not associated with a client.")
        return client


def _log_audit(client, user, action, entity_type, entity_id, detail=None):
    Audit_log.objects.create(
        client=client,
        user=user,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id),
        details=detail or {},
    )


def _run_csv_pipeline(client, user, source, file_content, original_filename, ekpo_content=None):
    batch = Ingestion.objects.create(
        client=client,
        uploaded_by=user,
        sources=source,
        status=Ingestion.STATUS_PROCESSING,
        original_filename=original_filename,
    )

    _log_audit(client, user, Audit_log.ACTION_UPLOAD, 'Ingestion', batch.id,
               {'source': source, 'filename': original_filename})

    try:
        if source == Ingestion.SOURCE_SAP:
            rows = list(parse_sap_csv(file_content, ekpo_content))
            col_map = None
        else:
            row_iter, col_map = parse_utility_csv(file_content)
            rows = list(row_iter)

        raw_records = [
            RawRecord(
                ingestion=batch,
                client=client,
                source=source,
                row_index=i,
                raw_data=row,
            )
            for i, row in enumerate(rows)
        ]
        RawRecord.objects.bulk_create(raw_records)

        normalized = []
        error_count = 0
        for raw in raw_records:
            try:
                if source == Ingestion.SOURCE_SAP:
                    norm = normalize_sap_record(raw)
                else:
                    norm = normalize_utility_record(raw, col_map)

                scope, co2e, scope_warnings = classify_record(norm)
                norm.emission_scope = scope
                norm.co2e_kg = co2e
                norm.normalization_warnings = (norm.normalization_warnings or []) + scope_warnings
                normalized.append(norm)
            except Exception as exc:
                error_count += 1
                print(f"Row error: {exc}")

        NormalizedRecord.objects.bulk_create(normalized)

        batch.row_count = len(rows)
        batch.error_count = error_count
        batch.status = Ingestion.STATUS_COMPLETED
        batch.save()

        _log_audit(client, user, Audit_log.ACTION_NORMALIZE, 'Ingestion', batch.id,
                   {'row_count': len(rows), 'error_count': error_count})

    except Exception as exc:
        batch.status = Ingestion.STATUS_FAILED
        batch.error_message = str(exc)
        batch.save()
        raise

    return batch


def _batch_to_dict(batch):
    return {
        'id': str(batch.id),
        'source': batch.sources,
        'status': batch.status,
        'original_filename': batch.original_filename,
        'row_count': batch.row_count,
        'error_count': batch.error_count,
        'error_message': batch.error_message,
        'created_at': batch.created_at,
        'updated_at': batch.updated_at,
    }


def _record_to_dict(record):
    return {
        'id': str(record.id),
        'source': record.source,
        'transaction_id': record.transaction_id,
        'transaction_date': record.transaction_date,
        'vendor_name': record.vendor_name,
        'category': record.category,
        'amount_display': f"{record.currency} {record.amount:.2f}",
        'currency': record.currency,
        'description': record.description,
        'status': record.status,
        'review_notes': record.review_notes,
        'normalization_warnings': record.normalization_warnings,
        'reviewed_at': record.reviewed_at,
        # SAP
        'sap_po_number': record.sap_po_number,
        'sap_cost_center': record.sap_cost_center,
        'sap_company_code': record.sap_company_code,
        # Utility
        'utility_account_number': record.utility_account_number,
        'utility_meter_id': record.utility_meter_id,
        'utility_service_type': record.utility_service_type,
        # Navan
        'navan_trip_id': record.navan_trip_id,
        'navan_traveler_name': record.navan_traveler_name,
        'navan_travel_type': record.navan_travel_type,
        'navan_policy_compliant': record.navan_policy_compliant,
        'navan_out_of_policy_reason': record.navan_out_of_policy_reason,
        #scope
        'emission_scope': record.emission_scope,
        'co2e_kg': str(record.co2e_kg),
    }



class UploadSAPView(ClientScopedMixin, APIView):
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        ekko_file = request.FILES.get("file")
        ekpo_file = request.FILES.get("ekpo_file")

        if not ekko_file:
            return Response({"error": "file is required."}, status=400)

        ekko_content = ekko_file.read()
        ekpo_content = ekpo_file.read() if ekpo_file else None

        batch = _run_csv_pipeline(
            client=self.get_client(),
            user=request.user,
            source=Ingestion.SOURCE_SAP,
            file_content=ekko_content,
            original_filename=ekko_file.name,
            ekpo_content=ekpo_content,
        )
        return Response(_batch_to_dict(batch), status=201)


class UploadUtilityView(ClientScopedMixin, APIView):
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response({"error": "file is required."}, status=400)
        if not uploaded_file.name.lower().endswith(".csv"):
            return Response({"error": "Only .csv files accepted."}, status=400)

        batch = _run_csv_pipeline(
            client=self.get_client(),
            user=request.user,
            source=Ingestion.SOURCE_UTILITY,
            file_content=uploaded_file.read(),
            original_filename=uploaded_file.name,
        )
        return Response(_batch_to_dict(batch), status=201)


class UploadNavanView(ClientScopedMixin, APIView):
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response({"error": "file is required."}, status=400)
        
        try:
            file_content = uploaded_file.read().decode('utf-8')
            navan_data = json.loads(file_content)
        except json.JSONDecodeError:
            return Response({"error": "Invalid JSON file."}, status=400)

        client = self.get_client()
        batch = Ingestion.objects.create(
            client=client,
            uploaded_by=request.user,
            sources=Ingestion.SOURCE_NAVAN,
            status=Ingestion.STATUS_PROCESSING,
            original_filename=uploaded_file.name,
        )

        _log_audit(client, request.user, Audit_log.ACTION_UPLOAD, 'Ingestion', batch.id,
                   {'source': 'navan'})

        try:
            bookings = list(parse_navan_response(navan_data))

            raw_records = [
                RawRecord(ingestion=batch, client=client,
                          source=Ingestion.SOURCE_NAVAN, row_index=i, raw_data=b)
                for i, b in enumerate(bookings)
            ]
            RawRecord.objects.bulk_create(raw_records)

            normalized = []
            error_count = 0
            for raw in raw_records:
                try:
                    norm = normalize_navan_record(raw)
                    scope, co2e, scope_warnings = classify_record(norm)
                    norm.emission_scope = scope
                    norm.co2e_kg = co2e
                    norm.normalization_warnings = (norm.normalization_warnings or []) + scope_warnings
                    normalized.append(norm)
                except Exception as exc:
                    error_count += 1
                    print(f"Navan Row Error: {exc}")

            NormalizedRecord.objects.bulk_create(normalized)

            batch.row_count = len(bookings)
            batch.error_count = error_count
            batch.status = Ingestion.STATUS_COMPLETED
            batch.save()

            _log_audit(client, request.user, Audit_log.ACTION_NORMALIZE, 'Ingestion', batch.id,
                       {'booking_count': len(bookings), 'error_count': error_count})

        except Exception as exc:
            batch.status = Ingestion.STATUS_FAILED
            batch.error_message = str(exc)
            batch.save()
            raise

        return Response(_batch_to_dict(batch), status=201)


class BatchListView(ClientScopedMixin, APIView):
    """GET /api/v1/batches/"""

    def get(self, request):
        client = self.get_client()
        qs = Ingestion.objects.filter(client=client)
        if source := request.query_params.get('source'):
            qs = qs.filter(sources=source)
        return Response([_batch_to_dict(b) for b in qs])


class BatchDetailView(ClientScopedMixin, APIView):
    """GET /api/v1/batches/<pk>/"""

    def get(self, request, pk):
        client = self.get_client()
        try:
            batch = Ingestion.objects.get(pk=pk, client=client)
        except Ingestion.DoesNotExist:
            return Response({"error": "Not found."}, status=404)
        return Response(_batch_to_dict(batch))



class RecordListView(ClientScopedMixin, APIView):
    """GET /api/v1/records/?source=sap&status=pending&batch=<uuid>"""

    def get(self, request):
        client = self.get_client()
        qs = NormalizedRecord.objects.filter(client=client).select_related('reviewed_by')

        params = request.query_params
        if source := params.get('source'):
            qs = qs.filter(source=source)
        if status := params.get('status'):
            qs = qs.filter(status=status)
        if batch_id := params.get('batch'):
            qs = qs.filter(raw_record__ingestion_id=batch_id)
        if vendor := params.get('vendor'):
            qs = qs.filter(vendor_name__icontains=vendor)
        if date_from := params.get('date_from'):
            qs = qs.filter(transaction_date__gte=date_from)
        if date_to := params.get('date_to'):
            qs = qs.filter(transaction_date__lte=date_to)

        return Response([_record_to_dict(r) for r in qs])


class RecordDetailView(ClientScopedMixin, APIView):
    """GET /api/v1/records/<pk>/"""

    def get(self, request, pk):
        client = self.get_client()
        try:
            record = NormalizedRecord.objects.get(pk=pk, client=client)
        except NormalizedRecord.DoesNotExist:
            return Response({"error": "Not found."}, status=404)
        return Response(_record_to_dict(record))


class ReviewRecordView(ClientScopedMixin, APIView):
    """POST /api/v1/records/<pk>/review/  body: {action, notes}"""

    def post(self, request, pk):
        client = self.get_client()
        try:
            record = NormalizedRecord.objects.get(pk=pk, client=client)
        except NormalizedRecord.DoesNotExist:
            return Response({"error": "Not found."}, status=404)

        action = request.data.get('action')
        notes = request.data.get('notes', '')

        action_to_status = {
            'approve': NormalizedRecord.STATUS_APPROVED,
            'reject':  NormalizedRecord.STATUS_REJECTED,
            'flag':    NormalizedRecord.STATUS_FLAGGED,
        }
        audit_action_map = {
            'approve': Audit_log.ACTION_APPROVE,
            'reject':  Audit_log.ACTION_REJECT,
            'flag':    Audit_log.ACTION_FLAG,
        }

        if action not in action_to_status:
            return Response({"error": "action must be approve, reject, or flag."}, status=400)

        with transaction.atomic():
            record.status = action_to_status[action]
            record.review_notes = notes
            record.reviewed_by = request.user
            record.reviewed_at = datetime.utcnow()
            record.save(update_fields=['status', 'review_notes', 'reviewed_by', 'reviewed_at'])

            _log_audit(client, request.user, audit_action_map[action],
                       'NormalizedRecord', record.id, {'notes': notes})

        return Response(_record_to_dict(record))


class SummaryView(ClientScopedMixin, APIView):
    """GET /api/v1/summary/"""

    def get(self, request):
        from django.db.models import Count, Sum
        client = self.get_client()
        records = NormalizedRecord.objects.filter(client=client)

        def status_counts(qs):
            result = {s: 0 for s in ['pending', 'flagged', 'approved', 'rejected']}
            for row in qs.values('status').annotate(n=Count('id')):
                result[row['status']] = row['n']
            return result

        scope_totals = {}
        for scope in [1, 2, 3]:
            qs_scope = records.filter(emission_scope=scope)
            scope_totals[f'scope_{scope}'] = {
                'count': qs_scope.count(),
                'co2e_kg': str(qs_scope.aggregate(t=Sum('co2e_kg'))['t'] or 0),
            }

        return Response({
            'total_records': records.count(),
            'total_amount': str(records.aggregate(t=Sum('amount'))['t'] or 0),
            'by_status': status_counts(records),
            'by_source': {
                src: status_counts(records.filter(source=src))
                for src in ['sap', 'utility', 'navan']
            },
            'scope_totals': scope_totals,
        })



class AuditLogListView(ClientScopedMixin, APIView):
    """GET /api/v1/audit/"""

    def get(self, request):
        client = self.get_client()
        logs = Audit_log.objects.filter(client=client).select_related('user')
        return Response([
            {
                'id': str(log.id),
                'action': log.action,
                'entity_type': log.entity_type,
                'entity_id': log.entity_id,
                'details': log.details,
                'user': log.user.username if log.user else None,
                'timestamp': log.timestamp,
            }
            for log in logs
        ])