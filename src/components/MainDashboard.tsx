import { Thermometer, Volume2, Sun, Star, Brain, Droplets, AlertTriangle, X } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PageType } from '../App';
import { buildAiRecommendationsFromRooms, buildSensorAlertCandidates, type AiDashboardRec } from '../services/aiRecommendations';
import {
  comfortChipToneClass,
  statusHumidityPct,
  statusLux,
  statusNoiseDb,
  statusTemperature,
} from '../services/sensorComfortRules';
import {
  createSensorAlert,
  fetchDashboardSummary,
  getAiConfig,
  listRoomsWithLatestMeasurements,
  subscribeRoomsWithLatestMeasurements,
  type RoomListRow,
} from '../services/firestoreApi';
import { useLang } from '../i18n/LanguageContext';
import { translateChipLabel } from '../i18n/translations';

const AUTO_ALERT_COOLDOWN_MS = 2 * 60 * 60 * 1000;
const autoAlertThrottle = new Map<string, number>();

function maybeCreateSensorAlerts(rooms: RoomListRow[]) {
  const now = Date.now();
  const candidates = buildSensorAlertCandidates(rooms);
  for (const c of candidates) {
    const last = autoAlertThrottle.get(c.key) ?? 0;
    if (now - last < AUTO_ALERT_COOLDOWN_MS) continue;
    autoAlertThrottle.set(c.key, now);
    void createSensorAlert({
      roomId: c.roomId,
      roomName: c.roomName,
      type: c.type,
      title: c.title,
      message: c.message,
      category: c.category,
    }).catch(() => {});
  }
}

interface MainDashboardProps {
  onNavigate: (page: PageType) => void;
}

function EmptyChartArea({ label }: { label: string }) {
  return (
    <div
      className="h-[240px] min-h-[240px] rounded-xl flex items-center justify-center"
      style={{ background: 'var(--gray-50)' }}
      aria-hidden
    >
      <p className="text-sm" style={{ color: 'var(--gray-400)' }}>
        {label}
      </p>
    </div>
  );
}

