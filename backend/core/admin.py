from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Tenant, User, Audit_log

# Register your models here.
admin.site.register(Tenant)
admin.site.register(User, UserAdmin)
admin.site.register(AuditLog)