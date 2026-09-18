import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  UploadCloud, 
  FileText, 
  FileSpreadsheet, 
  Image as ImageIcon, 
  CheckCircle2, 
  AlertTriangle, 
  UserPlus, 
  UserCheck, 
  Users, 
  Clock, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  Trash2, 
  Edit3, 
  ArrowRight, 
  RefreshCw, 
  ShieldCheck, 
  BookOpen, 
  Building, 
  Check, 
  X,
  AlertCircle,
  HelpCircle,
  FileCheck2,
  Key,
  Sparkles
} from 'lucide-react';
import { ApiKeyConfigModal, UserAiConfig } from '../common/ApiKeyConfigModal';
import { 
  ParsedSheetData, 
  ExtractedSession, 
  ExtractedAbsenceItem, 
  MatchStatus, 
  PotentialStudentMatch 
} from '../../types';
import { 
  matchExtractedDataAgainstStorage, 
  parseUploadedAttendanceSheet 
} from '../../lib/sheetParser';
import { storage, formatFrenchDate } from '../../lib/storage';
import { useToast } from '../common/Toast';

interface SheetImporterProps {
  onImportComplete: () => void;
  onGoToHistory: () => void;
  onViewStudentHistory: (studentId: string) => void;
}

type StepStatus = 'pending' | 'active' | 'completed';

interface AnalysisStep {
  id: number;
  label: string;
  description: string;
}

const ANALYSIS_STEPS: AnalysisStep[] = [
  { id: 1, label: 'Lecture du document', description: 'Extraction de la structure et détection des blocs' },
  { id: 2, label: 'Détection de la date', description: 'Identification de la journée d\'absence' },
  { id: 3, label: 'Identification des filières & classes', description: 'Découpage par filières et promotions' },
  { id: 4, label: 'Identification des matières & horaires', description: 'Reconnaissance des cours et créneaux horaires' },
  { id: 5, label: 'Reconnaissance des étudiants', description: 'Extraction nominative des étudiants absents' },
  { id: 6, label: 'Rapprochement avec la base', description: 'Vérification des correspondances et doublons' },
  { id: 7, label: 'Préparation des absences', description: 'Génération du tableau de validation finale' },
];

