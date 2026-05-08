import { firebaseClientConfig } from '../firebase';

export type PiAgentBundleParams = {
  deviceDocId: string;
  roomId: string;
  /** Capteurs documentés (référence pour branchement GPIO / bus). */
  sensorNotes?: string;
};

/** Matériel physique présent sur le Raspberry Pi. */
export type LightSensorType = 'bh1750_i2c' | 'analog_3pin' | 'none';
export type MicrophoneType = 'inmp441_i2s' | 'none';
export type SensorHardwareConfig = {
  /** GY-30/BH1750FVI (I2C 5 broches), capteur analogique/numérique 3 broches (OUT/GND/VCC), ou aucun. */
  lightSensor: LightSensorType;
  /** INMP441 I2S MEMS, ou aucun microphone. */
  microphone: MicrophoneType;
  /** Broche GPIO BCM pour la sortie OUT du capteur 3 broches (défaut 27). */
  analogLightGpioPin?: number;
};

export const DEFAULT_AGENT_INTERVAL_SECONDS = 300;

const SENSOR_DOC = `Capteurs cibles (broches / ports dans hardware) :
- DHT22 : température + humidité (GPIO)
- GY-30 / BH1750FVI : luminosité lux (I2C) — sur Pi 5 le nœud peut être /dev/i2c-13 (pas i2c-1) ; activer I2C dans raspi-config
- SDS011 : qualité de l’air particules PM2.5 + PM10 (UART, champs pm25 / pm10)
- Capteur CO₂ 0–5000 ppm : UART type MH-Z19 / compatible (champ co2)
- MAX9814 : niveau sonore via sortie analogique → MCP3008 SPI (champ noise, estimation dB)
- PIR HC-SR501 : lecture GPIO interne uniquement — **plus de champ motion dans les documents measurements** ; l’état salle = **rooms/{documentId}.occupancy** (0 libre, ≥1 occupé), mis à jour par l’agent. **roomId** dans agent_config.json doit être l’**ID Firestore** de la salle (sans préfixe « room- » si vous le voyez dans l’URL du dashboard ; l’agent accepte les deux formes). OUT → broche BCM hardware.pirGpio (défaut 23 dans le JSON généré ; à adapter à votre câblage), alim module souvent 5 V mais **OUT vers GPIO 3,3 V** uniquement (sortie 5 V sur GPIO = ligne bloquée à « 1 » / dommages — utiliser diviseur ou module 3,3 V). **Réglages module** : potentiomètre **TIME** (durée du signal après détection) — s’il est au maximum la sortie reste haute très longtemps ; le ramener au minimum puis augmenter si besoin. **SENS** : éviter sur-sensibilité (courants d’air). Jumper **L / H** : mode **non répétitif** (single) évite de réarmer en continu. pirSampleMs : courte attente avant lecture (ms) hors gpiozero persistant. pirPreferGpiozero (défaut true) : PIR via gpiozero **DigitalInputDevice** ouvert une fois (comme l’exemple officiel : boucle sur motion_sensor.is_active) ; mettre false pour forcer RPi.GPIO en premier (ferme l’instance gpiozero si elle était ouverte). pirOccupancyPollSeconds (défaut **0.5**) : délai entre deux lectures PIR pour l’occupation (secondes, ex. 0.5 comme sleep(0.5) dans les tutos) ; écriture Firestore seulement si occupancy change. syncRoomOccupancyFromPir (défaut true) : **dès** une détection (is_active / mouvement) → **occupancy = 1 envoyée tout de suite** (aucune attente de la minute) ; **sans nouvelle détection** pendant pirVacancyMinutes (défaut **1** min) après la dernière → **0 libre**. **pirMotionCooldownSeconds** (défaut **5** s) : anti-fausse détection — on ne **rafraîchit** l’horodatage « dernier mouvement » (vacance) qu’au plus une fois par ce délai tant que la ligne reste active (même idée qu’un script RPi.GPIO : lecture HIGH + délai minimum entre deux prises en compte) ; réduit la sensibilité logicielle sans changer le câblage. pirActiveLow / pirPullUp selon le module. pirGpioChip / ROOM_SENSOR_PIR_GPIOCHIP si besoin (gpiodetect).
Ports série (hardware dans agent_config.json) :
- SDS011 sur adaptateur USB → en général /dev/ttyUSB0 (crw-rw---- root:dialout).
- CO₂ UART sur le port série GPIO → sur Raspberry Pi OS /dev/serial0 pointe vers ttyS0 (ex. lrwxrwxrwx … serial0 -> ttyS0) : utiliser co2SerialDevice /dev/serial0 ou /dev/ttyS0.
L’utilisateur du service (souvent « pi ») doit être dans le groupe dialout : sudo usermod -aG dialout pi puis reconnexion.`;

/** JSON embarqué sur la carte : config web + cibles Firestore. */
export function buildAgentConfigJson(
  params: PiAgentBundleParams,
  intervalSeconds: number = DEFAULT_AGENT_INTERVAL_SECONDS,
  sensorConfig?: SensorHardwareConfig,
): string {
  const lightSensor = sensorConfig?.lightSensor ?? 'bh1750_i2c';
  const lightSensorType =
    lightSensor === 'analog_3pin' ? 'analog_gpio' :
    lightSensor === 'none' ? 'none' : 'bh1750_i2c';
  const analogPin = sensorConfig?.analogLightGpioPin ?? 27;
  const micDisabled = sensorConfig?.microphone === 'none';

  return `${JSON.stringify(
    {
<<<<<<< HEAD
      firebase: {
        project_id: firebaseClientConfig.projectId,
      },
      device_id: params.deviceDocId,
      room_id: params.roomId,
      interval_seconds: intervalSeconds,
      sensors: {
        dht22_pin: 4,
        pir_pin: 17,
        light_sensor_type: lightSensorType,
        light_gpio_pin: analogPin,
        bh1750_addr: 35,
        bh1750_i2c_bus: 1,
        inmp441_device: micDisabled ? 'disabled' : null,
        inmp441_samplerate: 16000,
        inmp441_duration: 1.0,
        sds011_port: '/dev/ttyUSB0',
        mq135_ads1115_channel: 0,
      },
      noise_alerts: {
        enabled: true,
        medium_threshold: 35,
        loud_threshold: 65,
        cooldown_minutes: 30,
=======
      firebaseClient: firebaseClientConfig,
      deviceDocId: params.deviceDocId,
      roomId: params.roomId,
      intervalSeconds,
      sensors: SENSOR_DOC,
      hardware: {
        dht22Gpio: 4,
        pirGpio: 23,
        pirGpioChip: null,
        pirPullUp: false,
        pirActiveLow: false,
        pirSampleMs: 700,
        pirMotionMinFrac: 0.72,
        pirVacancyMinutes: 2,
        /** Anti-sensibilité : min. secondes entre deux prises en compte du « dernier mouvement » (rafraîchissement vacance) si la ligne reste à 1. */
        pirMotionCooldownSeconds: 5,
        /** Intervalle entre deux lectures is_active (ex. 0.5 s, style tuto gpiozero). */
        pirOccupancyPollSeconds: 0.5,
        /** true : lire le PIR avec gpiozero (DigitalInputDevice) en premier, comme les exemples Raspberry ; false : RPi.GPIO en premier. */
        pirPreferGpiozero: true,
        syncRoomOccupancyFromPir: true,
        bh1750I2cBus: 1,
        bh1750I2cAddr: 35,
        sds011SerialDevice: '/dev/ttyUSB0',
        co2SerialDevice: '/dev/serial0',
        mcp3008SpiBus: 0,
        mcp3008SpiDevice: 0,
        max9814McpChannel: 0,
        max9814SampleCount: 400,
        max9814NoiseGain: 0.09,
        max9814NoiseFloorDb: 34,
>>>>>>> de425048a4433d79704cfc35b86f357f42007b07
      },
    },
    null,
    2,
  )}\n`;
}

