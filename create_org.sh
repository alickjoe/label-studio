#!/bin/bash
docker exec label-studio-app-1 python3 /label-studio/label_studio/manage.py shell -c "
from django.contrib.auth import get_user_model
from organizations.models import Organization, OrganizationMember
User = get_user_model()
user = User.objects.get(email='admin@test.com')
org = Organization.objects.create(created_by=user, title='Test Org')
OrganizationMember.objects.create(organization=org, user=user)
print('OK: org', org.id, 'user', user.email)
"
