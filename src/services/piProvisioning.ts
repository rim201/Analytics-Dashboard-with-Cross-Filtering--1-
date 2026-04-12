import { firebaseClientConfig } from '../firebase';

export type PiAgentBundleParams = {
  deviceDocId: string;
  roomId: string;
  /** Capteurs documentés (référence pour branchement GPIO / bus). */
  sensorNotes?: string;
};

const SENSOR_DOC = `Capteurs prévus :
- SEN0159 : CO₂
- INMP441 I2S : bruit
- DHT22 : température + humidité
- Lumière via MCP3008 (SPI)
- SGP40 : qualité d’air (VOC)
- PIR HC-SR501 : mouvement (optionnel, champ motion)`;

/** JSON embarqué sur la carte : config web + cibles Firestore. */
export function buildAgentConfigJson(params: PiAgentBundleParams): string {
  return `${JSON.stringify(
    {
      firebaseClient: firebaseClientConfig,
      deviceDocId: params.deviceDocId,
      roomId: params.roomId,
      intervalSeconds: 900,
      sensors: SENSOR_DOC,
    },
    null,
    2,
  )}\n`;
}

/** Script Python : lecture périodique + réaction à sensorCaptureRequestedAt (dashboard). */
export function buildSensorAgentPy(): string {
  return `#!/usr/bin/env python3
"""
Agent salle — envoi mesures vers Firestore (firebase-admin).
À placer avec agent_config.json et serviceAccountKey.json (téléchargé depuis la console Firebase).
Capteurs : à brancher selon README ; valeurs ci-dessous sont des stubs si lecture matériel échoue.
"""
from __future__ import annotations

import json
import os
import random
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


def read_sensors_stub():
    """Remplacez par lectures réelles (DHT22, ADC MCP3008, I2S, UART SEN0159, etc.)."""
    return {
        "temperature": round(20 + random.random() * 5, 1),
        "humidity": round(40 + random.random() * 20, 1),
        "co2": round(450 + random.random() * 300, 0),
        "noise": round(35 + random.random() * 15, 1),
        "light": round(350 + random.random() * 200, 0),
        "motion": random.choice([0, 0, 0, 1]),
    }


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
    }
    if values.get("motion") is not None:
        payload["motion"] = int(values["motion"])
    mref.set(payload)


def main():
    if not SA_PATH.is_file():
        raise SystemExit(f"Manque {SA_PATH.name} — compte de service Firebase (console Projet > Comptes de service).")
    cfg = load_cfg()
    room_id = cfg["roomId"]
    device_id = cfg["deviceDocId"]
    interval = int(cfg.get("intervalSeconds", 900))

    if not firebase_admin._apps:
        firebase_admin.initialize_app(credentials.Certificate(str(SA_PATH)))
    db = firestore.client()
    dref = db.collection("devices").document(device_id)

    last_cycle = 0.0
    last_push_wall = 0.0

    while True:
        try:
            snap = dref.get()
            data = (snap.to_dict() or {}) if snap.exists else {}
            req = data.get("sensorCaptureRequestedAt")
            now = time.time()
            force = False
            if req is not None and hasattr(req, "timestamp"):
                if req.timestamp() > last_push_wall:
                    force = True
            due = (now - last_cycle) >= interval
            if due or force:
                vals = read_sensors_stub()
                push_measurement(db, room_id, vals)
                dref.update(
                    {
                        "lastSensorPushAt": firestore.SERVER_TIMESTAMP,
                        "lastUpdate": firestore.SERVER_TIMESTAMP,
                        "sensorCaptureRequestedAt": DELETE_FIELD,
                    }
                )
                last_cycle = now
                last_push_wall = time.time()
                print(datetime.now().isoformat(), "measurement pushed", flush=True)
        except Exception as e:
            print("error:", e, flush=True)
        time.sleep(30)


if __name__ == "__main__":
    main()
`;
}

export function buildInstallSh(): string {
  return `#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
echo "=== Installation agent salle (Python venv + systemd) ==="
sudo apt-get update -qq
sudo apt-get install -y python3-pip python3-venv
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install firebase-admin
# Optionnel capteurs réels :
# pip install Adafruit-DHT RPi.GPIO spidev

sudo mkdir -p /opt/room-sensor
sudo cp -a . /opt/room-sensor/
sudo chown -R "$USER:$USER" /opt/room-sensor || true

cat << 'UNIT' | sudo tee /etc/systemd/system/room-sensor-agent.service > /dev/null
[Unit]
Description=Room sensor agent -> Firestore
After=network-online.target

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

sudo systemctl daemon-reload
sudo systemctl enable room-sensor-agent
sudo systemctl restart room-sensor-agent
echo "OK — vérifiez: sudo systemctl status room-sensor-agent"
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

export type BuildDeployShOptions = {
  /** JSON compte de service Firebase : le script n’exige plus le fichier clé en argument. */
  embeddedServiceAccountJson?: string | null;
};

/**
 * Un seul script bash (Git Bash, WSL, macOS, Linux).
 * Sans clé embarquée : `./script.sh IP chemin/clé.json [user]`
 * Avec clé embarquée : `./script.sh IP [user]`
 */
export function buildDeploySh(params: PiAgentBundleParams, options?: BuildDeployShOptions): string {
  const embedded = options?.embeddedServiceAccountJson?.trim();
  const useEmbedded = Boolean(embedded);

  const agentJson = buildAgentConfigJson(params);
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
SCP=(scp -q)
SSH=(ssh -q)
if [[ "\${SSH_PORT}" != "22" ]]; then
  SCP+=( -P "\${SSH_PORT}" )
  SSH+=( -p "\${SSH_PORT}" )
fi

TMP=\$(mktemp -d)
trap 'rm -rf "\${TMP}"' EXIT

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
"\${SSH[@]}" -o BatchMode=no -o StrictHostKeyChecking=accept-new "\${REMOTE}" "chmod +x ~/\${REMOTE_DIR}/install.sh ~/\${REMOTE_DIR}/sensor_agent.py && cd ~/\${REMOTE_DIR} && ./install.sh"

echo "Terminé — agent room-sensor sur \${PI_IP}."
`;
}
