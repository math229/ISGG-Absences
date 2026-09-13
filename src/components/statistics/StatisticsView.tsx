import React, { useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid, 
  Cell, 
  PieChart, 
  Pie 
} from 'recharts';
import { 
  TrendingUp, 
  Building, 
  GraduationCap, 
  BookOpen, 
  AlertOctagon, 
  Download 
} from 'lucide-react';
import { storage } from '../../lib/storage';

export const StatisticsView: React.FC = () => {
  const metrics = useMemo(() => storage.getDashboardMetrics(), []);
  const programs = useMemo(() => storage.getPrograms(), []);
  const levels = useMemo(() => storage.getLevels(), []);
  const subjects = useMemo(() => storage.getAllSubjects(), []);
  const students = useMemo(() => storage.getStudents(), []);
  const absences = useMemo(() => storage.getAbsences(), []);

  // 1. Absences by program
  const programData = useMemo(() => {
    return programs.map(prog => {
      const count = absences.filter(a => {
        const stu = students.find(s => s.id === a.studentId);
        return stu?.programId === prog.id;
      }).length;
      return {
        name: prog.code,
        fullName: prog.name,
        absences: count,
      };
    });
  }, [programs, students, absences]);

  // 2. Absences by Level
  const levelData = useMemo(() => {
    return levels.map(lvl => {
      const count = absences.filter(a => {
        const stu = students.find(s => s.id === a.studentId);
        return stu?.levelId === lvl.id;
      }).length;
      return {
        name: lvl.code,
        fullName: lvl.name,
        absences: count,
      };
    });
  }, [levels, students, absences]);

  // 3. Top subjects with highest absences
  const topSubjectsData = useMemo(() => {
    const counts: Record<string, number> = {};
    absences.forEach(a => {
      let sub = subjects.find(s => s.id === a.subjectId);
      if (!sub) {
        const stu = students.find(s => s.id === a.studentId);
        if (stu) {
          sub = subjects.find(s => s.programId === stu.programId && s.levelId === stu.levelId);
        }
      }
      if (sub) {
        counts[sub.id] = (counts[sub.id] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .map(([subId, count]) => {
        const sub = subjects.find(s => s.id === subId);
        if (!sub) return null;
        const prog = programs.find(p => p.id === sub.programId);
        const lvl = levels.find(l => l.id === sub.levelId);
        return {
          id: sub.id,
          name: sub.name,
          programCode: prog?.code || '',
          levelCode: lvl?.code || '',
          count,
        };
      })
      .filter((item): item is { id: string; name: string; programCode: string; levelCode: string; count: number } => item !== null)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [absences, subjects, students, programs, levels]);

  // 4. Top absent students
  const topAbsentStudents = useMemo(() => {
    return students
      .map(s => storage.getStudentWithStats(s.id)!)
      .sort((a, b) => b.annualAbsenceCount - a.annualAbsenceCount)
      .slice(0, 5);
  }, [students]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
            Statistiques institutionnelles
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Analyse détaillée de l&apos;assiduité par filière, niveau et discipline
          </p>
        </div>

        <div className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-xl">
          Données consolidées • Année {storage.getSchoolYear()?.name || '2026-2027'}
        </div>
      </div>

      {/* Row 1: Programs & Levels Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full min-w-0">
        {/* Absences by Program */}
        <div className="lg:col-span-6 bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/80 shadow-xs min-w-0 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Building className="w-5 h-5 text-[#EA580C]" />
              <h3 className="font-bold text-base text-slate-900">
                Volume d&apos;absences par filière
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">Cumul annuel</span>
          </div>

          <div className="h-64 w-full min-w-0 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={programData} 
                margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                style={{ outline: 'none' }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} />
                <Tooltip 
                  formatter={(val, _, item) => [`${val} absences`, item.payload.fullName]}
                  contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                  wrapperStyle={{ pointerEvents: 'none', zIndex: 50 }}
                  cursor={{ fill: 'rgba(234, 88, 12, 0.08)', radius: 6 }}
                />
                <Bar 
                  dataKey="absences" 
                  fill="#EA580C" 
                  radius={[6, 6, 0, 0]} 
                  isAnimationActive={false}
                  style={{ outline: 'none' }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Absences by Level */}
        <div className="lg:col-span-6 bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/80 shadow-xs min-w-0 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-[#EA580C]" />
              <h3 className="font-bold text-base text-slate-900">
                Volume d&apos;absences par niveau
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">L1 à M2</span>
          </div>

          <div className="h-64 w-full min-w-0 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={levelData} 
                margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                style={{ outline: 'none' }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} />
                <Tooltip 
                  formatter={(val, _, item) => [`${val} absences`, item.payload.fullName]}
                  contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                  wrapperStyle={{ pointerEvents: 'none', zIndex: 50 }}
                  cursor={{ fill: 'rgba(15, 23, 42, 0.08)', radius: 6 }}
                />
                <Bar 
                  dataKey="absences" 
                  fill="#0F172A" 
                  radius={[6, 6, 0, 0]} 
                  isAnimationActive={false}
                  style={{ outline: 'none' }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Top Subjects & Top Absent Students */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full min-w-0">
        {/* Top Subjects */}
        <div className="lg:col-span-6 bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/80 shadow-xs min-w-0 overflow-hidden">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-[#EA580C]" />
            <h3 className="font-bold text-base text-slate-900">
              Matières les plus touchées par l&apos;absentéisme
            </h3>
          </div>

          <div className="space-y-3">
            {topSubjectsData.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl">
                Aucune donnée d&apos;absence enregistrée pour le moment.
              </div>
            ) : (
              topSubjectsData.map((sub, i) => (
                <div key={sub.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100/70 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-md bg-orange-100 text-[#EA580C] font-bold text-xs flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate" title={sub.name}>
                        {sub.name}
                      </p>
                      {(sub.programCode || sub.levelCode) && (
                        <span className="text-[10px] font-semibold text-slate-500">
                          {sub.programCode} {sub.levelCode && `• ${sub.levelCode}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-extrabold text-[#EA580C] flex-shrink-0 ml-3">
                    {sub.count} absence{sub.count > 1 ? 's' : ''}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Absent Students (Alerts) */}
        <div className="lg:col-span-6 bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/80 shadow-xs min-w-0 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertOctagon className="w-5 h-5 text-rose-600" />
              <h3 className="font-bold text-base text-slate-900">
                Étudiants les plus absents (Seuil d&apos;alerte)
              </h3>
            </div>
            <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full">
              Conseil de discipline
            </span>
          </div>

          <div className="space-y-3">
            {topAbsentStudents.map(student => (
              <div key={student.id} className="p-3 rounded-xl border border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#EA580C] text-white font-bold text-xs flex items-center justify-center">
                    {student.lastName.slice(0, 1)}
                  </div>
                  <div>
                    <p className="font-bold text-xs text-slate-900">
                      {student.lastName} {student.firstName}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {student.programName} • {student.levelName}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-100 text-rose-700">
                    {student.annualAbsenceCount} absences
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
