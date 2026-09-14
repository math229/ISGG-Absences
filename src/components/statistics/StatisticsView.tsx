import React, { useMemo, useState } from 'react';
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
  Pie,
  LabelList
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

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
}

const AbsenceTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const item = payload[0];
    const data = item.payload;
    const absences = item.value ?? data?.absences ?? 0;
    return (
      <div className="bg-slate-900/95 text-white px-3.5 py-2.5 rounded-xl shadow-xl border border-slate-700/80 backdrop-blur-xs text-xs pointer-events-none">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#EA580C]" />
          <span className="font-black text-sm text-[#EA580C]">
            {absences} {absences > 1 ? 'absences' : 'absence'}
          </span>
        </div>
        <div className="text-slate-300 font-medium text-[11px] mt-1">
          {data?.fullName || data?.name} ({data?.name})
        </div>
      </div>
    );
  }
  return null;
};

export const StatisticsView: React.FC = () => {
  const metrics = useMemo(() => storage.getDashboardMetrics(), []);
  const programs = useMemo(() => storage.getPrograms(), []);
  const levels = useMemo(() => storage.getLevels(), []);
  const subjects = useMemo(() => storage.getAllSubjects(), []);
  const students = useMemo(() => storage.getStudents(), []);
  const absences = useMemo(() => storage.getAbsences(), []);

  const [selectedLevel, setSelectedLevel] = useState<{ name: string; fullName: string; absences: number } | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<{ name: string; fullName: string; absences: number } | null>(null);

  const handleLevelClick = (dataOrState: any) => {
    const item = dataOrState?.activePayload?.[0]?.payload || dataOrState?.payload || dataOrState;
    if (!item || typeof item.absences === 'undefined') return;
    setSelectedLevel(prev => (prev?.name === item.name ? null : {
      name: item.name,
      fullName: item.fullName,
      absences: item.absences,
    }));
  };

  const handleProgramClick = (dataOrState: any) => {
    const item = dataOrState?.activePayload?.[0]?.payload || dataOrState?.payload || dataOrState;
    if (!item || typeof item.absences === 'undefined') return;
    setSelectedProgram(prev => (prev?.name === item.name ? null : {
      name: item.name,
      fullName: item.fullName,
      absences: item.absences,
    }));
  };

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
        <div className="lg:col-span-6 bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/80 shadow-xs min-w-0 overflow-hidden flex flex-col justify-between">
          <div>
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
                  margin={{ top: 22, right: 10, left: -15, bottom: 0 }}
                  style={{ outline: 'none' }}
                  onClick={handleProgramClick}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} />
                  <Tooltip 
                    content={<AbsenceTooltip />}
                    wrapperStyle={{ pointerEvents: 'none', zIndex: 50 }}
                    cursor={{ fill: 'rgba(234, 88, 12, 0.08)', radius: 6 }}
                  />
                  <Bar 
                    dataKey="absences" 
                    radius={[6, 6, 0, 0]} 
                    isAnimationActive={false}
                    style={{ outline: 'none' }}
                    onClick={(entry) => handleProgramClick(entry)}
                    className="cursor-pointer"
                  >
                    <LabelList 
                      dataKey="absences" 
                      position="top" 
                      fill="#EA580C" 
                      fontSize={11} 
                      fontWeight={800}
                      offset={6}
                      formatter={(val: number) => (val > 0 ? `${val}` : '0')}
                    />
                    {programData.map((entry, index) => (
                      <Cell 
                        key={`prog-cell-${index}`}
                        fill={selectedProgram?.name === entry.name ? '#C2410C' : '#EA580C'}
                        stroke={selectedProgram?.name === entry.name ? '#0F172A' : 'none'}
                        strokeWidth={selectedProgram?.name === entry.name ? 2 : 0}
                        className="transition-colors cursor-pointer"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Interactive selected item feedback */}
          {selectedProgram ? (
            <div className="mt-3 px-3 py-2 bg-orange-50 border border-orange-200/90 rounded-xl flex items-center justify-between text-xs animate-in fade-in">
              <div className="flex items-center gap-2 min-w-0">
                <Building className="w-4 h-4 text-[#EA580C] shrink-0" />
                <span className="text-slate-800 font-medium truncate">
                  Filière <strong>{selectedProgram.fullName}</strong> <span className="text-slate-500 font-normal">({selectedProgram.name})</span>
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-black text-sm text-[#EA580C] bg-white px-2.5 py-0.5 rounded-lg border border-orange-200 shadow-2xs">
                  {selectedProgram.absences} {selectedProgram.absences > 1 ? 'absences' : 'absence'}
                </span>
                <button 
                  onClick={() => setSelectedProgram(null)}
                  className="text-slate-400 hover:text-slate-600 text-[10px] underline ml-1 cursor-pointer"
                  title="Réinitialiser la sélection"
                >
                  Effacer
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 px-3 py-1.5 bg-slate-50 border border-slate-200/60 rounded-xl flex items-center justify-between text-[11px] text-slate-500">
              <span>Cliquez sur un bâton pour afficher le nombre d&apos;absences</span>
              <span className="font-semibold text-slate-700">Total : {programData.reduce((acc, curr) => acc + curr.absences, 0)}</span>
            </div>
          )}
        </div>

        {/* Absences by Level */}
        <div className="lg:col-span-6 bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/80 shadow-xs min-w-0 overflow-hidden flex flex-col justify-between">
          <div>
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
                  margin={{ top: 22, right: 10, left: -15, bottom: 0 }}
                  style={{ outline: 'none' }}
                  onClick={handleLevelClick}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} />
                  <Tooltip 
                    content={<AbsenceTooltip />}
                    wrapperStyle={{ pointerEvents: 'none', zIndex: 50 }}
                    cursor={{ fill: 'rgba(15, 23, 42, 0.08)', radius: 6 }}
                  />
                  <Bar 
                    dataKey="absences" 
                    radius={[6, 6, 0, 0]} 
                    isAnimationActive={false}
                    style={{ outline: 'none' }}
                    onClick={(entry) => handleLevelClick(entry)}
                    className="cursor-pointer"
                  >
                    <LabelList 
                      dataKey="absences" 
                      position="top" 
                      fill="#0F172A" 
                      fontSize={11} 
                      fontWeight={800}
                      offset={6}
                      formatter={(val: number) => (val > 0 ? `${val}` : '0')}
                    />
                    {levelData.map((entry, index) => (
                      <Cell 
                        key={`level-cell-${index}`}
                        fill={selectedLevel?.name === entry.name ? '#EA580C' : '#0F172A'}
                        stroke={selectedLevel?.name === entry.name ? '#EA580C' : 'none'}
                        strokeWidth={selectedLevel?.name === entry.name ? 2 : 0}
                        className="transition-colors cursor-pointer"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Interactive selected item feedback */}
          {selectedLevel ? (
            <div className="mt-3 px-3 py-2 bg-orange-50 border border-orange-200/90 rounded-xl flex items-center justify-between text-xs animate-in fade-in">
              <div className="flex items-center gap-2 min-w-0">
                <GraduationCap className="w-4 h-4 text-[#EA580C] shrink-0" />
                <span className="text-slate-800 font-medium truncate">
                  Niveau <strong>{selectedLevel.fullName}</strong> <span className="text-slate-500 font-normal">({selectedLevel.name})</span>
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-black text-sm text-[#EA580C] bg-white px-2.5 py-0.5 rounded-lg border border-orange-200 shadow-2xs">
                  {selectedLevel.absences} {selectedLevel.absences > 1 ? 'absences' : 'absence'}
                </span>
                <button 
                  onClick={() => setSelectedLevel(null)}
                  className="text-slate-400 hover:text-slate-600 text-[10px] underline ml-1 cursor-pointer"
                  title="Réinitialiser la sélection"
                >
                  Effacer
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 px-3 py-1.5 bg-slate-50 border border-slate-200/60 rounded-xl flex items-center justify-between text-[11px] text-slate-500">
              <span>Cliquez sur un bâton pour afficher le nombre d&apos;absences</span>
              <span className="font-semibold text-slate-700">Total : {levelData.reduce((acc, curr) => acc + curr.absences, 0)}</span>
            </div>
          )}
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
