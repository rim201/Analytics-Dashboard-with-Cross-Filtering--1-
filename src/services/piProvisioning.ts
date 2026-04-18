import { firebaseClientConfig } from '../firebase';

export type PiAgentBundleParams = {
  deviceDocId: string;
  roomId: string;
  /** Capteurs documentés (référence pour branchement GPIO / bus). */
  sensorNotes?: string;
};

export const DEFAULT_AGENT_INTERVAL_SECONDS = 300;

const SENSOR_DOC = `Capteurs cibles (broches / ports dans hardware) :
- DHT22 : température + humidité (GPIO)
- GY-30 / BH1750FVI : luminosité lux (I2C) — sur Pi 5 le nœud peut être /dev/i2c-13 (pas i2c-1) ; activer I2C dans raspi-config
- SDS011 : qualité de l’air particules PM2.5 + PM10 (UART, champs pm25 / pm10)
- Capteur CO₂ 0–5000 ppm : UART type MH-Z19 / compatible (champ co2)
- MAX9814 : niveau sonore via sortie analogique → MCP3008 SPI (champ noise, estimation dB)
- PIR HC-SR501 : mouvement (GPIO, champ motion). OUT → broche BCM hardware.pirGpio (souvent 17), alim module souvent 5 V mais **OUT vers GPIO 3,3 V** uniquement. hardware.pirSampleMs (50–2000, défaut 450) : fenêtre où une impulsion courte est détectée. hardware.pirActiveLow true si mouvement = niveau bas. hardware.pirPullUp true si ligne flottante. pirGpioChip / ROOM_SENSOR_PIR_GPIOCHIP si besoin (gpiodetect).
Ports série (hardware dans agent_config.json) :
- SDS011 sur adaptateur USB → en général /dev/ttyUSB0 (crw-rw---- root:dialout).
- CO₂ UART sur le port série GPIO → sur Raspberry Pi OS /dev/serial0 pointe vers ttyS0 (ex. lrwxrwxrwx … serial0 -> ttyS0) : utiliser co2SerialDevice /dev/serial0 ou /dev/ttyS0.
L’utilisateur du service (souvent « pi ») doit être dans le groupe dialout : sudo usermod -aG dialout pi puis reconnexion.`;

/** JSON embarqué sur la carte : config web + cibles Firestore. */
export function buildAgentConfigJson(
  params: PiAgentBundleParams,
  intervalSeconds: number = DEFAULT_AGENT_INTERVAL_SECONDS,
): string {
  return `${JSON.stringify(
    {
      firebaseClient: firebaseClientConfig,
      deviceDocId: params.deviceDocId,
      roomId: params.roomId,
      intervalSeconds,
      sensors: SENSOR_DOC,
      hardware: {
        dht22Gpio: 4,
        pirGpio: 17,
        pirGpioChip: null,
        pirPullUp: false,
        pirActiveLow: false,
        pirSampleMs: 450,
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
      },
    },
    null,
    2,
  )}\n`;
}

