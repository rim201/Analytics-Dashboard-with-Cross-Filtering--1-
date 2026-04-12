#!/usr/bin/env node
/**
 * Déploiement complet vers la Raspberry Pi (équivalent des 3 étapes README) :
 * 1. Vérifie que scripts/pi/ contient agent_config.json, sensor_agent.py, install.sh, serviceAccountKey.json
 * 2. scp -r scripts/pi/. user@ip:~/room-sensor/
 * 3. ssh : chmod +x install.sh sensor_agent.py && ./install.sh
 *
 * Usage :
 *   node scripts/deploy-pi.cjs
 *   node scripts/deploy-pi.cjs --ip ADRESSE_PI [--user pi] [--port 22]
 *
 * Prérequis : OpenSSH (scp, ssh) installé sur Windows 10/11 ou Linux/macOS.
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');

const piDir = path.join(__dirname, 'pi');

const REQUIRED_FILES = [
  'agent_config.json',
  'sensor_agent.py',
  'install.sh',
  'serviceAccountKey.json',
];

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

function checkPiFolder() {
  if (!fs.existsSync(piDir)) {
    console.error('Dossier introuvable :', piDir);
    console.error('→ Depuis l’app (Admin → IoT), téléchargez le script deploy-room-sensor-….sh (clé via Remote Config private_key) ou');
    console.error('  ou placez manuellement agent_config.json, sensor_agent.py, install.sh + serviceAccountKey.json dans scripts/pi/');
    process.exit(1);
  }
  const missing = REQUIRED_FILES.filter((f) => !fs.existsSync(path.join(piDir, f)));
  if (missing.length) {
    console.error('Fichiers manquants dans scripts/pi/ :');
    missing.forEach((f) => console.error('  -', f));
    console.error('\nObtenez les fichiers depuis le script deploy-room-sensor (extrait) ou une copie manuelle.');
    console.error('Ajoutez serviceAccountKey.json (Firebase Console → Comptes de service).');
    process.exit(1);
  }
}

async function main() {
  checkPiFolder();

  let ip = arg('--ip', '').trim();
  let user = arg('--user', 'pi').trim() || 'pi';
  let port = String(arg('--port', '22')).trim() || '22';

  const rl = readline.createInterface({ input: stdin, output: stdout });

  if (!ip) {
    console.log('\n=== Déploiement Raspberry Pi → ~/room-sensor ===\n');
    ip = (await rl.question('Adresse IP du Raspberry : ')).trim();
    if (!ip) {
      console.error('IP obligatoire.');
      rl.close();
      process.exit(1);
    }
    const u = (await rl.question(`Utilisateur SSH [${user}] : `)).trim();
    if (u) user = u;
    const p = (await rl.question(`Port SSH [${port}] : `)).trim();
    if (p) port = p;
  }

  rl.close();

  console.log('\n→ Envoi des fichiers vers', `${user}@${ip}:~/room-sensor/`);

  const remote = `${user}@${ip}:~/room-sensor/`;
  const scpArgs = port === '22' ? ['-r', `${piDir}/.`, remote] : ['-P', port, '-r', `${piDir}/.`, remote];

  const r1 = spawnSync('scp', scpArgs, { stdio: 'inherit', shell: true });
  if (r1.status !== 0) {
    console.error('\nÉchec scp. Vérifiez : clé SSH, IP, pare-feu, OpenSSH installé.');
    process.exit(r1.status ?? 1);
  }

  console.log('\n→ Exécution sur la Pi : chmod + install.sh …');

  const sshCmd =
    port === '22'
      ? `ssh ${user}@${ip} "chmod +x ~/room-sensor/install.sh ~/room-sensor/sensor_agent.py && ~/room-sensor/install.sh"`
      : `ssh -p ${port} ${user}@${ip} "chmod +x ~/room-sensor/install.sh ~/room-sensor/sensor_agent.py && ~/room-sensor/install.sh"`;

  const r2 = spawnSync(sshCmd, { stdio: 'inherit', shell: true });
  if (r2.status === 0) {
    console.log('\nTerminé. Sur la Pi : sudo systemctl status room-sensor-agent\n');
  }
  process.exit(r2.status ?? 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
