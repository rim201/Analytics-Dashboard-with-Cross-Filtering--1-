"""
Backend MySQL compatible MariaDB 10.4+ (Django exige 10.6+ par défaut).
"""
from django.db.backends.mysql.base import DatabaseWrapper as MySQLDatabaseWrapper


class DatabaseWrapper(MySQLDatabaseWrapper):
    def check_database_version_supported(self):
        # Accepter MariaDB 10.4 (sinon Django exige 10.6+)
        pass
