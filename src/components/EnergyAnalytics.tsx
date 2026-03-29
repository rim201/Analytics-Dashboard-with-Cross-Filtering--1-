import { Zap, TrendingDown, Leaf, Award, Calendar } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useState } from 'react';

const energyData = [
  { month: 'Jan', before: 4200, after: 3150 },
  { month: 'Feb', before: 4100, after: 3050 },
  { month: 'Mar', before: 4300, after: 3200 },
  { month: 'Apr', before: 4250, after: 3100 },
  { month: 'May', before: 4400, after: 3250 },
  { month: 'Jun', before: 4500, after: 3300 },
];

const consumptionByRoom = [
  { name: 'Conference A', value: 850, color: '#10b981' },
  { name: 'Training Room', value: 1200, color: '#3b82f6' },
  { name: 'Executive Suite', value: 650, color: '#f59e0b' },
  { name: 'Project War Room', value: 980, color: '#8b5cf6' },
  { name: 'Others', value: 1620, color: '#6b7280' },
];

const co2ReductionData = [
  { week: 'Week 1', reduction: 45 },
  { week: 'Week 2', reduction: 52 },
  { week: 'Week 3', reduction: 48 },
  { week: 'Week 4', reduction: 61 },
  { week: 'Week 5', reduction: 58 },
  { week: 'Week 6', reduction: 65 },
];

export default function EnergyAnalytics() {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Energy & Sustainability Analytics</h2>
          <p className="text-sm text-gray-500">Track energy consumption and environmental impact</p>
        </div>
        <div className="flex items-center space-x-2">
          <Calendar className="w-5 h-5 text-gray-500" />
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
          >
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
            <option value="year">Last Year</option>
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Energy Savings */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <Zap className="w-8 h-8" />
            <TrendingDown className="w-5 h-5 opacity-80" />
          </div>
          <div className="text-3xl font-bold mb-1">26.8%</div>
          <div className="text-sm opacity-90">Energy Savings</div>
          <div className="mt-3 text-xs opacity-75">vs. before AI optimization</div>
        </div>

        {/* CO2 Reduction */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <Leaf className="w-8 h-8" />
            <TrendingDown className="w-5 h-5 opacity-80" />
          </div>
          <div className="text-3xl font-bold mb-1">329 kg</div>
          <div className="text-sm opacity-90">CO₂ Reduced</div>
          <div className="mt-3 text-xs opacity-75">This month</div>
        </div>

        {/* Cost Savings */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-2xl">$</span>
            <TrendingDown className="w-5 h-5 opacity-80" />
          </div>
          <div className="text-3xl font-bold mb-1">$1,247</div>
          <div className="text-sm opacity-90">Cost Savings</div>
          <div className="mt-3 text-xs opacity-75">This month</div>
        </div>

        {/* Sustainability Score */}
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <Award className="w-8 h-8" />
            <span className="text-xs opacity-75">Grade A</span>
          </div>
          <div className="text-3xl font-bold mb-1">94/100</div>
          <div className="text-sm opacity-90">Sustainability Score</div>
          <div className="mt-3 text-xs opacity-75">Industry leading</div>
        </div>
      </div>

      {/* Energy Consumption Comparison */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Energy Consumption Comparison</h3>
          <p className="text-sm text-gray-500">Before vs. After AI Optimization (kWh)</p>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={energyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="month" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip />
            <Legend />
            <Bar dataKey="before" fill="#94a3b8" name="Before AI" radius={[8, 8, 0, 0]} />
            <Bar dataKey="after" fill="#10b981" name="After AI" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Energy Consumption by Room */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Energy Consumption by Room</h3>
            <p className="text-sm text-gray-500">Current month distribution (kWh)</p>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={consumptionByRoom}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {consumptionByRoom.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* CO2 Reduction Trend */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900">CO₂ Reduction Trend</h3>
            <p className="text-sm text-gray-500">Weekly CO₂ emissions saved (kg)</p>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={co2ReductionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="week" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="reduction"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ fill: '#10b981', r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sustainability Achievements */}
      <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-6 border border-emerald-200/50">
        <div className="flex items-start space-x-4 mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-green-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Award className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Sustainability Achievements</h3>
            <p className="text-sm text-gray-600">Environmental impact milestones</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-emerald-100">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Leaf className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">1.2 Tons CO₂</div>
                <div className="text-xs text-gray-500">Total reduction</div>
              </div>
            </div>
            <p className="text-xs text-gray-600">Equivalent to 54 trees planted</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-100">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">12,400 kWh</div>
                <div className="text-xs text-gray-500">Energy saved</div>
              </div>
            </div>
            <p className="text-xs text-gray-600">Powers 1.2 homes for a year</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-amber-100">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Award className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">LEED Gold</div>
                <div className="text-xs text-gray-500">Certification track</div>
              </div>
            </div>
            <p className="text-xs text-gray-600">On target for Q4 2026</p>
          </div>
        </div>
      </div>

      {/* Optimization Tips */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Optimization Insights</h3>
        <div className="space-y-3">
          <div className="flex items-start space-x-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-2"></div>
            <div>
              <p className="text-sm font-medium text-gray-900">Peak Efficiency Hours</p>
              <p className="text-sm text-gray-600">Your building achieves best energy efficiency between 9 AM - 11 AM when AI optimizations are most effective.</p>
            </div>
          </div>
          <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-xl border border-blue-200">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2"></div>
            <div>
              <p className="text-sm font-medium text-gray-900">Room Utilization</p>
              <p className="text-sm text-gray-600">Training Room shows 40% underutilization. Consider scheduling more meetings to maximize energy efficiency.</p>
            </div>
          </div>
          <div className="flex items-start space-x-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2"></div>
            <div>
              <p className="text-sm font-medium text-gray-900">Seasonal Adjustment</p>
              <p className="text-sm text-gray-600">Winter approaching: Pre-heating schedules optimized to reduce morning energy spikes by 18%.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
