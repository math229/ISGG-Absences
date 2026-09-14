import React, { useState, useRef, useEffect } from 'react';
import { 
  Bell, 
  ChevronDown, 
  Shield, 
  UserCheck, 
  LogOut, 
  Settings, 
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Info,
  Check,
  Cloud,
  CloudOff,
  RefreshCw
} from 'lucide-react';
import { User, NotificationItem } from '../../types';
import { storage, SyncStatus } from '../../lib/storage';

interface HeaderProps {
  currentUser: User;
  onLogout: () => void;
  onNavigate: (view: string) => void;
  onOpenMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  currentUser, 
  onLogout, 
  onNavigate,
  onOpenMobileMenu 
}) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => storage.getNotifications());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => storage.getSyncStatus());

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Sync notifications and syncStatus with storage
  useEffect(() => {
    const update = () => {
      setNotifications([...storage.getNotifications()]);
      setSyncStatus(storage.getSyncStatus());
    };
    update();
    const unsubscribe = storage.subscribe(update);
    return () => unsubscribe();
  }, []);

  // Click outside and Escape handler for both popovers
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (notificationsOpen && notifRef.current && !notifRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
      if (userMenuOpen && userMenuRef.current && !userMenuRef.current.contains(target)) {
        setUserMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNotificationsOpen(false);
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [notificationsOpen, userMenuOpen]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllAsRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    storage.markAllNotificationsAsRead();
  };

  const handleNotificationClick = (item: NotificationItem) => {
    storage.markNotificationAsRead(item.id);
    setNotificationsOpen(false);
    if (item.id === 'notif-2' || item.type === 'warning') {
      onNavigate('students');
    } else if (item.id === 'notif-1' || item.type === 'info') {
      onNavigate('reports');
    } else {
      onNavigate('dashboard');
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-3 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Left: Brand Identity & Academic Year Indicator */}
      <div className="flex items-center gap-2.5 sm:gap-4 text-xs">
        <div className="flex items-center gap-2 lg:hidden">
          <span className="font-extrabold text-sm tracking-tight text-slate-900 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#EA580C]" />
            ISGG Absences
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-200/70 px-3 py-1.5 rounded-lg text-slate-700">
          <Calendar className="w-3.5 h-3.5 text-[#EA580C]" />
          <span className="font-semibold text-slate-800">Année académique :</span>
          <span className="text-[#EA580C] font-bold">{storage.getSchoolYear()?.name || '2026-2027'}</span>
        </div>
        
        {/* Real-time Cloud Sync Status Pill */}
        <div className="flex items-center">
          {syncStatus === 'connected' && (
            <div 
              title="Connecté à Firestore Cloud : synchronisation multi-postes en temps réel"
              className="flex items-center gap-1.5 bg-emerald-50/90 text-emerald-700 border border-emerald-200/80 px-2.5 py-1 rounded-full text-xs font-semibold shadow-xs"
            >
              <Cloud className="w-3.5 h-3.5 text-emerald-600" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="hidden sm:inline">Cloud en direct</span>
            </div>
          )}
          {syncStatus === 'syncing' && (
            <div 
              title="Synchronisation des données avec Firestore Cloud..."
              className="flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full text-xs font-semibold shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-600 animate-spin" />
              <span className="hidden sm:inline">Synchronisation...</span>
            </div>
          )}
          {(syncStatus === 'offline' || syncStatus === 'error') && (
            <div 
              title="Mode hors-ligne local. Vos données sont enregistrées localement et se synchroniseront au retour du réseau."
              className="flex items-center gap-1.5 bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-full text-xs font-medium shadow-xs"
            >
              <CloudOff className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Mode local</span>
            </div>
          )}
        </div>
      </div>

      {/* Right: Notifications & User profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Notifications Popover */}
        <div className="relative" ref={notifRef}>
          <button
            id="notifications-button"
            onClick={() => {
              setNotificationsOpen(!notificationsOpen);
              setUserMenuOpen(false);
            }}
            className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center cursor-pointer"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-[#EA580C] text-white text-[10px] font-extrabold rounded-full flex items-center justify-center ring-2 ring-white shadow-xs">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Backdrop on mobile */}
          {notificationsOpen && (
            <div 
              className="fixed inset-0 bg-slate-900/30 backdrop-blur-2xs z-40 sm:hidden"
              onClick={() => setNotificationsOpen(false)}
            />
          )}

          {notificationsOpen && (
            <div 
              className="fixed right-3 left-3 top-16 sm:left-auto sm:right-0 sm:absolute sm:mt-2 w-auto sm:w-96 max-w-[calc(100vw-24px)] bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2"
              id="notifications-dropdown"
            >
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm">Notifications</span>
                  {unreadCount > 0 ? (
                    <span className="bg-orange-100 text-[#EA580C] text-[11px] font-extrabold px-2 py-0.5 rounded-full">
                      {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="bg-slate-100 text-slate-500 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                      À jour
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="text-xs text-[#EA580C] hover:text-[#C2410C] hover:underline font-semibold cursor-pointer"
                  >
                    Tout marquer comme lu
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    Aucune notification pour le moment
                  </div>
                ) : (
                  notifications.map(n => (
                    <div 
                      key={n.id} 
                      onClick={() => handleNotificationClick(n)}
                      className={`p-3.5 hover:bg-slate-50 transition-colors flex gap-3 cursor-pointer text-left ${!n.read ? 'bg-orange-50/50' : ''}`}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {n.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                        {n.type === 'info' && <Info className="w-4 h-4 text-blue-500" />}
                        {n.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-bold text-slate-800 truncate">{n.title}</p>
                          {!n.read && (
                            <span className="w-2 h-2 rounded-full bg-[#EA580C] flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">{n.description}</p>
                        <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                          <span>{n.time}</span>
                          <span className="text-[#EA580C] font-semibold hover:underline">
                            {n.read ? 'Consulter' : 'Ouvrir'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-2 border-t border-slate-100 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setNotificationsOpen(false);
                    onNavigate('reports');
                  }}
                  className="text-xs font-bold text-[#EA580C] hover:underline cursor-pointer py-1 block w-full"
                >
                  Voir tous les rapports et alertes
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Pill / Dropdown (exactly matching top-right of mockups) */}
        <div className="relative" ref={userMenuRef}>
          <button
            id="user-profile-menu-button"
            onClick={() => {
              setUserMenuOpen(!userMenuOpen);
              setNotificationsOpen(false);
            }}
            className="flex items-center gap-2 sm:gap-3 p-1.5 sm:pr-2.5 rounded-xl hover:bg-slate-100 transition-all border border-slate-200/80 min-h-[40px] cursor-pointer"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden border border-slate-300 bg-slate-200 flex-shrink-0">
              {currentUser.avatarUrl ? (
                <img 
                  src={currentUser.avatarUrl} 
                  alt={currentUser.name} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-[#EA580C] text-white font-bold flex items-center justify-center text-xs">
                  {currentUser.name.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div className="text-left hidden sm:block leading-tight">
              <p className="font-bold text-xs text-slate-900">{currentUser.name}</p>
              <p className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                {currentUser.role === 'ADMIN' ? (
                  <span className="text-emerald-700 font-semibold flex items-center gap-0.5">
                    <Shield className="w-2.5 h-2.5" /> Administrateur
                  </span>
                ) : (
                  <span className="text-slate-600 flex items-center gap-0.5">
                    <UserCheck className="w-2.5 h-2.5 text-[#EA580C]" /> Surveillant
                  </span>
                )}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5 sm:ml-1" />
          </button>

          {/* Backdrop on mobile */}
          {userMenuOpen && (
            <div 
              className="fixed inset-0 bg-slate-900/30 backdrop-blur-2xs z-40 sm:hidden"
              onClick={() => setUserMenuOpen(false)}
            />
          )}

          {/* User Profile Dropdown Menu */}
          {userMenuOpen && (
            <div 
              className="fixed right-3 left-3 top-16 sm:left-auto sm:right-0 sm:absolute sm:mt-2 w-auto sm:w-64 max-w-[calc(100vw-24px)] bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in"
              id="user-dropdown"
            >
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="font-bold text-sm text-slate-900">{currentUser.name}</p>
                <p className="text-xs text-slate-500">{currentUser.email}</p>
                <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-[#EA580C]">
                  {currentUser.role} • {currentUser.title}
                </div>
              </div>

              {/* Actions du compte */}
              <div className="py-1">
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    onNavigate('settings');
                  }}
                  className="w-full text-left px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-400" />
                  <span>Paramètres de l&apos;application</span>
                </button>
              </div>

              {/* Logout */}
              <div className="pt-1 border-t border-slate-100">
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full text-left px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Se déconnecter
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
