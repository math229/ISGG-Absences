import React, { useState } from 'react';
import { 
  Building, 
  Bell, 
  Keyboard, 
  RotateCcw, 
  Check, 
  ShieldCheck,
  Save
} from 'lucide-react';
import { storage } from '../../lib/storage';
import { useToast } from '../common/Toast';

export const SettingsView: React.FC = () => {
  const { showToast } = useToast();
  const [threshold, setThreshold] = useState(5);
  const [notifyParent, setNotifyParent] = useState(true);
  const [autoRefocus, setAutoRefocus] = useState(true);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('Paramètres système enregistrés avec succès', 'success');
  };

  const handleResetData = () => {
    if (window.confirm('Attention : cela réinitialisera toutes les absences et restaurera l\'état de démonstration initial. Continuer ?')) {
      storage.resetToDefaultSeed();
      showToast('Données réinitialisées avec succès', 'info');
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in duration-300">
      {/* View Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
          Paramètres du système
        </h1>
        <p className="text-sm font-medium text-slate-500 mt-1">
          Configuration des seuils d&apos;assiduité, notifications et préférences de saisie
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Card 1: Établissement */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Building className="w-5 h-5 text-[#EA580C]" />
            <h3 className="font-bold text-base text-slate-900">
              Identité de l&apos;établissement
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Raison sociale</label>
              <input 
                type="text" 
                disabled 
                value="Institut Supérieur de Génie Civil et de Gestion (ISGG)" 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Localisation campus</label>
              <input 
                type="text" 
                disabled 
                value="Calavi, République du Bénin" 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-600"
              />
            </div>
          </div>
        </div>

        {/* Card 2: Seuils d'assiduité & Règles */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Bell className="w-5 h-5 text-[#EA580C]" />
            <h3 className="font-bold text-base text-slate-900">
              Seuils d&apos;alerte et discipline
            </h3>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Seuil d&apos;absences déclenchant l&apos;alerte (par semestre)
              </label>
              <div className="flex items-center gap-3">
                <input 
                  type="number" 
                  min={1} 
                  max={20} 
                  value={threshold} 
                  onChange={e => setThreshold(parseInt(e.target.value, 10))}
                  className="w-24 px-3 py-2 bg-white border border-slate-300 rounded-xl font-black text-sm text-[#EA580C]"
                />
                <span className="text-slate-500">
                  absences non justifiées (au-delà, convocation en commission)
                </span>
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                <input 
                  type="checkbox" 
                  checked={autoRefocus} 
                  onChange={e => setAutoRefocus(e.target.checked)}
                  className="w-4 h-4 rounded text-[#EA580C] accent-[#EA580C]"
                />
                <span>Refocus automatique du champ de recherche après enregistrement (UX Ultra-rapide)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                <input 
                  type="checkbox" 
                  checked={notifyParent} 
                  onChange={e => setNotifyParent(e.target.checked)}
                  className="w-4 h-4 rounded text-[#EA580C] accent-[#EA580C]"
                />
                <span>Générer un avis de convocation automatique lors du dépassement du seuil</span>
              </label>
            </div>
          </div>
        </div>

        {/* Card 3: Raccourcis clavier */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Keyboard className="w-5 h-5 text-[#EA580C]" />
            <h3 className="font-bold text-base text-slate-900">
              Raccourcis clavier pour le surveillant
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 flex items-center justify-between">
              <span className="text-slate-700 font-medium">Recherche rapide étudiant</span>
              <span className="font-mono font-bold bg-white border border-slate-200 px-2 py-0.5 rounded shadow-2xs">
                Ctrl + K
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 flex items-center justify-between">
              <span className="text-slate-700 font-medium">Valider l&apos;absence</span>
              <span className="font-mono font-bold bg-white border border-slate-200 px-2 py-0.5 rounded shadow-2xs">
                Entrée
              </span>
            </div>
          </div>
        </div>

        {/* Submit and Reset Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <button
            type="submit"
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#D94600] text-white font-bold text-xs shadow-md shadow-orange-600/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Enregistrer les modifications</span>
          </button>

          <button
            type="button"
            onClick={handleResetData}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Réinitialiser les données de démonstration</span>
          </button>
        </div>
      </form>
    </div>
  );
};
