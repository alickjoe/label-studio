# Generated manually for i18n support

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0011_user_custom_hotkeys"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="language",
            field=models.CharField(
                blank=True,
                default="zh-hans",
                help_text="User preferred language code",
                max_length=10,
                verbose_name="language",
            ),
        ),
    ]