/** Script Python : lecture périodique + réaction à sensorCaptureRequestedAt / serviceRestartRequestedAt (dashboard). */
export function buildSensorAgentPy(_config?: SensorHardwareConfig): string {
  return `#!/usr/bin/env python3
"""
SmartRoom Sensor Agent — Raspberry Pi
Capteurs : DHT22 (temp/humidite), BH1750 I2C ou capteur analogique 3 broches (lumiere),
           INMP441 I2S (niveau sonore 0-100), SDS011 (PM2.5/PM10), MQ135/ADS1115 (CO2), PIR (mouvement)
Configuration via agent_config.json > sensors > light_sensor_type (bh1750_i2c | analog_gpio | none)
                                              > inmp441_device ('disabled' pour desactiver)
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
    """Retourne (temperature_C, humidity_pct) ou (None, None).
    5 tentatives x 1.2 s -- DHT22 peut necessiter plusieurs secondes apres mise sous tension."""
    try:
        import adafruit_dht
        import board
        sensor = adafruit_dht.DHT22(getattr(board, f'D{pin}'), use_pulseio=False)
        for attempt in range(5):
            try:
                temp = sensor.temperature
                hum = sensor.humidity
                if temp is not None and hum is not None:
                    sensor.exit()
                    return round(float(temp), 1), round(float(hum), 1)
            except RuntimeError as e:
                log.debug(f'DHT22 tentative {attempt + 1}/5 : {e}')
            time.sleep(1.2)
        sensor.exit()
        log.warning(f'DHT22 pin {pin} : aucune lecture valide apres 5 tentatives')
    except Exception as e:
        log.warning(f'DHT22 erreur pin {pin}: {e}')
    return None, None


# ── BH1750 — Lumière (lux) via I2C brut (5 broches : SDA/SCL/ADDR/VCC/GND) ──
def read_bh1750(addr: int = 0x23, preferred_bus: int = 1):
    """
    Lit le BH1750 (GY-30/BH1750FVI) en testant tous les bus I2C disponibles.
    Utilise i2c_msg pour un transfert I2C brut (pas SMBus register protocol).
    """
    try:
        from smbus2 import SMBus, i2c_msg
    except ImportError:
        log.warning('smbus2 non installe -- BH1750 ignore')
        return None

    try:
        all_buses = sorted(int(p.split('-')[-1]) for p in glob.glob('/dev/i2c-*'))
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
            log.info(f'BH1750 detecte -- bus I2C {bus_num} (/dev/i2c-{bus_num})')
            return round(lux, 1)
        except Exception as e:
            log.debug(f'BH1750 bus {bus_num}: {e}')

    log.warning(f'BH1750 non trouve -- buses testes : {buses}')
    return None


# ── Capteur lumière analogique 3 broches (OUT, GND, VCC) ─────────────────────
def read_analog_light_sensor(pin: int = 27):
    """
    Lit la sortie numerique d'un capteur lumiere 3 broches (comparateur LDR).
    GPIO.setmode() doit deja avoir ete appele par init_gpio() avant cette fonction.
    HIGH quand lumineux, LOW quand sombre (modules LM393 standard).
    """
    try:
        import RPi.GPIO as GPIO
        # Pas de setmode ici -- gere par init_gpio() au demarrage
        GPIO.setup(pin, GPIO.IN, pull_up_down=GPIO.PUD_DOWN)
        value = GPIO.input(pin)
        log.info(f'Capteur lumiere GPIO {pin} = {"HIGH (claire)" if value else "LOW (sombre)"}')
        return 100.0 if value else 0.0
    except Exception as e:
        log.warning(f'Capteur lumiere analogique erreur GPIO {pin}: {e}')
        return None


# ── INMP441 I2S — Niveau sonore 0-100 via arecord ────────────────────────────
def read_inmp441_level(device: str = 'hw:1,0', duration: float = 1.0,
                       samplerate: int = 16000):
    """
    Lit le niveau sonore INMP441 via arecord. Essaie 7 configs (plughw/hw, mono/stereo,
    S16/S32, taux 16k/44.1k/48k) pour contourner les contraintes du driver I2S.
    Retourne un niveau 0-100 (log-RMS) ou None.
    """
    tmp = '/tmp/smartroom_noise.wav'
    try:
        alsa_dev = device if device and device != 'disabled' else 'default'
        plug_dev = ('plughw:' + alsa_dev[3:]) if alsa_dev.startswith('hw:') else alsa_dev
        configs = [
            (plug_dev, 1, 'S16_LE', samplerate),
            (plug_dev, 2, 'S32_LE', samplerate),
            (plug_dev, 1, 'S32_LE', samplerate),
            (plug_dev, 2, 'S32_LE', 44100),
            (plug_dev, 2, 'S32_LE', 48000),
            (alsa_dev, 2, 'S32_LE', samplerate),
            (alsa_dev, 1, 'S32_LE', samplerate),
        ]
        last_err = ''
        for (dev, channels, fmt, rate) in configs:
            try: os.unlink(tmp)
            except Exception: pass
            result = subprocess.run(
                ['arecord', '-D', dev, f'-r{rate}', f'-c{channels}',
                 f'-f{fmt}', f'-d{max(1, int(math.ceil(duration)))}', '-q', tmp],
                capture_output=True, timeout=duration + 6,
            )
            if result.returncode == 0 and os.path.exists(tmp):
                log.debug(f'INMP441 config OK: {dev} {channels}ch {fmt} {rate}Hz')
                break
            last_err = result.stderr.decode(errors='replace').strip()
        else:
            log.warning(f'INMP441 arecord echec toutes configs (device={alsa_dev}): {last_err}')
            return None

        with wave.open(tmp, 'rb') as wf:
            raw = wf.readframes(wf.getnframes())
            n_channels = wf.getnchannels()
            sampwidth = wf.getsampwidth()

        if sampwidth == 2:
            fmt_char, FLOOR, CEILING = 'h', 2_000, 30_000
        else:
            fmt_char, FLOOR, CEILING = 'i', 50_000, 500_000_000

        n_words = len(raw) // sampwidth
        if n_words == 0:
            log.warning('INMP441 : aucun sample capture')
            return None

        samples = struct.unpack(f'<{n_words}{fmt_char}', raw)
        if n_channels > 1:
            samples = samples[::n_channels]   # canal gauche uniquement

        rms = math.sqrt(sum(s * s for s in samples) / len(samples))
        if rms <= FLOOR:
            return 5.0

        log_min = math.log10(FLOOR)
        log_max = math.log10(CEILING)
        log_val = math.log10(min(float(rms), CEILING))
        level = (log_val - log_min) / (log_max - log_min) * 100.0
        return round(min(100.0, max(0.0, level)), 1)

    except subprocess.TimeoutExpired:
        log.warning('INMP441 : timeout arecord')
        return None
    except Exception as e:
        log.warning(f'INMP441 erreur: {e}')
        return None
    finally:
        try: os.unlink(tmp)
        except Exception: pass


def _find_inmp441_device() -> str:
    """Parcourt les cartes ALSA pour trouver la carte I2S. Retourne 'hw:N,0' ou 'hw:1,0'."""
    try:
        result = subprocess.run(['arecord', '-l'], capture_output=True, text=True, timeout=5)
        for line in result.stdout.splitlines():
            low = line.lower()
            if any(k in low for k in ('i2s', 'mems', 'inmp', 'rpi-i2s', 'adau')):
                import re
                m = re.search(r'card\s+(\d+)', line, re.IGNORECASE)
                if m:
                    dev = f"hw:{m.group(1)},0"
                    log.info(f'INMP441 auto-detecte : {dev} -- {line.strip()}')
                    return dev
    except Exception:
        pass
    log.info('INMP441 : peripherique non auto-detecte, utilisation de hw:1,0')
    return 'hw:1,0'


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
    """Initialise RPi.GPIO en mode BCM une seule fois. Doit etre appelee avant
    setup_pir() et read_analog_light_sensor() pour eviter les conflits setmode."""
    try:
        import RPi.GPIO as GPIO
        GPIO.setwarnings(False)
        GPIO.setmode(GPIO.BCM)
        log.info('GPIO initialise (BCM)')
    except Exception as e:
        log.warning(f'GPIO init erreur: {e}')


# ── PIR — Détection de mouvement (polling direct, sans callback) ──────────────
def setup_pir(pin: int):
    """Configure le GPIO PIR en entree avec resistance pull-down interne.
    Sans PUD_DOWN la broche flotte a HIGH quand le capteur est inactif -> faux positifs."""
    try:
        import RPi.GPIO as GPIO
        GPIO.setup(pin, GPIO.IN, pull_up_down=GPIO.PUD_DOWN)
        log.info(f'PIR configure -- GPIO {pin} (polling, PUD_DOWN)')
    except Exception as e:
        log.warning(f'PIR setup erreur: {e}')


def is_pir_active(pin: int) -> bool:
    """Lit directement l etat GPIO du PIR -- HIGH = mouvement detecte."""
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
    # ID base sur le timestamp (16 chiffres ms zero-padded) -- identique au format dashboard.
    # Garantit un seul document par cycle sans collision avec les ecritures du frontend.
    doc_id = str(int(time.time() * 1000)).zfill(16)
    payload = {
        'timestamp': firestore.SERVER_TIMESTAMP,
        **data,   # inclut toutes les cles, meme null -- schema constant
    }
    db.collection('rooms').document(room_id).collection('measurements').document(doc_id).set(payload)
    log.info(f'Firestore -> room {room_id} [{doc_id}] : {data}')


def update_motion(db, room_id: str):
    """Marque la salle occupee (occupancy=1) des detection de mouvement."""
    db.collection('rooms').document(room_id).update({
        'lastMotionAt': firestore.SERVER_TIMESTAMP,
        'occupancy': 1,
    })
    log.info(f'Mouvement detecte -> room {room_id} occupee')


def reset_occupancy(db, room_id: str):
    """Remet la salle a disponible (occupancy=0) apres absence de mouvement."""
    db.collection('rooms').document(room_id).update({'occupancy': 0})
    log.info(f'Aucun mouvement -> room {room_id} disponible')


# ── Dashboard : heartbeat + relance à distance ────────────────────────────────
_last_restart_check = 0.0
RESTART_CHECK_INTERVAL = 30  # secondes entre deux vérifications Firestore


def update_device_heartbeat(db, device_id: str):
    """Met à jour lastUpdate sur le document device pour confirmer que l'agent est actif."""
    if not device_id:
        return
    try:
<<<<<<< HEAD
        db.collection("devices").document(device_id).update({
            "lastUpdate": firestore.SERVER_TIMESTAMP,
        })
=======
        db.collection("rooms").document(rid).set(
            {
                "occupancy": int(new_occ),
                "lastUpdate": firestore.SERVER_TIMESTAMP,
                **({"lastMotionAt": firestore.SERVER_TIMESTAMP} if new_occ == 1 else {}),
            },
            merge=True,
        )
        _PUBLISHED_PIR_OCCUPANCY = new_occ
        if rising_motion:
            tag = " (mouvement -> occupe tout de suite)"
        elif new_occ == 1:
            tag = " (occupe vacance " + str(vac_min) + " min sans nouveau mouvement)"
        else:
            tag = " (libre: aucun mouvement depuis " + str(vac_min) + " min)"
        msg = "syncRoomOccupancyFromPir: room_id=" + rid + " occupancy -> " + str(int(new_occ)) + tag
        print(msg, flush=True)
>>>>>>> de425048a4433d79704cfc35b86f357f42007b07
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

    dht_pin = int(sensors.get('dht22_pin', 4))
    pir_pin = int(sensors.get('pir_pin', 17))
    light_sensor_type = sensors.get('light_sensor_type', 'bh1750_i2c')
    light_gpio_pin = int(sensors.get('light_gpio_pin', 27))
    bh1750_addr = int(sensors.get('bh1750_addr', 0x23))
    bh1750_bus = int(sensors.get('bh1750_i2c_bus', 1))
    inmp441_device = sensors.get('inmp441_device', None)   # None = auto, 'disabled' = desactive
    inmp441_sr = int(sensors.get('inmp441_samplerate', 16000))
    inmp441_dur = float(sensors.get('inmp441_duration', 1.0))
    sds011_port = sensors.get('sds011_port', '/dev/ttyUSB0')
    inmp441_disabled = (inmp441_device == 'disabled')

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
    # (evite que setmode soit rappele plus tard et efface les event_detect PIR)
    init_gpio()

    # Auto-detecter le peripherique ALSA INMP441 si non specifie et non desactive
    if inmp441_device is None:
        inmp441_device = _find_inmp441_device()

    log.info(f'Capteur lumiere : {light_sensor_type}'
             + (f' GPIO {light_gpio_pin}' if light_sensor_type == 'analog_gpio' else ''))
    if inmp441_disabled:
        log.info('Microphone INMP441 desactive')

    # PIR -- etat occupancy (polling)
    VACANCY_SECONDS = int(cfg.get('pir_vacancy_seconds', 120))   # 2 min par defaut
    MOTION_REFRESH_SECONDS = 30   # Rafraichit lastMotionAt toutes les 30s pendant occupation
    PIR_DEBOUNCE_COUNT = 3        # Lectures HIGH consecutives requises avant de confirmer le mouvement
    PIR_STUCK_SECONDS = 300       # Si HIGH en continu > 5 min sans jamais LOW -> capteur bloque
    was_occupied = False
    last_motion_ts = 0.0        # monotonic -- derniere fois que PIR etait HIGH confirme
    last_motion_write_ts = 0.0  # monotonic -- derniere ecriture Firestore occupation
    pir_high_count = 0          # compteur debounce -- reinitialise a 0 des que le PIR est LOW
    pir_stuck_since = 0.0       # monotonic -- debut d'un HIGH continu (0 = capteur LOW)

    setup_pir(pir_pin)

    # Diagnostic PIR au demarrage -- valeur brute de la broche avant toute detection
    try:
        import RPi.GPIO as _GPIO
        _raw = _GPIO.input(pir_pin)
        log.info(f'PIR diagnostic demarrage -- GPIO {pir_pin} = {"HIGH" if _raw else "LOW"}')
        if _raw:
            log.warning(
                f'PIR GPIO {pir_pin} lit HIGH au demarrage (aucun mouvement possible). '
                'Causes probables : VCC branche sur 3.3V au lieu de 5V, '
                'cablage incorrect, ou capteur defectueux.'
            )
    except Exception as _e:
        log.warning(f'PIR diagnostic impossible : {_e}')

    # Récupérer le nom de la salle pour les alertes
    room_name = room_id
    try:
        room_doc = db.collection("rooms").document(room_id).get()
        if room_doc.exists:
            room_name = room_doc.to_dict().get("name", room_id)
    except Exception as e:
        log.warning(f"Impossible de récupérer le nom de la salle: {e}")

    last_noise_alert_ts = 0.0
    # Dernieres valeurs valides -- evite d'ecraser un bon releve par un None transitoire
    last_valid: dict = {}
    log.info(f'Agent demarre -- room={room_id} ({room_name}), device={device_id}, intervalle={interval}s, vacance={VACANCY_SECONDS}s')

    # ── Helper PIR : polling + debounce + detection capteur bloque ──────────
    def poll_pir():
        nonlocal was_occupied, last_motion_ts, last_motion_write_ts, pir_high_count, pir_stuck_since
        now = time.monotonic()
        if is_pir_active(pir_pin):
            # Horodater le debut d'un signal HIGH continu
            if pir_stuck_since == 0.0:
                pir_stuck_since = now

            # Capteur bloque : HIGH sans interruption depuis trop longtemps
            stuck_duration = now - pir_stuck_since
            if stuck_duration >= PIR_STUCK_SECONDS:
                if int(stuck_duration) % 60 == 0:  # log toutes les minutes seulement
                    log.warning(
                        f'PIR bloque HIGH depuis {int(stuck_duration)}s -- '
                        f'Firestore non mis a jour. Verifier VCC=5V et cablage GPIO {pir_pin}.'
                    )
                return  # ignorer ce signal, ne pas marquer la salle occupee

            pir_high_count = min(pir_high_count + 1, PIR_DEBOUNCE_COUNT)
            if pir_high_count >= PIR_DEBOUNCE_COUNT:
                # Mouvement confirme : N lectures consecutives HIGH
                last_motion_ts = now
                if not was_occupied or (now - last_motion_write_ts) >= MOTION_REFRESH_SECONDS:
                    try:
                        update_motion(db, room_id)
                        last_motion_write_ts = now
                        if not was_occupied:
                            log.info(f'PIR confirme ({PIR_DEBOUNCE_COUNT} HIGH consecutifs) -> room {room_id} occupee')
                    except Exception as e:
                        log.error(f'Erreur mouvement Firestore: {e}')
                was_occupied = True
        else:
            # Signal LOW : reinitialiser debounce et horodatage stuck
            pir_high_count = 0
            pir_stuck_since = 0.0
            if was_occupied and last_motion_ts > 0 and (now - last_motion_ts) >= VACANCY_SECONDS:
                try:
                    reset_occupancy(db, room_id)
                except Exception as e:
                    log.error(f'Erreur reset occupancy: {e}')
                was_occupied = False
                last_motion_ts = 0.0
                last_motion_write_ts = 0.0

    while True:
        loop_start = time.monotonic()

        poll_pir()

        # Lecture de tous les capteurs
        temperature, humidity = read_dht22(dht_pin)

        if light_sensor_type == 'analog_gpio':
            light = read_analog_light_sensor(light_gpio_pin)
        elif light_sensor_type == 'bh1750_i2c':
            light = read_bh1750(bh1750_addr, preferred_bus=bh1750_bus)
        else:
            light = None

        noise = None if inmp441_disabled else read_inmp441_level(inmp441_device, inmp441_dur, inmp441_sr)
        pm25, pm10 = read_sds011(sds011_port)

        # Conserver les dernieres valeurs valides pour eviter d'ecraser un bon releve
        # par un None transitoire (ex. DHT22 qui rate un cycle)
        for key, val in [('temperature', temperature), ('humidity', humidity),
                         ('light', light), ('noise', noise),
                         ('pm25', pm25), ('pm10', pm10)]:
            if val is not None:
                last_valid[key] = val

        measurement = {
            'temperature': temperature if temperature is not None else last_valid.get('temperature'),
            'humidity':    humidity    if humidity    is not None else last_valid.get('humidity'),
            'light':       light       if light       is not None else last_valid.get('light'),
            'noise':       noise       if noise       is not None else last_valid.get('noise'),
            'pm25':        pm25        if pm25        is not None else last_valid.get('pm25'),
            'pm10':        pm10        if pm10        is not None else last_valid.get('pm10'),
        }

        # Ne pas ecrire si on n'a jamais eu de donnees (premier demarrage, aucun capteur branche)
        if not last_valid:
            log.warning('Aucune donnee capteur disponible -- ecriture ignoree ce cycle')
        else:
            try:
                write_measurement(db, room_id, measurement)
            except Exception as e:
                log.error(f'Erreur Firestore: {e}')

        # Alerte automatique bruit
        if noise_alerts_enabled and noise is not None and noise >= noise_medium_thr:
            now_ts = time.monotonic()
            if now_ts - last_noise_alert_ts >= noise_cooldown:
                create_noise_alert(db, room_name, noise, noise_loud_thr)
                last_noise_alert_ts = now_ts

        # Attente inter-cycle -- polling PIR chaque seconde + relance dashboard
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
`;
}

