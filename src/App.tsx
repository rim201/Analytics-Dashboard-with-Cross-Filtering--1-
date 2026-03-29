import { useState } from 'react';
import LoginPage from './components/LoginPage';
import MainDashboard from './components/MainDashboard';
import RoomsManagement from './components/RoomsManagement';
import RoomDetails from './components/RoomDetails';
import EnergyAnalytics from './components/EnergyAnalytics';
import AlertsNotifications from './components/AlertsNotifications';
import AdminSettings from './components/AdminSettings';
import Sidebar from './components/Sidebar';
import TopNav from './components/TopNav';

export type PageType = 
  | 'login' 
  | 'dashboard' 
  | 'rooms' 
  | 'room-details' 
  | 'energy' 
  | 'alerts' 
  | 'settings';

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('login');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const handleLogin = () => {
    setIsAuthenticated(true);
    setCurrentPage('dashboard');
  };

  const handleNavigate = (page: PageType) => {
    setCurrentPage(page);
  };

  const handleRoomSelect = (roomId: string) => {
    setSelectedRoomId(roomId);
    setCurrentPage('room-details');
  };

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar currentPage={currentPage} onNavigate={handleNavigate} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-6">
          {currentPage === 'dashboard' && <MainDashboard onNavigate={handleNavigate} />}
          {currentPage === 'rooms' && <RoomsManagement onRoomSelect={handleRoomSelect} />}
          {currentPage === 'room-details' && <RoomDetails roomId={selectedRoomId} onBack={() => setCurrentPage('rooms')} />}
          {currentPage === 'energy' && <EnergyAnalytics />}
          {currentPage === 'alerts' && <AlertsNotifications />}
          {currentPage === 'settings' && <AdminSettings />}
        </main>
      </div>
    </div>
  );
}

export default App;
