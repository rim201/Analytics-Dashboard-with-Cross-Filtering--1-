import { LUX_IDEAL_MAX, LUX_IDEAL_MIN, PM25_POLLUTED_GT, TEMP_IDEAL_MAX, TEMP_IDEAL_MIN } from './sensorComfortRules';

/** Paramètres dérivés de l’agressivité 1–10 (plus élevé = seuils plus serrés, plus de suggestions). */
export function thresholdsForAggressiveness(aggressiveness: number) {
  const a = Math.min(10, Math.max(1, Math.round(aggressiveness)));
  return {
    co2High: 620 + (10 - a) * 35,
    tempHigh: TEMP_IDEAL_MAX + (10 - a) * 0.08,
    tempLow: TEMP_IDEAL_MIN - (10 - a) * 0.08,
    lightHigh: LUX_IDEAL_MAX + (10 - a) * 15,
    lightLow: LUX_IDEAL_MIN - (10 - a) * 12,
  };
}

export type AiDashboardRec = {
  roomName: string;
  text: string;
  tone: 'emerald' | 'blue' | 'amber';
};

type RoomSlice = {
  name: string;
  temperature: number | null;
  co2: number | null;
  light: number | null;
  /** SDS011 PM2.5 (µg/m³) — utilisé si CO₂ absent. */
  pm25: number | null;
};

/**
 * Recommandations agrégées pour le tableau de bord à partir des dernières mesures par salle.
 */
export function buildAiRecommendationsFromRooms(
  rooms: RoomSlice[],
  aggressiveness: number,
  limit = 6,
): AiDashboardRec[] {
  const t = thresholdsForAggressiveness(aggressiveness);
  const a = Math.min(10, Math.max(1, Math.round(aggressiveness)));
  const out: AiDashboardRec[] = [];

  for (const r of rooms) {
    const has =
      r.co2 != null || r.pm25 != null || r.temperature != null || r.light != null;
    if (!has) continue;

    if (r.co2 != null) {
      if (r.co2 > t.co2High) {
        out.push({
          roomName: r.name,
          text: `Increase ventilation: CO₂ around ${Math.round(r.co2)} ppm (target below ${Math.round(t.co2High)} ppm).`,
          tone: 'blue',
        });
      } else if (a >= 5) {
        out.push({
          roomName: r.name,
          text: `Air quality acceptable (CO₂ ${Math.round(r.co2)} ppm). Maintain current ventilation.`,
          tone: 'emerald',
        });
      }
    } else if (r.pm25 != null && a >= 4) {
      if (r.pm25 > PM25_POLLUTED_GT) {
        out.push({
          roomName: r.name,
          text: `Air pollué : PM2.5 ~${r.pm25.toFixed(1)} µg/m³ (> ${PM25_POLLUTED_GT}). Ventilation ou filtration (SDS011).`,
          tone: 'blue',
        });
      } else if (r.pm25 >= 15) {
        out.push({
          roomName: r.name,
          text: `PM2.5 modéré (~${r.pm25.toFixed(1)} µg/m³). Entre seuil « air bon » (< 15) et « pollué » (> ${PM25_POLLUTED_GT}).`,
          tone: 'amber',
        });
      } else {
        out.push({
          roomName: r.name,
          text: `Air bon : PM2.5 ~${r.pm25.toFixed(1)} µg/m³ (< 15 µg/m³).`,
          tone: 'emerald',
        });
      }
    }

    if (r.temperature != null) {
      if (r.temperature > t.tempHigh) {
        out.push({
          roomName: r.name,
          text: `Cool slightly: ${r.temperature.toFixed(1)}°C above comfort band (target ~${t.tempHigh.toFixed(1)}°C).`,
          tone: 'amber',
        });
      } else if (r.temperature < t.tempLow) {
        out.push({
          roomName: r.name,
          text: `Heat slightly: ${r.temperature.toFixed(1)}°C below comfort band.`,
          tone: 'amber',
        });
      } else if (a >= 6) {
        out.push({
          roomName: r.name,
          text: `Temperature in band (${r.temperature.toFixed(1)}°C). No HVAC change needed.`,
          tone: 'emerald',
        });
      }
    }

    if (r.light != null) {
      if (r.light > t.lightHigh) {
        out.push({
          roomName: r.name,
          text: `Luminosité élevée (${Math.round(r.light)} lux). Cible idéale ${LUX_IDEAL_MIN}–${LUX_IDEAL_MAX} lux.`,
          tone: 'amber',
        });
      } else if (r.light < t.lightLow) {
        out.push({
          roomName: r.name,
          text: `Luminosité faible (${Math.round(r.light)} lux). Cible idéale ${LUX_IDEAL_MIN}–${LUX_IDEAL_MAX} lux.`,
          tone: 'amber',
        });
      } else if (a >= 7) {
        out.push({
          roomName: r.name,
          text: `Lumière dans la zone idéale (${Math.round(r.light)} lux, ${LUX_IDEAL_MIN}–${LUX_IDEAL_MAX}).`,
          tone: 'emerald',
        });
      }
    }
  }

  return out.slice(0, limit);
}
