#!/usr/bin/env python3
"""
SmartRoom Sensor Agent — Raspberry Pi
Capteurs : DHT22 (temp/humidité), BH1750 (lumière), INMP441 I2S (niveau sonore 0-100),
           SDS011 (PM2.5/PM10), PIR (mouvement)
"""
import time
import json
import math
import logging
import sys
import os
import glob
import struct
import wave
import subprocess
import threading
from datetime import datetime, timezone
from pathlib import Path

AGENT_START_TIME = time.time()

# ── Firebase ─────────────────────────────────────────────────────────────────
import firebase_admin
from firebase_admin import credentials, firestore

# ── Config ───────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
CONFIG_PATH = BASE_DIR / "agent_config.json"
KEY_PATH = BASE_DIR / "serviceAccountKey.json"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("sensor_agent")


def load_config() -> dict:
    with open(CONFIG_PATH) as f:
        return json.load(f)


# ── Firebase ──────────────────────────────────────────────────────────────────
def init_firebase(project_id: str):
    if not firebase_admin._apps:
        cred = credentials.Certificate(str(KEY_PATH))
        firebase_admin.initialize_app(cred, {"projectId": project_id})
    return firestore.client()


# ── DHT22 — Température / Humidité ───────────────────────────────────────────
def read_dht22(pin: int):
    """Retourne (temperature_C, humidity_pct) ou (None, None) en cas d'erreur.
    5 tentatives × 1.2 s — DHT22 peut nécessiter plusieurs secondes après mise sous tension."""
    try:
        import adafruit_dht
        import board
        sensor = adafruit_dht.DHT22(getattr(board, f"D{pin}"), use_pulseio=False)
        for attempt in range(5):
            try:
                temp = sensor.temperature
                hum = sensor.humidity
                if temp is not None and hum is not None:
                    sensor.exit()
                    return round(float(temp), 1), round(float(hum), 1)
            except RuntimeError as e:
                log.debug(f"DHT22 tentative {attempt + 1}/5 : {e}")
            time.sleep(1.2)
        sensor.exit()
        log.warning(f"DHT22 pin {pin} : aucune lecture valide après 5 tentatives")
    except Exception as e:
        log.warning(f"DHT22 erreur pin {pin}: {e}")
    return None, None


# ── BH1750 — Lumière (lux) avec auto-détection du bus I2C ────────────────────
def read_bh1750(addr: int = 0x23, preferred_bus: int = 1):
    """
    Lit le BH1750 en testant le bus I2C préféré puis tous les autres.
    Protocole correct : write_byte(POWER_ON) + write_byte(mode) + i2c_msg.read(2).
    read_i2c_block_data ne fonctionne pas car BH1750 n'a pas de registres SMBus.
    """
    try:
        from smbus2 import SMBus, i2c_msg
    except ImportError:
        log.warning("smbus2 non installé — BH1750 ignoré")
        return None

    try:
        all_buses = sorted(int(p.split("-")[-1]) for p in glob.glob("/dev/i2c-*"))
    except Exception:
        all_buses = [preferred_bus]

    buses = [preferred_bus] + [b for b in all_buses if b != preferred_bus]

    for bus_num in buses:
        try:
            with SMBus(bus_num) as bus:
                bus.write_byte(addr, 0x01)   # POWER_ON
                bus.write_byte(addr, 0x10)   # Continuously H-Res Mode 1
                time.sleep(0.18)
                read_msg = i2c_msg.read(addr, 2)
                bus.i2c_rdwr(read_msg)
                data = list(read_msg)
            lux = ((data[0] << 8) | data[1]) / 1.2
            log.info(f"BH1750 sur bus I2C {bus_num} — {lux:.1f} lux")
            return round(lux, 1)
        except Exception as e:
            log.debug(f"BH1750 bus {bus_num}: {e}")

    log.warning(f"BH1750 non trouvé — buses testés : {buses}")
    return None


