"""
Enregistre la migration dashboard.0001_initial sans utiliser RETURNING
(MariaDB 10.4 ne supporte pas RETURNING).
À lancer une seule fois si les tables existent déjà.
Usage: python manage.py fix_migrations
"""
from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = "Enregistre dashboard.0001_initial (tables déjà créées, MariaDB 10.4)"

    def handle(self, *args, **options):
        with connection.cursor() as cursor:
            # Créer django_migrations si absent
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS django_migrations (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    app VARCHAR(255) NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    applied DATETIME NOT NULL
                )
            """)
            # Éviter doublon
            cursor.execute(
                "SELECT 1 FROM django_migrations WHERE app = %s AND name = %s",
                ["dashboard", "0001_initial"],
            )
            if cursor.fetchone():
                self.stdout.write(self.style.WARNING("Migration déjà enregistrée."))
                return
            cursor.execute(
                "INSERT INTO django_migrations (app, name, applied) VALUES (%s, %s, NOW())",
                ["dashboard", "0001_initial"],
            )
        self.stdout.write(self.style.SUCCESS("Migration dashboard.0001_initial enregistrée. Tu peux lancer: python manage.py seed_rooms"))
