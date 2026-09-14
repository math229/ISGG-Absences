import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  GraduationCap, 
  BookOpen, 
  Search, 
  Plus, 
  Check, 
  History, 
  CheckSquare, 
  Square, 
  Clock, 
  Calendar, 
  ShieldCheck, 
  Sparkles, 
  Info, 
  Building, 
  UserCheck,
  Users,
  FileSpreadsheet,
  Keyboard,
  AlertTriangle,
  FileText,
  Send,
  X
} from 'lucide-react';
import { storage, formatFrenchDate } from '../../lib/storage';
import { Program, Level, Subject, StudentWithStats } from '../../types';
import { useToast } from '../common/Toast';
import { SheetImporter } from './SheetImporter';
import { SheetImportHistory } from './SheetImportHistory';

interface NewAbsenceViewProps {
  onViewStudentHistory: (studentId: string) => void;
}

export const NewAbsenceView: React.FC<NewAbsenceViewProps> = ({ onViewStudentHistory }) => {
  const { showAbsenceToast, showToast } = useToast();

  // Main workflow tab: 'import' (prioritized) vs 'manual' vs 'history'
  const [mainTab, setMainTab] = useState<'import' | 'manual' | 'history'>('import');
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  useEffect(() => {
    return storage.subscribe(() => {
      setRefreshTrigger(prev => prev + 1);
    });
  }, []);

  const sheetImports = useMemo(() => {
    return storage.getSheetImports();
  }, [refreshTrigger]);

  // Programs & Levels
  const programs = useMemo(() => storage.getPrograms(), [refreshTrigger]);
  const levels = useMemo(() => storage.getLevels(), [refreshTrigger]);

  // Context Selection States (Defaults tuned for 1ère année Licence 1)
  const [selectedProgramId, setSelectedProgramId] = useState<string>('prog-gi');
  const [selectedLevelId, setSelectedLevelId] = useState<string>('lvl-l1');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('sub-l1-analyse');
  const [selectedGroup, setSelectedGroup] = useState<string>('all'); // 'all' | 'A' | 'B' | ...

  // Available groups for current program
  const availableGroups = useMemo(() => {
    return storage.getProgramGroups(selectedProgramId);
  }, [selectedProgramId, refreshTrigger]);

  // Input modes: 'single' (rapid smart search) vs 'class-list' (bulk checklist)
  const [entryMode, setEntryMode] = useState<'single' | 'class-list'>('single');

  // Single mode state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<StudentWithStats | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);

  // Class list mode state
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  // Immediate Disciplinary Alert Modal state
  const [alertStudentInfo, setAlertStudentInfo] = useState<{
    student: StudentWithStats;
    count: number;
    threshold: number;
  } | null>(null);

  // Search input reference for auto-refocus
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Available subjects dynamically filtered by Program + Level
  const availableSubjects = useMemo(() => {
    return storage.getSubjects(selectedProgramId, selectedLevelId);
  }, [selectedProgramId, selectedLevelId, refreshTrigger]);

  // Keep subject selection valid when Program or Level changes
  useEffect(() => {
    if (availableSubjects.length > 0) {
      const currentStillValid = availableSubjects.some(s => s.id === selectedSubjectId);
      if (!currentStillValid) {
        setSelectedSubjectId(availableSubjects[0].id);
      }
    } else {
      setSelectedSubjectId('');
    }
    // Clear selected student if context changes
    setSelectedStudent(null);
    setSelectedStudentIds(new Set());
  }, [selectedProgramId, selectedLevelId, availableSubjects, selectedSubjectId]);

  // Students list matching current context, group and search query
  const matchingStudents = useMemo(() => {
    return storage.searchStudents(selectedProgramId, selectedLevelId, searchQuery, selectedGroup);
  }, [selectedProgramId, selectedLevelId, searchQuery, selectedGroup, refreshTrigger]);

  // All students of the selected class & group (for class list mode)
  const classStudents = useMemo(() => {
    return storage.searchStudents(selectedProgramId, selectedLevelId, undefined, selectedGroup);
  }, [selectedProgramId, selectedLevelId, selectedGroup, refreshTrigger]);

  // Active Program, Level, Subject objects for display
  const currentProgram = programs.find(p => p.id === selectedProgramId);
  const currentLevel = levels.find(l => l.id === selectedLevelId);
  const currentSubject = availableSubjects.find(s => s.id === selectedSubjectId);

  // Global Keyboard shortcut: Ctrl+K or Cmd+K focuses search bar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle student selection from smart search
  const handleSelectStudent = (student: StudentWithStats) => {
    setSelectedStudent(student);
  };

  // Record absence (The core scenario step #25, #26, #27)
  const handleRecordAbsence = () => {
    if (!selectedStudent || !selectedSubjectId || !currentSubject) return;

    setIsRecording(true);
    try {
      const result = storage.recordAbsence({
        studentId: selectedStudent.id,
        subjectId: selectedSubjectId,
      });

      const now = new Date();
      const frenchDate = formatFrenchDate(result.absence.absenceDate);

      // 1. Show elegant toast matching step 26
      showAbsenceToast({
        studentName: `${result.student.lastName} ${result.student.firstName}`,
        subjectName: result.subject.name,
        dateStr: frenchDate,
        timeStr: result.absence.absenceTime,
        annualCount: result.student.annualAbsenceCount,
      });

      const settings = storage.getSystemSettings();

      // Check if critical disciplinary threshold reached or crossed
      if (settings.instantAlertOnEntry && result.student.annualAbsenceCount >= settings.disciplineThreshold) {
        setAlertStudentInfo({
          student: result.student,
          count: result.student.annualAbsenceCount,
          threshold: settings.disciplineThreshold,
        });
      }

      // 2. Clear state and refocus search input immediately for next student (Step 27)
      setSelectedStudent(null);
      setSearchQuery('');

      if (settings.autoRefocus) {
        setTimeout(() => {
          if (searchInputRef.current) {
            searchInputRef.current.focus();
          }
        }, 50);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement';
      showToast(msg, 'error');
    } finally {
      setIsRecording(false);
    }
  };

  // Bulk Record Absences (Step 29: Mode liste de classe)
  const handleRecordBulkAbsences = () => {
    if (selectedStudentIds.size === 0 || !selectedSubjectId || !currentSubject) return;

    const count = selectedStudentIds.size;
    setIsRecording(true);

    try {
      const recorded = storage.recordBulkAbsences({
        studentIds: Array.from(selectedStudentIds),
        subjectId: selectedSubjectId,
      });

      showToast(
        `${recorded} absence${recorded > 1 ? 's' : ''} enregistrée${recorded > 1 ? 's' : ''} en ${currentSubject.name}`,
        'success',
        '✓ Enregistrement groupé réussi'
      );

      setSelectedStudentIds(new Set());

      // Check if any student crossed threshold in bulk mode
      const settings = storage.getSystemSettings();
      if (settings.instantAlertOnEntry) {
        const atRiskStudents: StudentWithStats[] = [];
        (Array.from(selectedStudentIds) as string[]).forEach((sId: string) => {
          const stats = storage.getStudentWithStats(sId);
          if (stats && stats.annualAbsenceCount >= settings.disciplineThreshold) {
            atRiskStudents.push(stats);
          }
        });
        if (atRiskStudents.length > 0) {
          setAlertStudentInfo({
            student: atRiskStudents[0],
            count: atRiskStudents[0].annualAbsenceCount,
            threshold: settings.disciplineThreshold,
          });
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      showToast(msg, 'error');
    } finally {
      setIsRecording(false);
    }
  };

  // Toggle selection for class list
  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedStudentIds.size === classStudents.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(classStudents.map(s => s.id)));
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Title & Main Workflow Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
            Nouvelle absence
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">
            {mainTab === 'import' && "Reconnaissance et extraction automatique des fiches quotidiennes du surveillant"}
            {mainTab === 'manual' && "Saisie ponctuelle ou par liste de classe en quelques secondes"}
            {mainTab === 'history' && "Historique et traçabilité des fiches récapitulatives importées"}
          </p>
        </div>

        {/* 3 Main Workflow Tabs */}
        <div className="grid grid-cols-3 sm:flex items-center bg-slate-200/80 p-1 rounded-xl text-xs font-bold w-full sm:w-auto">
          <button
            id="tab-import-sheet"
            onClick={() => setMainTab('import')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-2 sm:py-1.5 rounded-lg transition-all cursor-pointer min-h-[42px] sm:min-h-0 text-center ${
              mainTab === 'import'
                ? 'bg-white text-[#EA580C] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 shrink-0" />
            <span>Fiche</span>
          </button>

          <button
            id="tab-manual-entry"
            onClick={() => setMainTab('manual')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-2 sm:py-1.5 rounded-lg transition-all cursor-pointer min-h-[42px] sm:min-h-0 text-center ${
              mainTab === 'manual'
                ? 'bg-white text-[#EA580C] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Keyboard className="w-4 h-4 shrink-0" />
            <span>Manuelle</span>
            <span className="hidden md:inline"> saisie</span>
          </button>

          <button
            id="tab-import-history"
            onClick={() => setMainTab('history')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-2 sm:py-1.5 rounded-lg transition-all cursor-pointer min-h-[42px] sm:min-h-0 text-center ${
              mainTab === 'history'
                ? 'bg-white text-[#EA580C] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4 shrink-0" />
            <span>Historique</span>
            <span className="text-[10px] ml-0.5 opacity-80">({sheetImports.length})</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: IMPORT D'UNE FICHE RECAPITULATIVE (PRIORITAIRE) */}
      {mainTab === 'import' && (
        <SheetImporter
          onImportComplete={() => {
            setRefreshTrigger(prev => prev + 1);
          }}
          onGoToHistory={() => setMainTab('history')}
          onViewStudentHistory={onViewStudentHistory}
        />
      )}

      {/* VIEW 2: HISTORIQUE DES IMPORTS */}
      {mainTab === 'history' && (
        <SheetImportHistory
          imports={sheetImports}
        />
      )}

      {/* VIEW 3: SAISIE MANUELLE CLASSIQUE */}
      {mainTab === 'manual' && (
        <div className="space-y-6">
          {/* Submode switcher (Single vs Class List) */}
          <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-3 shadow-xs">
            <span className="text-xs font-semibold text-slate-700">
              Mode de saisie manuelle :
            </span>
            <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-bold">
              <button
                id="tab-single-search"
                onClick={() => {
                  setEntryMode('single');
                  setTimeout(() => searchInputRef.current?.focus(), 100);
                }}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                  entryMode === 'single'
                    ? 'bg-white text-[#EA580C] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Recherche intelligente
              </button>
              <button
                id="tab-class-list"
                onClick={() => setEntryMode('class-list')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                  entryMode === 'class-list'
                    ? 'bg-white text-[#EA580C] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Liste de la classe ({classStudents.length})
              </button>
            </div>
          </div>

          {/* 5-Step Process Indicator (Pixel-perfect to Panel 3 of mockup) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between max-w-3xl mx-auto overflow-x-auto pb-2 sm:pb-0">
          {/* Step 1 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="w-7 h-7 rounded-full bg-[#EA580C] text-white font-bold text-xs flex items-center justify-center shadow-xs">
              1
            </span>
            <span className="text-xs font-bold text-slate-900 whitespace-nowrap">Filière</span>
            <div className="w-8 sm:w-16 h-0.5 bg-orange-200 mx-1" />
          </div>

          {/* Step 2 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="w-7 h-7 rounded-full bg-[#EA580C] text-white font-bold text-xs flex items-center justify-center shadow-xs">
              2
            </span>
            <span className="text-xs font-bold text-slate-900 whitespace-nowrap">Année d&apos;étude</span>
            <div className="w-8 sm:w-16 h-0.5 bg-orange-200 mx-1" />
          </div>

          {/* Step 3 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="w-7 h-7 rounded-full bg-[#EA580C] text-white font-bold text-xs flex items-center justify-center shadow-xs">
              3
            </span>
            <span className="text-xs font-bold text-slate-900 whitespace-nowrap">Matière</span>
            <div className="w-8 sm:w-16 h-0.5 bg-orange-200 mx-1" />
          </div>

          {/* Step 4 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`w-7 h-7 rounded-full font-bold text-xs flex items-center justify-center shadow-xs ${
              selectedStudent ? 'bg-emerald-600 text-white' : 'bg-orange-100 text-[#EA580C]'
            }`}>
              {selectedStudent ? <Check className="w-3.5 h-3.5" /> : '4'}
            </span>
            <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Recherche étudiant</span>
            <div className="w-8 sm:w-16 h-0.5 bg-slate-200 mx-1" />
          </div>

          {/* Step 5 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`w-7 h-7 rounded-full font-bold text-xs flex items-center justify-center ${
              selectedStudent ? 'bg-[#EA580C] text-white animate-pulse' : 'bg-slate-100 text-slate-400'
            }`}>
              5
            </span>
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Absence</span>
          </div>
        </div>
      </div>

      {/* Context Selection Form + Information Card (Panel 3 form) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Dropdowns Card */}
        <div className="lg:col-span-8 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Filière */}
            <div>
              <label 
                htmlFor="select-program"
                className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1"
              >
                <span>Filière</span>
                <span className="text-[#EA580C]">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Building className="w-4 h-4 text-[#EA580C]" />
                </div>
                <select
                  id="select-program"
                  value={selectedProgramId}
                  onChange={e => {
                    setSelectedProgramId(e.target.value);
                    setSelectedGroup('all');
                  }}
                  className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] cursor-pointer"
                >
                  {programs.map(prog => (
                    <option key={prog.id} value={prog.id}>
                      {prog.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Classe / Groupe (ex: A, B, C...) */}
            <div>
              <label 
                htmlFor="select-group"
                className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between"
              >
                <div className="flex items-center gap-1">
                  <span>Classe / Groupe</span>
                  <span className="text-[#EA580C]">*</span>
                </div>
                <span className="text-[10px] text-slate-400 font-normal">
                  {availableGroups.length > 1 ? `${availableGroups.length} groupes` : 'Classe unique'}
                </span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Users className="w-4 h-4 text-[#EA580C]" />
                </div>
                <select
                  id="select-group"
                  value={selectedGroup}
                  onChange={e => setSelectedGroup(e.target.value)}
                  className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] cursor-pointer"
                >
                  <option value="all">Tous les groupes ({availableGroups.join(', ')})</option>
                  {availableGroups.map(grp => (
                    <option key={grp} value={grp}>
                      {currentProgram?.name} {grp} (Classe {grp})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Année d'étude */}
            <div>
              <label 
                htmlFor="select-level"
                className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1"
              >
                <span>Année d&apos;étude</span>
                <span className="text-[#EA580C]">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <GraduationCap className="w-4 h-4 text-[#EA580C]" />
                </div>
                <select
                  id="select-level"
                  value={selectedLevelId}
                  onChange={e => setSelectedLevelId(e.target.value)}
                  className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] cursor-pointer"
                >
                  {levels.map(lvl => (
                    <option key={lvl.id} value={lvl.id}>
                      {lvl.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Matière */}
            <div>
              <label 
                htmlFor="select-subject"
                className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1"
              >
                <span>Matière</span>
                <span className="text-[#EA580C]">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <BookOpen className="w-4 h-4 text-[#EA580C]" />
                </div>
                <select
                  id="select-subject"
                  value={selectedSubjectId}
                  onChange={e => setSelectedSubjectId(e.target.value)}
                  disabled={availableSubjects.length === 0}
                  className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] cursor-pointer disabled:opacity-50"
                >
                  {availableSubjects.map(sub => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Active Context Status Pill */}
          <div className="p-3 bg-orange-50/60 border border-orange-200/60 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#EA580C] animate-ping" />
              <span className="font-semibold text-slate-700">Session de saisie active :</span>
              <span className="font-bold text-[#EA580C]">
                {currentProgram?.name} {selectedGroup !== 'all' ? `(Groupe ${selectedGroup})` : ''} • {currentLevel?.name} • {currentSubject?.name}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              {classStudents.length} étudiants dans cette sélection
            </span>
          </div>
        </div>

        {/* Informative Side Card (from Panel 3) */}
        <div className="lg:col-span-4 bg-orange-50/50 border border-orange-200/70 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-[#EA580C] mb-3">
              <Sparkles className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Chargement dynamique</h4>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Les étudiants sont chargés automatiquement en fonction de la filière, de l&apos;année et de la matière sélectionnées.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-orange-200/50 text-[11px] text-slate-500 flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-4 h-4 text-[#EA580C] flex-shrink-0" />
            <span>Aucune saisie manuelle de date, heure ou classe requise.</span>
          </div>
        </div>
      </div>

      {/* MODE 1: RECHERCHE INTELLIGENTE (Main Scenario #54) */}
      {entryMode === 'single' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-6">
          {/* Smart Search Bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label 
                htmlFor="student-search-input"
                className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5"
              >
                <span>Recherche intelligente étudiant</span>
                <span className="text-slate-400 font-normal">
                  (insensible à la casse, aux accents et aux espaces)
                </span>
              </label>
              <span className="text-[11px] text-slate-400 font-medium">
                Raccourci : <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-[10px] font-mono">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-[10px] font-mono">K</kbd>
              </span>
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                <Search className="w-5 h-5 text-[#EA580C]" />
              </div>
              <input
                ref={searchInputRef}
                id="student-search-input"
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="🔍 Rechercher un étudiant... (ex: AP, Mathieu, ISGG-2024-042...)"
                autoFocus
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 hover:border-slate-300 focus:border-[#EA580C] focus:bg-white rounded-xl text-base font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[#EA580C]/15 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-xs text-slate-400 hover:text-slate-700 font-semibold"
                >
                  Effacer
                </button>
              )}
            </div>
          </div>

          {/* Search Autocomplete Results or Class Roster */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
              <span>
                {searchQuery
                  ? `Résultats pour "${searchQuery}" (${matchingStudents.length} trouvés)`
                  : `Étudiants de la classe (${matchingStudents.length})`}
              </span>
              <span className="text-slate-400">Cliquez pour sélectionner</span>
            </div>

            {matchingStudents.length === 0 ? (
              <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-sm font-semibold text-slate-600">
                  Aucun étudiant trouvé dans cette filière et cette année
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Vérifiez l&apos;orthographe ou sélectionnez une autre filière/année
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
                {matchingStudents.map(student => {
                  const isSelected = selectedStudent?.id === student.id;
                  return (
                    <div
                      key={student.id}
                      id={`student-card-${student.id}`}
                      onClick={() => handleSelectStudent(student)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'border-[#EA580C] bg-orange-50/70 shadow-sm ring-2 ring-[#EA580C]/20'
                          : 'border-slate-200 hover:border-orange-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden flex-shrink-0 border border-slate-300">
                          {student.avatarUrl ? (
                            <img 
                              src={student.avatarUrl} 
                              alt={student.lastName} 
                              className="w-full h-full object-cover" 
                            />
                          ) : (
                            <div className="w-full h-full bg-[#EA580C] text-white font-bold flex items-center justify-center text-xs">
                              {student.lastName.slice(0, 1)}
                              {student.firstName.slice(0, 1)}
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-bold text-sm text-slate-900 truncate">
                              {student.lastName} <span className="font-semibold">{student.firstName}</span>
                            </p>
                            <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-orange-100 text-[#EA580C]">
                              Classe {student.classGroup || 'A'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 truncate">
                            {student.levelName} • {student.programName}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            Matricule: {student.matricule}
                          </p>
                        </div>
                      </div>

                      {/* Absence badge */}
                      <div className="text-right flex-shrink-0 ml-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold ${
                          student.annualAbsenceCount > 6
                            ? 'bg-rose-100 text-rose-700 border border-rose-200'
                            : student.annualAbsenceCount > 3
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {student.annualAbsenceCount} {student.annualAbsenceCount === 1 ? 'abs' : 'abs'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected Student Confirmation Card & Recording CTA (Step 24 & 25) */}
          {selectedStudent && (
            <div 
              id="selected-student-card"
              className="p-6 rounded-2xl bg-gradient-to-r from-orange-50 via-white to-orange-50/30 border-2 border-[#EA580C] shadow-md space-y-4 animate-in fade-in slide-in-from-bottom-2"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#EA580C] text-white flex items-center justify-center text-xl font-black shadow-md">
                    {selectedStudent.lastName.slice(0, 1)}
                    {selectedStudent.firstName.slice(0, 1)}
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-slate-950">
                      {selectedStudent.lastName} {selectedStudent.firstName}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-600 font-medium">
                      <span>Matricule : <strong className="font-mono text-slate-900">{selectedStudent.matricule}</strong></span>
                      <span>•</span>
                      <span>Filière : <strong className="text-slate-900">{selectedStudent.programName}</strong></span>
                      <span>•</span>
                      <span>Classe : <strong className="text-[#EA580C] font-bold">Groupe {selectedStudent.classGroup || 'A'}</strong></span>
                      <span>•</span>
                      <span>Niveau : <strong className="text-slate-900">{selectedStudent.levelName}</strong></span>
                    </div>
                    <div className="mt-2">
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-orange-100 text-[#EA580C]">
                        {selectedStudent.annualAbsenceCount} absences cette année
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onViewStudentHistory(selectedStudent.id)}
                    className="px-3.5 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-colors"
                  >
                    <History className="w-4 h-4 text-slate-500" />
                    <span>Voir l&apos;historique</span>
                  </button>
                </div>
              </div>

              {/* Huge Action Button (Step 25: + ENREGISTRER L'ABSENCE) */}
              <div className="pt-2 border-t border-orange-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-slate-500 flex items-center gap-2 font-medium">
                  <Clock className="w-4 h-4 text-[#EA580C]" />
                  <span>Enregistrement automatique immédiat en <strong>{currentSubject?.name}</strong></span>
                </div>

                <button
                  id="btn-record-absence"
                  type="button"
                  disabled={isRecording}
                  onClick={handleRecordAbsence}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-black text-white bg-[#EA580C] hover:bg-[#D94600] active:scale-[0.98] transition-all shadow-xl shadow-orange-600/30 flex items-center justify-center gap-2 text-base cursor-pointer disabled:opacity-75"
                >
                  {isRecording ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-5 h-5 stroke-[3]" />
                      <span>+ ENREGISTRER L&apos;ABSENCE</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODE 2: MODE LISTE DE LA CLASSE (Step 29 of prompt) */}
      {entryMode === 'class-list' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Liste d&apos;appel de la classe
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Cochez les étudiants absents pour un enregistrement groupé en un seul clic
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSelectAll}
                className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
              >
                {selectedStudentIds.size === classStudents.length ? (
                  <>
                    <Square className="w-3.5 h-3.5" />
                    <span>Tout désélectionner</span>
                  </>
                ) : (
                  <>
                    <CheckSquare className="w-3.5 h-3.5 text-[#EA580C]" />
                    <span>Tout sélectionner</span>
                  </>
                )}
              </button>

              <button
                type="button"
                id="btn-bulk-record"
                disabled={selectedStudentIds.size === 0 || isRecording}
                onClick={handleRecordBulkAbsences}
                className="px-5 py-2 rounded-xl text-xs font-black text-white bg-[#EA580C] hover:bg-[#D94600] disabled:opacity-40 shadow-md shadow-orange-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Enregistrer {selectedStudentIds.size} absence{selectedStudentIds.size > 1 ? 's' : ''}</span>
              </button>
            </div>
          </div>

          {/* Students Checklist */}
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {classStudents.map(student => {
              const isChecked = selectedStudentIds.has(student.id);
              return (
                <div
                  key={student.id}
                  onClick={() => toggleStudentSelection(student.id)}
                  className={`p-3 flex items-center justify-between rounded-xl transition-colors cursor-pointer ${
                    isChecked ? 'bg-orange-50/70' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-slate-400">
                      {isChecked ? (
                        <CheckSquare className="w-5 h-5 text-[#EA580C]" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-bold text-sm text-slate-900">
                          {student.lastName} {student.firstName}
                        </p>
                        <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-orange-100 text-[#EA580C]">
                          Classe {student.classGroup || 'A'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {student.matricule}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-xs font-semibold text-slate-500">
                      {student.annualAbsenceCount} absences annuelles
                    </span>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        onViewStudentHistory(student.id);
                      }}
                      className="text-xs text-[#EA580C] font-bold hover:underline"
                    >
                      Détails
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom Guarantee Banner (Panel 3 footer banner) */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-600 font-medium">
          <div className="w-6 h-6 rounded-lg bg-orange-100 flex items-center justify-center text-[#EA580C] flex-shrink-0">
            <Info className="w-3.5 h-3.5" />
          </div>
          <span>
            Le système récupère automatiquement la date, l&apos;heure et les informations de l&apos;étudiant.
          </span>
        </div>

        <div className="flex items-center gap-4 text-slate-700 font-bold">
          <span className="flex items-center gap-1 text-[#EA580C]">
            <Clock className="w-3.5 h-3.5" /> Rapide
          </span>
          <span className="text-slate-300">•</span>
          <span className="flex items-center gap-1 text-emerald-600">
            <ShieldCheck className="w-3.5 h-3.5" /> Fiable
          </span>
          <span className="text-slate-300">•</span>
          <span className="flex items-center gap-1 text-slate-800">
            <UserCheck className="w-3.5 h-3.5" /> Sécurisé
          </span>
        </div>
      </div>
    </div>
    )}

    {/* Instant Disciplinary Alert Modal (Direct feedback when threshold is reached) */}
    {alertStudentInfo && (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-rose-200 animate-in zoom-in-95 duration-200 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-100 rounded-2xl">
                <AlertTriangle className="w-7 h-7 text-rose-600" />
              </div>
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-md">
                  Palier Disciplinaire Dépassé
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-0.5">
                  Convocation obligatoire
                </h3>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAlertStudentInfo(null)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-xs sm:text-sm text-slate-700 font-medium leading-relaxed">
            L&apos;étudiant <strong className="text-slate-950 uppercase">{alertStudentInfo.student.lastName} {alertStudentInfo.student.firstName}</strong> ({alertStudentInfo.student.matricule}) vient d&apos;atteindre <strong className="text-rose-600 font-black">{alertStudentInfo.count} absences</strong> cumulées.
          </p>

          <div className="bg-orange-50/70 border border-orange-200 rounded-2xl p-4 space-y-2 text-xs">
            <p className="font-bold text-orange-950 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#EA580C]" />
              Conséquences réglementaires ISGG :
            </p>
            <ul className="list-disc list-inside space-y-1 text-orange-900 font-medium">
              <li>Seuil de convocation fixé à <strong>{alertStudentInfo.threshold} absences</strong> dépassé</li>
              <li>Avis transmis au dossier officiel de la Direction</li>
              <li>Disqualification possible aux examens finaux</li>
            </ul>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                const settings = storage.getSystemSettings();
                const msg = settings.parentNoticeTemplate
                  .replace('{etudiant}', `${alertStudentInfo.student.lastName.toUpperCase()} ${alertStudentInfo.student.firstName}`)
                  .replace('{classe}', alertStudentInfo.student.programName ? `${alertStudentInfo.student.programName}` : 'ISGG')
                  .replace('{absences}', String(alertStudentInfo.count))
                  .replace('{date_rdv}', 'ce vendredi à 09h00')
                  .replace('{tuteur}', `M./Mme ${alertStudentInfo.student.lastName.toUpperCase()}`);
                
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(msg);
                  showToast('Message de notification copié dans le presse-papier !', 'success');
                }
                
                if (settings.parentNotificationChannel === 'WHATSAPP') {
                  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                } else if (settings.parentNotificationChannel === 'SMS') {
                  window.open(`sms:?body=${encodeURIComponent(msg)}`, '_blank');
                } else if (settings.parentNotificationChannel === 'EMAIL') {
                  window.open(`mailto:?subject=${encodeURIComponent('ISGG - Avis d\'assiduité et convocation')}&body=${encodeURIComponent(msg)}`, '_blank');
                }
              }}
              className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20"
            >
              <Send className="w-4 h-4" />
              <span>Avis Parents ({storage.getSystemSettings().parentNotificationChannel})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const sId = alertStudentInfo.student.id;
                setAlertStudentInfo(null);
                onViewStudentHistory(sId);
              }}
              className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Fiche Étudiant</span>
            </button>

            <button
              type="button"
              onClick={() => setAlertStudentInfo(null)}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
            >
              <span>Continuer la saisie</span>
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
  );
};
