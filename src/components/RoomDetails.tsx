import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft, Users, Thermometer, Wind, Volume2, Sun, Droplets, Brain, Plus } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import '../styles/custom.css';
import { computeComfortScoreFromSensors } from '../services/comfortScore';
import { getRoomById, listMeasurements, updateRoomLight, type MeasurementRow } from '../services/firestoreApi';

const LUX_MIN = 150;
const LUX_MAX = 1000;
const LUX_STEP = 10;

interface RoomDetailsProps {
  roomId: string | null;
  onBack: () => void;
  /** Si false, le bouton « Add Room » n’est pas affiché. */
  isAdmin?: boolean;
  /** Appelé quand un admin clique sur « Add Room » (ex. aller à la liste des salles). */
  onAddRoom?: () => void;
}

interface RoomInfo {
  id: string;
  name: string;
  capacity: number;
  occupancy: number;
  status: 'available' | 'busy';
}

export default function RoomDetails({ roomId, onBack, isAdmin = false, onAddRoom }: RoomDetailsProps) {
  const [measurements, setMeasurements] = useState<MeasurementRow[]>([]);
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragLightLux, setDragLightLux] = useState<number | null>(null);
  const [lightSaving, setLightSaving] = useState(false);
  const [lightError, setLightError] = useState<string | null>(null);

  const numericRoomId = roomId?.replace(/^room-/, '') ?? '';

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
    listMeasurements(numericRoomId)
      .then((rows) => setMeasurements(rows))
      .catch((err) => {
        setError(err.message || 'Failed to load measurements');
        setMeasurements([]);
      })
      .finally(() => setLoading(false));
  }, [numericRoomId]);

  useEffect(() => {
    if (!numericRoomId) {
      setRoomInfo(null);
      return;
    }
    getRoomById(numericRoomId)
      .then((r) => {
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
        });
      })
      .catch(() => setRoomInfo(null));
  }, [numericRoomId]);

  /** Dernière mesure par date/heure (les plus récentes en tête côté API ; on garde un max explicite). */
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
      };
    });
  }, [measurements]);

  const hasChartData = chartData.length > 0;

  const roomMeta = useMemo(
    () => ({
      name: roomInfo?.name || 'Room',
      status: roomInfo?.status === 'busy' ? ('occupied' as const) : ('available' as const),
      occupancy: roomInfo?.occupancy ?? 0,
      capacity: roomInfo?.capacity ?? 0,
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
        const r = await getRoomById(numericRoomId);
        if (r) {
          setRoomInfo({
            id: r.id,
            name: r.name,
            capacity: r.capacity,
            occupancy: r.occupancy,
            status: r.status,
          });
        }
        const rows = await listMeasurements(numericRoomId);
        setMeasurements(rows);
      } catch {
        setLightError('Enregistrement impossible. Réessayez.');
      } finally {
        setLightSaving(false);
      }
    },
    [numericRoomId, isAdmin],
  );

  const aiInsights = useMemo(() => {
    const messages: { title: string; text: string; tone: 'blue' | 'purple' | 'green' }[] = [];
    const name = roomMeta.name;

    if (!latest) {
      return [
        {
          title: 'No measurements yet',
          text: `${name}: Charts and live KPIs use the latest saved point by date and time. Add measurements from room updates or admin capture.`,
          tone: 'blue' as const,
        },
      ];
    }

    if (latest.co2 != null) {
      if (latest.co2 > 650) {
        messages.push({
          title: 'Air Quality Alert',
          text: `${name}: CO₂ at ${Math.round(latest.co2)} ppm. Increasing ventilation to keep focus and comfort at optimal levels.`,
          tone: 'blue',
        });
      } else {
        messages.push({
          title: 'Air Quality Stable',
          text: `${name}: CO₂ is under control (${Math.round(latest.co2)} ppm). Ventilation remains in efficient mode.`,
          tone: 'blue',
        });
      }
    }

    if (latest.temperature != null) {
      if (latest.temperature > 23) {
        messages.push({
          title: 'Cooling Optimization',
          text: `${name}: Temperature at ${latest.temperature.toFixed(1)}°C. Targeting 22°C for better comfort/energy balance.`,
          tone: 'purple',
        });
      } else if (latest.temperature < 21) {
        messages.push({
          title: 'Heating Optimization',
          text: `${name}: Temperature at ${latest.temperature.toFixed(1)}°C. Slightly increasing HVAC output for comfort.`,
          tone: 'purple',
        });
      } else {
        messages.push({
          title: 'Thermal Balance',
          text: `${name}: Temperature is in the comfort band (${latest.temperature.toFixed(1)}°C). Keeping current settings.`,
          tone: 'purple',
        });
      }
    }

    if (latest.light != null) {
      if (latest.light > 520) {
        messages.push({
          title: 'Lighting Adaptation',
          text: `${name}: High light intensity (${Math.round(latest.light)} lux). Dimming fixtures to reduce glare and save energy.`,
          tone: 'green',
        });
      } else if (latest.light < 350) {
        messages.push({
          title: 'Lighting Boost',
          text: `${name}: Low light level (${Math.round(latest.light)} lux). Increasing brightness for visual comfort.`,
          tone: 'green',
        });
      } else {
        messages.push({
          title: 'Lighting Stable',
          text: `${name}: Lighting is optimal (${Math.round(latest.light)} lux). No correction required.`,
          tone: 'green',
        });
      }
    }

    if (messages.length === 0) {
      messages.push({
        title: 'Sensor data',
        text: `${name}: Latest record has no numeric values for the assistant yet (e.g. light-only history).`,
        tone: 'blue',
      });
    }

    return messages.slice(0, 3);
  }, [latest, roomMeta.name]);

  const getSensorStatus = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return { color: 'emerald', label: 'Good' };
    if (value <= thresholds.warning) return { color: 'amber', label: 'Warning' };
    return { color: 'red', label: 'Alert' };
  };

  return (
    <div className="space-y-6">
      {/* Back Button and Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-xl transition"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900">{roomMeta.name}</h2>
            <div className="flex items-center space-x-4 mt-1">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${roomMeta.status === 'occupied' ? 'bg-blue-500' : 'bg-emerald-500'}`}></div>
                <span className="text-sm text-gray-600 capitalize">{roomMeta.status}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600">
                  {roomMeta.occupancy}/{roomMeta.capacity} people
                </span>
              </div>
              <div className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-sm font-medium border border-emerald-200">
                Comfort: {displayComfortScore ?? 0}%
              </div>
            </div>
          </div>
        </div>
        {isAdmin ? (
          <div className="flex-shrink-0 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onAddRoom?.()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500 text-white text-sm shadow-sm hover:bg-emerald-600 transition"
            >
              <Plus className="w-4 h-4" />
              Add Room
            </button>
          </div>
        ) : null}
      </div>

      {/* AI Status Banner */}
      <div className="bg-gradient-to-r from-emerald-500 to-blue-500 rounded-2xl p-4 text-white shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Brain className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="font-medium">AI is actively optimizing this room</p>
            <p className="text-sm text-white/80">Adjusting air quality and temperature for maximum comfort</p>
          </div>
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
        </div>
      </div>

      {/* Live Sensor Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Temperature — dernière mesure horodatée */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-orange-200 rounded-xl flex items-center justify-center">
              <Thermometer className="w-6 h-6 text-orange-600" />
            </div>
            {latest?.temperature != null ? (
              <span
                className={`px-2 py-1 text-xs font-medium rounded-lg ${
                  getSensorStatus(latest.temperature, { good: 22, warning: 24 }).color === 'emerald'
                    ? 'bg-emerald-50 text-emerald-600'
                    : getSensorStatus(latest.temperature, { good: 22, warning: 24 }).color === 'amber'
                      ? 'bg-amber-50 text-amber-600'
                      : 'bg-red-50 text-red-600'
                }`}
              >
                {getSensorStatus(latest.temperature, { good: 22, warning: 24 }).label}
              </span>
            ) : (
              <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-lg">--</span>
            )}
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1 tabular-nums">
            {latest?.temperature != null ? `${latest.temperature.toFixed(1)}°C` : '--'}
          </div>
          <div className="text-sm text-gray-500">Temperature</div>
        </div>

        {/* Humidity */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-100 to-cyan-200 rounded-xl flex items-center justify-center">
              <Droplets className="w-6 h-6 text-cyan-600" />
            </div>
            {latest?.humidity != null ? (
              <span
                className={`px-2 py-1 text-xs font-medium rounded-lg ${
                  getSensorStatus(latest.humidity, { good: 45, warning: 60 }).color === 'emerald'
                    ? 'bg-emerald-50 text-emerald-600'
                    : getSensorStatus(latest.humidity, { good: 45, warning: 60 }).color === 'amber'
                      ? 'bg-amber-50 text-amber-600'
                      : 'bg-red-50 text-red-600'
                }`}
              >
                {getSensorStatus(latest.humidity, { good: 45, warning: 60 }).label}
              </span>
            ) : (
              <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-lg">--</span>
            )}
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1 tabular-nums">
            {latest?.humidity != null ? `${Math.round(latest.humidity)}%` : '--'}
          </div>
          <div className="text-sm text-gray-500">Humidity</div>
        </div>

        {/* CO2 */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center">
              <Wind className="w-6 h-6 text-blue-600" />
            </div>
            {latest?.co2 != null ? (
              <span
                className={`px-2 py-1 text-xs font-medium rounded-lg ${
                  getSensorStatus(latest.co2, { good: 500, warning: 800 }).color === 'emerald'
                    ? 'bg-emerald-50 text-emerald-600'
                    : getSensorStatus(latest.co2, { good: 500, warning: 800 }).color === 'amber'
                      ? 'bg-amber-50 text-amber-600'
                      : 'bg-red-50 text-red-600'
                }`}
              >
                {getSensorStatus(latest.co2, { good: 500, warning: 800 }).label}
              </span>
            ) : (
              <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-lg">--</span>
            )}
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1 tabular-nums">
            {latest?.co2 != null ? Math.round(latest.co2) : '--'}
          </div>
          <div className="text-sm text-gray-500">CO₂ (ppm)</div>
        </div>

        {/* Noise */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl flex items-center justify-center">
              <Volume2 className="w-6 h-6 text-purple-600" />
            </div>
            {latest?.noise != null ? (
              <span
                className={`px-2 py-1 text-xs font-medium rounded-lg ${
                  getSensorStatus(latest.noise, { good: 45, warning: 55 }).color === 'emerald'
                    ? 'bg-emerald-50 text-emerald-600'
                    : getSensorStatus(latest.noise, { good: 45, warning: 55 }).color === 'amber'
                      ? 'bg-amber-50 text-amber-600'
                      : 'bg-red-50 text-red-600'
                }`}
              >
                {getSensorStatus(latest.noise, { good: 45, warning: 55 }).label}
              </span>
            ) : (
              <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-lg">--</span>
            )}
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1 tabular-nums">
            {latest?.noise != null ? Math.round(latest.noise) : '--'}
          </div>
          <div className="text-sm text-gray-500">Noise (dB)</div>
        </div>

        {/* Light */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-100 to-amber-200 rounded-xl flex items-center justify-center">
              <Sun className="w-6 h-6 text-amber-600" aria-hidden />
            </div>
            {latest?.light != null ? (
              <span
                className={`px-2 py-1 text-xs font-medium rounded-lg ${
                  getSensorStatus(latest.light, { good: 400, warning: 550 }).color === 'emerald'
                    ? 'bg-emerald-50 text-emerald-600'
                    : getSensorStatus(latest.light, { good: 400, warning: 550 }).color === 'amber'
                      ? 'bg-amber-50 text-amber-600'
                      : 'bg-red-50 text-red-600'
                }`}
              >
                {getSensorStatus(latest.light, { good: 400, warning: 550 }).label}
              </span>
            ) : (
              <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-lg">--</span>
            )}
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1 tabular-nums">
            {latest?.light != null ? Math.round(latest.light) : '--'}
          </div>
          <div className="text-sm text-gray-500">Light (lux)</div>
          {isAdmin && numericRoomId ? (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <label htmlFor="room-light-lux" className="block text-xs font-medium text-gray-500 mb-2">
                Cible {LUX_MIN}–{LUX_MAX} lux (cette salle)
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

      {/* Loading / Error */}
      {loading && (
        <div className="text-center py-8 text-gray-500">Loading measurements…</div>
      )}
      {error && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 text-sm">{error}</div>
      )}

      {/* Historique mesures (affichage ici uniquement) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">Temperature (24h)</h3>
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
          <h3 className="font-semibold text-gray-900 mb-4">CO₂ Level (24h)</h3>
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
          <h3 className="font-semibold text-gray-900 mb-4">Noise Level (24h)</h3>
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
          <h3 className="font-semibold text-gray-900 mb-4">Light Intensity (24h)</h3>
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
      </div>

      {/* AI Assistant centered */}
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
              <h3 className="text-lg font-semibold">AI Assistant</h3>
              <p className="text-xs text-gray-400">Real-time optimization</p>
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

          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Next meeting:</span>
              <span className="font-medium">Design Review (14:00)</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">AI will prepare room 10 minutes before</p>
          </div>
        </div>
      </div>
    </div>
  );
}