# Déploiement Pi

**Admins (app déployée)** : Firebase Console → **Remote Config** → paramètre **`private_key`** = JSON complet du compte de service (puis Publier). Admin → IoT → **fusée** → `chmod +x …sh` puis `./…sh IP_PI` si le JSON est valide ; sinon `./…sh IP_PI chemin/clé.json`.

---

**Ce dossier `scripts/pi/`** (développeurs qui utilisent `DEPLOY-PI.bat` / `npm run deploy:pi`) : y placer `agent_config.json`, `sensor_agent.py`, `install.sh`, **`serviceAccountKey.json`**.

**Lancement** : double-clic **`DEPLOY-PI.bat`**, ou `npm run deploy:pi`, ou `node scripts/deploy-pi.cjs --ip <IP_DU_PI>`
