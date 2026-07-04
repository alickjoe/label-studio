import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'label_studio.core.settings.label_studio')
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(email='admin@test.com').exists():
    u = User.objects.create_superuser('admin@test.com', 'test1234')
    print('Created:', u.email)
else:
    u = User.objects.get(email='admin@test.com')
    u.set_password('test1234')
    u.is_active = True
    u.save()
    print('Updated:', u.email)
