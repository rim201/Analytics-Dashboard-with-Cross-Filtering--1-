import { fetchAndActivate, getRemoteConfig, getValue, type RemoteConfig } from 'firebase/remote-config';
import { app } from '../firebase';

/** Nom du paramètre dans la console Firebase → Remote Config (valeur = JSON complet du compte de service). */
export const REMOTE_CONFIG_SERVICE_ACCOUNT_PARAM = 'private_key';

let remoteConfigSingleton: RemoteConfig | null = null;

function getRc(): RemoteConfig {
  if (!remoteConfigSingleton) {
    remoteConfigSingleton = getRemoteConfig(app);
    // En dev, rafraîchir souvent ; en prod Remote Config applique son intervalle minimal côté client.
    remoteConfigSingleton.settings.minimumFetchIntervalMillis = import.meta.env.DEV ? 0 : 60 * 60 * 1000;
  }
  return remoteConfigSingleton;
}

export function validateFirebaseServiceAccountJson(raw: string): string {
  const trimmed = raw.trim();
  let o: unknown;
  try {
    o = JSON.parse(trimmed);
  } catch {
    throw new Error('JSON invalide.');
  }
  if (!o || typeof o !== 'object') throw new Error('Le contenu doit être un objet JSON.');
  const x = o as Record<string, unknown>;
  if (x.type !== 'service_account') {
    throw new Error('Attendu : compte de service Google (type « service_account »).');
  }
  if (typeof x.private_key !== 'string' || !String(x.private_key).includes('BEGIN PRIVATE KEY')) {
    throw new Error('Champ private_key manquant ou invalide.');
  }
  if (typeof x.client_email !== 'string' || !x.client_email.includes('@')) {
    throw new Error('Champ client_email manquant ou invalide.');
  }
  return trimmed;
}

/**
 * Récupère le JSON compte de service depuis Remote Config (`private_key`).
 * Retourne `null` si absent, vide, ou JSON invalide (vérifier la console RC).
 */
export async function fetchServiceAccountJsonFromRemoteConfig(): Promise<string | null> {
  const rc = getRc();
  try {
    await fetchAndActivate(rc);
  } catch {
    // Throttle réseau, etc. : on lit quand même la valeur en cache / défaut publiée.
  }
  const raw = getValue(rc, REMOTE_CONFIG_SERVICE_ACCOUNT_PARAM).asString();
  if (!raw?.trim()) return null;
  try {
    return validateFirebaseServiceAccountJson(raw);
  } catch {
    return null;
  }
}