export function buildInstallSh(config?: SensorHardwareConfig): string {
  const hasMic      = config?.microphone !== 'none';
  const hasI2cLight = config?.lightSensor !== 'analog_3pin' && config?.lightSensor !== 'none';
  const hasAnalogLight = config?.lightSensor === 'analog_3pin';
  const lightGpio   = config?.analogLightGpioPin ?? 27;

  const i2sBlock = hasMic ? `echo "  -- I2S (INMP441)"
# Decommenter dtparam=i2s=on s'il est commente, sinon l'ajouter
if grep -qxF "dtparam=i2s=on" "$CONFIG_FILE" 2>/dev/null; then
  inf "Deja present : dtparam=i2s=on"
elif grep -qE "^#[[:space:]]*(dtparam=i2s=on)[[:space:]]*$" "$CONFIG_FILE" 2>/dev/null; then
  sudo sed -i 's|^#[[:space:]]*dtparam=i2s=on[[:space:]]*$|dtparam=i2s=on|' "$CONFIG_FILE"
  ok "Decommente : dtparam=i2s=on"; REBOOT_NEEDED=true
else
  echo "dtparam=i2s=on" | sudo tee -a "$CONFIG_FILE" > /dev/null
  ok "Ajoute : dtparam=i2s=on"; REBOOT_NEEDED=true
fi

if [ ! -d "$OVERLAY_DIR" ]; then
  sudo apt-get install -y -qq raspi-firmware 2>/dev/null || true
fi

CHOSEN_OVERLAY=""
if [ -d "$OVERLAY_DIR" ]; then
  for candidate in "i2s-mems" "adau7002-simple" "googlevoicehat-soundcard"; do
    if [ -f "$OVERLAY_DIR/\${candidate}.dtbo" ]; then
      CHOSEN_OVERLAY="$candidate"
      break
    fi
  done
fi

if [ -n "$CHOSEN_OVERLAY" ]; then
  add_to_config "dtoverlay=\${CHOSEN_OVERLAY}"
  ok "Overlay I2S : dtoverlay=\${CHOSEN_OVERLAY}"
else
  add_to_config "dtoverlay=i2s-mems"
  warn "Overlay i2s-mems ajoute (si arecord -l reste vide apres reboot : ls $OVERLAY_DIR | grep i2s)"
fi

if [ ! -f /etc/asound.conf ]; then
  sudo tee /etc/asound.conf > /dev/null <<'ALSA'
# INMP441 I2S -- SmartRoom
pcm.inmp441 { type hw; card 1; device 0 }
ctl.inmp441 { type hw; card 1 }
ALSA
  ok "ALSA conf creee : /etc/asound.conf"
fi`
    : `inf "Microphone desactive -- I2S non configure"`;

  const verifyI2sSection = hasMic ? `echo ""; sep; echo "--- I2S / INMP441"
if arecord -l 2>/dev/null | grep -qiE "i2s|mems|adau|inmp"; then
  CARD_NUM=$(arecord -l 2>/dev/null | grep -iE "i2s|mems|adau|inmp" | grep -oE 'card [0-9]+' | grep -oE '[0-9]+' | head -1)
  INMP441_DEV="hw:$CARD_NUM,0"; ok "INMP441 sur $INMP441_DEV"
  if arecord -D "plughw:$CARD_NUM,0" -r16000 -c2 -fS32_LE -d2 -q /tmp/smartroom_test.wav 2>/dev/null \
  || arecord -D "$INMP441_DEV" -r16000 -c2 -fS32_LE -d2 -q /tmp/smartroom_test.wav 2>/dev/null; then
    SIZE=$(wc -c < /tmp/smartroom_test.wav 2>/dev/null || echo 0)
    [ "$SIZE" -gt 1000 ] && ok "Enregistrement OK -- $SIZE octets" || warn "WAV trop petit ($SIZE o)"
    rm -f /tmp/smartroom_test.wav
  else err "Echec enregistrement depuis $INMP441_DEV"; ALL_OK=false; fi
else
  err "INMP441 non detecte (arecord -l vide) -- verifier dtparam=i2s=on et reboot"; ALL_OK=false
fi` : `echo ""; sep; echo "--- Microphone"
inf "Microphone non configure (desactive dans les parametres)"`;

  const verifyLightSection = hasI2cLight
    ? `  for BUS in $(ls /dev/i2c-* 2>/dev/null | grep -oE '[0-9]+$'); do
    if i2cdetect -y "$BUS" 2>/dev/null | grep -qE " 23 | 5c "; then
      ok "BH1750 trouve sur bus I2C $BUS"; BH1750_BUS="$BUS"; fi
  done
  [ -z "$BH1750_BUS" ] && warn "BH1750 non detecte -- verifier cablage SDA/SCL (GPIO 2/3)"`
    : hasAnalogLight
    ? `  ok "Capteur lumiere analogique 3 broches -- GPIO ${lightGpio} (OUT)" `
    : `  inf "Capteur lumiere non configure"`;

  return `#!/bin/bash
# SmartRoom Sensor Agent — Installation Debian / Raspberry Pi
#
# Configure automatiquement : I2C, SPI${hasMic ? ', I2S (INMP441)' : ''}, Python venv, systemd
#
# Codes de sortie :
#   0  → installation complète, pas de reboot nécessaire
#   2  → reboot nécessaire pour activer I2C/SPI/I2S
#   1  → erreur fatale
set -euo pipefail

AGENT_DIR="$(cd "$(dirname "$0")" && pwd)"
REBOOT_NEEDED=false

ok()   { echo "  [OK]    $*"; }
warn() { echo "  [WARN]  $*"; }
err()  { echo "  [ERR]   $*" >&2; }
inf()  { echo "  [->]    $*"; }
sep()  { echo "--------------------------------------------"; }

echo ""
echo "=== SmartRoom - Installation Debian / RPi ==="
echo ""

# ── 1. Détection matériel ─────────────────────────────────────────────────────
sep; echo "[1/6] Detection du materiel"
if [ -f /proc/device-tree/model ]; then
  MODEL=$(tr -d '\\0' < /proc/device-tree/model)
  inf "Modèle : $MODEL"
  echo "$MODEL" | grep -qi "raspberry" && ok "Raspberry Pi détecté" || warn "Modèle non-RPi"
fi
ARCH=$(uname -m); inf "Architecture : $ARCH"
OS_PRETTY=$(grep PRETTY_NAME /etc/os-release 2>/dev/null | cut -d'"' -f2 || echo "inconnue")
inf "Système : $OS_PRETTY"

# ── 2. Localiser config.txt ───────────────────────────────────────────────────
sep; echo "[2/6] Localisation firmware Raspberry Pi"

locate_firmware() {
  for c in "/boot/firmware/config.txt" "/boot/config.txt"; do
    [ -f "$c" ] && { echo "$c"; return; }
  done
  echo ""
}
CONFIG_FILE=$(locate_firmware)

if [ -z "$CONFIG_FILE" ]; then
  inf "config.txt introuvable — installation raspi-firmware..."
  sudo apt-get update -qq
  sudo apt-get install -y -qq raspi-firmware 2>/dev/null \\
    || sudo apt-get install -y -qq raspberrypi-bootloader 2>/dev/null || true
  CONFIG_FILE=$(locate_firmware)
fi

if [ -z "$CONFIG_FILE" ]; then
  err "Impossible de localiser /boot/firmware/config.txt ou /boot/config.txt"
  exit 1
fi

FIRMWARE_DIR="$(dirname "$CONFIG_FILE")"
OVERLAY_DIR="$FIRMWARE_DIR/overlays"
ok "config.txt   : $CONFIG_FILE"
ok "Overlays dir : $OVERLAY_DIR"

add_to_config() {
  local line="$1"
  if grep -qxF "$line" "$CONFIG_FILE" 2>/dev/null; then
    inf "Déjà présent  : $line"
  else
    echo "$line" | sudo tee -a "$CONFIG_FILE" > /dev/null
    ok "Ajouté        : $line"
    REBOOT_NEEDED=true
  fi
}

add_module() {
  local mod="$1"
  if ! grep -qxF "$mod" /etc/modules 2>/dev/null; then
    echo "$mod" | sudo tee -a /etc/modules > /dev/null
    ok "Module /etc/modules : $mod"
    REBOOT_NEEDED=true
  else
    inf "Module déjà dans /etc/modules : $mod"
  fi
  sudo modprobe "$mod" 2>/dev/null && inf "Module chargé : $mod" || true
}

# ── 3. Paquets système ────────────────────────────────────────────────────────
sep; echo "[3/6] Paquets systeme"
sudo apt-get update -qq
sudo apt-get install -y -qq \\
  python3 python3-pip python3-venv python3-dev \\
  libatlas-base-dev libportaudio2 portaudio19-dev libasound2-dev alsa-utils \\
  i2c-tools libgpiod2 raspi-firmware 2>/dev/null || true
ok "Paquets système installés"

# ── 4. I2C / SPI / I2S ───────────────────────────────────────────────────────
sep; echo "[4/6] Activation I2C / SPI / I2S"

echo "  -- I2C"
add_to_config "dtparam=i2c_arm=on"
add_module "i2c-dev"
grep -qF "i2c_arm_baudrate" "$CONFIG_FILE" 2>/dev/null || add_to_config "dtparam=i2c_arm_baudrate=100000"

echo "  -- SPI"
add_to_config "dtparam=spi=on"
add_module "spidev"

${i2sBlock}

inf "config.txt (dtparam/dtoverlay) :"
grep -E "dtparam|dtoverlay" "$CONFIG_FILE" | while read -r l; do echo "    $l"; done

# ── 5. Python venv + dépendances ─────────────────────────────────────────────
sep; echo "[5/6] Environnement Python"

VENV="$AGENT_DIR/.venv"
python3 -m venv "$VENV"
"$VENV/bin/pip" install --quiet --upgrade pip
"$VENV/bin/pip" install --quiet \\
  firebase-admin \\
  smbus2 \\
  pyserial \\
  RPi.GPIO \\
  adafruit-circuitpython-dht \\
  adafruit-circuitpython-ads1x15 \\
  adafruit-blinka
ok "Virtualenv : $VENV"

# ── 6. Service systemd ────────────────────────────────────────────────────────
sep; echo "[6/6] Service systemd"

ACTUAL_USER="\${SUDO_USER:-$USER}"
sudo usermod -aG audio,i2c,spi,gpio "$ACTUAL_USER" 2>/dev/null || true

sudo tee /etc/systemd/system/smartroom-agent.service > /dev/null <<EOF
[Unit]
Description=SmartRoom Sensor Agent (DHT22${hasMic ? ' + INMP441' : ''}${hasI2cLight ? ' + BH1750' : hasAnalogLight ? ' + LightSensor' : ''} + SDS011 + PIR)
After=network-online.target${hasMic ? ' sound.target' : ''}
Wants=network-online.target

[Service]
Type=simple
User=\${ACTUAL_USER}
WorkingDirectory=\${AGENT_DIR}
ExecStart=\${VENV}/bin/python3 \${AGENT_DIR}/sensor_agent.py
Restart=on-failure
RestartSec=15
StandardOutput=journal
StandardError=journal
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable smartroom-agent
ok "Service smartroom-agent activé"

# ── verify.sh (post-reboot) ───────────────────────────────────────────────────
VERIFY_SCRIPT="$AGENT_DIR/verify.sh"
cat > "$VERIFY_SCRIPT" << 'VERIFY_EOF'
#!/bin/bash
AGENT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_JSON="$AGENT_DIR/agent_config.json"
ok()   { echo "  [OK]    $*"; }
warn() { echo "  [WARN]  $*"; }
err()  { echo "  [ERR]   $*" >&2; }
inf()  { echo "  [->]    $*"; }
sep()  { echo "--------------------------------------------"; }
echo ""
echo "=== SmartRoom - Verification post-reboot ==="
echo ""
ALL_OK=true; BH1750_BUS=""; INMP441_DEV=""
sep; echo "--- I2C"
if ls /dev/i2c-* &>/dev/null 2>&1; then
  ok "Bus disponibles : $(ls /dev/i2c-* | tr '\n' ' ')"
${verifyLightSection}
else
  err "Aucun /dev/i2c-* -- dtparam=i2c_arm=on dans config.txt ?"; ALL_OK=false
fi
echo ""; sep; echo "--- SPI"
ls /dev/spidev* &>/dev/null 2>&1 \
  && ok "SPI : $(ls /dev/spidev* 2>/dev/null | tr '\n' ' ')" \
  || warn "Aucun /dev/spidev* -- dtparam=spi=on dans config.txt ?"
${verifyI2sSection}
echo ""; sep; echo "--- Mise a jour agent_config.json"
if [ -f "$CONFIG_JSON" ]; then
  [ -n "$BH1750_BUS" ] && python3 -c "
import json
with open('$CONFIG_JSON') as f: c=json.load(f)
c.setdefault('sensors',{})['bh1750_i2c_bus']=int('$BH1750_BUS')
with open('$CONFIG_JSON','w') as f: json.dump(c,f,indent=2)
" 2>/dev/null && ok "bh1750_i2c_bus mis a jour : $BH1750_BUS"
  [ -n "$INMP441_DEV" ] && python3 -c "
import json
with open('$CONFIG_JSON') as f: c=json.load(f)
c.setdefault('sensors',{})['inmp441_device']='$INMP441_DEV'
with open('$CONFIG_JSON','w') as f: json.dump(c,f,indent=2)
" 2>/dev/null && ok "inmp441_device mis a jour : $INMP441_DEV"
fi
echo ""; sep
if $ALL_OK; then
  echo "  [OK]   Tout est operationnel !"
else
  echo "  [FAIL] Des problemes ont ete detectes (voir ci-dessus)"
fi
echo ""
VERIFY_EOF
chmod +x "$VERIFY_SCRIPT"
ok "verify.sh créé : $VERIFY_SCRIPT"

# ── Résumé ─────────────────────────────────────────────────────────────────
sep
grep -E "dtparam|dtoverlay" "$CONFIG_FILE" | while read -r l; do echo "    $l"; done
echo ""
if [ "$REBOOT_NEEDED" = true ]; then
  echo "=== REBOOT NECESSAIRE pour activer I2C/SPI/I2S ==="
  exit 2
else
  echo "=== Installation complete - pas de reboot requis ==="
  exit 0
fi
`;
}

