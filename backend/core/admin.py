from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Client, User, Audit_log



class CustomUserAdmin(UserAdmin):
    
    fieldsets = UserAdmin.fieldsets + (
        ('Breathe ESG Custom Fields', {'fields': ('client', 'role')}),
    )
    
    list_display = ('username', 'email', 'first_name', 'last_name', 'is_staff', 'client', 'role')

admin.site.register(Client)
admin.site.register(User, CustomUserAdmin)
admin.site.register(Audit_log)