import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  History, 
  Users, 
  BarChart2, 
  FileText, 
  Settings,
  Shield,
  X,
  UserCheck,
  GraduationCap,
  CalendarDays,
  LogOut,
  Sparkles
} from 'lucide-react';
import { Logo, ArchitecturalFooterEmblem } from './Logo';
import { UserRole, User } from '../../types';
import { storage } from '../../lib/storage';

export type NavView = 
  | 'dashboard'
  | 'new-absence'
  | 'history'
  | 'students'
  | 'statistics'
  | 'reports'
  | 'settings'
  | 'admin';

interface SidebarProps {
  currentView: NavView;
  onNavigate: (view: NavView) => void;
  userRole: UserRole;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  userRole,
  isOpenMobile = false,
  onCloseMobile,
  onLogout,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(storage.getCurrentUser());
  const schoolYear = storage.getSchoolYear();

  useEffect(() => {
    const update = () => setCurrentUser(storage.getCurrentUser());
    const unsub = storage.subscribe(update);
    return () => unsub();
  }, []);

  const navGroups = [
    {
      title: 'Gestion Académique',
      items: [
        {
          id: 'dashboard' as NavView,
          label: 'Tableau de bord',
          icon: LayoutDashboard,
          description: 'Vue générale et métriques',
        },
        {
          id: 'history' as NavView,
          label: 'Historique des absences',
          icon: History,
          description: 'Registre et justifications',
        },
        {
          id: 'students' as NavView,
          label: 'Répertoire étudiants',
          icon: Users,
          description: 'Fiches et suivi d\'assiduité',
        },
      ],
    },
    {
      title: 'Analyses & Justificatifs',
      items: [
        {
          id: 'statistics' as NavView,
          label: 'Statistiques',
          icon: BarChart2,
          description: 'Graphiques et indicateurs',
        },
        {
          id: 'reports' as NavView,
          label: 'Rapports & Alertes',
          icon: FileText,
          description: 'Exports et fiches de suivi',
        },
      ],
    },
  ];

  // Desktop simple nav items
  const desktopNavItems = [
    { id: 'dashboard' as NavView, label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'new-absence' as NavView, label: 'Nouvelle absence', icon: PlusCircle, badge: 'Saisie' },
    { id: 'history' as NavView, label: 'Historique des absences', icon: History },
    { id: 'students' as NavView, label: 'Étudiants', icon: Users },
    { id: 'statistics' as NavView, label: 'Statistiques', icon: BarChart2 },
    { id: 'reports' as NavView, label: 'Rapports', icon: FileText },
    { id: 'settings' as NavView, label: 'Paramètres', icon: Settings },
  ];

  // Desktop Content
  const desktopContent = (
    <div className="h-full flex flex-col justify-between bg-[#0F172A] text-slate-200 select-none">
      <div>
        <div className="p-5 flex items-center justify-between border-b border-slate-800/80">
          <Logo variant="light" size="md" />
        </div>

        {/* Primary Desktop Navigation Menu */}
        <nav className="p-3 space-y-1.5 mt-2" aria-label="Menu principal">
          {desktopNavItems.map(item => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-[#EA580C] text-white shadow-lg shadow-orange-950/40 font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.id === 'new-absence' && !isActive && (
                  <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-orange-500/20 text-[#F97316] border border-orange-500/30">
                    Saisie
                  </span>
                )}
              </button>
            );
          })}

          {/* Admin link (if user is Admin) */}
          {userRole === 'ADMIN' && (
            <div className="pt-2 mt-2 border-t border-slate-800/80">
              <button
                id="nav-admin"
                onClick={() => onNavigate('admin')}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
                  currentView === 'admin'
                    ? 'bg-slate-800 text-white border border-slate-700 shadow-md font-bold'
                    : 'text-amber-300/90 hover:text-amber-200 hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-amber-400" />
                  <span>Administration</span>
                </div>
                <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Directeur
                </span>
              </button>
            </div>
          )}
        </nav>
      </div>

      <div>
        <ArchitecturalFooterEmblem />
      </div>
    </div>
  );

  return (
    <aside className="hidden lg:block w-72 h-screen sticky top-0 flex-shrink-0 z-40 border-r border-slate-800 shadow-2xl">
      {desktopContent}
    </aside>
  );
};

