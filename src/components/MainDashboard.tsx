import { Thermometer, Wind, Volume2, Sun, Star, TrendingUp, TrendingDown, Brain } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import React, { useEffect, useState } from 'react';
import { PageType } from '../App';

interface MainDashboardProps {
  onNavigate: (page: PageType) => void;
}

const fallbackTemperatureData = [
  { time: '00:00', value: 21.5 },
  { time: '04:00', value: 21.2 },
  { time: '08:00', value: 22.1 },
  { time: '12:00', value: 23.5 },
  { time: '16:00', value: 22.8 },
  { time: '20:00', value: 21.9 },
];

const fallbackCo2Data = [
  { time: '00:00', value: 420 },
  { time: '04:00', value: 410 },
  { time: '08:00', value: 580 },
  { time: '12:00', value: 720 },
  { time: '16:00', value: 650 },
  { time: '20:00', value: 480 },
];

export default function MainDashboard({ onNavigate }: MainDashboardProps) {
  const [summary, setSummary] = useState({
    comfortScore: 92,
    temperature: 22.5,
    co2: 580,
    noise: 42,
    light: 450,
    temperatureData: fallbackTemperatureData,
    co2Data: fallbackCo2Data,
    roomOverview: { total: 0, available: 0, occupied: 0, maintenance: 0 },
  });

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/dashboard-summary/')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setSummary({
            comfortScore: data.comfortScore || 92,
            temperature: data.temperature || 22.5,
            co2: data.co2 || 580,
            noise: data.noise || 42,
            light: data.light || 450,
            temperatureData: (data.temperatureData && data.temperatureData.length > 0) ? data.temperatureData : fallbackTemperatureData,
            co2Data: (data.co2Data && data.co2Data.length > 0) ? data.co2Data : fallbackCo2Data,
            roomOverview: data.roomOverview || { total: 0, available: 0, occupied: 0, maintenance: 0 },
          });
        }
      })
      .catch(() => undefined);
  }, []);

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
          </div>
        </div>

        {/* Temperature */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-orange-200 rounded-xl flex items-center justify-center">
              <Thermometer className="w-6 h-6 text-orange-600" />
            </div>
            <div className="flex items-center space-x-1 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-medium">Normal</span>
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900">{summary.temperature}°C</div>
          <div className="text-sm text-gray-500">Temperature</div>
        </div>

        {/* CO2 Level */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center">
              <Wind className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex items-center space-x-1 text-emerald-600">
              <TrendingDown className="w-4 h-4" />
              <span className="text-xs font-medium">Good</span>
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900">{summary.co2} ppm</div>
          <div className="text-sm text-gray-500">CO₂ Level</div>
        </div>

        {/* Noise Level */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl flex items-center justify-center">
              <Volume2 className="w-6 h-6 text-purple-600" />
            </div>
            <div className="flex items-center space-x-1 text-emerald-600">
              <TrendingDown className="w-4 h-4" />
              <span className="text-xs font-medium">Quiet</span>
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900">{summary.noise} dB</div>
          <div className="text-sm text-gray-500">Noise Level</div>
        </div>

        {/* Light Intensity */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-100 to-amber-200 rounded-xl flex items-center justify-center">
              <Sun className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex items-center space-x-1 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-medium">Optimal</span>
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900">{summary.light} lux</div>
          <div className="text-sm text-gray-500">Light Intensity</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Temperature Trend */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Temperature Trend</h3>
            <p className="text-sm text-gray-500">Last 24 hours</p>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={summary.temperatureData}>
              <defs>
                <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} domain={[20, 25]} />
              <Tooltip />
              <Area type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2} fill="url(#tempGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* CO2 Trend */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900">CO₂ Level Trend</h3>
            <p className="text-sm text-gray-500">Last 24 hours</p>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={summary.co2Data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} domain={[300, 800]} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* AI Recommendations Panel */}
      <div className="bg-gradient-to-br from-emerald-50 to-blue-50 rounded-2xl p-6 border border-emerald-200/50">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Recommendations</h3>
              <div className="space-y-2">
                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-2"></div>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Conference Room A:</span> Reduce temperature by 1°C to optimize energy consumption while maintaining comfort.
                  </p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2"></div>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Meeting Room B:</span> Increase ventilation to reduce CO₂ levels from 720 ppm to below 600 ppm.
                  </p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2"></div>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Executive Suite:</span> Adjust lighting intensity to 500 lux based on occupancy patterns.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={() => onNavigate('rooms')}
            className="px-4 py-2 bg-white text-emerald-600 rounded-xl font-medium hover:bg-emerald-50 transition shadow-sm"
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
