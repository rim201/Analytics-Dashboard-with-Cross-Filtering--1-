from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("dashboard", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="UserProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)),
                ("email", models.EmailField(max_length=254, unique=True)),
                ("role", models.CharField(choices=[("Admin", "Admin"), ("Facility Manager", "Facility Manager"), ("Employee", "Employee")], default="Employee", max_length=32)),
                ("status", models.CharField(choices=[("active", "Active"), ("inactive", "Inactive")], default="active", max_length=16)),
            ],
        ),
        migrations.CreateModel(
            name="IoTDevice",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)),
                ("type", models.CharField(max_length=64)),
                ("status", models.CharField(choices=[("online", "Online"), ("offline", "Offline"), ("error", "Error")], default="online", max_length=16)),
                ("last_update", models.DateTimeField(auto_now=True)),
                ("room", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="devices", to="dashboard.room")),
            ],
        ),
    ]
