import {
  User,
  Program,
  Level,
  Subject,
  Student,
  Absence,
  SchoolYear,
  StudentWithStats,
  AbsenceWithDetails,
  DashboardMetrics,
  SheetImportRecord,
  NotificationItem,
  SecurityCodes,
} from '../types';
import {
  INITIAL_USERS,
  INITIAL_PROGRAMS,
  INITIAL_LEVELS,
  INITIAL_SUBJECTS,
  INITIAL_STUDENTS,
  INITIAL_SCHOOL_YEAR,
  DEFAULT_SECURITY_CODES,
} from './constants';
import { db } from './firebase';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { 
  hashPassword, 
  verifyPassword, 
  encryptSensitiveData, 
  decryptSensitiveData,
  validatePasswordStrength 
} from './crypto';
import { rateLimiter } from './rateLimiter';
import { emailOtpService } from './emailOtpService';

export type SyncStatus = 'connected' | 'syncing' | 'offline' | 'error';

const STORAGE_KEYS = {
  CURRENT_USER: 'isgg_current_user',
  USERS: 'isgg_users',
  PROGRAMS: 'isgg_programs',
  LEVELS: 'isgg_levels',
  SUBJECTS: 'isgg_subjects',
  STUDENTS: 'isgg_students',
  ABSENCES: 'isgg_absences',
  SCHOOL_YEAR: 'isgg_school_year',
  SHEET_IMPORTS: 'isgg_sheet_imports',
  NOTIFICATIONS: 'isgg_notifications',
  SECURITY_CODES: 'isgg_security_codes',
};

// Accent folding helper
export function normalizeSearchString(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function formatISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatTime(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function formatFrenchDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    const months = [
      'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
      'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
    ];
    const mIdx = parseInt(month, 10) - 1;
    return `${parseInt(day, 10)} ${months[mIdx] || month} ${year}`;
  }
  return dateStr;
}

/**
 * Calcule l'année scolaire au Bénin selon la règle officielle :
 * - Débute en septembre et s'achève au plus tard en juillet de l'année suivante.
 * - Dès le mois d'août de l'année suivante, la nouvelle année scolaire s'annonce.
 * - Exemple : en septembre 2026, l'année scolaire est 2026-2027.
 */
export function getBeninSchoolYear(date: Date = new Date()): { id: string; name: string; startDate: string; endDate: string } {
  const month = date.getMonth(); // 0 = Janvier, 6 = Juillet, 7 = Août, 8 = Septembre
  const currentYear = date.getFullYear();
  const startYear = month >= 7 ? currentYear : currentYear - 1;
  const endYear = startYear + 1;
  return {
    id: `sy-${startYear}-${endYear}`,
    name: `${startYear}-${endYear}`,
    startDate: `${startYear}-09-01`,
    endDate: `${endYear}-07-31`,
  };
}

// Generate realistic initial seed absences
function generateInitialAbsences(students: Student[], subjects: Subject[]): Absence[] {
  const absences: Absence[] = [];
  const now = new Date();
  const todayStr = formatISODate(now);

  // 1. Give APITHY Mathieu exactly 7 initial absences (from the specifications)
  const apithySubjects = subjects.filter(s => s.programId === 'prog-gi' && s.levelId === 'lvl-l2');
  const pastDates = [
    '2026-09-02',
    '2026-09-03',
    '2026-09-04',
    '2026-09-05',
    '2026-09-07',
    '2026-09-08',
    '2026-09-08',
  ];
  pastDates.forEach((d, idx) => {
    const sub = apithySubjects[idx % apithySubjects.length] || apithySubjects[0];
    absences.push({
      id: `abs-init-apithy-${idx + 1}`,
      studentId: 'stu-apithy-mathieu',
      subjectId: sub.id,
      schoolYearId: INITIAL_SCHOOL_YEAR.id,
      recordedBy: 'M. Diallo',
      absenceDate: d,
      absenceTime: idx % 2 === 0 ? '08:15' : '10:30',
      createdAt: `${d}T08:15:00Z`,
    });
  });

  // 2. Specific records matching Panel 4 mockup:
  // Kouassi Yao (GC, L3, Béton Armé, 28/04/2025 08:15)
  // Traoré Aminata (GP, L2, Comptabilité, 28/04/2025 09:32)
  // Diop Mamadou (GI, L1, Algorithmique, 28/04/2025 10:05)
  // Bamba Fatou (GC, L2, Mécanique des sols, 28/04/2025 11:20)
  // Koné Ibrahim (GP, L3, Marketing, 28/04/2025 13:45)
  // Coulibaly Mariam (GT, L1, Dessin technique, 28/04/2025 14:30)
  const mockupData = [
    { stu: 'stu-kouassi-yao', sub: 'sub-gc-l3-ba', date: '2026-09-09', time: '08:15' },
    { stu: 'stu-traore-aminata', sub: 'sub-gp-l2-compta', date: '2026-09-09', time: '09:32' },
    { stu: 'stu-diop-mamadou', sub: 'sub-l1-algorithme', date: '2026-09-09', time: '10:05' },
    { stu: 'stu-bamba-fatou', sub: 'sub-gc-l2-ms', date: '2026-09-09', time: '11:20' },
    { stu: 'stu-kone-ibrahim', sub: 'sub-gp-l3-mkt', date: '2026-09-09', time: '13:45' },
    { stu: 'stu-coulibaly-mariam', sub: 'sub-gt-l1-dt', date: '2026-09-09', time: '14:30' },
  ];

  mockupData.forEach((item, idx) => {
    absences.push({
      id: `abs-mockup-${idx + 1}`,
      studentId: item.stu,
      subjectId: item.sub,
      schoolYearId: INITIAL_SCHOOL_YEAR.id,
      recordedBy: 'M. Diallo',
      absenceDate: item.date,
      absenceTime: item.time,
      createdAt: `${item.date}T${item.time}:00Z`,
    });
  });

  // Official ISGG Course Sessions Absences matching User Submitted Sheet (09/09/2026)
  const ceo2Sub = subjects.find(s => s.id === 'sub-l2-communication-ecrite-2') || subjects[0];
  const algSub = subjects.find(s => s.id === 'sub-l2-algebre-lineaire') || subjects[1] || subjects[0];

  // Session 1: GI / SIL2_A | Matière: CEO II | 08h à 12h
  const sil2A_Ceo2Students = [
    'stu-aboki-job',
    'stu-amossou-marcelin',
    'stu-atioukpe-carlos',
    'stu-bouraima-abdel',
    'stu-chabi-isdeen',
    'stu-doumatey-chimene',
    'stu-ganni-loukman',
    'stu-nata-jean-yves',
  ];
  sil2A_Ceo2Students.forEach((stuId, idx) => {
    absences.push({
      id: `abs-isgg-sil2a-ceo2-${idx + 1}`,
      studentId: stuId,
      subjectId: ceo2Sub.id,
      schoolYearId: INITIAL_SCHOOL_YEAR.id,
      recordedBy: 'M. Nicaise AÏZOUN',
      absenceDate: '2026-09-09',
      absenceTime: '08:00',
      startTime: '08:00',
      endTime: '12:00',
      timeRange: '08h à 12h',
      className: 'GI / SIL2_A',
      observations: 'Sans motif',
      createdAt: `2026-09-09T08:00:00Z`,
    });
  });

  // Session 2: GI / SIL2_B | Matière: CEO II | 08h à 12h
  const sil2B_Ceo2Students = [
    'stu-acakpo-andre',
    'stu-bode-stephane',
    'stu-gnanguenon-gloria',
    'stu-oladeyo-koudjibou',
    'stu-sero-tikande',
    'stu-sidi-delphin',
  ];
  sil2B_Ceo2Students.forEach((stuId, idx) => {
    absences.push({
      id: `abs-isgg-sil2b-ceo2-${idx + 1}`,
      studentId: stuId,
      subjectId: ceo2Sub.id,
      schoolYearId: INITIAL_SCHOOL_YEAR.id,
      recordedBy: 'M. Nicaise AÏZOUN',
      absenceDate: '2026-09-09',
      absenceTime: '08:00',
      startTime: '08:00',
      endTime: '12:00',
      timeRange: '08h à 12h',
      className: 'GI / SIL2_B',
      observations: 'Sans motif',
      createdAt: `2026-09-09T08:00:00Z`,
    });
  });

  // Session 3: GI / SIL2_A | Matière: Algèbre linéaire | 13h à 17h
  const sil2A_AlgStudents = [
    'stu-aboki-job',
    'stu-amossou-marcelin',
    'stu-atioukpe-carlos',
    'stu-bouraima-abdel',
  ];
  sil2A_AlgStudents.forEach((stuId, idx) => {
    absences.push({
      id: `abs-isgg-sil2a-alg-${idx + 1}`,
      studentId: stuId,
      subjectId: algSub.id,
      schoolYearId: INITIAL_SCHOOL_YEAR.id,
      recordedBy: 'M. Nicaise AÏZOUN',
      absenceDate: '2026-09-09',
      absenceTime: '13:00',
      startTime: '13:00',
      endTime: '17:00',
      timeRange: '13h à 17h',
      className: 'GI / SIL2_A',
      observations: 'Sans motif',
      createdAt: `2026-09-09T13:00:00Z`,
    });
  });

  // Session 4: GI / SIL2_B | Matière: Algèbre linéaire | 13h à 17h
  const sil2B_AlgStudents = [
    'stu-acakpo-andre',
    'stu-bode-stephane',
    'stu-gnanguenon-gloria',
  ];
  sil2B_AlgStudents.forEach((stuId, idx) => {
    absences.push({
      id: `abs-isgg-sil2b-alg-${idx + 1}`,
      studentId: stuId,
      subjectId: algSub.id,
      schoolYearId: INITIAL_SCHOOL_YEAR.id,
      recordedBy: 'M. Nicaise AÏZOUN',
      absenceDate: '2026-09-09',
      absenceTime: '13:00',
      startTime: '13:00',
      endTime: '17:00',
      timeRange: '13h à 17h',
      className: 'GI / SIL2_B',
      observations: 'Sans motif',
      createdAt: `2026-09-09T13:00:00Z`,
    });
  });

  // 3. Fill up to match ~24 absences today, ~137 this week, ~1284 total
  const remainingToday = 18;
  for (let i = 0; i < remainingToday; i++) {
    const randomStu = students[i % students.length];
    const stuSubjects = subjects.filter(s => s.programId === randomStu.programId) || subjects;
    const randomSub = stuSubjects[i % stuSubjects.length] || subjects[0];
    const hour = 8 + Math.floor(i / 3);
    const min = (i * 12) % 60;
    const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;

    absences.push({
      id: `abs-today-${i + 1}`,
      studentId: randomStu.id,
      subjectId: randomSub.id,
      schoolYearId: INITIAL_SCHOOL_YEAR.id,
      recordedBy: 'M. Diallo',
      absenceDate: todayStr,
      absenceTime: timeStr,
      createdAt: `${todayStr}T${timeStr}:00Z`,
    });
  }

  // Add more past days of this week to reach 137 absences for the week
  const daysAgo = [1, 2, 3, 4, 5, 6];
  let weekCounter = 24;
  for (const d of daysAgo) {
    const pastDay = new Date(now);
    pastDay.setDate(pastDay.getDate() - d);
    const pStr = formatISODate(pastDay);
    const countForDay = Math.min(22, 137 - weekCounter);
    for (let j = 0; j < countForDay; j++) {
      const randomStu = students[(j + d * 3) % students.length];
      const stuSubjects = subjects.filter(s => s.programId === randomStu.programId);
      const randomSub = stuSubjects[j % (stuSubjects.length || 1)] || subjects[0];
      absences.push({
        id: `abs-week-${d}-${j}`,
        studentId: randomStu.id,
        subjectId: randomSub.id,
        schoolYearId: INITIAL_SCHOOL_YEAR.id,
        recordedBy: 'M. Diallo',
        absenceDate: pStr,
        absenceTime: '09:00',
        createdAt: `${pStr}T09:00:00Z`,
      });
      weekCounter++;
    }
  }

  // Pre-seed remaining historical records distributed across earlier months
  // to establish the annual benchmark of ~1284
  const targetAnnual = 1284;
  const needed = targetAnnual - absences.length;
  for (let k = 0; k < needed; k++) {
    const randomStu = students[k % students.length];
    const stuSubjects = subjects.filter(s => s.programId === randomStu.programId);
    const randomSub = stuSubjects[k % (stuSubjects.length || 1)] || subjects[0];
    const randomMonth = (k % 8) + 1; // months 1 to 8
    const randomDay = (k % 25) + 1;
    const pastStr = `2026-${String(randomMonth).padStart(2, '0')}-${String(randomDay).padStart(2, '0')}`;
    absences.push({
      id: `abs-hist-${k}`,
      studentId: randomStu.id,
      subjectId: randomSub.id,
      schoolYearId: INITIAL_SCHOOL_YEAR.id,
      recordedBy: k % 4 === 0 ? 'Dr. K. Mensah' : 'M. Diallo',
      absenceDate: pastStr,
      absenceTime: '08:30',
      createdAt: `${pastStr}T08:30:00Z`,
    });
  }

  return absences;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'Rapport d\'assiduité disponible',
    description: 'Le rapport consolidé de la semaine a été mis à jour.',
    time: 'Il y a 20 min',
    read: false,
    type: 'info',
  },
  {
    id: 'notif-2',
    title: 'Seuil critique d\'absences',
    description: 'Attention : des étudiants approchent le seuil réglementaire d\'heures.',
    time: 'Aujourd\'hui',
    read: false,
    type: 'warning',
  },
  {
    id: 'notif-3',
    title: 'Année académique synchronisée',
    description: 'Le calendrier académique 2026-2027 est actif.',
    time: 'Il y a 2 jours',
    read: true,
    type: 'success',
  },
];

