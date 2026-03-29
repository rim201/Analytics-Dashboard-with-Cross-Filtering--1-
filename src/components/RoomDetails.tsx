import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Users, Thermometer, Wind, Volume2, Sun, Droplets, Brain, Plus } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import '../styles/custom.css';

const API_BASE = 'http://127.0.0.1:8000';

interface RoomDetailsProps {
  roomId: string | null;
  onBack: () => void;
  onAddRoom?: () => void;
}

interface Measurement {
  timestamp: string;
  temperature: number;
  humidity: number;
  co2: number;
  noise: number;
  light: number;
}

interface RoomInfo {
  id: number;
  name: string;
  capacity: number;
  occupancy: number;
  status: 'available' | 'busy';
}

// Fallback mock data when API returns empty or fails
const fallbackChartPoint = (base: number, variance: number) =>
  Array.from({ length: 12 }, (_, i) => ({
    time: `${i * 2}:00`,
    value: base + (Math.random() - 0.5) * variance,
  }));

export default function RoomDetails({ roomId, onBack, onAddRoom }: RoomDetailsProps) {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const numericRoomId = roomId?.replace(/^room-/, '') ?? '';

  useEffect(() => {
    if (!numericRoomId) {
      setMeasurements([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/api/rooms/${numericRoomId}/measurements/`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { measurements: Measurement[] }) => {
        setMeasurements(data.measurements ?? []);
      })
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
    fetch(`${API_BASE}/api/rooms/`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const selected = (data?.rooms || []).find((r: any) => String(r.id) === String(numericRoomId));
        setRoomInfo(selected || null);
      })
      .catch(() => setRoomInfo(null));
  }, [numericRoomId]);

  const latest = useMemo(() => measurements[0] ?? null, [measurements]);

  const chartData = useMemo(() => {
    const reversed = [...measurements].reverse();
    return reversed.map((m) => {
      const d = new Date(m.timestamp);
      const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      return {
        time,
        temperature: m.temperature,
        humidity: m.humidity,
        co2: m.co2,
        noise: m.noise,
        light: m.light,
      };
    });
  }, [measurements]);

  const temperatureChart = chartData.length > 0 ? chartData : fallbackChartPoint(22.5, 2).map((d) => ({ ...d, temperature: d.value }));
  const co2Chart = chartData.length > 0 ? chartData : fallbackChartPoint(580, 200).map((d) => ({ ...d, co2: d.value }));
  const noiseChart = chartData.length > 0 ? chartData : fallbackChartPoint(42, 15).map((d) => ({ ...d, noise: d.value }));
  const lightChart = chartData.length > 0 ? chartData : fallbackChartPoint(450, 100).map((d) => ({ ...d, light: d.value }));
  const occupancyChart = chartData.length > 0 ? chartData : fallbackChartPoint(0, 1).map((d) => ({ ...d, occupancy: d.value }));

  const room = {
    id: roomId || 'room-1',
    name: roomInfo?.name || 'Room',
    status: roomInfo?.status === 'busy' ? 'occupied' : 'available',
    occupancy: roomInfo?.occupancy ?? 0,
    capacity: roomInfo?.capacity ?? 0,
    comfortScore: 92,
    temperature: latest?.temperature ?? 22.5,
    humidity: latest?.humidity ?? 45,
    co2: latest?.co2 ?? 580,
    noise: latest?.noise ?? 42,
    light: latest?.light ?? 450,
  };

  const aiInsights = useMemo(() => {
    const messages: { title: string; text: string; tone: 'blue' | 'purple' | 'green' }[] = [];

    if (room.co2 > 650) {
      messages.push({
        title: 'Air Quality Alert',
        text: `${room.name}: CO₂ at ${Math.round(room.co2)} ppm. Increasing ventilation to keep focus and comfort at optimal levels.`,
        tone: 'blue',
      });
    } else {
      messages.push({
        title: 'Air Quality Stable',
        text: `${room.name}: CO₂ is under control (${Math.round(room.co2)} ppm). Ventilation remains in efficient mode.`,
        tone: 'blue',
      });
    }

    if (room.temperature > 23) {
      messages.push({
        title: 'Cooling Optimization',
        text: `${room.name}: Temperature at ${room.temperature.toFixed(1)}°C. Targeting 22°C for better comfort/energy balance.`,
        tone: 'purple',
      });
    } else if (room.temperature < 21) {
      messages.push({
        title: 'Heating Optimization',
        text: `${room.name}: Temperature at ${room.temperature.toFixed(1)}°C. Slightly increasing HVAC output for comfort.`,
        tone: 'purple',
      });
    } else {
      messages.push({
        title: 'Thermal Balance',
        text: `${room.name}: Temperature is in the comfort band (${room.temperature.toFixed(1)}°C). Keeping current settings.`,
        tone: 'purple',
      });
    }

    if (room.light > 520) {
      messages.push({
        title: 'Lighting Adaptation',
        text: `${room.name}: High light intensity (${Math.round(room.light)} lux). Dimming fixtures to reduce glare and save energy.`,
        tone: 'green',
      });
    } else if (room.light < 350) {
      messages.push({
        title: 'Lighting Boost',
        text: `${room.name}: Low light level (${Math.round(room.light)} lux). Increasing brightness for visual comfort.`,
        tone: 'green',
      });
    } else {
      messages.push({
        title: 'Lighting Stable',
        text: `${room.name}: Lighting is optimal (${Math.round(room.light)} lux). No correction required.`,
        tone: 'green',
      });
    }

    return messages.slice(0, 3);
  }, [room.name, room.co2, room.temperature, room.light]);

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
            <h2 className="text-2xl font-bold text-gray-900">{room.name}</h2>
            <div className="flex items-center space-x-4 mt-1">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${room.status === 'occupied' ? 'bg-blue-500' : 'bg-emerald-500'}`}></div>
                <span className="text-sm text-gray-600 capitalize">{room.status}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600">
                  {room.occupancy}/{room.capacity} people
                </span>
              </div>
              <div className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-sm font-medium border border-emerald-200">
                Comfort: {room.comfortScore}%
              </div>
            </div>
          </div>
        </div>
        <div className="flex-shrink-0 flex items-center gap-2">
          <button
            onClick={() => (onAddRoom ? onAddRoom() : console.log('Add room clicked'))}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 transition"
          >
            <Plus className="w-4 h-4" />
            Add Room
          </button>
        </div>
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
        {/* Temperature */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-orange-200 rounded-xl flex items-center justify-center">
              <Thermometer className="w-6 h-6 text-orange-600" />
            </div>
            <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-xs font-medium rounded-lg">Good</span>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{room.temperature}°C</div>
          <div className="text-sm text-gray-500">Temperature</div>
        </div>

        {/* Humidity */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-100 to-cyan-200 rounded-xl flex items-center justify-center">
              <Droplets className="w-6 h-6 text-cyan-600" />
            </div>
            <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-xs font-medium rounded-lg">Good</span>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{room.humidity}%</div>
          <div className="text-sm text-gray-500">Humidity</div>
        </div>

        {/* CO2 */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center">
              <Wind className="w-6 h-6 text-blue-600" />
            </div>
            <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-xs font-medium rounded-lg">Good</span>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{room.co2}</div>
          <div className="text-sm text-gray-500">CO₂ (ppm)</div>
        </div>

        {/* Noise */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl flex items-center justify-center">
              <Volume2 className="w-6 h-6 text-purple-600" />
            </div>
            <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-xs font-medium rounded-lg">Quiet</span>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{room.noise}</div>
          <div className="text-sm text-gray-500">Noise (dB)</div>
        </div>

        {/* Light */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-100 to-amber-200 rounded-xl flex items-center justify-center">
              <Sun className="w-6 h-6 text-amber-600" />
            </div>
            <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-xs font-medium rounded-lg">Optimal</span>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{room.light}</div>
          <div className="text-sm text-gray-500">Light (lux)</div>
        </div>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="text-center py-8 text-gray-500">Loading measurements…</div>
      )}
      {error && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 text-sm">
          {error} — charts show fallback data.
        </div>
      )}

      {/* Historical Charts (from API or fallback) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">Temperature (24h)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={temperatureChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} domain={[20, 25]} />
              <Tooltip />
              <Line type="monotone" dataKey="temperature" stroke="#f97316" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">CO₂ Level (24h)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={co2Chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} domain={[300, 800]} />
              <Tooltip />
              <Line type="monotone" dataKey="co2" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">Noise Level (24h)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={noiseChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} domain={[20, 60]} />
              <Tooltip />
              <Line type="monotone" dataKey="noise" stroke="#a855f7" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">Light Intensity (24h)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={lightChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} domain={[300, 600]} />
              <Tooltip />
              <Line type="monotone" dataKey="light" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
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