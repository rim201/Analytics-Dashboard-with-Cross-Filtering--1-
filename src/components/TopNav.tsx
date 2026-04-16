import { Bell, LogOut, User, Check, X, Inbox } from 'lucide-react';
import React, { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { signOutSession, roleLabel, type AppRole } from '../services/auth';
import {
  alertApproveResolution,
  alertRejectResolution,
  markInAppNotificationRead,
  subscribeAlerts,
  subscribeInAppNotificationsForUser,
  type AlertRow,
  type InAppNotificationRow,
} from '../services/firestoreApi';

interface TopNavProps {
  displayName: string;
  email: string;
  /** UID Firebase : exclut ses propres demandes « pending » de la cloche staff ; cible des notifs perso. */
  currentUserId: string;
  role: AppRole;
  /** Admin + technicien : abonnement alertes et cloche. */
  canAccessAlerts: boolean;
  /** Accepter / refuser les demandes dans le panneau (admin uniquement). */
  canModerateAlerts: boolean;
  onOpenAlertsPage: () => void;
  /** Panneau latéral contrôle éclairage (admin uniquement). */
  onOpenAdminLights?: () => void;
}

function formatRequestTime(iso: string | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '';
  }
}

function inAppResolutionMessage(n: InAppNotificationRow): string {
  if (n.kind === 'alert_resolution_rejected') {
    return 'Votre demande de résolution a été refusée.';
  }
  return 'Votre demande de résolution a été acceptée.';
}

