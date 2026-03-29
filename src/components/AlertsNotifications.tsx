import { AlertCircle, AlertTriangle, Info, CheckCircle, Filter, Search } from 'lucide-react';
import { useState } from 'react';

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info' | 'success';
  room: string;
  title: string;
  message: string;
  timestamp: string;
  category: string;
  resolved: boolean;
}

const alertsData: Alert[] = [
  {
    id: 'alert-1',
    type: 'critical',
    room: 'Project War Room',
    title: 'High CO₂ Level Detected',
    message: 'CO₂ concentration has exceeded 800 ppm. Immediate ventilation increase recommended.',
    timestamp: '2 minutes ago',
    category: 'Air Quality',
    resolved: false,
  },
  {
    id: 'alert-2',
    type: 'warning',
    room: 'Conference Room A',
    title: 'Temperature Above Setpoint',
    message: 'Current temperature is 2°C above the comfort setpoint. HVAC system adjusting.',
    timestamp: '15 minutes ago',
    category: 'Temperature',
    resolved: false,
  },
  {
    id: 'alert-3',
    type: 'warning',
    room: 'Executive Suite',
    title: 'Occupancy Sensor Malfunction',
    message: 'Occupancy sensor not responding. Manual verification required.',
    timestamp: '32 minutes ago',
    category: 'System',
    resolved: false,
  },
  {
    id: 'alert-4',
    type: 'info',
    room: 'Training Room',
    title: 'Scheduled Maintenance Reminder',
    message: 'HVAC filter replacement scheduled for tomorrow at 8:00 AM.',
    timestamp: '1 hour ago',
    category: 'Maintenance',
    resolved: false,
  },
  {
    id: 'alert-5',
    type: 'success',
    room: 'Meeting Room B',
    title: 'Optimization Complete',
    message: 'AI has successfully optimized temperature and lighting for current occupancy.',
    timestamp: '1 hour ago',
    category: 'Optimization',
    resolved: true,
  },
  {
    id: 'alert-6',
    type: 'warning',
    room: 'Focus Room 1',
    title: 'Humidity Level High',
    message: 'Humidity at 62%. Dehumidification system activated.',
    timestamp: '2 hours ago',
    category: 'Air Quality',
    resolved: false,
  },
  {
    id: 'alert-7',
    type: 'info',
    room: 'Brainstorm Hub',
    title: 'Energy Savings Achieved',
    message: 'Room achieved 15% energy savings today through smart scheduling.',
    timestamp: '3 hours ago',
    category: 'Energy',
    resolved: true,
  },
  {
    id: 'alert-8',
    type: 'critical',
    room: 'Training Room',
    title: 'HVAC System Error',
    message: 'HVAC controller communication lost. Technician notified.',
    timestamp: '4 hours ago',
    category: 'System',
    resolved: true,
  },
];

