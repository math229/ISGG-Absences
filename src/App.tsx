import React, { useState, useEffect } from 'react';
import { storage } from './lib/storage';
import { User } from './types';
import { ToastProvider } from './components/common/Toast';
import { LoginPage } from './components/auth/LoginPage';
import { Sidebar, NavView } from './components/common/Sidebar';
import { Header } from './components/common/Header';
import { DashboardView } from './components/dashboard/DashboardView';
import { NewAbsenceView } from './components/absences/NewAbsenceView';
import { HistoryView } from './components/absences/HistoryView';
import { StudentsView } from './components/students/StudentsView';
import { StatisticsView } from './components/statistics/StatisticsView';
import { ReportsView } from './components/reports/ReportsView';
import { SettingsView } from './components/settings/SettingsView';
import { AdminView } from './components/admin/AdminView';
import { StudentProfileModal } from './components/students/StudentProfileModal';
import { 
  LayoutDashboard, 
  PlusCircle, 
  History, 
  Users, 
  MoreHorizontal 
} from 'lucide-react';

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
      <ToastProvider>
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-[#F8F9FA] text-[#0F172A] flex flex-col lg:flex-row font-sans">
        {/* Sidebar */}
        <Sidebar
          currentView={currentView}
          onNavigate={(view) => setCurrentView(view)}
          userRole={currentUser.role}
          isOpenMobile={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
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
          </main>
        </div>

        {/* Mobile Bottom Navigation Bar */}
        <nav 
          aria-label="Navigation mobile"
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] px-2 py-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        >
          <div className="grid grid-cols-5 gap-1 items-center max-w-md mx-auto">
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`flex flex-col items-center justify-center py-1 rounded-xl transition-colors min-h-[44px] ${
                currentView === 'dashboard' ? 'text-[#EA580C] font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutDashboard className="w-5 h-5" />
              <span className="text-[10px] mt-0.5 tracking-tight">Accueil</span>
            </button>

            <button
              onClick={() => setCurrentView('new-absence')}
              className={`flex flex-col items-center justify-center py-1 rounded-xl transition-colors min-h-[44px] ${
                currentView === 'new-absence' ? 'text-[#EA580C] font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className={`p-1 rounded-full ${currentView === 'new-absence' ? 'bg-orange-100' : ''}`}>
                <PlusCircle className="w-5 h-5 text-[#EA580C]" />
              </div>
              <span className="text-[10px] tracking-tight">Saisie</span>
            </button>

            <button
              onClick={() => setCurrentView('history')}
              className={`flex flex-col items-center justify-center py-1 rounded-xl transition-colors min-h-[44px] ${
                currentView === 'history' ? 'text-[#EA580C] font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <History className="w-5 h-5" />
              <span className="text-[10px] mt-0.5 tracking-tight">Historique</span>
            </button>

            <button
              onClick={() => setCurrentView('students')}
              className={`flex flex-col items-center justify-center py-1 rounded-xl transition-colors min-h-[44px] ${
                currentView === 'students' ? 'text-[#EA580C] font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users className="w-5 h-5" />
              <span className="text-[10px] mt-0.5 tracking-tight">Étudiants</span>
            </button>

            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex flex-col items-center justify-center py-1 rounded-xl transition-colors min-h-[44px] text-slate-500 hover:text-slate-800"
              aria-label="Plus d'options de navigation"
            >
              <MoreHorizontal className="w-5 h-5" />
              <span className="text-[10px] mt-0.5 tracking-tight">Menu</span>
            </button>
          </div>
        </nav>

        {/* Global Student Profile Modal */}
        {activeStudentModalId && (
          <StudentProfileModal
            studentId={activeStudentModalId}
            onClose={() => setActiveStudentModalId(null)}
          />
        )}
      </div>
    </ToastProvider>
  );
}
