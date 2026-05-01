import { LayoutDashboard, DoorOpen, Radio, Siren, Settings, Zap, X } from 'lucide-react';
import { PageType } from '../App';
import { useLang } from '../i18n/LanguageContext';

interface SidebarProps {
  currentPage: PageType;
  onNavigate: (page: PageType) => void;
  isAdmin?: boolean;
  canAccessAlerts?: boolean;
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({
  currentPage,
  onNavigate,
  isAdmin = false,
  canAccessAlerts = false,
  open = false,
  onClose,
}: SidebarProps) {
  const { t } = useLang();

  type NavItem = { id: PageType; label: string; icon: typeof LayoutDashboard; adminOnly: boolean; staffAlertsOnly?: boolean };
  const allNavItems: NavItem[] = [
    { id: 'dashboard', label: t.sidebar.navDashboard, icon: LayoutDashboard, adminOnly: false },
    { id: 'rooms', label: t.sidebar.navRooms, icon: DoorOpen, adminOnly: false },
    { id: 'room-details', label: t.sidebar.navMonitoring, icon: Radio, adminOnly: false },
    { id: 'alerts', label: t.sidebar.navAlerts, icon: Siren, adminOnly: false, staffAlertsOnly: true },
    { id: 'settings', label: t.sidebar.navSettings, icon: Settings, adminOnly: true },
  ];

  const navItems = allNavItems.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.staffAlertsOnly && !canAccessAlerts) return false;
    return true;
  });

  const handleNavigate = (page: PageType) => {
    onNavigate(page);
    onClose?.();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          aria-hidden
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full'}
          md:static md:translate-x-0 md:z-auto md:transition-none
        `}
        style={{ background: 'var(--sidebar-bg)', borderRight: '1px solid var(--sidebar-border)' }}
      >
        {/* Brand / Logo */}
        <div className="px-5 py-5 border-b" style={{ borderColor: 'var(--sidebar-border)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 sidebar-logo-glow"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
              >
                <Zap className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold leading-tight" style={{ color: 'var(--gray-900)' }}>
                  SmartRoom
                </p>
                <p className="text-xs" style={{ color: 'var(--gray-400)' }}>
                  {t.sidebar.aiManager}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="md:hidden p-1.5 rounded-lg transition"
              style={{ color: 'var(--gray-400)' }}
              aria-label={t.sidebar.closeMenu}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Nav section label */}
        <div style={{ padding: '1.25rem 1.25rem 0.25rem' }}>
          <p
            className="font-semibold uppercase tracking-wider"
            style={{ color: 'var(--gray-400)', fontSize: 10 }}
          >
            {t.sidebar.navigation}
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 pb-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm sidebar-nav-item ${
                  isActive ? 'sidebar-nav-active font-semibold' : 'font-medium'
                }`}
                style={!isActive ? { color: 'var(--gray-600)' } : undefined}
              >
                <Icon
                  className="shrink-0"
                  style={{
                    width: 18,
                    height: 18,
                    ...(isActive ? { color: 'var(--sidebar-nav-active-text)' } : {}),
                  }}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer – AI status */}
        <div className="p-4 border-t" style={{ borderColor: 'var(--sidebar-border)' }}>
          <div className="ai-status-card">
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="w-2 h-2 rounded-full shrink-0 animate-pulse"
                style={{ background: '#10b981', boxShadow: '0 0 0 3px rgba(16,185,129,0.2)' }}
              />
              <span className="text-xs font-semibold" style={{ color: 'var(--gray-800)' }}>
                {t.sidebar.aiStatus}
              </span>
            </div>
            <p className="text-xs" style={{ color: 'var(--gray-500)' }}>
              {t.sidebar.allSystemsOperational}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
