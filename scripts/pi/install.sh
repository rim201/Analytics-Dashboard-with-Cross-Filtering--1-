#!/bin/bash
# SmartRoom Sensor Agent — Installation Debian / Raspberry Pi
#
# Ce script configure automatiquement :
#   • I2C  (BH1750, ADS1115)
#   • SPI  (MCP3008 / extensions)
#   • I2S  (microphone INMP441)
#   • Python venv + dépendances
#   • Service systemd smartroom-agent
#
# Codes de sortie :
#   0  → installation complète, pas de reboot nécessaire
#   2  → reboot nécessaire pour activer I2C/SPI/I2S (hardware configuré)
#   1  → erreur fatale
#
# Usage : sudo bash install.sh  (ou via deploy-pi.cjs)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

AGENT_DIR="$(cd "$(dirname "$0")" && pwd)"
REBOOT_NEEDED=false

# ── Couleurs ──────────────────────────────────────────────────────────────────
R='\033[0;31m' G='\033[0;32m' Y='\033[1;33m' B='\033[0;34m' N='\033[0m'
ok()   { echo -e "${G}  ✓${N}  $*"; }
warn() { echo -e "${Y}  ⚠${N}  $*"; }
err()  { echo -e "${R}  ✗${N}  $*"; }
inf()  { echo -e "${B}  →${N}  $*"; }
sep()  { echo -e "${B}──────────────────────────────────────────────${N}"; }

echo ""
echo -e "${B}╔══════════════════════════════════════════════╗${N}"
echo -e "${B}║   SmartRoom — Installation Debian / RPi     ║${N}"
echo -e "${B}╚══════════════════════════════════════════════╝${N}"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# 1. DÉTECTION DU MATÉRIEL
# ─────────────────────────────────────────────────────────────────────────────
sep; echo -e "${B}[1/7] Détection du matériel${N}"

if [ -f /proc/device-tree/model ]; then
  MODEL=$(tr -d '\0' < /proc/device-tree/model)
  inf "Modèle : $MODEL"
  echo "$MODEL" | grep -qi "raspberry" && ok "Raspberry Pi détecté" \
    || warn "Pas un RPi — certaines fonctions peuvent échouer"
else
  warn "Modèle non détecté via device-tree"
fi

ARCH=$(uname -m)
inf "Architecture : $ARCH"
OS_PRETTY=$(grep PRETTY_NAME /etc/os-release 2>/dev/null | cut -d'"' -f2 || echo "inconnue")
inf "Système : $OS_PRETTY"

# ─────────────────────────────────────────────────────────────────────────────
# 2. TROUVER config.txt + dossier overlays
# ─────────────────────────────────────────────────────────────────────────────
sep; echo -e "${B}[2/7] Localisation du firmware Raspberry Pi${N}"

locate_firmware() {
  for c in "/boot/firmware/config.txt" "/boot/config.txt"; do
    [ -f "$c" ] && { echo "$c"; return; }
  done
  echo ""
}
CONFIG_FILE=$(locate_firmware)

if [ -z "$CONFIG_FILE" ]; then
  inf "Fichier config.txt introuvable — installation du paquet raspi-firmware..."
  sudo apt-get update -qq
  sudo apt-get install -y -qq raspi-firmware 2>/dev/null \
    || sudo apt-get install -y -qq raspberrypi-bootloader 2>/dev/null || true
  CONFIG_FILE=$(locate_firmware)
fi

if [ -z "$CONFIG_FILE" ]; then
  err "Impossible de localiser /boot/firmware/config.txt ou /boot/config.txt"
  err "Vérifiez que raspi-firmware (ou raspberrypi-bootloader) est installé."
  exit 1
fi

FIRMWARE_DIR="$(dirname "$CONFIG_FILE")"
OVERLAY_DIR="$FIRMWARE_DIR/overlays"
ok "config.txt   : $CONFIG_FILE"
ok "Overlays dir : $OVERLAY_DIR"

# Helper : ajouter une ligne dans config.txt si absente
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

# Helper : ajouter un module dans /etc/modules si absent
add_module() {
  local mod="$1"
  if ! grep -qxF "$mod" /etc/modules 2>/dev/null; then
    echo "$mod" | sudo tee -a /etc/modules > /dev/null
    ok "Module /etc/modules : $mod"
    REBOOT_NEEDED=true
  else
    inf "Module déjà dans /etc/modules : $mod"
  fi
  sudo modprobe "$mod" 2>/dev/null && inf "Module chargé maintenant : $mod" || true
}