# ── Capteur lumière analogique 3 broches (OUT, GND, VCC) ─────────────────────
def read_analog_light_sensor(pin: int = 27):
    """
    Lit la sortie numérique d'un capteur LDR comparateur.
    GPIO.setmode() doit déjà avoir été appelé par init_gpio() avant cette fonction.
    HIGH quand lumineux, LOW quand sombre (modules LM393 standard).
    """
    try:
        import RPi.GPIO as GPIO
        # Pas de setmode ici — géré par init_gpio() au démarrage
        GPIO.setup(pin, GPIO.IN, pull_up_down=GPIO.PUD_DOWN)
        value = GPIO.input(pin)
        log.info(f"Capteur lumiere GPIO {pin} = {'HIGH (claire)' if value else 'LOW (sombre)'}")
        return 100.0 if value else 0.0
    except Exception as e:
        log.warning(f"Capteur lumiere analogique erreur GPIO {pin}: {e}")
        return None


# ── INMP441 I2S — Niveau sonore 0-100 via arecord ────────────────────────────
def read_inmp441_level(device: str = "hw:1,0", duration: float = 1.0,
                       samplerate: int = 16000) -> float | None:
    """
    Lit le niveau sonore depuis le micro I2S INMP441 via arecord.

    Câblage INMP441 :
      VDD → 3.3V     GND → GND
      SCK → GPIO 18  WS  → GPIO 19   SD → GPIO 20   L/R → GND

    /boot/firmware/config.txt (Pi 4/5) ou /boot/config.txt :
      dtparam=i2s=on
      dtoverlay=i2s-mems

    Retourne un niveau relatif 0–100 (log-RMS, non calibré en dBSPL) :
      0–35  → calme
      35–65 → moyen
      65–100 → fort

    Pour trouver le nom ALSA du périphérique : arecord -l
    Exemple : "hw:1,0"  ou  "hw:2,0"  selon la carte.
    Si device=None l'entrée ALSA par défaut est utilisée.
    """
    tmp = "/tmp/smartroom_noise.wav"
    alsa_dev = device if device else "default"

    # plughw laisse ALSA convertir canaux/format/rate automatiquement
    plug_dev = ("plughw:" + alsa_dev[3:]) if alsa_dev.startswith("hw:") else alsa_dev

    # Configurations à tester dans l'ordre (device, channels, format, rate)
    # plughw en premier — le plus portable ; plusieurs taux car certains drivers
    # I2S n'acceptent que 44100/48000 Hz nativement.
    configs = [
        (plug_dev, 1, "S16_LE", samplerate),
        (plug_dev, 2, "S32_LE", samplerate),
        (plug_dev, 1, "S32_LE", samplerate),
        (plug_dev, 2, "S32_LE", 44100),
        (plug_dev, 2, "S32_LE", 48000),
        (alsa_dev, 2, "S32_LE", samplerate),
        (alsa_dev, 1, "S32_LE", samplerate),
    ]

    last_err = "aucune configuration testée"
    for dev, ch, fmt, rate in configs:
        try: os.unlink(tmp)
        except Exception: pass
        try:
            res = subprocess.run(
                ["arecord", "-D", dev, f"-r{rate}", f"-c{ch}", f"-f{fmt}",
                 f"-d{max(1, int(math.ceil(duration)))}", "-q", tmp],
                capture_output=True, timeout=duration + 8,
            )
            if res.returncode != 0:
                last_err = res.stderr.decode(errors="replace").strip()
                log.debug(f"INMP441 {dev} c{ch} {fmt} {rate}Hz: {last_err}")
                continue

            if not os.path.exists(tmp):
                continue

            with wave.open(tmp, "rb") as wf:
                n_channels = wf.getnchannels()
                sw        = wf.getsampwidth()
                raw       = wf.readframes(wf.getnframes())

            bps      = sw
            fmt_char = 'h' if bps == 2 else 'i'
            n_total  = len(raw) // bps
            if n_total < 100:
                continue

            all_s  = struct.unpack(f"<{n_total}{fmt_char}", raw)
            mono   = all_s[::n_channels]          # canal gauche uniquement
            n      = len(mono)
            rms    = math.sqrt(sum(x * x for x in mono) / n)

            # Seuils selon la profondeur de bits
            FLOOR   = 200   if bps == 2 else 50_000
            CEILING = 16000 if bps == 2 else 500_000_000
            if rms <= FLOOR:
                return 5.0
            lvl = (math.log10(min(rms, CEILING)) - math.log10(FLOOR)) / \
                  (math.log10(CEILING) - math.log10(FLOOR)) * 100.0
            log.debug(f"INMP441 OK {dev} c{ch} {fmt} {rate}Hz — rms={rms:.0f} lvl={lvl:.1f}")
            return round(min(100.0, max(0.0, lvl)), 1)

        except subprocess.TimeoutExpired:
            log.warning(f"INMP441 timeout sur {dev}")
            break
        except Exception as e:
            log.debug(f"INMP441 exception {dev}: {e}")

    try: os.unlink(tmp)
    except Exception: pass
    log.warning(f"INMP441 arecord erreur (device={alsa_dev}): {last_err}")
    return None


