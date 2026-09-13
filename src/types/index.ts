export type UserRole = 'SURVEILLANT' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  title: string;
  lastLogin?: string;
}

export interface Program {
  id: string;
  name: string;
  code: string;
  description?: string;
  availableGroups?: string[]; // e.g. ['A', 'B'] or custom
  isActive: boolean;
}

export interface Level {
  id: string;
  name: string;
  code: string;
  order: number;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  programId: string;
  levelId: string;
  teacherName?: string;
}

export interface Student {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
  programId: string;
  levelId: string;
  classGroup?: string; // 'A', 'B', 'C', etc.
  classId?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Absence {
  id: string;
  studentId: string;
  subjectId: string;
  schoolYearId: string;
  recordedBy: string; // userId or name
  absenceDate: string; // YYYY-MM-DD
  absenceTime: string; // HH:mm:ss
  createdAt: string;
  justified?: boolean;
  justificationReason?: string;
  startTime?: string; // e.g. "08h00"
  endTime?: string; // e.g. "12h00"
  observations?: string; // e.g. "Sans motif"
  className?: string; // e.g. "GI / SIL2_A"
  sheetImportId?: string;
}

export type MatchStatus = 'EXACT' | 'PROBABLE' | 'NEW';

export interface PotentialStudentMatch {
  studentId: string;
  studentName: string;
  matricule: string;
  className: string;
  score: number;
}

export interface ExtractedAbsenceItem {
  tempId: string;
  studentNameRaw: string; // e.g. "ABOKI Job"
  firstName: string;
  lastName: string;
  classNameRaw: string; // e.g. "GI / SIL2_A"
  programCode: string; // e.g. "GI"
  classGroup: string; // e.g. "A"
  levelCode: string; // e.g. "SIL2"
  subjectNameRaw: string; // e.g. "CEO II"
  timeRangeRaw: string; // e.g. "08h à 12h"
  startTime: string; // "08:00"
  endTime: string; // "12:00"
  observations: string; // "Sans motif"
  date: string; // "YYYY-MM-DD"
  
  // Matching with database
  matchStatus: MatchStatus;
  matchedStudentId?: string;
  matchedStudentName?: string;
  confidenceScore?: number;
  potentialMatches?: PotentialStudentMatch[];
  isDuplicate?: boolean;
  duplicateReason?: string;
}

export interface ExtractedSession {
  id: string;
  className: string;
  programCode: string;
  classGroup: string;
  levelCode: string;
  subjectName: string;
  timeRange: string;
  startTime: string;
  endTime: string;
  absentCount: number;
  studentItems: ExtractedAbsenceItem[];
  isAlreadyRecorded?: boolean;
}

export interface ParsedSheetData {
  documentTitle: string;
  sheetDate: string; // "2026-09-09"
  signatory: string; // "Le Surveillant Général, M. Nicaise AÏZOUN"
  sessions: ExtractedSession[];
  totalAbsents: number;
  rawText?: string;
}

export interface SheetImportRecord {
  id: string;
  sheetDate: string;
  importedAt: string;
  fileName: string;
  sessionsCount: number;
  absencesCount: number;
  newStudentsCount: number;
  newClassesCount: number;
  newSubjectsCount: number;
  recordedBy: string;
  status: 'ENREGISTRE' | 'ANNULE';
}

export interface SchoolYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface StudentWithStats extends Student {
  programName: string;
  levelName: string;
  annualAbsenceCount: number;
  justifiedAbsenceCount?: number;
  recentAbsences?: Absence[];
}

export interface AbsenceWithDetails extends Absence {
  student: Student;
  program: Program;
  level: Level;
  subject: Subject;
  recordedByName: string;
}

export interface DashboardMetrics {
  absencesToday: number;
  studentsToday: number;
  absencesThisWeek: number;
  totalAnnual: number;
  growthTodayPct: number;
  growthStudentsPct: number;
  growthWeekPct: number;
  growthAnnualPct: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
  type: 'info' | 'warning' | 'success';
}
