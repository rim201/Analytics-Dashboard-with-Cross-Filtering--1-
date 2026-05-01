import React, { useState, useEffect } from 'react';
import { LanguageProvider, useLang } from './i18n/LanguageContext';
import { useMotionWatchdog } from './hooks/useMotionWatchdog';
import { useInactivityLogout } from './hooks/useInactivityLogout';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import LoginPage from './components/LoginPage';
import FirstLoginPasswordChange from './components/FirstLoginPasswordChange';
import { maybeRunAutoRetentionPurge, seedAlertsIfEmpty, seedFirestoreIfEmpty } from './services/firestoreApi';
import MainDashboard from './components/MainDashboard';
import RoomsManagement from './components/RoomsManagement';
import RoomDetails from './components/RoomDetails';
import AlertsNotifications from './components/AlertsNotifications';
import AdminSettings from './components/AdminSettings';
import Sidebar from './components/Sidebar';
import TopNav from './components/TopNav';
import { auth } from './firebase';
import {
  ACCOUNT_INACTIVE_LOGIN_MESSAGE,
  canAccessAlertsAndNotifications,
  canModerateAlerts,
  clearLoginNoticeStorage,
  ensureDefaultAdminUser,
  ensureProfileAfterLogin,
  fetchUserProfile,
  signOutSession,
  type UserProfile,
} from './services/auth';

export type PageType = 
  | 'login' 
  | 'dashboard' 
  | 'rooms' 
  | 'room-details'
  | 'alerts'
  | 'settings';

export default function App() {
  return (
    <LanguageProvider>
      <AppInner />
    </LanguageProvider>
  );
}