export default function TopNav({
  displayName,
  email,
  currentUserId,
  role,
  canAccessAlerts,
  canModerateAlerts,
  onOpenAlertsPage,
}: TopNavProps) {
  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const uid = currentUserId.trim();

  const [panelOpen, setPanelOpen] = useState(false);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [inAppRows, setInAppRows] = useState<InAppNotificationRow[]>([]);
  const [actionId, setActionId] = useState<string | null>(null);
  const [inAppBusyId, setInAppBusyId] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const bellButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});

  useEffect(() => {
    if (!canAccessAlerts) {
      setAlerts([]);
      return;
    }
    return subscribeAlerts(setAlerts);
  }, [canAccessAlerts]);

  useEffect(() => {
    if (!uid) {
      setInAppRows([]);
      return;
    }
    return subscribeInAppNotificationsForUser(uid, setInAppRows);
  }, [uid]);

  useLayoutEffect(() => {
    if (!panelOpen) return;
    const el = bellButtonRef.current;
    if (!el) return;
    const place = () => {
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min((vw - 32) / 2, 24 * 16);
      const maxH = Math.min(vh * 0.85, vh - r.bottom - 16);
      setPanelStyle({
        position: 'fixed',
        top: r.bottom + 8,
        right: Math.max(8, vw - r.right),
        width,
        maxHeight: Math.max(200, maxH),
        zIndex: 9999,
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [panelOpen]);

  useEffect(() => {
    if (!panelOpen) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setPanelOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [panelOpen]);

  /** Demandes à traiter par d’autres (pas sa propre demande). */
  const pendingStaffAlerts = alerts.filter(
    (a) =>
      a.status === 'pending' &&
      (a.resolutionRequestedByUid?.trim() || '') !== uid,
  );
  const inAppUnread = inAppRows.filter((n) => !n.read);
  const unreadCount = pendingStaffAlerts.length + inAppUnread.length;
  const showNotificationsBell = canAccessAlerts || inAppUnread.length > 0;

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

  const handleMarkInAppRead = async (notificationId: string) => {
    setInAppBusyId(notificationId);
    try {
      await markInAppNotificationRead(uid, notificationId);
    } finally {
      setInAppBusyId(null);
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Meeting Room Environment Manager</h1>
          <p className="text-sm text-gray-500 capitalize">{today}</p>
        </div>

        <div className="flex items-center space-x-4">
          {showNotificationsBell && (
            <div className="relative" ref={wrapRef}>
              <button
                ref={bellButtonRef}
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
                  <span className="inline-flex min-w-[0.75rem] shrink-0 translate-y-0.5 items-center justify-center self-end whitespace-nowrap px-[2px] text-[8px] font-bold tabular-nums leading-none text-red-600">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            </div>
          )}

          {showNotificationsBell &&
            panelOpen &&
            createPortal(
              <div
                ref={panelRef}
                style={panelStyle}
                className="flex min-h-[16rem] flex-col overflow-hidden rounded-2xl border-2 border-gray-300 bg-white shadow-2xl"
              >
                <div className="flex shrink-0 items-center justify-between border-b-2 border-gray-200 bg-gray-100 px-4 py-3.5">
                  <span className="text-base font-semibold text-gray-900">Notifications</span>
                  {canAccessAlerts && (
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
                  )}
                </div>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-white p-3">
                  {inAppUnread.length > 0 && (
                    <ul className="space-y-3">
                      {inAppUnread.map((n) => {
                        const busy = inAppBusyId === n.id;
                        const isRejected = n.kind === 'alert_resolution_rejected';
                        return (
                          <li
                            key={n.id}
                            className={`rounded-xl border p-4 text-sm shadow-sm ${
                              isRejected
                                ? 'border-amber-300 bg-amber-50'
                                : 'border-emerald-300 bg-emerald-50'
                            }`}
                          >
                            <p className="font-semibold text-gray-900">{inAppResolutionMessage(n)}</p>
                            <p className="mt-1 line-clamp-2 text-sm text-gray-700">{n.alertTitle}</p>
                            <p className="mt-1 text-xs text-gray-500">{formatRequestTime(n.createdAt)}</p>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleMarkInAppRead(n.id)}
                              className="mt-3 w-full rounded-xl border border-gray-400 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                            >
                              Marquer comme lu
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {canAccessAlerts && pendingStaffAlerts.length > 0 && (
                    <ul
                      className={
                        inAppUnread.length > 0 ? 'space-y-3 border-t border-gray-200 pt-1' : 'space-y-3'
                      }
                    >
                      {pendingStaffAlerts.map((a) => {
                        const busy = actionId === a.id;
                        return (
                          <li
                            key={a.id}
                            className="rounded-xl border border-violet-300 bg-violet-100 p-4 text-sm shadow-sm"
                          >
                            <p className="line-clamp-2 text-base font-semibold text-gray-900">{a.title}</p>
                            <p className="mt-1 text-sm text-gray-600">{a.room}</p>
                            {a.resolutionRequestedBy && (
                              <p className="mt-2 text-sm text-violet-900">
                                Par <span className="font-semibold">{a.resolutionRequestedBy}</span>
                                {a.resolutionRequestedAt && (
                                  <span className="text-gray-600">
                                    {' '}
                                    · {formatRequestTime(a.resolutionRequestedAt)}
                                  </span>
                                )}
                              </p>
                            )}
                            {canModerateAlerts ? (
                              <div className="mt-3 flex gap-2">
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void handleApprove(a.id)}
                                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-gray-700 bg-gray-100 px-3 py-2.5 text-sm font-semibold text-gray-900 hover:bg-white disabled:opacity-50"
                                >
                                  <Check className="h-4 w-4" />
                                  Accepter
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void handleReject(a.id)}
                                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                >
                                  <X className="h-4 w-4" />
                                  Refuser
                                </button>
                              </div>
                            ) : (
                              <p className="mt-3 text-xs leading-snug text-violet-900">
                                En attente de validation par un administrateur.
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {inAppUnread.length === 0 &&
                    (!canAccessAlerts || pendingStaffAlerts.length === 0) && (
                      <div className="flex flex-col items-center justify-center px-6 py-16 text-center text-gray-600">
                        <Inbox className="mb-3 h-14 w-14 text-gray-400" />
                        <p className="text-base">Aucune notification.</p>
                      </div>
                    )}
                </div>
              </div>,
              document.body,
            )}

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