export const SheetImporter: React.FC<SheetImporterProps> = ({
  onImportComplete,
  onGoToHistory,
  onViewStudentHistory,
}) => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // View phase: 'idle' | 'analyzing' | 'review' | 'success'
  const [phase, setPhase] = useState<'idle' | 'analyzing' | 'review' | 'success'>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Analysis progress
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  // Extracted data state
  const [parsedData, setParsedData] = useState<ParsedSheetData | null>(null);

  // UI state in review mode
  const [expandedSessionIds, setExpandedSessionIds] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'KNOWN' | 'NEW' | 'PROBABLE'>('ALL');
  const [isSaving, setIsSaving] = useState(false);
  const [ignoreDuplicateWarning, setIgnoreDuplicateWarning] = useState(false);

  // Summary counts post-validation
  const [savedStats, setSavedStats] = useState<{
    absencesCount: number;
    newStudentsCount: number;
    newSubjectsCount: number;
    newClassesCount: number;
    sheetDate: string;
  } | null>(null);

  // Custom AI Key (BYOK) state
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [userAiConfig, setUserAiConfig] = useState<UserAiConfig | null>(null);

  const refreshAiConfig = () => {
    try {
      const stored = localStorage.getItem('isgg_user_ai_config');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.apiKey) {
          setUserAiConfig(parsed);
          return;
        }
      }
    } catch {}
    setUserAiConfig(null);
  };

  useEffect(() => {
    refreshAiConfig();
  }, []);

  // Trigger file select
  const handleSelectFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  // Run the 7-step analysis simulation
  const runAnalysis = async (dataExtractor: () => Promise<ParsedSheetData>) => {
    setPhase('analyzing');
    setCurrentStepIndex(0);

    // Run extraction in background while visual feedback steps animate
    const extractionPromise = dataExtractor();

    for (let i = 0; i < ANALYSIS_STEPS.length; i++) {
      setCurrentStepIndex(i);
      // Realistic step pacing
      await new Promise(r => setTimeout(r, 220 + Math.random() * 180));
    }

    try {
      const result = await extractionPromise;
      setParsedData(result);
      // Auto-expand all sessions by default
      setExpandedSessionIds(new Set(result.sessions.map(s => s.id)));
      if ((result as any).warningNotice) {
        showToast((result as any).warningNotice, 'info');
      }
      setPhase('review');
    } catch (err: any) {
      console.warn('Sheet analysis notice:', err);
      showToast(err?.message || 'Erreur lors de l\'analyse du document', 'error');
      setPhase('idle');
    }
  };

  // Start analysis from uploaded file
  const handleStartAnalysis = () => {
    if (!selectedFile) return;
    runAnalysis(async () => {
      return await parseUploadedAttendanceSheet(selectedFile);
    });
  };

  // Toggle expand session
  const toggleSessionExpand = (sessionId: string) => {
    setExpandedSessionIds(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  // Edit observations directly in table
  const handleObservationChange = (sessionId: string, tempId: string, newObs: string) => {
    if (!parsedData) return;
    setParsedData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        sessions: prev.sessions.map(s => {
          if (s.id !== sessionId) return s;
          return {
            ...s,
            studentItems: s.studentItems.map(item => {
              if (item.tempId !== tempId) return item;
              return { ...item, observations: newObs };
            }),
          };
        }),
      };
    });
  };

  // Remove an extracted absence item
  const handleRemoveItem = (sessionId: string, tempId: string) => {
    if (!parsedData) return;
    setParsedData(prev => {
      if (!prev) return null;
      const updatedSessions = prev.sessions.map(s => {
        if (s.id !== sessionId) return s;
        const updatedItems = s.studentItems.filter(i => i.tempId !== tempId);
        return {
          ...s,
          studentItems: updatedItems,
          absentCount: updatedItems.length,
        };
      }).filter(s => s.studentItems.length > 0);

      const total = updatedSessions.reduce((acc, s) => acc + s.studentItems.length, 0);

      return {
        ...prev,
        sessions: updatedSessions,
        totalAbsents: total,
      };
    });
  };

  // Change student match resolution
  const handleResolveMatch = (
    sessionId: string, 
    tempId: string, 
    choice: 'NEW' | string // 'NEW' or studentId
  ) => {
    if (!parsedData) return;
    setParsedData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        sessions: prev.sessions.map(s => {
          if (s.id !== sessionId) return s;
          return {
            ...s,
            studentItems: s.studentItems.map(item => {
              if (item.tempId !== tempId) return item;
              if (choice === 'NEW') {
                return {
                  ...item,
                  matchStatus: 'NEW' as MatchStatus,
                  matchedStudentId: undefined,
                  matchedStudentName: undefined,
                };
              }
              // Selected existing student
              const candidate = item.potentialMatches?.find(pm => pm.studentId === choice);
              return {
                ...item,
                matchStatus: 'EXACT' as MatchStatus,
                matchedStudentId: choice,
                matchedStudentName: candidate?.studentName || 'Étudiant sélectionné',
              };
            }),
          };
        }),
      };
    });
  };

  // Aggregate items across all sessions
  const allAbsenceItems = useMemo(() => {
    if (!parsedData) return [];
    return parsedData.sessions.flatMap(s => 
      s.studentItems.map(item => ({ ...item, sessionId: s.id, sessionSubject: s.subjectName, sessionTime: s.timeRange }))
    );
  }, [parsedData]);

  // Summary statistics
  const summaryStats = useMemo(() => {
    if (!parsedData) {
      return {
        totalSessions: 0,
        totalAbsents: 0,
        exactMatches: 0,
        probableMatches: 0,
        newStudents: 0,
        hasDuplicateSession: false,
      };
    }

    let exact = 0;
    let probable = 0;
    let newStus = 0;

    allAbsenceItems.forEach(item => {
      if (item.matchStatus === 'EXACT') exact++;
      else if (item.matchStatus === 'PROBABLE') probable++;
      else newStus++;
    });

    const hasDuplicateSession = parsedData.sessions.some(s => s.isAlreadyRecorded);

    return {
      totalSessions: parsedData.sessions.length,
      totalAbsents: allAbsenceItems.length,
      exactMatches: exact,
      probableMatches: probable,
      newStudents: newStus,
      hasDuplicateSession,
    };
  }, [parsedData, allAbsenceItems]);

  // Filtered items in table
  const filteredItems = useMemo(() => {
    if (activeFilter === 'ALL') return allAbsenceItems;
    if (activeFilter === 'KNOWN') return allAbsenceItems.filter(i => i.matchStatus === 'EXACT');
    if (activeFilter === 'NEW') return allAbsenceItems.filter(i => i.matchStatus === 'NEW');
    if (activeFilter === 'PROBABLE') return allAbsenceItems.filter(i => i.matchStatus === 'PROBABLE');
    return allAbsenceItems;
  }, [allAbsenceItems, activeFilter]);

  // Final confirmation and persistent database commit
  const handleConfirmAndSave = async () => {
    if (!parsedData || allAbsenceItems.length === 0) return;
    setIsSaving(true);

    try {
      let createdStudentsCount = 0;
      let createdSubjectsCount = 0;
      let createdClassesCount = 0;

      // 1. Resolve Programs, Levels, and Subjects progressively
      const sheetImportDate = parsedData.sheetDate;

      // Prepare batch items
      const absencesToRecord: {
        studentId: string;
        subjectId: string;
        date: string;
        time: string;
        startTime?: string;
        endTime?: string;
        observations?: string;
        className?: string;
        sheetImportId?: string;
      }[] = [];

      // Loop through sessions
      for (const session of parsedData.sessions) {
        // Resolve program (e.g. GI)
        const prog = storage.getOrCreateProgram(session.programCode);
        // Resolve level (e.g. SIL2 -> Licence 2)
        const lvl = storage.getOrCreateLevel(session.levelCode);
        // Resolve subject (e.g. CEO II, Algèbre linéaire)
        const subj = storage.getOrCreateSubject(session.subjectName, prog.id, lvl.id);

        for (const item of session.studentItems) {
          let studentId = item.matchedStudentId;

          // If new student or unlinked, create in progressive database
          if (!studentId) {
            const { student, isNew } = storage.getOrCreateStudent({
              firstName: item.firstName,
              lastName: item.lastName,
              programId: prog.id,
              levelId: lvl.id,
              classGroup: session.classGroup,
            });
            studentId = student.id;
            if (isNew) createdStudentsCount++;
          }

          absencesToRecord.push({
            studentId,
            subjectId: subj.id,
            date: item.date || sheetImportDate,
            time: item.startTime,
            startTime: item.startTime,
            endTime: item.endTime,
            observations: item.observations || 'Sans motif',
            className: session.className,
          });
        }
      }

      // Record sheet import entry in history
      const importRecord = storage.recordSheetImport({
        sheetDate: sheetImportDate,
        importedAt: new Date().toISOString(),
        fileName: selectedFile?.name || 'Fiche_Absences_09-09-2026.pdf',
        sessionsCount: parsedData.sessions.length,
        absencesCount: absencesToRecord.length,
        newStudentsCount: createdStudentsCount,
        newClassesCount: createdClassesCount,
        newSubjectsCount: createdSubjectsCount,
        recordedBy: 'M. Nicaise AÏZOUN (Surveillant Général)',
        status: 'ENREGISTRE',
      });

      // Batch record all absences
      storage.recordBatchAbsences(absencesToRecord.map(a => ({
        ...a,
        sheetImportId: importRecord.id,
      })));

      setSavedStats({
        absencesCount: absencesToRecord.length,
        newStudentsCount: createdStudentsCount,
        newSubjectsCount: createdSubjectsCount,
        newClassesCount: createdClassesCount,
        sheetDate: sheetImportDate,
      });

      showToast(`${absencesToRecord.length} absences enregistrées avec succès !`, 'success');
      setPhase('success');
      onImportComplete();
    } catch (error) {
      console.error(error);
      showToast('Une erreur est survenue lors de l\'enregistrement', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setParsedData(null);
    setPhase('idle');
  };

  // -------------------------------------------------------------
  // RENDER: Phase 1: IDLE (Upload & Dropzone)
  // -------------------------------------------------------------
  if (phase === 'idle') {
    return (
      <div className="space-y-6">
        {/* Banner with clear instructions & BYOK Key Selector */}
        <div className="bg-gradient-to-r from-orange-50 via-amber-50/50 to-white rounded-xl border border-orange-200/80 p-5 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-orange-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-800">
                    Importer une fiche récapitulative d'absences
                  </h3>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-100 text-orange-800">
                    Recommandé
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                  Déposez la fiche quotidienne du surveillant (photo, PDF scanné ou fichier Excel). 
                  Le système intelligent détecte automatiquement la <strong>date</strong>, les <strong>classes</strong>, les <strong>matières</strong>, les <strong>horaires</strong> et la liste des <strong>étudiants absents</strong> avec rapprochement automatique.
                </p>
              </div>
            </div>

            {/* BYOK Button / Indicator */}
            <div className="shrink-0 flex items-center">
              {userAiConfig ? (
                <button
                  type="button"
                  onClick={() => setIsApiKeyModalOpen(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <Key className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Clé {userAiConfig.provider.toUpperCase()} active</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsApiKeyModalOpen(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  <Key className="w-3.5 h-3.5 text-orange-600" />
                  <span>Ma clé API (Gemini / Claude / ChatGPT)</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center transition-all duration-200 ${
            isDragOver 
              ? 'border-orange-500 bg-orange-50/60 scale-[1.005]' 
              : selectedFile
              ? 'border-emerald-400 bg-emerald-50/30'
              : 'border-slate-300 hover:border-orange-400 bg-slate-50/50 hover:bg-orange-50/20'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
            className="hidden"
          />

          <div className="max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 rounded-full bg-white shadow-xs border border-slate-200 flex items-center justify-center mx-auto text-orange-600">
              {selectedFile ? (
                <FileCheck2 className="w-8 h-8 text-emerald-600" />
              ) : (
                <UploadCloud className="w-8 h-8" />
              )}
            </div>

            {selectedFile ? (
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold mb-2">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Fichier prêt
                </div>
                <h4 className="text-base font-semibold text-slate-800">{selectedFile.name}</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {(selectedFile.size / 1024).toFixed(1)} Ko • Prêt pour l'analyse automatique
                </p>
              </div>
            ) : (
              <div>
                <h4 className="text-base font-semibold text-slate-800">
                  Glissez-déposez votre fiche ici
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  ou{' '}
                  <button
                    type="button"
                    onClick={handleSelectFileClick}
                    className="text-orange-600 hover:text-orange-700 font-semibold underline underline-offset-2 cursor-pointer"
                  >
                    cliquez pour sélectionner un fichier
                  </button>
                </p>
              </div>
            )}

            {/* Badges of accepted formats */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-[11px] font-medium text-slate-600">
                <FileText className="w-3 h-3 text-red-500" /> PDF
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-[11px] font-medium text-slate-600">
                <FileSpreadsheet className="w-3 h-3 text-emerald-600" /> Excel (.xlsx, .csv)
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-[11px] font-medium text-slate-600">
                <ImageIcon className="w-3 h-3 text-blue-500" /> Image (JPG, PNG)
              </span>
            </div>

            {/* Main Action Buttons */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={selectedFile ? handleStartAnalysis : handleSelectFileClick}
                className="w-full sm:w-auto px-6 py-2.5 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white text-sm font-semibold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <UploadCloud className="w-4 h-4" />
                {selectedFile ? 'Analyser cette fiche' : 'Sélectionner un fichier'}
              </button>
            </div>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Base progressive</h5>
              <p className="text-xs text-slate-600 mt-0.5">
                Pas besoin de liste préalable : les nouveaux étudiants, classes et matières sont créés automatiquement.
              </p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Anti-doublon intelligent</h5>
              <p className="text-xs text-slate-600 mt-0.5">
                Rapprochement phonétique et tolérance aux fautes de frappe pour relier les étudiants déjà existants.
              </p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Contrôle avant validation</h5>
              <p className="text-xs text-slate-600 mt-0.5">
                Le surveillant garde la main : vérifiez chaque séance, modifiez les motifs et validez en un clic.
              </p>
            </div>
          </div>
        </div>

        <ApiKeyConfigModal 
          isOpen={isApiKeyModalOpen} 
          onClose={() => setIsApiKeyModalOpen(false)} 
          onConfigSaved={refreshAiConfig} 
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: Phase 2: ANALYZING (7 Progressive Steps)
  // -------------------------------------------------------------
  if (phase === 'analyzing') {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 shadow-xs max-w-2xl mx-auto my-6">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xs animate-pulse">
            <RefreshCw className="w-7 h-7 animate-spin" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Analyse de la fiche en cours…</h3>
          <p className="text-xs text-slate-500 mt-1">
            Extraction intelligente des données selon les 7 étapes de conformité ISGG
          </p>
        </div>

        {/* 7 Progressive Steps List */}
        <div className="space-y-3">
          {ANALYSIS_STEPS.map((step, idx) => {
            const isDone = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;

            return (
              <div 
                key={step.id} 
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 ${
                  isDone 
                    ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900' 
                    : isCurrent 
                    ? 'bg-orange-50 border-orange-300 text-orange-950 shadow-xs' 
                    : 'bg-slate-50/60 border-slate-200 text-slate-400 opacity-60'
                }`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                  isDone 
                    ? 'bg-emerald-600 text-white' 
                    : isCurrent 
                    ? 'bg-orange-600 text-white ring-4 ring-orange-100 animate-pulse' 
                    : 'bg-slate-200 text-slate-500'
                }`}>
                  {isDone ? <Check className="w-4 h-4" /> : step.id}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold leading-tight">{step.label}</div>
                  <div className={`text-[11px] truncate ${isCurrent ? 'text-orange-700' : isDone ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {step.description}
                  </div>
                </div>

                {isCurrent && (
                  <div className="text-[11px] font-semibold text-orange-600 animate-pulse shrink-0">
                    En cours…
                  </div>
                )}
                {isDone && (
                  <div className="text-[11px] font-semibold text-emerald-600 shrink-0 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Fait
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: Phase 4: SUCCESS POST-VALIDATION
  // -------------------------------------------------------------
  if (phase === 'success' && savedStats) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center shadow-xs max-w-2xl mx-auto my-6 space-y-6">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
          <CheckCircle2 className="w-9 h-9" />
        </div>

        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold mb-2">
            <Check className="w-3.5 h-3.5" /> Enregistrement réussi
          </span>
          <h3 className="text-xl font-bold text-slate-900">
            {savedStats.absencesCount} absences enregistrées avec succès !
          </h3>
          <p className="text-xs text-slate-600 mt-1">
            Fiche de la journée du <strong>{formatFrenchDate(savedStats.sheetDate)}</strong> validée et intégrée dans le système d'assiduité de l'ISGG.
          </p>
        </div>

        {/* Stats card */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-left">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Absences</div>
            <div className="text-lg font-bold text-orange-600">{savedStats.absencesCount}</div>
            <div className="text-[11px] text-slate-500">Ajoutées aux dossiers</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Nouveaux étudiants</div>
            <div className="text-lg font-bold text-emerald-600">+{savedStats.newStudentsCount}</div>
            <div className="text-[11px] text-slate-500">Créés dans la base</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 col-span-2 sm:col-span-1">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Statut</div>
            <div className="text-lg font-bold text-slate-800">À jour</div>
            <div className="text-[11px] text-slate-500">Tableau de bord actualisé</div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleReset}
            className="w-full sm:w-auto px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            Importer une autre fiche
          </button>
          <button
            type="button"
            onClick={onGoToHistory}
            className="w-full sm:w-auto px-5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Clock className="w-4 h-4 text-slate-500" />
            Consulter l'historique des imports
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: Phase 3: REVIEW & INTERACTIVE VALIDATION TABLE
  // -------------------------------------------------------------
  if (!parsedData) return null;

  return (
    <div className="space-y-6">
      {/* 1. Header Summary Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 text-xs font-bold">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Fiche analysée
              </span>
              <span className="text-xs text-slate-500">•</span>
              <div className="flex items-center gap-1 text-xs font-bold text-slate-800">
                <Calendar className="w-3.5 h-3.5 text-orange-600" />
                Journée du {formatFrenchDate(parsedData.sheetDate)}
              </div>
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {parsedData.documentTitle || "Point des absents aux cours"}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Signataire : <strong>{parsedData.signatory}</strong> • Rapprochement progressif effectué
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Changer de fiche
            </button>
            <button
              type="button"
              onClick={handleConfirmAndSave}
              disabled={isSaving || allAbsenceItems.length === 0}
              className="px-4 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 active:bg-orange-800 disabled:opacity-50 rounded-lg shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Enregistrement en cours…
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Valider et enregistrer ({allAbsenceItems.length})
                </>
              )}
            </button>
          </div>
        </div>

        {/* Synthesis KPI Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Séances détectées</div>
            <div className="text-base font-bold text-slate-800 mt-0.5 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-blue-600" />
              {summaryStats.totalSessions} séances
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Absences à enregistrer</div>
            <div className="text-base font-bold text-orange-600 mt-0.5 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-orange-600" />
              {summaryStats.totalAbsents} absents
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Étudiants reconnus</div>
            <div className="text-base font-bold text-blue-700 mt-0.5 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-blue-600" />
              {summaryStats.exactMatches} connus
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Nouveaux étudiants</div>
            <div className="text-base font-bold text-emerald-700 mt-0.5 flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-emerald-600" />
              +{summaryStats.newStudents} à créer
            </div>
          </div>
        </div>
      </div>

      {/* High demand notice banner with 1-click BYOK opener */}
      {(parsedData as any)?.warningNotice && (
        <div className="bg-blue-50/90 border border-blue-200/90 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-blue-900 shadow-xs animate-in fade-in">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wide">Passez sur votre clé API personnelle (Optionnel)</h4>
              <p className="text-xs text-blue-800 mt-0.5">
                {(parsedData as any).warningNotice} Connectez votre clé Gemini, ChatGPT ou Claude pour des analyses instantanées sans file d&apos;attente.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsApiKeyModalOpen(true)}
            className="text-xs font-bold px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shrink-0 shadow-xs cursor-pointer"
          >
            Configurer ma clé API
          </button>
        </div>
      )}

      {/* Duplicate Session Warning if detected */}
      {summaryStats.hasDuplicateSession && !ignoreDuplicateWarning && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-amber-900">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-xs font-bold uppercase tracking-wide">Avertissement : Séances déjà enregistrées</h4>
            <p className="text-xs text-amber-800 mt-0.5">
              Certaines séances de cette fiche semblent avoir déjà fait l'objet d'un enregistrement le {formatFrenchDate(parsedData.sheetDate)}. 
              Vérifiez la liste ci-dessous pour éviter les doublons.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIgnoreDuplicateWarning(true)}
            className="text-xs font-semibold px-3 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-md transition-colors shrink-0"
          >
            Ignorer
          </button>
        </div>
      )}

      {/* 2. Structured Extraction by Sessions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-orange-600" />
            Séances extraites de la fiche ({parsedData.sessions.length})
          </h4>
          <span className="text-xs text-slate-500">
            Cliquez sur « Voir les absents » pour inspecter une séance
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {parsedData.sessions.map((session) => {
            const isExpanded = expandedSessionIds.has(session.id);

            return (
              <div 
                key={session.id} 
                className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all"
              >
                <div className="p-4 flex items-center justify-between gap-3 bg-slate-50/60 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800">
                        {session.className}
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        {session.subjectName}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {session.timeRange}
                      </span>
                      <span>•</span>
                      <span className="font-semibold text-orange-600">
                        {session.absentCount} absent{session.absentCount > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleSessionExpand(session.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" />
                        Masquer
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5" />
                        Voir les absents ({session.absentCount})
                      </>
                    )}
                  </button>
                </div>

                {isExpanded && (
                  <div className="p-3 bg-white divide-y divide-slate-100 text-xs">
                    {session.studentItems.map((item, idx) => (
                      <div key={item.tempId} className="py-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 text-[11px] text-slate-400 font-mono text-right">{idx + 1}.</span>
                          <span className="font-semibold text-slate-800 truncate">
                            {item.studentNameRaw}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {item.matchStatus === 'EXACT' && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-semibold">
                              <UserCheck className="w-3 h-3" /> Connu
                            </span>
                          )}
                          {item.matchStatus === 'NEW' && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-semibold">
                              <UserPlus className="w-3 h-3" /> Nouveau
                            </span>
                          )}
                          {item.matchStatus === 'PROBABLE' && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-semibold">
                              <AlertCircle className="w-3 h-3" /> À vérifier
                            </span>
                          )}
                          <span className="text-[11px] text-slate-500 italic">
                            {item.observations}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Detailed Master Verification Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-orange-600" />
              Tableau de vérification des absences ({filteredItems.length})
            </h4>
            <p className="text-xs text-slate-500">
              Vérifiez la liste nominative, ajustez les observations et confirmez les correspondances avant enregistrement
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveFilter('ALL')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                activeFilter === 'ALL'
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Toutes ({allAbsenceItems.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('KNOWN')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                activeFilter === 'KNOWN'
                  ? 'bg-blue-700 text-white'
                  : 'bg-white text-blue-700 hover:bg-blue-50 border border-blue-200'
              }`}
            >
              Connus ({summaryStats.exactMatches})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('NEW')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                activeFilter === 'NEW'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
              }`}
            >
              Nouveaux ({summaryStats.newStudents})
            </button>
            {summaryStats.probableMatches > 0 && (
              <button
                type="button"
                onClick={() => setActiveFilter('PROBABLE')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  activeFilter === 'PROBABLE'
                    ? 'bg-amber-700 text-white'
                    : 'bg-white text-amber-700 hover:bg-amber-50 border border-amber-200'
                }`}
              >
                À vérifier ({summaryStats.probableMatches})
              </button>
            )}
          </div>
        </div>

        {/* Mobile View: Cards list */}
        <div className="lg:hidden divide-y divide-slate-100">
          {filteredItems.map((item) => (
            <div key={item.tempId} className="p-4 space-y-3 hover:bg-slate-50/60 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-sm text-slate-900 leading-tight">
                    {item.studentNameRaw}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {item.lastName} • {item.firstName || 'Sans prénom'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveItem(item.sessionId, item.tempId)}
                  title="Supprimer cette ligne"
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Class & Subject */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 font-semibold text-[11px]">
                  {item.classNameRaw}
                </span>
                <span className="font-medium text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                  {item.subjectNameRaw}
                </span>
                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md">
                  <Clock className="w-3 h-3 text-slate-400" />
                  {item.startTime} – {item.endTime}
                </span>
              </div>

              {/* Match Resolution status on mobile */}
              <div className="pt-1">
                <div className="text-[11px] font-semibold text-slate-500 mb-1">Rapprochement base :</div>
                {item.matchStatus === 'EXACT' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 font-semibold text-xs">
                    <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                    Reconnu ({item.matchedStudentName})
                  </span>
                )}

                {item.matchStatus === 'NEW' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-semibold text-xs">
                    <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
                    + Nouvel étudiant à créer
                  </span>
                )}

                {item.matchStatus === 'PROBABLE' && (
                  <div className="space-y-1">
                    <select
                      value={item.matchedStudentId || 'NEW'}
                      onChange={(e) => handleResolveMatch(item.sessionId, item.tempId, e.target.value)}
                      className="w-full px-3 py-2 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="NEW">+ Créer comme nouvel étudiant</option>
                      {item.potentialMatches?.map(pm => (
                        <option key={pm.studentId} value={pm.studentId}>
                          Lier à : {pm.studentName} ({pm.matricule})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Editable Observation on Mobile */}
              <div className="pt-1">
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">Observation :</label>
                <input
                  type="text"
                  value={item.observations}
                  onChange={(e) => handleObservationChange(item.sessionId, item.tempId, e.target.value)}
                  placeholder="Ex: Justifié, certificat médical, retard..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Desktop View: Interactive Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-3">Étudiant extrait</th>
                <th className="px-4 py-3">Classe & Filière</th>
                <th className="px-4 py-3">Matière</th>
                <th className="px-4 py-3">Horaire</th>
                <th className="px-4 py-3">Observation</th>
                <th className="px-4 py-3">Rapprochement base</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((item) => (
                <tr key={item.tempId} className="hover:bg-slate-50/80 transition-colors">
                  {/* Student Name */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-bold text-slate-900">
                      {item.studentNameRaw}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {item.lastName} • {item.firstName || 'Sans prénom'}
                    </div>
                  </td>

                  {/* Class */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 font-medium text-[11px]">
                      {item.classNameRaw}
                    </span>
                  </td>

                  {/* Subject */}
                  <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-800">
                    {item.subjectNameRaw}
                  </td>

                  {/* Time Range */}
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                    <div className="flex items-center gap-1 font-mono text-[11px]">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {item.startTime} – {item.endTime}
                    </div>
                  </td>

                  {/* Editable Observation */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={item.observations}
                        onChange={(e) => handleObservationChange(item.sessionId, item.tempId, e.target.value)}
                        placeholder="Observation..."
                        className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-500 w-36"
                      />
                    </div>
                  </td>

                  {/* Match Resolution status */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {item.matchStatus === 'EXACT' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold text-[11px]">
                        <UserCheck className="w-3 h-3 text-blue-600" />
                        Reconnu ({item.matchedStudentName})
                      </span>
                    )}

                    {item.matchStatus === 'NEW' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-[11px]">
                        <UserPlus className="w-3 h-3 text-emerald-600" />
                        + Nouvel étudiant
                      </span>
                    )}

                    {item.matchStatus === 'PROBABLE' && (
                      <div className="flex items-center gap-1.5">
                        <select
                          value={item.matchedStudentId || 'NEW'}
                          onChange={(e) => handleResolveMatch(item.sessionId, item.tempId, e.target.value)}
                          className="px-2 py-1 bg-amber-50 border border-amber-300 text-amber-900 rounded text-xs font-medium focus:outline-none"
                        >
                          <option value="NEW">+ Créer comme nouveau</option>
                          {item.potentialMatches?.map(pm => (
                            <option key={pm.studentId} value={pm.studentId}>
                              {pm.studentName} ({pm.matricule})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </td>

                  {/* Remove Line */}
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.sessionId, item.tempId)}
                      title="Supprimer cette ligne"
                      className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Sticky Bottom Action Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-xs text-slate-600">
          <strong>{allAbsenceItems.length} absences</strong> prêtes à être enregistrées •{' '}
          <span className="text-emerald-700 font-semibold">+{summaryStats.newStudents} nouveaux étudiants</span> seront ajoutés à la base
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleReset}
            className="flex-1 sm:flex-none px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={handleConfirmAndSave}
            disabled={isSaving || allAbsenceItems.length === 0}
            className="flex-1 sm:flex-none px-5 py-2 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Enregistrement…
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Valider et enregistrer ({allAbsenceItems.length} absences)
              </>
            )}
          </button>
        </div>
      </div>

      <ApiKeyConfigModal 
        isOpen={isApiKeyModalOpen} 
        onClose={() => setIsApiKeyModalOpen(false)} 
        onConfigSaved={refreshAiConfig} 
      />
    </div>
  );
};
