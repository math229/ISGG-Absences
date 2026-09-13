import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, 
  Filter, 
  Calendar as CalendarIcon, 
  MoreVertical, 
  User, 
  CheckCircle, 
  AlertCircle,
  Eye, 
  ChevronLeft, 
  ChevronRight,
  Download,
  BookOpen,
  ArrowUpDown,
  GraduationCap
} from 'lucide-react';
import { storage } from '../../lib/storage';
import { AbsenceWithDetails, Subject } from '../../types';
import { useToast } from '../common/Toast';

interface HistoryViewProps {
  onViewStudent: (studentId: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ onViewStudent }) => {
  const { showToast } = useToast();
  const [allAbsences, setAllAbsences] = useState<AbsenceWithDetails[]>([]);
  const programs = useMemo(() => storage.getPrograms(), []);
  const levels = useMemo(() => storage.getLevels(), []);
  const [subjects, setSubjects] = useState<Subject[]>(() => storage.getAllSubjects());

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('all');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unjustified' | 'justified'>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown menu on click outside or Escape
  useEffect(() => {
    if (!activeMenuId) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeMenuId]);

  // Available subjects filtered by program and level if chosen
  const availableSubjects = useMemo(() => {
    const filtered = subjects.filter(s => {
      if (selectedProgram !== 'all' && s.programId && s.programId !== selectedProgram) {
        return false;
      }
      if (selectedLevel !== 'all' && s.levelId && s.levelId !== selectedLevel) {
        return false;
      }
      return true;
    });
    return filtered.length > 0 ? filtered : subjects;
  }, [subjects, selectedProgram, selectedLevel]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Load and subscribe to absences
  useEffect(() => {
    const update = () => {
      setAllAbsences(storage.getAbsencesWithDetails());
      setSubjects(storage.getAllSubjects());
    };
    update();
    const unsubscribe = storage.subscribe(update);
    return () => unsubscribe();
  }, []);

  // Filtered list
  const filteredAbsences = useMemo(() => {
    return allAbsences.filter(item => {
      // Program filter
      if (selectedProgram !== 'all' && item.program.id !== selectedProgram) {
        return false;
      }

      // Level filter (Licence 1, 2, 3, Master 1, 2)
      if (selectedLevel !== 'all' && item.level.id !== selectedLevel) {
        return false;
      }

      // Subject filter
      if (selectedSubject !== 'all' && item.subject.id !== selectedSubject) {
        return false;
      }

      // Status filter
      if (statusFilter === 'unjustified' && item.justified) {
        return false;
      }
      if (statusFilter === 'justified' && !item.justified) {
        return false;
      }

      // Date filter
      if (dateFilter && item.absenceDate !== dateFilter) {
        return false;
      }

      // Search query (Student name, matricule)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const fullName = `${item.student.lastName} ${item.student.firstName}`.toLowerCase();
        const matricule = item.student.matricule.toLowerCase();
        const subjectName = item.subject.name.toLowerCase();
        if (!fullName.includes(q) && !matricule.includes(q) && !subjectName.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [allAbsences, selectedProgram, selectedLevel, selectedSubject, statusFilter, dateFilter, searchQuery]);

  // Paginated data
  const totalPages = Math.max(1, Math.ceil(filteredAbsences.length / pageSize));
  const paginatedAbsences = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAbsences.slice(start, start + pageSize);
  }, [filteredAbsences, currentPage, pageSize]);

  // Handlers
  const handleToggleJustified = (absenceId: string, currentJustified?: boolean, studentName?: string) => {
    const updated = storage.toggleAbsenceJustified(absenceId);
    if (updated) {
      if (updated.justified) {
        showToast(
          studentName 
            ? `Absence de ${studentName} marquée comme justifiée` 
            : 'Absence marquée comme justifiée', 
          'success'
        );
      } else {
        showToast(
          studentName 
            ? `Justification annulée pour ${studentName}` 
            : 'Justification de l\'absence annulée', 
          'info'
        );
      }
    }
    setActiveMenuId(null);
  };

  const handleExportCSV = () => {
    if (filteredAbsences.length === 0) {
      showToast('Aucune donnée à exporter', 'info');
      return;
    }

    const headers = ['Date', 'Heure', 'Matricule', 'Nom', 'Prenom', 'Filiere', 'Niveau', 'Matiere', 'Statut', 'Enregistre_Par'];
    const rows = filteredAbsences.map(a => [
      a.absenceDate,
      a.absenceTime,
      a.student.matricule,
      `"${a.student.lastName}"`,
      `"${a.student.firstName}"`,
      `"${a.program.name}"`,
      `"${a.level.name}"`,
      `"${a.subject.name}"`,
      `"${a.justified ? 'Justifiée' : 'Non justifiée'}"`,
      `"${a.recordedByName}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `isgg_absences_historique_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Export CSV téléchargé avec succès', 'success');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
            Historique des absences
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">
            Consultez et filtrez toutes les absences enregistrées au sein de l&apos;établissement
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer min-h-[44px] w-full sm:w-auto"
        >
          <Download className="w-4 h-4 text-[#EA580C]" />
          <span>Exporter (CSV)</span>
        </button>
      </div>

      {/* Filters Card (Panel 4) */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Search */}
          <div className="relative sm:col-span-2 md:col-span-3 lg:col-span-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4 text-[#EA580C]" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Étudiant, matricule..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] min-h-[44px]"
            />
          </div>

          {/* Program filter */}
          <div>
            <select
              value={selectedProgram}
              onChange={e => {
                setSelectedProgram(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] cursor-pointer min-h-[44px]"
            >
              <option value="all">Toutes filières</option>
              {programs.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>

          {/* Level filter (Licence 1, 2, 3, Master 1, 2) */}
          <div>
            <select
              value={selectedLevel}
              onChange={e => {
                setSelectedLevel(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] cursor-pointer min-h-[44px]"
            >
              <option value="all">Toutes années</option>
              {levels.map(lvl => (
                <option key={lvl.id} value={lvl.id}>
                  {lvl.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subject filter */}
          <div>
            <select
              value={selectedSubject}
              onChange={e => {
                setSelectedSubject(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] cursor-pointer min-h-[44px]"
            >
              <option value="all">Toutes les matières</option>
              {availableSubjects.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div>
            <select
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value as 'all' | 'unjustified' | 'justified');
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] cursor-pointer min-h-[44px]"
            >
              <option value="all">Tous les statuts</option>
              <option value="unjustified">Non justifiées</option>
              <option value="justified">Justifiées</option>
            </select>
          </div>

          {/* Date filter */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <CalendarIcon className="w-4 h-4 text-slate-400" />
            </div>
            <input
              type="date"
              value={dateFilter}
              onChange={e => {
                setDateFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] min-h-[44px]"
            />
          </div>
        </div>

        {/* Active filter pills */}
        {(selectedProgram !== 'all' || selectedLevel !== 'all' || selectedSubject !== 'all' || statusFilter !== 'all' || dateFilter || searchQuery) && (
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 text-xs">
            <span className="text-slate-400 font-medium">Filtres actifs :</span>
            {selectedProgram !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-50 text-[#EA580C] font-semibold border border-orange-200/80">
                <span>Filière : {programs.find(p => p.id === selectedProgram)?.code || selectedProgram}</span>
                <button 
                  type="button"
                  onClick={() => { setSelectedProgram('all'); setCurrentPage(1); }} 
                  className="hover:text-orange-950 font-bold ml-0.5 text-sm leading-none cursor-pointer"
                  title="Retirer le filtre filière"
                >
                  ×
                </button>
              </span>
            )}
            {selectedLevel !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200/80">
                <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
                <span>{levels.find(l => l.id === selectedLevel)?.name || selectedLevel}</span>
                <button 
                  type="button"
                  onClick={() => { setSelectedLevel('all'); setCurrentPage(1); }} 
                  className="hover:text-indigo-950 font-bold ml-0.5 text-sm leading-none cursor-pointer"
                  title="Retirer le filtre d'année"
                >
                  ×
                </button>
              </span>
            )}
            {selectedSubject !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-semibold border border-slate-200">
                <span>Matière : {subjects.find(s => s.id === selectedSubject)?.name || selectedSubject}</span>
                <button 
                  type="button"
                  onClick={() => { setSelectedSubject('all'); setCurrentPage(1); }} 
                  className="hover:text-slate-950 font-bold ml-0.5 text-sm leading-none cursor-pointer"
                  title="Retirer le filtre matière"
                >
                  ×
                </button>
              </span>
            )}
            {statusFilter !== 'all' && (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold border ${
                statusFilter === 'justified' 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80' 
                  : 'bg-rose-50 text-rose-700 border-rose-200/80'
              }`}>
                <span>Statut : {statusFilter === 'justified' ? 'Justifiées' : 'Non justifiées'}</span>
                <button 
                  type="button"
                  onClick={() => { setStatusFilter('all'); setCurrentPage(1); }} 
                  className="hover:opacity-75 font-bold ml-0.5 text-sm leading-none cursor-pointer"
                  title="Retirer le filtre statut"
                >
                  ×
                </button>
              </span>
            )}
            {dateFilter && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-semibold border border-slate-200">
                <span>Date : {dateFilter}</span>
                <button 
                  type="button"
                  onClick={() => { setDateFilter(''); setCurrentPage(1); }} 
                  className="hover:text-slate-950 font-bold ml-0.5 text-sm leading-none cursor-pointer"
                  title="Retirer le filtre date"
                >
                  ×
                </button>
              </span>
            )}
            {searchQuery && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-semibold border border-slate-200">
                <span>Recherche : &quot;{searchQuery}&quot;</span>
                <button 
                  type="button"
                  onClick={() => { setSearchQuery(''); setCurrentPage(1); }} 
                  className="hover:text-slate-950 font-bold ml-0.5 text-sm leading-none cursor-pointer"
                  title="Effacer la recherche"
                >
                  ×
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setSelectedProgram('all');
                setSelectedLevel('all');
                setSelectedSubject('all');
                setStatusFilter('all');
                setDateFilter('');
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="text-xs font-semibold text-[#EA580C] hover:underline ml-auto cursor-pointer"
            >
              Réinitialiser tous les filtres
            </button>
          </div>
        )}
      </div>

      {/* Table & Cards Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Mobile View: Cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {paginatedAbsences.length === 0 ? (
            <div className="py-12 px-4 text-center text-slate-400">
              <p className="text-sm font-semibold text-slate-600">Aucune absence trouvée</p>
              <p className="text-xs text-slate-400 mt-1">Modifiez vos critères de recherche ou vos filtres.</p>
            </div>
          ) : (
            paginatedAbsences.map(item => (
              <div key={item.id} className="p-4 space-y-3 hover:bg-slate-50/60 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden flex-shrink-0 border border-slate-300">
                      {item.student.avatarUrl ? (
                        <img 
                          src={item.student.avatarUrl} 
                          alt={item.student.lastName} 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <div className="w-full h-full bg-[#EA580C] text-white font-bold flex items-center justify-center text-xs">
                          {item.student.lastName.slice(0, 1)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-900 leading-tight">
                        {item.student.lastName} {item.student.firstName}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        Matricule : {item.student.matricule}
                      </p>
                    </div>
                  </div>

                  {item.justified ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shrink-0">
                      <CheckCircle className="w-3 h-3 text-emerald-600" />
                      Justifiée
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200/60 shrink-0">
                      <AlertCircle className="w-3 h-3 text-rose-500" />
                      Non justifiée
                    </span>
                  )}
                </div>

                {/* Details Pills */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-800 bg-slate-100 px-2 py-1 rounded-md text-[11px]">
                    <CalendarIcon className="w-3 h-3 text-orange-600" />
                    {item.absenceDate} ({item.absenceTime})
                  </span>
                  <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-800 font-semibold text-[11px]">
                    {item.program.code} • {item.level.name}
                  </span>
                  <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-50 border border-slate-200 px-2 py-1 rounded-md text-[11px]">
                    <BookOpen className="w-3 h-3 text-slate-400" />
                    {item.subject.name}
                  </span>
                </div>

                {/* Actions row for Mobile */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => onViewStudent(item.student.id)}
                    className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[38px]"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#EA580C]" />
                    <span>Fiche étudiant</span>
                  </button>

                  <div 
                    className="relative inline-block text-left"
                    ref={activeMenuId === `mobile-${item.id}` ? menuRef : null}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(activeMenuId === `mobile-${item.id}` ? null : `mobile-${item.id}`);
                      }}
                      className="p-2 rounded-lg text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer min-h-[38px] flex items-center justify-center"
                      title="Options"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {activeMenuId === `mobile-${item.id}` && (
                      <div className="absolute right-0 bottom-full mb-1 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 text-left animate-in fade-in">
                        <button
                          onClick={() => {
                            onViewStudent(item.student.id);
                            setActiveMenuId(null);
                          }}
                          className="w-full px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#EA580C]" />
                          <span>Fiche étudiant</span>
                        </button>
                        <button
                          onClick={() => handleToggleJustified(item.id, item.justified, `${item.student.lastName} ${item.student.firstName}`)}
                          className="w-full px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer"
                        >
                          <CheckCircle className={`w-3.5 h-3.5 ${item.justified ? 'text-amber-600' : 'text-emerald-600'}`} />
                          <span>{item.justified ? 'Annuler justification' : 'Justifier cette absence'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Full Table (Pixel-perfect matching Panel 4) */}
        <div className="hidden md:block overflow-x-auto min-h-[380px]">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="py-3.5 px-5">Date / Heure</th>
                <th className="py-3.5 px-5">Étudiant</th>
                <th className="py-3.5 px-5">Filière</th>
                <th className="py-3.5 px-5">Année</th>
                <th className="py-3.5 px-5">Matière</th>
                <th className="py-3.5 px-5">Statut</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {paginatedAbsences.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <p className="text-sm font-semibold text-slate-600">Aucune absence trouvée</p>
                    <p className="text-xs text-slate-400 mt-1">Modifiez vos critères de recherche ou vos filtres.</p>
                  </td>
                </tr>
              ) : (
                paginatedAbsences.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Date / Heure */}
                    <td className="py-3.5 px-5 whitespace-nowrap text-slate-900">
                      <span className="font-bold">{item.absenceDate}</span>
                      <span className="text-slate-400 ml-1.5">{item.absenceTime}</span>
                    </td>

                    {/* Étudiant */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden flex-shrink-0 border border-slate-300">
                          {item.student.avatarUrl ? (
                            <img 
                              src={item.student.avatarUrl} 
                              alt={item.student.lastName} 
                              className="w-full h-full object-cover" 
                            />
                          ) : (
                            <div className="w-full h-full bg-[#EA580C] text-white font-bold flex items-center justify-center text-xs">
                              {item.student.lastName.slice(0, 1)}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">
                            {item.student.lastName} {item.student.firstName}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {item.student.matricule}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Filière */}
                    <td className="py-3.5 px-5 whitespace-nowrap text-slate-800">
                      {item.program.name}
                    </td>

                    {/* Année */}
                    <td className="py-3.5 px-5 whitespace-nowrap text-slate-600">
                      {item.level.name}
                    </td>

                    {/* Matière */}
                    <td className="py-3.5 px-5 whitespace-nowrap font-semibold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                        <span>{item.subject.name}</span>
                      </div>
                    </td>

                    {/* Statut */}
                    <td className="py-3.5 px-5 whitespace-nowrap">
                      {item.justified ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Justifiée</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-600 border border-rose-200/60">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                          <span>Non justifiée</span>
                        </span>
                      )}
                    </td>

                    {/* Actions Menu */}
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <div 
                        className="relative inline-block text-left"
                        ref={activeMenuId === item.id ? menuRef : null}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === item.id ? null : item.id);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Options"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {activeMenuId === item.id && (
                          <div 
                            className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 text-left animate-in fade-in"
                          >
                            <button
                              onClick={() => {
                                onViewStudent(item.student.id);
                                setActiveMenuId(null);
                              }}
                              className="w-full px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-[#EA580C]" />
                              <span>Fiche étudiant</span>
                            </button>
                            <button
                              onClick={() => handleToggleJustified(item.id, item.justified, `${item.student.lastName} ${item.student.firstName}`)}
                              className="w-full px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer"
                            >
                              <CheckCircle className={`w-3.5 h-3.5 ${item.justified ? 'text-amber-600' : 'text-emerald-600'}`} />
                              <span>{item.justified ? 'Annuler justification' : 'Justifier cette absence'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer matching mockup Panel 4 */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-medium">
          <div>
            Affichage de <strong className="text-slate-900">{paginatedAbsences.length}</strong> sur{' '}
            <strong className="text-slate-900">{filteredAbsences.length}</strong> résultats
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Page précédente"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 rounded-lg font-bold text-xs transition-colors ${
                  currentPage === page
                    ? 'bg-[#EA580C] text-white shadow-xs'
                    : 'hover:bg-slate-100 text-slate-700'
                }`}
              >
                {page}
              </button>
            ))}

            {totalPages > 5 && (
              <>
                <span className="px-1 text-slate-400">...</span>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  className={`w-8 h-8 rounded-lg font-bold text-xs transition-colors ${
                    currentPage === totalPages
                      ? 'bg-[#EA580C] text-white'
                      : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  {totalPages}
                </button>
              </>
            )}

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Page suivante"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
