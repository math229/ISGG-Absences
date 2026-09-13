import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  GraduationCap, 
  Building, 
  Eye, 
  PlusCircle, 
  AlertTriangle,
  Download,
  History
} from 'lucide-react';
import { storage } from '../../lib/storage';
import { StudentWithStats } from '../../types';

interface StudentsViewProps {
  onViewStudent: (studentId: string) => void;
  onRecordAbsenceForStudent?: (studentId: string) => void;
}

export const StudentsView: React.FC<StudentsViewProps> = ({
  onViewStudent,
}) => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const programs = useMemo(() => storage.getPrograms(), [refreshTrigger]);
  const levels = useMemo(() => storage.getLevels(), [refreshTrigger]);

  const [students, setStudents] = useState<StudentWithStats[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('all');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [selectedGroup, setSelectedGroup] = useState('all');

  // Groups available for current selected program or all
  const availableGroups = useMemo(() => {
    if (selectedProgram !== 'all') {
      return storage.getProgramGroups(selectedProgram);
    }
    const allGroups = students.map(s => s.classGroup || 'A');
    return Array.from(new Set([...allGroups, 'A', 'B'])).sort();
  }, [selectedProgram, students]);

  const updateStudents = () => {
    const list = storage.getStudents().map(s => storage.getStudentWithStats(s.id)!);
    setStudents(list);
    setRefreshTrigger(p => p + 1);
  };

  useEffect(() => {
    updateStudents();
    const unsub = storage.subscribe(updateStudents);
    return () => unsub();
  }, []);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      if (selectedProgram !== 'all' && s.programId !== selectedProgram) return false;
      if (selectedLevel !== 'all' && s.levelId !== selectedLevel) return false;
      if (selectedGroup !== 'all' && (s.classGroup || 'A') !== selectedGroup) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const fullName = `${s.lastName} ${s.firstName}`.toLowerCase();
        const matricule = s.matricule.toLowerCase();
        const grp = s.classGroup ? `classe ${s.classGroup} groupe ${s.classGroup}`.toLowerCase() : '';
        if (!fullName.includes(q) && !matricule.includes(q) && !grp.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => b.annualAbsenceCount - a.annualAbsenceCount);
  }, [students, selectedProgram, selectedLevel, selectedGroup, searchQuery]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
            Répertoire des étudiants
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Effectif global, statuts d&apos;assiduité et accès aux dossiers individuels
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold bg-orange-100 text-[#EA580C] px-3 py-1.5 rounded-xl">
            {filteredStudents.length} étudiants affichés
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs grid grid-cols-1 sm:grid-cols-12 gap-3">
        {/* Search */}
        <div className="sm:col-span-4 relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4 text-[#EA580C]" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom, matricule, classe..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C]"
          />
        </div>

        {/* Program */}
        <div className="sm:col-span-3">
          <select
            value={selectedProgram}
            onChange={e => {
              setSelectedProgram(e.target.value);
              setSelectedGroup('all');
            }}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] cursor-pointer"
          >
            <option value="all">Toutes les filières</option>
            {programs.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Classe / Group */}
        <div className="sm:col-span-2">
          <select
            value={selectedGroup}
            onChange={e => setSelectedGroup(e.target.value)}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] cursor-pointer"
          >
            <option value="all">Toutes classes</option>
            {availableGroups.map(grp => (
              <option key={grp} value={grp}>
                Classe {grp}
              </option>
            ))}
          </select>
        </div>

        {/* Level */}
        <div className="sm:col-span-3">
          <select
            value={selectedLevel}
            onChange={e => setSelectedLevel(e.target.value)}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] cursor-pointer"
          >
            <option value="all">Tous les niveaux</option>
            {levels.map(l => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Students List & Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Mobile View: Cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredStudents.length === 0 ? (
            <div className="py-12 px-4 text-center text-slate-400">
              Aucun étudiant ne correspond à ces critères.
            </div>
          ) : (
            filteredStudents.map(stu => (
              <div key={stu.id} className="p-4 space-y-3 hover:bg-slate-50/60 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div 
                    onClick={() => onViewStudent(stu.id)}
                    className="flex items-center gap-3 min-w-0 cursor-pointer"
                  >
                    <div className="w-11 h-11 rounded-full bg-slate-200 overflow-hidden flex-shrink-0 border border-slate-300">
                      {stu.avatarUrl ? (
                        <img src={stu.avatarUrl} alt={stu.lastName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-[#EA580C] text-white font-bold flex items-center justify-center text-xs">
                          {stu.lastName.slice(0, 1)}
                          {stu.firstName.slice(0, 1)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 text-sm leading-tight hover:text-[#EA580C]">
                        {stu.lastName} {stu.firstName}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        Matricule : {stu.matricule}
                      </p>
                    </div>
                  </div>

                  <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold shrink-0 ${
                    stu.annualAbsenceCount > 6
                      ? 'bg-rose-100 text-rose-700 border border-rose-200'
                      : stu.annualAbsenceCount > 3
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {stu.annualAbsenceCount} abs
                  </span>
                </div>

                {/* Badges row */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-1 rounded-md text-[11px]">
                    {stu.programName}
                  </span>
                  <span className="font-bold text-[#EA580C] bg-orange-50 border border-orange-200/80 px-2 py-1 rounded-md text-[11px]">
                    Classe {stu.classGroup || 'A'}
                  </span>
                  <span className="text-slate-600 bg-slate-50 border border-slate-200 px-2 py-1 rounded-md text-[11px]">
                    {stu.levelName}
                  </span>
                  {stu.annualAbsenceCount > 6 ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-md">
                      <AlertTriangle className="w-3 h-3" /> Convoquer
                    </span>
                  ) : stu.annualAbsenceCount > 3 ? (
                    <span className="inline-flex items-center text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
                      Vigilance
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                      Régulier
                    </span>
                  )}
                </div>

                {/* Action button */}
                <button
                  type="button"
                  onClick={() => onViewStudent(stu.id)}
                  className="w-full py-2.5 px-3 bg-slate-50 hover:bg-orange-50 hover:text-[#EA580C] border border-slate-200 hover:border-orange-300 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[42px]"
                >
                  <History className="w-4 h-4 text-[#EA580C]" />
                  <span>Consulter le dossier d&apos;assiduité</span>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Full Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="py-3.5 px-5">Étudiant</th>
                <th className="py-3.5 px-5">Matricule</th>
                <th className="py-3.5 px-5">Filière</th>
                <th className="py-3.5 px-5">Classe</th>
                <th className="py-3.5 px-5">Niveau</th>
                <th className="py-3.5 px-5">Total Absences</th>
                <th className="py-3.5 px-5">Statut Assiduité</th>
                <th className="py-3.5 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Aucun étudiant ne correspond à ces critères.
                  </td>
                </tr>
              ) : (
                filteredStudents.map(stu => (
                  <tr key={stu.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-5">
                      <div 
                        onClick={() => onViewStudent(stu.id)}
                        className="flex items-center gap-3 group cursor-pointer"
                        title="Cliquer pour voir l'historique complet des absences de cet étudiant"
                      >
                        <div className="w-9 h-9 rounded-full bg-slate-200 overflow-hidden flex-shrink-0 border border-slate-300 group-hover:border-[#EA580C] group-hover:ring-2 group-hover:ring-[#EA580C]/25 transition-all">
                          {stu.avatarUrl ? (
                            <img src={stu.avatarUrl} alt={stu.lastName} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-[#EA580C] text-white font-bold flex items-center justify-center text-xs">
                              {stu.lastName.slice(0, 1)}
                              {stu.firstName.slice(0, 1)}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm group-hover:text-[#EA580C] group-hover:underline transition-colors">
                            {stu.lastName} {stu.firstName}
                          </p>
                          <p className="text-[11px] text-slate-400">{stu.email || 'Email non renseigné'}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-5 font-mono text-slate-700 font-bold">
                      {stu.matricule}
                    </td>

                    <td className="py-3.5 px-5 text-slate-800">
                      {stu.programName}
                    </td>

                    <td className="py-3.5 px-5">
                      <span className="font-bold text-[#EA580C] bg-orange-50 border border-orange-200/80 px-2 py-0.5 rounded text-[11px]">
                        Classe {stu.classGroup || 'A'}
                      </span>
                    </td>

                    <td className="py-3.5 px-5 text-slate-600">
                      {stu.levelName}
                    </td>

                    <td className="py-3.5 px-5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${
                        stu.annualAbsenceCount > 6
                          ? 'bg-rose-100 text-rose-700 border border-rose-200'
                          : stu.annualAbsenceCount > 3
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {stu.annualAbsenceCount} {stu.annualAbsenceCount === 1 ? 'absence' : 'absences'}
                      </span>
                    </td>

                    <td className="py-3.5 px-5">
                      {stu.annualAbsenceCount > 6 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
                          <AlertTriangle className="w-3 h-3" /> Convoquer
                        </span>
                      ) : stu.annualAbsenceCount > 3 ? (
                        <span className="inline-flex items-center text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                          Vigilance
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                          Régulier
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-5 text-right">
                      <button
                        type="button"
                        onClick={() => onViewStudent(stu.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-orange-300 hover:bg-orange-50 hover:text-[#EA580C] text-slate-700 font-bold text-xs transition-colors cursor-pointer shadow-2xs"
                        title="Voir l'historique complet des absences"
                      >
                        <History className="w-3.5 h-3.5 text-[#EA580C]" />
                        <span>Voir l&apos;historique</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