export default function MainDashboard({ onNavigate }: MainDashboardProps) {
  const { t, lang } = useLang();

  const SENSOR_CONFIG = [
    {
      key: 'temperature' as const,
      label: t.dashboard.sensorTemp,
      unit: '°C',
      icon: Thermometer,
      iconBg: '#fff7ed',
      iconColor: '#f97316',
      iconBorder: '#fed7aa',
      format: (v: number) => `${v}°C`,
    },
    {
      key: 'humidity' as const,
      label: t.dashboard.sensorHumidity,
      unit: '%',
      icon: Droplets,
      iconBg: '#ecfeff',
      iconColor: '#06b6d4',
      iconBorder: '#a5f3fc',
      format: (v: number) => `${Math.round(v)}%`,
    },
    {
      key: 'noise' as const,
      label: t.dashboard.sensorNoise,
      unit: 'dB',
      icon: Volume2,
      iconBg: '#faf5ff',
      iconColor: '#a855f7',
      iconBorder: '#e9d5ff',
      format: (v: number) => `${Math.round(v)} dB`,
    },
    {
      key: 'light' as const,
      label: t.dashboard.sensorLight,
      unit: 'lux',
      icon: Sun,
      iconBg: '#fffbeb',
      iconColor: '#f59e0b',
      iconBorder: '#fde68a',
      format: (v: number) => `${Math.round(v)} lux`,
    },
  ] as const;

  const [summary, setSummary] = useState({
    comfortScore: 0,
    temperature: null as number | null,
    humidity: null as number | null,
    noise: null as number | null,
    light: null as number | null,
    temperatureData: [] as { time: string; value: number }[],
    lightData: [] as { time: string; value: number }[],
    noiseData: [] as { time: string; value: number }[],
    roomOverview: { total: 0, available: 0, occupied: 0, maintenance: 0 },
  });
  const [aiRecs, setAiRecs] = useState<AiDashboardRec[]>([]);
  const [aiAutoApply, setAiAutoApply] = useState(false);
  const [alertToast, setAlertToast] = useState<{ title: string; room: string } | null>(null);
  const prevRoomsRef = useRef<RoomListRow[]>([]);

  useEffect(() => {
    if (!alertToast) return;
    const timer = setTimeout(() => setAlertToast(null), 6000);
    return () => clearTimeout(timer);
  }, [alertToast]);

  useEffect(() => {
    let cancelled = false;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const refresh = async () => {
      try {
        const [data, ai, rooms] = await Promise.all([fetchDashboardSummary(), getAiConfig(), listRoomsWithLatestMeasurements()]);
        if (cancelled) return;
        setSummary({
          comfortScore: data.comfortScore ?? 0,
          temperature: data.temperature ?? null,
          humidity: data.humidity ?? null,
          noise: data.noise ?? null,
          light: data.light ?? null,
          temperatureData: data.temperatureData ?? [],
          lightData: data.lightData ?? [],
          noiseData: data.noiseData ?? [],
          roomOverview: data.roomOverview || { total: 0, available: 0, occupied: 0, maintenance: 0 },
        });
        setAiAutoApply(ai.settings.autoApplyRecommendations);
        setAiRecs(
          buildAiRecommendationsFromRooms(
            rooms.map((r) => ({
              name: r.name,
              temperature: r.temperature,
              light: r.light,
              pm25: r.pm25,
            })),
            ai.settings.aggressiveness,
            6,
          ),
        );
        maybeCreateSensorAlerts(rooms);
        prevRoomsRef.current = rooms;
      } catch {
        /* ignore */
      }
    };

    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => { void refresh(); }, 200);
    };

    void refresh();
    const unsub = subscribeRoomsWithLatestMeasurements(() => { scheduleRefresh(); });

    return () => {
      cancelled = true;
      unsub();
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, []);

  const dashStatus = useMemo(() => ({
    temperature: summary.temperature != null ? statusTemperature(summary.temperature) : null,
    humidity: summary.humidity != null ? statusHumidityPct(summary.humidity) : null,
    noise: summary.noise != null ? statusNoiseDb(summary.noise) : null,
    light: summary.light != null ? statusLux(summary.light) : null,
  }), [summary.temperature, summary.humidity, summary.noise, summary.light]);

  const sensorValues: Record<string, number | null> = {
    temperature: summary.temperature,
    humidity: summary.humidity,
    noise: summary.noise,
    light: summary.light,
  };

  const sensorStatuses: Record<string, ReturnType<typeof statusTemperature> | null> = {
    temperature: dashStatus.temperature,
    humidity: dashStatus.humidity,
    noise: dashStatus.noise,
    light: dashStatus.light,
  };

  return (
    <div className="flex flex-col page-content" style={{ gap: '2rem', paddingBlock: '0.5rem 2rem' }}>
      {/* Alert toast */}
      {alertToast && (
        <div
          className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-50"
          role="alert"
        >
          <div
            className="flex items-start gap-3 rounded-2xl px-4 py-3 alert-toast-warning"
            style={{ boxShadow: 'var(--shadow-xl)' }}
          >
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#d97706' }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: '#92400e' }}>{alertToast.title}</p>
              <p className="text-xs mt-0.5" style={{ color: '#b45309' }}>{alertToast.room}</p>
            </div>
            <button
              type="button"
              onClick={() => setAlertToast(null)}
              className="shrink-0 transition"
              style={{ color: '#d97706' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Page header ── */}
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        style={{ borderBottom: '1px solid var(--gray-200)', paddingBottom: '1.5rem' }}
      >
        <div>
          <h2
            className="text-2xl font-bold leading-tight"
            style={{ color: 'var(--gray-900)', letterSpacing: '-0.025em' }}
          >
            {t.dashboard.title}
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--gray-500)' }}>
            {t.dashboard.subtitle}
          </p>
        </div>

        {/* Room overview chips */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="stat-chip stat-chip-available">
            <span className="w-2 h-2 rounded-full shrink-0 dot-available" />
            {t.dashboard.available(summary.roomOverview.available)}
          </div>
          <div className="stat-chip stat-chip-occupied">
            <span className="w-2 h-2 rounded-full shrink-0 dot-busy" />
            {t.dashboard.occupied(summary.roomOverview.occupied)}
          </div>
          <div className="stat-chip stat-chip-comfort">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className="w-3 h-3"
                  style={{
                    fill: s <= Math.round(summary.comfortScore / 20) ? '#10b981' : 'transparent',
                    color: s <= Math.round(summary.comfortScore / 20) ? '#10b981' : 'var(--gray-300)',
                  }}
                />
              ))}
            </div>
            {summary.comfortScore}%
          </div>
        </div>
      </div>

      {/* ── Sensor KPI cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4" style={{ gap: '1.25rem' }}>
        {SENSOR_CONFIG.map(({ key, label, icon: Icon, iconBg, iconColor, iconBorder, format }) => {
          const value = sensorValues[key];
          const status = sensorStatuses[key];
          return (
            <div
              key={key}
              className="rounded-xl p-5 metric-card"
              style={{
                background: 'var(--card)',
                border: '1px solid var(--gray-200)',
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: iconBg, border: `1px solid ${iconBorder}` }}
                >
                  <Icon style={{ width: 15, height: 15, color: iconColor }} />
                </div>
                {status != null ? (
                  <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-md ${comfortChipToneClass(status)}`}>
                    {translateChipLabel(status.label, lang)}
                  </span>
                ) : (
                  <span
                    className="px-1.5 py-0.5 text-[10px] font-medium rounded-md"
                    style={{ background: 'var(--gray-100)', color: 'var(--gray-400)' }}
                  >
                    --
                  </span>
                )}
              </div>
              <div
                className="text-xl font-bold leading-none"
                style={{ color: 'var(--gray-900)' }}
              >
                {value != null ? format(value) : '--'}
              </div>
              <div className="text-xs mt-1.5" style={{ color: 'var(--gray-500)' }}>
                {label}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Charts 2-column grid ── */}
      <div
        className="grid grid-cols-1 lg:grid-cols-2 gap-8 py-4"
        style={{ gap: '1.75rem', paddingBlock: '0.75rem 1rem' }}
      >
        {/* Temperature */}
        <div
          className="rounded-2xl p-6 chart-card"
          style={{ background: 'var(--card)', border: '1px solid var(--gray-200)', padding: '1.75rem' }}
        >
          <div className="mb-6">
            <h3 className="text-base font-semibold" style={{ color: 'var(--gray-900)' }}>
              {t.dashboard.temperatureTrend}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--gray-500)' }}>
              {t.dashboard.chartSubtitle}
            </p>
          </div>
          {summary.temperatureData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={summary.temperatureData}>
                <defs>
                  <linearGradient id="dash-temp-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                <XAxis dataKey="time" stroke="var(--gray-300)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--gray-300)" fontSize={11} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--card)',
                    border: '1px solid var(--gray-200)',
                    borderRadius: 10,
                    boxShadow: 'var(--shadow-md)',
                    fontSize: 12,
                    color: 'var(--gray-900)',
                  }}
                />
                <Area type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2} fill="url(#dash-temp-grad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartArea label={t.dashboard.noDataYet} />
          )}
        </div>

        {/* Light */}
        <div
          className="rounded-2xl p-6 chart-card"
          style={{ background: 'var(--card)', border: '1px solid var(--gray-200)', padding: '1.75rem' }}
        >
          <div className="mb-6">
            <h3 className="text-base font-semibold" style={{ color: 'var(--gray-900)' }}>
              {t.dashboard.lightTrend}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--gray-500)' }}>
              {t.dashboard.chartSubtitle}
            </p>
          </div>
          {summary.lightData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={summary.lightData}>
                <defs>
                  <linearGradient id="dash-light-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                <XAxis dataKey="time" stroke="var(--gray-300)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--gray-300)" fontSize={11} tickLine={false} axisLine={false} domain={['auto', 'auto']} unit=" lx" />
                <Tooltip
                  contentStyle={{
                    background: 'var(--card)',
                    border: '1px solid var(--gray-200)',
                    borderRadius: 10,
                    boxShadow: 'var(--shadow-md)',
                    fontSize: 12,
                    color: 'var(--gray-900)',
                  }}
                />
                <Area type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} fill="url(#dash-light-grad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartArea label={t.dashboard.noDataYet} />
          )}
        </div>

        {/* Noise */}
        <div
          className="rounded-2xl p-6 chart-card"
          style={{ background: 'var(--card)', border: '1px solid var(--gray-200)', padding: '1.75rem' }}
        >
          <div className="mb-6">
            <h3 className="text-base font-semibold" style={{ color: 'var(--gray-900)' }}>
              {t.dashboard.noiseTrend}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--gray-500)' }}>
              {t.dashboard.chartSubtitle}
            </p>
          </div>
          {summary.noiseData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={summary.noiseData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                <XAxis dataKey="time" stroke="var(--gray-300)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--gray-300)" fontSize={11} tickLine={false} axisLine={false} domain={['auto', 'auto']} unit=" dB" />
                <Tooltip
                  contentStyle={{
                    background: 'var(--card)',
                    border: '1px solid var(--gray-200)',
                    borderRadius: 10,
                    boxShadow: 'var(--shadow-md)',
                    fontSize: 12,
                    color: 'var(--gray-900)',
                  }}
                />
                <Line type="monotone" dataKey="value" stroke="#a855f7" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartArea label={t.dashboard.noDataYet} />
          )}
        </div>
      </div>

      {/* ── AI Recommendations ── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--gray-200)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* AI panel header */}
        <div
          className="flex items-center justify-between px-6 py-5 ai-panel-header"
          style={{ borderBottom: '1px solid var(--gray-200)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 3px 10px rgba(16,185,129,0.3)' }}
            >
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--gray-900)' }}>
                {t.dashboard.aiRecommendations}
              </p>
              <p className="text-xs" style={{ color: 'var(--gray-500)' }}>
                {t.dashboard.aiSubtitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!aiAutoApply && (
              <span className="hidden sm:inline text-xs px-2 py-1 rounded-lg font-medium auto-apply-badge">
                {t.dashboard.autoApplyOff}
              </span>
            )}
            <button
              type="button"
              onClick={() => onNavigate('rooms')}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white transition"
              style={{ background: '#10b981' }}
            >
              {t.dashboard.viewRooms}
            </button>
          </div>
        </div>

        {/* AI rec list */}
        <div className="p-6">
          {aiRecs.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: 'var(--gray-400)' }}>
              {t.dashboard.noSuggestions}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {aiRecs.map((rec, i) => {
                const tone = rec.tone as string;
                const dotColor: Record<string, string> = { emerald: '#10b981', blue: '#3b82f6', amber: '#f59e0b' };
                const toneClassMap: Record<string, string> = { emerald: 'rec-chip-emerald', blue: 'rec-chip-blue', amber: 'rec-chip-amber' };
                const dot = dotColor[tone] ?? 'var(--gray-400)';
                const toneClass = toneClassMap[tone] ?? 'rec-chip-default';
                return (
                  <div
                    key={`${rec.roomName}-${i}`}
                    className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm rec-chip ${toneClass}`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                      style={{ background: dot }}
                    />
                    <p>
                      <span className="font-semibold">{rec.roomName}:</span> {rec.text}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
