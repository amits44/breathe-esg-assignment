from django.contrib import admin
from .models import Ingestion, RawRecord, NormalizedRecord

# Register your models here.
admin.site.register(Ingestion)
admin.site.register(NormalizedRecord)