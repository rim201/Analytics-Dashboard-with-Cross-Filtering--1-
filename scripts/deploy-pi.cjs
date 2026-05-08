#!/usr/bin/env node
/**
 * deploy-pi.cjs — Déploiement SmartRoom vers Raspberry Pi (Debian)
 *
 * Étapes automatiques :
 *   1. Vérifie scripts/pi/ (fichiers requis)
 *   2. scp -r  → ~/room-sensor/ sur le Pi
 *   3. ssh     → sudo bash install.sh
 *      - exit 0 : OK, pas de reboot → lance verify.sh
 *      - exit 2 : reboot nécessaire → attend le redémarrage → lance verify.sh
 *      - exit 1 : erreur fatale
 *   4. ssh     → bash verify.sh  (vérifie I2C / SPI / I2S, met à jour agent_config.json)
 *   5. ssh     → sudo systemctl start smartroom-agent
 *
 * Usage :
 *   node scripts/deploy-pi.cjs
 *   node scripts/deploy-pi.cjs --ip <IP> [--user <user>] [--port <port>]
 *
 * Prérequis : OpenSSH (ssh, scp) disponible sur la machine locale.
 */

const { spawnSync, execSync } = require('node:child_process');
const path  = require('node:path');
const fs    = require('node:fs');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');

const piDir = path.join(__dirname, 'pi');

const REQUIRED_FILES = [
  'agent_config.json',
  'sensor_agent.py',
  'install.sh',
  'serviceAccountKey.json',
];

