from django.db import models
import uuid
from core.models import Client, User
# Create your models here.

class Ingestion(models.Model):

    SOURCE_SAP = 'sap'
    SOURCE_UTILITY = 'utility'
    SOURCE_NAVAN = 'navan'

    SOURCE_CHOICES = [
        (SOURCE_SAP, 'SAP'),
        (SOURCE_UTILITY, 'Utility'),    
        (SOURCE_NAVAN, 'Navan'),
    ]

    STATUS_PENDING = 'pending'
    STATUS_PROCESSING = 'processing'
    STATUS_COMPLETED = 'completed'
    STATUS_FAILED = 'failed'

    STATUS_CHOICES =[
        (STATUS_PENDING, 'Pending'),
        (STATUS_PROCESSING, 'Processing'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_FAILED, 'Failed'),
    ]

    id = models.UUIDField(primary_key= True, default = uuid.uuid4, editable = False)
    client = models.ForeignKey(Client, on_delete= models.CASCADE, related_name='ingestions')
    uploaded_by = models.ForeignKey(User, on_delete= models.CASCADE, related_name='ingestions')

    sources = models.CharField(max_length=20, choices= SOURCE_CHOICES)
    status = models.CharField(max_length=20, choices= STATUS_CHOICES, default=STATUS_PENDING)
    file = models.FileField(upload_to='ingestion_files/', null=True, blank=True)
    original_filename = models.CharField(max_length=255, blank=True)

    row_count = models.IntegerField(default=0)
    error_message = models.TextField(blank=True)
    error_count = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes =[
            models.Index(fields=['client', 'sources', 'status']),
        ]
    
    class __str__(self):
        return f"Ingestion {self.id} - {self.sources} ({self.status})"

class RawRecord(models.Model):
    id = models.UUIDField(primary_key = True, default = uuid.uuid4, editable = False)
    ingestion = models.ForeignKey(Ingestion, on_delete= models.CASCADE, related_name='raw_records')
    client = models.ForeignKey(Client, on_delete= models.CASCADE, related_name='raw_records')
    source = models.CharField(max_length=20)
    row_index = models.IntegerField()
    raw_data = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['ingestion', 'row_index']
        indexes = [
            models.Index(fields=['client', 'source']),
            models.Index(fields=['ingestion','row_index']),
        ]

    def __str__(self):
        return f"RawRecord {self.id} for Ingestion {self.ingestion.id}"

class NormalizedRecords(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_FLAGGED = 'flagged'
    STATUS_APPROVED = 'approved'
    STATUS_REJECTED = 'rejected'

    STATUS_CHOICES=[
        (STATUS_PENDING, 'Pending'),
        (STATUS_FLAGGED, 'Flagged'),
        (STATUS_APPROVED, 'Approved'),
        (STATUS_REJECTED, 'Rejected'),
     ]
    id = models.UUIDField(primary_key = True, default = uuid.uuid4, editable = False)
    client = models.ForeignKey(Client, on_delete= models.CASCADE, related_name='normalized_records')
    raw_record = models.OneToOneField(RawRecord, on_delete= models.CASCADE, related_name='normalized_record')
    source= models.CharField(max_length=20)

    transaction_id = models.CharField(max_length=50, blank=True)
    transaction_date = models.DateField(null=True, blank=True)
    vendor_name = models.CharField(max_length=255, blank=True)
    category = models.CharField(max_length=255, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, default='USD')
    description = models.TextField(blank=True)


    sap_po_number = models.CharField(max_length=50, blank=True)
    sap_cost_center = models.CharField(max_length=20, blank=True)
    sap_gl_account = models.CharField(max_length=20, blank=True)
    sap_company_code = models.CharField(max_length=10, blank=True)
    sap_material_group = models.CharField(max_length=20, blank=True)

    utility_account_number = models.CharField(max_length=50, blank=True)
    utility_meter_id = models.CharField(max_length=50, blank=True)
    utility_service_type = models.CharField(max_length=50, blank=True) 
    utility_usage_kwh = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    utility_billing_period_start = models.DateField(null=True, blank=True)
    utility_billing_period_end = models.DateField(null=True, blank=True)

    navan_trip_id = models.CharField(max_length=100, blank=True)
    navan_traveler_name = models.CharField(max_length=255, blank=True)
    navan_traveler_email = models.CharField(max_length=255, blank=True)
    navan_travel_type = models.CharField(max_length=50, blank=True) 
    navan_departure_date = models.DateField(null=True, blank=True)
    navan_return_date = models.DateField(null=True, blank=True)
    navan_origin = models.CharField(max_length=10, blank=True)
    navan_destination = models.CharField(max_length=10, blank=True)
    navan_policy_compliant = models.BooleanField(null=True)
    navan_out_of_policy_reason = models.TextField(blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    review_notes = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="reviewed_records"
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    normalization_warnings = models.JSONField(default=list) 
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-transaction_date", "-created_at"]
        indexes = [
            models.Index(fields=["client", "source", "status"]),
            models.Index(fields=["client", "transaction_date"]),
            models.Index(fields=["client", "vendor_name"]),
        ]

    def __str__(self):
        return f"[{self.source}] {self.transaction_date} {self.vendor_name} {self.amount_display}"

    @property
    def amount_display(self):
        return f"{self.currency} {self.amount / 100:.2f}"