# ─────────────────────────────────────────────────────────────────────────────
# 3. PAQUETS SYSTÈME
# ─────────────────────────────────────────────────────────────────────────────
sep; echo -e "${B}[3/7] Installation des paquets système${N}"

sudo apt-get update -qq
sudo apt-get install -y -qq \
  python3 python3-pip python3-venv python3-dev \
  libatlas-base-dev \
  libportaudio2 portaudio19-dev libasound2-dev alsa-utils \
  i2c-tools \
  libgpiod2 \
  raspi-firmware 2>/dev/null || true

ok "Paquets système installés"

# ─────────────────────────────────────────────────────────────────────────────
# 4. ACTIVATION I2C
# ─────────────────────────────────────────────────────────────────────────────
sep; echo -e "${B}[4/7] Activation I2C / SPI / I2S${N}"
echo ""
echo -e "  ${Y}── I2C ────────────────────────────────────────${N}"

add_to_config "dtparam=i2c_arm=on"
add_module "i2c-dev"

# Sur Debian les bus I2C nécessitent parfois ce paramètre supplémentaire
if ! grep -qF "i2c_arm_baudrate" "$CONFIG_FILE" 2>/dev/null; then
  add_to_config "dtparam=i2c_arm_baudrate=100000"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 5. ACTIVATION SPI
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "  ${Y}── SPI ────────────────────────────────────────${N}"

add_to_config "dtparam=spi=on"
add_module "spidev"

# ─────────────────────────────────────────────────────────────────────────────
# 6. ACTIVATION I2S — INMP441
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "  ${Y}── I2S (INMP441) ──────────────────────────────${N}"

add_to_config "dtparam=i2s=on"

# Si le dossier overlays n'existe pas encore (premier install)
if [ ! -d "$OVERLAY_DIR" ]; then
  warn "Dossier overlays absent ($OVERLAY_DIR) — nouvelle installation raspi-firmware..."
  sudo apt-get install -y -qq raspi-firmware 2>/dev/null || true
fi

# Chercher un overlay I2S compatible
CHOSEN_OVERLAY=""
if [ -d "$OVERLAY_DIR" ]; then
  inf "Overlays I2S disponibles :"
  ls "$OVERLAY_DIR" 2>/dev/null | grep -iE "i2s|mems|mic|adau|google" \
    | while read -r f; do echo "      $f"; done

  for candidate in "i2s-mems" "adau7002-simple" "googlevoicehat-soundcard"; do
    if [ -f "$OVERLAY_DIR/${candidate}.dtbo" ]; then
      CHOSEN_OVERLAY="$candidate"
      break
    fi
  done
fi

if [ -n "$CHOSEN_OVERLAY" ]; then
  add_to_config "dtoverlay=${CHOSEN_OVERLAY}"
  ok "Overlay I2S   : dtoverlay=${CHOSEN_OVERLAY}"
else
  warn "Aucun overlay I2S standard trouvé dans $OVERLAY_DIR"
  inf "Ajout dtoverlay=i2s-mems (peut nécessiter un noyau plus récent)"
  add_to_config "dtoverlay=i2s-mems"
  warn "Si 'arecord -l' reste vide après reboot :"
  warn "  sudo apt-get install -y linux-image-rpi-v8    # noyau avec overlays"
  warn "  ou vérifier : ls $OVERLAY_DIR | grep i2s"
fi

# Configuration ALSA pour INMP441
ALSA_CONF="/etc/asound.conf"
if [ ! -f "$ALSA_CONF" ]; then
  sudo tee "$ALSA_CONF" > /dev/null <<'ALSA'
# INMP441 I2S — SmartRoom
# La carte est généralement card 1 (card 0 = bcm2835 HDMI/jack)
pcm.inmp441 {
    type hw
    card 1
    device 0
}
ctl.inmp441 {
    type hw
    card 1
}
ALSA
  ok "ALSA conf créée : $ALSA_CONF"
else
  inf "ALSA conf existante : $ALSA_CONF"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 7. AFFICHER config.txt APRÈS MODIFICATIONS
