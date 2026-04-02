/**
 * Score de confort 0–100 à partir des capteurs présents (moyenne des sous-scores disponibles).
 * Retourne null si aucune valeur exploitable.
 */

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
    parts.push(clampScore(100 - Math.abs(t - 22) * 22));
  }
  if (h != null && Number.isFinite(h)) {
    parts.push(clampScore(100 - Math.abs(h - 45) * 2.5));
  }
  if (c != null && Number.isFinite(c)) {
    parts.push(clampScore(100 - Math.max(0, (c - 400) / 10)));
  }
  if (n != null && Number.isFinite(n)) {
    parts.push(clampScore(100 - Math.max(0, (n - 32) * 3.5)));
  }
  if (l != null && Number.isFinite(l)) {
    parts.push(clampScore(100 - Math.abs(l - 450) / 4));
  }

  if (parts.length === 0) return null;
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
}