def _find_inmp441_device() -> str:
    """
    Parcourt les cartes ALSA pour trouver la carte i2s-mems / rpi-i2s.
    Retourne 'hw:N,0' ou 'hw:1,0' par défaut.
    """
    try:
        result = subprocess.run(["arecord", "-l"], capture_output=True, text=True, timeout=5)
        for line in result.stdout.splitlines():
            low = line.lower()
            if any(k in low for k in ("i2s", "mems", "inmp", "rpi-i2s")):
                import re
                m = re.search(r"card\s+(\d+)", line, re.IGNORECASE)
                if m:
                    dev = f"hw:{m.group(1)},0"
                    log.info(f"INMP441 auto-détecté : {dev} — {line.strip()}")
                    return dev
    except Exception:
        pass
    log.info("INMP441 : périphérique non auto-détecté, utilisation de hw:1,0")
    return "hw:1,0"


# ── SDS011 — PM2.5 / PM10 ────────────────────────────────────────────────────
def read_sds011(port: str = "/dev/ttyUSB0"):
    """Retourne (pm25, pm10) en µg/m³ ou (None, None)."""
    try:
        import serial
        ser = serial.Serial(port, baudrate=9600, timeout=2)
        ser.flushInput()
        time.sleep(1)
        raw = ser.read(10)
        ser.close()
        if len(raw) == 10 and raw[0] == 0xAA and raw[9] == 0xAB:
            pm25 = round(((raw[3] << 8) | raw[2]) / 10.0, 1)
            pm10 = round(((raw[5] << 8) | raw[4]) / 10.0, 1)
            return pm25, pm10
    except Exception as e:
        log.warning(f"SDS011 erreur: {e}")
    return None, None


# ── GPIO — Initialisation unique ─────────────────────────────────────────────
def init_gpio():
    """Initialise RPi.GPIO en mode BCM une seule fois. Doit être appelée avant
    setup_pir() et read_analog_light_sensor() pour éviter les conflits setmode."""
    try:
        import RPi.GPIO as GPIO
        GPIO.setwarnings(False)
        GPIO.setmode(GPIO.BCM)
        log.info("GPIO initialisé (BCM)")
    except Exception as e:
        log.warning(f"GPIO init erreur: {e}")


# ── PIR — Détection de mouvement (polling direct, sans callback) ──────────────
def setup_pir(pin: int):
    """Configure le GPIO PIR en entrée avec résistance pull-down interne.
    Sans PUD_DOWN la broche flotte à HIGH quand le capteur est inactif → faux positifs."""
    try:
        import RPi.GPIO as GPIO
        GPIO.setup(pin, GPIO.IN, pull_up_down=GPIO.PUD_DOWN)
        log.info(f"PIR configuré — GPIO {pin} (polling, PUD_DOWN)")
    except Exception as e:
        log.warning(f"PIR setup erreur: {e}")


def is_pir_active(pin: int) -> bool:
    """Lit directement l'état GPIO du PIR — HIGH = mouvement détecté."""
    try:
        import RPi.GPIO as GPIO
        return bool(GPIO.input(pin))
    except Exception:
        return False


# ── Firestore ─────────────────────────────────────────────────────────────────
def create_noise_alert(db, room_name: str, noise_level: float,
                       loud_threshold: float = 65.0):
    """
    Crée une alerte bruit dans Firestore si aucune alerte ouverte n'existe déjà.
    type='critical' si fort (≥ loud_threshold), sinon 'warning'.
    """
    try:
        existing = db.collection("alerts")\
            .where("category", "==", "Bruit")\
            .where("room", "==", room_name)\
            .where("status", "==", "open")\
            .limit(1).get()
        if existing:
            return  # Alerte déjà ouverte — ne pas spammer
        label = "Fort" if noise_level >= loud_threshold else "Moyen"
        alert_type = "critical" if noise_level >= loud_threshold else "warning"
        db.collection("alerts").add({
            "type": alert_type,
            "room": room_name,
            "title": f"Niveau sonore élevé — {room_name}",
            "message": f"Niveau sonore {int(noise_level)}/100 ({label}) détecté par INMP441. Vérifier la source de bruit.",
            "category": "Bruit",
            "status": "open",
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        })
        log.info(f"Alerte bruit créée → {room_name} niveau {int(noise_level)}/100 ({label})")
    except Exception as e:
        log.warning(f"Erreur création alerte bruit: {e}")