# ─────────────────────────────────────────────────────────────────────────────
echo ""
inf "Contenu final de $CONFIG_FILE (dtparam/dtoverlay) :"
grep -E "dtparam|dtoverlay" "$CONFIG_FILE" | while read -r l; do echo "      $l"; done

# ─────────────────────────────────────────────────────────────────────────────
# 8. ENVIRONNEMENT PYTHON
# ─────────────────────────────────────────────────────────────────────────────
sep; echo -e "${B}[5/7] Environnement Python${N}"

VENV="$AGENT_DIR/.venv"
python3 -m venv "$VENV"
source "$VENV/bin/activate"
pip install --quiet --upgrade pip
pip install --quiet \
  firebase-admin \
  adafruit-circuitpython-dht \
  adafruit-circuitpython-ads1x15 \
  smbus2 \
  pyserial \
  RPi.GPIO
deactivate
ok "Virtualenv Python : $VENV"

# ─────────────────────────────────────────────────────────────────────────────
# 9. PERMISSIONS + SERVICE SYSTEMD
# ─────────────────────────────────────────────────────────────────────────────
sep; echo -e "${B}[6/7] Service systemd${N}"

ACTUAL_USER="${SUDO_USER:-$USER}"
sudo usermod -aG audio,i2c,spi,gpio "$ACTUAL_USER" 2>/dev/null \
  && ok "Groupes utilisateur : audio, i2c, spi, gpio ajoutés à $ACTUAL_USER" \
  || warn "Impossible d'ajouter les groupes (non critique)"

sudo tee /etc/systemd/system/smartroom-agent.service > /dev/null <<EOF
[Unit]
Description=SmartRoom Sensor Agent (INMP441 + DHT22 + BH1750 + SDS011 + PIR)
After=network-online.target sound.target
Wants=network-online.target

[Service]
Type=simple
User=${ACTUAL_USER}
WorkingDirectory=${AGENT_DIR}
ExecStart=${VENV}/bin/python3 ${AGENT_DIR}/sensor_agent.py
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
ok "Service smartroom-agent activé (démarrage automatique)"

# ─────────────────────────────────────────────────────────────────────────────
# 10. VÉRIFICATION IMMÉDIATE (avant reboot)
# ─────────────────────────────────────────────────────────────────────────────
sep; echo -e "${B}[7/7] Vérification des interfaces (état actuel)${N}"
echo ""

I2C_OK=false SPI_OK=false I2S_OK=false

# I2C
echo -e "  ${Y}── I2C ────────────────────────────────────────${N}"
if ls /dev/i2c-* &>/dev/null 2>&1; then
  ok "Bus I2C : $(ls /dev/i2c-* | tr '\n' ' ')"
  I2C_OK=true
  for BUS in $(ls /dev/i2c-* 2>/dev/null | grep -o '[0-9]*$'); do
    DETECTED=$(i2cdetect -y "$BUS" 2>/dev/null \
      | grep -oE "([0-9a-f]{2})" \
      | grep -v "^00$" | head -3 | tr '\n' ' ')
    [ -n "$DETECTED" ] && inf "  Bus $BUS — adresses : $DETECTED"
    if i2cdetect -y "$BUS" 2>/dev/null | grep -qE " 23 | 5c "; then
      ok "  BH1750 détecté sur bus $BUS → \"bh1750_i2c_bus\": $BUS"
    fi
  done
else
  warn "Aucun /dev/i2c-* — reboot nécessaire"
fi

# SPI
echo ""
echo -e "  ${Y}── SPI ───────────────────────────────────────${N}"
if ls /dev/spidev* &>/dev/null 2>&1; then
  ok "SPI : $(ls /dev/spidev* | tr '\n' ' ')"
  SPI_OK=true
else
  warn "Aucun /dev/spidev* — reboot nécessaire"
fi

# I2S
echo ""
echo -e "  ${Y}── I2S / INMP441 ─────────────────────────────${N}"
if arecord -l 2>/dev/null | grep -qiE "i2s|mems|adau|inmp|rpi"; then
  arecord -l 2>/dev/null | grep -iE "card|i2s|mems|adau" \
    | while read -r l; do inf "  $l"; done
  CARD_NUM=$(arecord -l 2>/dev/null \
    | grep -iE "i2s|mems|adau|inmp" \
    | grep -oP 'card \K[0-9]+' | head -1)
  ok "INMP441 détecté sur hw:${CARD_NUM},0"
  I2S_OK=true
