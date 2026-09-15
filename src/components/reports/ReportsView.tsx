import React, { useState, useMemo, useRef } from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  Calendar, 
  Filter, 
  Building, 
  GraduationCap, 
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldAlert,
  CalendarRange,
  Users,
  BookOpen,
  Eye,
  CheckCircle,
  FileDown,
  Loader2,
  Send,
  MessageSquare,
  Sparkles,
  X,
  ExternalLink,
  Clock,
  UserCheck,
  Check
} from 'lucide-react';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import { ISGG_LOGO_DATA_URL } from '../../lib/isggLogo';
import { storage, formatFrenchDate, formatISODate } from '../../lib/storage';
import { useToast } from '../common/Toast';
import { Subject, Level, Program, Student, StudentWithStats, SystemSettings, ConvocationStatus, ConvocationRecord } from '../../types';

interface ReportsViewProps {
  onNavigateToStudent?: (studentId: string) => void;
}

interface GroupedSessionItem {
  absenceId: string;
  student: Student;
  lastName: string;
  firstName: string;
  observations: string;
  justified?: boolean;
}

const CONVOCATION_STATUS_CONFIG: Record<
  ConvocationStatus,
  { label: string; shortLabel: string; bg: string; text: string; border: string; dot: string }
> = {
  a_convoquer: {
    label: 'À convoquer',
    shortLabel: 'À convoquer',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
  },
  envoyee: {
    label: 'Convocation envoyée',
    shortLabel: 'Envoyée',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
  en_attente: {
    label: 'En attente des parents',
    shortLabel: 'En attente',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  traite: {
    label: 'Parent déjà passé / Traité',
    shortLabel: 'Parent passé',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
};

interface GroupedSession {
  key: string;
  className: string;
  subjectName: string;
  timeRange: string;
  dateStr: string;
  items: GroupedSessionItem[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({ onNavigateToStudent }) => {
  const { showToast } = useToast();
  const printDocumentRef = useRef<HTMLDivElement>(null);
  const singleConvocationRef = useRef<HTMLDivElement>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingConvocationPDF, setIsExportingConvocationPDF] = useState(false);
  const [reportType, setReportType] = useState<'daily' | 'weekly' | 'monthly' | 'discipline' | 'exam-exclusion'>('daily');
  const [storageTrigger, setStorageTrigger] = useState(0);

  // Discipline Filter: 'all' | 'critical' | 'warning'
  const [disciplineTab, setDisciplineTab] = useState<'all' | 'critical' | 'warning'>('all');
  // Convocation lifecycle filter: 'all' | 'pending' | 'resolved'
  const [convocationFilter, setConvocationFilter] = useState<'all' | 'pending' | 'resolved'>('all');

  // Modals for student actions
  const [selectedStudentForConvocation, setSelectedStudentForConvocation] = useState<StudentWithStats | null>(null);
  const [selectedStudentForMessage, setSelectedStudentForMessage] = useState<StudentWithStats | null>(null);
  const [customParentMessage, setCustomParentMessage] = useState<string>('');

  // Status update modal state
  const [selectedStudentForStatusModal, setSelectedStudentForStatusModal] = useState<StudentWithStats | null>(null);
  const [editingStatus, setEditingStatus] = useState<ConvocationStatus>('a_convoquer');
  const [editingNote, setEditingNote] = useState<string>('');

  React.useEffect(() => {
    return storage.subscribe(() => {
      setStorageTrigger(prev => prev + 1);
    });
  }, []);

  const systemSettings = useMemo(() => storage.getSystemSettings(), [storageTrigger]);

  // Helper to remove any tautology like '1ère année (Licence 1)' -> 'Licence 1'
  const cleanLevelName = (name?: string) => {
    if (!name) return '';
    return name.replace(/^[0-9]+[èe]me?\s+année\s*\((Licence\s+[0-9]+)\)/i, '$1');
  };

  // Shared Data
  const programs = useMemo(() => storage.getPrograms(), [storageTrigger]);
  const levels = useMemo(() => storage.getLevels(), [storageTrigger]);
  const allSubjects = useMemo(() => storage.getAllSubjects(), [storageTrigger]);
  const allAbsences = useMemo(() => storage.getAbsencesWithDetails(), [storageTrigger]);
  const students = useMemo(() => storage.getStudents().map(s => storage.getStudentWithStats(s.id)!), [storageTrigger]);

  // Convocations mapping
  const convocationsMap = useMemo(() => {
    return storage.getAllConvocations();
  }, [storageTrigger]);

  // Global & Standard Reports Filters (Daily, Weekly, Monthly)
  const defaultToday = formatISODate(new Date());
  const [dailyDate, setDailyDate] = useState<string>('2026-09-09');
  const [weeklyStartDate, setWeeklyStartDate] = useState<string>('2026-09-07');
  const [weeklyEndDate, setWeeklyEndDate] = useState<string>('2026-09-13');
  const [monthlyYearMonth, setMonthlyYearMonth] = useState<string>('2026-09');

  const [selectedProgram, setSelectedProgram] = useState<string>('all');
  const [selectedLevelId, setSelectedLevelId] = useState<string>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [surveillantName, setSurveillantName] = useState<string>('M. Nicaise AÏZOUN');

  // Exam Exclusion filters
  const [examProgramId, setExamProgramId] = useState<string>(() => programs[0]?.id || 'prog-gi');
  const [examLevelId, setExamLevelId] = useState<string>(() => levels[1]?.id || 'lvl-l2');
  const [examClassGroup, setExamClassGroup] = useState<string>('all');

  // Dynamic subjects for chosen program and level
  const availableExamSubjects = useMemo(() => {
    const list = allSubjects.filter(s => s.programId === examProgramId && s.levelId === examLevelId);
    if (list.length > 0) return list;
    return allSubjects.filter(s => s.programId === examProgramId);
  }, [allSubjects, examProgramId, examLevelId]);

  const [examSubjectId, setExamSubjectId] = useState<string>(() => availableExamSubjects[0]?.id || '');

  // Keep examSubjectId in sync when program or level changes
  React.useEffect(() => {
    if (availableExamSubjects.length > 0 && !availableExamSubjects.some(s => s.id === examSubjectId)) {
      setExamSubjectId(availableExamSubjects[0].id);
    }
  }, [availableExamSubjects, examSubjectId]);

  // Exam evaluation period (from semester start to exam date)
  const defaultStartDate = storage.getSchoolYear()?.startDate || '2026-09-01';
  const defaultEndDate = formatISODate(new Date());
  const [examStartDate, setExamStartDate] = useState<string>(defaultStartDate);
  const [examEndDate, setExamEndDate] = useState<string>(defaultEndDate);
  const [examTime, setExamTime] = useState<string>('12h00');
  const [showAuditDetails, setShowAuditDetails] = useState<boolean>(false);

  // Helper to resolve an absence's subject
  const getSubjectForAbsence = (abs: { subjectId: string; startTime?: string; absenceTime?: string; className?: string; levelId?: string }) => {
    let sub = allSubjects.find(s => s.id === abs.subjectId);
    if (sub) return sub;
    if ((abs.startTime === '08:00' || abs.absenceTime?.startsWith('08')) && (abs.className?.includes('SIL2') || abs.levelId === 'lvl-l2')) {
      const ceo = allSubjects.find(s => s.id === 'sub-l2-communication-ecrite-2');
      if (ceo) return ceo;
    }
    if ((abs.startTime === '13:00' || abs.absenceTime?.startsWith('13')) && (abs.className?.includes('SIL2') || abs.levelId === 'lvl-l2')) {
      const alg = allSubjects.find(s => s.id === 'sub-l2-algebre-lineaire');
      if (alg) return alg;
    }
    return undefined;
  };

  // Exam eligibility computation for all students of selected cohort
  const examCohortEligibility = useMemo(() => {
    const cohortStudents = students.filter(s => {
      if (s.programId !== examProgramId) return false;
      if (s.levelId !== examLevelId) return false;
      if (examClassGroup !== 'all' && (s.classGroup || 'A') !== examClassGroup) return false;
      return true;
    });

    const results = cohortStudents.map(student => {
      const subjectAbsences = (student.recentAbsences || []).filter(a => {
        if (examStartDate && a.absenceDate < examStartDate) return false;
        if (examEndDate && a.absenceDate > examEndDate) return false;

        const resolvedSub = getSubjectForAbsence({ ...a, levelId: student.levelId });
        const subId = resolvedSub ? resolvedSub.id : a.subjectId;
        return subId === examSubjectId;
      });

      // Exclusion rule: justified absences DO NOT disqualify the student
      const unjustifiedCount = subjectAbsences.filter(a => !a.justified).length;
      const justifiedCount = subjectAbsences.filter(a => a.justified).length;
      const isDisqualified = unjustifiedCount > systemSettings.examExclusionLimit;

      return {
        student,
        unjustifiedCount,
        justifiedCount,
        totalAbsences: subjectAbsences.length,
        isDisqualified,
        absences: subjectAbsences,
      };
    });

    const disqualified = results.filter(r => r.isDisqualified).sort((a, b) => b.unjustifiedCount - a.unjustifiedCount);
    const qualified = results.filter(r => !r.isDisqualified).sort((a, b) => a.student.lastName.localeCompare(b.student.lastName, 'fr'));

    return {
      totalStudents: cohortStudents.length,
      disqualified,
      qualified,
      all: results,
    };
  }, [students, examProgramId, examLevelId, examClassGroup, examSubjectId, examStartDate, examEndDate, allSubjects, systemSettings.examExclusionLimit]);

  // Selected subject metadata for exam
  const currentExamSubject = useMemo(() => {
    return allSubjects.find(s => s.id === examSubjectId);
  }, [allSubjects, examSubjectId]);

  const currentExamProgram = useMemo(() => {
    return programs.find(p => p.id === examProgramId);
  }, [programs, examProgramId]);

  const currentExamLevel = useMemo(() => {
    return levels.find(l => l.id === examLevelId);
  }, [levels, examLevelId]);

  const computedExamClassName = useMemo(() => {
    const pCode = currentExamProgram?.code || '';
    const lCode = currentExamLevel?.code ? currentExamLevel.code.replace('lvl-l', '').replace('lvl-', '') : '';
    const grp = examClassGroup !== 'all' ? ` / ${examClassGroup}` : '';
    return `${pCode}${lCode}${grp}`.trim() || 'GI1';
  }, [currentExamProgram, currentExamLevel, examClassGroup]);

  const formattedExamDateTitle = useMemo(() => {
    if (!examEndDate) return '';
    try {
      const parts = examEndDate.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase();
      }
    } catch {
      // fallback
    }
    return examEndDate;
  }, [examEndDate]);

  // Filtered absences by period and program (for Daily, Weekly, Monthly)
  const reportData = useMemo(() => {
    return allAbsences.filter(a => {
      if (selectedProgram !== 'all' && a.program.id !== selectedProgram) return false;
      if (selectedLevelId !== 'all' && a.level.id !== selectedLevelId) return false;
      if (selectedGroup !== 'all' && (a.student.classGroup || 'A') !== selectedGroup) return false;

      if (reportType === 'daily') {
        return a.absenceDate === dailyDate;
      }
      if (reportType === 'weekly') {
        return a.absenceDate >= weeklyStartDate && a.absenceDate <= weeklyEndDate;
      }
      if (reportType === 'monthly') {
        return a.absenceDate.startsWith(monthlyYearMonth);
      }
      return true;
    });
  }, [allAbsences, selectedProgram, selectedLevelId, selectedGroup, reportType, dailyDate, weeklyStartDate, weeklyEndDate, monthlyYearMonth]);

  // Grouped Course Sessions for Daily, Weekly, Monthly (ISGG Official Template format)
  const groupedSessions = useMemo(() => {
    const map = new Map<string, GroupedSession>();

    reportData.forEach(a => {
      // Official Class Name (e.g. "GI / SIL2_A")
      let cName = a.className;
      if (!cName) {
        const pCode = a.program?.code || 'GI';
        const lCode = a.level?.code === 'L2' || a.level?.id === 'lvl-l2' ? 'SIL2' : a.level?.code || 'L1';
        const grp = a.student.classGroup || 'A';
        cName = `${pCode} / ${lCode}_${grp}`;
      }

      // Official Subject Name (e.g. "CEO II", "Algèbre linéaire")
      let subName = a.subject?.code || a.subject?.name || 'Matière';
      if (subName.includes('CEO II') || subName.includes('Communication Écrite et Orale 2')) {
        subName = 'CEO II';
      } else if (subName.includes('Algèbre') || subName.includes('Algebre')) {
        subName = 'Algèbre linéaire';
      }

      // Official Time Range (e.g. "08h à 12h", "13h à 17h")
      let tRange = a.timeRange;
      if (!tRange) {
        if (a.startTime && a.endTime) {
          tRange = `${a.startTime.replace(':00', 'h')} à ${a.endTime.replace(':00', 'h')}`;
        } else if (a.absenceTime?.startsWith('08') || a.absenceTime?.startsWith('09') || a.absenceTime?.startsWith('10') || a.absenceTime?.startsWith('11')) {
          tRange = '08h à 12h';
        } else if (a.absenceTime?.startsWith('13') || a.absenceTime?.startsWith('14') || a.absenceTime?.startsWith('15') || a.absenceTime?.startsWith('16')) {
          tRange = '13h à 17h';
        } else {
          tRange = a.absenceTime || '08h à 12h';
        }
      }

      // Grouping key: date + class + subject + time
      const sessionKey = `${a.absenceDate}_${cName}_${subName}_${tRange}`;
      if (!map.has(sessionKey)) {
        map.set(sessionKey, {
          key: sessionKey,
          className: cName,
          subjectName: subName,
          timeRange: tRange,
          dateStr: a.absenceDate,
          items: [],
        });
      }

      const session = map.get(sessionKey)!;
      session.items.push({
        absenceId: a.id,
        student: a.student,
        lastName: a.student.lastName.toUpperCase(),
        firstName: a.student.firstName,
        observations: a.observations || (a.justified ? (a.justificationReason || 'Justifiée') : 'Sans motif'),
        justified: a.justified,
      });
    });

    return Array.from(map.values()).sort((a, b) => {
      if (a.dateStr !== b.dateStr) return a.dateStr.localeCompare(b.dateStr);
      if (a.className !== b.className) return a.className.localeCompare(b.className);
      return a.timeRange.localeCompare(b.timeRange);
    });
  }, [reportData]);

  // Official Box Title calculation
  const formattedOfficialTitle = useMemo(() => {
    if (reportType === 'daily') {
      try {
        const parts = dailyDate.split('-');
        if (parts.length === 3) {
          const dd = parts[2];
          const mm = parts[1];
          const yy = parts[0].slice(-2);
          return `POINT DES ABSENTS AUX COURS DE LA JOURNEE DU ${dd}/${mm}/${yy}`;
        }
      } catch {}
      return `POINT DES ABSENTS AUX COURS DE LA JOURNEE DU ${dailyDate}`;
    }

    if (reportType === 'weekly') {
      try {
        const p1 = weeklyStartDate.split('-');
        const p2 = weeklyEndDate.split('-');
        const s1 = `${p1[2]}/${p1[1]}/${p1[0].slice(-2)}`;
        const s2 = `${p2[2]}/${p2[1]}/${p2[0].slice(-2)}`;
        return `POINT DES ABSENTS AUX COURS DE LA SEMAINE DU ${s1} AU ${s2}`;
      } catch {}
      return `POINT DES ABSENTS AUX COURS DE LA SEMAINE DU ${weeklyStartDate} AU ${weeklyEndDate}`;
    }

    if (reportType === 'monthly') {
      try {
        const parts = monthlyYearMonth.split('-');
        const year = parts[0];
        const monthIdx = parseInt(parts[1], 10) - 1;
        const monthNames = [
          'JANVIER', 'FÉVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN',
          'JUILLET', 'AOÛT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DÉCEMBRE'
        ];
        const monthName = monthNames[monthIdx] || parts[1];
        return `POINT DES ABSENTS AUX COURS DU MOIS DE ${monthName} ${year}`;
      } catch {}
      return `POINT DES ABSENTS AUX COURS DU MOIS DE ${monthlyYearMonth}`;
    }

    if (reportType === 'discipline') {
      return 'DOSSIER OFFICIEL DES ALERTES DISCIPLINAIRES & CONVOCATIONS';
    }

    return `POINT DES ÉTUDIANTS DISQUALIFIÉS AUX EXAMENS : DU ${formattedExamDateTitle || examEndDate}`;
  }, [reportType, dailyDate, weeklyStartDate, weeklyEndDate, monthlyYearMonth, formattedExamDateTitle, examEndDate]);

  // Students exceeding threshold (Critical discipline)
  const studentsAtRisk = useMemo(() => {
    return students
      .filter(s => s.annualAbsenceCount >= systemSettings.disciplineThreshold)
      .sort((a, b) => b.annualAbsenceCount - a.annualAbsenceCount);
  }, [students, systemSettings.disciplineThreshold]);

  // Active count for tab badge (decrements automatically when a student's convocation is marked as 'traite'!)
  const activeConvocationsCount = useMemo(() => {
    return studentsAtRisk.filter(s => {
      const status = convocationsMap[s.id]?.status || 'a_convoquer';
      return status !== 'traite';
    }).length;
  }, [studentsAtRisk, convocationsMap]);

  // Students in preventive warning
  const studentsInWarning = useMemo(() => {
    return students
      .filter(s => s.annualAbsenceCount >= systemSettings.warningThreshold && s.annualAbsenceCount < systemSettings.disciplineThreshold)
      .sort((a, b) => b.annualAbsenceCount - a.annualAbsenceCount);
  }, [students, systemSettings.warningThreshold, systemSettings.disciplineThreshold]);

  // Filtered list for discipline view based on user selection and lifecycle status
  const displayedDisciplineStudents = useMemo(() => {
    let list: StudentWithStats[] = [];
    if (disciplineTab === 'critical') list = studentsAtRisk;
    else if (disciplineTab === 'warning') list = studentsInWarning;
    else list = [...studentsAtRisk, ...studentsInWarning];

    if (convocationFilter === 'pending') {
      list = list.filter(s => (convocationsMap[s.id]?.status || 'a_convoquer') !== 'traite');
    } else if (convocationFilter === 'resolved') {
      list = list.filter(s => convocationsMap[s.id]?.status === 'traite');
    }

    return list.sort((a, b) => b.annualAbsenceCount - a.annualAbsenceCount);
  }, [disciplineTab, convocationFilter, studentsAtRisk, studentsInWarning, convocationsMap]);

  const handleExportCSV = () => {
    if (reportType === 'exam-exclusion') {
      const headers = [
        'N°',
        'Nom et Prénoms',
        'Observations',
        'Classe',
        'Examen_De',
        'Horaire',
        'Matricule',
        'Absences_Non_Justifiees',
        'Absences_Justifiees',
        'Dates_Absences'
      ];
      const rows = examCohortEligibility.disqualified.map((item, index) => {
        const datesStr = item.absences.map(a => `${a.absenceDate}(${a.justified ? 'J' : 'NJ'})`).join('; ');
        const className = `${currentExamProgram?.code || ''}${currentExamLevel?.code ? currentExamLevel.code.replace('lvl-', '') : ''} ${examClassGroup !== 'all' ? `/ ${examClassGroup}` : ''}`.trim();
        return [
          index + 1,
          `"${item.student.lastName.toUpperCase()} ${item.student.firstName}"`,
          `"Absences au cours"`,
          `"${className}"`,
          `"${currentExamSubject?.name || ''}"`,
          `"${examTime}"`,
          item.student.matricule,
          item.unjustifiedCount,
          item.justifiedCount,
          `"${datesStr}"`,
        ];
      });

      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `isgg_etudiants_disqualifies_${currentExamSubject?.name?.replace(/\s+/g, '_') || 'examen'}_${examEndDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Point officiel des étudiants disqualifiés (CSV) téléchargé', 'success');
      return;
    }

    if (reportType === 'daily' || reportType === 'weekly' || reportType === 'monthly') {
      const headers = ['N°', 'Classe', 'Matière', 'Horaire', 'Date', 'Nom', 'Prénoms', 'Observations'];
      const rows: string[][] = [];
      let counter = 1;

      groupedSessions.forEach(session => {
        session.items.forEach(item => {
          rows.push([
            String(counter++),
            `"${session.className}"`,
            `"${session.subjectName}"`,
            `"${session.timeRange}"`,
            session.dateStr,
            `"${item.lastName}"`,
            `"${item.firstName}"`,
            `"${item.observations}"`,
          ]);
        });
      });

      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `isgg_point_des_absents_${reportType}_${dailyDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Point officiel des absents (CSV) téléchargé', 'success');
      return;
    }

    // Default export
    const headers = ['Date', 'Heure', 'Matricule', 'Nom', 'Prenom', 'Filiere', 'Niveau', 'Matiere', 'Surveillant'];
    const rows = reportData.map(a => [
      a.absenceDate,
      a.absenceTime,
      a.student.matricule,
      `"${a.student.lastName}"`,
      `"${a.student.firstName}"`,
      `"${a.program.name}"`,
      `"${a.level.name}"`,
      `"${a.subject.name}"`,
      `"${a.recordedByName}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `isgg_rapport_${reportType}_${dailyDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Rapport CSV téléchargé avec succès', 'success');
  };

  interface PaginatedReportPage {
    isFirstPage: boolean;
    contentHtml: string;
    hasSignature: boolean;
  }

  // Pure HTML Templating & Unified A4 Pagination Engine (Modeled after StudentProfileModal)
  const getOfficialReportHeaderHtml = (isFirstPage: boolean) => {
    if (isFirstPage) {
      return `
        <div>
          <!-- En-tête officiel ISGG -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 8px; border-bottom: 2px solid #0f172a;">
            <div style="display: flex; flex-direction: column; align-items: center;">
              <img src="${ISGG_LOGO_DATA_URL}" alt="Logo ISGG" style="height: 52px; width: auto; object-fit: contain;" />
              <span style="font-size: 10px; font-style: italic; font-family: serif; color: #1e293b; margin-top: 2px;">
                Les vertus de la réussite
              </span>
            </div>
            <div style="text-align: right; max-width: 480px;">
              <h1 style="font-size: 13px; font-weight: 900; text-transform: uppercase; font-family: serif; margin: 0; color: #020617; line-height: 1.2;">
                INSTITUT SUPERIEUR DE GENIE CIVIL ET DE GESTION
              </h1>
              <div style="margin-top: 4px; padding: 4px 6px; border: 1px solid #cbd5e1; border-radius: 4px; background: #f8fafc; font-size: 7.5px; line-height: 1.2; text-align: left;">
                <p style="font-weight: bold; margin: 0 0 2px 0;">Autorisations de l'État :</p>
                <p style="margin: 0;">• Avis favorable CNE N°2021-0281/CNE/PCQR/SE</p>
                <p style="margin: 0;">• Notification DGES N°2308/MESRS/DC/SGM/DGES/SA</p>
                <p style="margin: 0;">• Arrêté MESRS N°0272/MESRS/DC/SGM/DGES/CTJ/CJSA/021 S0022</p>
              </div>
            </div>
          </div>

          <!-- Titre officiel encadré -->
          <div style="border: 2px solid #000; padding: 6px 12px; text-align: center; margin: 10px 0 12px 0; background: #ffffff;">
            <h2 style="font-size: 12px; font-weight: 900; text-transform: uppercase; margin: 0; letter-spacing: 0.5px; color: #000;">
              ${formattedOfficialTitle}
            </h2>
          </div>
        </div>
      `;
    }

    return `
      <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 6px; margin-bottom: 10px; border-bottom: 2px solid #0f172a; font-family: system-ui, sans-serif;">
        <span style="font-size: 11px; font-weight: 900; text-transform: uppercase; color: #000;">
          INSTITUT SUPERIEUR DE GENIE CIVIL ET DE GESTION (ISGG)
        </span>
        <span style="font-size: 9px; font-weight: bold; color: #475569; font-style: italic;">
          ${formattedOfficialTitle} — (Suite)
        </span>
      </div>
    `;
  };

  const getOfficialReportSignatureHtml = () => {
    const reportDateStr = formatFrenchDate(
      reportType === 'daily'
        ? dailyDate
        : reportType === 'weekly'
        ? weeklyEndDate
        : reportType === 'monthly'
        ? `${monthlyYearMonth}-28`
        : examEndDate
    );

    return `
      <div style="display: flex; justify-content: flex-end; margin-top: 14px; break-inside: avoid; page-break-inside: avoid;">
        <div style="width: 280px; text-align: center;">
          <p style="font-size: 9.5px; font-weight: bold; margin: 0; color: #000;">
            Fait à Calavi, le ${reportDateStr}
          </p>
          <p style="font-size: 9.5px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; margin: 2px 0 0 0; color: #000;">
            Le Surveillant Général
          </p>
          <div style="height: 48px;"></div>
          <p style="font-size: 10.5px; font-weight: 900; text-transform: uppercase; text-decoration: underline; margin: 0; color: #020617;">
            ${surveillantName || 'Le Surveillant Général'}
          </p>
        </div>
      </div>
    `;
  };

  const getOfficialReportFooterHtml = (pageNum: number, totalPages: number) => {
    return `
      <div class="print-page-footer" style="margin-top: auto !important; padding-top: 6px; border-top: 2px solid #ea580c; font-size: 8px; line-height: 1.25; text-align: center; color: #334155; width: 100%;">
        <div style="display: flex; justify-content: space-between; font-size: 8.5px; font-weight: bold; color: #64748b; margin-bottom: 2px; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px;">
          <span>Institut Supérieur de Génie Civil et de Gestion (ISGG)</span>
          <span>Page ${pageNum} / ${totalPages}</span>
        </div>
        <p style="margin: 0; font-weight: 500;">
          Siège : Ab-Calavi, Aganmandin, Immeuble BOA, 1er et 2ème étages, BP : 1938 Abomey-Calavi
        </p>
        <p style="margin: 1px 0 0 0; font-weight: bold; color: #0f172a;">
          E-mail : isgg229@gmail.com - IFU : 3202346783540 - Tel. : 97 00 67 67 / 94 00 40 40
        </p>
      </div>
    `;
  };

  // Generates clean HTML blocks for the report content
  const generateReportHtmlBlocks = (): string[] => {
    const blocks: string[] = [];

    if (reportType === 'exam-exclusion') {
      // Header for Exam Disqualification
      const examHeader = `
        <div style="text-align: center; font-weight: bold; font-size: 10px; color: #000; padding: 4px 0 6px 0; border-bottom: 1px dashed #cbd5e1; margin-bottom: 8px; display: flex; justify-content: center; gap: 24px; flex-wrap: wrap;">
          <div><span style="text-decoration: underline;">Classe</span> : <strong style="text-transform: uppercase;">${computedExamClassName}</strong></div>
          <div><span style="text-decoration: underline;">EXAMEN DE</span> : <strong style="text-transform: uppercase;">${currentExamSubject?.name || 'Matière'}</strong></div>
          <div><span style="text-decoration: underline;">Horaire</span> : <strong>${examTime}</strong></div>
        </div>
      `;

      const disqualified = examCohortEligibility.disqualified;
      if (disqualified.length === 0) {
        blocks.push(`
          ${examHeader}
          <div style="border: 1px solid #000; padding: 20px; text-align: center; color: #065f46; font-size: 11px; font-weight: bold;">
            Aucun étudiant exclu. Tous les inscrits de la classe sont autorisés à composer (${examCohortEligibility.qualified.length} étudiants éligibles).
          </div>
        `);
      } else {
        // Chunk table into rows to prevent page overflows
        const ROWS_PER_BLOCK = 18;
        for (let i = 0; i < disqualified.length; i += ROWS_PER_BLOCK) {
          const chunk = disqualified.slice(i, i + ROWS_PER_BLOCK);
          const isFirstChunk = i === 0;

          blocks.push(`
            ${isFirstChunk ? examHeader : ''}
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 9.5px; line-height: 1.25; margin-bottom: 8px;">
              <thead>
                <tr style="background: #f1f5f9;">
                  <th style="border: 1px solid #000; padding: 4px 6px; width: 36px; text-align: center; font-weight: 900;">N°</th>
                  <th style="border: 1px solid #000; padding: 4px 6px; text-align: left; font-weight: 900;">Nom et Prénoms</th>
                  <th style="border: 1px solid #000; padding: 4px 6px; width: 170px; text-align: center; font-weight: 900;">Observations</th>
                </tr>
              </thead>
              <tbody>
                ${chunk.map((item, idx) => `
                  <tr>
                    <td style="border: 1px solid #000; padding: 4px 6px; text-align: center; font-weight: bold;">${i + idx + 1}</td>
                    <td style="border: 1px solid #000; padding: 4px 6px; font-weight: 900; text-transform: uppercase;">
                      ${item.student.lastName} ${item.student.firstName}
                    </td>
                    <td style="border: 1px solid #000; padding: 4px 6px; text-align: center;">
                      Absences au cours
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `);
        }
      }
      return blocks;
    }

    if (reportType === 'daily' || reportType === 'weekly' || reportType === 'monthly') {
      if (groupedSessions.length === 0) {
        blocks.push(`
          <div style="border: 1px solid #000; padding: 24px; text-align: center; color: #475569; font-style: italic; font-size: 11px;">
            Aucun absent enregistré pour les cours de cette sélection.
          </div>
        `);
        return blocks;
      }

      groupedSessions.forEach(session => {
        const sessionMetaHtml = `
          <div style="font-weight: bold; font-size: 10px; color: #000; padding-top: 4px; margin-bottom: 3px; display: flex; gap: 16px; flex-wrap: wrap;">
            <div><span style="text-decoration: underline;">Classe</span> : <strong style="text-transform: uppercase;">${session.className}</strong></div>
            <div><span style="text-decoration: underline;">Matière</span> : <strong style="text-transform: uppercase;">${session.subjectName}</strong></div>
            <div><span style="text-decoration: underline;">Horaire</span> : <strong>${session.timeRange}</strong></div>
            ${reportType !== 'daily' ? `<div><span style="text-decoration: underline;">Date</span> : <strong>${session.dateStr}</strong></div>` : ''}
          </div>
        `;

        const ROWS_PER_SESSION_BLOCK = 14;
        for (let i = 0; i < session.items.length; i += ROWS_PER_SESSION_BLOCK) {
          const chunk = session.items.slice(i, i + ROWS_PER_SESSION_BLOCK);
          const isFirstChunk = i === 0;

          blocks.push(`
            <div style="margin-bottom: 8px;">
              ${isFirstChunk ? sessionMetaHtml : `<div style="font-size: 8.5px; font-weight: bold; color: #64748b; margin-bottom: 2px;">${session.className} — ${session.subjectName} (Suite)</div>`}
              <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 9.5px; line-height: 1.25;">
                <thead>
                  <tr style="background: #f1f5f9;">
                    <th style="border: 1px solid #000; padding: 4px 6px; width: 36px; text-align: center; font-weight: 900;">N°</th>
                    <th style="border: 1px solid #000; padding: 4px 6px; text-align: center; font-weight: 900;">Nom</th>
                    <th style="border: 1px solid #000; padding: 4px 6px; text-align: center; font-weight: 900;">Prénoms</th>
                    <th style="border: 1px solid #000; padding: 4px 6px; width: 170px; text-align: center; font-weight: 900;">Observations</th>
                  </tr>
                </thead>
                <tbody>
                  ${chunk.map((item, idx) => `
                    <tr>
                      <td style="border: 1px solid #000; padding: 3px 5px; text-align: center; font-weight: bold;">${i + idx + 1}</td>
                      <td style="border: 1px solid #000; padding: 3px 5px; text-align: center; font-weight: 900; text-transform: uppercase;">
                        ${item.lastName}
                      </td>
                      <td style="border: 1px solid #000; padding: 3px 5px; text-align: center;">
                        ${item.firstName}
                      </td>
                      <td style="border: 1px solid #000; padding: 3px 5px; text-align: center;">
                        ${item.observations}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `);
        }
      });
      return blocks;
    }

    // Branch: Discipline Alerts
    if (displayedDisciplineStudents.length === 0) {
      blocks.push(`
        <div style="border: 1px solid #000; padding: 24px; text-align: center; color: #475569; font-style: italic; font-size: 11px;">
          Aucun étudiant dans cette catégorie d'alerte.
        </div>
      `);
      return blocks;
    }

    const ROWS_PER_DISCIPLINE_BLOCK = 16;
    for (let i = 0; i < displayedDisciplineStudents.length; i += ROWS_PER_DISCIPLINE_BLOCK) {
      const chunk = displayedDisciplineStudents.slice(i, i + ROWS_PER_DISCIPLINE_BLOCK);

      blocks.push(`
        <div style="margin-bottom: 8px;">
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 9px; line-height: 1.25;">
            <thead>
              <tr style="background: #f1f5f9;">
                <th style="border: 1px solid #000; padding: 4px 5px; width: 32px; text-align: center; font-weight: 900;">N°</th>
                <th style="border: 1px solid #000; padding: 4px 5px; width: 75px; text-align: left; font-weight: 900;">Matricule</th>
                <th style="border: 1px solid #000; padding: 4px 5px; text-align: left; font-weight: 900;">Nom et Prénoms</th>
                <th style="border: 1px solid #000; padding: 4px 5px; text-align: left; font-weight: 900;">Filière / Niveau</th>
                <th style="border: 1px solid #000; padding: 4px 5px; width: 85px; text-align: center; font-weight: 900;">Total Absences</th>
                <th style="border: 1px solid #000; padding: 4px 5px; width: 140px; text-align: center; font-weight: 900;">Palier / Décision</th>
              </tr>
            </thead>
            <tbody>
              ${chunk.map((s, idx) => {
                const isCritical = s.annualAbsenceCount >= systemSettings.disciplineThreshold;
                return `
                  <tr>
                    <td style="border: 1px solid #000; padding: 3px 5px; text-align: center; font-weight: bold;">${i + idx + 1}</td>
                    <td style="border: 1px solid #000; padding: 3px 5px; font-family: monospace; font-weight: bold;">${s.matricule}</td>
                    <td style="border: 1px solid #000; padding: 3px 5px; font-weight: 900; text-transform: uppercase;">${s.lastName} ${s.firstName}</td>
                    <td style="border: 1px solid #000; padding: 3px 5px;">${s.programName} (${cleanLevelName(s.levelName)})</td>
                    <td style="border: 1px solid #000; padding: 3px 5px; text-align: center; font-weight: 900; color: #b91c1c;">
                      ${s.annualAbsenceCount} absences
                    </td>
                    <td style="border: 1px solid #000; padding: 3px 5px; text-align: center; font-weight: 900; text-transform: uppercase; ${isCritical ? 'color: #b91c1c;' : 'color: #b45309;'}">
                      ${isCritical ? 'Convocation officielle' : 'Avertissement préventif'}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `);
    }

    return blocks;
  };

  // Unified A4 Pagination Engine: shared between PDF export and physical printing
  const paginateReportDocument = () => {
    const A4_WIDTH = 800;
    const A4_HEIGHT = 1131;
    const PADDING = 26;
    const FOOTER_SPACE = 72;
    const USABLE_HEIGHT = A4_HEIGHT - (PADDING * 2) - FOOTER_SPACE;

    const blocks = generateReportHtmlBlocks();

    // Temporary measuring container
    const stage = document.createElement('div');
    stage.style.position = 'fixed';
    stage.style.left = '-9999px';
    stage.style.top = '0';
    stage.style.width = `${A4_WIDTH}px`;
    stage.style.backgroundColor = '#ffffff';
    stage.style.zIndex = '-9999';
    document.body.appendChild(stage);

    const testBox = document.createElement('div');
    testBox.style.width = `${A4_WIDTH - (PADDING * 2)}px`;
    testBox.style.boxSizing = 'border-box';
    stage.appendChild(testBox);

    const pages: Array<{
      isFirstPage: boolean;
      blocks: string[];
      hasSignature: boolean;
    }> = [];

    let currentPage = {
      isFirstPage: true,
      blocks: [] as string[],
      hasSignature: false,
    };
    pages.push(currentPage);

    const renderTestPage = (isFirstPage: boolean, blockList: string[], withSig: boolean) => {
      return `
        <div>
          ${getOfficialReportHeaderHtml(isFirstPage)}
          <div style="margin-top: 6px;">
            ${blockList.join('')}
          </div>
          ${withSig ? getOfficialReportSignatureHtml() : ''}
        </div>
      `;
    };

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      testBox.innerHTML = renderTestPage(currentPage.isFirstPage, [...currentPage.blocks, block], false);

      if (testBox.offsetHeight > USABLE_HEIGHT && currentPage.blocks.length > 0) {
        // Start a new page
        currentPage = {
          isFirstPage: false,
          blocks: [block],
          hasSignature: false,
        };
        pages.push(currentPage);
      } else {
        currentPage.blocks.push(block);
      }
    }

    // Now test if signature fits on current page
    testBox.innerHTML = renderTestPage(currentPage.isFirstPage, currentPage.blocks, true);
    if (testBox.offsetHeight > USABLE_HEIGHT && currentPage.blocks.length > 0) {
      // Signature needs its own overflow page
      pages.push({
        isFirstPage: false,
        blocks: [],
        hasSignature: true,
      });
    } else {
      currentPage.hasSignature = true;
    }

    if (document.body.contains(stage)) {
      document.body.removeChild(stage);
    }

    return {
      A4_WIDTH,
      A4_HEIGHT,
      PADDING,
      pages,
    };
  };

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    showToast('Préparation du document PDF officiel...', 'info');

    try {
      const pagination = paginateReportDocument();
      const { pages, A4_WIDTH, A4_HEIGHT, PADDING } = pagination;
      const totalPages = pages.length;

      // Create a hidden staging container on the DOM for toPng rendering
      const stage = document.createElement('div');
      stage.style.position = 'fixed';
      stage.style.left = '-9999px';
      stage.style.top = '0';
      stage.style.width = `${A4_WIDTH}px`;
      stage.style.backgroundColor = '#ffffff';
      stage.style.zIndex = '-9999';
      document.body.appendChild(stage);

      // Initialize jsPDF (A4 portrait)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Render each page to an exact A4 PNG and insert into PDF
      for (let p = 0; p < totalPages; p++) {
        const pageData = pages[p];

        const pageEl = document.createElement('div');
        pageEl.style.width = `${A4_WIDTH}px`;
        pageEl.style.height = `${A4_HEIGHT}px`;
        pageEl.style.boxSizing = 'border-box';
        pageEl.style.padding = `${PADDING}px`;
        pageEl.style.backgroundColor = '#ffffff';
        pageEl.style.display = 'flex';
        pageEl.style.flexDirection = 'column';
        pageEl.style.justifyContent = 'space-between';
        pageEl.style.position = 'relative';
        pageEl.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

        const contentEl = document.createElement('div');
        contentEl.style.flex = '1 1 auto';
        contentEl.style.display = 'flex';
        contentEl.style.flexDirection = 'column';
        contentEl.innerHTML = `
          ${getOfficialReportHeaderHtml(pageData.isFirstPage)}
          <div style="margin-top: 6px;">
            ${pageData.blocks.join('')}
          </div>
          ${pageData.hasSignature ? getOfficialReportSignatureHtml() : ''}
        `;
        pageEl.appendChild(contentEl);

        const footerWrapper = document.createElement('div');
        footerWrapper.innerHTML = getOfficialReportFooterHtml(p + 1, totalPages);
        const footerNode = footerWrapper.firstElementChild as HTMLElement;
        if (footerNode) {
          footerNode.style.marginTop = 'auto';
          pageEl.appendChild(footerNode);
        }

        stage.innerHTML = '';
        stage.appendChild(pageEl);

        const imgData = await toPng(pageEl, {
          quality: 0.98,
          pixelRatio: 2.2,
          backgroundColor: '#ffffff',
          skipFonts: true,
          fontEmbedCSS: '',
        });

        if (p > 0) {
          pdf.addPage('a4', 'portrait');
        }
        pdf.addImage(imgData, 'PNG', 0, 0, 210, 297);
      }

      if (document.body.contains(stage)) {
        document.body.removeChild(stage);
      }

      // Download file using reliable blob link
      const safeTitle = formattedOfficialTitle.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const pdfBlob = pdf.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = blobUrl;
      downloadLink.download = `isgg_${safeTitle}.pdf`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

      showToast(`Document PDF officiel (${totalPages} page${totalPages > 1 ? 's' : ''}) téléchargé avec succès`, 'success');
    } catch (error) {
      console.error('Erreur export PDF:', error);
      showToast('Échec de la génération du PDF.', 'error');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handlePrint = () => {
    try {
      const pagination = paginateReportDocument();
      const { pages } = pagination;
      const totalPages = pages.length;

      // Construct distinct A4 pages identical to the PDF output
      const pagesHtml = pages.map((pageData, p) => `
        <div class="print-a4-page">
          <div class="print-page-content">
            ${getOfficialReportHeaderHtml(pageData.isFirstPage)}
            <div style="margin-top: 6px;">
              ${pageData.blocks.join('')}
            </div>
            ${pageData.hasSignature ? getOfficialReportSignatureHtml() : ''}
          </div>
          ${getOfficialReportFooterHtml(p + 1, totalPages)}
        </div>
      `).join('');

      let printWindow: Window | null = null;
      try {
        printWindow = window.open('', '_blank');
      } catch {
        printWindow = null;
      }

      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${formattedOfficialTitle}</title>
              <meta charset="utf-8" />
              <script src="https://cdn.tailwindcss.com"></script>
              <style>
                @page {
                  size: A4 portrait;
                  margin: 0;
                }
                * {
                  box-sizing: border-box;
                }
                html, body {
                  margin: 0 !important;
                  padding: 0 !important;
                  background: #ffffff !important;
                  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                .print-a4-page {
                  width: 210mm;
                  height: 297mm;
                  max-height: 297mm;
                  padding: 10mm 12mm;
                  box-sizing: border-box;
                  display: flex !important;
                  flex-direction: column !important;
                  justify-content: space-between !important;
                  page-break-after: always !important;
                  break-after: page !important;
                  overflow: hidden;
                  background: #ffffff;
                }
                .print-a4-page:last-child {
                  page-break-after: avoid !important;
                  break-after: avoid !important;
                }
                .print-page-content {
                  flex: 1 1 auto;
                  display: flex;
                  flex-direction: column;
                  overflow: hidden;
                }
                .print-page-footer {
                  margin-top: auto !important;
                  flex-shrink: 0;
                  padding-top: 6px;
                  border-top: 2px solid #EA580C;
                  font-size: 7.5pt;
                  line-height: 1.25;
                  text-align: center;
                  color: #334155;
                }
                table {
                  width: 100%;
                  border-collapse: collapse;
                }
              </style>
            </head>
            <body>
              ${pagesHtml}
              <script>
                window.onload = function() {
                  setTimeout(function() {
                    window.focus();
                    window.print();
                  }, 400);
                };
              </script>
            </body>
          </html>
        `);
        printWindow.document.close();
        return;
      }
    } catch (e) {
      console.error('Erreur impression préparée:', e);
    }

    // Direct fallback
    window.print();
  };

  const handleExportConvocationPDF = async (student: StudentWithStats) => {
    const element = singleConvocationRef.current;
    if (!element) {
      showToast('Erreur: Document de convocation non trouvé.', 'error');
      return;
    }

    try {
      setIsExportingConvocationPDF(true);
      showToast('Génération du PDF officiel de convocation en cours...', 'info');

      // Create high-res A4 stage matching the other reports
      const A4_WIDTH = 794;
      const A4_HEIGHT = 1123;
      const PADDING = 36;

      const stage = document.createElement('div');
      stage.style.position = 'fixed';
      stage.style.top = '-99999px';
      stage.style.left = '-99999px';
      stage.style.width = `${A4_WIDTH}px`;
      stage.style.height = `${A4_HEIGHT}px`;
      stage.style.zIndex = '-9999';
      document.body.appendChild(stage);

      const pageEl = document.createElement('div');
      pageEl.style.width = `${A4_WIDTH}px`;
      pageEl.style.height = `${A4_HEIGHT}px`;
      pageEl.style.boxSizing = 'border-box';
      pageEl.style.padding = `${PADDING}px`;
      pageEl.style.backgroundColor = '#ffffff';
      pageEl.style.display = 'flex';
      pageEl.style.flexDirection = 'column';
      pageEl.style.justifyContent = 'space-between';
      pageEl.style.position = 'relative';
      pageEl.style.fontFamily = 'system-ui, -apple-system, sans-serif';

      const contentClone = element.cloneNode(true) as HTMLElement;
      contentClone.style.border = '2px solid #0f172a';
      contentClone.style.borderRadius = '16px';
      contentClone.style.padding = '24px';
      contentClone.style.backgroundColor = '#ffffff';
      pageEl.appendChild(contentClone);

      // Official footer for legal consistency
      const footerEl = document.createElement('div');
      footerEl.style.marginTop = 'auto';
      footerEl.style.paddingTop = '8px';
      footerEl.style.borderTop = '2px solid #EA580C';
      footerEl.style.fontSize = '8pt';
      footerEl.style.lineHeight = '1.3';
      footerEl.style.textAlign = 'center';
      footerEl.style.color = '#334155';
      footerEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; font-weight: 700; color: #64748b; margin-bottom: 2px; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px;">
          <span>Institut Supérieur de Génie Civil et de Gestion (ISGG)</span>
          <span>Avis officiel de convocation • Document confidentiel</span>
        </div>
        <p style="margin: 0; font-weight: 500;">Siège : Ab-Calavi, Aganmandin, Immeuble BOA, 1er et 2ème étages, BP : 1938 Abomey-Calavi</p>
        <p style="margin: 2px 0 0 0; font-weight: 600; color: #0f172a;">E-mail : isgg229@gmail.com - IFU : 3202346783540 - Tel. : 97 00 67 67 / 94 00 40 40</p>
      `;
      pageEl.appendChild(footerEl);

      stage.appendChild(pageEl);

      const imgData = await toPng(pageEl, {
        quality: 0.98,
        pixelRatio: 2.2,
        backgroundColor: '#ffffff',
        skipFonts: true,
        fontEmbedCSS: '',
      });

      if (document.body.contains(stage)) {
        document.body.removeChild(stage);
      }

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      pdf.addImage(imgData, 'PNG', 0, 0, 210, 297);

      const safeMatricule = student.matricule.replace(/[^a-zA-Z0-9]/g, '_');
      const safeName = `${student.lastName}_${student.firstName}`.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const filename = `convocation_isgg_${safeMatricule}_${safeName}.pdf`;

      const pdfBlob = pdf.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = blobUrl;
      downloadLink.download = filename;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

      showToast('Convocation PDF téléchargée avec succès', 'success');
    } catch (err) {
      console.error('Erreur export PDF convocation:', err);
      showToast('Échec de la génération du PDF de convocation.', 'error');
    } finally {
      setIsExportingConvocationPDF(false);
    }
  };

  const handlePrintConvocation = () => {
    const element = singleConvocationRef.current;
    if (!element) {
      window.print();
      return;
    }

    try {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>&nbsp;</title>
              <meta charset="utf-8" />
              <script src="https://cdn.tailwindcss.com"></script>
              <style>
                @page {
                  size: A4 portrait;
                  margin: 10mm;
                }
                * {
                  box-sizing: border-box;
                }
                html, body {
                  margin: 0 !important;
                  padding: 0 !important;
                  background: #ffffff !important;
                  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                .convocation-container {
                  width: 100%;
                  max-width: 190mm;
                  margin: 0 auto;
                  padding: 10mm;
                  box-sizing: border-box;
                }
              </style>
            </head>
            <body>
              <div class="convocation-container">
                ${element.outerHTML}
                <div style="margin-top: 25px; padding-top: 8px; border-top: 2px solid #EA580C; font-size: 8pt; text-align: center; color: #475569;">
                  <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 2px;">
                    <span>Institut Supérieur de Génie Civil et de Gestion (ISGG)</span>
                    <span>Document administratif officiel</span>
                  </div>
                  <p style="margin: 0;">Siège : Ab-Calavi, Aganmandin, Immeuble BOA, 1er et 2ème étages, BP : 1938 Abomey-Calavi</p>
                  <p style="margin: 2px 0 0 0; font-weight: 600; color: #0f172a;">E-mail : isgg229@gmail.com - IFU : 3202346783540 - Tel. : 97 00 67 67 / 94 00 40 40</p>
                </div>
              </div>
              <script>
                window.onload = function() {
                  setTimeout(function() {
                    window.focus();
                    window.print();
                  }, 400);
                };
              </script>
            </body>
          </html>
        `);
        printWindow.document.close();
        return;
      }
    } catch (e) {
      console.error('Erreur impression convocation:', e);
    }

    // Direct fallback
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
            Rapports & Synthèses d&apos;Assiduité
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Génération des bordereaux officiels, convocations et bilans périodiques
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Primary Action: Direct PDF Export */}
          <button
            onClick={handleExportPDF}
            disabled={isExportingPDF}
            className="inline-flex items-center gap-2 bg-[#EA580C] hover:bg-[#D94600] disabled:bg-orange-300 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-orange-600/20 transition-all cursor-pointer"
          >
            {isExportingPDF ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
            <span>{isExportingPDF ? 'Génération PDF...' : 'Télécharger en PDF'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 text-[#EA580C]" />
            <span>Imprimer</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Exporter CSV</span>
          </button>
        </div>
      </div>

      {/* Selector Tabs (Cleaned: removed redundant program dropdown at top right) */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center">
        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold w-full overflow-x-auto">
          <button
            onClick={() => setReportType('exam-exclusion')}
            className={`px-3.5 py-2 rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 ${
              reportType === 'exam-exclusion' ? 'bg-[#EA580C] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Contrôle Compositions (≥ 3 abs.)</span>
            {examCohortEligibility.disqualified.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                reportType === 'exam-exclusion' ? 'bg-white text-rose-600' : 'bg-rose-600 text-white'
              }`}>
                {examCohortEligibility.disqualified.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setReportType('daily')}
            className={`px-3.5 py-2 rounded-lg transition-all whitespace-nowrap ${
              reportType === 'daily' ? 'bg-white text-[#EA580C] shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Rapport du jour
          </button>
          <button
            onClick={() => setReportType('weekly')}
            className={`px-3.5 py-2 rounded-lg transition-all whitespace-nowrap ${
              reportType === 'weekly' ? 'bg-white text-[#EA580C] shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Bilan hebdomadaire
          </button>
          <button
            onClick={() => setReportType('monthly')}
            className={`px-3.5 py-2 rounded-lg transition-all whitespace-nowrap ${
              reportType === 'monthly' ? 'bg-white text-[#EA580C] shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Bilan mensuel
          </button>
          <button
            onClick={() => setReportType('discipline')}
            className={`px-3.5 py-2 rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 ${
              reportType === 'discipline' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Alertes Discipline</span>
            {activeConvocationsCount > 0 ? (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                reportType === 'discipline' ? 'bg-rose-600 text-white' : 'bg-rose-100 text-rose-700'
              }`}>
                {activeConvocationsCount}
              </span>
            ) : (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                0
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Specific Exam Exclusion Control Bar */}
      {reportType === 'exam-exclusion' && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-orange-100 text-[#EA580C] flex items-center justify-center font-black">
                <Filter className="w-4 h-4" />
              </div>
              <h3 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
                Paramètres de l&apos;épreuve & Période d&apos;évaluation
              </h3>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              Vérification avant composition • Tolérance maximale : 2 absences non justifiées
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Program */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Filière
              </label>
              <select
                value={examProgramId}
                onChange={e => setExamProgramId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 cursor-pointer"
              >
                {programs.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                ))}
              </select>
            </div>

            {/* Level / Licence Year */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Année de Licence / Niveau
              </label>
              <select
                value={examLevelId}
                onChange={e => setExamLevelId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 cursor-pointer"
              >
                {levels.map(l => (
                  <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
                ))}
              </select>
            </div>

            {/* Class Group */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Classe / Groupe
              </label>
              <select
                value={examClassGroup}
                onChange={e => setExamClassGroup(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 cursor-pointer"
              >
                <option value="all">Toutes les classes du niveau</option>
                <option value="A">Groupe A</option>
                <option value="B">Groupe B</option>
              </select>
            </div>

            {/* Subject for Exam */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Matière de la composition
              </label>
              <select
                value={examSubjectId}
                onChange={e => setExamSubjectId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 cursor-pointer"
              >
                {availableExamSubjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>
                ))}
              </select>
            </div>

            {/* Dates and Times */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Date de début du semestre
              </label>
              <input
                type="date"
                value={examStartDate}
                onChange={e => setExamStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Date de fin (Date de l&apos;examen)
              </label>
              <input
                type="date"
                value={examEndDate}
                onChange={e => setExamEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Horaire de l&apos;examen
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={examTime}
                  onChange={e => setExamTime(e.target.value)}
                  placeholder="ex: 12h00"
                  className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                />
                <div className="flex gap-1 shrink-0">
                  {['08h00', '12h00', '15h00'].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setExamTime(t)}
                      className={`px-1.5 py-2 text-[10px] font-bold rounded-lg border transition-colors ${
                        examTime === t ? 'bg-[#EA580C] text-white border-[#EA580C]' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Surveillant Général
              </label>
              <input
                type="text"
                value={surveillantName}
                onChange={e => setSurveillantName(e.target.value)}
                placeholder="ex: M. Nicaise AÏZOUN"
                className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
              />
            </div>
          </div>

          {/* Quick Shortcuts & Administration options */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[10px]">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-slate-400 mr-1">Raccourcis période :</span>
              <button
                type="button"
                onClick={() => {
                  setExamStartDate('2026-09-01');
                  setExamEndDate('2027-01-31');
                }}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  examStartDate === '2026-09-01' && examEndDate === '2027-01-31'
                    ? 'bg-[#EA580C] text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Semestre 1
              </button>
              <button
                type="button"
                onClick={() => {
                  setExamStartDate('2027-02-01');
                  setExamEndDate('2027-07-31');
                }}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  examStartDate === '2027-02-01' && examEndDate === '2027-07-31'
                    ? 'bg-[#EA580C] text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Semestre 2
              </button>
              <button
                type="button"
                onClick={() => {
                  setExamStartDate(defaultStartDate);
                  setExamEndDate(formatISODate(new Date()));
                }}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  examStartDate === defaultStartDate && examEndDate === formatISODate(new Date())
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Rentrée à ce jour
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowAuditDetails(!showAuditDetails)}
              className={`px-3 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                showAuditDetails 
                  ? 'bg-amber-100 border-amber-300 text-amber-900' 
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Eye className="w-3.5 h-3.5 text-[#EA580C]" />
              <span>{showAuditDetails ? 'Masquer détails d\'audit interne' : 'Afficher détails d\'audit interne (dates & justificatifs)'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Control Bar for Daily, Weekly, Monthly Reports */}
      {(reportType === 'daily' || reportType === 'weekly' || reportType === 'monthly') && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4 print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-orange-100 text-[#EA580C] flex items-center justify-center font-black">
                <Calendar className="w-4 h-4" />
              </div>
              <h3 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
                Paramètres de la période & Modèle officiel ISGG
              </h3>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              Génération du bordereau selon la maquette officielle (Logo, cadre de titre, séances de cours, signature)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Daily Date Selector */}
            {reportType === 'daily' && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Date de la journée
                </label>
                <input
                  type="date"
                  value={dailyDate}
                  onChange={e => setDailyDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 cursor-pointer"
                />
              </div>
            )}

            {/* Weekly Dates Selector */}
            {reportType === 'weekly' && (
              <>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Début de la semaine
                  </label>
                  <input
                    type="date"
                    value={weeklyStartDate}
                    onChange={e => setWeeklyStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Fin de la semaine
                  </label>
                  <input
                    type="date"
                    value={weeklyEndDate}
                    onChange={e => setWeeklyEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 cursor-pointer"
                  />
                </div>
              </>
            )}

            {/* Monthly Selector */}
            {reportType === 'monthly' && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Mois du bilan
                </label>
                <input
                  type="month"
                  value={monthlyYearMonth}
                  onChange={e => setMonthlyYearMonth(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 cursor-pointer"
                />
              </div>
            )}

            {/* Program Filter */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Filière
              </label>
              <select
                value={selectedProgram}
                onChange={e => setSelectedProgram(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 cursor-pointer"
              >
                <option value="all">Toutes les filières</option>
                {programs.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                ))}
              </select>
            </div>

            {/* Level Filter */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Niveau / Année
              </label>
              <select
                value={selectedLevelId}
                onChange={e => setSelectedLevelId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 cursor-pointer"
              >
                <option value="all">Tous les niveaux</option>
                {levels.map(l => (
                  <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
                ))}
              </select>
            </div>

            {/* Group Filter */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Groupe de classe
              </label>
              <select
                value={selectedGroup}
                onChange={e => setSelectedGroup(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 cursor-pointer"
              >
                <option value="all">Tous les groupes</option>
                <option value="A">Groupe A</option>
                <option value="B">Groupe B</option>
              </select>
            </div>

            {/* Signatory Name */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Surveillant Général signataire
              </label>
              <input
                type="text"
                value={surveillantName}
                onChange={e => setSurveillantName(e.target.value)}
                placeholder="ex: M. Nicaise AÏZOUN"
                className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
              />
            </div>
          </div>

          {/* Quick Date Shortcuts for Daily */}
          {reportType === 'daily' && (
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
              <span className="font-bold text-slate-400">Raccourcis date :</span>
              <button
                type="button"
                onClick={() => setDailyDate(defaultToday)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer border ${
                  dailyDate === defaultToday
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                Aujourd&apos;hui ({defaultToday})
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Report Document View (Official ISGG Template for all reports) */}
      <div 
        ref={printDocumentRef}
        id="report-printable-document"
        className="bg-white rounded-3xl p-3.5 sm:p-8 border border-slate-200 shadow-sm print:p-0 print:border-none print:shadow-none space-y-4 print:space-y-2 flex flex-col justify-between min-h-[1050px] w-full max-w-full overflow-hidden"
      >
        
        {/* Official ISGG Header Shared Across All Reports */}
        <div 
          id="report-official-header"
          className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-3 pb-2 border-b-2 border-slate-800 print:pb-1"
        >
          {/* Logo ISGG and Motto */}
          <div className="flex flex-col items-center shrink-0">
            <img 
              src={ISGG_LOGO_DATA_URL} 
              alt="Logo ISGG" 
              className="h-16 print:h-12 w-auto object-contain"
            />
            <span className="text-[10px] italic font-serif text-slate-800 tracking-tight mt-0.5">
              Les vertus de la réussite
            </span>
          </div>

          {/* Institution Title & Ministerial Approvals */}
          <div className="flex-1 text-center sm:text-right">
            <h1 className="text-sm sm:text-base lg:text-lg font-black text-slate-950 uppercase tracking-tight font-serif leading-tight">
              INSTITUT SUPERIEUR DE GENIE CIVIL ET DE GESTION
            </h1>
            
            <div className="mt-1 p-1.5 border border-slate-300 rounded bg-slate-50/70 text-[8px] print:text-[7px] leading-tight text-slate-700 inline-block text-left max-w-xl">
              <p className="font-bold text-slate-900 mb-0.5">Autorisations de l&apos;État :</p>
              <p>• Avis favorable du Conseil National de l&apos;Éducation N°2021-0281/CNE/PCQR/SE</p>
              <p>• Notification de la Direction Générale de l&apos;Enseignement Supérieur N°2308/MESRS/DC/SGM/DGES/SA</p>
              <p>• Arrêté du Ministre de l&apos;Enseignement Supérieur et de la RS N°0272/MESRS/DC/SGM/DGES/CTJ/CJSA/021 S0022</p>
            </div>
          </div>
        </div>

        {/* Official Black Box Title (Centered with solid black border) */}
        <div 
          id="report-official-title"
          className="border-2 border-black py-1.5 px-3 text-center my-2 print:my-1 shadow-xs bg-white"
        >
          <h2 className="text-xs sm:text-sm md:text-base font-black tracking-wide uppercase text-black">
            {formattedOfficialTitle}
          </h2>
        </div>

        {/* Branch 1: Exam Disqualification Report */}
        {reportType === 'exam-exclusion' && (
          <div className="space-y-3 print:space-y-1.5 session-block print:break-inside-avoid">
            {/* Exam Session Header (Class, Subject, Time) */}
            <div className="text-center font-bold text-xs print:text-[10px] text-black py-1 border-b border-dashed border-slate-300 flex flex-wrap items-center justify-center gap-x-6 gap-y-1">
              <div>
                <span className="underline decoration-1 underline-offset-2">Classe</span> :{' '}
                <span className="font-extrabold uppercase">{computedExamClassName}</span>
              </div>
              <div>
                <span className="underline decoration-1 underline-offset-2">EXAMEN DE</span> :{' '}
                <span className="font-extrabold uppercase">{currentExamSubject?.name || 'Matière non spécifiée'}</span>
              </div>
              <div>
                <span className="underline decoration-1 underline-offset-2">Horaire</span> :{' '}
                <span className="font-extrabold">{examTime}</span>
              </div>
            </div>

            {/* Official 3-Column Table (Exact Match to User's ISGG Template) */}
            <div className="pt-1">
              <table className="w-full border-collapse border border-black text-xs print:text-[9.5px] text-black leading-tight">
                <thead>
                  <tr className="border-b-2 border-black bg-slate-100/70 font-black">
                    <th className="border border-black py-1 px-1.5 print:py-0.5 print:px-1 w-12 text-center font-black">N°</th>
                    <th className="border border-black py-1 px-1.5 print:py-0.5 print:px-1 text-left font-black">Nom et Prénoms</th>
                    <th className="border border-black py-1 px-1.5 print:py-0.5 print:px-1 w-48 sm:w-60 text-center font-black">Observations</th>
                  </tr>
                </thead>
                <tbody>
                  {examCohortEligibility.disqualified.length > 0 ? (
                    examCohortEligibility.disqualified.map((item, index) => (
                      <tr key={item.student.id} className="hover:bg-slate-50/50">
                        <td className="border border-black py-1 px-1.5 print:py-0.5 print:px-1 text-center font-bold">
                          {index + 1}
                        </td>
                        <td className="border border-black py-1 px-1.5 print:py-0.5 print:px-1 font-black uppercase tracking-wide">
                          {item.student.lastName.toUpperCase()} {item.student.firstName}
                        </td>
                        <td className="border border-black py-1 px-1.5 print:py-0.5 print:px-1 text-center font-medium">
                          Absences au cours
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="border border-black p-4 text-center text-slate-600 font-semibold italic">
                        Aucun étudiant exclu. Tous les inscrits de la classe sont autorisés à composer ({examCohortEligibility.qualified.length} étudiants éligibles).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Optional Audit Details View (Internal Inspection, hidden on print) */}
            {showAuditDetails && (
              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-xs space-y-3 print:hidden">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-950 flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-amber-600" />
                    Détails d&apos;audit interne des absences par étudiant (Non imprimé sur le bordereau)
                  </span>
                  <span className="text-[11px] font-bold text-amber-900">
                    Règle : 3 absences non justifiées ou plus = Disqualification
                  </span>
                </div>

                <div className="space-y-2">
                  {examCohortEligibility.disqualified.map((item) => (
                    <div 
                      key={item.student.id}
                      className="p-3 bg-white rounded-lg border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900">
                            {item.student.lastName.toUpperCase()} {item.student.firstName}
                          </span>
                          <span className="font-mono text-slate-500 text-[11px]">
                            ({item.student.matricule})
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="px-2 py-0.5 rounded bg-rose-200 text-rose-950 text-[10px] font-black">
                            {item.unjustifiedCount} abs. non justifiée{item.unjustifiedCount > 1 ? 's' : ''} (≥ 3 = Disqualifié)
                          </span>
                          {item.justifiedCount > 0 && (
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 text-[10px] font-bold">
                              {item.justifiedCount} justifiée{item.justifiedCount > 1 ? 's' : ''} (écartée{item.justifiedCount > 1 ? 's' : ''})
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {item.absences.map(a => (
                            <span 
                              key={a.id} 
                              className={`text-[9.5px] px-1.5 py-0.5 rounded font-mono font-bold ${
                                a.justified ? 'bg-emerald-100 text-emerald-800 line-through' : 'bg-rose-100 text-rose-900'
                              }`}
                              title={a.justified ? 'Absence justifiée' : 'Absence non justifiée'}
                            >
                              {a.absenceDate}
                            </span>
                          ))}
                        </div>

                        {onNavigateToStudent && (
                          <button
                            type="button"
                            onClick={() => onNavigateToStudent(item.student.id)}
                            className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-[11px] font-bold cursor-pointer transition-colors shrink-0"
                          >
                            Fiche étudiant
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Branch 2: Daily, Weekly, Monthly Reports (Exact ISGG Sheet Template with 4 Columns Table by Session) */}
        {(reportType === 'daily' || reportType === 'weekly' || reportType === 'monthly') && (
          <div className="space-y-4 print:space-y-2">
            {groupedSessions.length > 0 ? (
              groupedSessions.map((session, sIdx) => (
                <div key={session.key || sIdx} className="space-y-1 session-block print:break-inside-avoid print:page-break-inside-avoid">
                  {/* Session Header (Underlined Labels matching the submitted image) */}
                  <div className="font-bold text-xs print:text-[10px] text-black pt-1 flex flex-wrap items-center gap-x-6 gap-y-0.5">
                    <div>
                      <span className="underline decoration-1 underline-offset-2">Classe</span> :{' '}
                      <span className="font-extrabold uppercase">{session.className}</span>
                    </div>
                    <div>
                      <span className="underline decoration-1 underline-offset-2">Matière</span> :{' '}
                      <span className="font-extrabold uppercase">{session.subjectName}</span>
                    </div>
                    <div>
                      <span className="underline decoration-1 underline-offset-2">Horaire</span> :{' '}
                      <span className="font-extrabold">{session.timeRange}</span>
                    </div>
                    {reportType !== 'daily' && (
                      <div className="text-slate-600 text-xs print:text-[10px]">
                        <span className="underline decoration-1 underline-offset-2">Date</span> :{' '}
                        <span className="font-semibold">{session.dateStr}</span>
                      </div>
                    )}
                  </div>

                  {/* 4-Column Table: N° | Nom | Prénoms | Observations (Exact Match to User's ISGG Document) */}
                  <table className="w-full border-collapse border border-black text-xs print:text-[9.5px] text-black leading-tight">
                    <thead>
                      <tr className="border-b-2 border-black bg-slate-100/70 font-black">
                        <th className="border border-black py-1 px-1.5 print:py-0.5 print:px-1 w-12 text-center font-black">N°</th>
                        <th className="border border-black py-1 px-1.5 print:py-0.5 print:px-1 text-center font-black">Nom</th>
                        <th className="border border-black py-1 px-1.5 print:py-0.5 print:px-1 text-center font-black">Prénoms</th>
                        <th className="border border-black py-1 px-1.5 print:py-0.5 print:px-1 text-center font-black w-44 sm:w-56">Observations</th>
                      </tr>
                    </thead>
                    <tbody>
                      {session.items.map((item, idx) => (
                        <tr key={item.absenceId || idx} className="hover:bg-slate-50/50">
                          <td className="border border-black py-1 px-1.5 print:py-0.5 print:px-1 text-center font-bold">
                            {idx + 1}
                          </td>
                          <td className="border border-black py-1 px-1.5 print:py-0.5 print:px-1 text-center font-black uppercase tracking-wide">
                            {item.lastName}
                          </td>
                          <td className="border border-black py-1 px-1.5 print:py-0.5 print:px-1 text-center font-medium">
                            {item.firstName}
                          </td>
                          <td className="border border-black py-1 px-1.5 print:py-0.5 print:px-1 text-center font-medium">
                            {item.observations}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            ) : (
              <div className="border border-black p-6 text-center text-slate-600 font-semibold italic bg-slate-50/40 rounded text-xs session-block">
                Aucun absent enregistré pour les cours de cette sélection.
              </div>
            )}
          </div>
        )}

        {/* Branch 3: Discipline Alerts Report */}
        {reportType === 'discipline' && (
          <div className="space-y-4 print:space-y-1.5 session-block print:break-inside-avoid w-full max-w-full overflow-hidden">
            {/* Header info & Filter tabs (screen only) */}
            <div className="space-y-3 print:hidden w-full max-w-full">
              {/* Banner with real-time threshold indicators */}
              <div className="p-3 rounded-2xl bg-gradient-to-r from-rose-50 to-orange-50 border border-rose-200/80 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 font-semibold">
                <div className="flex items-center gap-2.5 text-rose-900">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
                  <span className="text-xs">
                    Dossier d&apos;assiduité ISGG : Palier préventif (<strong>{systemSettings.warningThreshold} abs.</strong>) | Palier critique (<strong>{systemSettings.disciplineThreshold} abs.</strong>).
                  </span>
                </div>

                {/* Main threshold filters */}
                <div className="flex flex-wrap items-center gap-1.5 bg-white/80 p-1 rounded-xl border border-rose-200 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setDisciplineTab('all')}
                    className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-colors ${
                      disciplineTab === 'all' ? 'bg-rose-600 text-white' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Tous ({studentsAtRisk.length + studentsInWarning.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisciplineTab('critical')}
                    className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-colors ${
                      disciplineTab === 'critical' ? 'bg-rose-600 text-white' : 'text-rose-700 hover:bg-rose-100'
                    }`}
                  >
                    Convocations (≥{systemSettings.disciplineThreshold})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisciplineTab('warning')}
                    className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-colors ${
                      disciplineTab === 'warning' ? 'bg-amber-600 text-white' : 'text-amber-800 hover:bg-amber-100'
                    }`}
                  >
                    Avertissements ({studentsInWarning.length})
                  </button>
                </div>
              </div>

              {/* Sub-bar: Convocation status lifecycle filter */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                  <Clock className="w-4 h-4 text-[#EA580C]" />
                  <span>Suivi de l&apos;état des convocations :</span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setConvocationFilter('pending')}
                    className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
                      convocationFilter === 'pending'
                        ? 'bg-rose-600 text-white shadow-2xs'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-rose-400" />
                    <span>À traiter / En cours ({studentsAtRisk.filter(s => (convocationsMap[s.id]?.status || 'a_convoquer') !== 'traite').length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConvocationFilter('resolved')}
                    className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
                      convocationFilter === 'resolved'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Parents déjà passés ({studentsAtRisk.filter(s => convocationsMap[s.id]?.status === 'traite').length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConvocationFilter('all')}
                    className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-all ${
                      convocationFilter === 'all'
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    Tous statuts
                  </button>
                </div>
              </div>
            </div>

            {/* Desktop & Print Table (strictly hidden on mobile screen to prevent overflow) */}
            <div className="hidden md:block print:block overflow-x-auto w-full">
              <table className="w-full border-collapse border border-black text-xs print:text-[9px] text-black leading-tight">
                <thead>
                  <tr className="border-b-2 border-black bg-slate-100/70 font-black">
                    <th className="border border-black py-1 px-1.5 print:py-0.5 print:px-1 w-10 text-center font-black">N°</th>
                    <th className="border border-black py-1 px-1.5 print:py-0.5 print:px-1 text-left font-black">Matricule</th>
                    <th className="border border-black py-1 px-1.5 print:py-0.5 print:px-1 text-left font-black">Nom et Prénoms</th>
                    <th className="border border-black py-1 px-1.5 print:py-0.5 print:px-1 text-left font-black">Filière / Niveau</th>
                    <th className="border border-black py-1 px-1.5 print:py-0.5 print:px-1 text-center font-black">Total Absences</th>
                    <th className="border border-black py-1 px-1.5 print:py-0.5 print:px-1 text-center font-black">Palier / Décision</th>
                    <th className="border border-black py-1 px-1.5 print:hidden text-center font-black w-40">Suivi Convocation</th>
                    <th className="border border-black py-1 px-1.5 print:hidden text-center font-black w-36">Actions 1-Clic</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedDisciplineStudents.length > 0 ? (
                    displayedDisciplineStudents.map((s, idx) => {
                      const isCritical = s.annualAbsenceCount >= systemSettings.disciplineThreshold;
                      const convRecord = storage.getConvocation(s.id);
                      const statusCfg = CONVOCATION_STATUS_CONFIG[convRecord.status] || CONVOCATION_STATUS_CONFIG.a_convoquer;
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/50">
                          <td className="border border-black py-1 px-1.5 print:py-0.5 print:px-1 text-center font-bold">{idx + 1}</td>
                          <td className="border border-black py-1 px-1.5 print:py-0.5 print:px-1 font-mono font-bold text-slate-900">{s.matricule}</td>
                          <td className="border border-black py-1 px-1.5 print:py-0.5 print:px-1 font-black uppercase">{s.lastName} {s.firstName}</td>
                          <td className="border border-black py-1 px-1.5 print:py-0.5 print:px-1 font-medium">{s.programName} ({cleanLevelName(s.levelName)})</td>
                          <td className="border border-black py-1 px-1.5 print:py-0.5 print:px-1 text-center font-black text-rose-700">
                            {s.annualAbsenceCount} absences
                          </td>
                          <td className="border border-black py-1 px-1.5 print:py-0.5 print:px-1 text-center font-bold">
                            {isCritical ? (
                              <span className="text-rose-700 font-extrabold uppercase">Convocation officielle</span>
                            ) : (
                              <span className="text-amber-700 font-bold uppercase">Avertissement préventif</span>
                            )}
                          </td>
                          {/* Suivi Convocation (screen only) */}
                          <td className="border border-black py-1 px-1.5 print:hidden text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStudentForStatusModal(s);
                                setEditingStatus(convRecord.status);
                                setEditingNote(convRecord.note || '');
                              }}
                              className={`w-full px-2 py-1 rounded-md text-[10px] font-bold border transition-colors flex items-center justify-between gap-1 cursor-pointer ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border} hover:brightness-95`}
                              title="Cliquer pour changer le statut de la convocation"
                            >
                              <span className="flex items-center gap-1 truncate">
                                <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot} shrink-0`} />
                                <span className="truncate">{statusCfg.shortLabel}</span>
                              </span>
                              <span className="text-[9px] opacity-60">✎</span>
                            </button>
                            {convRecord.note && (
                              <p className="text-[9px] text-slate-500 truncate max-w-[150px] text-left mt-0.5 italic">
                                {convRecord.note}
                              </p>
                            )}
                          </td>
                          {/* Actions (screen only) */}
                          <td className="border border-black py-1 px-1.5 print:hidden text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedStudentForConvocation(s);
                                }}
                                title="Générer et imprimer l'avis officiel de convocation"
                                className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] cursor-pointer"
                              >
                                Convocation
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const initialMsg = systemSettings.parentNoticeTemplate
                                    .replace('{etudiant}', `${s.lastName.toUpperCase()} ${s.firstName}`)
                                    .replace('{classe}', s.programName ? `${s.programName} (${cleanLevelName(s.levelName)})` : 'ISGG')
                                    .replace('{absences}', String(s.annualAbsenceCount))
                                    .replace('{seuil}', String(systemSettings.disciplineThreshold))
                                    .replace('{date_rdv}', 'ce vendredi à 09h00')
                                    .replace('{tuteur}', `M./Mme ${s.lastName.toUpperCase()}`);
                                  setCustomParentMessage(initialMsg);
                                  setSelectedStudentForMessage(s);
                                }}
                                title="Notifier les parents ou le tuteur légal"
                                className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] cursor-pointer"
                              >
                                Tuteur
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="border border-black p-4 text-center text-slate-500 font-semibold italic">
                        Aucun étudiant dans cette catégorie d&apos;alerte.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Responsive Cards (Strictly fits mobile screens without horizontal overflow) */}
            <div className="md:hidden space-y-3 print:hidden w-full max-w-full overflow-hidden">
              {displayedDisciplineStudents.length > 0 ? (
                displayedDisciplineStudents.map((s, idx) => {
                  const isCritical = s.annualAbsenceCount >= systemSettings.disciplineThreshold;
                  const convRecord = storage.getConvocation(s.id);
                  const statusCfg = CONVOCATION_STATUS_CONFIG[convRecord.status] || CONVOCATION_STATUS_CONFIG.a_convoquer;

                  return (
                    <div 
                      key={s.id}
                      className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs space-y-2.5 w-full max-w-full"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-black text-slate-400">#{idx + 1}</span>
                            <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                              {s.matricule}
                            </span>
                            {isCritical ? (
                              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                                Seuil {systemSettings.disciplineThreshold} dépassé
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                                Avertissement
                              </span>
                            )}
                          </div>
                          <h4 className="font-black text-sm text-slate-950 uppercase mt-1 truncate">
                            {s.lastName} {s.firstName}
                          </h4>
                          <p className="text-xs text-slate-600 font-medium truncate">
                            {s.programName} ({cleanLevelName(s.levelName)})
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="inline-block px-2.5 py-1 rounded-full text-xs font-black bg-rose-600 text-white">
                            {s.annualAbsenceCount} abs.
                          </span>
                        </div>
                      </div>

                      {/* Status row */}
                      <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 border border-slate-150">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-full ${statusCfg.dot} shrink-0`} />
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold text-slate-500 uppercase">Statut convocation</p>
                            <p className={`text-xs font-black ${statusCfg.text} truncate`}>{statusCfg.label}</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStudentForStatusModal(s);
                            setEditingStatus(convRecord.status);
                            setEditingNote(convRecord.note || '');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-800 text-[11px] font-bold hover:bg-slate-100 shrink-0 cursor-pointer shadow-2xs"
                        >
                          Changer ✎
                        </button>
                      </div>

                      {convRecord.note && (
                        <p className="text-[11px] bg-amber-50/70 p-2 rounded-lg text-amber-900 italic border border-amber-200">
                          Note : {convRecord.note}
                        </p>
                      )}

                      {/* Action buttons */}
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setSelectedStudentForConvocation(s)}
                          className="px-3 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Convocation</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const initialMsg = systemSettings.parentNoticeTemplate
                              .replace('{etudiant}', `${s.lastName.toUpperCase()} ${s.firstName}`)
                              .replace('{classe}', s.programName ? `${s.programName} (${cleanLevelName(s.levelName)})` : 'ISGG')
                              .replace('{absences}', String(s.annualAbsenceCount))
                              .replace('{seuil}', String(systemSettings.disciplineThreshold))
                              .replace('{date_rdv}', 'ce vendredi à 09h00')
                              .replace('{tuteur}', `M./Mme ${s.lastName.toUpperCase()}`);
                            setCustomParentMessage(initialMsg);
                            setSelectedStudentForMessage(s);
                          }}
                          className="px-3 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Avis Tuteur</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center text-slate-500 font-semibold italic bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                  Aucun dossier dans cette sélection.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Official Signature Box (No simulated stamp/signature; reserved for physical stamping & signature) */}
        <div 
          id="report-signature-block"
          className="pt-3 print:pt-1 flex flex-col items-end text-xs print:text-[10px] text-black print:break-inside-avoid"
        >
          <div className="w-72 sm:w-80 text-center space-y-0.5">
            <p className="font-bold text-xs print:text-[10px]">
              Fait à Calavi, le {formatFrenchDate(reportType === 'daily' ? dailyDate : reportType === 'weekly' ? weeklyEndDate : reportType === 'monthly' ? `${monthlyYearMonth}-28` : examEndDate)}
            </p>
            <p className="font-black uppercase tracking-wide text-xs print:text-[10px]">
              Le Surveillant Général
            </p>

            {/* Espace blanc dégagé pour le cachet et la signature physique */}
            <div className="h-16 sm:h-20 print:h-14 my-1 print:my-0.5" aria-hidden="true" />

            <p className="font-black text-xs sm:text-sm uppercase underline decoration-1 underline-offset-4 tracking-wide text-slate-950">
              {surveillantName}
            </p>
          </div>
        </div>

        {/* Official ISGG Document Footer (Fixed at the bottom of the page) */}
        <div 
          id="report-official-footer"
          className="pt-2 mt-auto border-t-2 border-[#EA580C] text-[8.5px] print:text-[7.5px] leading-tight text-center text-slate-700 print:break-inside-avoid"
        >
          <div className="flex justify-between items-center text-[9px] print:text-[8px] font-bold text-slate-500 mb-1 border-b border-slate-200 pb-0.5">
            <span>Institut Supérieur de Génie Civil et de Gestion (ISGG)</span>
            <span className="page-number-display">Page 1 / 1</span>
          </div>
          <p className="font-medium">
            Siège : Ab-Calavi, Aganmandin, Immeuble BOA, 1er et 2ème étages, BP : 1938 Abomey-Calavi
          </p>
          <p className="font-semibold text-slate-900 mt-0.5">
            E-mail : isgg229@gmail.com - IFU : 3202346783540 - Tel. : 97 00 67 67 / 94 00 40 40
          </p>
        </div>
      </div>

      {/* Modal 1: Individual Official Convocation Letter (1-Click Printable Document) */}
      {selectedStudentForConvocation && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-300 space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#EA580C]" />
                <h3 className="font-extrabold text-base text-slate-900">
                  Avis officiel de convocation disciplinaire (ISGG)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentForConvocation(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Document Box */}
            <div 
              ref={singleConvocationRef}
              className="p-6 border-2 border-slate-900 rounded-2xl bg-white space-y-4 text-xs text-slate-900 font-sans"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
                <div className="flex flex-col items-center">
                  <img src={ISGG_LOGO_DATA_URL} alt="Logo ISGG" className="h-12 w-auto object-contain" />
                  <span className="text-[9px] italic font-serif text-slate-800">Les vertus de la réussite</span>
                </div>
                <div className="text-right">
                  <h4 className="font-black text-xs uppercase font-serif tracking-tight">
                    INSTITUT SUPERIEUR DE GENIE CIVIL ET DE GESTION
                  </h4>
                  <p className="text-[9px] text-slate-600 font-medium">DIRECTION DES ÉTUDES • SERVICE DE L&apos;ASSIDUITÉ</p>
                  <p className="text-[8px] text-slate-500">Abomey-Calavi, République du Bénin</p>
                </div>
              </div>

              {/* Title */}
              <div className="border-2 border-black py-2 px-3 text-center bg-slate-50 font-black uppercase text-xs tracking-wider">
                CONVOCATION OFFICIELLE EN COMMISSION DISCIPLINAIRE
              </div>

              {/* Body */}
              <div className="space-y-3 leading-relaxed">
                <p>
                  Il est porté à la connaissance de l&apos;étudiant(e) ci-après désigné(e) :
                </p>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 font-medium">
                  <p><strong className="text-slate-900">Nom & Prénoms :</strong> <span className="uppercase font-black text-slate-950">{selectedStudentForConvocation.lastName} {selectedStudentForConvocation.firstName}</span></p>
                  <p><strong className="text-slate-900">Matricule :</strong> <span className="font-mono font-bold text-slate-900">{selectedStudentForConvocation.matricule}</span></p>
                  <p><strong className="text-slate-900">Filière / Niveau :</strong> {selectedStudentForConvocation.programName} ({cleanLevelName(selectedStudentForConvocation.levelName)})</p>
                  <p><strong className="text-slate-900">Total absences constatées :</strong> <span className="font-black text-rose-700">{selectedStudentForConvocation.annualAbsenceCount} absences non justifiées</span></p>
                </div>

                <p className="text-justify font-medium">
                  En application du règlement intérieur de l&apos;ISGG (seuil critique de {systemSettings.disciplineThreshold} absences dépassé), vous êtes formellement convoqué(e) à vous présenter devant la Direction des Études le <strong>vendredi prochain à 09h00 précises</strong> au bureau du Surveillant Général.
                </p>

                <p className="p-2 rounded bg-amber-50 border border-amber-200 text-amber-950 font-bold text-[11px]">
                  ⚠️ AVIS IMPORTANT : La présence physique du père, de la mère ou du tuteur légal dûment mandaté est strictement obligatoire sous peine de disqualification définitive aux examens de semestre.
                </p>
              </div>

              {/* Signatures */}
              <div className="pt-4 flex items-center justify-between text-[11px]">
                <div className="text-center w-40">
                  <p className="font-bold">L&apos;Étudiant / Tuteur</p>
                  <div className="h-12" />
                  <p className="text-[9px] text-slate-500 italic">Signature & mention « Reçu »</p>
                </div>

                <div className="text-center w-48">
                  <p className="font-bold">Fait à Calavi, le {formatFrenchDate(formatISODate(new Date()))}</p>
                  <p className="font-black uppercase mt-0.5">Le Surveillant Général</p>
                  <div className="h-10" />
                  <p className="font-bold uppercase underline decoration-1 text-slate-950">{surveillantName}</p>
                </div>
              </div>
            </div>

            {/* Quick status actions right in the convocation modal */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs">
                <span className="text-slate-500 font-medium">Statut convocation : </span>
                <span className="font-extrabold text-slate-900">
                  {CONVOCATION_STATUS_CONFIG[storage.getConvocation(selectedStudentForConvocation.id).status]?.label || 'À convoquer'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={async () => {
                    await storage.updateConvocationStatus(selectedStudentForConvocation.id, 'envoyee');
                    showToast('Marqué comme : Convocation envoyée', 'info');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[11px] hover:bg-blue-100 cursor-pointer"
                >
                  Marquer Envoyée
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await storage.updateConvocationStatus(selectedStudentForConvocation.id, 'traite', 'Parent passé après convocation');
                    showToast('Marqué comme : Parent déjà passé / Traité', 'success');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px] hover:bg-emerald-100 cursor-pointer"
                >
                  Parent Déjà Passé ✓
                </button>
              </div>
            </div>

            {/* Actions: Download PDF (best for mobile) & Print & Close */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isExportingConvocationPDF}
                onClick={() => handleExportConvocationPDF(selectedStudentForConvocation)}
                className="px-4 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#D94600] disabled:bg-orange-300 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-orange-600/20 active:scale-98 transition-all"
              >
                {isExportingConvocationPDF ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Génération PDF...</span>
                  </>
                ) : (
                  <>
                    <FileDown className="w-4 h-4" />
                    <span>Télécharger en PDF</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handlePrintConvocation}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-98 transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimer</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedStudentForConvocation(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer text-center"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Parent Notification Generator (1-Click WhatsApp / SMS / Email) */}
      {selectedStudentForMessage && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                    Avis d&apos;assiduité aux Parents / Tuteurs
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Étudiant : {selectedStudentForMessage.lastName.toUpperCase()} {selectedStudentForMessage.firstName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentForMessage(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Message pré-rempli (personnalisable) :
              </label>
              <textarea
                rows={4}
                value={customParentMessage}
                onChange={e => setCustomParentMessage(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 leading-relaxed focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  window.open(`https://wa.me/?text=${encodeURIComponent(customParentMessage)}`, '_blank');
                  showToast('Ouverture de WhatsApp...', 'info');
                }}
                className="px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  window.open(`sms:?body=${encodeURIComponent(customParentMessage)}`, '_blank');
                  showToast('Ouverture de l\'application SMS...', 'info');
                }}
                className="px-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>SMS</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(customParentMessage);
                    showToast('Texte copié dans le presse-papier !', 'success');
                  }
                }}
                className="px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Copier</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setSelectedStudentForMessage(null)}
              className="w-full py-2 rounded-xl text-slate-500 hover:bg-slate-100 font-bold text-xs cursor-pointer transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Modal 3: Convocation Status Lifecycle Modal */}
      {selectedStudentForStatusModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  Suivi de convocation
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {selectedStudentForStatusModal.lastName.toUpperCase()} {selectedStudentForStatusModal.firstName} • {selectedStudentForStatusModal.matricule}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentForStatusModal(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                Sélectionner l&apos;état actuel du dossier :
              </label>

              <div className="space-y-2">
                {(['a_convoquer', 'envoyee', 'en_attente', 'traite'] as ConvocationStatus[]).map((st) => {
                  const cfg = CONVOCATION_STATUS_CONFIG[st];
                  const isSelected = editingStatus === st;
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setEditingStatus(st)}
                      className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? `${cfg.bg} ${cfg.border} ring-2 ring-offset-1 ring-slate-900`
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`w-3 h-3 rounded-full ${cfg.dot}`} />
                        <div>
                          <p className={`text-xs font-bold ${cfg.text}`}>{cfg.label}</p>
                          <p className="text-[10px] text-slate-500">
                            {st === 'a_convoquer' && 'Seuil atteint, convocation pas encore transmise'}
                            {st === 'envoyee' && 'Convocation remise à l\'étudiant ou transmise aux parents'}
                            {st === 'en_attente' && 'Rendez-vous fixé, en attente de la venue physique des parents'}
                            {st === 'traite' && 'Parent déjà passé, entretien effectué (dossier clôturé)'}
                          </p>
                        </div>
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="w-4 h-4 text-slate-900 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observations / Note de suivi (facultatif) :
                </label>
                <textarea
                  rows={2}
                  value={editingNote}
                  onChange={(e) => setEditingNote(e.target.value)}
                  placeholder="Ex : Père venu le 14/09, a signé l'engagement d'assiduité..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedStudentForStatusModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={async () => {
                  if (!selectedStudentForStatusModal) return;
                  await storage.updateConvocationStatus(
                    selectedStudentForStatusModal.id,
                    editingStatus,
                    editingNote.trim()
                  );
                  showToast(`Statut mis à jour : ${CONVOCATION_STATUS_CONFIG[editingStatus].label}`, 'success');
                  setSelectedStudentForStatusModal(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer shadow-md"
              >
                Enregistrer le statut
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
