import { Bell, LogOut, User, Check, X, Inbox } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { signOutSession, roleLabel, type AppRole } from '../services/auth';
import {
  alertApproveResolution,
  alertRejectResolution,
  markInAppNotificationRead,
  markInAppNotificationsReadMany,
  subscribeAlerts,
  subscribeInAppNotificationsForUser,
  type AlertRow,
  type InAppNotificationRow,
} from '../services/firestoreApi';

interface TopNavProps {
  displayName: string;
  email: string;
  role: AppRole;
  isAdmin: boolean;
  currentUserUid: string;
  onOpenAlertsPage: () => void;
  /** Panneau latéral contrôle éclairage (admin uniquement). */
  onOpenAdminLights?: () => void;
}

function formatNotifTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '';
  }
}

function formatRequestTime(iso: string | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '';
  }
}

export default function TopNav({
  displayName,
  email,
  role,
  isAdmin,
  currentUserUid,
  onOpenAlertsPage,
}: TopNavProps) {
  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const [panelOpen, setPanelOpen] = useState(false);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [notifications, setNotifications] = useState<InAppNotificationRow[]>([]);
  const [actionId, setActionId] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAdmin) {
      setAlerts([]);
      return;
    }
    const unsub = subscribeAlerts(setAlerts);
    return unsub;
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin || !currentUserUid) {
      setNotifications([]);
      return;
    }
    const unsub = subscribeInAppNotificationsForUser(currentUserUid, setNotifications);
    return unsub;
  }, [isAdmin, currentUserUid]);

  useEffect(() => {
    if (!panelOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [panelOpen]);

  /** À l’ouverture du panneau : marquer toutes les notifs comme lues → compteur repasse à 0. */
  useEffect(() => {
    if (!panelOpen || isAdmin) return;
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    void markInAppNotificationsReadMany(unread.map((n) => n.id));
  }, [panelOpen, isAdmin, notifications]);

  const pendingAlerts = alerts.filter((a) => a.status === 'pending');
  const unreadCount = isAdmin
    ? pendingAlerts.length
    : notifications.filter((n) => !n.read).length;

  const handleApprove = async (alertId: string) => {
    setActionId(alertId);
    try {
      await alertApproveResolution(alertId, displayName.trim() || 'Administrateur');
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (alertId: string) => {
    setActionId(alertId);
    try {
      await alertRejectResolution(alertId);
    } finally {
      setActionId(null);
    }
  };

  const handleNotifClick = async (n: InAppNotificationRow) => {
    if (!n.read) {
      try {
        await markInAppNotificationRead(n.id);
      } catch {
        /* ignore */
      }
    }
    onOpenAlertsPage();
    setPanelOpen(false);
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Meeting Room Environment Manager</h1>
          <p className="text-sm text-gray-500 capitalize">{today}</p>
        </div>

        <div className="flex items-center space-x-4">
          <div className="relative" ref={wrapRef}>
            <button
              type="button"
              onClick={() => setPanelOpen((o) => !o)}
              className={`inline-flex items-end gap-1 p-2 text-gray-600 hover:bg-gray-100 rounded-xl transition ${
                panelOpen ? 'bg-gray-100' : ''
              }`}
              title="Notifications"
              aria-expanded={panelOpen}
              aria-haspopup="true"
              aria-label={
                unreadCount > 0 ? `Notifications (${unreadCount} non lues)` : 'Notifications'
              }
            >
              <Bell className="w-5 h-5 shrink-0" strokeWidth={2} aria-hidden />
              {unreadCount > 0 && (
                <span className="mb-px inline-flex h-3.5 min-w-[0.875rem] shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-red-600 px-1 text-[9px] font-bold tabular-nums leading-none text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {panelOpen && (
              <div className="absolute right-0 top-full mt-2 w-[min(100vw-1rem,48rem)] min-h-[16rem] max-h-[min(85vh,48rem)] overflow-hidden rounded-2xl border-2 border-gray-300 bg-white shadow-2xl z-50 flex flex-col">
                <div className="px-4 py-3.5 border-b-2 border-gray-200 flex items-center justify-between bg-gray-100 shrink-0">
                  <span className="text-base font-semibold text-gray-900">Notifications</span>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenAlertsPage();
                      setPanelOpen(false);
                    }}
                    className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
                  >
                    Voir les alertes
                  </button>
                </div>
                <div className="overflow-y-auto flex-1 p-3 min-h-0 bg-white">
                  {isAdmin ? (
                    pendingAlerts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 px-6 text-center text-gray-600">
                        <Inbox className="w-14 h-14 mb-3 text-gray-400" />
                        <p className="text-base">Aucune demande de résolution en attente.</p>
                      </div>
                    ) : (
                      <ul className="space-y-3">
                        {pendingAlerts.map((a) => {
                          const busy = actionId === a.id;
                          return (
                            <li
                              key={a.id}
                              className="rounded-xl border border-violet-300 bg-violet-100 shadow-sm p-4 text-sm"
                            >
                              <p className="font-semibold text-gray-900 text-base line-clamp-2">{a.title}</p>
                              <p className="text-sm text-gray-600 mt-1">{a.room}</p>
                              {a.resolutionRequestedBy && (
                                <p className="text-sm text-violet-900 mt-2">
                                  Par <span className="font-semibold">{a.resolutionRequestedBy}</span>
                                  {a.resolutionRequestedAt && (
                                    <span className="text-gray-600"> · {formatRequestTime(a.resolutionRequestedAt)}</span>
                                  )}
                                </p>
                              )}
                              <div className="flex gap-2 mt-3">
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void handleApprove(a.id)}
                                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-gray-100 text-gray-900 text-sm font-semibold border-2 border-gray-700 hover:bg-white disabled:opacity-50"
                                >
                                  <Check className="w-4 h-4" />
                                  Accepter
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void handleReject(a.id)}
                                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white text-gray-700 text-sm font-medium border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                                >
                                  <X className="w-4 h-4" />
                                  Refuser
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )
                  ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center text-gray-600">
                      <Inbox className="w-14 h-14 mb-3 text-gray-400" />
                      <p className="text-base">Aucune notification pour le moment.</p>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {notifications.map((n) => (
                        <li key={n.id}>
                          <button
                            type="button"
                            onClick={() => void handleNotifClick(n)}
                            className={`w-full text-left rounded-xl px-4 py-3.5 text-sm transition shadow-sm ${
                              n.read
                                ? 'bg-gray-200 text-gray-700 border border-gray-300'
                                : 'bg-emerald-100 border border-emerald-300 text-gray-900'
                            }`}
                          >
                            <p className="font-semibold text-base">
                              {n.kind === 'alert_resolution_accepted'
                                ? 'Demande acceptée'
                                : 'Demande refusée'}
                            </p>
                            <p className="text-sm mt-1.5 leading-relaxed line-clamp-3">
                              {n.kind === 'alert_resolution_accepted'
                                ? `Votre demande pour « ${n.alertTitle} » a été acceptée. L’alerte est résolue.`
                                : `Votre demande pour « ${n.alertTitle} » a été refusée. L’alerte est à nouveau ouverte.`}
                            </p>
                            <p className="text-xs text-gray-500 mt-2">{formatNotifTime(n.createdAt)}</p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3 pl-4 border-l border-gray-200">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-blue-400 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-gray-900">{displayName}</p>
              <p className="text-xs text-gray-500">{email}</p>
              <p className="text-xs text-emerald-600 font-medium">{roleLabel(role)}</p>
            </div>
            <button
              type="button"
              onClick={() => void signOutSession()}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-xl transition"
              title="Déconnexion"
              aria-label="Déconnexion"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