function AppInner() {
  const [currentPage, setCurrentPage] = useState<PageType>('dashboard');
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('theme');
      const dark =
        stored === 'dark' ? true
        : stored === 'light' ? false
        : window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', dark);
      return dark;
    } catch {
      return false;
    }
  });

  const onToggleTheme = () => {
    setIsDark((d) => {
      const next = !d;
      document.documentElement.classList.toggle('dark', next);
      try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch {}
      return next;
    });
  };

  const { t } = useLang();
  const isAdmin = userProfile?.role === 'admin';
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);

  useMotionWatchdog(!!authUser);

  useInactivityLogout(
    !!authUser && !userProfile?.mustChangePassword,
    () => setShowInactivityWarning(true),
    () => {
      setShowInactivityWarning(false);
      try {
        sessionStorage.setItem('loginNotice', t.inactivityLoggedOut);
      } catch { /* ignore */ }
      void signOutSession();
    },
  );
  const canAccessAlerts = canAccessAlertsAndNotifications(userProfile?.role);
  const canModerateAlertActions = canModerateAlerts(userProfile?.role);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      await ensureDefaultAdminUser();
      if (cancelled) return;
      unsub = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          setAuthUser(null);
          setUserProfile(null);
          setCurrentPage('dashboard');
          setSelectedRoomId(null);
          setAuthReady(true);
          return;
        }
        try {
          const profile = await ensureProfileAfterLogin(user);
          if (profile.status === 'inactive') {
            try {
              sessionStorage.setItem('loginNotice', ACCOUNT_INACTIVE_LOGIN_MESSAGE);
            } catch {
              /* ignore */
            }
            await signOutSession();
            setAuthUser(null);
            setUserProfile(null);
          } else {
            clearLoginNoticeStorage();
            setAuthUser(user);
            setUserProfile(profile);
          }
        } catch {
          setAuthUser(null);
          setUserProfile(null);
        } finally {
          setAuthReady(true);
        }
      });
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  useEffect(() => {
    if (!userProfile || userProfile.mustChangePassword) return;
    void seedFirestoreIfEmpty();
    if (canAccessAlertsAndNotifications(userProfile.role)) void seedAlertsIfEmpty();
  }, [userProfile]);

  useEffect(() => {
    if (!userProfile || userProfile.mustChangePassword || userProfile.role !== 'admin') return;
    void maybeRunAutoRetentionPurge();
  }, [userProfile]);

  useEffect(() => {
    if (currentPage === 'settings' && userProfile && !isAdmin) {
      setCurrentPage('dashboard');
    }
  }, [currentPage, userProfile, isAdmin]);

  useEffect(() => {
    if (currentPage === 'alerts' && userProfile && !canAccessAlerts) {
      setCurrentPage('dashboard');
    }
  }, [currentPage, userProfile, canAccessAlerts]);

  const handleNavigate = (page: PageType) => {
    if (page === 'settings' && !isAdmin) return;
    if (page === 'alerts' && !canAccessAlerts) return;
    setCurrentPage(page);
    setSidebarOpen(false);
  };

  const handleRoomSelect = (roomId: string) => {
    setSelectedRoomId(roomId);
    setCurrentPage('room-details');
  };

  if (!authReady) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--background)', color: 'var(--gray-600)' }}
      >
        {t.loading}
      </div>
    );
  }

  if (!authUser || !userProfile || userProfile.status === 'inactive') {
    return <LoginPage />;
  }

  if (userProfile.mustChangePassword) {
    return (
      <FirstLoginPasswordChange
        displayName={userProfile.name}
        email={authUser.email ?? userProfile.email}
        onSuccess={async () => {
          const next = await fetchUserProfile(authUser.uid);
          if (!next) return;
          if (next.status === 'inactive') {
            try {
              sessionStorage.setItem('loginNotice', ACCOUNT_INACTIVE_LOGIN_MESSAGE);
            } catch {
              /* ignore */
            }
            await signOutSession();
            setAuthUser(null);
            setUserProfile(null);
            return;
          }
          clearLoginNoticeStorage();
          setUserProfile(next);
        }}
      />
    );
  }

  return (
    <div className="flex h-screen" style={{ background: 'var(--background)' }}>
      {showInactivityWarning && (
        <div
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            color: '#1d4ed8',
            borderRadius: '0.75rem',
            padding: '0.75rem 1.25rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            maxWidth: '90vw',
          }}
          role="alert"
        >
          <span>{t.inactivityWarning}</span>
          <button
            onClick={() => setShowInactivityWarning(false)}
            style={{ marginLeft: 'auto', opacity: 0.6, fontSize: '1rem', lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
      <Sidebar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        isAdmin={isAdmin}
        canAccessAlerts={canAccessAlerts}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopNav
          displayName={userProfile.name}
          email={authUser.email ?? ''}
          currentUserId={authUser.uid}
          role={userProfile.role}
          canAccessAlerts={canAccessAlerts}
          canModerateAlerts={canModerateAlertActions}
          onOpenAlertsPage={() => setCurrentPage('alerts')}
          onMenuToggle={() => setSidebarOpen(true)}
          isDark={isDark}
          onToggleTheme={onToggleTheme}
        />
        <main className="flex-1 overflow-y-auto" style={{ padding: '1.5rem' }}>
          <div className="page-max-width">
            {currentPage === 'dashboard' && <MainDashboard onNavigate={handleNavigate} />}
            {currentPage === 'rooms' && <RoomsManagement onRoomSelect={handleRoomSelect} isAdmin={isAdmin} />}
            {currentPage === 'room-details' && (
              <RoomDetails
                roomId={selectedRoomId}
                onBack={() => setCurrentPage('rooms')}
                isAdmin={isAdmin}
              />
            )}
            {currentPage === 'alerts' && canAccessAlerts && (
              <AlertsNotifications
                canModerateAlerts={canModerateAlertActions}
                currentUserName={userProfile.name}
                currentUserId={authUser.uid}
              />
            )}
            {currentPage === 'settings' && isAdmin && <AdminSettings />}
          </div>
        </main>
      </div>
    </div>
  );
}

