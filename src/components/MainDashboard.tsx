import { Thermometer, Wind, Volume2, Sun, Star, Brain } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import React, { useEffect, useMemo, useState } from 'react';
import { PageType } from '../App';
import { buildAiRecommendationsFromRooms, type AiDashboardRec } from '../services/aiRecommendations';
import {
  comfortChipToneClass,
  statusHigherIsWorse,
  statusLux,
  statusNoiseDb,
  statusTemperature,
} from '../services/sensorComfortRules';
import {
  fetchDashboardSummary,
  getAiConfig,
  listRoomsWithLatestMeasurements,
  subscribeRoomsWithLatestMeasurements,
} from '../services/firestoreApi';

interface MainDashboardProps {
  onNavigate: (page: PageType) => void;
}

function EmptyChartArea() {
  return <div className="h-[240px] min-h-[240px]" aria-hidden />;
}

export default function MainDashboard({ onNavigate }: MainDashboardProps) {
  const [summary, setSummary] = useState({
    comfortScore: 0,
    temperature: null as number | null,
    co2: null as number | null,
    noise: null as number | null,
    light: null as number | null,
    temperatureData: [] as { time: string; value: number }[],
    co2Data: [] as { time: string; value: number }[],
    lightData: [] as { time: string; value: number }[],
    noiseData: [] as { time: string; value: number }[],
    roomOverview: { total: 0, available: 0, occupied: 0, maintenance: 0 },
  });
  const [aiRecs, setAiRecs] = useState<AiDashboardRec[]>([]);
  const [aiAutoApply, setAiAutoApply] = useState(false);

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
          co2: data.co2 ?? null,
          noise: data.noise ?? null,
          light: data.light ?? null,
          temperatureData: data.temperatureData ?? [],
          co2Data: data.co2Data ?? [],
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
              co2: r.co2,
              light: r.light,
              pm25: r.pm25,
            })),
            ai.settings.aggressiveness,
            6,
          ),
        );
      } catch {
        /* ignore */
      }
    };

    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        void refresh();
      }, 200);
    };

    void refresh();
    const unsub = subscribeRoomsWithLatestMeasurements(() => {
      scheduleRefresh();
    });

    return () => {
      cancelled = true;
      unsub();
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, []);

  const dashStatus = useMemo(() => {
    return {
      temperature: summary.temperature != null ? statusTemperature(summary.temperature) : null,
      co2: summary.co2 != null ? statusHigherIsWorse(summary.co2, 500, 800) : null,
      noise: summary.noise != null ? statusNoiseDb(summary.noise) : null,
      light: summary.light != null ? statusLux(summary.light) : null,
    };
  }, [summary.temperature, summary.co2, summary.noise, summary.light]);

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Comfort Score */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white shadow-xl col-span-1 md:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <Star className="w-6 h-6" />
            <span className="text-sm font-medium opacity-90">Overall</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className={`w-5 h-5 ${star <= 4 ? 'fill-current' : 'opacity-50'}`} />
              ))}
            </div>
            <div className="text-3xl font-bold">{summary.comfortScore}%</div>
            <div className="text-sm opacity-90">Comfort Score</div>
            <div className="text-xs opacity-75 mt-1">24h · all rooms</div>
          </div>
        </div>

        {/* Temperature */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-orange-200 rounded-xl flex items-center justify-center">
              <Thermometer className="w-6 h-6 text-orange-600" />
            </div>
            {dashStatus.temperature != null ? (
              <span
                className={`px-2 py-1 text-xs font-medium rounded-lg ${comfortChipToneClass(dashStatus.temperature)}`}
              >
                {dashStatus.temperature.label}
              </span>
            ) : (
              <span className="px-2 py-1 text-xs font-medium rounded-lg bg-gray-100 text-gray-500">--</span>
            )}
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {summary.temperature != null ? `${summary.temperature}°C` : '--'}
          </div>
          <div className="text-sm text-gray-500">Temperature</div>
          <div className="text-xs text-gray-400 mt-1">24h average · all rooms</div>
        </div>

        {/* CO2 Level */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center">
              <Wind className="w-6 h-6 text-blue-600" />
            </div>
            {dashStatus.co2 != null ? (
              <span className={`px-2 py-1 text-xs font-medium rounded-lg ${comfortChipToneClass(dashStatus.co2)}`}>
                {dashStatus.co2.label}
              </span>
            ) : (
              <span className="px-2 py-1 text-xs font-medium rounded-lg bg-gray-100 text-gray-500">--</span>
            )}
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {summary.co2 != null ? `${Math.round(summary.co2)} ppm` : '--'}
          </div>
          <div className="text-sm text-gray-500">CO₂ Level</div>
          <div className="text-xs text-gray-400 mt-1">24h average · all rooms</div>
        </div>

        {/* Noise Level */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl flex items-center justify-center">
              <Volume2 className="w-6 h-6 text-purple-600" />
            </div>
            {dashStatus.noise != null ? (
              <span className={`px-2 py-1 text-xs font-medium rounded-lg ${comfortChipToneClass(dashStatus.noise)}`}>
                {dashStatus.noise.label}
              </span>
            ) : (
              <span className="px-2 py-1 text-xs font-medium rounded-lg bg-gray-100 text-gray-500">--</span>
            )}
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {summary.noise != null ? `${Math.round(summary.noise)} dB` : '--'}
          </div>
          <div className="text-sm text-gray-500">Noise Level</div>
          <div className="text-xs text-gray-400 mt-1">24h average · all rooms</div>
        </div>

        {/* Light Intensity */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-100 to-amber-200 rounded-xl flex items-center justify-center">
              <Sun className="w-6 h-6 text-amber-600" />
            </div>
            {dashStatus.light != null ? (
              <span className={`px-2 py-1 text-xs font-medium rounded-lg ${comfortChipToneClass(dashStatus.light)}`}>
                {dashStatus.light.label}
              </span>
            ) : (
              <span className="px-2 py-1 text-xs font-medium rounded-lg bg-gray-100 text-gray-500">--</span>
            )}
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {summary.light != null ? `${Math.round(summary.light)} lux` : '--'}
          </div>
          <div className="text-sm text-gray-500">Light Intensity</div>
          <div className="text-xs text-gray-400 mt-1">24h average · all rooms</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Temperature Trend */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Temperature trend</h3>
            <p className="text-sm text-gray-500">Last 24 hours · all rooms (hourly average)</p>
          </div>
          {summary.temperatureData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={summary.temperatureData}>
                <defs>
                  <linearGradient id="dash-temp-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} domain={['auto', 'auto']} />
                <Tooltip />
                <Area type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2} fill="url(#dash-temp-grad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartArea />
          )}
        </div>

        {/* CO2 Trend */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900">CO₂ level trend</h3>
            <p className="text-sm text-gray-500">Last 24 hours · all rooms (hourly average)</p>
          </div>
          {summary.co2Data.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={summary.co2Data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} domain={['auto', 'auto']} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartArea />
          )}
        </div>

        {/* Light trend (24h · toutes salles) */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Light intensity trend</h3>
            <p className="text-sm text-gray-500">Last 24 hours · all rooms (hourly average)</p>
          </div>
          {summary.lightData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={summary.lightData}>
                <defs>
                  <linearGradient id="dash-light-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} domain={['auto', 'auto']} unit=" lx" />
                <Tooltip />
                <Area type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} fill="url(#dash-light-grad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartArea />
          )}
        </div>

        {/* Noise trend */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Noise level trend</h3>
            <p className="text-sm text-gray-500">Last 24 hours · all rooms (hourly average)</p>
          </div>
          {summary.noiseData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={summary.noiseData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} domain={['auto', 'auto']} unit=" dB" />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#a855f7" strokeWidth={2} dot={{ fill: '#a855f7', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartArea />
          )}
        </div>
      </div>

      {/* AI Recommendations Panel */}
      <div className="bg-gradient-to-br from-emerald-50 to-blue-50 rounded-2xl p-6 border border-emerald-200/50">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start space-x-4 min-w-0 flex-1">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">AI Recommendations</h3>
              <p className="text-xs text-gray-500 mb-2">
                Suggestions basées sur les dernières mesures par salle (seuils réglables dans Settings → AI Config).
              </p>
              {!aiAutoApply ? (
                <p className="text-xs text-amber-800 bg-amber-100/80 border border-amber-200 rounded-lg px-2 py-1.5 mb-2">
                  Auto-apply is off in Settings → AI Config; suggestions below are for manual review only.
                </p>
              ) : null}
              <div className="space-y-2">
                {aiRecs.length === 0 ? (
                  <p className="text-sm text-gray-600">
                    No sensor-based suggestions yet. Add measurements to rooms (or lower aggressiveness in AI Config) to see
                    recommendations here.
                  </p>
                ) : (
                  aiRecs.map((rec, i) => (
                    <div key={`${rec.roomName}-${i}`} className="flex items-start space-x-2">
                      <div
                        className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${
                          rec.tone === 'emerald'
                            ? 'bg-emerald-500'
                            : rec.tone === 'blue'
                              ? 'bg-blue-500'
                              : 'bg-amber-500'
                        }`}
                      />
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">{rec.roomName}:</span> {rec.text}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('rooms')}
            className="px-4 py-2 bg-white text-emerald-600 rounded-xl font-medium hover:bg-emerald-50 transition shadow-sm shrink-0 self-start"
          >
            View Rooms
          </button>
        </div>
      </div>

      {/* Room Status Overview */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Room Status Overview</h3>
            <p className="text-sm text-gray-500">{summary.roomOverview.total} total rooms</p>
          </div>
          <button
            onClick={() => onNavigate('rooms')}
            className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition"
          >
            View All Rooms
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
            <div className="text-2xl font-bold text-emerald-600 mb-1">{summary.roomOverview.available}</div>
            <div className="text-sm text-gray-600">Available Rooms</div>
          </div>
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <div className="text-2xl font-bold text-blue-600 mb-1">{summary.roomOverview.occupied}</div>
            <div className="text-sm text-gray-600">Occupied Rooms</div>
          </div>
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
            <div className="text-2xl font-bold text-amber-600 mb-1">{summary.roomOverview.maintenance}</div>
            <div className="text-sm text-gray-600">Maintenance Required</div>
          </div>
        </div>
      </div>
    </div>
  );
}
