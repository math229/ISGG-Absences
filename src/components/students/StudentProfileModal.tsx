import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  BookOpen, 
  GraduationCap, 
  Building, 
  Mail, 
  Phone, 
  AlertTriangle, 
  Printer,
  ShieldCheck,
  CheckCircle
} from 'lucide-react';
import { storage, formatFrenchDate } from '../../lib/storage';
import { StudentWithStats, Subject } from '../../types';

interface StudentProfileModalProps {
  studentId: string | null;
  onClose: () => void;
}

export const StudentProfileModal: React.FC<StudentProfileModalProps> = ({ studentId, onClose }) => {
  const [student, setStudent] = useState<StudentWithStats | null>(() => studentId ? storage.getStudentWithStats(studentId) || null : null);
  const [subjects, setSubjects] = useState<Subject[]>(() => storage.getAllSubjects());

  useEffect(() => {
    const update = () => {
      if (studentId) {
        setStudent(storage.getStudentWithStats(studentId) || null);
      }
      setSubjects(storage.getAllSubjects());
    };
    update();
    const unsub = storage.subscribe(update);
    return () => unsub();
  }, [studentId]);

  // Helper to accurately resolve an absence's subject without arbitrary overwriting
  const getSubjectForAbsence = (abs: { subjectId: string; startTime?: string; absenceTime?: string; className?: string }): Subject | undefined => {
    let sub = subjects.find(s => s.id === abs.subjectId);
    if (sub) return sub;

    // Academic resolution for ISGG SIL2 sessions
    if ((abs.startTime === '08:00' || abs.absenceTime?.startsWith('08')) && (abs.className?.includes('SIL2') || student?.levelId === 'lvl-l2')) {
      const ceo = subjects.find(s => s.id === 'sub-l2-communication-ecrite-2');
      if (ceo) return ceo;
    }
    if ((abs.startTime === '13:00' || abs.absenceTime?.startsWith('13')) && (abs.className?.includes('SIL2') || student?.levelId === 'lvl-l2')) {
      const alg = subjects.find(s => s.id === 'sub-l2-algebre-lineaire');
      if (alg) return alg;
    }

    return undefined;
  };

  // Breakdown by subject
  const subjectBreakdown = useMemo(() => {
    if (!student) return [];
    const counts: Record<string, { count: number; justifiedCount: number; name: string; code: string }> = {};

    student.recentAbsences?.forEach(a => {
      const sub = getSubjectForAbsence(a);
      const targetId = sub ? sub.id : a.subjectId;
      const targetName = sub ? sub.name : 'Matière spécifique';
      const targetCode = sub ? sub.code : '';

      if (!counts[targetId]) {
        counts[targetId] = { count: 0, justifiedCount: 0, name: targetName, code: targetCode };
      }
      if (!a.justified) {
        counts[targetId].count += 1;
      } else {
        counts[targetId].justifiedCount += 1;
      }
    });

    return Object.entries(counts).map(([subId, data]) => ({
      id: subId,
      name: data.name,
      code: data.code,
      count: data.count,
      justifiedCount: data.justifiedCount,
    })).sort((a, b) => b.count - a.count);
  }, [student, subjects]);

  const handleToggleAbsenceJustified = (absenceId: string) => {
    storage.toggleAbsenceJustified(absenceId);
  };

  if (!student) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-2xl w-full max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 pb-[env(safe-area-inset-bottom)] sm:pb-0 animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0">
        {/* Mobile Drag Indicator */}
        <div className="sm:hidden pt-2 pb-1 bg-slate-900 flex justify-center">
          <div className="w-10 h-1 bg-slate-600 rounded-full" />
        </div>

        {/* Modal Header */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-start justify-between relative">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-[#EA580C] text-white flex items-center justify-center text-xl sm:text-2xl font-black shadow-lg border-2 border-white/20 flex-shrink-0">
              {student.lastName.slice(0, 1)}
              {student.firstName.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-orange-400">
                  Dossier étudiant
                </span>
                <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full font-mono text-slate-300">
                  {student.matricule}
                </span>
              </div>
              <h2 className="text-lg sm:text-2xl font-black tracking-tight mt-0.5 truncate">
                {student.lastName} {student.firstName}
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-300 flex items-center gap-1.5 sm:gap-2 mt-0.5 truncate">
                <span>{student.programName}</span>
                <span>•</span>
                <span>{student.levelName}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors shrink-0 ml-2 cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 sm:space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            <div className="p-3.5 sm:p-4 rounded-2xl bg-orange-50/70 border border-orange-200/60">
              <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
                Absences non justifiées
              </span>
              <p className="text-xl sm:text-2xl font-black text-[#EA580C] mt-1">
                {student.annualAbsenceCount} {student.annualAbsenceCount <= 1 ? 'absence' : 'absences'}
              </p>
              <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">
                {(student.justifiedAbsenceCount ?? 0) > 0 
                  ? `+ ${student.justifiedAbsenceCount} absence${(student.justifiedAbsenceCount ?? 0) > 1 ? 's' : ''} justifiée${(student.justifiedAbsenceCount ?? 0) > 1 ? 's' : ''}`
                  : '0 absence justifiée'}
              </p>
            </div>

            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
                Statut assiduité
              </span>
              <p className={`text-xs sm:text-sm font-bold mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${
                student.annualAbsenceCount > 6
                  ? 'bg-rose-100 text-rose-700'
                  : student.annualAbsenceCount > 3
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}>
                {student.annualAbsenceCount > 6 ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Seuil critique dépassé
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Situation régulière
                  </>
                )}
              </p>
            </div>

            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
                Matières affectées
              </span>
              <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                {subjectBreakdown.length}
              </p>
              <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">cours impactés</p>
            </div>
          </div>

          {/* Breakdown by subject */}
          {subjectBreakdown.length > 0 && (
            <div>
              <h4 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Répartition des absences par matière
              </h4>
              <div className="space-y-1.5">
                {subjectBreakdown.map(item => (
                  <div key={item.id} className="p-2.5 sm:p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <BookOpen className="w-4 h-4 text-[#EA580C] shrink-0" />
                      <span className="font-bold text-slate-800 truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="px-2 py-0.5 rounded bg-orange-100 text-[#EA580C] font-bold">
                        {item.count} absence{item.count > 1 ? 's' : ''}
                      </span>
                      {item.justifiedCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold text-[10px] border border-emerald-200/60">
                          {item.justifiedCount} justifiée{item.justifiedCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chronological Absences History */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
                Historique chronologique des absences
              </h4>
              <span className="text-[11px] sm:text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                {student.recentAbsences?.length || 0} enregistrement{(student.recentAbsences?.length || 0) > 1 ? 's' : ''}
              </span>
            </div>

            {student.recentAbsences && student.recentAbsences.length > 0 ? (
              <div className="space-y-2 max-h-60 sm:max-h-72 overflow-y-auto pr-1">
                {student.recentAbsences.map(abs => {
                  const sub = getSubjectForAbsence(abs);
                  return (
                    <div 
                      key={abs.id}
                      className="p-3 sm:p-3.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50/70 transition-colors flex items-center justify-between text-xs gap-2 sm:gap-3 shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <div className="text-[#EA580C] bg-orange-50 p-2 sm:p-2.5 rounded-xl flex-shrink-0 border border-orange-100">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate text-xs">{sub ? sub.name : 'Matière spécifique'}</p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] sm:text-[11px] text-slate-400">
                            <span>Saisie par {abs.recordedBy}</span>
                            <span>•</span>
                            <button
                              type="button"
                              onClick={() => handleToggleAbsenceJustified(abs.id)}
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full cursor-pointer transition-colors ${
                                abs.justified
                                  ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                                  : 'text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200'
                              }`}
                              title={abs.justified ? 'Cliquer pour annuler la justification' : 'Cliquer pour marquer comme justifiée'}
                            >
                              <CheckCircle className="w-3 h-3" />
                              <span>{abs.justified ? 'Justifiée' : 'Non justifiée'}</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <span className="font-bold text-slate-800 block text-xs">{formatFrenchDate(abs.absenceDate)}</span>
                        <span className="text-[10px] sm:text-[11px] text-slate-400 font-mono">{abs.absenceTime}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center bg-slate-50 rounded-xl text-slate-400 text-xs">
                Aucune absence enregistrée pour cet étudiant.
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <button
            onClick={handlePrint}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center justify-center gap-2 transition-colors cursor-pointer min-h-[44px] sm:min-h-0"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimer la fiche d&apos;assiduité</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer min-h-[44px] sm:min-h-0 text-center"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