class StorageService {
  private currentUser: User | null = null;
  private users: User[] = INITIAL_USERS;
  private programs: Program[] = INITIAL_PROGRAMS;
  private levels: Level[] = INITIAL_LEVELS;
  private subjects: Subject[] = INITIAL_SUBJECTS;
  private students: Student[] = INITIAL_STUDENTS;
  private absences: Absence[] = [];
  private schoolYear: SchoolYear = INITIAL_SCHOOL_YEAR;
  private sheetImports: SheetImportRecord[] = [];
  private notifications: NotificationItem[] = [];
  private securityCodes: SecurityCodes = DEFAULT_SECURITY_CODES;
  private listeners: Set<() => void> = new Set();
  private syncStatus: SyncStatus = 'syncing';
  private firestoreInitialized = false;

  constructor() {
    this.init();
    if (typeof window !== 'undefined') {
      // Initialize real-time cloud listeners
      setTimeout(() => {
        this.initFirestoreSync();
      }, 50);
    }
  }

  public getSyncStatus(): SyncStatus {
    return this.syncStatus;
  }

  private init() {
    if (typeof window === 'undefined') return;

    try {
      const savedCodes = localStorage.getItem(STORAGE_KEYS.SECURITY_CODES);
      if (savedCodes) {
        try {
          const parsed = JSON.parse(savedCodes);
          this.securityCodes = {
            ...DEFAULT_SECURITY_CODES,
            ...parsed,
          };
          if (this.securityCodes.directorCode === 'ISGG-DIR-ADMIN-2026' || !this.securityCodes.directorCode) {
            this.securityCodes.directorCode = 'ISGG-DIR-9482';
          }
        } catch {
          this.securityCodes = DEFAULT_SECURITY_CODES;
        }
      } else {
        this.securityCodes = DEFAULT_SECURITY_CODES;
      }

      const savedUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (savedUser) {
        try {
          this.currentUser = JSON.parse(savedUser);
        } catch {
          this.currentUser = null;
        }
      } else {
        this.currentUser = null;
      }

      const savedUsers = localStorage.getItem(STORAGE_KEYS.USERS);
      if (savedUsers) this.users = JSON.parse(savedUsers);

      const savedPrograms = localStorage.getItem(STORAGE_KEYS.PROGRAMS);
      if (savedPrograms) {
        this.programs = JSON.parse(savedPrograms);
        // Ensure availableGroups exists on programs
        this.programs = this.programs.map(p => {
          const init = INITIAL_PROGRAMS.find(ip => ip.id === p.id);
          return {
            ...p,
            availableGroups: p.availableGroups || init?.availableGroups || ['A'],
          };
        });
      }

      const savedLevels = localStorage.getItem(STORAGE_KEYS.LEVELS);
      if (savedLevels) {
        this.levels = (JSON.parse(savedLevels) as Level[]).map(l => ({
          ...l,
          name: l.name.replace(/^[0-9]+[èe]me?\s+année\s*\((Licence\s+[0-9]+)\)/i, '$1')
        }));
      }

      const savedSubjects = localStorage.getItem(STORAGE_KEYS.SUBJECTS);
      if (savedSubjects) {
        const loaded = JSON.parse(savedSubjects) as Subject[];
        // Keep official GI subjects with latest metadata (e.g. CEO II), plus any dynamic subjects (sub-dyn-) and subjects from other programs
        const dynamicOrCustomSubjects = loaded.filter(s => s.id.startsWith('sub-dyn-'));
        const nonGi = loaded.filter(s => 
          !s.id.startsWith('sub-dyn-') && 
          !(s.programId === 'prog-gi' && (s.levelId === 'lvl-l1' || s.levelId === 'lvl-l2' || s.levelId === 'lvl-l3'))
        );
        const officialGi = INITIAL_SUBJECTS.filter(s => s.programId === 'prog-gi' && (s.levelId === 'lvl-l1' || s.levelId === 'lvl-l2' || s.levelId === 'lvl-l3'));
        
        // Merge without duplicates by ID
        const mergedMap = new Map<string, Subject>();
        [...officialGi, ...nonGi, ...dynamicOrCustomSubjects].forEach(sub => {
          mergedMap.set(sub.id, sub);
        });
        this.subjects = Array.from(mergedMap.values());
        this.persistSubjects();
      }

      const savedStudents = localStorage.getItem(STORAGE_KEYS.STUDENTS);
      if (savedStudents) {
        this.students = JSON.parse(savedStudents);
        // Ensure new initial students exist as well
        INITIAL_STUDENTS.forEach(init => {
          if (!this.students.some(s => s.id === init.id)) {
            this.students.push(init);
          }
        });
        // Ensure students have classGroup if initialized from initial students
        this.students = this.students.map(s => {
          const init = INITIAL_STUDENTS.find(is => is.id === s.id);
          return {
            ...s,
            classGroup: s.classGroup || init?.classGroup || 'A',
          };
        });
      }

      const savedSchoolYear = localStorage.getItem(STORAGE_KEYS.SCHOOL_YEAR);
      if (savedSchoolYear) {
        try {
          const parsed = JSON.parse(savedSchoolYear);
          if (parsed && (parsed.name === '2025-2026' || parsed.id === 'sy-2025-2026')) {
            this.schoolYear = INITIAL_SCHOOL_YEAR;
            localStorage.setItem(STORAGE_KEYS.SCHOOL_YEAR, JSON.stringify(INITIAL_SCHOOL_YEAR));
          } else {
            this.schoolYear = parsed;
          }
        } catch {
          this.schoolYear = INITIAL_SCHOOL_YEAR;
        }
      }

      const savedAbsences = localStorage.getItem(STORAGE_KEYS.ABSENCES);
      if (savedAbsences) {
        let loadedAbsences = JSON.parse(savedAbsences) as Absence[];
        
        // Map old legacy subject IDs to official ones
        const legacySubjectMap: Record<string, string> = {
          'sub-gi-l1-algo': 'sub-l1-algorithme',
          'sub-gi-l1-prog': 'sub-l1-langage-c',
          'sub-math-l1': 'sub-l1-analyse',
          'sub-gi-l2-bd': 'sub-l2-bases-de-donnees-2',
          'sub-gi-l2-algo': 'sub-l2-algorithmes-avances',
          'sub-gi-l2-res': 'sub-l2-tele-informatique-reseau',
          'sub-gi-l2-dev': 'sub-l2-programmation-web-2',
          'sub-gi-l3-secu': 'sub-l3-architecture-systemes-exploitation',
          'sub-gi-l3-cloud': 'sub-l3-teleinformatique-reseaux-3',
        };

        let modified = false;
        loadedAbsences = loadedAbsences.map(a => {
          let currentSubjectId = a.subjectId;
          if (legacySubjectMap[currentSubjectId]) {
            currentSubjectId = legacySubjectMap[currentSubjectId];
            modified = true;
          }

          // Special retro-repair for ISGG sheet of 2026-09-09:
          // Morning session (08h00 - 12h00) in SIL2 was CEO II (Communication Écrite et Orale 2)
          // Afternoon session (13h00 - 17h00) in SIL2 was Algèbre linéaire
          const isMorningL2 = (a.startTime === '08:00' || a.absenceTime?.startsWith('08')) && 
                              (a.endTime === '12:00' || a.absenceTime?.includes('12')) &&
                              (a.className?.includes('SIL2') || (!a.className && this.students.find(s => s.id === a.studentId)?.levelId === 'lvl-l2'));

          const isAfternoonL2 = (a.startTime === '13:00' || a.absenceTime?.startsWith('13')) &&
                                (a.endTime === '17:00' || a.absenceTime?.includes('17')) &&
                                (a.className?.includes('SIL2') || (!a.className && this.students.find(s => s.id === a.studentId)?.levelId === 'lvl-l2'));

          if (isMorningL2 && currentSubjectId !== 'sub-l2-communication-ecrite-2') {
            currentSubjectId = 'sub-l2-communication-ecrite-2';
            modified = true;
          } else if (isAfternoonL2 && currentSubjectId !== 'sub-l2-algebre-lineaire') {
            currentSubjectId = 'sub-l2-algebre-lineaire';
            modified = true;
          }

          const exists = this.subjects.some(s => s.id === currentSubjectId);
          if (!exists) {
            if (currentSubjectId.includes('ceo') || currentSubjectId.includes('communication')) {
              currentSubjectId = 'sub-l2-communication-ecrite-2';
              modified = true;
            }
          }

          return {
            ...a,
            subjectId: currentSubjectId,
          };
        });

        if (modified) {
          localStorage.setItem(STORAGE_KEYS.ABSENCES, JSON.stringify(loadedAbsences));
        }

        this.absences = loadedAbsences;
      } else {
        // Initialize seed absences
        this.absences = generateInitialAbsences(this.students, this.subjects);
        localStorage.setItem(STORAGE_KEYS.ABSENCES, JSON.stringify(this.absences));
      }

      const savedImports = localStorage.getItem(STORAGE_KEYS.SHEET_IMPORTS);
      if (savedImports) {
        try {
          this.sheetImports = JSON.parse(savedImports);
        } catch {
          this.sheetImports = [];
        }
      }

      const savedNotifications = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      if (savedNotifications) {
        try {
          this.notifications = JSON.parse(savedNotifications);
        } catch {
          this.notifications = INITIAL_NOTIFICATIONS;
        }
      } else {
        this.notifications = INITIAL_NOTIFICATIONS;
        this.persistNotifications();
      }
    } catch (e) {
      console.warn('LocalStorage error, using memory state:', e);
      this.absences = generateInitialAbsences(this.students, this.subjects);
      this.notifications = INITIAL_NOTIFICATIONS;
    }
  }

