import React from 'react';
import { SheetImportRecord } from '../../types';
import { formatFrenchDate } from '../../lib/storage';
import { 
  FileSpreadsheet, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Users, 
  BookOpen, 
  FolderPlus,
  ArrowRight
} from 'lucide-react';

interface SheetImportHistoryProps {
  imports: SheetImportRecord[];
  onNewImportClick: () => void;
}

export const SheetImportHistory: React.FC<SheetImportHistoryProps> = ({
  imports,
  onNewImportClick,
}) => {
  if (imports.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
          <FileSpreadsheet className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-semibold text-slate-800 mb-1">Aucune fiche importée pour le moment</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
          Toutes les fiches d'absences quotidiennes importées et validées par le surveillant général apparaîtront ici avec leur traçabilité complète.
        </p>
        <button
          onClick={onNewImportClick}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg shadow-xs transition-colors"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Importer une première fiche
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-800">
            Historique des fiches d'absences traitées ({imports.length})
          </h3>
          <p className="text-xs text-slate-500">
            Traçabilité des imports de fiches récapitulatives quotidiennes
          </p>
        </div>
        <button
          onClick={onNewImportClick}
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Nouvel import
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Mobile View: Cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {imports.map((record) => (
            <div key={record.id} className="p-4 space-y-2.5 hover:bg-slate-50 transition-colors">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-sm text-slate-800">
                  <Calendar className="w-4 h-4 text-orange-600 shrink-0" />
                  {formatFrenchDate(record.sheetDate)}
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-semibold shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Enregistré
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium">
                  <BookOpen className="w-3 h-3" />
                  {record.sessionsCount} séance{record.sessionsCount > 1 ? 's' : ''}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 font-semibold">
                  {record.absencesCount} absence{record.absencesCount > 1 ? 's' : ''}
                </span>
                {record.newStudentsCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium">
                    <Users className="w-3 h-3" />
                    +{record.newStudentsCount} créés
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                <span>Par {record.recordedBy}</span>
                <span>
                  {new Date(record.importedAt).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop View: Full Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-3">Date de la fiche</th>
                <th className="px-4 py-3">Importé le</th>
                <th className="px-4 py-3">Séances</th>
                <th className="px-4 py-3">Absences enregistrées</th>
                <th className="px-4 py-3">Nouveaux étudiants</th>
                <th className="px-4 py-3">Surveillant</th>
                <th className="px-4 py-3 text-right">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {imports.map((record) => (
                <tr key={record.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-orange-600" />
                      {formatFrenchDate(record.sheetDate)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(record.importedAt).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                      <BookOpen className="w-3 h-3" />
                      {record.sessionsCount} séance{record.sessionsCount > 1 ? 's' : ''}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-700 font-medium">
                      {record.absencesCount} absence{record.absencesCount > 1 ? 's' : ''}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {record.newStudentsCount > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                        <Users className="w-3 h-3" />
                        +{record.newStudentsCount} créés
                      </span>
                    ) : (
                      <span className="text-slate-400">Aucun (déjà connus)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700 font-medium whitespace-nowrap">
                    {record.recordedBy}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Enregistré
                    </span>
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
