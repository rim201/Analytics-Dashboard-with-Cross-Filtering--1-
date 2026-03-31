from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("dashboard", "0002_userprofile_iotdevice"),
    ]

    operations = [
        migrations.AddField(
            model_name="iotdevice",
            name="device_uid",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Identifiant matériel / externe de l'appareil",
                max_length=128,
            ),
        ),
    ]
