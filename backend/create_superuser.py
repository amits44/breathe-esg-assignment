import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core_project.settings")
django.setup()

from core.models import User

username = os.environ.get("DJANGO_SUPERUSER_USERNAME", "admin")
email = os.environ.get("DJANGO_SUPERUSER_EMAIL", "admin@example.com")
password = os.environ.get("DJANGO_SUPERUSER_PASSWORD")

if not password:
    print("Skipping superuser creation: DJANGO_SUPERUSER_PASSWORD not set.")
else:
    if not User.objects.filter(username=username).exists():
        User.objects.create_superuser(username, email, password)
        print("Superuser created.")
    else:
        print("Superuser already exists.")