export default function AlertsNotifications() {
  const [alerts, setAlerts] = useState(alertsData);
  const [filterType, setFilterType] = useState<'all' | 'critical' | 'warning' | 'info' | 'success'>('all');
  const [showResolved, setShowResolved] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAlerts = alerts.filter((alert) => {
    const matchesType = filterType === 'all' || alert.type === filterType;
    const matchesResolved = showResolved || !alert.resolved;
    const matchesSearch =
      alert.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.room.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.message.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesResolved && matchesSearch;
  });

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'critical':
        return <AlertCircle className="w-5 h-5" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5" />;
      case 'success':
        return <CheckCircle className="w-5 h-5" />;
      default:
        return <Info className="w-5 h-5" />;
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'critical':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-700',
          iconBg: 'bg-red-100',
          icon: 'text-red-600',
        };
      case 'warning':
        return {
          bg: 'bg-amber-50',
          border: 'border-amber-200',
          text: 'text-amber-700',
          iconBg: 'bg-amber-100',
          icon: 'text-amber-600',
        };
      case 'success':
        return {
          bg: 'bg-emerald-50',
          border: 'border-emerald-200',
          text: 'text-emerald-700',
          iconBg: 'bg-emerald-100',
          icon: 'text-emerald-600',
        };
      default:
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          text: 'text-blue-700',
          iconBg: 'bg-blue-100',
          icon: 'text-blue-600',
        };
    }
  };

  const handleResolve = (id: string) => {
    setAlerts((prev) => prev.map((alert) => (alert.id === id ? { ...alert, resolved: true } : alert)));
  };

  const criticalCount = alerts.filter((a) => a.type === 'critical' && !a.resolved).length;
  const warningCount = alerts.filter((a) => a.type === 'warning' && !a.resolved).length;
  const unresolvedCount = alerts.filter((a) => !a.resolved).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Alerts & Notifications</h2>
          <p className="text-sm text-gray-500">Monitor system alerts and events</p>
        </div>
        <div className="flex items-center space-x-2">
          {criticalCount > 0 && (
            <div className="px-3 py-2 bg-red-100 text-red-700 rounded-xl border border-red-200 text-sm font-medium">
              {criticalCount} Critical
            </div>
          )}
          {warningCount > 0 && (
            <div className="px-3 py-2 bg-amber-100 text-amber-700 rounded-xl border border-amber-200 text-sm font-medium">
              {warningCount} Warning
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Total Alerts</span>
            <AlertCircle className="w-5 h-5 text-gray-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{alerts.length}</div>
        </div>
        <div className="bg-red-50 rounded-2xl p-6 shadow-lg border border-red-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-red-700">Critical</span>
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <div className="text-2xl font-bold text-red-700">{criticalCount}</div>
        </div>
        <div className="bg-amber-50 rounded-2xl p-6 shadow-lg border border-amber-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-amber-700">Warnings</span>
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-700">{warningCount}</div>
        </div>
        <div className="bg-emerald-50 rounded-2xl p-6 shadow-lg border border-emerald-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-emerald-700">Resolved</span>
            <CheckCircle className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700">{alerts.filter((a) => a.resolved).length}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search alerts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Type Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-gray-500" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
            >
              <option value="all">All Types</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
              <option value="success">Success</option>
            </select>
          </div>

          {/* Show Resolved Toggle */}
          <label className="flex items-center space-x-2 px-4 py-2.5 bg-gray-50 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
              className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
            />
            <span className="text-sm font-medium text-gray-700">Show Resolved</span>
          </label>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 shadow-lg border border-gray-100 text-center">
            <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No alerts found</h3>
            <p className="text-sm text-gray-500">Try adjusting your filters</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const colors = getAlertColor(alert.type);
            return (
              <div
                key={alert.id}
                className={`${colors.bg} rounded-2xl shadow-lg border ${colors.border} overflow-hidden ${
                  alert.resolved ? 'opacity-60' : ''
                }`}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      {/* Icon */}
                      <div className={`w-12 h-12 ${colors.iconBg} rounded-xl flex items-center justify-center flex-shrink-0 ${colors.icon}`}>
                        {getAlertIcon(alert.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className={`font-semibold ${colors.text}`}>{alert.title}</h3>
                          <span className="px-2 py-1 bg-white/50 rounded-lg text-xs font-medium text-gray-700 capitalize">
                            {alert.type}
                          </span>
                          {alert.resolved && (
                            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium">
                              Resolved
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 mb-3">{alert.message}</p>
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-500">Room:</span>
                            <span className="font-medium text-gray-900">{alert.room}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-500">Category:</span>
                            <span className="font-medium text-gray-900">{alert.category}</span>
                          </div>
                          <div className="text-gray-500">{alert.timestamp}</div>
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    {!alert.resolved && (
                      <button
                        onClick={() => handleResolve(alert.id)}
                        className="px-4 py-2 bg-white text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition shadow-sm ml-4"
                      >
                        Mark Resolved
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Summary */}
      <div className="bg-gradient-to-br from-blue-50 to-emerald-50 rounded-2xl p-6 border border-blue-200/50">
        <div className="flex items-center space-x-3 mb-4">
          <Info className="w-6 h-6 text-blue-600" />
          <h3 className="font-semibold text-gray-900">Alert Summary</h3>
        </div>
        <p className="text-sm text-gray-700 mb-3">
          You have <span className="font-semibold">{unresolvedCount} unresolved alerts</span> requiring attention.
          The AI system is actively monitoring all rooms and will automatically resolve minor issues when possible.
        </p>
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          <span>Real-time monitoring active</span>
        </div>
      </div>
    </div>
  );
}