  // --- Real-time Firestore Cloud Synchronization ---
  private async initFirestoreSync() {
    try {
      // 1. Listen to Absences
      const absencesCol = collection(db, 'isgg_absences');
      onSnapshot(
        absencesCol,
        (snapshot) => {
          if (snapshot.empty) {
            // First time running on Cloud: seed initial/local absences to Cloud
            if (!this.firestoreInitialized) {
              this.firestoreInitialized = true;
              this.seedCloudFromLocal();
            }
          } else {
            this.firestoreInitialized = true;
            const remoteAbsences: Absence[] = [];
            snapshot.forEach((docSnap) => {
              remoteAbsences.push(docSnap.data() as Absence);
            });
            // Update local in-memory state and localStorage mirror
            this.absences = remoteAbsences.sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            if (typeof window !== 'undefined') {
              localStorage.setItem(STORAGE_KEYS.ABSENCES, JSON.stringify(this.absences));
            }
            this.syncStatus = 'connected';
            this.notify();
          }
        },
        (error) => {
          console.warn('Firestore absences listener notice:', error);
          this.syncStatus = 'offline';
          this.notify();
        }
      );

      // 2. Listen to Students
      const studentsCol = collection(db, 'isgg_students');
      onSnapshot(
        studentsCol,
        (snapshot) => {
          if (!snapshot.empty) {
            const remoteStudents: Student[] = [];
            snapshot.forEach((docSnap) => {
              remoteStudents.push(docSnap.data() as Student);
            });
            if (remoteStudents.length > 0) {
              this.students = remoteStudents;
              if (typeof window !== 'undefined') {
                localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(this.students));
              }
              this.syncStatus = 'connected';
              this.notify();
            }
          }
        },
        (err) => {
          console.warn('Firestore students sync notice:', err);
        }
      );

      // 3. Listen to Notifications
      const notifsCol = collection(db, 'isgg_notifications');
      onSnapshot(
        notifsCol,
        (snapshot) => {
          if (!snapshot.empty) {
            const remoteNotifs: NotificationItem[] = [];
            snapshot.forEach((docSnap) => {
              remoteNotifs.push(docSnap.data() as NotificationItem);
            });
            this.notifications = remoteNotifs;
            if (typeof window !== 'undefined') {
              localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(this.notifications));
            }
            this.notify();
          }
        },
        () => {}
      );

      // 4. Listen to Cloud Users
      const usersCol = collection(db, 'isgg_users');
      onSnapshot(
        usersCol,
        (snapshot) => {
          if (!snapshot.empty) {
            const remoteUsers: User[] = [];
            snapshot.forEach((docSnap) => {
              remoteUsers.push(docSnap.data() as User);
            });
            const userMap = new Map<string, User>();
            this.users.forEach((u) => userMap.set(u.id, u));
            remoteUsers.forEach((u) => userMap.set(u.id, u));
            this.users = Array.from(userMap.values());
            this.persistUsers();
            this.notify();
          }
        },
        (err) => {
          console.warn('Firestore users sync notice:', err);
        }
      );

      // 5. Listen to Security Codes
      const secDocRef = doc(db, 'isgg_metadata', 'security_codes');
      onSnapshot(
        secDocRef,
        (docSnap) => {
          if (docSnap.exists()) {
            this.securityCodes = docSnap.data() as SecurityCodes;
            if (typeof window !== 'undefined') {
              localStorage.setItem(STORAGE_KEYS.SECURITY_CODES, JSON.stringify(this.securityCodes));
            }
            this.notify();
          } else {
            setDoc(secDocRef, this.securityCodes, { merge: true }).catch(() => {});
          }
        },
        (err) => {
          console.warn('Firestore security_codes sync notice:', err);
        }
      );

