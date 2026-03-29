# Backend SmartRoom (Django + MySQL)

## 1. Créer la base MySQL

Dans MySQL (ou MariaDB), exécute :

```sql
CREATE DATABASE smartroom CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## 2. Environnement Python

```bash
cd backend
python -m venv venv
venv\Scripts\activate    # Windows
# source venv/bin/activate   # Linux/Mac

pip install -r requirements.txt
```

## 3. Configurer le mot de passe MySQL (si besoin)

Sous Windows (PowerShell) :

```powershell
$env:MYSQL_PASSWORD = "ton_mot_de_passe"
```

Ou édite `smartroom/settings.py` et mets ton mot de passe dans `DATABASES['default']['PASSWORD']`.

## 4. Migrations et données de test

```bash
python manage.py migrate
python manage.py seed_rooms
```

`seed_rooms` crée 5 salles avec des historiques Temperature, Humidity, CO₂, Noise, Light.

## 5. Lancer le serveur

```bash
python manage.py runserver
```

API disponibles :

- `POST http://127.0.0.1:8000/api/rooms/create/` — créer une room (JSON: name, capacity, occupancy)
- `GET http://127.0.0.1:8000/api/rooms/1/measurements/` — historique des mesures de la room 1

Dans l’app React, ouvre une room (ex. Conference Room A) puis Live Monitoring : les graphiques utilisent ces données.

## Option : tester sans MySQL (SQLite)

Dans `smartroom/settings.py`, remplace la config `DATABASES` par :

```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}
```

Puis `python manage.py migrate` et `python manage.py seed_rooms`.
