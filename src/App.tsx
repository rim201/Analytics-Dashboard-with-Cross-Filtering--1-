import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import LoginPage from './components/LoginPage';
import FirstLoginPasswordChange from './components/FirstLoginPasswordChange';
import { seedAlertsIfEmpty, seedFirestoreIfEmpty } from './services/firestoreApi';
import MainDashboard from './components/MainDashboard';
import RoomsManagement from './components/RoomsManagement';
import RoomDetails from './components/RoomDetails';
import AlertsNotifications from './components/AlertsNotifications';
import AdminSettings from './components/AdminSettings';
import Sidebar from './components/Sidebar';
import TopNav from './components/TopNav';
import { auth } from './firebase';
import {
  ensureDefaultAdminUser,
  ensureProfileAfterLogin,
  fetchUserProfile,
  type UserProfile,
} from './services/auth';

export type PageType = 
  | 'login' 
  | 'dashboard' 
  | 'rooms' 
  | 'room-details'
  | 'alerts'
  | 'settings';

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('dashboard');
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const isAdmin = userProfile?.role === 'admin';

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      await ensureDefaultAdminUser();
      if (cancelled) return;
      unsub = onAuthStateChanged(auth, async (user) => {
        setAuthUser(user);
        if (!user) {
          setUserProfile(null);
          setAuthReady(true);
          return;
        }
        try {
          const profile = await ensureProfileAfterLogin(user);
          setUserProfile(profile);
        } catch {
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
    void seedAlertsIfEmpty();
  }, [userProfile]);

  useEffect(() => {
    if (currentPage === 'settings' && userProfile && !isAdmin) {
      setCurrentPage('dashboard');
    }
  }, [currentPage, userProfile, isAdmin]);

  const handleNavigate = (page: PageType) => {
    if (page === 'settings' && !isAdmin) return;
    setCurrentPage(page);
  };

  const handleRoomSelect = (roomId: string) => {
    setSelectedRoomId(roomId);
    setCurrentPage('room-details');
  };

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600">
      Chargement…
      </div>
    );
  }

  if (!authUser || !userProfile) {
    return <LoginPage />;
  }

  if (userProfile.mustChangePassword) {
    return (
      <FirstLoginPasswordChange
        displayName={userProfile.name}
        email={authUser.email ?? userProfile.email}
        onSuccess={async () => {
          const next = await fetchUserProfile(authUser.uid);
          if (next) {
            setUserProfile(next);
          }
        }}
      />
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar currentPage={currentPage} onNavigate={handleNavigate} isAdmin={isAdmin} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopNav
          displayName={userProfile.name}
          email={authUser.email ?? ''}
          role={userProfile.role}
          isAdmin={isAdmin}
          currentUserUid={authUser.uid}
          onOpenAlertsPage={() => setCurrentPage('alerts')}
        />
        <main className="flex-1 overflow-y-auto p-6">
          {currentPage === 'dashboard' && <MainDashboard onNavigate={handleNavigate} />}
          {currentPage === 'rooms' && <RoomsManagement onRoomSelect={handleRoomSelect} isAdmin={isAdmin} />}
          {currentPage === 'room-details' && (
            <RoomDetails
              roomId={selectedRoomId}
              onBack={() => setCurrentPage('rooms')}
              isAdmin={isAdmin}
              onAddRoom={() => setCurrentPage('rooms')}
            />
          )}
          {currentPage === 'alerts' && (
            <AlertsNotifications
              isAdmin={isAdmin}
              currentUserName={userProfile.name}
              currentUserId={authUser.uid}
            />
          )}
          {currentPage === 'settings' && isAdmin && <AdminSettings />}
        </main>
      </div>
    </div>
  );
}

export default App;
