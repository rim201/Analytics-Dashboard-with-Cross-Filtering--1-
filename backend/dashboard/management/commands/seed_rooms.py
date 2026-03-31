"""
Create sample rooms and measurements for testing.
Usage: python manage.py seed_rooms
"""
import random
from datetime import timedelta
from django.utils import timezone
from django.core.management.base import BaseCommand
from dashboard.models import Room, Measurement, UserProfile, IoTDevice


def add_measurements(room, count=24):
    base_temp = 21 + random.uniform(0, 2)
    base_hum = 40 + random.uniform(0, 15)
    base_co2 = 400 + random.uniform(0, 200)
    base_noise = 25 + random.uniform(0, 25)
    base_light = 400 + random.uniform(0, 150)
    now = timezone.now()
    for i in range(count):
        Measurement.objects.create(
            room=room,
            timestamp=now - timedelta(hours=count - 1 - i),
            temperature=round(base_temp + (random.random() - 0.5) * 2, 1),
            humidity=round(base_hum + (random.random() - 0.5) * 10, 1),
            co2=round(base_co2 + (random.random() - 0.5) * 150, 0),
            noise=round(base_noise + (random.random() - 0.5) * 15, 0),
            light=round(base_light + (random.random() - 0.5) * 100, 0),
        )


class Command(BaseCommand):
    help = 'Create sample rooms and measurements for testing'

    def handle(self, *args, **options):
        rooms_data = [
            ('Conference Room A', 12, 8),
            ('Meeting Room B', 8, 0),
            ('Executive Suite', 6, 4),
            ('Training Room', 20, 0),
            ('Focus Room 1', 4, 0),
        ]
        for name, capacity, occupancy in rooms_data:
            room, created = Room.objects.update_or_create(
                name=name,
                defaults={'capacity': capacity, 'occupancy': occupancy},
            )
            if created:
                add_measurements(room)
                self.stdout.write(self.style.SUCCESS(f'Created room: {room.name} (id={room.id})'))
            else:
                self.stdout.write(f'Room already exists: {room.name} (id={room.id})')

        users_data = [
            ("John Admin", "john@company.com", "Admin", "active"),
            ("Sarah Manager", "sarah@company.com", "Facility Manager", "active"),
            ("Mike Employee", "mike@company.com", "Employee", "active"),
            ("Lisa Manager", "lisa@company.com", "Facility Manager", "active"),
            ("Tom Employee", "tom@company.com", "Employee", "inactive"),
        ]
        for name, email, role, status in users_data:
            UserProfile.objects.update_or_create(
                email=email,
                defaults={"name": name, "role": role, "status": status},
            )

        device_templates = [
            ("Temp Sensor", "Temperature"),
            ("CO2 Sensor", "Air Quality"),
            ("Occupancy Sensor", "Occupancy"),
            ("Light Controller", "Lighting"),
            ("HVAC Controller", "HVAC"),
        ]
        rooms = list(Room.objects.all().order_by("id"))
        for idx, room in enumerate(rooms):
            for dev_idx, (base_name, dev_type) in enumerate(device_templates):
                IoTDevice.objects.update_or_create(
                    name=f"{base_name} {room.id}-{dev_idx+1}",
                    room=room,
                    defaults={
                        "type": dev_type,
                        "device_uid": f"IOT-R{room.id}-D{dev_idx + 1}",
                        "status": "online" if room.occupancy > 0 else "offline",
                    },
                )
        self.stdout.write(self.style.SUCCESS('Done. You can test Live Monitoring with room id 1, 2, 3, 4, or 5.'))
