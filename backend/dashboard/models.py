from django.db import models


class Room(models.Model):
    name = models.CharField(max_length=100)
    capacity = models.PositiveIntegerField()
    occupancy = models.PositiveIntegerField(default=0)

    @property
    def status(self):
        return 'available' if self.occupancy == 0 else 'busy'

    def __str__(self):
        return self.name


class Measurement(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='measurements')
    timestamp = models.DateTimeField(auto_now_add=True)
    temperature = models.FloatField()
    humidity = models.FloatField()
    co2 = models.FloatField()
    noise = models.FloatField()
    light = models.FloatField()


class UserProfile(models.Model):
    ROLE_CHOICES = [
        ("Admin", "Admin"),
        ("Facility Manager", "Facility Manager"),
        ("Employee", "Employee"),
    ]
    STATUS_CHOICES = [
        ("active", "Active"),
        ("inactive", "Inactive"),
    ]

    name = models.CharField(max_length=120)
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=32, choices=ROLE_CHOICES, default="Employee")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="active")

    def __str__(self):
        return self.name


class IoTDevice(models.Model):
    STATUS_CHOICES = [
        ("online", "Online"),
        ("offline", "Offline"),
        ("error", "Error"),
    ]

    name = models.CharField(max_length=120)
    type = models.CharField(max_length=64)
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="devices")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="online")
    last_update = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name
