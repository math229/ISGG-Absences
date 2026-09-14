import React, { useState, useEffect, lazy, Suspense } from 'react';
import { storage } from './lib/storage';
import { User } from './types';
import { ToastProvider } from './components/common/Toast';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { LoginPage } from './components/auth/LoginPage';
import { Sidebar, NavView } from './components/common/Sidebar';
import { Header } from './components/common/Header';
import { DashboardView } from './components/dashboard/DashboardView';
import { 
  LayoutDashboard, 
  PlusCircle, 
  History, 
  Users, 
  LayoutGrid,
  BarChart2,
  FileText,
  Shield,
  Settings
} from 'lucide-react';

// Code-split heavy views for optimal initial loading performance
const NewAbsenceView = lazy(() => import('./components/absences/NewAbsenceView').then(m => ({ default: m.NewAbsenceView })));
const HistoryView = lazy(() => import('./components/absences/HistoryView').then(m => ({ default: m.HistoryView })));
const StudentsView = lazy(() => import('./components/students/StudentsView').then(m => ({ default: m.StudentsView })));
const StatisticsView = lazy(() => import('./components/statistics/StatisticsView').then(m => ({ default: m.StatisticsView })));
const ReportsView = lazy(() => import('./components/reports/ReportsView').then(m => ({ default: m.ReportsView })));
const SettingsView = lazy(() => import('./components/settings/SettingsView').then(m => ({ default: m.SettingsView })));
const AdminView = lazy(() => import('./components/admin/AdminView').then(m => ({ default: m.AdminView })));
const StudentProfileModal = lazy(() => import('./components/students/StudentProfileModal').then(m => ({ default: m.StudentProfileModal })));

