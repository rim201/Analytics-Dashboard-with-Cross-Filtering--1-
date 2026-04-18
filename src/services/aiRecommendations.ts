/** Paramètres dérivés de l’agressivité 1–10 (plus élevé = seuils plus serrés, plus de suggestions). */
export function thresholdsForAggressiveness(aggressiveness: number) {
  const a = Math.min(10, Math.max(1, Math.round(aggressiveness)));
  return {
    co2High: 620 + (10 - a) * 35,
    tempHigh: 22.8 + (10 - a) * 0.12,
    tempLow: 21.2 - (10 - a) * 0.1,
    lightHigh: 510 + (10 - a) * 18,
    lightLow: 360 - (10 - a) * 12,
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
      if (r.pm25 > 55) {
        out.push({
          roomName: r.name,
          text: `Particle levels high (PM2.5 ~${r.pm25.toFixed(1)} µg/m³). Improve filtration or ventilation (SDS011).`,
          tone: 'blue',
        });
      } else if (r.pm25 > 15) {
        out.push({
          roomName: r.name,
          text: `PM2.5 moderate (~${r.pm25.toFixed(1)} µg/m³). Acceptable for most uses; monitor sensitive spaces.`,
          tone: 'amber',
        });
      } else {
        out.push({
          roomName: r.name,
          text: `PM2.5 low (~${r.pm25.toFixed(1)} µg/m³). Particle air quality looks good.`,
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
          text: `Reduce lighting: ${Math.round(r.light)} lux is high; dim toward ~500 lx for comfort and energy.`,
          tone: 'amber',
        });
      } else if (r.light < t.lightLow) {
        out.push({
          roomName: r.name,
          text: `Boost lighting: ${Math.round(r.light)} lux is low for occupied spaces.`,
          tone: 'amber',
        });
      } else if (a >= 7) {
        out.push({
          roomName: r.name,
          text: `Lighting level balanced (${Math.round(r.light)} lux).`,
          tone: 'emerald',
        });
      }
    }
  }

  return out.slice(0, limit);
}
