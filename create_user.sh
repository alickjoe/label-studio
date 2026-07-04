#!/bin/bash
docker exec label-studio-app-1 python3 /label-studio/label_studio/manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
u, created = User.objects.get_or_create(
    email='admin@test.com',
    defaults={'is_superuser': True, 'is_staff': True}
)
u.set_password('test1234')
u.save()
print('OK:', u.email, 'Created:', created)
"
