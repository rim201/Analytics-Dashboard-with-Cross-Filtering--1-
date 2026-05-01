import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
  Thermometer,
  Wind,
  Volume2,
  Sun,
  Droplets,
  Brain,
  Factory,
  Eye,
  EyeOff,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import '../styles/custom.css';
import { thresholdsForAggressiveness } from '../services/aiRecommendations';
import { computeComfortScoreFromSensors } from '../services/comfortScore';
import {
  PM25_POLLUTED_GT,
  PM10_GOOD_LT,
  PM10_POLLUTED_GT,
  comfortChipToneClass,
  statusHigherIsWorse,
  statusHumidityPct,
  statusLux,
  statusNoiseDb,
  statusPm10,
  statusPm25,
  statusTemperature,
} from '../services/sensorComfortRules';
import {
  getAiConfig,
  subscribeMeasurements,
  subscribeRoomById,
  updateRoomLight,
  type MeasurementRow,
} from '../services/firestoreApi';
import { useLang } from '../i18n/LanguageContext';
import { translateChipLabel, translations } from '../i18n/translations';

const LUX_MIN = 150;
const LUX_MAX = 1000;
const LUX_STEP = 10;

interface RoomDetailsProps {
  roomId: string | null;
  onBack: () => void;
  isAdmin?: boolean;
}

interface RoomInfo {
  id: string;
  name: string;
  capacity: number;
  occupancy: number;
  status: 'available' | 'busy';
  lastMotionAt: string | null;
}

