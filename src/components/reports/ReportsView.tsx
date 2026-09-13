import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  Calendar, 
  Filter, 
  Building, 
  GraduationCap, 
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { storage, formatFrenchDate } from '../../lib/storage';
import { useToast } from '../common/Toast';

export const ReportsView: React.FC = () => {
  const { showToast } = useToast();
  const [reportType, setReportType] = useState<'daily' | 'weekly' | 'monthly' | 'discipline'>('daily');
  const [selectedProgram, setSelectedProgram] = useState<string>('all');

  const programs = useMemo(() => storage.getPrograms(), []);
  const allAbsences = useMemo(() => storage.getAbsencesWithDetails(), []);
  const students = useMemo(() => storage.getStudents().map(s => storage.getStudentWithStats(s.id)!), []);

  // Filtered absences by period and program
  const reportData = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return allAbsences.filter(a => {
      if (selectedProgram !== 'all' && a.program.id !== selectedProgram) return false;
      if (reportType === 'daily') return a.absenceDate === today;
      return true;
    });
  }, [allAbsences, selectedProgram, reportType]);

  // Students exceeding threshold (> 6 absences)
  const studentsAtRisk = useMemo(() => {
    return students
      .filter(s => s.annualAbsenceCount >= 5)
      .sort((a, b) => b.annualAbsenceCount - a.annualAbsenceCount);
  }, [students]);

  const handleExportCSV = () => {
    const headers = ['Matricule', 'Nom', 'Prenom', 'Filiere', 'Niveau', 'Total_Absences', 'Statut'];
    const rows = students.map(s => [
      s.matricule,
      `"${s.lastName}"`,
      `"${s.firstName}"`,
      `"${s.programName}"`,
      `"${s.levelName}"`,
      s.annualAbsenceCount,
      s.annualAbsenceCount > 6 ? 'Conseil_Discipline' : s.annualAbsenceCount > 3 ? 'Avertissement' : 'Normal',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `isgg_rapport_assiduite_${reportType}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Rapport CSV téléchargé avec succès', 'success');
  };

  const handlePrint = () => {
    window.print();
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
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 text-[#EA580C]" />
            <span>Imprimer</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 bg-[#EA580C] hover:bg-[#D94600] text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-orange-600/20 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Exporter CSV</span>
          </button>
        </div>
      </div>

      {/* Selector Tabs */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold w-full sm:w-auto overflow-x-auto">
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

        {/* Program Filter */}
        <div className="w-full sm:w-64">
          <select
            value={selectedProgram}
            onChange={e => setSelectedProgram(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 cursor-pointer"
          >
            <option value="all">Toutes les filières</option>
            {programs.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Report Document View */}
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm print:p-0 print:border-none print:shadow-none space-y-6">
        {/* Document Official Letterhead */}
        <div className="border-b-2 border-slate-900 pb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-950 uppercase tracking-tight">
              Institut Supérieur de Génie Civil et de Gestion
            </h2>
            <p className="text-xs text-slate-500 font-semibold">
              Direction des Études • Service de Surveillance & Assiduité
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Année Académique {storage.getSchoolYear()?.name || '2026-2027'} • Campus ISGG Calavi
            </p>
          </div>

          <div className="text-right">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Bordereau officiel</span>
            <span className="text-sm font-black text-[#EA580C]">
              {reportType === 'daily' ? 'Rapport Quotidien' : reportType === 'weekly' ? 'Bilan Hebdomadaire' : reportType === 'monthly' ? 'Bilan Mensuel' : 'Dossier Commission Discipline'}
            </span>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Généré le {formatFrenchDate(new Date().toISOString().slice(0, 10))}
            </p>
          </div>
        </div>

        {/* Content Mode 1: Discipline Alerts List */}
        {reportType === 'discipline' ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-3 font-semibold">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>
                Liste des étudiants ayant dépassé le seuil de tolérance (5 absences et plus). Convocations requises pour le conseil de discipline.
              </span>
            </div>

            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 font-bold uppercase">
                <tr>
                  <th className="p-3">Matricule</th>
                  <th className="p-3">Étudiant</th>
                  <th className="p-3">Filière / Niveau</th>
                  <th className="p-3">Absences Cumulées</th>
                  <th className="p-3">Décision Recommandée</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {studentsAtRisk.map(s => (
                  <tr key={s.id}>
                    <td className="p-3 font-mono font-bold text-slate-900">{s.matricule}</td>
                    <td className="p-3 font-bold text-slate-900">{s.lastName} {s.firstName}</td>
                    <td className="p-3">{s.programName} ({s.levelName})</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-black text-xs">
                        {s.annualAbsenceCount} absences
                      </span>
                    </td>
                    <td className="p-3 text-rose-700 font-bold">
                      {s.annualAbsenceCount > 6 ? 'Convocation immédiate avec tuteur' : 'Avertissement écrit'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Content Mode 2: Standard Absence Log */
          <div className="space-y-4">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 font-bold uppercase">
                <tr>
                  <th className="p-3">Date / Heure</th>
                  <th className="p-3">Matricule</th>
                  <th className="p-3">Étudiant</th>
                  <th className="p-3">Filière / Niveau</th>
                  <th className="p-3">Matière</th>
                  <th className="p-3">Surveillant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.slice(0, 15).map(a => (
                  <tr key={a.id}>
                    <td className="p-3 font-semibold text-slate-900">{a.absenceDate} {a.absenceTime}</td>
                    <td className="p-3 font-mono text-slate-500">{a.student.matricule}</td>
                    <td className="p-3 font-bold text-slate-900">{a.student.lastName} {a.student.firstName}</td>
                    <td className="p-3">{a.program.code} • {a.level.code}</td>
                    <td className="p-3 font-medium text-slate-800">{a.subject.name}</td>
                    <td className="p-3 text-slate-500">{a.recordedByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Official Signature Blocks */}
        <div className="pt-12 grid grid-cols-2 gap-8 text-center text-xs font-bold text-slate-800">
          <div>
            <p>Le Surveillant Général</p>
            <div className="h-16 flex items-center justify-center text-slate-300 italic">
              Cachet & Signature
            </div>
            <p className="text-slate-500 font-medium">M. Diallo</p>
          </div>
          <div>
            <p>Le Directeur des Études</p>
            <div className="h-16 flex items-center justify-center text-slate-300 italic">
              Cachet & Signature
            </div>
            <p className="text-slate-500 font-medium">Dr. K. Mensah</p>
          </div>
        </div>
      </div>
    </div>
  );
};