else
  warn "Aucune carte I2S dans arecord -l — reboot nécessaire"
  inf "Cartes son actuelles :"
  cat /proc/asound/cards 2>/dev/null | while read -r l; do echo "    $l"; done
fi

# ─────────────────────────────────────────────────────────────────────────────
# 11. CRÉER verify.sh (script post-reboot)
# ─────────────────────────────────────────────────────────────────────────────
VERIFY_SCRIPT="$AGENT_DIR/verify.sh"
cat > "$VERIFY_SCRIPT" << 'VERIFY_EOF'
#!/bin/bash
# SmartRoom verify.sh — Vérification post-reboot
AGENT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_JSON="$AGENT_DIR/agent_config.json"

R='\033[0;31m' G='\033[0;32m' Y='\033[1;33m' B='\033[0;34m' N='\033[0m'
ok()   { echo -e "${G}  ✓${N}  $*"; }
warn() { echo -e "${Y}  ⚠${N}  $*"; }
err()  { echo -e "${R}  ✗${N}  $*"; }
inf()  { echo -e "${B}  →${N}  $*"; }
sep()  { echo -e "${B}──────────────────────────────────────────────${N}"; }

echo ""
echo -e "${B}╔══════════════════════════════════════════════╗${N}"
echo -e "${B}║   SmartRoom — Vérification post-reboot      ║${N}"
echo -e "${B}╚══════════════════════════════════════════════╝${N}"
echo ""

ALL_OK=true
BH1750_BUS=""
INMP441_DEV=""

# ── I2C ────────────────────────────────────────────────────────────────────
sep; echo -e "${B}I2C${N}"
if ls /dev/i2c-* &>/dev/null 2>&1; then
  ok "Bus disponibles : $(ls /dev/i2c-* | tr '\n' ' ')"
  for BUS in $(ls /dev/i2c-* 2>/dev/null | grep -o '[0-9]*$'); do
    FOUND=$(i2cdetect -y "$BUS" 2>/dev/null | grep -oE " [0-9a-f]{2} " | tr -d ' ' | sort -u | tr '\n' ' ')
    [ -n "$FOUND" ] && inf "  Bus $BUS — adresses hex : $FOUND"
    if i2cdetect -y "$BUS" 2>/dev/null | grep -qE " 23 | 5c "; then
      ok "  BH1750 trouvé sur bus I2C $BUS"
      BH1750_BUS="$BUS"
    fi
  done
  [ -z "$BH1750_BUS" ] && warn "BH1750 non détecté — vérifier câblage SDA/SCL/3.3V"
else
  err "Aucun bus I2C (/dev/i2c-*) — dtparam=i2c_arm=on dans config.txt ?"
  ALL_OK=false
fi

# ── SPI ────────────────────────────────────────────────────────────────────
echo ""
sep; echo -e "${B}SPI${N}"
if ls /dev/spidev* &>/dev/null 2>&1; then
  ok "Périphériques SPI : $(ls /dev/spidev* | tr '\n' ' ')"
else
  warn "Aucun /dev/spidev* — dtparam=spi=on dans config.txt ?"
fi

# ── I2S / INMP441 ──────────────────────────────────────────────────────────
echo ""
sep; echo -e "${B}I2S — INMP441${N}"
if arecord -l 2>/dev/null | grep -qiE "i2s|mems|adau|inmp"; then
  echo ""
  arecord -l 2>/dev/null | grep -iE "card|i2s|mems|adau" \
    | while read -r l; do inf "  $l"; done
  echo ""
  CARD_NUM=$(arecord -l 2>/dev/null \
    | grep -iE "i2s|mems|adau|inmp" \
    | grep -oP 'card \K[0-9]+' | head -1)
  INMP441_DEV="hw:${CARD_NUM},0"
  ok "INMP441 sur $INMP441_DEV"

  echo ""
  inf "Test d'enregistrement 2 secondes sur $INMP441_DEV ..."
  if arecord -D "$INMP441_DEV" -r16000 -c1 -fS32_LE -d2 -q /tmp/smartroom_test.wav 2>/dev/null; then
    SIZE=$(wc -c < /tmp/smartroom_test.wav 2>/dev/null || echo 0)
    if [ "$SIZE" -gt 1000 ]; then
      ok "Enregistrement OK — ${SIZE} octets capturés"
    else
      warn "Fichier WAV trop petit (${SIZE} o) — vérifier câblage INMP441"
    fi
    rm -f /tmp/smartroom_test.wav
  else
    err "Échec de l'enregistrement depuis $INMP441_DEV"
    ALL_OK=false
  fi
