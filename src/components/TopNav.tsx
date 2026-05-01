import { Bell, LogOut, User, Check, X, Inbox, Menu, Sun, Moon } from 'lucide-react';
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
import { useLang } from '../i18n/LanguageContext';

interface TopNavProps {
  displayName: string;
  email: string;
  currentUserId: string;
  role: AppRole;
  canAccessAlerts: boolean;
  canModerateAlerts: boolean;
  onOpenAlertsPage: () => void;
  onOpenAdminLights?: () => void;
  onMenuToggle?: () => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
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
  currentUserId,
  role,
  canAccessAlerts,
  canModerateAlerts,
  onOpenAlertsPage,
  onMenuToggle,
  isDark = false,
  onToggleTheme,
}: TopNavProps) {
  const { t, lang, toggleLang } = useLang();

  const today = new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', {
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
      const target = e.target as Node;
      if (wrapRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setPanelOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [panelOpen]);

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
    <header className="header-surface px-4 sm:px-6 py-3 shrink-0">
      <div className="flex items-center justify-between gap-3">
        {/* Left – title + mobile menu */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onMenuToggle}
            className="md:hidden p-2 rounded-xl transition shrink-0"
            style={{ color: 'var(--gray-500)', background: 'transparent' }}
            aria-label={t.openMenu}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1
              className="text-base sm:text-lg font-semibold truncate leading-tight"
              style={{ color: 'var(--gray-900)', letterSpacing: '-0.01em' }}
            >
              {t.appTitle}
            </h1>
            <p className="text-xs capitalize hidden sm:block mt-0.5" style={{ color: 'var(--gray-400)' }}>
              {today}
            </p>
          </div>
        </div>

        {/* Right – lang + bell + user */}
        <div className="flex items-center gap-2">
          {/* Language toggle */}
          <button
            type="button"
            onClick={toggleLang}
            className="theme-toggle text-xs font-semibold tracking-wide"
            title={lang === 'fr' ? 'Switch to English' : 'Passer en français'}
            aria-label={lang === 'fr' ? 'Switch to English' : 'Passer en français'}
          >
            {lang === 'fr' ? 'EN' : 'FR'}
          </button>

          {/* Bell */}
          {showNotificationsBell && (
            <div className="relative" ref={wrapRef}>
              <button
                ref={bellButtonRef}
                type="button"
                onClick={() => setPanelOpen((o) => !o)}
                className={`notification-bell ${panelOpen ? 'notification-bell--open' : ''}`}
                style={{ padding: '0.5rem', color: 'var(--gray-600)' }}
                title={t.notifications}
                aria-expanded={panelOpen}
                aria-haspopup="true"
                aria-label={unreadCount > 0 ? t.notificationsUnread(unreadCount) : t.notifications}
              >
                <Bell className="w-5 h-5" strokeWidth={2} />
              </button>
              {unreadCount > 0 && (
                <span className="notification-badge">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
          )}

          {/* Notifications panel portal */}
          {showNotificationsBell &&
            panelOpen &&
            createPortal(
              <div
                ref={panelRef}
                className="flex min-h-[16rem] flex-col overflow-hidden rounded-2xl"
                aria-label={t.notifications}
                style={{
                  ...panelStyle,
                  background: 'var(--card)',
                  border: '1px solid var(--gray-200)',
                  boxShadow: 'var(--shadow-xl)',
                }}
              >
                {/* Panel header */}
                <div
                  className="flex shrink-0 items-center justify-between px-4 py-3.5"
                  style={{ borderBottom: '1px solid var(--gray-100)', background: 'var(--gray-50)' }}
                >
                  <span className="text-sm font-semibold" style={{ color: 'var(--gray-900)' }}>
                    {t.notifications}
                  </span>
                  {canAccessAlerts && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenAlertsPage();
                        setPanelOpen(false);
                      }}
                      className="text-xs font-medium transition"
                      style={{ color: '#059669' }}
                    >
                      {t.viewAlerts}
                    </button>
                  )}
                </div>

                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3" style={{ background: 'var(--card)' }}>
                  {/* Personal in-app notifications */}
                  {inAppUnread.length > 0 && (
                    <ul className="space-y-2.5">
                      {inAppUnread.map((n) => {
                        const busy = inAppBusyId === n.id;
                        const isRejected = n.kind === 'alert_resolution_rejected';
                        return (
                          <li
                            key={n.id}
                            className={`rounded-xl p-3.5 text-sm ${
                              isRejected
                                ? 'alert-accent-warning notif-item-rejected'
                                : 'alert-accent-success notif-item-ok'
                            }`}
                          >
                            <p className="font-semibold" style={{ color: 'var(--gray-900)' }}>
                              {isRejected ? t.resolutionRejected : t.resolutionAccepted}
                            </p>
                            <p className="mt-1 line-clamp-2 text-xs" style={{ color: 'var(--gray-700)' }}>
                              {n.alertTitle}
                            </p>
                            <p className="mt-0.5 text-xs" style={{ color: 'var(--gray-400)' }}>
                              {formatRequestTime(n.createdAt)}
                            </p>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleMarkInAppRead(n.id)}
                              className="mt-2.5 w-full rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-50"
                              style={{
                                border: '1px solid var(--gray-300)',
                                background: 'white',
                                color: 'var(--gray-700)',
                              }}
                            >
                              {t.markAsRead}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {/* Pending staff alerts */}
                  {canAccessAlerts && pendingStaffAlerts.length > 0 && (
                    <ul
                      className={inAppUnread.length > 0 ? 'space-y-2.5 pt-2' : 'space-y-2.5'}
                      style={inAppUnread.length > 0 ? { borderTop: '1px solid var(--gray-100)' } : {}}
                    >
                      {pendingStaffAlerts.map((a) => {
                        const busy = actionId === a.id;
                        return (
                          <li
                            key={a.id}
                            className="rounded-xl p-3.5 text-sm alert-accent-info notif-item-pending"
                          >
                            <p className="line-clamp-2 font-semibold" style={{ color: 'var(--gray-900)' }}>
                              {a.title}
                            </p>
                            <p className="mt-0.5 text-xs" style={{ color: 'var(--gray-600)' }}>
                              {a.room}
                            </p>
                            {a.resolutionRequestedBy && (
                              <p className="mt-1.5 text-xs" style={{ color: '#7c3aed' }}>
                                {t.by} <span className="font-semibold">{a.resolutionRequestedBy}</span>
                                {a.resolutionRequestedAt && (
                                  <span style={{ color: 'var(--gray-500)' }}>
                                    {' '}· {formatRequestTime(a.resolutionRequestedAt)}
                                  </span>
                                )}
                              </p>
                            )}
                            {canModerateAlerts ? (
                              <div className="mt-2.5 flex gap-2">
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void handleApprove(a.id)}
                                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition disabled:opacity-50"
                                  style={{
                                    background: 'var(--gray-900)',
                                    color: 'white',
                                  }}
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  {t.approve}
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void handleReject(a.id)}
                                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition disabled:opacity-50"
                                  style={{
                                    border: '1px solid var(--gray-300)',
                                    background: 'white',
                                    color: 'var(--gray-700)',
                                  }}
                                >
                                  <X className="h-3.5 w-3.5" />
                                  {t.decline}
                                </button>
                              </div>
                            ) : (
                              <p className="mt-2 text-xs leading-snug" style={{ color: '#7c3aed' }}>
                                {t.awaitingAdminApproval}
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {/* Empty state */}
                  {inAppUnread.length === 0 && (!canAccessAlerts || pendingStaffAlerts.length === 0) && (
                    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                      <Inbox className="mb-3 h-12 w-12" style={{ color: 'var(--gray-300)' }} />
                      <p className="text-sm" style={{ color: 'var(--gray-500)' }}>
                        {t.noNotifications}
                      </p>
                    </div>
                  )}
                </div>
              </div>,
              document.body,
            )}

          {/* Theme toggle */}
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              className="theme-toggle"
              title={isDark ? t.switchToLight : t.switchToDark}
              aria-label={isDark ? t.switchToLight : t.switchToDark}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          )}

          {/* Divider */}
          <div className="w-px h-7 mx-1" style={{ background: 'var(--gray-200)' }} />

          {/* User section */}
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 user-avatar"
              style={{ background: 'linear-gradient(135deg, #10b981, #3b82f6)' }}
            >
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="hidden sm:block min-w-0">
              <p className="text-sm font-semibold leading-tight truncate" style={{ color: 'var(--gray-900)' }}>
                {displayName}
              </p>
              <p className="text-xs leading-tight truncate" style={{ color: 'var(--gray-400)' }}>
                {email}
              </p>
              <p className="text-xs font-semibold leading-tight" style={{ color: '#10b981' }}>
                {roleLabel(role)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void signOutSession()}
              className="p-2 rounded-xl transition"
              style={{ color: 'var(--gray-400)' }}
              title={t.signOut}
              aria-label={t.signOut}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