export default function RoomDetails({ roomId, onBack, isAdmin = false }: RoomDetailsProps) {
  const { t, lang } = useLang();

  const [measurements, setMeasurements] = useState<MeasurementRow[]>([]);
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragLightLux, setDragLightLux] = useState<number | null>(null);
  const [lightSaving, setLightSaving] = useState(false);
  const [lightError, setLightError] = useState<string | null>(null);
  const [aiAggressiveness, setAiAggressiveness] = useState(7);
  const [showLightControl, setShowLightControl] = useState(false);
  const numericRoomId = roomId?.replace(/^room-/, '') ?? '';

  useEffect(() => {
    void getAiConfig()
      .then(({ settings }) => setAiAggressiveness(settings.aggressiveness))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setDragLightLux(null);
    setLightError(null);
  }, [numericRoomId]);

  useEffect(() => {
    if (!numericRoomId) {
      setMeasurements([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const unsub = subscribeMeasurements(
      numericRoomId,
      (rows) => {
        setMeasurements(rows);
        setLoading(false);
      },
      (err) => {
        setError(err.message || 'Failed to load measurements');
        setMeasurements([]);
        setLoading(false);
      },
    );
    return unsub;
  }, [numericRoomId]);

  useEffect(() => {
    if (!numericRoomId) {
      setRoomInfo(null);
      return;
    }
    const unsub = subscribeRoomById(
      numericRoomId,
      (r) => {
        if (!r) {
          setRoomInfo(null);
          return;
        }
        setRoomInfo({
          id: r.id,
          name: r.name,
          capacity: r.capacity,
          occupancy: r.occupancy,
          status: r.status,
          lastMotionAt: r.lastMotionAt ?? null,
        });
      },
      () => setRoomInfo(null),
    );
    return unsub;
  }, [numericRoomId]);

  const latest = useMemo(() => {
    if (measurements.length === 0) return null;
    return measurements.reduce((best, m) => {
      const tb = new Date(best.timestamp).getTime();
      const tm = new Date(m.timestamp).getTime();
      return tm >= tb ? m : best;
    });
  }, [measurements]);

  const chartData = useMemo(() => {
    const chronological = [...measurements].reverse();
    return chronological.map((m) => {
      const d = new Date(m.timestamp);
      const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      return {
        time,
        temperature: m.temperature ?? undefined,
        humidity: m.humidity ?? undefined,
        co2: m.co2 ?? undefined,
        noise: m.noise ?? undefined,
        light: m.light ?? undefined,
        pm25: m.pm25 ?? undefined,
        pm10: m.pm10 ?? undefined,
      };
    });
  }, [measurements]);

  const hasChartData = chartData.length > 0;

  function formatTimeSince(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return t.motionJustNow;
    if (diffMin < 60) return t.motionMinutesAgo(diffMin);
    return t.motionHoursAgo(Math.floor(diffMin / 60));
  }

  const roomMeta = useMemo(
    () => ({
      name: roomInfo?.name || 'Room',
      status: roomInfo?.status === 'busy' ? ('occupied' as const) : ('available' as const),
      occupancy: roomInfo?.occupancy ?? 0,
      capacity: roomInfo?.capacity ?? 0,
      lastMotionAt: roomInfo?.lastMotionAt ?? null,
    }),
    [roomInfo],
  );

  const displayComfortScore = useMemo(
    () =>
      computeComfortScoreFromSensors({
        temperature: latest?.temperature,
        humidity: latest?.humidity,
        co2: latest?.co2,
        noise: latest?.noise,
        light: latest?.light,
      }),
    [latest],
  );

  const clampLux = useCallback((v: number) => Math.min(LUX_MAX, Math.max(LUX_MIN, Math.round(v))), []);

  const sliderLightLux =
    latest?.light != null && Number.isFinite(latest.light) ? clampLux(latest.light) : LUX_MIN;

  const commitLightFromSlider = useCallback(
    async (el: HTMLInputElement) => {
      if (!numericRoomId || !isAdmin) return;
      const v = Number(el.value);
      setDragLightLux(null);
      setLightError(null);
      setLightSaving(true);
      try {
        await updateRoomLight(numericRoomId, v);
      } catch {
        setLightError(translations[lang].lightSaveError);
      } finally {
        setLightSaving(false);
      }
    },
    [numericRoomId, isAdmin, lang],
  );

  const aiInsights = useMemo(() => {
    const ai = translations[lang].ai;
    const thr = thresholdsForAggressiveness(aiAggressiveness);
    const messages: { title: string; text: string; tone: 'blue' | 'purple' | 'green' }[] = [];
    const name = roomMeta.name;

    if (!latest) {
      return [
        {
          title: ai.noMeasurementsTitle,
          text: ai.noMeasurementsText(name),
          tone: 'blue' as const,
        },
      ];
    }

    if (latest.co2 != null) {
      if (latest.co2 > thr.co2High) {
        messages.push({
          title: ai.airQualityAlertTitle,
          text: ai.airQualityAlertText(name, Math.round(latest.co2), Math.round(thr.co2High)),
          tone: 'blue',
        });
      } else {
        messages.push({
          title: ai.airQualityStableTitle,
          text: ai.airQualityStableText(name, Math.round(latest.co2)),
          tone: 'blue',
        });
      }
    } else if (latest.pm25 != null) {
      const pm = latest.pm25;
      if (pm > PM25_POLLUTED_GT) {
        messages.push({
          title: ai.pm25Title,
          text: ai.pm25PollutedText(name, pm.toFixed(1), PM25_POLLUTED_GT),
          tone: 'blue',
        });
      } else if (pm >= 15) {
        messages.push({
          title: ai.pm25Title,
          text: ai.pm25ModerateText(name, pm.toFixed(1), PM25_POLLUTED_GT),
          tone: 'blue',
        });
      } else {
        messages.push({
          title: ai.pm25Title,
          text: ai.pm25GoodText(name, pm.toFixed(1)),
          tone: 'blue',
        });
      }
    } else if (latest.pm10 != null) {
      const p10 = latest.pm10;
      if (p10 > PM10_POLLUTED_GT) {
        messages.push({
          title: ai.pm10Title,
          text: ai.pm10PollutedText(name, p10.toFixed(1), PM10_POLLUTED_GT),
          tone: 'blue',
        });
      } else if (p10 >= PM10_GOOD_LT) {
        messages.push({
          title: ai.pm10Title,
          text: ai.pm10ModerateText(name, p10.toFixed(1), PM10_GOOD_LT),
          tone: 'blue',
        });
      } else {
        messages.push({
          title: ai.pm10Title,
          text: ai.pm10GoodText(name, p10.toFixed(1), PM10_GOOD_LT),
          tone: 'blue',
        });
      }
    }

    if (latest.temperature != null) {
      if (latest.temperature > thr.tempHigh) {
        messages.push({
          title: ai.coolingTitle,
          text: ai.coolingText(name, latest.temperature.toFixed(1), thr.tempHigh.toFixed(1)),
          tone: 'purple',
        });
      } else if (latest.temperature < thr.tempLow) {
        messages.push({
          title: ai.heatingTitle,
          text: ai.heatingText(name, latest.temperature.toFixed(1)),
          tone: 'purple',
        });
      } else {
        messages.push({
          title: ai.temperatureTitle,
          text: ai.temperatureIdealText(name, latest.temperature.toFixed(1)),
          tone: 'purple',
        });
      }
    }

    if (latest.light != null) {
      if (latest.light > thr.lightHigh) {
        messages.push({
          title: ai.brightnessTitle,
          text: ai.brightnessHighText(name, Math.round(latest.light)),
          tone: 'green',
        });
      } else if (latest.light < thr.lightLow) {
        messages.push({
          title: ai.brightnessTitle,
          text: ai.brightnessLowText(name, Math.round(latest.light)),
          tone: 'green',
        });
      } else {
        messages.push({
          title: ai.brightnessTitle,
          text: ai.brightnessIdealText(name, Math.round(latest.light)),
          tone: 'green',
        });
      }
    }

    if (messages.length === 0) {
      messages.push({
        title: ai.sensorDataTitle,
        text: ai.sensorDataText(name),
        tone: 'blue',
      });
    }

    return messages.slice(0, 3);
  }, [latest, roomMeta.name, aiAggressiveness, lang]);

  const statusChips = useMemo(() => {
    if (!latest) return null;
    return {
      temperature: latest.temperature != null ? statusTemperature(latest.temperature) : null,
      humidity: latest.humidity != null ? statusHumidityPct(latest.humidity) : null,
      co2: latest.co2 != null ? statusHigherIsWorse(latest.co2, 500, 800) : null,
      noise: latest.noise != null ? statusNoiseDb(latest.noise) : null,
      light: latest.light != null ? statusLux(latest.light) : null,
      pm25: latest.pm25 != null ? statusPm25(latest.pm25) : null,
      pm10: latest.pm10 != null ? statusPm10(latest.pm10) : null,
    };
  }, [latest]);

  return (
    <div className="space-y-6">
      {/* Back Button and Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-4 min-w-0">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-xl transition shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{roomMeta.name}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full shrink-0 ${roomMeta.status === 'occupied' ? 'bg-blue-500' : 'bg-emerald-500'}`}></div>
                <span className="text-sm text-gray-600 capitalize">
                  {roomMeta.status === 'occupied' ? t.occupied : t.available}
                </span>
              </div>
              <div className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-sm font-medium border border-emerald-200">
                {t.comfort} : {displayComfortScore ?? 0}%
              </div>
              {roomMeta.lastMotionAt && (
                <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 text-gray-500 rounded-full text-xs border border-gray-200">
                  <Eye className="w-3 h-3 shrink-0" />
                  <span>{t.lastMotion} : {formatTimeSince(roomMeta.lastMotionAt)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* AI Status Banner */}
      <div className="bg-gradient-to-r from-emerald-500 to-blue-500 rounded-2xl p-4 text-white shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Brain className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="font-medium">{t.aiOptimizingRoom}</p>
            <p className="text-sm text-white/80">{t.aiAdjusting}</p>
          </div>
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
        </div>
      </div>

      {/* Live Sensor Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Temperature */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-orange-200 rounded-xl flex items-center justify-center">
              <Thermometer className="w-6 h-6 text-orange-600" />
            </div>
            {statusChips?.temperature != null ? (
              <span className={`px-2 py-1 text-xs font-medium rounded-lg ${comfortChipToneClass(statusChips.temperature)}`}>
                {translateChipLabel(statusChips.temperature.label, lang)}
              </span>
            ) : (
              <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-lg">--</span>
            )}
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1 tabular-nums">
            {latest?.temperature != null ? `${latest.temperature.toFixed(1)}°C` : '--'}
          </div>
          <div className="text-sm text-gray-500">{t.temperature}</div>
        </div>

        {/* Humidity */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-100 to-cyan-200 rounded-xl flex items-center justify-center">
              <Droplets className="w-6 h-6 text-cyan-600" />
            </div>
            {statusChips?.humidity != null ? (
              <span className={`px-2 py-1 text-xs font-medium rounded-lg ${comfortChipToneClass(statusChips.humidity)}`}>
                {translateChipLabel(statusChips.humidity.label, lang)}
              </span>
            ) : (
              <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-lg">--</span>
            )}
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1 tabular-nums">
            {latest?.humidity != null ? `${Math.round(latest.humidity)}%` : '--'}
          </div>
          <div className="text-sm text-gray-500">{t.humidity}</div>
        </div>

        {/* CO2 */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center">
              <Wind className="w-6 h-6 text-blue-600" />
            </div>
            {statusChips?.co2 != null ? (
              <span className={`px-2 py-1 text-xs font-medium rounded-lg ${comfortChipToneClass(statusChips.co2)}`}>
                {translateChipLabel(statusChips.co2.label, lang)}
              </span>
            ) : (
              <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-lg">--</span>
            )}
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1 tabular-nums">
            {latest?.co2 != null ? Math.round(latest.co2) : '--'}
          </div>
          <div className="text-sm text-gray-500">{t.co2}</div>
        </div>

        {/* Noise */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl flex items-center justify-center">
              <Volume2 className="w-6 h-6 text-purple-600" />
            </div>
            {statusChips?.noise != null ? (
              <span className={`px-2 py-1 text-xs font-medium rounded-lg ${comfortChipToneClass(statusChips.noise)}`}>
                {translateChipLabel(statusChips.noise.label, lang)}
              </span>
            ) : (
              <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-lg">--</span>
            )}
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1 tabular-nums">
            {latest?.noise != null ? Math.round(latest.noise) : '--'}
          </div>
          <div className="text-sm text-gray-500">{t.noise}</div>
        </div>

        {/* Light */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-100 to-amber-200 rounded-xl flex items-center justify-center">
              <Sun className="w-6 h-6 text-amber-600" aria-hidden />
            </div>
            {statusChips?.light != null ? (
              <span className={`px-2 py-1 text-xs font-medium rounded-lg ${comfortChipToneClass(statusChips.light)}`}>
                {translateChipLabel(statusChips.light.label, lang)}
              </span>
            ) : (
              <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-lg">--</span>
            )}
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1 tabular-nums">
            {latest?.light != null ? Math.round(latest.light) : '--'}
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">{t.light}</div>
            {isAdmin && numericRoomId ? (
              <button
                onClick={() => setShowLightControl((v) => !v)}
                className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 transition"
                aria-expanded={showLightControl}
              >
                {showLightControl
                  ? <><EyeOff className="w-3 h-3" /> {t.hideLightControl}</>
                  : <><Eye className="w-3 h-3" /> {t.showLightControl}</>
                }
              </button>
            ) : null}
          </div>
          {isAdmin && numericRoomId && showLightControl ? (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <label htmlFor="room-light-lux" className="block text-xs font-medium text-gray-500 mb-2">
                {t.lightSliderLabel(LUX_MIN, LUX_MAX)}
              </label>
              <input
                id="room-light-lux"
                type="range"
                min={LUX_MIN}
                max={LUX_MAX}
                step={LUX_STEP}
                value={dragLightLux !== null ? dragLightLux : sliderLightLux}
                disabled={lightSaving}
                onChange={(e) => setDragLightLux(Number(e.target.value))}
                onPointerUp={(e) => void commitLightFromSlider(e.currentTarget)}
                onPointerCancel={() => setDragLightLux(null)}
                onBlur={(e) => void commitLightFromSlider(e.currentTarget)}
                className="mt-1 h-2 w-full cursor-pointer accent-amber-600 disabled:opacity-50"
              />
              <div className="mt-1 flex justify-between text-[10px] text-gray-400">
                <span>{LUX_MIN}</span>
                <span>{LUX_MAX}</span>
              </div>
              {lightError && (
                <p className="mt-2 text-xs text-red-600" role="alert">
                  {lightError}
                </p>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* SDS011 — particules fines */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl flex items-center justify-center">
              <Factory className="w-6 h-6 text-slate-600" aria-hidden />
            </div>
            {statusChips?.pm25 != null ? (
              <span className={`px-2 py-1 text-xs font-medium rounded-lg ${comfortChipToneClass(statusChips.pm25)}`}>
                {translateChipLabel(statusChips.pm25.label, lang)}
              </span>
            ) : (
              <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-lg">--</span>
            )}
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1 tabular-nums">
            {latest?.pm25 != null ? latest.pm25.toFixed(1) : '--'}
          </div>
          <div className="text-sm text-gray-500">PM2.5 (µg/m³) · SDS011</div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-zinc-100 to-zinc-200 rounded-xl flex items-center justify-center">
              <Factory className="w-6 h-6 text-zinc-600" aria-hidden />
            </div>
            {statusChips?.pm10 != null ? (
              <span className={`px-2 py-1 text-xs font-medium rounded-lg ${comfortChipToneClass(statusChips.pm10)}`}>
                {translateChipLabel(statusChips.pm10.label, lang)}
              </span>
            ) : (
              <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-lg">--</span>
            )}
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1 tabular-nums">
            {latest?.pm10 != null ? latest.pm10.toFixed(1) : '--'}
          </div>
          <div className="text-sm text-gray-500">PM10 (µg/m³) · SDS011</div>
        </div>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="text-center py-8 text-gray-500">{t.loadingMeasurements}</div>
      )}
      {error && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 text-sm">{error}</div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">{t.temperatureChart}</h3>
          {hasChartData ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} domain={['auto', 'auto']} />
                <Tooltip />
                <Line type="monotone" dataKey="temperature" stroke="#f97316" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-sm text-gray-400">--</div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">{t.co2Chart}</h3>
          {hasChartData ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} domain={['auto', 'auto']} />
                <Tooltip />
                <Line type="monotone" dataKey="co2" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-sm text-gray-400">--</div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">{t.noiseChart}</h3>
          {hasChartData ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} domain={['auto', 'auto']} />
                <Tooltip />
                <Line type="monotone" dataKey="noise" stroke="#a855f7" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-sm text-gray-400">--</div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">{t.lightChart}</h3>
          {hasChartData ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} domain={['auto', 'auto']} />
                <Tooltip />
                <Line type="monotone" dataKey="light" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-sm text-gray-400">--</div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">{t.pm25Chart}</h3>
          {hasChartData ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} domain={['auto', 'auto']} />
                <Tooltip />
                <Line type="monotone" dataKey="pm25" stroke="#64748b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-sm text-gray-400">--</div>
          )}
        </div>
      </div>

      {/* AI Assistant */}
      <div className="flex justify-center">
        <div className="glass-panel rounded-2xl p-6 border border-white/10 relative overflow-hidden max-w-xl w-full">
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl"></div>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full ai-thinking flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold">{t.aiAssistant}</h3>
              <p className="text-xs text-gray-400">{t.realtimeOptimization}</p>
            </div>
          </div>

          <div className="space-y-3" id="ai-recommendations">
            {aiInsights.map((insight, idx) => (
              <div
                key={`${insight.title}-${idx}`}
                className={`rounded-xl p-4 flex items-start gap-3 ${
                  insight.tone === 'blue'
                    ? 'bg-blue-500/10 border border-blue-500/30'
                    : insight.tone === 'purple'
                    ? 'bg-purple-500/10 border border-purple-500/30'
                    : 'bg-green-500/10 border border-green-500/30'
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full mt-2 shrink-0 ${
                    insight.tone === 'blue'
                      ? 'bg-blue-400'
                      : insight.tone === 'purple'
                      ? 'bg-purple-400'
                      : 'bg-green-400'
                  }`}
                ></div>
                <div>
                  <p
                    className={`text-sm font-medium mb-1 ${
                      insight.tone === 'blue'
                        ? 'text-blue-400'
                        : insight.tone === 'purple'
                        ? 'text-purple-400'
                        : 'text-green-400'
                    }`}
                  >
                    {insight.title}
                  </p>
                  <p className="text-sm text-gray-300">{insight.text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2 text-xs text-gray-500">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span>{t.realtimeData}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
