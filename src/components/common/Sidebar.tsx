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
  ArrowRightLeft,
  GraduationCap,
  CalendarDays
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
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  userRole,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(storage.getCurrentUser());
  const schoolYear = storage.getSchoolYear();

  useEffect(() => {
    const update = () => setCurrentUser(storage.getCurrentUser());
    const unsub = storage.subscribe(update);
    return () => unsub();
  }, []);

  const handleRoleToggle = () => {
    if (!currentUser) return;
    const newRole = currentUser.role === 'ADMIN' ? 'SURVEILLANT' : 'ADMIN';
    storage.switchRole(newRole);
  };

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
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block w-72 h-screen sticky top-0 flex-shrink-0 z-40 border-r border-slate-800 shadow-2xl">
        {desktopContent}
      </aside>

      {/* Modern, Ergonomic Mobile Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={onCloseMobile}
          />
          
          {/* Drawer Panel */}
          <div className="fixed inset-y-0 left-0 w-[86vw] max-w-[340px] bg-[#0B1120] text-slate-100 shadow-2xl border-r border-slate-800/80 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-left duration-250 ease-out z-50">
            <div>
              {/* Mobile Header with prominent close button */}
              <div className="p-4 border-b border-slate-800/80 flex items-center justify-between bg-[#0F172A]">
                <Logo variant="light" size="sm" />
                <button
                  onClick={onCloseMobile}
                  className="w-11 h-11 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-slate-700/60"
                  aria-label="Fermer le menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mobile Profile Card with Quick Role Switch */}
              {currentUser && (
                <div className="p-4 bg-gradient-to-b from-[#0F172A] to-slate-900/60 border-b border-slate-800/60">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-[#EA580C] bg-slate-800 flex-shrink-0 flex items-center justify-center font-bold text-white shadow-md">
                      {currentUser.avatarUrl ? (
                        <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-full h-full object-cover" />
                      ) : (
                        currentUser.name.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{currentUser.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {currentUser.role === 'ADMIN' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            <Shield className="w-2.5 h-2.5" /> Administrateur
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-orange-500/20 text-[#F97316] border border-orange-500/30">
                            <UserCheck className="w-2.5 h-2.5" /> Surveillant
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick Role Switcher */}
                  <button
                    type="button"
                    onClick={handleRoleToggle}
                    className="mt-3 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 text-[#EA580C]" />
                    <span>Basculer en mode {currentUser.role === 'ADMIN' ? 'Surveillant' : 'Directeur / Admin'}</span>
                  </button>
                </div>
              )}

              {/* High-Impact Action: Nouvelle absence button */}
              <div className="p-3">
                <button
                  onClick={() => {
                    onNavigate('new-absence');
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-gradient-to-r from-[#EA580C] to-[#F97316] text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-orange-950/40 hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <PlusCircle className="w-5 h-5" />
                  <span>Saisir une absence</span>
                </button>
              </div>

              {/* Categorized Navigation for Mobile */}
              <div className="px-3 py-1 space-y-4">
                {navGroups.map((group, idx) => (
                  <div key={idx} className="space-y-1">
                    <p className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      {group.title}
                    </p>
                    <div className="space-y-1">
                      {group.items.map(item => {
                        const Icon = item.icon;
                        const isActive = currentView === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              onNavigate(item.id);
                              if (onCloseMobile) onCloseMobile();
                            }}
                            className={`w-full min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer text-left ${
                              isActive
                                ? 'bg-orange-600/90 text-white font-bold shadow-md'
                                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                              <span>{item.label}</span>
                            </div>
                            {isActive && (
                              <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Administration section if Admin */}
                {userRole === 'ADMIN' && (
                  <div className="space-y-1 pt-1">
                    <p className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-amber-400/80">
                      Direction & Administration
                    </p>
                    <button
                      onClick={() => {
                        onNavigate('admin');
                        if (onCloseMobile) onCloseMobile();
                      }}
                      className={`w-full min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer text-left ${
                        currentView === 'admin'
                          ? 'bg-amber-600 text-white font-bold'
                          : 'text-amber-300/90 hover:text-amber-200 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Shield className="w-5 h-5 text-amber-400 flex-shrink-0" />
                        <span>Administration</span>
                      </div>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Admin
                      </span>
                    </button>
                  </div>
                )}

                {/* Settings Item */}
                <div className="space-y-1 pt-1">
                  <p className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Configuration
                  </p>
                  <button
                    onClick={() => {
                      onNavigate('settings');
                      if (onCloseMobile) onCloseMobile();
                    }}
                    className={`w-full min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer text-left ${
                      currentView === 'settings'
                        ? 'bg-orange-600/90 text-white font-bold'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Settings className={`w-5 h-5 flex-shrink-0 ${currentView === 'settings' ? 'text-white' : 'text-slate-400'}`} />
                      <span>Paramètres de l'école</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile Footer */}
            <div className="p-4 border-t border-slate-800/80 bg-slate-900/80 mt-4 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5 font-medium">
                  <CalendarDays className="w-3.5 h-3.5 text-[#EA580C]" />
                  Année {schoolYear?.name || '2026-2027'}
                </span>
                <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700 font-mono">
                  v2.4
                </span>
              </div>
              <p className="text-[10px] text-slate-400 text-center font-serif italic pt-1">
                « Élite de Demain • Rigueur & Excellence »
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

