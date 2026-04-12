import { AlertCircle, AlertTriangle, Info, CheckCircle, Filter, Search, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  alertApproveResolution,
  alertMarkDirectResolved,
  alertRejectResolution,
  alertRequestResolution,
  seedAlertsIfEmpty,
  subscribeAlerts,
  type AlertRow,
} from '../services/firestoreApi';

export type { AlertStatus } from '../services/firestoreApi';
export type Alert = AlertRow;

function formatResolutionDate(iso: string | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

interface AlertsNotificationsProps {
  /** Admin uniquement : résolution directe, valider / refuser les demandes. */
  canModerateAlerts?: boolean;
  currentUserName?: string;
  /** UID Firebase (obligatoire pour enregistrer une demande de résolution). */
  currentUserId: string;
}

export default function AlertsNotifications({
  canModerateAlerts = false,
  currentUserName = 'Utilisateur',
  currentUserId,
}: AlertsNotificationsProps) {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionAlertId, setActionAlertId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'critical' | 'warning' | 'info' | 'success'>('all');
  const [showResolved, setShowResolved] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    void seedAlertsIfEmpty();
  }, []);

  useEffect(() => {
    setLoadError(null);
    const unsub = subscribeAlerts(
      (rows) => {
        setAlerts(rows);
        setLoading(false);
      },
      (e) => {
        setLoadError(e.message || 'Impossible de charger les alertes.');
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  const filteredAlerts = alerts.filter((alert) => {
    const matchesType = filterType === 'all' || alert.type === filterType;
    const matchesResolved = showResolved || alert.status !== 'resolved';
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

  const handleMarkResolved = async (id: string) => {
    const name = currentUserName.trim() || 'Utilisateur';
    setActionError(null);
    setActionAlertId(id);
    try {
      if (canModerateAlerts) {
        await alertMarkDirectResolved(id, name);
      } else {
        await alertRequestResolution(id, name, currentUserId);
      }
    } catch {
      setActionError('Impossible d’enregistrer l’action. Réessayez.');
    } finally {
      setActionAlertId(null);
    }
  };

  const handleApprovePending = async (id: string) => {
    const name = currentUserName.trim() || 'Administrateur';
    setActionError(null);
    setActionAlertId(id);
    try {
      await alertApproveResolution(id, name);
    } catch {
      setActionError('Impossible de valider la résolution. Réessayez.');
    } finally {
      setActionAlertId(null);
    }
  };

  const handleRejectPending = async (id: string) => {
    setActionError(null);
    setActionAlertId(id);
    try {
      await alertRejectResolution(id);
    } catch {
      setActionError('Impossible de refuser la demande. Réessayez.');
    } finally {
      setActionAlertId(null);
    }
  };

  const criticalCount = alerts.filter((a) => a.type === 'critical' && a.status !== 'resolved').length;
  const warningCount = alerts.filter((a) => a.type === 'warning' && a.status !== 'resolved').length;
  const unresolvedCount = alerts.filter((a) => a.status !== 'resolved').length;
  const pendingApprovalCount = alerts.filter((a) => a.status === 'pending').length;
  const resolvedCount = alerts.filter((a) => a.status === 'resolved').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Alerts & Notifications</h2>
          <p className="text-sm text-gray-500">Données synchronisées en temps réel (Firestore)</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          {pendingApprovalCount > 0 && (
            <div className="px-3 py-2 bg-violet-100 text-violet-800 rounded-xl border border-violet-200 text-sm font-medium flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {canModerateAlerts
                ? `${pendingApprovalCount} à valider`
                : `${pendingApprovalCount} en attente de validation admin`}
            </div>
          )}
        </div>
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-emerald-50 rounded-2xl p-6 border border-blue-200/50">
        <div className="flex items-center space-x-3 mb-4">
          <Info className="w-6 h-6 text-blue-600" />
          <h3 className="font-semibold text-gray-900">Alert Summary</h3>
        </div>
        <p className="text-sm text-gray-700 mb-3">
          Vous avez{' '}
          <span className="font-semibold">
            {unresolvedCount} alerte{unresolvedCount !== 1 ? 's' : ''} non résolue{unresolvedCount !== 1 ? 's' : ''}
          </span>
          {pendingApprovalCount > 0 && (
            <>
              {' '}
              dont <span className="font-semibold">{pendingApprovalCount}</span> en attente de validation
            </>
          )}
          . Les états sont enregistrés dans Firestore : vous pouvez vous déconnecter et valider plus tard en tant
          qu’admin.
        </p>
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          <span>Synchronisation temps réel</span>
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{loadError}</div>
      )}
      {actionError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{actionError}</div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Total Alerts</span>
            <AlertCircle className="w-5 h-5 text-gray-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{loading ? '…' : alerts.length}</div>
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
          <div className="text-2xl font-bold text-emerald-700">{resolvedCount}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100">
        <div className="flex flex-col lg:flex-row gap-4">
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

          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-gray-500" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as typeof filterType)}
              className="px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
            >
              <option value="all">All Types</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
              <option value="success">Success</option>
            </select>
          </div>

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
        {loading ? (
          <div className="bg-white rounded-2xl p-12 shadow-lg border border-gray-100 text-center text-gray-500">
            Chargement des alertes…
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 shadow-lg border border-gray-100 text-center">
            <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No alerts found</h3>
            <p className="text-sm text-gray-500">Try adjusting your filters</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const colors = getAlertColor(alert.type);
            const busy = actionAlertId === alert.id;
            return (
              <div
                key={alert.id}
                className={`${colors.bg} rounded-2xl shadow-lg border ${colors.border} overflow-hidden ${
                  alert.status === 'resolved' ? 'opacity-60' : ''
                }`}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start space-x-4 flex-1 min-w-0">
                      <div className={`w-12 h-12 ${colors.iconBg} rounded-xl flex items-center justify-center flex-shrink-0 ${colors.icon}`}>
                        {getAlertIcon(alert.type)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h3 className={`font-semibold ${colors.text}`}>{alert.title}</h3>
                          <span className="px-2 py-1 bg-white/50 rounded-lg text-xs font-medium text-gray-700 capitalize">
                            {alert.type}
                          </span>
                          {alert.status === 'resolved' && (
                            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium">
                              Résolu
                            </span>
                          )}
                          {alert.status === 'pending' && (
                            <span className="px-2 py-1 bg-violet-100 text-violet-800 rounded-lg text-xs font-medium border border-violet-200">
                              En attente de validation admin
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 mb-3">{alert.message}</p>
                        <div className="flex flex-wrap flex-col gap-2 text-sm">
                          <div className="flex flex-wrap items-center gap-3">
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

                          {alert.status === 'pending' && alert.resolutionRequestedBy && (
                            <div className="mt-1 p-3 bg-white/60 rounded-xl border border-violet-200/80 text-sm text-gray-800">
                              <span className="font-medium text-violet-900">Demande de résolution :</span>{' '}
                              <span className="font-semibold">{alert.resolutionRequestedBy}</span>
                              {alert.resolutionRequestedAt && (
                                <span className="text-gray-600">
                                  {' '}
                                  · {formatResolutionDate(alert.resolutionRequestedAt)}
                                </span>
                              )}
                            </div>
                          )}

                          {alert.status === 'resolved' && (
                            <div className="mt-1 space-y-1 text-sm text-gray-700">
                              {alert.resolutionRequestedBy && (
                                <div>
                                  <span className="text-gray-500">Demandé par :</span>{' '}
                                  <span className="font-medium text-gray-900">{alert.resolutionRequestedBy}</span>
                                  {alert.resolutionRequestedAt && (
                                    <span className="text-gray-600"> · {formatResolutionDate(alert.resolutionRequestedAt)}</span>
                                  )}
                                </div>
                              )}
                              <div>
                                <span className="text-gray-500">Résolu par :</span>{' '}
                                <span className="font-semibold text-emerald-800">{alert.resolvedByName ?? '—'}</span>
                                {alert.resolvedAt && (
                                  <span className="text-gray-600"> · {formatResolutionDate(alert.resolvedAt)}</span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 ml-auto sm:ml-4">
                      {alert.status === 'open' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleMarkResolved(alert.id)}
                          className="px-4 py-2 bg-white text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition shadow-sm border border-gray-200 disabled:opacity-50"
                        >
                          {busy ? '…' : canModerateAlerts ? 'Marquer résolu' : 'Demander résolution'}
                        </button>
                      )}
                      {alert.status === 'pending' && canModerateAlerts && (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleApprovePending(alert.id)}
                            className="px-4 py-2.5 bg-gray-100 text-gray-900 rounded-xl font-semibold border-2 border-gray-700 shadow-md hover:bg-white hover:border-gray-900 transition disabled:opacity-50"
                          >
                            {busy ? '…' : 'Valider la résolution'}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleRejectPending(alert.id)}
                            className="px-4 py-2.5 bg-white text-gray-700 rounded-xl font-medium border border-gray-300 hover:bg-gray-50 transition disabled:opacity-50"
                          >
                            Refuser
                          </button>
                        </div>
                      )}
                      {alert.status === 'pending' && !canModerateAlerts && (
                        <p className="text-xs text-violet-800 px-2 py-2 max-w-[220px] leading-snug">
                          En attente de validation par un administrateur.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