def write_measurement(db, room_id: str, data: dict):
    # ID basé sur le timestamp (16 chiffres ms zero-padded) — identique au format dashboard.
    # Garantit un seul document par cycle, sans collision avec les écritures du frontend.
    doc_id = str(int(time.time() * 1000)).zfill(16)
    payload = {
        "timestamp": firestore.SERVER_TIMESTAMP,
        **data,   # inclut toutes les clés, même null — schéma constant
    }
    db.collection("rooms").document(room_id).collection("measurements").document(doc_id).set(payload)
    log.info(f"Firestore → room {room_id} [{doc_id}] : {data}")


def update_motion(db, room_id: str):
    """Marque la salle occupée (occupancy=1) dès détection de mouvement."""
    db.collection("rooms").document(room_id).update({
        "lastMotionAt": firestore.SERVER_TIMESTAMP,
        "occupancy": 1,
    })
    log.info(f"Mouvement detecte → room {room_id} occupee")


def reset_occupancy(db, room_id: str):
    """Remet la salle à disponible (occupancy=0) après absence de mouvement."""
    db.collection("rooms").document(room_id).update({"occupancy": 0})
    log.info(f"Aucun mouvement → room {room_id} disponible")


# ── Dashboard : heartbeat + relance à distance ────────────────────────────────
_last_restart_check = 0.0
RESTART_CHECK_INTERVAL = 30  # secondes entre deux vérifications Firestore


def update_device_heartbeat(db, device_id: str):
    """Met à jour lastUpdate sur le document device pour confirmer que l'agent est actif."""
    if not device_id:
        return
    try:
        db.collection("devices").document(device_id).update({
            "lastUpdate": firestore.SERVER_TIMESTAMP,
        })
    except Exception as e:
        log.warning(f"Heartbeat device impossible: {e}")


def check_restart_signal(db, device_id: str):
    """
    Vérifie si le dashboard a demandé une relance (serviceRestartRequestedAt).
    Si oui, met à jour lastUpdate (confirmation) et remplace le processus courant.
    """
    global _last_restart_check
    if not device_id:
        return
    now = time.time()
    if now - _last_restart_check < RESTART_CHECK_INTERVAL:
        return
    _last_restart_check = now

    try:
        doc = db.collection("devices").document(device_id).get()
        if not doc.exists:
            return
        req = doc.to_dict().get("serviceRestartRequestedAt")
        if req is None:
            return
        # Firestore Timestamp ou nombre (ms)
        if hasattr(req, "timestamp"):
            req_ts = req.timestamp()
        else:
            req_ts = float(req) / 1000.0
        if req_ts > AGENT_START_TIME + 5:
            log.info("Relance demandée via dashboard — redémarrage de l'agent...")
            db.collection("devices").document(device_id).update({
                "lastUpdate": firestore.SERVER_TIMESTAMP,
            })
            os.execv(sys.executable, [sys.executable] + sys.argv)
    except Exception as e:
        log.warning(f"Erreur vérification relance: {e}")