function utf8ToBase64(content: string): string {
  const bytes = new TextEncoder().encode(content);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

function toBase64Wrapped(content: string, lineWidth = 76): string {
  const b = utf8ToBase64(content);
  const lines: string[] = [];
  for (let i = 0; i < b.length; i += lineWidth) {
    lines.push(b.slice(i, i + lineWidth));
  }
  return lines.join('\n');
}

function decodeBlock(varName: string, endMarker: string, b64: string): string {
  return `cat >"$TMP/${varName}.b64" <<'${endMarker}'
${b64}
${endMarker}
`;
}

/** Nom du fichier `.sh` téléchargé : basé sur l’IP (plus le nom de l’appareil). */
export function deployScriptFilenameFromIp(ip: string): string {
  const t = ip.trim();
  const safe = t
    .replace(/:/g, '-')
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\s+/g, '');
  return `deploy-room-sensor-${safe || 'unknown'}.sh`;
}

export type BuildDeployShOptions = {
  /** JSON compte de service Firebase : le script n’exige plus le fichier clé en argument. */
  embeddedServiceAccountJson?: string | null;
  /** Intervalle d’envoi périodique, en minutes (sera converti en secondes dans agent_config.json). */
  intervalMinutes?: number;
  /** Matériel physique présent — adapte install.sh et sensor_agent.py au capteur réel. */
  sensorConfig?: SensorHardwareConfig;
};

