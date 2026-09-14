import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastData {
  id: string;
  type: 'success-absence' | 'success' | 'error' | 'info';
  title?: string;
  studentName?: string;
  subjectName?: string;
  dateStr?: string;
  timeStr?: string;
  annualCount?: number;
  message?: string;
}

interface ToastContextType {
  showAbsenceToast: (data: {
    studentName: string;
    subjectName: string;
    dateStr: string;
    timeStr: string;
    annualCount: number;
  }) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info', title?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showAbsenceToast = useCallback(
    (data: {
      studentName: string;
      subjectName: string;
      dateStr: string;
      timeStr: string;
      annualCount: number;
    }) => {
      const id = `toast-${Date.now()}`;
      const newToast: ToastData = {
        id,
        type: 'success-absence',
        title: 'Absence enregistrée',
        studentName: data.studentName,
        subjectName: data.subjectName,
        dateStr: data.dateStr,
        timeStr: data.timeStr,
        annualCount: data.annualCount,
      };

      setToasts(prev => [newToast, ...prev.slice(0, 2)]);

      setTimeout(() => {
        removeToast(id);
      }, 5500);
    },
    [removeToast]
  );

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'success', title?: string) => {
      const id = `toast-${Date.now()}`;
      const newToast: ToastData = {
        id,
        type,
        title: title || (type === 'success' ? 'Opération réussie' : type === 'error' ? 'Erreur' : 'Information'),
        message,
      };

      setToasts(prev => [newToast, ...prev.slice(0, 2)]);

      setTimeout(() => {
        removeToast(id);
      }, 4500);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ showAbsenceToast, showToast }}>
      {children}
      {/* Toast Render Portal */}
      <div 
        className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 pointer-events-none max-w-sm w-full"
        id="toast-container"
        role="region"
        aria-label="Notifications du système"
        aria-live="polite"
        aria-atomic="true"
      >
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              role="status"
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.9 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="pointer-events-auto bg-white rounded-xl shadow-2xl border border-slate-200/90 overflow-hidden"
            >
              {toast.type === 'success-absence' ? (
                <div className="p-4 relative">
                  {/* Top Status Banner */}
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      </div>
                      <span>Absence enregistrée</span>
                    </div>
                    <button
                      onClick={() => removeToast(toast.id)}
                      className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                      aria-label="Fermer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Student & Subject info */}
                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-900 text-base">
                      {toast.studentName}
                    </h4>
                    <p className="text-xs font-semibold text-[#EA580C]">
                      {toast.subjectName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {toast.dateStr} • {toast.timeStr}
                    </p>
                  </div>

                  {/* Total annual counter badge */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">Total annuel :</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-orange-50 text-[#EA580C] border border-orange-200/60">
                      {toast.annualCount} {toast.annualCount === 1 ? 'absence' : 'absences'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {toast.type === 'success' && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    )}
                    {toast.type === 'error' && (
                      <AlertCircle className="w-5 h-5 text-rose-600" />
                    )}
                    {toast.type === 'info' && (
                      <Info className="w-5 h-5 text-blue-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    {toast.title && (
                      <h5 className="font-semibold text-slate-900 text-sm">{toast.title}</h5>
                    )}
                    <p className="text-xs text-slate-600 mt-0.5">{toast.message}</p>
                  </div>
                  <button
                    onClick={() => removeToast(toast.id)}
                    className="text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Progress bar */}
              <div className="h-1 bg-slate-100 w-full overflow-hidden">
                <motion.div
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: toast.type === 'success-absence' ? 5.5 : 4.5, ease: 'linear' }}
                  className={`h-full ${toast.type === 'error' ? 'bg-rose-500' : 'bg-[#EA580C]'}`}
                />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};