      // Online / Offline window events
      if (typeof window !== 'undefined') {
        window.addEventListener('online', () => {
          this.syncStatus = 'connected';
          this.notify();
        });
        window.addEventListener('offline', () => {
          this.syncStatus = 'offline';
          this.notify();
        });
      }
    } catch (e) {
      console.warn('Could not connect to Firestore listeners:', e);
      this.syncStatus = 'offline';
      this.notify();
    }
  }

  // Seed initial cloud state using batch
  private async seedCloudFromLocal() {
    try {
      this.syncStatus = 'syncing';
      this.notify();

      // Seed absences
      const absencesBatch = writeBatch(db);
      const itemsToSeed = this.absences.length > 0 ? this.absences : generateInitialAbsences(this.students, this.subjects);
      itemsToSeed.slice(0, 450).forEach((abs) => {
        const ref = doc(db, 'isgg_absences', abs.id);
        absencesBatch.set(ref, abs, { merge: true });
      });
      await absencesBatch.commit();

      // Seed students
      const studentsBatch = writeBatch(db);
      this.students.slice(0, 450).forEach((stu) => {
        const ref = doc(db, 'isgg_students', stu.id);
        studentsBatch.set(ref, stu, { merge: true });
      });
      await studentsBatch.commit();

      // Seed initial notifications
      const notifBatch = writeBatch(db);
      this.notifications.forEach((notif) => {
        const ref = doc(db, 'isgg_notifications', notif.id);
        notifBatch.set(ref, notif, { merge: true });
      });
      await notifBatch.commit();

      this.syncStatus = 'connected';
      this.notify();
    } catch (error) {
      console.warn('Firestore seeding notice (fallback local mode):', error);
      this.syncStatus = 'connected';
      this.notify();
    }
  }

  // Cloud helper: write absence to Cloud asynchronously
  private async syncAbsenceToCloud(absence: Absence) {
    try {
      this.syncStatus = 'syncing';
      this.notify();
      const ref = doc(db, 'isgg_absences', absence.id);
      await setDoc(ref, absence, { merge: true });
      this.syncStatus = 'connected';
      this.notify();
    } catch (e) {
      console.warn('Could not sync absence to Firestore, saved locally:', e);
      this.syncStatus = 'offline';
      this.notify();
    }
  }

  // Cloud helper: delete absence from Cloud asynchronously
  private async deleteAbsenceFromCloud(absenceId: string) {
    try {
      const ref = doc(db, 'isgg_absences', absenceId);
      await deleteDoc(ref);
    } catch (e) {
      console.warn('Could not delete absence in Firestore, deleted locally:', e);
    }
  }

  // Cloud helper: sync student to Cloud asynchronously
  private async syncStudentToCloud(student: Student) {
    try {
      const ref = doc(db, 'isgg_students', student.id);
      await setDoc(ref, student, { merge: true });
    } catch (e) {
      console.warn('Could not sync student to Firestore, saved locally:', e);
    }
  }

  // Cloud helper: sync notification to Cloud asynchronously
  private async syncNotificationToCloud(notif: NotificationItem) {
    try {
      const ref = doc(db, 'isgg_notifications', notif.id);
      await setDoc(ref, notif, { merge: true });
    } catch (e) {
      console.warn('Could not sync notification to Firestore:', e);
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }

  // Notifications Management
  public getNotifications(): NotificationItem[] {
    return this.notifications;
  }

  public getUnreadNotificationCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  public markNotificationAsRead(id: string): void {
    const target = this.notifications.find(n => n.id === id);
    this.notifications = this.notifications.map(n => n.id === id ? { ...n, read: true } : n);
    this.persistNotifications();
    this.notify();
    if (target) {
      this.syncNotificationToCloud({ ...target, read: true });
    }
  }

  public markAllNotificationsAsRead(): void {
    this.notifications = this.notifications.map(n => ({ ...n, read: true }));
    this.persistNotifications();
    this.notify();
    this.notifications.forEach(n => this.syncNotificationToCloud(n));
  }

  private persistNotifications(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(this.notifications));
    }
  }

  // Getters
  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  public setCurrentUser(user: User | null): void {
    this.currentUser = user;
    if (typeof window !== 'undefined') {
      if (user) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
      } else {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      }
    }
    this.notify();
  }

  public logout(): void {
    this.setCurrentUser(null);
  }

  public persistUsers(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(this.users));
    }
  }

  public async syncUserToCloud(user: User): Promise<void> {
    try {
      // Pour Firestore, les données sensibles sont chiffrées au repos
      const userPayload: Record<string, any> = {
        ...user,
      };

      // Si le mot de passe est en clair, on s'assure qu'il est haché avant l'écriture dans Firestore
      if (userPayload.password && !userPayload.password.startsWith('sha256$') && !userPayload.password.startsWith('legacy$')) {
        userPayload.password = await hashPassword(userPayload.password);
      }

      // Chiffrement strict des champs personnels d'identification dans Firestore
      if (userPayload.email) {
        userPayload.emailEncrypted = await encryptSensitiveData(userPayload.email);
      }
      if (userPayload.name) {
        userPayload.nameEncrypted = await encryptSensitiveData(userPayload.name);
      }

      const docRef = doc(db, 'isgg_users', user.id);
      await setDoc(docRef, userPayload, { merge: true });
    } catch (err) {
      console.warn('Firestore syncUserToCloud error:', err);
    }
  }

  public validateInstitutionalCode(role: import('../types').UserRole, authCode: string): boolean {
    const normalizeKey = (k: string) => (k || '').trim().toUpperCase().replace(/[\s\-_]/g, '');
    const enteredNorm = normalizeKey(authCode);
    if (!enteredNorm) return false;

    if (role === 'ADMIN') {
      const allowedAdminKeys = [
        normalizeKey(this.securityCodes?.directorCode || ''),
        normalizeKey('ISGG-DIR-9482'),
        normalizeKey('ISGG-DIR-ADMIN-2026'),
        normalizeKey(DEFAULT_SECURITY_CODES.directorCode),
      ].filter(Boolean);
      return allowedAdminKeys.includes(enteredNorm);
    } else {
      const allowedSurvKeys = [
        normalizeKey(this.securityCodes?.surveillantCode || ''),
        normalizeKey('ISGG-SURV-2026'),
        normalizeKey('ISGG-SURV-ADMIN-2026'),
        normalizeKey(DEFAULT_SECURITY_CODES.surveillantCode),
      ].filter(Boolean);
      return allowedSurvKeys.includes(enteredNorm);
    }
  }

  /**
   * Étape 1 de création de compte : validation stricte et expédition de code OTP à l'email
   */
  public async initiateRegistration(data: {
    name: string;
    email: string;
    role: import('../types').UserRole;
    title?: string;
    password?: string;
    authCode: string;
  }): Promise<{
    success: boolean;
    message: string;
    lockedUntil?: number | null;
    isBanned?: boolean;
    delivered?: boolean;
    warning?: string;
    debugCode?: string;
  }> {
    const regContextKey = 'registration';
    const rateState = await rateLimiter.getCloudState(regContextKey);

    // Contrôle Bannissement permanent (> 100 échecs)
    if (rateState.isBanned || rateLimiter.isClientBanned()) {
      return {
        success: false,
        message: 'Accès strictement interdit : Cette adresse IP / poste a été banni suite à un nombre excessif de tentatives malveillantes (> 100 échecs). Veuillez contacter le secrétariat ISGG.',
        isBanned: true,
      };
    }

    // Contrôle Verrou temporaire de 5 minutes côté serveur
    if (rateState.lockUntil && Date.now() < rateState.lockUntil) {
      const remainingSec = Math.ceil((rateState.lockUntil - Date.now()) / 1000);
      const minutes = Math.floor(remainingSec / 60);
      const seconds = remainingSec % 60;
      const formatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      return {
        success: false,
        message: `Sécurité ISGG : 3 tentatives erronées consécutives. Inscription verrouillée pendant 5 minutes. Temps restant : ${formatted}.`,
        lockedUntil: rateState.lockUntil,
      };
    }

    // Validation complexité du mot de passe
    if (data.password) {
      const strength = validatePasswordStrength(data.password);
      if (!strength.isValid) {
        return {
          success: false,
          message: strength.message || 'Le mot de passe ne respecte pas les critères de sécurité requis (majuscule, minuscule, chiffre, symbole et min. 8 caractères).',
        };
      }
    }

    // Validation du code d'habilitation institutionnel
    const isValidCode = this.validateInstitutionalCode(data.role, data.authCode);
    if (!isValidCode) {
      const failureState = await rateLimiter.recordFailure(
        regContextKey,
        `Échec du code d'habilitation pour rôle ${data.role}`
      );

      if (failureState.isBanned) {
        return {
          success: false,
          message: 'Alerte de sécurité critique : Votre adresse IP a été définitivement bannie suite à plus de 100 tentatives échouées.',
          isBanned: true,
        };
      }

      if (failureState.lockUntil && Date.now() < failureState.lockUntil) {
        return {
          success: false,
          message: 'Sécurité ISGG : 3 codes d\'habilitation erronés consécutifs. Vous devez patienter 5 minutes avant de pouvoir réessayer.',
          lockedUntil: failureState.lockUntil,
        };
      }

      const remainingAttempts = 3 - failureState.failureCount;
      return { 
        success: false, 
        message: `Code d'habilitation incorrect pour le profil ${data.role === 'ADMIN' ? 'Directeur' : 'Surveillant'}. Plus que ${remainingAttempts} tentative${remainingAttempts > 1 ? 's' : ''} avant blocage de 5 minutes.` 
      };
    }

    // Vérifier si l'adresse email est déjà utilisée
    const emailClean = data.email.trim().toLowerCase();
    const existing = this.users.find(u => u.email.trim().toLowerCase() === emailClean);
    if (existing) {
      return { success: false, message: 'Un compte avec cette adresse email existe déjà. Veuillez vous connecter.' };
    }

    // Envoi du code OTP par email réel (acheminé vers la boîte mail)
    const emailResult = await emailOtpService.sendRegistrationOtp(emailClean, data.name, data.role);
    if (!emailResult.success) {
      return {
        success: false,
        message: emailResult.message,
      };
    }

    return {
      success: true,
      message: emailResult.message,
      delivered: emailResult.delivered,
      warning: emailResult.warning,
      debugCode: emailResult.debugCode,
    };
  }

  /**
   * Étape 2 de création de compte : validation du code OTP reçu par email et activation finale
   */
  public async completeRegistrationWithOtp(
    data: {
      name: string;
      email: string;
      role: import('../types').UserRole;
      title?: string;
      password?: string;
      authCode: string;
    },
    enteredOtp: string
  ): Promise<{ success: boolean; message: string; user?: User; lockedUntil?: number | null; isBanned?: boolean }> {
    const regContextKey = 'registration';
    const emailClean = data.email.trim().toLowerCase();

    // Vérification du code OTP sur Firestore & cache local
    const otpVerify = await emailOtpService.verifyRegistrationOtp(emailClean, enteredOtp);
    if (!otpVerify.success) {
      // N'appliquer le verrou serveur que si toutes les tentatives autorisées ont été épuisées
      let lockedUntil: number | null = null;
      let isBanned = false;
      if (otpVerify.remainingAttempts === 0) {
        const failureState = await rateLimiter.recordFailure(
          regContextKey,
          `Épuisement des tentatives OTP pour ${emailClean}`
        );
        lockedUntil = failureState.lockUntil;
        isBanned = failureState.isBanned;
      }
      return {
        success: false,
        message: otpVerify.message,
        lockedUntil,
        isBanned,
      };
    }

    // Réinitialisation du limiteur d'échecs après succès
    await rateLimiter.recordSuccess(regContextKey);

    const defaultTitle = data.role === 'ADMIN' ? 'Directeur / Administration' : 'Surveillant';
    const roleTitle = data.title?.trim() || defaultTitle;
    const hashedPassword = data.password ? await hashPassword(data.password) : '';

    const newUser: User = {
      id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: data.name.trim(),
      email: emailClean,
      role: data.role,
      title: roleTitle,
      password: hashedPassword,
      isActive: true,
      emailVerified: true,
      avatarUrl: `https://images.unsplash.com/photo-${data.role === 'ADMIN' ? '1472099645785-5658abf4ff4e' : '1535713875002-d1d0cf377fde'}?w=150&auto=format&fit=crop&q=80`,
      lastLogin: 'Aujourd\'hui à ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    };

    this.users.unshift(newUser);
    this.persistUsers();
    this.setCurrentUser(newUser);
    await this.syncUserToCloud(newUser);
    this.notify();

    return { success: true, message: 'Adresse email vérifiée ! Compte activé avec succès.', user: newUser };
  }

  public async registerUser(data: {
    name: string;
    email: string;
    role: import('../types').UserRole;
    title?: string;
    password?: string;
    authCode: string;
  }): Promise<{ success: boolean; message: string; user?: User; lockedUntil?: number | null; isBanned?: boolean }> {
    // Méthode directe de repli
    const initResult = await this.initiateRegistration(data);
    if (!initResult.success) {
      return initResult;
    }
    // Si un code est généré, complétion
    return this.completeRegistrationWithOtp(data, initResult.debugCode || '');
  }

  /**
   * Demande de réinitialisation de mot de passe par code OTP
   */
  public async requestPasswordResetOtp(email: string): Promise<{ success: boolean; message: string; user?: User; delivered?: boolean; warning?: string; debugCode?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const user = this.users.find(u => u.email.toLowerCase() === cleanEmail);
    if (!user) {
      return {
        success: false,
        message: 'Aucun compte enregistré avec cette adresse email. Veuillez vérifier votre saisie.',
      };
    }

    const resetResult = await emailOtpService.sendPasswordResetOtp(cleanEmail);
    if (!resetResult.success) {
      return { success: false, message: resetResult.message };
    }

    return {
      success: true,
      message: resetResult.message,
      user,
      delivered: resetResult.delivered,
      warning: resetResult.warning,
      debugCode: resetResult.debugCode,
    };
  }

  /**
   * Validation de la réinitialisation de mot de passe avec code OTP et code d'habilitation
   */
  public async resetPasswordWithOtp(data: {
    email: string;
    otpCode: string;
    authCode: string;
    newPassword: string;
  }): Promise<{ success: boolean; message: string }> {
    const cleanEmail = data.email.trim().toLowerCase();
    const user = this.users.find(u => u.email.toLowerCase() === cleanEmail);
    if (!user) {
      return { success: false, message: 'Compte introuvable.' };
    }

    // 1. Validation mot de passe
    const strength = validatePasswordStrength(data.newPassword);
    if (!strength.isValid) {
      return { success: false, message: strength.message || 'Le nouveau mot de passe ne respecte pas les critères de sécurité.' };
    }

    // 2. Validation code d'habilitation
    const isCodeValid = this.validateInstitutionalCode(user.role, data.authCode);
    if (!isCodeValid) {
      return { 
        success: false, 
        message: `Code d'habilitation incorrect pour votre profil ${user.role === 'ADMIN' ? 'Directeur' : 'Surveillant'}.` 
      };
    }

    // 3. Validation OTP sur Firestore
    const otpRes = await emailOtpService.verifyPasswordResetOtp(cleanEmail, data.otpCode);
    if (!otpRes.success) {
      return { success: false, message: otpRes.message };
    }

    // 4. Mise à jour du mot de passe
    const hashedPassword = await hashPassword(data.newPassword);
    user.password = hashedPassword;
    this.persistUsers();
    await this.syncUserToCloud(user);

    // Débloque les éventuels verrous de connexion pour cet email
    await rateLimiter.recordSuccess(`login_${cleanEmail}`);

    return {
      success: true,
      message: 'Votre mot de passe a été réinitialisé avec succès ! Vous pouvez maintenant vous connecter.',
    };
  }

  public async authenticateUser(identifier: string, password?: string): Promise<{
    success: boolean;
    message: string;
    user?: User;
    lockedUntil?: number | null;
    isBanned?: boolean;
  }> {
    const cleanId = identifier.trim().toLowerCase();
    const user = this.users.find(u =>
      u.email.toLowerCase() === cleanId ||
      u.name.toLowerCase() === cleanId
    );

    // Contexte de verrouillage basé sur l'identifiant saisi
    const loginContextKey = `login_${cleanId || 'unknown'}`;
    const rateState = await rateLimiter.getCloudState(loginContextKey);

    // Contrôle Bannissement IP permanent
    if (rateState.isBanned || rateLimiter.isClientBanned()) {
      return {
        success: false,
        message: 'Accès strictement refusé : Votre adresse IP est bannie suite à des tentatives excessives (> 100 échecs).',
        isBanned: true,
      };
    }

    // Contrôle Verrou temporaire de 5 minutes côté serveur
    if (rateState.lockUntil && Date.now() < rateState.lockUntil) {
      const remainingSec = Math.ceil((rateState.lockUntil - Date.now()) / 1000);
      const minutes = Math.floor(remainingSec / 60);
      const seconds = remainingSec % 60;
      const formatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      return {
        success: false,
        message: `Compte temporairement verrouillé pour 5 minutes suite à 3 mots de passe erronés. Temps d'attente restant : ${formatted}.`,
        lockedUntil: rateState.lockUntil,
      };
    }

    if (!user) {
      return { success: false, message: 'Identifiant ou adresse email introuvable. Veuillez vérifier ou créer un compte.' };
    }

    if (user.isActive === false) {
      return { 
        success: false, 
        message: 'Ce compte utilisateur a été suspendu par la direction générale de l\'ISGG. Veuillez contacter le secrétariat administratif.' 
      };
    }

    // Vérification cryptographique du mot de passe
    if (user.password && password) {
      const isPwdValid = await verifyPassword(password, user.password);
      if (!isPwdValid) {
        const failureState = await rateLimiter.recordFailure(
          loginContextKey,
          `Mot de passe erroné pour le compte ${user.email}`
        );

        if (failureState.isBanned) {
          return {
            success: false,
            message: 'Alerte de sécurité critique : Votre adresse IP a été définitivement bannie suite à plus de 100 tentatives infructueuses.',
            isBanned: true,
          };
        }

        if (failureState.lockUntil && Date.now() < failureState.lockUntil) {
          return {
            success: false,
            message: 'Sécurité ISGG : 3 mots de passe erronés consécutifs. Ce compte est verrouillé pour 5 minutes.',
            lockedUntil: failureState.lockUntil,
          };
        }

        const remaining = 3 - failureState.failureCount;
        return { 
          success: false, 
          message: `Mot de passe incorrect. Il vous reste ${remaining} tentative${remaining > 1 ? 's' : ''} avant verrouillage de 5 minutes.` 
        };
      }
    }

    // Mot de passe correct -> Réinitialise les échecs consécutifs
    await rateLimiter.recordSuccess(loginContextKey);

    user.lastLogin = 'Aujourd\'hui à ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    this.setCurrentUser(user);
    this.persistUsers();
    await this.syncUserToCloud(user);

    return { success: true, message: 'Connexion réussie', user };
  }

  public getSecurityCodes(): SecurityCodes {
    return this.securityCodes;
  }

  public async updateSecurityCodes(codes: Partial<SecurityCodes>): Promise<{ success: boolean; message: string }> {
    if (codes.surveillantCode !== undefined && codes.surveillantCode.trim().length < 4) {
      return { success: false, message: 'Le code d\'habilitation Surveillant doit comporter au moins 4 caractères.' };
    }
    if (codes.directorCode !== undefined && codes.directorCode.trim().length < 6) {
      return { success: false, message: 'Le code d\'habilitation Directeur doit comporter au moins 6 caractères.' };
    }

    this.securityCodes = {
      ...this.securityCodes,
      ...codes,
      updatedAt: new Date().toISOString(),
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.SECURITY_CODES, JSON.stringify(this.securityCodes));
    }
    this.notify();

    try {
      const secDocRef = doc(db, 'isgg_metadata', 'security_codes');
      await setDoc(secDocRef, this.securityCodes, { merge: true });
    } catch (err) {
      console.warn('Firestore updateSecurityCodes error:', err);
    }

    return { success: true, message: 'Codes d\'habilitation mis à jour avec succès.' };
  }

  public toggleUserStatus(userId: string): { success: boolean; message: string; user?: User } {
    const user = this.users.find(u => u.id === userId);
    if (!user) return { success: false, message: 'Utilisateur introuvable.' };

    const newStatus = user.isActive === false ? true : false;
    user.isActive = newStatus;
    this.persistUsers();
    this.syncUserToCloud(user);
    this.notify();

    return { 
      success: true, 
      message: newStatus ? `Le compte de ${user.name} a été réactivé.` : `Le compte de ${user.name} a été suspendu.`, 
      user 
    };
  }

  public switchRole(role: 'SURVEILLANT' | 'ADMIN'): void {
    const target = this.users.find(u => u.role === role) || this.users[0];
    if (target) {
      this.setCurrentUser(target);
    }
  }

  public getUsers(): User[] {
    return this.users;
  }

  public getPrograms(): Program[] {
    return this.programs.filter(p => p.isActive);
  }

  public getAllPrograms(): Program[] {
    return this.programs;
  }

  public getLevels(): Level[] {
    return [...this.levels]
      .map(l => ({
        ...l,
        name: l.name.replace(/^[0-9]+[èe]me?\s+année\s*\((Licence\s+[0-9]+)\)/i, '$1')
      }))
      .sort((a, b) => a.order - b.order);
  }

  public getSubjects(programId?: string, levelId?: string): Subject[] {
    let list = this.subjects;
    if (programId) list = list.filter(s => s.programId === programId);
    if (levelId) list = list.filter(s => s.levelId === levelId);
    if (list.length === 0 && (levelId === 'lvl-l1' || levelId === 'lvl-l2' || levelId === 'lvl-l3')) {
      return this.subjects.filter(s => s.levelId === levelId);
    }
    return list;
  }

  public getAllSubjects(): Subject[] {
    return this.subjects;
  }

  public getSchoolYear(): SchoolYear {
    return this.schoolYear;
  }

  public getStudents(): Student[] {
    return this.students;
  }

  public getStudentById(id: string): Student | undefined {
    return this.students.find(s => s.id === id);
  }

  public getStudentWithStats(studentId: string): StudentWithStats | undefined {
    const student = this.getStudentById(studentId);
    if (!student) return undefined;

    const program = this.programs.find(p => p.id === student.programId);
    const level = this.levels.find(l => l.id === student.levelId);
    const studentAbsences = this.absences.filter(a => a.studentId === student.id);
    const unjustifiedCount = studentAbsences.filter(a => !a.justified).length;
    const justifiedCount = studentAbsences.filter(a => a.justified).length;

    return {
      ...student,
      programName: program ? program.name : 'Non défini',
      levelName: level ? level.name : 'Non défini',
      annualAbsenceCount: unjustifiedCount,
      justifiedAbsenceCount: justifiedCount,
      recentAbsences: [...studentAbsences].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    };
  }

  public getStudentAnnualAbsences(studentId: string): number {
    return this.absences.filter(a => a.studentId === studentId && !a.justified).length;
  }

  // Filter students by program, level, group, and intelligent search string
  public searchStudents(programId?: string, levelId?: string, query?: string, classGroup?: string): StudentWithStats[] {
    let list = this.students.filter(s => s.isActive);

    if (programId) {
      list = list.filter(s => s.programId === programId);
    }
    if (levelId) {
      list = list.filter(s => s.levelId === levelId);
    }
    if (classGroup && classGroup !== 'all') {
      list = list.filter(s => (s.classGroup || 'A') === classGroup);
    }

    if (query && query.trim().length > 0) {
      const q = normalizeSearchString(query);
      list = list.filter(s => {
        const nom = normalizeSearchString(s.lastName);
        const prenom = normalizeSearchString(s.firstName);
        const matricule = normalizeSearchString(s.matricule);
        const full = `${nom} ${prenom}`;
        const fullReverse = `${prenom} ${nom}`;
        const grp = s.classGroup ? normalizeSearchString(`classe ${s.classGroup} groupe ${s.classGroup}`) : '';

        return (
          nom.includes(q) ||
          prenom.includes(q) ||
          matricule.includes(q) ||
          full.includes(q) ||
          fullReverse.includes(q) ||
          grp.includes(q)
        );
      });
    }

    return list.map(s => {
      const program = this.programs.find(p => p.id === s.programId);
      const level = this.levels.find(l => l.id === s.levelId);
      const absenceCount = this.getStudentAnnualAbsences(s.id);
      return {
        ...s,
        programName: program ? program.name : '',
        levelName: level ? level.name : '',
        annualAbsenceCount: absenceCount,
      };
    });
  }

  // Get distinct class groups for a specific program (e.g. ['A', 'B'])
  public getProgramGroups(programId: string): string[] {
    const prog = this.programs.find(p => p.id === programId);
    const configuredGroups = prog?.availableGroups && prog.availableGroups.length > 0
      ? prog.availableGroups
      : [];

    // Also collect groups currently assigned to students in this program
    const studentGroups = this.students
      .filter(s => s.programId === programId && s.classGroup)
      .map(s => s.classGroup as string);

    const merged = Array.from(new Set([...configuredGroups, ...studentGroups, 'A'])).filter(Boolean);
    return merged.sort();
  }

  // Update available groups for a program
  public setProgramGroups(programId: string, groups: string[]): Program | undefined {
    const prog = this.programs.find(p => p.id === programId);
    if (!prog) return undefined;

    prog.availableGroups = groups.map(g => g.trim().toUpperCase()).filter(Boolean);
    this.persistPrograms();
    this.notify();
    return prog;
  }

  // Absences management
  public getAbsences(): Absence[] {
    return this.absences;
  }

  public getAbsencesWithDetails(): AbsenceWithDetails[] {
    return this.absences
      .map(a => {
        const student = this.students.find(s => s.id === a.studentId);
        let subject = this.subjects.find(s => s.id === a.subjectId);
        
        if (!subject) {
          // Specific timing & level resolution for ISGG SIL2
          if ((a.startTime === '08:00' || a.absenceTime?.startsWith('08')) && (a.className?.includes('SIL2') || student?.levelId === 'lvl-l2')) {
            subject = this.subjects.find(s => s.id === 'sub-l2-communication-ecrite-2');
          } else if ((a.startTime === '13:00' || a.absenceTime?.startsWith('13')) && (a.className?.includes('SIL2') || student?.levelId === 'lvl-l2')) {
            subject = this.subjects.find(s => s.id === 'sub-l2-algebre-lineaire');
          }
        }

        if (!subject && student) {
          subject = this.subjects.find(s => s.programId === student.programId && s.levelId === student.levelId) || this.subjects[0];
        }
        const program = student ? this.programs.find(p => p.id === student.programId) : undefined;
        const level = student ? this.levels.find(l => l.id === student.levelId) : undefined;

        if (!student || !subject || !program || !level) return null;

        return {
          ...a,
          student,
          subject,
          program,
          level,
          recordedByName: a.recordedBy || 'M. Diallo',
        };
      })
      .filter((item): item is AbsenceWithDetails => item !== null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Record an absence (Step 25 of prompt)
  public recordAbsence(params: {
    studentId: string;
    subjectId: string;
    notes?: string;
  }): { absence: Absence; student: StudentWithStats; subject: Subject } {
    const student = this.getStudentById(params.studentId);
    if (!student) throw new Error('Étudiant introuvable');

    const subject = this.subjects.find(s => s.id === params.subjectId);
    if (!subject) throw new Error('Matière introuvable');

    const now = new Date();
    const absenceDate = formatISODate(now);
    const absenceTime = formatTime(now);

    const newAbsence: Absence = {
      id: `abs-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      studentId: params.studentId,
      subjectId: params.subjectId,
      schoolYearId: this.schoolYear.id,
      recordedBy: this.currentUser.name,
      absenceDate,
      absenceTime,
      createdAt: now.toISOString(),
      justified: false,
    };

    this.absences.unshift(newAbsence);
    this.persistAbsences();
    this.notify();
    this.syncAbsenceToCloud(newAbsence);

    const studentWithStats = this.getStudentWithStats(student.id)!;
    return {
      absence: newAbsence,
      student: studentWithStats,
      subject,
    };
  }

  // Bulk record absences for class list mode (Step 29)
  public recordBulkAbsences(params: {
    studentIds: string[];
    subjectId: string;
  }): number {
    const subject = this.subjects.find(s => s.id === params.subjectId);
    if (!subject) throw new Error('Matière introuvable');

    const now = new Date();
    const absenceDate = formatISODate(now);
    const absenceTime = formatTime(now);
    let addedCount = 0;
    const addedAbsences: Absence[] = [];

    params.studentIds.forEach((sId, index) => {
      const student = this.getStudentById(sId);
      if (student) {
        const newAbsence: Absence = {
          id: `abs-bulk-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 5)}`,
          studentId: sId,
          subjectId: params.subjectId,
          schoolYearId: this.schoolYear.id,
          recordedBy: this.currentUser.name,
          absenceDate,
          absenceTime,
          createdAt: now.toISOString(),
          justified: false,
        };
        this.absences.unshift(newAbsence);
        addedAbsences.push(newAbsence);
        addedCount++;
      }
    });

    if (addedCount > 0) {
      this.persistAbsences();
      this.notify();
      addedAbsences.forEach((a) => this.syncAbsenceToCloud(a));
    }

    return addedCount;
  }

  // Delete absence (for admin / corrections)
  public deleteAbsence(absenceId: string): boolean {
    const initialLen = this.absences.length;
    this.absences = this.absences.filter(a => a.id !== absenceId);
    if (this.absences.length !== initialLen) {
      this.persistAbsences();
      this.notify();
      this.deleteAbsenceFromCloud(absenceId);
      return true;
    }
    return false;
  }

  // Toggle or set absence justified status
  public toggleAbsenceJustified(absenceId: string, justified?: boolean, justificationReason?: string): Absence | undefined {
    const idx = this.absences.findIndex(a => a.id === absenceId);
    if (idx === -1) return undefined;

    const current = this.absences[idx];
    const nextStatus = justified !== undefined ? justified : !current.justified;

    this.absences[idx] = {
      ...current,
      justified: nextStatus,
      justificationReason: nextStatus 
        ? (justificationReason || current.justificationReason || 'Justifié par l\'administration')
        : undefined,
    };

    this.persistAbsences();
    this.notify();
    this.syncAbsenceToCloud(this.absences[idx]);
    return this.absences[idx];
  }

  // Add / edit student (Admin)
  public saveStudent(student: Omit<Student, 'id' | 'createdAt'> & { id?: string }): Student {
    if (student.id) {
      // Edit
      const idx = this.students.findIndex(s => s.id === student.id);
      if (idx !== -1) {
        this.students[idx] = {
          ...this.students[idx],
          ...student,
        };
        this.persistStudents();
        this.notify();
        this.syncStudentToCloud(this.students[idx]);
        return this.students[idx];
      }
    }

    // New student
    const newStudent: Student = {
      ...student,
      id: `stu-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.students.push(newStudent);
    this.persistStudents();
    this.notify();
    this.syncStudentToCloud(newStudent);
    return newStudent;
  }

  // Delete/Deactivate student
  public toggleStudentStatus(studentId: string): void {
    const student = this.students.find(s => s.id === studentId);
    if (student) {
      student.isActive = !student.isActive;
      this.persistStudents();
      this.notify();
      this.syncStudentToCloud(student);
    }
  }

  // Add / edit program
  public saveProgram(prog: Omit<Program, 'id'> & { id?: string }): Program {
    if (prog.id) {
      const idx = this.programs.findIndex(p => p.id === prog.id);
      if (idx !== -1) {
        this.programs[idx] = { ...this.programs[idx], ...prog };
        this.persistPrograms();
        this.notify();
        return this.programs[idx];
      }
    }
    const newProg: Program = {
      ...prog,
      id: `prog-${Date.now()}`,
    };
    this.programs.push(newProg);
    this.persistPrograms();
    this.notify();
    return newProg;
  }

  // Add / edit subject
  public saveSubject(sub: Omit<Subject, 'id'> & { id?: string }): Subject {
    if (sub.id) {
      const idx = this.subjects.findIndex(s => s.id === sub.id);
      if (idx !== -1) {
        this.subjects[idx] = { ...this.subjects[idx], ...sub };
        this.persistSubjects();
        this.notify();
        return this.subjects[idx];
      }
    }
    const newSub: Subject = {
      ...sub,
      id: `sub-${Date.now()}`,
    };
    this.subjects.push(newSub);
    this.persistSubjects();
    this.notify();
    return newSub;
  }

  // Persistence helpers
  private persistAbsences() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.ABSENCES, JSON.stringify(this.absences));
    }
  }

  private persistStudents() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(this.students));
    }
  }

  private persistPrograms() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.PROGRAMS, JSON.stringify(this.programs));
    }
  }

  private persistSubjects() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(this.subjects));
    }
  }

  private persistSheetImports() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.SHEET_IMPORTS, JSON.stringify(this.sheetImports));
    }
  }

  // --- Progressive Database Growth (Dynamic creation of entities from imported sheets) ---

  public getOrCreateProgram(code: string, customName?: string): Program {
    const rawCode = (code || 'GI').trim();
    const upperCode = rawCode.toUpperCase();
    
    // Check existing
    let prog = this.programs.find(p => 
      p.code.toUpperCase() === upperCode || 
      normalizeSearchString(p.name).includes(normalizeSearchString(rawCode))
    );

    if (!prog) {
      const codeClean = upperCode.replace(/[^A-Z0-9]/g, '');
      const progId = `prog-${codeClean.toLowerCase()}`;
      prog = {
        id: progId,
        code: codeClean,
        name: customName || (codeClean === 'GI' ? 'Génie Informatique' : `Filière ${codeClean}`),
        availableGroups: ['A', 'B'],
        isActive: true,
      };
      this.programs.push(prog);
      this.persistPrograms();
      this.notify();
    }

    return prog;
  }

  public getOrCreateLevel(levelRaw: string): Level {
    const str = (levelRaw || '').toUpperCase();
    
    if (str.includes('SIL2') || str.includes('L2') || str.includes('2') || str.includes('DEUXIEME')) {
      const l2 = this.levels.find(l => l.id === 'lvl-l2' || l.code === 'L2');
      if (l2) return l2;
    }
    if (str.includes('SIL1') || str.includes('L1') || str.includes('1') || str.includes('PREMIERE')) {
      const l1 = this.levels.find(l => l.id === 'lvl-l1' || l.code === 'L1');
      if (l1) return l1;
    }
    if (str.includes('SIL3') || str.includes('L3') || str.includes('3') || str.includes('TROISIEME')) {
      const l3 = this.levels.find(l => l.id === 'lvl-l3' || l.code === 'L3');
      if (l3) return l3;
    }

    // Default to L2 or first level
    return this.levels.find(l => l.id === 'lvl-l2') || this.levels[0] || INITIAL_LEVELS[1];
  }

  public getOrCreateSubject(name: string, programId: string, levelId: string): Subject {
    const trimmed = (name || '').trim();
    const norm = normalizeSearchString(trimmed);

    // 0. Academic aliases and abbreviations detection (ISGG)
    if (norm === 'ceo ii' || norm === 'ceo 2' || norm === 'ceo2' || norm.includes('communication ecrite 2') || norm.includes('communication ecrite et orale 2')) {
      const match = this.subjects.find(s => s.id === 'sub-l2-communication-ecrite-2');
      if (match) return match;
    }
    if (norm === 'ceo i' || norm === 'ceo 1' || norm === 'ceo1' || norm.includes('communication ecrite et orale 1')) {
      const match = this.subjects.find(s => s.id === 'sub-l1-communication-1');
      if (match) return match;
    }
    if (norm === 'algebre' || norm === 'algebre lineaire' || norm.includes('algebre lineaire')) {
      const match = this.subjects.find(s => s.id === 'sub-l2-algebre-lineaire');
      if (match) return match;
    }
    if (norm === 'teeo' || norm === 'teeo 3' || norm === 'teeo iii' || norm.includes('techniques d expression')) {
      const match = this.subjects.find(s => s.id === 'sub-l3-teeo-3');
      if (match) return match;
    }

    // 1. Exact or normalized search in current program and level (by name or code)
    let sub = this.subjects.find(s => 
      s.programId === programId && 
      s.levelId === levelId && 
      (normalizeSearchString(s.name) === norm || (s.code && normalizeSearchString(s.code) === norm) || normalizeSearchString(s.name).includes(norm))
    );

    // 2. Global search by name or code in same program
    if (!sub) {
      sub = this.subjects.find(s => 
        s.programId === programId && 
        (normalizeSearchString(s.name) === norm || (s.code && normalizeSearchString(s.code) === norm))
      );
    }

    // 3. Global search by name or code across all subjects
    if (!sub) {
      sub = this.subjects.find(s => normalizeSearchString(s.name) === norm || (s.code && normalizeSearchString(s.code) === norm));
    }

    // 4. Create dynamically if not found
    if (!sub) {
      const initials = trimmed
        .split(/\s+/)
        .map(w => w.charAt(0))
        .join('')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '') || 'MAT';
      
      const newSubjectId = `sub-dyn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      sub = {
        id: newSubjectId,
        name: trimmed,
        code: initials.slice(0, 6),
        programId,
        levelId,
        teacherName: 'Enseignant titulaire',
      };
      this.subjects.push(sub);
      this.persistSubjects();
      this.notify();
    }

    return sub;
  }

  public getOrCreateStudent(params: {
    firstName: string;
    lastName: string;
    programId: string;
    levelId: string;
    classGroup?: string;
  }): { student: Student; isNew: boolean } {
    const fnNorm = normalizeSearchString(params.firstName);
    const lnNorm = normalizeSearchString(params.lastName);

    // Check if student already exists by matching normalized first + last names
    const existing = this.students.find(s => {
      const sFn = normalizeSearchString(s.firstName);
      const sLn = normalizeSearchString(s.lastName);
      return (sFn === fnNorm && sLn === lnNorm) || (sFn === lnNorm && sLn === fnNorm);
    });

    if (existing) {
      // Update group or program/level if empty
      let updated = false;
      if (params.classGroup && !existing.classGroup) {
        existing.classGroup = params.classGroup;
        updated = true;
      }
      if (updated) {
        this.persistStudents();
      }
      return { student: existing, isNew: false };
    }

    // Create new student
    const nextMatriculeNum = String(this.students.length + 1).padStart(3, '0');
    const matricule = `ISGG-2026-${nextMatriculeNum}`;
    const newStudent: Student = {
      id: `stu-dyn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      matricule,
      firstName: params.firstName.trim(),
      lastName: params.lastName.trim().toUpperCase(),
      programId: params.programId,
      levelId: params.levelId,
      classGroup: params.classGroup || 'A',
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    this.students.push(newStudent);
    this.persistStudents();
    this.notify();

    return { student: newStudent, isNew: true };
  }

  public isSessionAlreadyRecorded(date: string, className: string, subjectName: string, startTime?: string): boolean {
    const normSubject = normalizeSearchString(subjectName || '');
    const normClass = normalizeSearchString(className || '');

    return this.absences.some(a => {
      if (a.absenceDate !== date) return false;
      
      const sub = this.subjects.find(s => s.id === a.subjectId);
      const subMatch = sub ? normalizeSearchString(sub.name) === normSubject : false;

      const classMatch = a.className ? normalizeSearchString(a.className) === normClass : true;
      const timeMatch = startTime ? (a.startTime === startTime || a.absenceTime?.startsWith(startTime.slice(0, 2))) : true;

      return subMatch && classMatch && timeMatch;
    });
  }

  public recordBatchAbsences(records: {
    studentId: string;
    subjectId: string;
    date: string;
    time: string;
    startTime?: string;
    endTime?: string;
    observations?: string;
    className?: string;
    sheetImportId?: string;
  }[]): Absence[] {
    const createdList: Absence[] = [];
    const nowIso = new Date().toISOString();

    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      const newAbsence: Absence = {
        id: `abs-sheet-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        studentId: rec.studentId,
        subjectId: rec.subjectId,
        schoolYearId: this.schoolYear.id,
        recordedBy: this.currentUser.name || 'M. Nicaise AÏZOUN',
        absenceDate: rec.date,
        absenceTime: rec.time || rec.startTime || '08:00',
        startTime: rec.startTime,
        endTime: rec.endTime,
        observations: rec.observations || 'Sans motif',
        className: rec.className,
        sheetImportId: rec.sheetImportId,
        createdAt: nowIso,
        justified: false,
      };

      this.absences.unshift(newAbsence);
      createdList.push(newAbsence);
    }

    this.persistAbsences();
    this.notify();

    return createdList;
  }

  public recordSheetImport(importData: Omit<SheetImportRecord, 'id'>): SheetImportRecord {
    const newRecord: SheetImportRecord = {
      ...importData,
      id: `imp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    };
    this.sheetImports.unshift(newRecord);
    this.persistSheetImports();
    this.notify();
    return newRecord;
  }

  public getSheetImports(): SheetImportRecord[] {
    return [...this.sheetImports].sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime());
  }

  // Live Metrics & KPIs (exact matching to Panel 2 of mockups)
  public getDashboardMetrics(): DashboardMetrics {
    const todayStr = formatISODate(new Date());
    
    // Today's absences
    const todayAbsences = this.absences.filter(a => a.absenceDate === todayStr);
    const absencesToday = todayAbsences.length;

    // Unique students concerned today
    const uniqueStudentsToday = new Set(todayAbsences.map(a => a.studentId)).size;

    // Absences this week (exact 7-day rolling window matching the chart)
    const trend = this.getWeeklyAbsenceTrend();
    const absencesThisWeek = trend.reduce((acc, curr) => acc + curr.absences, 0);

    // Total annual
    const totalAnnual = this.absences.length;

    return {
      absencesToday,
      studentsToday: uniqueStudentsToday,
      absencesThisWeek,
      totalAnnual,
      growthTodayPct: 12,
      growthStudentsPct: 8,
      growthWeekPct: 15,
      growthAnnualPct: 22,
    };
  }

  // Stats by program for Donut chart
  public getProgramDistribution() {
    const programCounts: Record<string, number> = {};
    this.programs.forEach(p => {
      programCounts[p.id] = 0;
    });

    this.absences.forEach(a => {
      const student = this.students.find(s => s.id === a.studentId);
      if (student && programCounts[student.programId] !== undefined) {
        programCounts[student.programId]++;
      }
    });

    const total = this.absences.length || 1;
    const colors = ['#EA580C', '#F97316', '#FB923C', '#2563EB', '#0D9488'];

    return this.programs.map((p, idx) => {
      const count = programCounts[p.id] || 0;
      const percentage = Math.round((count / total) * 100);
      return {
        name: p.name,
        code: p.code,
        count,
        percentage,
        color: colors[idx % colors.length],
      };
    });
  }

  // 7-day rolling trend of real absences
  public getWeeklyAbsenceTrend(): { day: string; date: string; fullDate: string; absences: number }[] {
    const daysName = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const result: { day: string; date: string; fullDate: string; absences: number }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = formatISODate(d);
      const dayLabel = daysName[d.getDay()];
      const dayOfMonth = String(d.getDate()).padStart(2, '0');
      const monthStr = String(d.getMonth() + 1).padStart(2, '0');

      const count = this.absences.filter(a => a.absenceDate === iso).length;
      result.push({
        day: dayLabel,
        date: `${dayOfMonth}/${monthStr}`,
        fullDate: iso,
        absences: count,
      });
    }

    return result;
  }

  // Reset demo data to pristine state
  public resetToDefaultSeed(): void {
    if (typeof window !== 'undefined') {
      localStorage.clear();
    }
    this.currentUser = INITIAL_USERS[0];
    this.users = INITIAL_USERS;
    this.programs = INITIAL_PROGRAMS;
    this.levels = INITIAL_LEVELS;
    this.subjects = INITIAL_SUBJECTS;
    this.students = INITIAL_STUDENTS;
    this.schoolYear = INITIAL_SCHOOL_YEAR;
    this.sheetImports = [];
    this.notifications = INITIAL_NOTIFICATIONS;
    this.absences = generateInitialAbsences(this.students, this.subjects);
    this.persistAbsences();
    this.persistSheetImports();
    this.persistNotifications();
    this.notify();
  }
}

export const storage = new StorageService();
