from django.urls import path
from dashboard import views as dviews

urlpatterns = [
    path('api/rooms/', dviews.api_rooms, name='api_rooms'),
    path('api/rooms/create/', dviews.api_create_room, name='api_create_room'),
    path('api/rooms/<int:room_id>/measurements/', dviews.api_room_measurements, name='api_room_measurements'),
    path('api/dashboard-summary/', dviews.api_dashboard_summary, name='api_dashboard_summary'),
    path('api/users/', dviews.api_users, name='api_users'),
    path('api/users/<int:user_id>/', dviews.api_user_detail, name='api_user_detail'),
    path('api/devices/', dviews.api_devices, name='api_devices'),
    path('api/devices/<int:device_id>/', dviews.api_device_detail, name='api_device_detail'),
]
