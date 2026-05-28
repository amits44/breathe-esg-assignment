import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core_project.settings")
django.setup()  

from core.models import User, Client  

username = os.environ.get("DJANGO_SUPERUSER_USERNAME", "admin")
email = os.environ.get("DJANGO_SUPERUSER_EMAIL", "admin@example.com")
password = os.environ.get("DJANGO_SUPERUSER_PASSWORD")
client_name = os.environ.get("CLIENT_NAME", "Breathe ESG")

if not password:
    print("Skipping superuser creation: DJANGO_SUPERUSER_PASSWORD not set.")
else:
    client, _ = Client.objects.get_or_create(name=client_name)
    
    if not User.objects.filter(username=username).exists():
        user = User.objects.create_superuser(username, email, password)
        user.client = client
        user.save()
        print(f"Superuser created and linked to client '{client_name}'.")
    else:
        # Ensure existing user also has a client
        user = User.objects.get(username=username)
        if not user.client:
            user.client = client
            user.save()
            print(f"Linked existing user to client '{client_name}'.")
        else:
            print("Superuser already exists with a client.")