/** Script Python : lecture périodique + réaction à sensorCaptureRequestedAt / serviceRestartRequestedAt (dashboard). */
export function buildSensorAgentPy(): string {
  return `#!/usr/bin/env python3
"""
Agent salle — envoi mesures vers Firestore (firebase-admin).
Capteurs : DHT22, BH1750FVI (GY-30), SDS011, CO2 UART (0–5000 ppm), MAX9814+MCP3008, PIR HC-SR501.
Chaque grandeur : valeur réelle si lisible, sinon null (pas de valeurs simulées).
Paquets : smbus2, pyserial, spidev, rpi-lgpio (GPIO Pi 5), gpiozero (PIR secours), Blinka + adafruit-circuitpython-dht pour DHT (voir install.sh).
"""
from __future__ import annotations

import json
import math
import os
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
    from google.cloud.firestore import DELETE_FIELD
except ImportError:
    raise SystemExit("Installez: pip install firebase-admin google-cloud-firestore")

DIR = Path(__file__).resolve().parent
CFG_PATH = DIR / "agent_config.json"
SA_PATH = DIR / "serviceAccountKey.json"

MEASUREMENT_PAD = 16


def load_cfg():
    with open(CFG_PATH, encoding="utf-8") as f:
        return json.load(f)


def measurement_doc_id(ts_ms: int) -> str:
    return str(ts_ms).zfill(MEASUREMENT_PAD)


def _cfg_int(hw: dict, key: str, default: int) -> int:
    v = hw.get(key, default)
    if v is None:
        return int(default)
    if isinstance(v, bool):
        return int(default)
    if isinstance(v, int):
        return int(v)
    if isinstance(v, float):
        return int(round(v))
    if isinstance(v, str):
        s = v.strip()
        if s.startswith(("0x", "0X")):
            return int(s, 16)
        return int(s, 10)
    return int(default)


def _cfg_float(hw: dict, key: str, default: float) -> float:
    v = hw.get(key, default)
    if v is None:
        return float(default)
    try:
        return float(v)
    except (TypeError, ValueError):
        return float(default)


def _cfg_bool(hw: dict, key: str, default: bool) -> bool:
    v = hw.get(key, default)
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return bool(int(v))
    if v is None:
        return bool(default)
    s = str(v).strip().lower()
    if s in ("1", "true", "yes", "oui", "on"):
        return True
    if s in ("0", "false", "no", "non", "off", ""):
        return False
    return bool(default)


def _pir_motion_from_line_high(line_is_high: bool, active_low: bool) -> int:
    """Mouvement = 1 : ligne haute (logique positive) ou ligne basse si active_low."""
    if active_low:
        return int(not line_is_high)
    return int(line_is_high)


def _resolve_smbus_bus_number(preferred: int) -> int | None:
    """Pi 4 : souvent i2c-1 — Pi 5 : souvent i2c-13 / i2c-14 selon image."""
    seen = set()
    order = [preferred, 1, 13, 14, 22, 0, 6, 20, 21]
    for n in order:
        if n in seen or n < 0:
            continue
        seen.add(n)
        path = f"/dev/i2c-{n}"
        if os.path.exists(path):
            if n != preferred:
                print("I2C: utilisation", path, "(config bh1750I2cBus était", preferred, ")", flush=True)
            return n
    print("I2C: aucun /dev/i2c-* — sudo raspi-config → Interface Options → I2C → Yes puis reboot", flush=True)
    return None


def _dht_normalize_pair(t, h):
    if h is None or t is None:
        return None, None
    try:
        t, h = float(t), float(h)
        if h > 100 or h < 0 or t > 85 or t < -45:
            t, h = h, t
        return round(t, 1), round(h, 1)
    except (TypeError, ValueError):
        return None, None


# Une seule instance DHT22 (Blinka / libgpiod) : recréer + deinit à chaque cycle laisse souvent la ligne GPIO
# occupée (« Unable to set line N to input » au cycle suivant).
_DHT22_CP_DEV = None
_DHT22_CP_PIN = None


def _read_dht22_circuitpython(gpio_pin: int):
    """DHT22 via Blinka (Pi 5 / Bookworm) : board.D{n} (numéro BCM)."""
    global _DHT22_CP_DEV, _DHT22_CP_PIN
    try:
        import board
        import adafruit_dht
    except ImportError as e:
        print(
            "DHT22 CircuitPython: imports manquants (",
            e,
            ") — sur la Pi : /opt/room-sensor/venv/bin/pip install -U adafruit-blinka adafruit-circuitpython-dht puis redeploy/install.sh",
            flush=True,
        )
        return None, None
    pin = getattr(board, f"D{gpio_pin}", None)
    if pin is None:
        print("DHT22: board.D", gpio_pin, "inexistant — vérifier la broche BCM dans hardware.dht22Gpio", flush=True)
        return None, None
    if _DHT22_CP_PIN != gpio_pin and _DHT22_CP_DEV is not None:
        try:
            if hasattr(_DHT22_CP_DEV, "deinit"):
                _DHT22_CP_DEV.deinit()
        except Exception:
            pass
        _DHT22_CP_DEV = None
        _DHT22_CP_PIN = None
    if _DHT22_CP_DEV is None:
        try:
            _DHT22_CP_DEV = adafruit_dht.DHT22(pin)
            _DHT22_CP_PIN = gpio_pin
        except Exception as e:
            print("DHT22 CircuitPython: ouverture GPIO", gpio_pin, e, flush=True)
            _DHT22_CP_DEV = None
            _DHT22_CP_PIN = None
            return None, None
    dev = _DHT22_CP_DEV
    try:
        t, h = None, None
        for attempt in range(25):
            time.sleep(0.1 if attempt else 0.25)
            try:
                t = dev.temperature
                h = dev.humidity
            except RuntimeError:
                continue
            if t is not None and h is not None:
                break
        out = _dht_normalize_pair(t, h)
        if out[0] is None:
            print("DHT22 CircuitPython: pas de mesure stable sur GPIO", gpio_pin, flush=True)
        return out
    except Exception as e:
        print("DHT22 CircuitPython:", e, flush=True)
        try:
            if _DHT22_CP_DEV is not None and hasattr(_DHT22_CP_DEV, "deinit"):
                _DHT22_CP_DEV.deinit()
        except Exception:
            pass
        _DHT22_CP_DEV = None
        _DHT22_CP_PIN = None
        return None, None


def _read_dht22(gpio_pin: int):
    """Température (°C) et humidité (%) ou (None, None) si capteur absent / illisible."""
    try:
        import Adafruit_DHT
        try:
            try:
                h, t = Adafruit_DHT.read_retry(Adafruit_DHT.DHT22, gpio_pin, retries=20, delay_seconds=0.05)
            except TypeError:
                h, t = Adafruit_DHT.read_retry(Adafruit_DHT.DHT22, gpio_pin)
        except Exception:
            h, t = None, None
        if h is not None and t is not None:
            out = _dht_normalize_pair(t, h)
            if out[0] is not None:
                return out
    except ImportError:
        pass
    except Exception as e:
        print("DHT22 Adafruit_DHT:", e, flush=True)
    out = _read_dht22_circuitpython(gpio_pin)
    if out[0] is None:
        print(
            "DHT22: pas de mesure — venv : pip install -U adafruit-blinka adafruit-circuitpython-dht (ou install.sh sans erreur pip)",
            flush=True,
        )
    return out


def _co2_from_mhz19_bytes(high: int, low: int):
    ppm = high * 256 + low
    if 0 < ppm <= 5000:
        return float(ppm)
    ppm2 = low * 256 + high
    if 0 < ppm2 <= 5000:
        return float(ppm2)
    return None


def _read_co2_uart(serial_device: str):
    """CO₂ ppm — MH-Z19 / clones : trame 0xFF 0x86 ou réponse à la commande de lecture gaz."""
    if not serial_device:
        return None
    try:
        import serial
    except ImportError:
        print("CO2: pip install pyserial", flush=True)
        return None
    ser = None
    try:
        ser = serial.Serial(
            serial_device,
            9600,
            timeout=0.25,
            write_timeout=0.5,
            rtscts=False,
            dsrdtr=False,
            xonxoff=False,
        )
    except (OSError, ValueError, serial.SerialException) as e:
        print("CO2 serial ouverture:", serial_device, e, flush=True)
        return None
    try:
        try:
            ser.reset_input_buffer()
            ser.reset_output_buffer()
        except Exception:
            pass
        # Commande lecture concentration (MH-Z19) — certains capteurs n’envoient rien sans requête
        try:
            ser.write(bytes([0xFF, 0x01, 0x86, 0x00, 0x00, 0x00, 0x00, 0x00, 0x79]))
            time.sleep(0.15)
        except Exception:
            pass
        for _ in range(24):
            raw = ser.read(9)
            if len(raw) != 9:
                continue
            if raw[0] == 0xFF and raw[1] == 0x86:
                v = _co2_from_mhz19_bytes(raw[2], raw[3])
                if v is not None:
                    return v
        return None
    except Exception as e:
        print("CO2 lecture:", e, flush=True)
        return None
    finally:
        if ser is not None:
            try:
                ser.close()
            except Exception:
                pass


def _lux_from_hi_lo(hi: int, lo: int):
    lux = ((hi << 8) | lo) / 1.2
    if lux < 0 or lux > 130_000:
        lux = ((lo << 8) | hi) / 1.2
    if lux < 0 or lux > 130_000:
        return None
    return round(float(lux), 1)


def _read_bh1750_lux(i2c_bus_preferred: int, i2c_addr: int):
    """GY-30 / BH1750FVI : lux ou None."""
    i2c_bus = _resolve_smbus_bus_number(i2c_bus_preferred)
    if i2c_bus is None:
        return None
    try:
        import smbus2
        from smbus2 import i2c_msg
    except ImportError:
        print("BH1750: installez smbus2 (pip install smbus2)", flush=True)
        return None
    addrs = []
    for a in (i2c_addr, 0x23, 0x5C):
        if 0 <= a <= 127 and a not in addrs:
            addrs.append(a)
    for addr in addrs:
        try:
            bus = smbus2.SMBus(i2c_bus)
            bus.i2c_rdwr(i2c_msg.write(addr, [0x01]))
            time.sleep(0.02)
            bus.i2c_rdwr(i2c_msg.write(addr, [0x20]))
            time.sleep(0.18)
            rd = i2c_msg.read(addr, 2)
            bus.i2c_rdwr(rd)
            bb = bytes(rd)
            if len(bb) != 2:
                continue
            lux = _lux_from_hi_lo(bb[0], bb[1])
            if lux is not None:
                return lux
        except Exception as e:
            print("BH1750 i2c_msg", hex(addr), e, flush=True)
    try:
        bus = smbus2.SMBus(i2c_bus)
        for addr in addrs:
            try:
                bus.write_byte(addr, 0x01)
                time.sleep(0.02)
                bus.write_byte(addr, 0x10)
                time.sleep(0.2)
                hi = bus.read_byte(addr)
                lo = bus.read_byte(addr)
                lux = _lux_from_hi_lo(hi, lo)
                if lux is not None:
                    return lux
            except Exception as e:
                print("BH1750 read_byte", hex(addr), e, flush=True)
    except Exception:
        pass
    return None


def _sds011_checksum_ok(frame: bytes) -> bool:
    if len(frame) != 10:
        return False
    if sum(frame[2:8]) % 256 == frame[8]:
        return True
    if sum(frame[1:8]) % 256 == frame[8]:
        return True
    return False


def _try_parse_sds011_frame(frame: bytes):
    if len(frame) != 10 or frame[0] != 0xAA or frame[9] != 0xAB:
        return None
    if frame[1] not in (0xC0, 0xC2):
        return None
    pm25 = ((frame[3] << 8) | frame[2]) / 10.0
    pm10 = ((frame[5] << 8) | frame[4]) / 10.0
    if not _sds011_checksum_ok(frame):
        if not (0 <= pm25 <= 2000 and 0 <= pm10 <= 2000):
            return None
    if pm25 < 0 or pm25 > 2000 or pm10 < 0 or pm10 > 2000:
        return None
    return round(pm25, 1), round(pm10, 1)


def _scan_sds011_buffer(buf: bytes):
    for i in range(0, max(0, len(buf) - 9)):
        if buf[i] != 0xAA:
            continue
        chunk = buf[i : i + 10]
        if len(chunk) < 10:
            continue
        got = _try_parse_sds011_frame(chunk)
        if got is not None:
            return got
    return None


def _read_sds011_pm(serial_device: str):
    """Nova SDS011 : (pm25_µg_m3, pm10_µg_m3) ou (None, None). UART 9600."""
    if not serial_device:
        return None, None
    try:
        import serial
    except ImportError:
        print("SDS011: pip install pyserial", flush=True)
        return None, None
    ser = None
    try:
        ser = serial.Serial(
            serial_device,
            9600,
            bytesize=8,
            parity="N",
            stopbits=1,
            timeout=0.3,
            rtscts=False,
            dsrdtr=False,
            xonxoff=False,
        )
        try:
            ser.reset_input_buffer()
        except Exception:
            pass

        def read_phase(send_passive: bool):
            if send_passive:
                try:
                    q = bytes(
                        [
                            0xAA,
                            0xB4,
                            0x06,
                            0x01,
                            0x01,
                            0x00,
                            0x00,
                            0x00,
                            0x00,
                            0x00,
                            0x00,
                            0x00,
                            0x00,
                            0x00,
                            0x00,
                            0xFF,
                            0xFF,
                            0x02,
                            0xAB,
                        ]
                    )
                    ser.write(q)
                    time.sleep(0.25)
                except Exception:
                    pass
            end = time.time() + 3.5
            acc = bytearray()
            while time.time() < end:
                block = ser.read(128)
                if not block:
                    time.sleep(0.05)
                    continue
                acc.extend(block)
                if len(acc) > 2000:
                    del acc[:-500]
                got = _scan_sds011_buffer(bytes(acc))
                if got is not None:
                    return got
            return _scan_sds011_buffer(bytes(acc))

        got = read_phase(False)
        if got is not None:
            return got
        got = read_phase(True)
        if got is not None:
            return got
        print("SDS011: aucune trame valide sur", serial_device, flush=True)
        return None, None
    except Exception as e:
        print("SDS011:", serial_device, e, flush=True)
        return None, None
    finally:
        if ser is not None:
            try:
                ser.close()
            except Exception:
                pass


def _mcp3008_samples(bus: int, device: int, channel: int, count: int):
    """Liste d’échantillons ADC 0–1023 ou None."""
    if count < 8 or not (0 <= channel <= 7):
        return None
    try:
        import spidev
    except ImportError:
        print("MCP3008: pip install spidev", flush=True)
        return None
    spi = spidev.SpiDev()
    try:
        spi.open(bus, device)
        spi.max_speed_hz = 1_350_000
        cmd = 0b11000000 | ((channel & 0x04) << 4) | ((channel & 0x03) << 6)
        samples = []
        for _ in range(count):
            resp = spi.xfer2([1, cmd, 0])
            adc = ((resp[1] & 0x0F) << 8) | resp[2]
            samples.append(int(adc))
        return samples
    except Exception:
        return None
    finally:
        try:
            spi.close()
        except Exception:
            pass


def _read_max9814_noise_db(
    bus: int,
    device: int,
    channel: int,
    sample_count: int,
    gain: float,
    floor_db: float,
):
    """
    MAX9814 sur entrée analogique MCP3008 : niveau sonore approximatif (dB) à partir du signal réel.
    Étalonnez gain / floor via hardware (max9814NoiseGain, max9814NoiseFloorDb).
    """
    samples = _mcp3008_samples(bus, device, channel, sample_count)
    if not samples:
        return None
    mean = sum(samples) / len(samples)
    var = sum((s - mean) ** 2 for s in samples) / max(1, len(samples) - 1)
    rms = math.sqrt(max(0.0, var))
    if var < 1e-8:
        return None
    if rms < 0.08:
        return None
    db = floor_db + gain * rms
    db = max(30.0, min(120.0, db))
    return round(db, 1)


_PIR_GPIO_READY = False
_PIR_CONFIGURED_PINS = set()
# Broche BCM -> (pirPullUp, pirActiveLow) au moment du GPIO.setup ; si ça change, on refait cleanup.
_PIR_SETUP_OPTS = {}
_PIR_LGPIO_IMPORT_WARNED = False
# Dernier gpiochip (/dev/gpiochipN) où gpio_claim_input a réussi pour le PIR (Pi 5 : N varie selon le noyau).
_PIR_LGPIO_CHIP = None
_PIR_LGPIO_FAIL_MSG_SENT = False


def _read_pir_lgpio(gpio_pin: int, preferred_gpiochip=None):
    """PIR via lgpio — Pi 5 : le bon gpiochip n’est pas toujours 0 ; il faut réussir gpio_claim_input (BCM = offset ligne)."""
    global _PIR_LGPIO_IMPORT_WARNED, _PIR_LGPIO_CHIP, _PIR_LGPIO_FAIL_MSG_SENT
    try:
        import lgpio
    except ImportError:
        if not _PIR_LGPIO_IMPORT_WARNED:
            _PIR_LGPIO_IMPORT_WARNED = True
            print(
                "PIR: module « lgpio » introuvable — apt: sudo apt install python3-lgpio ; venv: pip install lgpio OU recréer le venv avec --system-site-packages (install.sh)",
                flush=True,
            )
        return None
    chips = []
    env_chip = os.environ.get("ROOM_SENSOR_PIR_GPIOCHIP", "").strip()
    if env_chip.isdigit():
        chips.append(int(env_chip))
    if preferred_gpiochip is not None:
        try:
            pc = int(preferred_gpiochip)
            if pc >= 0 and pc not in chips:
                chips.append(pc)
        except (TypeError, ValueError):
            pass
    if _PIR_LGPIO_CHIP is not None and _PIR_LGPIO_CHIP not in chips:
        chips.append(_PIR_LGPIO_CHIP)
    for c in (0, 4, 3, 2, 1, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15):
        if c not in chips:
            chips.append(c)
    last_err = None
    flag_opts = [0]
    for attr in ("SET_PULL_UP", "SET_PULL_DOWN"):
        fv = getattr(lgpio, attr, None)
        if fv is not None and isinstance(fv, int) and fv not in flag_opts:
            flag_opts.append(fv)
    for chip in chips:
        h = lgpio.gpiochip_open(chip)
        if h < 0:
            continue
        claimed = False
        try:
            st = -1
            for flags in flag_opts:
                st = lgpio.gpio_claim_input(h, gpio_pin, flags)
                if st >= 0:
                    claimed = True
                    break
                last_err = st
            if not claimed:
                try:
                    lgpio.gpiochip_close(h)
                except Exception:
                    pass
                continue
            time.sleep(0.03)
            v = lgpio.gpio_read(h, gpio_pin)
            try:
                lgpio.gpio_free(h, gpio_pin)
            except Exception:
                pass
            try:
                lgpio.gpiochip_close(h)
            except Exception:
                pass
            if v < 0:
                last_err = v
                continue
            _PIR_LGPIO_CHIP = chip
            _PIR_LGPIO_FAIL_MSG_SENT = False
            return int(v)
        except Exception as e:
            last_err = e
            print("PIR lgpio gpiochip", chip, ":", e, flush=True)
            if claimed:
                try:
                    lgpio.gpio_free(h, gpio_pin)
                except Exception:
                    pass
            try:
                lgpio.gpiochip_close(h)
            except Exception:
                pass
            continue
    if last_err is not None and not _PIR_LGPIO_FAIL_MSG_SENT:
        _PIR_LGPIO_FAIL_MSG_SENT = True
        print(
            "PIR lgpio: aucun gpiochip n’a accepté GPIO BCM",
            gpio_pin,
            "(dernier code/erreur:",
            last_err,
            ") — sur la Pi : gpiodetect ; puis export ROOM_SENSOR_PIR_GPIOCHIP=N dans l’unité systemd si besoin.",
            flush=True,
        )
    _PIR_LGPIO_CHIP = None
    return None


def _read_pir_gpiozero(gpio_pin: int, internal_pull_up: bool = False, active_low: bool = False):
    """PIR via gpiozero — ordre des essais pull selon hardware.pirPullUp."""
    import os

    os.environ.setdefault("GPIOZERO_PIN_FACTORY", "lgpio")
    try:
        from gpiozero import DigitalInputDevice
    except ImportError:
        print("PIR: pip install gpiozero (dans /opt/room-sensor/venv) + lgpio", flush=True)
        return None
    last_err = None
    pull_order = (True, False) if internal_pull_up else (False, True)
    for pull_up in pull_order:
        try:
            d = DigitalInputDevice(gpio_pin, pull_up=pull_up)
            time.sleep(0.05)
            raw = bool(d.value)
            d.close()
            return _pir_motion_from_line_high(raw, active_low)
        except Exception as e:
            last_err = e
            continue
    if last_err is not None:
        print("PIR gpiozero (pull bas puis haut):", last_err, flush=True)
    return None


_PIR_BACKEND_LOGGED = ""


def _read_pir_motion(
    gpio_pin: int,
    preferred_gpiochip=None,
    internal_pull_up: bool = False,
    active_low: bool = False,
    sample_ms: int = 450,
):
    """PIR HC-SR501 : 0 / 1 — RPi.GPIO (rpi-lgpio) en premier ; échantillonnage pour impulsions courtes."""
    global _PIR_GPIO_READY, _PIR_BACKEND_LOGGED, _PIR_CONFIGURED_PINS, _PIR_SETUP_OPTS
    sample_ms = max(50, min(2000, int(sample_ms)))
    window_s = sample_ms / 1000.0
    step_s = min(0.05, max(0.01, window_s / 20))
    # 1) RPi.GPIO : shim rpi-lgpio gère Pi 5 ; évite un « faux » succès lgpio sur le mauvais gpiochip (toujours 0).
    try:
        import RPi.GPIO as GPIO

        try:
            opt = (internal_pull_up, active_low)
            if gpio_pin in _PIR_CONFIGURED_PINS and _PIR_SETUP_OPTS.get(gpio_pin) != opt:
                try:
                    GPIO.cleanup()
                except Exception:
                    pass
                _PIR_GPIO_READY = False
                _PIR_CONFIGURED_PINS.clear()
                _PIR_SETUP_OPTS.clear()
            if not _PIR_GPIO_READY:
                GPIO.setmode(GPIO.BCM)
                GPIO.setwarnings(False)
                _PIR_GPIO_READY = True
            if gpio_pin not in _PIR_CONFIGURED_PINS:
                pud = GPIO.PUD_UP if internal_pull_up else GPIO.PUD_OFF
                GPIO.setup(gpio_pin, GPIO.IN, pull_up_down=pud)
                _PIR_CONFIGURED_PINS.add(gpio_pin)
                _PIR_SETUP_OPTS[gpio_pin] = opt
            deadline = time.time() + window_s
            saw = 0
            while time.time() < deadline:
                line_hi = GPIO.input(gpio_pin) == GPIO.HIGH
                if _pir_motion_from_line_high(line_hi, active_low) == 1:
                    saw = 1
                    break
                time.sleep(step_s)
            if _PIR_BACKEND_LOGGED != "RPi.GPIO":
                _PIR_BACKEND_LOGGED = "RPi.GPIO"
                print(
                    "PIR: backend RPi.GPIO (BCM "
                    + str(gpio_pin)
                    + ") fenêtre "
                    + str(sample_ms)
                    + " ms — actif bas: "
                    + str(active_low)
                    + " — pull interne: "
                    + str(internal_pull_up),
                    flush=True,
                )
            return saw
        except Exception as e:
            print("PIR RPi.GPIO:", e, flush=True)
    except ImportError:
        pass

    rv = _read_pir_lgpio(gpio_pin, preferred_gpiochip)
    if rv is not None:
        if _PIR_BACKEND_LOGGED != "lgpio":
            _PIR_BACKEND_LOGGED = "lgpio"
            print("PIR: backend lgpio (BCM", gpio_pin, ") — lecture ponctuelle ; préférer RPi.GPIO pour échantillonnage.", flush=True)
        return _pir_motion_from_line_high(bool(int(rv)), active_low)

    v = _read_pir_gpiozero(gpio_pin, internal_pull_up, active_low)
    if v is not None and _PIR_BACKEND_LOGGED != "gpiozero":
        _PIR_BACKEND_LOGGED = "gpiozero"
        print("PIR: backend gpiozero (BCM", gpio_pin, ")", flush=True)
    return v


def read_sensors(cfg: dict) -> dict:
    """
    Lit uniquement le matériel détectable. Chaque clé absente ou illisible → None (Firestore null).
    Ne lève pas d’exception : en cas d’erreur de config ou matériel, retourne des null pour ne pas bloquer l’envoi.
    """
    empty = {
        "temperature": None,
        "humidity": None,
        "co2": None,
        "noise": None,
        "light": None,
        "motion": None,
        "pm25": None,
        "pm10": None,
    }
    try:
        hw = cfg.get("hardware") or {}
        if not isinstance(hw, dict):
            hw = {}
        dht_pin = _cfg_int(hw, "dht22Gpio", 4)
        pir_pin = _cfg_int(hw, "pirGpio", 17)
        pir_gpiochip = hw.get("pirGpioChip")
        pir_chip_opt = None
        if pir_gpiochip is not None:
            try:
                pir_chip_opt = int(pir_gpiochip)
            except (TypeError, ValueError):
                pir_chip_opt = None
            if pir_chip_opt is not None and pir_chip_opt < 0:
                pir_chip_opt = None
        pir_internal_pull = _cfg_bool(hw, "pirPullUp", False)
        pir_active_low = _cfg_bool(hw, "pirActiveLow", False)
        pir_sample_ms = max(50, min(2000, _cfg_int(hw, "pirSampleMs", 450)))
        i2c_bus = _cfg_int(hw, "bh1750I2cBus", 1)
        i2c_addr = _cfg_int(hw, "bh1750I2cAddr", 0x23)
        sds_dev = str(hw.get("sds011SerialDevice") or "/dev/ttyUSB0")
        co2_dev = str(hw.get("co2SerialDevice") or "/dev/serial0")
        spi_bus = _cfg_int(hw, "mcp3008SpiBus", 0)
        spi_dev = _cfg_int(hw, "mcp3008SpiDevice", 0)
        mic_ch = _cfg_int(hw, "max9814McpChannel", 0)
        mic_n = max(8, _cfg_int(hw, "max9814SampleCount", 400))
        mic_gain = _cfg_float(hw, "max9814NoiseGain", 0.09)
        mic_floor = _cfg_float(hw, "max9814NoiseFloorDb", 34.0)

        temperature, humidity = _read_dht22(dht_pin)
        light = _read_bh1750_lux(i2c_bus, i2c_addr)
        pm25, pm10 = _read_sds011_pm(sds_dev)
        co2 = _read_co2_uart(co2_dev)
        noise = _read_max9814_noise_db(spi_bus, spi_dev, mic_ch, mic_n, mic_gain, mic_floor)
        if dht_pin == pir_pin:
            print(
                "hardware: dht22Gpio == pirGpio (",
                dht_pin,
                ") — une seule ligne ; motion ignoré (changez pirGpio dans agent_config.json).",
                flush=True,
            )
            motion = None
        else:
            motion = _read_pir_motion(pir_pin, pir_chip_opt, pir_internal_pull, pir_active_low, pir_sample_ms)

        out = {
            "temperature": temperature,
            "humidity": humidity,
            "co2": co2,
            "noise": noise,
            "light": light,
            "motion": motion,
            "pm25": pm25,
            "pm10": pm10,
        }
        non_null = {k: v for k, v in out.items() if v is not None}
        print("capteurs OK:", non_null if non_null else "(tous null)", flush=True)
        return out
    except Exception as e:
        import traceback

        print("read_sensors:", e, flush=True)
        traceback.print_exc()
        return dict(empty)


def _trigger_systemd_service_restart():
    """Relance l’unité systemd (install.sh + sudoers NOPASSWD pour pi)."""
    try:
        subprocess.Popen(
            ["/usr/bin/sudo", "-n", "/usr/bin/systemctl", "restart", "room-sensor-agent"],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
    except Exception as e:
        print("serviceRestartRequestedAt: lancement systemctl:", e, flush=True)


def push_measurement(db, room_id: str, values: dict):
    now = datetime.now(timezone.utc)
    ts_ms = int(now.timestamp() * 1000)
    doc_id = measurement_doc_id(ts_ms)
    mref = db.collection("rooms").document(room_id).collection("measurements").document(doc_id)
    payload = {
        "timestamp": now,
        "temperature": values.get("temperature"),
        "humidity": values.get("humidity"),
        "co2": values.get("co2"),
        "noise": values.get("noise"),
        "light": values.get("light"),
        "motion": values.get("motion"),
        "pm25": values.get("pm25"),
        "pm10": values.get("pm10"),
    }
    mref.set(payload)


def main():
    if not SA_PATH.is_file():
        raise SystemExit(f"Manque {SA_PATH.name} — compte de service Firebase (console Projet > Comptes de service).")
    cfg = load_cfg()
    room_id = str(cfg.get("roomId") or "").strip()
    device_id = str(cfg.get("deviceDocId") or "").strip()
    if not room_id or not device_id:
        raise SystemExit("agent_config.json : roomId et deviceDocId obligatoires (chaînes).")
    try:
        interval = int(cfg.get("intervalSeconds", 900))
    except (TypeError, ValueError):
        interval = 900
    interval = max(60, min(interval, 86400))

    if not firebase_admin._apps:
        firebase_admin.initialize_app(credentials.Certificate(str(SA_PATH)))
    db = firestore.client()
    dref = db.collection("devices").document(device_id)

    last_cycle = 0.0
    last_push_wall = 0.0
    last_restart_req_wall = 0.0

    while True:
        try:
            snap = dref.get()
            data = (snap.to_dict() or {}) if snap.exists else {}
            rr = data.get("serviceRestartRequestedAt")
            if rr is not None and hasattr(rr, "timestamp"):
                ts_rr = float(rr.timestamp())
                if ts_rr > last_restart_req_wall:
                    try:
                        dref.update(
                            {
                                "serviceRestartRequestedAt": DELETE_FIELD,
                                "lastUpdate": firestore.SERVER_TIMESTAMP,
                            }
                        )
                    except Exception as ex:
                        print("serviceRestartRequestedAt: effacement impossible:", ex, flush=True)
                    else:
                        last_restart_req_wall = ts_rr
                        print(datetime.now().isoformat(), "relance systemd (serviceRestartRequestedAt)", flush=True)
                        _trigger_systemd_service_restart()
                        time.sleep(30)
                        continue
            req = data.get("sensorCaptureRequestedAt")
            now = time.time()
            force = False
            if req is not None and hasattr(req, "timestamp"):
                if req.timestamp() > last_push_wall:
                    force = True
            due = (now - last_cycle) >= interval
            if due or force:
                vals = read_sensors(cfg)
                push_measurement(db, room_id, vals)
                # update() échoue si le document devices n’existe pas encore — set(merge) suffit pour les horodatages
                try:
                    dref.update(
                        {
                            "lastSensorPushAt": firestore.SERVER_TIMESTAMP,
                            "lastUpdate": firestore.SERVER_TIMESTAMP,
                            "sensorCaptureRequestedAt": DELETE_FIELD,
                        }
                    )
                except Exception:
                    dref.set(
                        {
                            "lastSensorPushAt": firestore.SERVER_TIMESTAMP,
                            "lastUpdate": firestore.SERVER_TIMESTAMP,
                        },
                        merge=True,
                    )
                last_cycle = now
                last_push_wall = time.time()
                print(datetime.now().isoformat(), "measurement pushed", vals, flush=True)
        except Exception as e:
            print("error:", e, flush=True)
        time.sleep(30)


if __name__ == "__main__":
    main()
`;
}

