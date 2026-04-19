/**
 * Score de confort 0–100 à partir des capteurs présents (moyenne des sous-scores disponibles).
 * Retourne null si aucune valeur exploitable.
 */

import {
  LUX_IDEAL_MAX,
  LUX_IDEAL_MIN,
  NOISE_CALM_LT,
  NOISE_OK_LT,
  TEMP_IDEAL_MAX,
  TEMP_IDEAL_MIN,
} from './sensorComfortRules';

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function computeComfortScoreFromSensors(params: {
  temperature?: number | null;
  humidity?: number | null;
  co2?: number | null;
  noise?: number | null;
  light?: number | null;
}): number | null {
  const parts: number[] = [];

  const { temperature: t, humidity: h, co2: c, noise: n, light: l } = params;

  if (t != null && Number.isFinite(t)) {
    if (t >= TEMP_IDEAL_MIN && t <= TEMP_IDEAL_MAX) {
      parts.push(100);
    } else {
      const dist = t < TEMP_IDEAL_MIN ? TEMP_IDEAL_MIN - t : t - TEMP_IDEAL_MAX;
      parts.push(clampScore(100 - dist * 12));
    }
  }
  if (h != null && Number.isFinite(h)) {
    parts.push(clampScore(100 - Math.abs(h - 45) * 2.5));
  }
  if (c != null && Number.isFinite(c)) {
    parts.push(clampScore(100 - Math.max(0, (c - 400) / 10)));
  }
  if (n != null && Number.isFinite(n)) {
    if (n < NOISE_CALM_LT) {
      parts.push(100);
    } else if (n < NOISE_OK_LT) {
      parts.push(clampScore(100 - (n - NOISE_CALM_LT) * 3));
    } else {
      parts.push(clampScore(Math.max(0, 55 - (n - NOISE_OK_LT) * 4)));
    }
  }
  if (l != null && Number.isFinite(l)) {
    if (l >= LUX_IDEAL_MIN && l <= LUX_IDEAL_MAX) {
      parts.push(100);
    } else {
      const dist = l < LUX_IDEAL_MIN ? LUX_IDEAL_MIN - l : l - LUX_IDEAL_MAX;
      parts.push(clampScore(100 - dist / 5));
    }
  }

  if (parts.length === 0) return null;
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
}
