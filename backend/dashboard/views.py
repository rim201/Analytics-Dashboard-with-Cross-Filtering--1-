import json
from datetime import timedelta
from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils import timezone

from .models import Room, Measurement, UserProfile, IoTDevice


@csrf_exempt
@require_http_methods(["POST"])
def api_create_room(request):
    try:
        data = json.loads(request.body.decode("utf-8"))
    except (json.JSONDecodeError, TypeError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    name = data.get("name")
    capacity = data.get("capacity")
    occupancy = data.get("occupancy", 0)
    device_payload = data.get("device")

    if not name or capacity is None:
        return JsonResponse({"error": "name and capacity are required"}, status=400)

    try:
        cap = int(capacity)
        occ = int(occupancy)
        if cap < 1 or occ < 0 or occ > cap:
            return JsonResponse({"error": "invalid capacity or occupancy"}, status=400)
    except (TypeError, ValueError):
        return JsonResponse({"error": "capacity and occupancy must be integers"}, status=400)

    created_device = None
    try:
        with transaction.atomic():
            room = Room.objects.create(
                name=str(name),
                capacity=cap,
                occupancy=occ,
            )

            if isinstance(device_payload, dict):
                device_uid = (
                    str(device_payload.get("deviceId") or device_payload.get("device_uid") or "")
                ).strip()
                dev_name = str(device_payload.get("name") or "").strip()
                dev_type = str(device_payload.get("type") or "").strip()
                dev_status = device_payload.get("status", "online")
                if dev_status not in ("online", "offline", "error"):
                    dev_status = "online"

                if device_uid or dev_name or dev_type:
                    if not device_uid or not dev_name or not dev_type:
                        raise ValueError(
                            "device requires deviceId, name and type when adding a device"
                        )
                    created_device = IoTDevice.objects.create(
                        name=dev_name,
                        type=dev_type,
                        device_uid=device_uid,
                        room=room,
                        status=dev_status,
                    )
    except ValueError as e:
        return JsonResponse({"error": str(e)}, status=400)

    out = {
        "id": room.id,
        "name": room.name,
        "capacity": room.capacity,
        "occupancy": room.occupancy,
        "status": room.status,
    }
    if created_device is not None:
        out["device"] = {
            "id": created_device.id,
            "name": created_device.name,
            "type": created_device.type,
            "deviceId": created_device.device_uid,
            "roomId": room.id,
            "status": created_device.status,
        }
    return JsonResponse(out, status=201)


@csrf_exempt
@require_http_methods(["DELETE"])
def api_delete_room(request, room_id):
    try:
        room = Room.objects.get(pk=room_id)
    except Room.DoesNotExist:
        return JsonResponse({"error": "Room not found"}, status=404)

    room_name = room.name
    room.delete()
    return JsonResponse({"ok": True, "message": f"Room '{room_name}' deleted successfully"})


@require_http_methods(["GET"])
def api_room_measurements(request, room_id):
    try:
        room = Room.objects.get(pk=room_id)
    except Room.DoesNotExist:
        return JsonResponse({"error": "Room not found"}, status=404)

    measurements = room.measurements.order_by("-timestamp")[:100]
    data = [
        {
            "timestamp": m.timestamp.isoformat(),
            "temperature": m.temperature,
            "humidity": m.humidity,
            "co2": m.co2,
            "noise": m.noise,
            "light": m.light,
        }
        for m in measurements
    ]
    return JsonResponse({"room_id": room.id, "measurements": data})


@require_http_methods(["GET"])
def api_rooms(request):
    rooms = Room.objects.all().order_by("id")
    payload = []
    for room in rooms:
        latest = room.measurements.order_by("-timestamp").first()
        payload.append(
            {
                "id": room.id,
                "name": room.name,
                "capacity": room.capacity,
                "occupancy": room.occupancy,
                "status": room.status,
                "temperature": latest.temperature if latest else 0,
                "humidity": latest.humidity if latest else 0,
                "co2": latest.co2 if latest else 0,
                "noise": latest.noise if latest else 0,
                "light": latest.light if latest else 0,
                "comfortScore": 92,
            }
        )
    return JsonResponse({"rooms": payload})


@require_http_methods(["GET"])
def api_dashboard_summary(request):
    now = timezone.now()
    day_ago = now - timedelta(hours=24)
    measurements = Measurement.objects.filter(timestamp__gte=day_ago).order_by("timestamp")

    def avg(field):
        values = [getattr(m, field) for m in measurements]
        if not values:
            return 0
        return round(sum(values) / len(values), 1)

    temperature_data = [
        {"time": m.timestamp.strftime("%H:%M"), "value": m.temperature}
        for m in measurements
    ]
    co2_data = [
        {"time": m.timestamp.strftime("%H:%M"), "value": m.co2}
        for m in measurements
    ]

    rooms = Room.objects.all()
    total_rooms = rooms.count()
    available_rooms = rooms.filter(occupancy=0).count()
    occupied_rooms = total_rooms - available_rooms

    return JsonResponse(
        {
            "comfortScore": 92,
            "temperature": avg("temperature"),
            "co2": avg("co2"),
            "noise": avg("noise"),
            "light": avg("light"),
            "temperatureData": temperature_data[-24:],
            "co2Data": co2_data[-24:],
            "roomOverview": {
                "total": total_rooms,
                "available": available_rooms,
                "occupied": occupied_rooms,
                "maintenance": 0,
            },
        }
    )


@csrf_exempt
@require_http_methods(["GET", "POST"])
def api_users(request):
    if request.method == "GET":
        users = UserProfile.objects.all().order_by("id")
        return JsonResponse(
            {
                "users": [
                    {
                        "id": u.id,
                        "name": u.name,
                        "email": u.email,
                        "role": u.role,
                        "status": u.status,
                    }
                    for u in users
                ]
            }
        )

    try:
        data = json.loads(request.body.decode("utf-8"))
    except (json.JSONDecodeError, TypeError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    name = data.get("name")
    email = data.get("email")
    role = data.get("role", "Employee")
    status = data.get("status", "active")
    if not name or not email:
        return JsonResponse({"error": "name and email are required"}, status=400)
    user = UserProfile.objects.create(name=name, email=email, role=role, status=status)
    return JsonResponse({"id": user.id}, status=201)


@csrf_exempt
@require_http_methods(["PUT", "DELETE"])
def api_user_detail(request, user_id):
    try:
        user = UserProfile.objects.get(pk=user_id)
    except UserProfile.DoesNotExist:
        return JsonResponse({"error": "User not found"}, status=404)

    if request.method == "DELETE":
        user.delete()
        return JsonResponse({"ok": True})

    try:
        data = json.loads(request.body.decode("utf-8"))
    except (json.JSONDecodeError, TypeError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    user.name = data.get("name", user.name)
    user.email = data.get("email", user.email)
    user.role = data.get("role", user.role)
    user.status = data.get("status", user.status)
    user.save()
    return JsonResponse({"ok": True})


@csrf_exempt
@require_http_methods(["GET", "POST"])
def api_devices(request):
    if request.method == "GET":
        devices = IoTDevice.objects.select_related("room").all().order_by("id")
        return JsonResponse(
            {
                "devices": [
                    {
                        "id": d.id,
                        "name": d.name,
                        "type": d.type,
                        "deviceId": d.device_uid,
                        "room": d.room.name,
                        "roomId": d.room_id,
                        "status": d.status,
                        "lastUpdate": d.last_update.strftime("%Y-%m-%d %H:%M"),
                    }
                    for d in devices
                ]
            }
        )

    try:
        data = json.loads(request.body.decode("utf-8"))
    except (json.JSONDecodeError, TypeError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    name = data.get("name")
    device_type = data.get("type")
    room_id = data.get("roomId")
    status = data.get("status", "online")
    device_uid = str(data.get("deviceId") or data.get("device_uid") or "").strip()
    if not name or not device_type or not room_id:
        return JsonResponse({"error": "name, type and roomId are required"}, status=400)
    try:
        room = Room.objects.get(pk=int(room_id))
    except (Room.DoesNotExist, ValueError, TypeError):
        return JsonResponse({"error": "Invalid roomId"}, status=400)
    device = IoTDevice.objects.create(
        name=name,
        type=device_type,
        device_uid=device_uid,
        room=room,
        status=status,
    )
    return JsonResponse({"id": device.id}, status=201)


@csrf_exempt
@require_http_methods(["PUT", "DELETE"])
def api_device_detail(request, device_id):
    try:
        device = IoTDevice.objects.get(pk=device_id)
    except IoTDevice.DoesNotExist:
        return JsonResponse({"error": "Device not found"}, status=404)

    if request.method == "DELETE":
        device.delete()
        return JsonResponse({"ok": True})

    try:
        data = json.loads(request.body.decode("utf-8"))
    except (json.JSONDecodeError, TypeError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    device.name = data.get("name", device.name)
    device.type = data.get("type", device.type)
    device.status = data.get("status", device.status)
    if "deviceId" in data:
        device.device_uid = str(data.get("deviceId") or "").strip()
    elif "device_uid" in data:
        device.device_uid = str(data.get("device_uid") or "").strip()
    room_id = data.get("roomId")
    if room_id is not None:
        try:
            device.room = Room.objects.get(pk=int(room_id))
        except (Room.DoesNotExist, ValueError, TypeError):
            return JsonResponse({"error": "Invalid roomId"}, status=400)
    device.save()
    return JsonResponse({"ok": True})
