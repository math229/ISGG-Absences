import React, { useState, useEffect } from 'react';
import { 
  Users, 
  GraduationCap, 
  CalendarDays, 
  TrendingUp, 
  ArrowUpRight, 
  PlusCircle, 
  ChevronRight,
  Clock,
  BookOpen
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { storage } from '../../lib/storage';
import { DashboardMetrics, AbsenceWithDetails } from '../../types';

interface DashboardViewProps {
  onNavigateToNewAbsence: () => void;
  onNavigateToHistory: () => void;
  onNavigateToStudent: (studentId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateToNewAbsence,
  onNavigateToHistory,
  onNavigateToStudent,
}) => {
  const [metrics, setMetrics] = useState<DashboardMetrics>(storage.getDashboardMetrics());
  const [recentAbsences, setRecentAbsences] = useState<AbsenceWithDetails[]>([]);
  const [distribution, setDistribution] = useState(storage.getProgramDistribution());
  const [weeklyData, setWeeklyData] = useState<{ day: string; date: string; fullDate: string; absences: number }[]>(
    storage.getWeeklyAbsenceTrend()
  );
  const [selectedProgramIndex, setSelectedProgramIndex] = useState<number | null>(null);

  // Refresh live data on storage changes
  useEffect(() => {
    const update = () => {
      setMetrics(storage.getDashboardMetrics());
      setRecentAbsences(storage.getAbsencesWithDetails().slice(0, 5));
      setDistribution(storage.getProgramDistribution());
      setWeeklyData(storage.getWeeklyAbsenceTrend());
    };

    update();
    const unsubscribe = storage.subscribe(update);
    return () => unsubscribe();
  }, []);

  // Format large numbers with spaces (e.g. 1 284)
  const formatNumber = (num: number) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  // Dynamic Y-axis scale based on real absence counts
  const maxWeeklyAbsences = Math.max(...weeklyData.map(d => d.absences), 5);
  const yAxisMax = Math.max(10, Math.ceil((maxWeeklyAbsences * 1.25) / 5) * 5);
  const totalWeeklyAbsences = weeklyData.reduce((acc, curr) => acc + curr.absences, 0);
  const totalDistributionAbsences = distribution.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
            Tableau de bord
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">
            Vue d&apos;ensemble des absences et indicateurs d&apos;assiduité
          </p>
        </div>

        {/* Quick Action Button */}
        <button
          id="dashboard-new-absence-button"
          onClick={onNavigateToNewAbsence}
          className="inline-flex items-center justify-center gap-2 bg-[#EA580C] hover:bg-[#D94600] text-white px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-orange-600/20 active:scale-[0.98] transition-all cursor-pointer min-h-[44px] w-full sm:w-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Nouvelle absence</span>
        </button>
      </div>

      {/* 4 KPI Cards (Pixel-perfect to Panel 2 of mockups) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 sm:gap-5">
        {/* Metric 1: Absences aujourd'hui */}
        <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Absences aujourd&apos;hui
            </span>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-orange-50 flex items-center justify-center text-[#EA580C]">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4 flex items-baseline gap-3">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {metrics.absencesToday}
            </span>
            <span className="inline-flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
              <ArrowUpRight className="w-3 h-3 mr-0.5" />
              +{metrics.growthTodayPct}%
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5 sm:mt-2">vs même heure jour précédent</p>
        </div>

        {/* Metric 2: Étudiants concernés */}
        <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Étudiants concernés
            </span>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <GraduationCap className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4 flex items-baseline gap-3">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {metrics.studentsToday}
            </span>
            <span className="inline-flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
              <ArrowUpRight className="w-3 h-3 mr-0.5" />
              +{metrics.growthStudentsPct}%
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5 sm:mt-2">apprenants distincts aujourd&apos;hui</p>
        </div>

        {/* Metric 3: Absences cette semaine */}
        <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Absences cette semaine
            </span>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-orange-50 flex items-center justify-center text-[#EA580C]">
              <CalendarDays className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4 flex items-baseline gap-3">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {totalWeeklyAbsences}
            </span>
            <span className="inline-flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
              <ArrowUpRight className="w-3 h-3 mr-0.5" />
              +{metrics.growthWeekPct}%
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5 sm:mt-2">cumul des 7 derniers jours</p>
        </div>

        {/* Metric 4: Total annuel */}
        <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total annuel
            </span>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-orange-50 flex items-center justify-center text-[#EA580C]">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4 flex items-baseline gap-3">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {formatNumber(metrics.totalAnnual)}
            </span>
            <span className="inline-flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
              <ArrowUpRight className="w-3 h-3 mr-0.5" />
              +{metrics.growthAnnualPct}%
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5 sm:mt-2">année académique {storage.getSchoolYear()?.name || '2026-2027'}</p>
        </div>
      </div>

      {/* Main Charts Row (Matching Panel 2) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full min-w-0">
        {/* Left Chart: Évolution des absences (AreaChart with orange spline gradient) */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between min-w-0 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#EA580C]" />
              <h3 className="font-bold text-base text-slate-900">
                Évolution des absences
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                7 derniers jours
              </span>
              <span className="text-xs font-bold text-[#EA580C] bg-orange-50 border border-orange-200/70 px-2.5 py-1 rounded-lg">
                {totalWeeklyAbsences} absence{totalWeeklyAbsences > 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Recharts Area Chart */}
          <div className="h-64 w-full min-w-0 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAbsences" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EA580C" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#EA580C" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="day" 
                  tickLine={false} 
                  axisLine={{ stroke: '#E2E8F0' }}
                  tick={{ fill: '#64748B', fontSize: 12, fontWeight: 500 }}
                />
                <YAxis 
                  domain={[0, yAxisMax]}
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#94A3B8', fontSize: 11 }}
                />
                <Tooltip 
                  formatter={(val) => [`${val} absence${Number(val) > 1 ? 's' : ''}`, 'Total enregistré']}
                  labelFormatter={(label, payload) => {
                    if (payload && payload.length > 0) {
                      const item = payload[0].payload;
                      return `${item.day} ${item.date || ''}`;
                    }
                    return String(label);
                  }}
                  contentStyle={{ 
                    backgroundColor: '#0F172A', 
                    borderRadius: '12px', 
                    border: 'none', 
                    color: '#fff',
                    fontSize: '12px'
                  }}
                  itemStyle={{ color: '#F97316' }}
                  wrapperStyle={{ pointerEvents: 'none', zIndex: 40 }}
                />
                <Area 
                  type="monotone" 
                  dataKey="absences" 
                  stroke="#EA580C" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorAbsences)" 
                  activeDot={{ r: 6, fill: '#EA580C', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Chart: Répartition par filière (Donut with center total) */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between min-w-0 overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-orange-400" />
              <h3 className="font-bold text-base text-slate-900">
                Répartition par filière
              </h3>
            </div>
            {selectedProgramIndex !== null ? (
              <button
                onClick={() => setSelectedProgramIndex(null)}
                className="text-xs text-[#EA580C] hover:underline font-bold cursor-pointer"
              >
                Réinitialiser
              </button>
            ) : (
              <span className="text-xs text-slate-500 font-medium">Cumul annuel</span>
            )}
          </div>

          {/* Donut Chart with Center Text and Legend */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center py-2 min-w-0">
            <div className="sm:col-span-7 h-52 relative flex items-center justify-center min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart style={{ outline: 'none' }}>
                  <Pie
                    data={distribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="count"
                    isAnimationActive={false}
                    onClick={(_, index) => {
                      setSelectedProgramIndex(prev => prev === index ? null : index);
                    }}
                    cursor="pointer"
                    style={{ outline: 'none' }}
                  >
                    {distribution.map((entry, index) => {
                      const isSelected = selectedProgramIndex === index;
                      const isAnySelected = selectedProgramIndex !== null;
                      const isInteractive = !isAnySelected || isSelected;

                      return (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.color} 
                          opacity={isInteractive ? 1 : 0.2}
                          style={{ 
                            outline: 'none', 
                            transition: 'opacity 0.2s ease-in-out',
                            pointerEvents: isInteractive ? 'auto' : 'none',
                            cursor: isSelected ? 'pointer' : (isAnySelected ? 'default' : 'pointer')
                          }}
                        />
                      );
                    })}
                  </Pie>
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const item = payload[0]?.payload;
                      if (!item) return null;

                      // If a portion is selected, strictly hide tooltip for all other inactive portions
                      if (selectedProgramIndex !== null) {
                        const selectedItem = distribution[selectedProgramIndex];
                        if (!selectedItem || selectedItem.code !== item.code) {
                          return null;
                        }
                      }

                      return (
                        <div className="bg-[#0F172A] border border-slate-700/80 shadow-2xl rounded-xl px-3 py-1.5 text-white pointer-events-none whitespace-nowrap z-50 animate-in fade-in duration-100">
                          <div className="flex items-center gap-2 text-xs">
                            <span 
                              className="w-2.5 h-2.5 rounded-full ring-1.5 ring-white/40 flex-shrink-0" 
                              style={{ backgroundColor: item.color }} 
                            />
                            <span className="font-extrabold text-white tracking-wide">
                              {item.code}
                            </span>
                            <span className="text-slate-200 font-medium">
                              : {item.count} absence{item.count > 1 ? 's' : ''} ({item.percentage}%)
                            </span>
                          </div>
                        </div>
                      );
                    }}
                    wrapperStyle={{ pointerEvents: 'none', zIndex: 50 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Inner Center Dynamic Label */}
              <div 
                className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none text-center px-2"
              >
                {selectedProgramIndex !== null && distribution[selectedProgramIndex] ? (
                  <>
                    <span className="text-2xl font-black text-slate-900 leading-none">
                      {distribution[selectedProgramIndex].count}
                    </span>
                    <span className="text-[11px] font-bold text-[#EA580C] uppercase tracking-wider mt-0.5">
                      {distribution[selectedProgramIndex].code} ({distribution[selectedProgramIndex].percentage}%)
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl font-black text-slate-900 leading-none">
                      {totalDistributionAbsences}
                    </span>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                      absences
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Interactive Legend list */}
            <div className="sm:col-span-5 space-y-1.5 text-xs">
              {distribution.map((item, idx) => {
                const isSelected = selectedProgramIndex === idx;
                return (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => setSelectedProgramIndex(prev => prev === idx ? null : idx)}
                    className={`w-full flex items-center justify-between p-1.5 rounded-lg transition-colors text-left cursor-pointer ${
                      isSelected 
                        ? 'bg-orange-50 font-bold text-[#EA580C]' 
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate pr-1">
                      <span 
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-transform" 
                        style={{ 
                          backgroundColor: item.color,
                          transform: isSelected ? 'scale(1.25)' : 'scale(1)'
                        }} 
                      />
                      <span className="truncate text-[11px] sm:text-xs">{item.name}</span>
                    </div>
                    <span className="font-extrabold text-[11px] sm:text-xs flex-shrink-0">
                      {item.percentage}%
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Absences Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#EA580C]" />
            <h3 className="font-bold text-sm sm:text-base text-slate-900">
              Dernières absences enregistrées
            </h3>
          </div>
          <button
            onClick={onNavigateToHistory}
            className="text-xs font-bold text-[#EA580C] hover:underline flex items-center gap-1 self-start sm:self-auto"
          >
            <span>Consulter l&apos;historique complet</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Mobile View: Cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {recentAbsences.map(abs => (
            <div key={abs.id} className="p-4 hover:bg-slate-50 transition-colors space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-orange-100 text-[#EA580C] font-bold flex items-center justify-center text-xs flex-shrink-0">
                    {abs.student.lastName.slice(0, 1)}
                    {abs.student.firstName.slice(0, 1)}
                  </div>
                  <div>
                    <p className="font-bold text-xs text-slate-900 leading-tight">
                      {abs.student.lastName} {abs.student.firstName}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{abs.student.matricule}</p>
                  </div>
                </div>
                <button
                  onClick={() => onNavigateToStudent(abs.student.id)}
                  className="px-2.5 py-1 bg-orange-50 hover:bg-orange-100 text-[#EA580C] font-bold text-xs rounded-lg transition-colors flex-shrink-0"
                >
                  Fiche
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-semibold">
                  {abs.program.code} • {abs.level.code}
                </span>
                <span className="inline-flex items-center gap-1 text-slate-700 font-medium px-2 py-0.5 bg-slate-50 rounded-md border border-slate-200/60">
                  <BookOpen className="w-3 h-3 text-slate-400" />
                  {abs.subject.name}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>{abs.absenceDate} à {abs.absenceTime}</span>
                <span>Par {abs.recordedByName}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop View: Full Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="py-3 px-5">Date / Heure</th>
                <th className="py-3 px-5">Étudiant</th>
                <th className="py-3 px-5">Filière</th>
                <th className="py-3 px-5">Matière</th>
                <th className="py-3 px-5">Enregistré par</th>
                <th className="py-3 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {recentAbsences.map(abs => (
                <tr key={abs.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-5 text-slate-900 whitespace-nowrap">
                    <span className="font-bold">{abs.absenceDate}</span>
                    <span className="text-slate-400 ml-1.5">{abs.absenceTime}</span>
                  </td>
                  <td className="py-3 px-5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-orange-100 text-[#EA580C] font-bold flex items-center justify-center text-[10px] flex-shrink-0">
                        {abs.student.lastName.slice(0, 1)}
                        {abs.student.firstName.slice(0, 1)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">
                          {abs.student.lastName} {abs.student.firstName}
                        </p>
                        <p className="text-[10px] text-slate-400">{abs.student.matricule}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-semibold text-[11px]">
                      {abs.program.code} • {abs.level.code}
                    </span>
                  </td>
                  <td className="py-3 px-5 font-semibold text-slate-900">
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                      <span>{abs.subject.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-5 text-slate-500">
                    {abs.recordedByName}
                  </td>
                  <td className="py-3 px-5 text-right">
                    <button
                      onClick={() => onNavigateToStudent(abs.student.id)}
                      className="text-[#EA580C] hover:text-[#D94600] font-bold text-xs hover:underline cursor-pointer"
                    >
                      Fiche
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
