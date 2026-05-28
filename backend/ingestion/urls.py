from django.urls import path
from rest_framework.authtoken.views import obtain_auth_token
from . import views

urlpatterns = [
    path("auth/token/", obtain_auth_token, name="api_token_auth"),
    path("upload/sap/",     views.UploadSAPView.as_view()),
    path("upload/utility/", views.UploadUtilityView.as_view()),
    path("upload/navan/",   views.UploadNavanView.as_view()),
    path("batches/",        views.BatchListView.as_view()),
    path("batches/<uuid:pk>/", views.BatchDetailView.as_view()),
    path("records/",        views.RecordListView.as_view()),
    path("records/<uuid:pk>/", views.RecordDetailView.as_view()),
    path("records/<uuid:pk>/review/", views.ReviewRecordView.as_view()),
    path("summary/",        views.SummaryView.as_view()),
    path("audit/",          views.AuditLogListView.as_view()),
]