// ── Helpers CLI ───────────────────────────────────────────────────────────────
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m'; const YELLOW = '\x1b[33m';
const RED   = '\x1b[31m'; const BLUE   = '\x1b[34m';

const ok   = (m) => console.log(`${GREEN}  ✓${RESET}  ${m}`);
const warn = (m) => console.log(`${YELLOW}  ⚠${RESET}  ${m}`);
const inf  = (m) => console.log(`${BLUE}  →${RESET}  ${m}`);
const err  = (m) => console.error(`${RED}  ✗${RESET}  ${m}`);
const sep  = ()  => console.log(`${BLUE}──────────────────────────────────────────────${RESET}`);

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

// ── Vérification dossier scripts/pi/ ─────────────────────────────────────────
function checkPiFolder() {
  if (!fs.existsSync(piDir)) {
    err(`Dossier introuvable : ${piDir}`);
    err('→ Placez agent_config.json, sensor_agent.py, install.sh et serviceAccountKey.json dans scripts/pi/');
    process.exit(1);
  }
  const missing = REQUIRED_FILES.filter((f) => !fs.existsSync(path.join(piDir, f)));
  if (missing.length) {
    err('Fichiers manquants dans scripts/pi/ :');
    missing.forEach((f) => err(`   - ${f}`));
    err('\nAjoutez serviceAccountKey.json (Firebase Console → Comptes de service → Générer une clé).');
    process.exit(1);
  }
  ok('scripts/pi/ vérifié');
}

// ── Construire les options SSH/SCP ─────────────────────────────────────────
function sshOpts(port) {
  return port === '22'
    ? []
    : ['-p', port];
}
function scpOpts(port) {
  return port === '22'
    ? []
    : ['-P', port];
}

// ── Exécuter une commande SSH et retourner le code de sortie ─────────────────
function sshRun(user, ip, port, cmd, { inherit = true } = {}) {
  const args = [...sshOpts(port), '-o', 'StrictHostKeyChecking=no',
    `${user}@${ip}`, cmd];
  const r = spawnSync('ssh', args, { stdio: inherit ? 'inherit' : 'pipe', shell: false });
  return r.status ?? 1;
}

// ── Attendre que le Pi soit joignable (après reboot) ─────────────────────────
function waitForPi(user, ip, port, maxMs = 180_000) {
  const start = Date.now();
  const interval = 5_000;
  let dots = 0;

  console.log('');
  process.stdout.write(`${YELLOW}  ⏳  Attente redémarrage du Pi${RESET}`);

  while (Date.now() - start < maxMs) {
    const r = spawnSync('ssh', [
      ...sshOpts(port),
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'ConnectTimeout=4',
      '-o', 'BatchMode=yes',
      `${user}@${ip}`,
      'echo ONLINE',
    ], { stdio: 'pipe', shell: false });

    if (r.status === 0) {
      console.log(`\n`);
      ok('Pi joignable — redémarrage terminé');
      return true;
    }

    process.stdout.write('.');
    dots++;
    // Pause bloquante (~5s) via date
    const end = Date.now() + interval;
    while (Date.now() < end) { /* busy-wait ok ici (courte attente) */ }
  }

  console.log('');
  return false;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log(`${BLUE}╔══════════════════════════════════════════════╗${RESET}`);
  console.log(`${BLUE}║   SmartRoom — Déploiement Debian / RPi      ║${RESET}`);
  console.log(`${BLUE}╚══════════════════════════════════════════════╝${RESET}`);
  console.log('');

  checkPiFolder();

  // ── Paramètres de connexion ──────────────────────────────────────────────
  let ip   = arg('--ip',   '').trim();
  let user = arg('--user', 'pi').trim() || 'pi';
  let port = String(arg('--port', '22')).trim() || '22';

  const rl = readline.createInterface({ input: stdin, output: stdout });

  if (!ip) {
    sep();
    ip = (await rl.question('  Adresse IP du Pi              : ')).trim();
    if (!ip) { err('IP obligatoire.'); rl.close(); process.exit(1); }
    const u = (await rl.question(`  Utilisateur SSH     [${user}] : `)).trim();
    if (u) user = u;
    const p = (await rl.question(`  Port SSH            [${port}] : `)).trim();
    if (p) port = p;
  }
  rl.close();

  inf(`Connexion : ${user}@${ip}:${port}`);
  console.log('');

  // ── ÉTAPE 1 : Créer le dossier distant et copier les fichiers ──────────────
  sep(); inf('Étape 1/4 — Envoi des fichiers vers ~/room-sensor/ ...');

  // Créer le dossier distant si besoin
  sshRun(user, ip, port, 'mkdir -p ~/room-sensor', { inherit: false });

  const remote = `${user}@${ip}:~/room-sensor/`;
  const scpArgs = [
    ...scpOpts(port),
    '-o', 'StrictHostKeyChecking=no',
    '-r', `${piDir}/.`,
    remote,
  ];
  const r1 = spawnSync('scp', scpArgs, { stdio: 'inherit', shell: false });
  if (r1.status !== 0) {
    err('Échec SCP — vérifiez clé SSH, IP, et que le serveur SSH est actif.');
    process.exit(r1.status ?? 1);
  }
  ok('Fichiers copiés');

  // ── ÉTAPE 2 : install.sh ──────────────────────────────────────────────────
  sep(); inf('Étape 2/4 — Exécution de install.sh sur le Pi ...');
  console.log('');

  const installStatus = sshRun(
    user, ip, port,
    'chmod +x ~/room-sensor/install.sh ~/room-sensor/sensor_agent.py' +
    ' && sudo bash ~/room-sensor/install.sh',
  );

  // exit 0 = OK pas de reboot | exit 2 = reboot requis | exit 1 = erreur
  if (installStatus !== 0 && installStatus !== 2) {
    err(`install.sh a échoué (code ${installStatus}).`);
    process.exit(installStatus);
  }

  // ── ÉTAPE 3 : Reboot si nécessaire ────────────────────────────────────────
  if (installStatus === 2) {
    console.log('');
    sep();
    console.log(`${YELLOW}  ⚠  Reboot nécessaire pour activer I2C / SPI / I2S${RESET}`);
    inf('Envoi de la commande sudo reboot au Pi...');

    sshRun(user, ip, port, 'sudo reboot', { inherit: false });

    // Attendre ~8s que le Pi commence à redémarrer
    inf('Attente de 8 s avant la reconnexion...');
    const pause = Date.now() + 8_000;
    while (Date.now() < pause) { /* busy-wait */ }

    const back = waitForPi(user, ip, port, 180_000);
    if (!back) {
      err('Le Pi est resté inaccessible après 3 minutes.');
      err('Rebootez manuellement puis relancez :');
      err(`  ssh ${user}@${ip} "bash ~/room-sensor/verify.sh"`);
      process.exit(1);
    }
  }

  // ── ÉTAPE 4 : verify.sh ───────────────────────────────────────────────────
  sep(); inf('Étape 3/4 — Vérification des interfaces (verify.sh) ...');
  console.log('');

  const verifyStatus = sshRun(
    user, ip, port,
    'bash ~/room-sensor/verify.sh',
  );
  if (verifyStatus !== 0) {
    warn('verify.sh a signalé des avertissements (voir ci-dessus).');
  }

  // ── ÉTAPE 5 : Démarrer l'agent ────────────────────────────────────────────
  sep(); inf('Étape 4/4 — Démarrage du service smartroom-agent ...');
  console.log('');

  const startStatus = sshRun(
    user, ip, port,
    'sudo systemctl start smartroom-agent && sudo systemctl status smartroom-agent --no-pager -l',
  );

  // ── Résumé ─────────────────────────────────────────────────────────────────
  console.log('');
  sep();
  if (startStatus === 0) {
    console.log(`${GREEN}╔══════════════════════════════════════════════╗${RESET}`);
    console.log(`${GREEN}║   Déploiement terminé avec succès !         ║${RESET}`);
    console.log(`${GREEN}╚══════════════════════════════════════════════╝${RESET}`);
  } else {
    console.log(`${YELLOW}╔══════════════════════════════════════════════╗${RESET}`);
    console.log(`${YELLOW}║   Déploiement terminé — vérifier les logs   ║${RESET}`);
    console.log(`${YELLOW}╚══════════════════════════════════════════════╝${RESET}`);
  }
  console.log('');
  inf(`Logs en temps réel : ssh ${user}@${ip} "journalctl -fu smartroom-agent"`);
  inf(`Relancer la vérif  : ssh ${user}@${ip} "bash ~/room-sensor/verify.sh"`);
  console.log('');

  process.exit(startStatus === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
