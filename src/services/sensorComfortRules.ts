/** Seuils d’affichage / confort (particules, température, lux, bruit). */

export const PM25_GOOD_LT = 15;
export const PM25_POLLUTED_GT = 35;
export const PM10_GOOD_LT = 45;
export const PM10_POLLUTED_GT = 100;

export const TEMP_IDEAL_MIN = 20;
export const TEMP_IDEAL_MAX = 24;

export const LUX_IDEAL_MIN = 300;
export const LUX_IDEAL_MAX = 500;

/** dB : calme < 40 ; acceptable 40 ≤ dB < 60 ; bruyant ≥ 60. */
export const NOISE_CALM_LT = 40;
export const NOISE_OK_LT = 60;

export type ComfortStatusChip = {
  color: 'emerald' | 'amber' | 'red';
  label: string;
};

export function statusPm25(v: number): ComfortStatusChip {
  if (v < PM25_GOOD_LT) return { color: 'emerald', label: 'Air bon' };
  if (v <= PM25_POLLUTED_GT) return { color: 'amber', label: 'Modéré' };
  return { color: 'red', label: 'Air pollué' };
}

export function statusPm10(v: number): ComfortStatusChip {
  if (v < PM10_GOOD_LT) return { color: 'emerald', label: 'Air bon' };
  if (v <= PM10_POLLUTED_GT) return { color: 'amber', label: 'Modéré' };
  return { color: 'red', label: 'Air pollué' };
}

/** Zone idéale 20–24 °C (inclus). */
export function statusTemperature(v: number): ComfortStatusChip {
  if (v >= TEMP_IDEAL_MIN && v <= TEMP_IDEAL_MAX) {
    return { color: 'emerald', label: 'Zone idéale' };
  }
  if ((v >= 18 && v < TEMP_IDEAL_MIN) || (v > TEMP_IDEAL_MAX && v <= 27)) {
    return { color: 'amber', label: 'Acceptable' };
  }
  return { color: 'red', label: 'Hors zone' };
}

/** Idéal 300–500 lux (inclus). */
export function statusLux(v: number): ComfortStatusChip {
  if (v >= LUX_IDEAL_MIN && v <= LUX_IDEAL_MAX) {
    return { color: 'emerald', label: 'Idéal' };
  }
  if ((v >= 200 && v < LUX_IDEAL_MIN) || (v > LUX_IDEAL_MAX && v <= 700)) {
    return { color: 'amber', label: 'À ajuster' };
  }
  return { color: 'red', label: 'Hors plage' };
}

/** < 40 calme ; 40 ≤ v < 60 acceptable ; ≥ 60 bruyant. */
export function statusNoiseDb(v: number): ComfortStatusChip {
  if (v < NOISE_CALM_LT) return { color: 'emerald', label: 'Calme \u2705' };
  if (v < NOISE_OK_LT) return { color: 'amber', label: 'Acceptable \u26A0\uFE0F' };
  return { color: 'red', label: 'Bruyant \u274C' };
}

/** CO₂, humidité, etc. : plus la valeur est haute, plus c’est mauvais. */
export function statusHigherIsWorse(value: number, good: number, warn: number): ComfortStatusChip {
  if (value <= good) return { color: 'emerald', label: 'Bon' };
  if (value <= warn) return { color: 'amber', label: 'Modéré' };
  return { color: 'red', label: 'Mauvais' };
}

export function comfortChipToneClass(s: ComfortStatusChip): string {
  if (s.color === 'emerald') return 'bg-emerald-50 text-emerald-600';
  if (s.color === 'amber') return 'bg-amber-50 text-amber-600';
  return 'bg-red-50 text-red-600';
}