export function buildInstallSh(): string {
  return `#!/bin/bash
set -Eeuo pipefail
cd "$(dirname "$0")"
echo "=== Installation agent salle (Python venv + systemd) ==="

# Toujours arrêter l’agent avant copie / venv (évite fichiers verrouillés + garantit relecture du nouveau code au démarrage)
sudo systemctl stop room-sensor-agent 2>/dev/null || true
sudo systemctl reset-failed room-sensor-agent 2>/dev/null || true

# Même si pip / vérifications échouent (set -e → exit), relancer le service à la fin (évite laisser l’unité arrêtée).
_room_sensor_install_restart_done=0
_room_sensor_install_restart_service() {
  if [[ "\${_room_sensor_install_restart_done:-0}" -eq 1 ]]; then
    return 0
  fi
  _room_sensor_install_restart_done=1
  echo "→ room-sensor-agent : daemon-reload / enable / restart (fin install.sh ou récupération après erreur)." >&2
  sudo systemctl daemon-reload 2>/dev/null || true
  sudo systemctl enable room-sensor-agent 2>/dev/null || true
  sudo systemctl restart room-sensor-agent 2>/dev/null || sudo systemctl start room-sensor-agent 2>/dev/null || true
}
trap '_room_sensor_install_restart_service' EXIT

sudo apt-get update -qq
sudo apt-get install -y python3-pip python3-venv python3-lgpio build-essential python3-dev
# libgpiod : absent sur certaines images / dépôts — ne pas faire échouer tout l’install (Blinka/DHT fonctionnent souvent sans).
if sudo apt-get install -y libgpiod2 2>/dev/null; then
  :
elif sudo apt-get install -y libgpiod3 2>/dev/null; then
  :
else
  echo "AVERTISSEMENT: libgpiod2/3 introuvable dans apt — poursuite (sudo apt update ou image récente si besoin)." >&2
fi
sudo apt-get install -y python3-libgpiod 2>/dev/null || true
rm -rf venv
# --system-site-packages : lgpio installé par apt reste importable dans le venv (Pi 5 / PIR).
python3 -m venv --system-site-packages venv
source venv/bin/activate
pip install --upgrade pip
pip install firebase-admin smbus2 pyserial spidev rpi-lgpio gpiozero
# lgpio dans le venv (PIR / gpiozero) si le site-packages système n’est pas visible — complète python3-lgpio (apt).
pip install "lgpio>=0.2" || true
# DHT : CircuitPython — ne pas masquer les erreurs pip (sinon « No module named board » au runtime).
# Le paquet PyPI « Adafruit-DHT » échoue au build sur Pi 5 ; ne pas l’installer ici.
pip install --upgrade adafruit-blinka adafruit-circuitpython-dht
if ! venv/bin/python -c "import board" 2>/dev/null; then
  echo "ERREUR: adafruit-blinka n’expose pas « board » après pip — vérifiez la sortie pip ci-dessus." >&2
  exit 1
fi
if ! venv/bin/python -c "import adafruit_dht" 2>/dev/null; then
  echo "ERREUR: adafruit-circuitpython-dht introuvable après pip." >&2
  exit 1
fi

sudo mkdir -p /opt/room-sensor
sudo cp -a . /opt/room-sensor/
sudo chown -R "$USER:$USER" /opt/room-sensor || true

cat << 'UNIT' | sudo tee /etc/systemd/system/room-sensor-agent.service > /dev/null
[Unit]
Description=Room sensor agent -> Firestore
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=0

[Service]
Type=simple
User=pi
WorkingDirectory=/opt/room-sensor
ExecStart=/opt/room-sensor/venv/bin/python /opt/room-sensor/sensor_agent.py
Restart=always
RestartSec=20

[Install]
WantedBy=multi-user.target
UNIT

# sudo NOPASSWD : relance à distance via Firestore (serviceRestartRequestedAt) — uniquement cette unité.
_tmp_sudo="$(mktemp)"
cat << 'SUDOERS' > "$_tmp_sudo"
pi ALL=(root) NOPASSWD: /usr/bin/systemctl restart room-sensor-agent, /usr/bin/systemctl start room-sensor-agent, /usr/bin/systemctl stop room-sensor-agent
SUDOERS
if sudo visudo -cf "$_tmp_sudo" 2>/dev/null; then
  sudo cp "$_tmp_sudo" /etc/sudoers.d/room-sensor-agent
  sudo chmod 0440 /etc/sudoers.d/room-sensor-agent
else
  echo "AVERTISSEMENT: fragment sudoers refusé — relance à distance (Firestore) désactivée." >&2
  sudo rm -f /etc/sudoers.d/room-sensor-agent
fi
rm -f "$_tmp_sudo"

_room_sensor_install_restart_service

# Attendre jusqu’à ~25 s (Pi lente, imports capteurs) — sans faire échouer tout le déploiement si capteurs manquent
svc_ok=0
for _ in {1..25}; do
  if sudo systemctl is-active --quiet room-sensor-agent; then
    svc_ok=1
    break
  fi
  sleep 1
done
if [[ "$svc_ok" -eq 1 ]]; then
  echo "OK — room-sensor-agent est actif (sudo systemctl status room-sensor-agent)"
else
  echo "AVERTISSEMENT: room-sensor-agent n’est pas « active » après 25 s (vérifiez les logs sur la Pi)." >&2
  sudo systemctl status room-sensor-agent --no-pager -l || true
  echo "Logs récents : sudo journalctl -u room-sensor-agent -n 40 --no-pager" >&2
  # Les fichiers sont déjà copiés dans /opt/room-sensor ; ne pas bloquer le script de déploiement.
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

  const agentJson = buildAgentConfigJson(params, intervalSeconds);
  const py = buildSensorAgentPy();
  const inst = buildInstallSh();

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
# Déploiement Raspberry Pi — dashboard (devices/${params.deviceDocId}, salle ${params.roomId})${useEmbedded ? ' — clé Firebase incluse' : ''}
set -euo pipefail

${usageAndKeyPath}
SCP=(scp)
SSH=(ssh)
if [[ "\${SSH_PORT}" != "22" ]]; then
  SCP+=( -P "\${SSH_PORT}" )
  SSH+=( -p "\${SSH_PORT}" )
fi

TMP=\$(mktemp -d)
trap 'rm -rf "\${TMP}"' EXIT

# Fenêtre console (ex. double-clic sous Windows) : attendre Entrée avant de se fermer.
_pause_before_close() {
  echo "" >&2
  read -r -p "Appuyez sur Entrée pour quitter… " _ 2>/dev/null || read -r _ || true
}

b64_to_file() {
  local out="\$1" inp="\$2"
  if base64 -d <"\${inp}" >"\${out}" 2>/dev/null; then return 0; fi
  if base64 -D <"\${inp}" >"\${out}" 2>/dev/null; then return 0; fi
  if base64 --decode <"\${inp}" >"\${out}" 2>/dev/null; then return 0; fi
  echo "Échec décodage base64. Utilisez Git Bash, WSL, macOS ou Linux avec base64." >&2
  return 1
}

${decodeBlock('agent', M_AGENT, b64Agent)}${decodeBlock('py', M_PY, b64Py)}${decodeBlock('inst', M_INST, b64Inst)}${saBlock}

b64_to_file "\${TMP}/agent_config.json" "\${TMP}/agent.b64"
b64_to_file "\${TMP}/sensor_agent.py" "\${TMP}/py.b64"
b64_to_file "\${TMP}/install.sh" "\${TMP}/inst.b64"
${serviceKeyStep}
chmod +x "\${TMP}/sensor_agent.py" "\${TMP}/install.sh"

echo "→ Connexion \${REMOTE} (dossier ~/\${REMOTE_DIR})..."
"\${SSH[@]}" -o BatchMode=no -o StrictHostKeyChecking=accept-new "\${REMOTE}" "mkdir -p ~/\${REMOTE_DIR}"

echo "→ Transfert des fichiers..."
"\${SCP[@]}" "\${TMP}/agent_config.json" "\${TMP}/sensor_agent.py" "\${TMP}/install.sh" "\${TMP}/serviceAccountKey.json" "\${REMOTE}:~/\${REMOTE_DIR}/"

echo "→ Installation sur le Pi (venv + systemd)..."
"\${SSH[@]}" -tt -o BatchMode=no -o StrictHostKeyChecking=accept-new "\${REMOTE}" "set -Eeuo pipefail; chmod +x ~/\${REMOTE_DIR}/install.sh ~/\${REMOTE_DIR}/sensor_agent.py && cd ~/\${REMOTE_DIR} && ./install.sh" || {
  code=$?
  echo ""
  echo "❌ Échec de l'installation distante (code \${code})."
  echo "Relance manuelle sur la Pi :"
  echo "  ssh -p \${SSH_PORT} \${SSH_USER}@\${PI_IP}"
  echo "  cd ~/\${REMOTE_DIR} && chmod +x install.sh sensor_agent.py && ./install.sh"
  echo "Puis vérifiez : sudo systemctl status room-sensor-agent --no-pager -l"
  _pause_before_close
  exit "\${code}"
}

echo "Terminé — agent room-sensor sur \${PI_IP}."
_pause_before_close
`;
}