function ViewLoadingFallback() {
  return (
    <div className="flex items-center justify-center py-24 w-full">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-orange-200 border-t-[#EA580C] rounded-full animate-spin" />
        <span className="text-xs text-slate-500 font-medium">Chargement du module ISGG...</span>
      </div>
    </div>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(storage.getCurrentUser());
  const [currentView, setCurrentView] = useState<NavView>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeStudentModalId, setActiveStudentModalId] = useState<string | null>(null);

  // Sync user updates from storage
  useEffect(() => {
    const unsub = storage.subscribe(() => {
      setCurrentUser(storage.getCurrentUser());
    });
    return () => unsub();
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    storage.logout();
    setCurrentUser(null);
  };

  const handleViewStudent = (studentId: string) => {
    setActiveStudentModalId(studentId);
  };

  if (!currentUser) {
    return (
      <ErrorBoundary>
        <ToastProvider>
          <LoginPage onLoginSuccess={handleLoginSuccess} />
        </ToastProvider>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <ToastProvider>
        <div className="min-h-screen bg-[#F8F9FA] text-[#0F172A] flex flex-col lg:flex-row font-sans">
        {/* Sidebar */}
        <Sidebar
          currentView={currentView}
          onNavigate={(view) => setCurrentView(view)}
          userRole={currentUser.role}
          isOpenMobile={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
          onLogout={handleLogout}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header with integrated mobile menu toggle */}
          <Header
            currentUser={currentUser}
            onLogout={handleLogout}
            onNavigate={(v) => setCurrentView(v as NavView)}
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
          />

          {/* Dynamic View Router */}
          <main className="flex-1 p-3.5 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 lg:pb-8">
            <Suspense fallback={<ViewLoadingFallback />}>
              {currentView === 'dashboard' && (
                <DashboardView
                  onNavigateToNewAbsence={() => setCurrentView('new-absence')}
                  onNavigateToHistory={() => setCurrentView('history')}
                  onNavigateToStudent={handleViewStudent}
                />
              )}

              {currentView === 'new-absence' && (
                <NewAbsenceView
                  onViewStudentHistory={handleViewStudent}
                />
              )}

              {currentView === 'history' && (
                <HistoryView
                  onViewStudent={handleViewStudent}
                />
              )}

              {currentView === 'students' && (
                <StudentsView
                  onViewStudent={handleViewStudent}
                />
              )}

              {currentView === 'statistics' && (
                <StatisticsView />
              )}

              {currentView === 'reports' && (
                <ReportsView onNavigateToStudent={handleViewStudent} />
              )}

              {currentView === 'settings' && (
                <SettingsView />
              )}

              {currentView === 'admin' && (
                <AdminView currentUser={currentUser} />
              )}
            </Suspense>
          </main>
        </div>

        {/* Mobile Floating Secondary Menu Bar (Solution 3 : Bandeau déployable juste au-dessus) */}
        {mobileMenuOpen && (
          <>
            {/* Click-outside dismiss backdrop */}
            <div 
              className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px] lg:hidden transition-opacity animate-in fade-in duration-150"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />

            {/* Floating Icon Dock directly above the bottom bar */}
            <div className="fixed bottom-[70px] inset-x-3 max-w-sm mx-auto z-50 lg:hidden bg-slate-900/95 text-slate-100 backdrop-blur-md rounded-2xl p-2 shadow-2xl border border-slate-700/80 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className={`grid ${currentUser.role === 'ADMIN' ? 'grid-cols-4' : 'grid-cols-3'} gap-1.5 items-center text-center`}>
                <button
                  id="mobile-subnav-statistics"
                  onClick={() => {
                    setCurrentView('statistics');
                    setMobileMenuOpen(false);
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all active:scale-95 cursor-pointer ${
                    currentView === 'statistics'
                      ? 'bg-[#EA580C] text-white font-bold shadow-md shadow-orange-950/40'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <BarChart2 className="w-5 h-5 mb-1 text-amber-400" />
                  <span className="text-[11px] font-medium tracking-tight">Stats</span>
                </button>

                <button
                  id="mobile-subnav-reports"
                  onClick={() => {
                    setCurrentView('reports');
                    setMobileMenuOpen(false);
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all active:scale-95 cursor-pointer ${
                    currentView === 'reports'
                      ? 'bg-[#EA580C] text-white font-bold shadow-md shadow-orange-950/40'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <FileText className="w-5 h-5 mb-1 text-blue-400" />
                  <span className="text-[11px] font-medium tracking-tight">Rapports</span>
                </button>

                {currentUser.role === 'ADMIN' && (
                  <button
                    id="mobile-subnav-admin"
                    onClick={() => {
                      setCurrentView('admin');
                      setMobileMenuOpen(false);
                    }}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all active:scale-95 cursor-pointer ${
                      currentView === 'admin'
                        ? 'bg-[#EA580C] text-white font-bold shadow-md shadow-orange-950/40'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    <Shield className="w-5 h-5 mb-1 text-emerald-400" />
                    <span className="text-[11px] font-medium tracking-tight">Admin</span>
                  </button>
                )}

                <button
                  id="mobile-subnav-settings"
                  onClick={() => {
                    setCurrentView('settings');
                    setMobileMenuOpen(false);
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all active:scale-95 cursor-pointer ${
                    currentView === 'settings'
                      ? 'bg-[#EA580C] text-white font-bold shadow-md shadow-orange-950/40'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <Settings className="w-5 h-5 mb-1 text-slate-400" />
                  <span className="text-[11px] font-medium tracking-tight">Réglages</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* Mobile Bottom Navigation Bar */}
        <nav 
          aria-label="Navigation mobile"
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] px-2 py-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        >
          <div className="grid grid-cols-5 gap-1 items-center max-w-md mx-auto">
            <button
              onClick={() => {
                setCurrentView('dashboard');
                setMobileMenuOpen(false);
              }}
              className={`flex flex-col items-center justify-center py-1 rounded-xl transition-colors min-h-[44px] cursor-pointer ${
                currentView === 'dashboard' ? 'text-[#EA580C] font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutDashboard className="w-5 h-5" />
              <span className="text-[10px] mt-0.5 tracking-tight">Accueil</span>
            </button>

            <button
              onClick={() => {
                setCurrentView('new-absence');
                setMobileMenuOpen(false);
              }}
              className={`flex flex-col items-center justify-center py-1 rounded-xl transition-colors min-h-[44px] cursor-pointer ${
                currentView === 'new-absence' ? 'text-[#EA580C] font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className={`p-1 rounded-full ${currentView === 'new-absence' ? 'bg-orange-100' : ''}`}>
                <PlusCircle className="w-5 h-5 text-[#EA580C]" />
              </div>
              <span className="text-[10px] tracking-tight">Saisie</span>
            </button>

            <button
              onClick={() => {
                setCurrentView('history');
                setMobileMenuOpen(false);
              }}
              className={`flex flex-col items-center justify-center py-1 rounded-xl transition-colors min-h-[44px] cursor-pointer ${
                currentView === 'history' ? 'text-[#EA580C] font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <History className="w-5 h-5" />
              <span className="text-[10px] mt-0.5 tracking-tight">Historique</span>
            </button>

            <button
              onClick={() => {
                setCurrentView('students');
                setMobileMenuOpen(false);
              }}
              className={`flex flex-col items-center justify-center py-1 rounded-xl transition-colors min-h-[44px] cursor-pointer ${
                currentView === 'students' ? 'text-[#EA580C] font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users className="w-5 h-5" />
              <span className="text-[10px] mt-0.5 tracking-tight">Étudiants</span>
            </button>

            {(() => {
              const isSecondaryActive = ['statistics', 'reports', 'settings', 'admin'].includes(currentView);
              return (
                <button
                  id="mobile-nav-menu-btn"
                  onClick={() => setMobileMenuOpen(prev => !prev)}
                  className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all min-h-[44px] cursor-pointer ${
                    mobileMenuOpen || isSecondaryActive ? 'text-[#EA580C] font-bold' : 'text-slate-500 hover:text-slate-800'
                  }`}
                  aria-label="Plus d'options de navigation"
                >
                  <div className={`p-1 rounded-lg transition-colors ${mobileMenuOpen || isSecondaryActive ? 'bg-orange-100 text-[#EA580C]' : ''}`}>
                    <LayoutGrid className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] mt-0.5 tracking-tight font-medium">Menu</span>
                </button>
              );
            })()}
          </div>
        </nav>

        {/* Global Student Profile Modal */}
        {activeStudentModalId && (
          <Suspense fallback={null}>
            <StudentProfileModal
              studentId={activeStudentModalId}
              onClose={() => setActiveStudentModalId(null)}
            />
          </Suspense>
        )}
      </div>
    </ToastProvider>
  </ErrorBoundary>
  );
}