else
  err "INMP441 non détecté (arecord -l vide)"
  inf "Cartes son actuelles :"
  cat /proc/asound/cards 2>/dev/null | while read -r l; do echo "    $l"; done
  inf "Vérifier : dtparam=i2s=on et dtoverlay=i2s-mems dans config.txt"
  ALL_OK=false
fi

# ── Mise à jour agent_config.json ──────────────────────────────────────────
echo ""
sep; echo -e "${B}Mise à jour automatique agent_config.json${N}"

if [ -f "$CONFIG_JSON" ]; then
  UPDATED=false

  if [ -n "$BH1750_BUS" ]; then
    python3 -c "
import json, sys
with open('$CONFIG_JSON') as f: c = json.load(f)
c.setdefault('sensors', {})['bh1750_i2c_bus'] = int('$BH1750_BUS')
with open('$CONFIG_JSON', 'w') as f: json.dump(c, f, indent=2)
print('BH1750 bus mis à jour : $BH1750_BUS')
" 2>/dev/null && ok "bh1750_i2c_bus = $BH1750_BUS" && UPDATED=true
  fi

  if [ -n "$INMP441_DEV" ]; then
    python3 -c "
import json
with open('$CONFIG_JSON') as f: c = json.load(f)
c.setdefault('sensors', {})['inmp441_device'] = '$INMP441_DEV'
with open('$CONFIG_JSON', 'w') as f: json.dump(c, f, indent=2)
print('INMP441 device mis à jour : $INMP441_DEV')
" 2>/dev/null && ok "inmp441_device = $INMP441_DEV" && UPDATED=true
  fi

  $UPDATED && ok "agent_config.json mis à jour automatiquement" \
    || inf "agent_config.json : aucune mise à jour nécessaire"
else
  warn "agent_config.json introuvable dans $AGENT_DIR"
fi

# ── Résumé ─────────────────────────────────────────────────────────────────
echo ""
sep
if $ALL_OK; then
  echo -e "${G}  ✓  Tout est opérationnel !${N}"
  echo ""
  echo "  Démarrer l'agent maintenant :"
  echo "    sudo systemctl start smartroom-agent"
  echo "    journalctl -fu smartroom-agent"
else
  echo -e "${R}  ✗  Des problèmes ont été détectés (voir ci-dessus)${N}"
  echo ""
  echo "  Si I2S / I2C sont encore absents après reboot :"
  echo "    grep -E 'dtparam|dtoverlay' /boot/firmware/config.txt"
  echo "    ls /boot/firmware/overlays | grep i2s"
fi
echo ""
VERIFY_EOF

chmod +x "$VERIFY_SCRIPT"
ok "Script post-reboot créé : $VERIFY_SCRIPT"

# ─────────────────────────────────────────────────────────────────────────────
# 12. RÉSUMÉ FINAL
# ─────────────────────────────────────────────────────────────────────────────
sep
echo ""
echo -e "${B}  Résumé config.txt${N}"
grep -E "dtparam|dtoverlay" "$CONFIG_FILE" | while read -r l; do
  echo "    $l"
done
echo ""

if [ "$REBOOT_NEEDED" = true ]; then
  echo -e "${Y}╔══════════════════════════════════════════════╗${N}"
  echo -e "${Y}║  REBOOT NÉCESSAIRE pour activer I2C/SPI/I2S ║${N}"
  echo -e "${Y}╚══════════════════════════════════════════════╝${N}"
  echo ""
  inf "Le script deploy va redémarrer automatiquement le Pi."
  inf "Après le redémarrage, verify.sh sera lancé pour confirmer."
  echo ""
  exit 2
else
  echo -e "${G}╔══════════════════════════════════════════════╗${N}"
  echo -e "${G}║  Installation complète — pas de reboot requis ║${N}"
  echo -e "${G}╚══════════════════════════════════════════════╝${N}"
  echo ""
  exit 0
fi
