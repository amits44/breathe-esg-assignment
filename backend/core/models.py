from django.db import models
import uuid
from django.contrib.auth.models import AsbtractUser
# Create your models here.

class Client(models.Model):
    id = models.UUIDField(primary_key = True, default = uuid.uuid4, editable = False)
    name = models.CharField(max_length= 255)
    created_at = models.DateTimeField(auto_add_now = True)

    class Meta:
        ordering =['name']

    def __str__(self):
        return self.name

class User(AsbtractUser):
    ROLE_AUDITOR = 'auditor'
    ROLE_ADMIN = 'admin'

    ROLE_CHOICES=[
        (ROLE_AUDITOR, 'Auditor'),
        (ROLE_ADMIN, 'Admin'),
    ]
    id = models.UUIDField(primary_key =True, default = uuid.uuid4, editable =False)
    username = models.CharField(max_length=150, unique=True)
    client = models.ForeingKey(Client, on_delete= cascade, related_name= users)
    role = models.CharField(max_length=20, choices= ROLE_CHOICES, default= ROLE_ADMIN)

    def __str__(self):
        return f"{self.username} ({self.client})"

class Audit_log(models.Model):

    ACTION_UPLOAD = 'upload'
    ACTION_NORMALIZE = 'normalize'
    ACTION_FLAG = 'flag'
    ACTION_APPROVE = 'approve'
    ACTION_REJECT = 'reject'

    ACTION_CHOICES =[
        (ACTION_UPLOAD, 'Upload'),
        (ACTION_NORMALIZE, 'Normalize'),
        (ACTION_FLAG, 'Flag'),
        (ACTION_APPROVE, 'Approve'),
        (ACTION_REJECT, 'Reject'),
    ]
    id = models.UUIDField(primary_key = True, default = uuid.uuid4, editable = False)
    user = models.ForeignKey(User, on_delete= models.CASCADE, related_name='audit_logs')
    client = models.ForeignKey(Client, on_delete= models.CASCADE, related_name='audit_logs')
    action = models.CharField(max_length=20, choices= ACTION_CHOICES)
    entity_type = models.CharField(max_length=50)
    entity_id = models.CharField(max_length=50)
    details = models.JsonField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering=['-timestamp']
        indexes = [
            models.Index(fields=['client', 'timestamp']),
            models.Index(fields=['entity_type', 'entity_id']),
        ]

    def __str__(self):
        return f"[{self.timestamp}] {self.action} by {self.user} on {self.entity_type} ({self.entity_id})"

