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
  Loader2
} from 'lucide-react';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import { ISGG_LOGO_DATA_URL } from '../../lib/isggLogo';
import { storage, formatFrenchDate, formatISODate } from '../../lib/storage';
import { useToast } from '../common/Toast';
import { Subject, Level, Program, Student } from '../../types';

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
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [reportType, setReportType] = useState<'daily' | 'weekly' | 'monthly' | 'discipline' | 'exam-exclusion'>('daily');

  // Helper to remove any tautology like '1ère année (Licence 1)' -> 'Licence 1'
  const cleanLevelName = (name?: string) => {
    if (!name) return '';
    return name.replace(/^[0-9]+[èe]me?\s+année\s*\((Licence\s+[0-9]+)\)/i, '$1');
  };

  // Shared Data
  const programs = useMemo(() => storage.getPrograms(), []);
  const levels = useMemo(() => storage.getLevels(), []);
  const allSubjects = useMemo(() => storage.getAllSubjects(), []);
  const allAbsences = useMemo(() => storage.getAbsencesWithDetails(), []);
  const students = useMemo(() => storage.getStudents().map(s => storage.getStudentWithStats(s.id)!), []);

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
      const isDisqualified = unjustifiedCount >= 3;

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
  }, [students, examProgramId, examLevelId, examClassGroup, examSubjectId, examStartDate, examEndDate, allSubjects]);

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

  // Students exceeding threshold (> 6 absences)
  const studentsAtRisk = useMemo(() => {
    return students
      .filter(s => s.annualAbsenceCount >= 5)
      .sort((a, b) => b.annualAbsenceCount - a.annualAbsenceCount);
  }, [students]);

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

  interface ExportPageData {
    isFirstPage: boolean;
    headerNode: HTMLElement;
    blocks: HTMLElement[];
    hasSignature: boolean;
  }

  // Unified A4 Pagination Engine: shared between PDF export and physical printing
  const paginateReportDocument = (element: HTMLElement) => {
    // Standard A4 dimensions in px (800px width reference at 96dpi => 1131px height)
    const A4_WIDTH = 800;
    const A4_HEIGHT = 1131;
    const PADDING = 24; // 24px padding on each side
    const FOOTER_SPACE = 75; // Reserved for bottom footer + page counter
    const USABLE_HEIGHT = A4_HEIGHT - (PADDING * 2) - FOOTER_SPACE;

    // Extract components from the live document
    const headerEl = element.querySelector('#report-official-header') as HTMLElement;
    const titleEl = element.querySelector('#report-official-title') as HTMLElement;
    const signatureEl = element.querySelector('#report-signature-block') as HTMLElement;
    const footerEl = element.querySelector('#report-official-footer') as HTMLElement;
    const sessionBlocks = Array.from(element.querySelectorAll('.session-block')) as HTMLElement[];

    const createFirstPageHeader = (): HTMLElement => {
      const wrap = document.createElement('div');
      wrap.className = 'space-y-2 mb-2';
      if (headerEl) wrap.appendChild(headerEl.cloneNode(true));
      if (titleEl) wrap.appendChild(titleEl.cloneNode(true));
      return wrap;
    };

    const createSubsequentPageHeader = (): HTMLElement => {
      const wrap = document.createElement('div');
      wrap.className = 'flex items-center justify-between pb-1.5 mb-2 border-b-2 border-slate-800 text-xs font-serif font-black text-slate-900';
      wrap.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="text-xs font-black uppercase">INSTITUT SUPERIEUR DE GENIE CIVIL ET DE GESTION (ISGG)</span>
        </div>
        <span class="text-[9px] text-slate-600 italic font-sans font-bold">Rapport officiel d'assiduité (Suite)</span>
      `;
      return wrap;
    };

    // Staging container for height measurement
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

    const pages: ExportPageData[] = [];
    let currentPage: ExportPageData = {
      isFirstPage: true,
      headerNode: createFirstPageHeader(),
      blocks: [],
      hasSignature: false,
    };
    pages.push(currentPage);

    testBox.innerHTML = '';
    testBox.appendChild(currentPage.headerNode.cloneNode(true));

    // Distribute session blocks across pages without splitting tables
    for (let i = 0; i < sessionBlocks.length; i++) {
      const block = sessionBlocks[i];
      const blockClone = block.cloneNode(true) as HTMLElement;

      testBox.appendChild(blockClone);
      const newHeight = testBox.offsetHeight;

      if (newHeight > USABLE_HEIGHT && currentPage.blocks.length > 0) {
        testBox.removeChild(blockClone);

        currentPage = {
          isFirstPage: false,
          headerNode: createSubsequentPageHeader(),
          blocks: [block.cloneNode(true) as HTMLElement],
          hasSignature: false,
        };
        pages.push(currentPage);

        testBox.innerHTML = '';
        testBox.appendChild(currentPage.headerNode.cloneNode(true));
        testBox.appendChild(block.cloneNode(true));
      } else {
        currentPage.blocks.push(block.cloneNode(true) as HTMLElement);
      }
    }

    // Verify if signature block fits on the last page or requires its own page
    if (signatureEl) {
      const sigClone = signatureEl.cloneNode(true) as HTMLElement;
      testBox.appendChild(sigClone);
      const heightWithSig = testBox.offsetHeight;

      if (heightWithSig > USABLE_HEIGHT && currentPage.blocks.length > 0) {
        testBox.removeChild(sigClone);
        currentPage = {
          isFirstPage: false,
          headerNode: createSubsequentPageHeader(),
          blocks: [],
          hasSignature: true,
        };
        pages.push(currentPage);
      } else {
        currentPage.hasSignature = true;
      }
    }

    if (document.body.contains(stage)) {
      document.body.removeChild(stage);
    }

    return {
      pages,
      A4_WIDTH,
      A4_HEIGHT,
      PADDING,
      headerEl,
      titleEl,
      signatureEl,
      footerEl,
    };
  };

  const handleExportPDF = async () => {
    const element = printDocumentRef.current;
    if (!element) {
      showToast('Erreur: Document introuvable', 'error');
      return;
    }

    setIsExportingPDF(true);
    showToast('Génération du fichier PDF officiel multipage en cours...', 'info');

    try {
      const { pages, A4_WIDTH, A4_HEIGHT, PADDING, signatureEl, footerEl } = paginateReportDocument(element);
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
        pageEl.style.fontFamily = 'system-ui, -apple-system, sans-serif';

        const contentSection = document.createElement('div');
        contentSection.className = 'space-y-3';
        contentSection.appendChild(pageData.headerNode);

        pageData.blocks.forEach((b) => {
          contentSection.appendChild(b.cloneNode(true));
        });

        if (pageData.hasSignature && signatureEl) {
          contentSection.appendChild(signatureEl.cloneNode(true));
        }

        pageEl.appendChild(contentSection);

        const footerClone = footerEl.cloneNode(true) as HTMLElement;
        footerClone.style.marginTop = 'auto';

        const pageNumEl = footerClone.querySelector('.page-number-display');
        if (pageNumEl) {
          pageNumEl.textContent = `Page ${p + 1} / ${totalPages}`;
        }

        pageEl.appendChild(footerClone);

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
    const element = printDocumentRef.current;
    if (!element) {
      window.print();
      return;
    }

    try {
      const { pages, signatureEl } = paginateReportDocument(element);
      const totalPages = pages.length;

      // Construct distinct A4 pages identical to the PDF output
      const pagesHtml = pages.map((pageData, p) => `
        <div class="print-a4-page">
          <div class="print-page-content">
            ${pageData.headerNode.outerHTML}
            <div class="space-y-3 mt-2">
              ${pageData.blocks.map(b => b.outerHTML).join('')}
            </div>
            ${pageData.hasSignature && signatureEl ? `<div class="mt-3">${signatureEl.outerHTML}</div>` : ''}
          </div>
          <div class="print-page-footer">
            <div class="footer-top-line">
              <span>Institut Supérieur de Génie Civil et de Gestion (ISGG)</span>
              <span>Page ${p + 1} / ${totalPages}</span>
            </div>
            <p class="footer-text">
              Siège : Ab-Calavi, Aganmandin, Immeuble BOA, 1er et 2ème étages, BP : 1938 Abomey-Calavi
            </p>
            <p class="footer-text-bold">
              E-mail : isgg229@gmail.com - IFU : 3202346783540 - Tel. : 97 00 67 67 / 94 00 40 40
            </p>
          </div>
        </div>
      `).join('');

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
                  padding: 8mm 10mm;
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
                .footer-top-line {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  font-size: 8pt;
                  font-weight: 700;
                  color: #64748b;
                  margin-bottom: 3px;
                  border-bottom: 1px solid #e2e8f0;
                  padding-bottom: 2px;
                }
                .footer-text {
                  margin: 0;
                  font-weight: 500;
                }
                .footer-text-bold {
                  margin: 2px 0 0 0;
                  font-weight: 600;
                  color: #0f172a;
                }
                .session-block {
                  break-inside: avoid !important;
                  page-break-inside: avoid !important;
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
    const originalTitle = document.title;
    try {
      document.title = ' ';
      window.print();
    } finally {
      setTimeout(() => {
        document.title = originalTitle;
      }, 1000);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
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
            className={`px-3.5 py-2 rounded-lg transition-all whitespace-nowrap ${
              reportType === 'discipline' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Alertes Discipline ({studentsAtRisk.length})
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
        className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm print:p-0 print:border-none print:shadow-none space-y-4 print:space-y-2 flex flex-col justify-between min-h-[1050px]"
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
          <div className="space-y-3 print:space-y-1.5 session-block print:break-inside-avoid">
            <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2.5 font-semibold print:hidden">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
              <span>
                Relevé des étudiants en dépassement du seuil réglementaire d&apos;assiduité (≥ 5 absences). Dossier transmis au Conseil de Discipline.
              </span>
            </div>

            <table className="w-full border-collapse border border-black text-xs print:text-[9px] text-black leading-tight">
              <thead>
                <tr className="border-b-2 border-black bg-slate-100/70 font-black">
                  <th className="border border-black py-1 px-1.5 print:py-0.5 print:px-1 w-10 text-center font-black">N°</th>
                  <th className="border border-black py-1 px-1.5 print:py-0.5 print:px-1 text-left font-black">Matricule</th>
                  <th className="border border-black py-1 px-1.5 print:py-0.5 print:px-1 text-left font-black">Nom et Prénoms</th>
                  <th className="border border-black py-1 px-1.5 print:py-0.5 print:px-1 text-left font-black">Filière / Niveau</th>
                  <th className="border border-black py-1 px-1.5 print:py-0.5 print:px-1 text-center font-black">Total Absences</th>
                  <th className="border border-black py-1 px-1.5 print:py-0.5 print:px-1 text-center font-black">Décision Administrative</th>
                </tr>
              </thead>
              <tbody>
                {studentsAtRisk.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-slate-50/50">
                    <td className="border border-black py-1 px-1.5 print:py-0.5 print:px-1 text-center font-bold">{idx + 1}</td>
                    <td className="border border-black py-1 px-1.5 print:py-0.5 print:px-1 font-mono font-bold text-slate-900">{s.matricule}</td>
                    <td className="border border-black py-1 px-1.5 print:py-0.5 print:px-1 font-black uppercase">{s.lastName} {s.firstName}</td>
                    <td className="border border-black py-1 px-1.5 print:py-0.5 print:px-1 font-medium">{s.programName} ({cleanLevelName(s.levelName)})</td>
                    <td className="border border-black py-1 px-1.5 print:py-0.5 print:px-1 text-center font-black text-rose-700">
                      {s.annualAbsenceCount} absences
                    </td>
                    <td className="border border-black py-1 px-1.5 print:py-0.5 print:px-1 text-center font-bold">
                      {s.annualAbsenceCount > 6 ? 'Convocation immédiate' : 'Avertissement écrit'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
    </div>
  );
};
