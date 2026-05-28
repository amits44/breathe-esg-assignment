import csv
import io
from datetime import datetime, date
from decimal import Decimal, InvalidOperation
from typing import Iterator

from ingestion.models import RawRecord, NormalizedRecord


_COLUMN_ALIASES = {
    "account_number":    ["account number", "accountno", "account_number", "account#"],
    "meter_id":          ["meter id", "meterid", "meter_id", "meter#"],
    "service_type":      ["service type", "servicetype", "service_type", "utility type"],
    "period_start":      ["billing period start", "period_start", "period start", "start date"],
    "period_end":        ["billing period end", "period_end", "period end", "end date"],
    "invoice_date":      ["invoice date", "invoicedate", "bill date", "billing date", "date"],
    "invoice_number":    ["invoice number", "invoiceno", "invoice#", "invoice_number"],
    "vendor_name":       ["vendor", "utility provider", "provider", "provider name", "company"],
    "usage_kwh":         ["usage (kwh)", "usage_kwh", "kwh", "consumption (kwh)", "consumption"],
    "amount":            ["amount", "total", "totalamount", "amount due", "total amount", "invoice total"],
    "currency":          ["currency", "ccy"],
}


def _resolve_columns(header_row: list[str]) -> dict[str, str]:
    lower_headers = {h.strip().lower(): h for h in header_row}
    resolved = {}
    for internal, aliases in _COLUMN_ALIASES.items():
        for alias in aliases:
            if alias in lower_headers:
                resolved[internal] = lower_headers[alias]
                break
    return resolved  


def _parse_date(raw: str) -> date | None:
    raw = raw.strip()
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%d-%m-%Y", "%B %d, %Y", "%b %d, %Y"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


def _parse_amount(raw: str) -> tuple[int, list[str]]:
    warnings = []
    cleaned = raw.strip().lstrip("$£€").replace(",", "").strip()
    try:
        cents = int(Decimal(cleaned) * 100)
        return cents, warnings
    except InvalidOperation:
        warnings.append(f"Could not parse amount '{raw}', defaulting to 0")
        return 0, warnings


_SERVICE_TYPE_MAP = {
    "elec": "electricity",
    "electric": "electricity",
    "electricity": "electricity",
    "gas": "gas",
    "natural gas": "gas",
    "water": "water",
    "steam": "steam",
    "sewer": "sewer",
    "waste": "waste",
}


def normalize_utility_record(raw: RawRecord, col_map: dict[str, str]) -> NormalizedRecord:
    data = raw.raw_data
    warnings = []

    def get(internal: str) -> str:
        actual = col_map.get(internal)
        return data.get(actual, "").strip() if actual else ""

    raw_date = get("invoice_date") or get("period_start")
    transaction_date = _parse_date(raw_date)
    if raw_date and not transaction_date:
        warnings.append(f"Unrecognized date format: '{raw_date}'")

    period_start = _parse_date(get("period_start"))
    period_end = _parse_date(get("period_end"))

    currency = (get("currency") or "USD").upper()
    raw_amount = get("amount")
    amount, amount_warnings = _parse_amount(raw_amount)
    warnings.extend(amount_warnings)

    raw_service = get("service_type").lower()
    service_type = _SERVICE_TYPE_MAP.get(raw_service, raw_service or "unknown")

    usage_raw = get("usage_kwh")
    usage_kwh = None
    if usage_raw:
        try:
            usage_kwh = Decimal(usage_raw.replace(",", ""))
        except InvalidOperation:
            warnings.append(f"Could not parse usage '{usage_raw}'")

    vendor = get("vendor_name") or "Unknown Utility"
    invoice_number = get("invoice_number")

    return NormalizedRecord(
        client=raw.client,
        raw_record=raw,
        source=raw.source,
        transaction_id=invoice_number or f"util-{raw.row_index}",
        transaction_date=transaction_date,
        vendor_name=vendor,
        category="Utilities",
        amount=Decimal(amount),
        currency=currency,
        description=f"{service_type.title()} — {get('account_number')}",
        utility_account_number=get("account_number"),
        utility_meter_id=get("meter_id"),
        utility_service_type=service_type,
        utility_usage_kwh=usage_kwh,
        utility_billing_period_start=period_start,
        utility_billing_period_end=period_end,
        normalization_warnings=warnings,
    )


def parse_utility_csv(file_content: bytes) -> tuple[Iterator[dict], dict[str, str]]:
    text = file_content.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    fieldnames = reader.fieldnames or []
    col_map = _resolve_columns(list(fieldnames))

    def row_iter():
        for row in reader:
            if not any(v.strip() for v in row.values()):
                continue
            yield dict(row)

    return row_iter(), col_map