/**
 * Un seul script bash (Git Bash, WSL, macOS, Linux).
 * Sans clé embarquée : `./script.sh IP chemin/clé.json [user]`
 * Avec clé embarquée : `./script.sh IP [user]`
 */
export function buildDeploySh(params: PiAgentBundleParams, options?: BuildDeployShOptions): string {
  const embedded = options?.embeddedServiceAccountJson?.trim();
  const useEmbedded = Boolean(embedded);
  const requestedMinutes = Number(options?.intervalMinutes);
  const safeMinutes = Number.isFinite(requestedMinutes) ? Math.max(1, Math.min(1440, Math.round(requestedMinutes))) : 5;
  const intervalSeconds = safeMinutes * 60;

  const sc = options?.sensorConfig;
  const agentJson = buildAgentConfigJson(params, intervalSeconds, sc);
  const py = buildSensorAgentPy(sc);
  const inst = buildInstallSh(sc);

  const b64Agent = toBase64Wrapped(agentJson);
  const b64Py = toBase64Wrapped(py);
  const b64Inst = toBase64Wrapped(inst);

  const M_AGENT = 'ROOMSENSOR_B64_AGENT_EOF';
  const M_PY = 'ROOMSENSOR_B64_PY_EOF';
  const M_INST = 'ROOMSENSOR_B64_INST_EOF';
  const M_SA = 'ROOMSENSOR_B64_SA_EOF';

  const saBlock = useEmbedded ? decodeBlock('sa', M_SA, toBase64Wrapped(embedded!)) : '';

  const usageAndKeyPath = useEmbedded
    ? `usage() {
  echo "Usage: $0 <IP_PI> [utilisateur_ssh]" >&2
  echo "  Clé compte de service incluse — pas de fichier JSON à fournir." >&2
  echo "  Exemple: $0 VOTRE_IP" >&2
  echo "  Port SSH: export DEPLOY_SSH_PORT=2222" >&2
  exit 1
}

[[ $# -lt 1 ]] && usage

PI_IP="\${1:?}"
SSH_USER="\${2:-\${DEPLOY_USER:-pi}}"
SSH_PORT="\${DEPLOY_SSH_PORT:-22}"
REMOTE_DIR="room-sensor"

REMOTE="\${SSH_USER}@\${PI_IP}"`
    : `usage() {
  echo "Usage: $0 <IP_PI> <chemin/serviceAccountKey.json> [utilisateur_ssh]" >&2
  echo "  Exemple: $0 VOTRE_IP ~/chemin/vers/serviceAccountKey.json" >&2
  echo "  Port SSH non standard: export DEPLOY_SSH_PORT=2222" >&2
  exit 1
}

[[ $# -lt 2 ]] && usage

PI_IP="\${1:?}"
KEY_SRC="\${2:?}"
SSH_USER="\${3:-\${DEPLOY_USER:-pi}}"
SSH_PORT="\${DEPLOY_SSH_PORT:-22}"
REMOTE_DIR="room-sensor"

case "\${KEY_SRC}" in
  ~/*) KEY_SRC="\${HOME}/\${KEY_SRC#~/}" ;;
esac

if [[ ! -f "\${KEY_SRC}" ]]; then
  echo "Fichier clé introuvable: \${KEY_SRC}" >&2
  exit 1
fi

REMOTE="\${SSH_USER}@\${PI_IP}"`;

  const serviceKeyStep = useEmbedded
    ? `b64_to_file "\${TMP}/serviceAccountKey.json" "\${TMP}/sa.b64"`
    : `cp "\${KEY_SRC}" "\${TMP}/serviceAccountKey.json"`;

  return `#!/usr/bin/env bash
# Déploiement Raspberry Pi — SmartRoom (salle ${params.roomId})${useEmbedded ? ' — clé Firebase incluse' : ''}
# Étapes : transfert → install.sh → reboot si nécessaire → verify.sh → démarrage agent
set -euo pipefail

${usageAndKeyPath}
SCP=(scp)
SSH=(ssh -o StrictHostKeyChecking=accept-new -o BatchMode=no -o ConnectTimeout=10)
if [[ "\${SSH_PORT}" != "22" ]]; then
  SCP+=( -P "\${SSH_PORT}" )
  SSH+=( -p "\${SSH_PORT}" )
fi

TMP=\$(mktemp -d)
trap 'rm -rf "\${TMP}"' EXIT

_pause_before_close() {
  echo "" >&2
  read -r -p "Appuyez sur Entrée pour quitter… " _ 2>/dev/null || read -r _ || true
}

b64_to_file() {
  local out="\$1" inp="\$2"
  if base64 -d <"\${inp}" >"\${out}" 2>/dev/null; then return 0; fi
  if base64 -D <"\${inp}" >"\${out}" 2>/dev/null; then return 0; fi
  if base64 --decode <"\${inp}" >"\${out}" 2>/dev/null; then return 0; fi
  echo "Échec décodage base64. Utilisez Git Bash, WSL, macOS ou Linux." >&2
  return 1
}

# Attend que le Pi soit joignable via SSH (après reboot)
wait_for_pi() {
  local max=180 interval=5 elapsed=0
  echo ""
  printf "  ⏳ Attente redémarrage du Pi"
  while [ \$elapsed -lt \$max ]; do
    if "\${SSH[@]}" -o BatchMode=yes "\${REMOTE}" "echo ONLINE" &>/dev/null; then
      echo ""; echo "  ✓ Pi joignable — redémarrage terminé"; return 0
    fi
    printf "."; sleep \$interval; elapsed=\$(( elapsed + interval ))
  done
  echo ""
  return 1
}

${decodeBlock('agent', M_AGENT, b64Agent)}${decodeBlock('py', M_PY, b64Py)}${decodeBlock('inst', M_INST, b64Inst)}${saBlock}

b64_to_file "\${TMP}/agent_config.json" "\${TMP}/agent.b64"
b64_to_file "\${TMP}/sensor_agent.py" "\${TMP}/py.b64"
b64_to_file "\${TMP}/install.sh" "\${TMP}/inst.b64"
${serviceKeyStep}
chmod +x "\${TMP}/sensor_agent.py" "\${TMP}/install.sh"

# ── Étape 1 : Transfert ───────────────────────────────────────────────────────
echo ""; echo "──────────────────────────────────────────────"
echo "→ Étape 1/4 — Connexion \${REMOTE} et transfert des fichiers..."
"\${SSH[@]}" "\${REMOTE}" "mkdir -p ~/\${REMOTE_DIR}"
"\${SCP[@]}" -o StrictHostKeyChecking=accept-new \\
  "\${TMP}/agent_config.json" "\${TMP}/sensor_agent.py" \\
  "\${TMP}/install.sh" "\${TMP}/serviceAccountKey.json" \\
  "\${REMOTE}:~/\${REMOTE_DIR}/"
echo "  ✓ Fichiers transférés"

# ── Étape 2 : install.sh ──────────────────────────────────────────────────────
echo ""; echo "──────────────────────────────────────────────"
echo "→ Étape 2/4 — Exécution de install.sh (I2C/SPI/I2S + Python + systemd)..."
echo ""

set +e
"\${SSH[@]}" -tt "\${REMOTE}" \\
  "chmod +x ~/\${REMOTE_DIR}/install.sh ~/\${REMOTE_DIR}/sensor_agent.py && sudo bash ~/\${REMOTE_DIR}/install.sh"
INSTALL_CODE=\$?
set -e

if [ \$INSTALL_CODE -eq 1 ]; then
  echo ""; echo "❌ install.sh a échoué (code \${INSTALL_CODE})."
  echo "  Relance manuelle : ssh \${REMOTE} 'sudo bash ~/\${REMOTE_DIR}/install.sh'"
  _pause_before_close; exit 1
fi

# ── Étape 3 : Reboot si nécessaire (exit 2) ───────────────────────────────────
if [ \$INSTALL_CODE -eq 2 ]; then
  echo ""; echo "──────────────────────────────────────────────"
  echo "  ⚠ Reboot nécessaire pour activer I2C / SPI / I2S"
  echo "→ Envoi de la commande sudo reboot..."
  "\${SSH[@]}" "\${REMOTE}" "sudo reboot" 2>/dev/null || true
  echo "  → Attente 10 s avant de sonder SSH..."
  sleep 10
  if ! wait_for_pi; then
    echo "❌ Le Pi est resté inaccessible après 3 minutes."
    echo "  Rebootez manuellement puis relancez le script."
    _pause_before_close; exit 1
  fi
fi

# ── Étape 4 : verify.sh ───────────────────────────────────────────────────────
echo ""; echo "──────────────────────────────────────────────"
echo "→ Étape 3/4 — Vérification des interfaces (verify.sh)..."
echo ""
set +e
"\${SSH[@]}" -tt "\${REMOTE}" "bash ~/\${REMOTE_DIR}/verify.sh"
VERIFY_CODE=\$?
set -e
[ \$VERIFY_CODE -ne 0 ] && echo "  ⚠ verify.sh a signalé des avertissements (voir ci-dessus)"

# ── Étape 5 : Démarrage agent ─────────────────────────────────────────────────
echo ""; echo "──────────────────────────────────────────────"
echo "→ Étape 4/4 — Démarrage du service smartroom-agent..."
set +e
"\${SSH[@]}" "\${REMOTE}" \\
  "sudo systemctl start smartroom-agent && sudo systemctl status smartroom-agent --no-pager -l"
START_CODE=\$?
set -e

echo ""; echo "──────────────────────────────────────────────"
if [ \$START_CODE -eq 0 ]; then
  echo "  ✅ Déploiement terminé avec succès !"
else
  echo "  ⚠ Déploiement terminé — vérifier les logs"
fi
echo ""
echo "  Logs en temps réel : ssh \${REMOTE} 'journalctl -fu smartroom-agent'"
echo "  Relancer verify    : ssh \${REMOTE} 'bash ~/\${REMOTE_DIR}/verify.sh'"
echo ""
_pause_before_close
exit \$([ \$START_CODE -eq 0 ] && echo 0 || echo 1)
`;
}