# ── Boucle principale ─────────────────────────────────────────────────────────
def main():
    cfg = load_config()
    firebase_cfg = cfg.get("firebase", {})
    room_id = str(cfg.get("room_id", "1"))
    interval = int(cfg.get("interval_seconds", 300))
    sensors = cfg.get("sensors", {})

    dht_pin = int(sensors.get("dht22_pin", 4))
    pir_pin = int(sensors.get("pir_pin", 17))
    light_sensor_type = sensors.get("light_sensor_type", "bh1750_i2c")
    light_gpio_pin = int(sensors.get("light_gpio_pin", 27))
    bh1750_addr = int(sensors.get("bh1750_addr", 0x23))
    bh1750_bus = int(sensors.get("bh1750_i2c_bus", 1))
    inmp441_device = sensors.get("inmp441_device", None)   # None → auto-détection, 'disabled' → désactivé
    inmp441_sr = int(sensors.get("inmp441_samplerate", 16000))
    inmp441_dur = float(sensors.get("inmp441_duration", 1.0))
    sds011_port = sensors.get("sds011_port", "/dev/ttyUSB0")
    inmp441_disabled = (inmp441_device == "disabled")

    noise_alerts_cfg = cfg.get("noise_alerts", {})
    noise_alerts_enabled = bool(noise_alerts_cfg.get("enabled", True))
    noise_medium_thr = float(noise_alerts_cfg.get("medium_threshold", 35))
    noise_loud_thr = float(noise_alerts_cfg.get("loud_threshold", 65))
    noise_cooldown = float(noise_alerts_cfg.get("cooldown_minutes", 30)) * 60

    device_id = str(cfg.get("device_id", "")).strip()
    project_id = firebase_cfg.get("project_id", "")
    db = init_firebase(project_id)

    # Heartbeat initial — confirme au dashboard que l'agent a (re)démarré
    update_device_heartbeat(db, device_id)

    # GPIO : initialisation unique AVANT setup_pir et read_analog_light_sensor
    # (évite que setmode soit rappelé plus tard et efface les event_detect PIR)
    init_gpio()

    # Auto-détecter le périphérique ALSA INMP441 si non spécifié et non désactivé
    if inmp441_device is None:
        inmp441_device = _find_inmp441_device()
    if inmp441_disabled:
        log.info("Microphone INMP441 desactive (inmp441_device=disabled)")

    # PIR — état occupancy (polling)
    VACANCY_SECONDS = int(cfg.get("pir_vacancy_seconds", 120))   # 2 min par défaut
    MOTION_REFRESH_SECONDS = 30   # Rafraîchit lastMotionAt toutes les 30s pendant occupation
    PIR_DEBOUNCE_COUNT = 3        # Lectures HIGH consécutives requises avant de confirmer le mouvement
    PIR_STUCK_SECONDS = 300       # Si HIGH en continu > 5 min sans jamais LOW → capteur bloqué
    was_occupied = False
    last_motion_ts = 0.0        # monotonic — dernière fois que PIR était HIGH confirmé
    last_motion_write_ts = 0.0  # monotonic — dernière écriture Firestore occupation
    pir_high_count = 0          # compteur debounce — réinitialisé à 0 dès que le PIR est LOW
    pir_stuck_since = 0.0       # monotonic — début d'un HIGH continu (0 = capteur LOW)

    log.info(f"Capteur lumière : {light_sensor_type}"
             + (f" GPIO {light_gpio_pin}" if light_sensor_type == "analog_gpio" else ""))
    setup_pir(pir_pin)

    # Diagnostic PIR au démarrage — valeur brute de la broche avant toute détection
    try:
        import RPi.GPIO as _GPIO
        _raw = _GPIO.input(pir_pin)
        log.info(f"PIR diagnostic demarrage — GPIO {pir_pin} = {'HIGH' if _raw else 'LOW'}")
        if _raw:
            log.warning(
                f"PIR GPIO {pir_pin} lit HIGH au demarrage (aucun mouvement possible). "
                "Causes probables : VCC branche sur 3.3V au lieu de 5V, "
                "câblage incorrect, ou capteur defectueux."
            )
    except Exception as _e:
        log.warning(f"PIR diagnostic impossible : {_e}")

    # Récupérer le nom de la salle pour les alertes
    room_name = room_id
    try:
        room_doc = db.collection("rooms").document(room_id).get()
        if room_doc.exists:
            room_name = room_doc.to_dict().get("name", room_id)
    except Exception as e:
        log.warning(f"Impossible de récupérer le nom de la salle: {e}")

    last_noise_alert_ts = 0.0
    # Dernières valeurs valides — évite d'écraser un bon relevé par un null transitoire
    last_valid: dict = {}
    log.info(f"Agent demarre — room={room_id} ({room_name}), device={device_id}, intervalle={interval}s, vacance={VACANCY_SECONDS}s")

    # ── Helper PIR : polling + debounce + detection capteur bloque ───────────
    def poll_pir():
        nonlocal was_occupied, last_motion_ts, last_motion_write_ts, pir_high_count, pir_stuck_since
        now = time.monotonic()
        if is_pir_active(pir_pin):
            # Horodater le début d'un signal HIGH continu
            if pir_stuck_since == 0.0:
                pir_stuck_since = now

            # Capteur bloqué : HIGH sans interruption depuis trop longtemps
            stuck_duration = now - pir_stuck_since
            if stuck_duration >= PIR_STUCK_SECONDS:
                if int(stuck_duration) % 60 == 0:  # log toutes les minutes seulement
                    log.warning(
                        f"PIR bloque HIGH depuis {int(stuck_duration)}s — "
                        "Firestore non mis a jour. Verifier VCC=5V et câblage GPIO {pir_pin}."
                    )
                return  # ignorer ce signal, ne pas marquer la salle occupée

            pir_high_count = min(pir_high_count + 1, PIR_DEBOUNCE_COUNT)
            if pir_high_count >= PIR_DEBOUNCE_COUNT:
                # Mouvement confirmé : N lectures consécutives HIGH
                last_motion_ts = now
                if not was_occupied or (now - last_motion_write_ts) >= MOTION_REFRESH_SECONDS:
                    try:
                        update_motion(db, room_id)
                        last_motion_write_ts = now
                        if not was_occupied:
                            log.info(f"PIR confirme ({PIR_DEBOUNCE_COUNT} HIGH consecutifs) → room {room_id} occupee")
                    except Exception as e:
                        log.error(f"Erreur mouvement Firestore: {e}")
                was_occupied = True
        else:
            # Signal LOW : réinitialiser debounce et horodatage stuck
            pir_high_count = 0
            pir_stuck_since = 0.0
            if was_occupied and last_motion_ts > 0 and (now - last_motion_ts) >= VACANCY_SECONDS:
                try:
                    reset_occupancy(db, room_id)
                except Exception as e:
                    log.error(f"Erreur reset occupancy: {e}")
                was_occupied = False
                last_motion_ts = 0.0
                last_motion_write_ts = 0.0

    while True:
        loop_start = time.monotonic()

        poll_pir()

        # Lecture de tous les capteurs
        temperature, humidity = read_dht22(dht_pin)

        if light_sensor_type == "analog_gpio":
            light = read_analog_light_sensor(light_gpio_pin)
        elif light_sensor_type == "bh1750_i2c":
            light = read_bh1750(bh1750_addr, preferred_bus=bh1750_bus)
        else:
            light = None

        noise = None if inmp441_disabled else read_inmp441_level(inmp441_device, inmp441_dur, inmp441_sr)
        pm25, pm10 = read_sds011(sds011_port)

        # Conserver les dernières valeurs valides pour éviter d'écraser un bon relevé
        # par un None transitoire (ex. DHT22 qui rate un cycle sur deux)
        for key, val in [("temperature", temperature), ("humidity", humidity),
                         ("light", light), ("noise", noise),
                         ("pm25", pm25), ("pm10", pm10)]:
            if val is not None:
                last_valid[key] = val

        measurement = {
            "temperature": temperature if temperature is not None else last_valid.get("temperature"),
            "humidity":    humidity    if humidity    is not None else last_valid.get("humidity"),
            "light":       light       if light       is not None else last_valid.get("light"),
            "noise":       noise       if noise       is not None else last_valid.get("noise"),
            "pm25":        pm25        if pm25        is not None else last_valid.get("pm25"),
            "pm10":        pm10        if pm10        is not None else last_valid.get("pm10"),
        }

        # Ne pas écrire si on n'a jamais eu de données (premier démarrage, aucun capteur branché)
        if not last_valid:
            log.warning("Aucune donnée capteur disponible — écriture ignorée ce cycle")
        else:
            try:
                write_measurement(db, room_id, measurement)
            except Exception as e:
                log.error(f"Erreur Firestore: {e}")

        # Alerte automatique bruit
        if noise_alerts_enabled and noise is not None and noise >= noise_medium_thr:
            now_ts = time.monotonic()
            if now_ts - last_noise_alert_ts >= noise_cooldown:
                create_noise_alert(db, room_name, noise, noise_loud_thr)
                last_noise_alert_ts = now_ts

        # Attente inter-cycle — polling PIR chaque seconde + relance dashboard
        elapsed = time.monotonic() - loop_start
        deadline = time.monotonic() + max(0, interval - elapsed)
        while time.monotonic() < deadline:
            poll_pir()
            check_restart_signal(db, device_id)
            time.sleep(1)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log.info("Agent arrêté (Ctrl-C).")
    finally:
        try:
            import RPi.GPIO as GPIO
            GPIO.cleanup()
        except Exception:
            pass
