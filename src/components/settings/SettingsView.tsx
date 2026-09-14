import React, { useState, useEffect } from 'react';
import { 
  Building, 
  Bell, 
  Check, 
  ShieldCheck,
  Save,
  AlertTriangle,
  FileText,
  MessageSquare,
  Sparkles,
  Info,
  Send,
  Sliders,
  CheckCircle2
} from 'lucide-react';
import { storage } from '../../lib/storage';
import { SystemSettings, DEFAULT_SYSTEM_SETTINGS } from '../../types';
import { useToast } from '../common/Toast';

export const SettingsView: React.FC = () => {
  const { showToast } = useToast();
  
  const [settings, setSettings] = useState<SystemSettings>(storage.getSystemSettings());
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const update = () => {
      setSettings(storage.getSystemSettings());
    };
    update();
    const unsubscribe = storage.subscribe(update);
    return () => unsubscribe();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await storage.saveSystemSettings(settings);
      setSaveSuccess(true);
      showToast('Paramètres système et seuils disciplinaires enregistrés avec succès', 'success');
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      showToast('Erreur lors de la sauvegarde des paramètres', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Preview generated message
  const previewMessage = settings.parentNoticeTemplate
    .replace('{etudiant}', 'BIOKOU Christian')
    .replace('{classe}', 'GI / SIL2')
    .replace('{absences}', String(settings.disciplineThreshold))
    .replace('{date_rdv}', 'lundi prochain à 09h00')
    .replace('{tuteur}', 'M. / Mme BIOKOU');

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in duration-300">
      {/* View Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
          Paramètres du système
        </h1>
        <p className="text-sm font-medium text-slate-500 mt-1">
          Configuration des paliers d&apos;assiduité, convocations disciplinaires et modèle de messages
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Card 1: Établissement */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Building className="w-5 h-5 text-[#EA580C]" />
            <h3 className="font-bold text-base text-slate-900">
              Identité de l&apos;établissement & Campus
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Raison sociale</label>
              <input 
                type="text" 
                disabled 
                value="Institut Supérieur de Génie Civil et de Gestion (ISGG)" 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 select-none"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Localisation campus</label>
              <input 
                type="text" 
                disabled 
                value="Calavi, République du Bénin" 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 select-none"
              />
            </div>
          </div>
        </div>

        {/* Card 2: Les 3 Paliers d'assiduité & Discipline */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#EA580C]" />
              <h3 className="font-bold text-base text-slate-900">
                Paliers d&apos;assiduité & Échelle disciplinaire ISGG
              </h3>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-orange-50 text-[#EA580C] border border-orange-100">
              Réglementation officielle
            </span>
          </div>

          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            Configurez les 3 seuils progressifs appliqués dans l&apos;ensemble de l&apos;établissement (Tableau de bord, listes de classe, dossiers de convocation et disqualification aux examens).
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Palier 1 */}
            <div className="bg-amber-50/50 border border-amber-200/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md">
                  Palier 1
                </span>
                <span className="text-xs font-bold text-amber-700">Avertissement</span>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Seuil d&apos;avertissement
                </label>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    min={1} 
                    max={10} 
                    value={settings.warningThreshold} 
                    onChange={e => setSettings({ ...settings, warningThreshold: parseInt(e.target.value, 10) || 1 })}
                    className="w-20 px-3 py-2 bg-white border border-amber-300 rounded-xl font-black text-sm text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                  <span className="text-xs text-slate-600 font-medium">absences</span>
                </div>
              </div>
              <p className="text-[11px] text-amber-900/80 font-medium">
                Signalement préventif et badge jaune dans les fiches étudiants.
              </p>
            </div>

            {/* Palier 2 */}
            <div className="bg-orange-50/60 border border-orange-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-orange-900 bg-orange-100 px-2 py-0.5 rounded-md">
                  Palier 2 (Critique)
                </span>
                <span className="text-xs font-bold text-[#EA580C]">Convocation</span>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Seuil de convocation
                </label>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    min={2} 
                    max={15} 
                    value={settings.disciplineThreshold} 
                    onChange={e => setSettings({ ...settings, disciplineThreshold: parseInt(e.target.value, 10) || 2 })}
                    className="w-20 px-3 py-2 bg-white border border-orange-300 rounded-xl font-black text-sm text-[#EA580C] focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                  <span className="text-xs text-slate-600 font-medium">absences</span>
                </div>
              </div>
              <p className="text-[11px] text-orange-950/80 font-medium">
                Déclenche l&apos;entrée au dossier disciplinaire et l&apos;avis officiel de convocation.
              </p>
            </div>

            {/* Palier 3 */}
            <div className="bg-rose-50/50 border border-rose-200/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-rose-800 bg-rose-100/80 px-2 py-0.5 rounded-md">
                  Palier 3
                </span>
                <span className="text-xs font-bold text-rose-700">Exclusion examen</span>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Limite par matière
                </label>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    min={1} 
                    max={6} 
                    value={settings.examExclusionLimit} 
                    onChange={e => setSettings({ ...settings, examExclusionLimit: parseInt(e.target.value, 10) || 1 })}
                    className="w-20 px-3 py-2 bg-white border border-rose-300 rounded-xl font-black text-sm text-rose-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  />
                  <span className="text-xs text-slate-600 font-medium">séances non justifiées</span>
                </div>
              </div>
              <p className="text-[11px] text-rose-900/80 font-medium">
                Au-delà de cette limite dans une matière, l&apos;étudiant est disqualifié à l&apos;examen.
              </p>
            </div>
          </div>
        </div>

        {/* Card 3: Automatismes & Ergonomie de saisie */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Bell className="w-5 h-5 text-[#EA580C]" />
            <h3 className="font-bold text-base text-slate-900">
              Automatismes & Alertes en direct
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50/80 cursor-pointer transition-colors">
              <input 
                type="checkbox" 
                checked={settings.instantAlertOnEntry} 
                onChange={e => setSettings({ ...settings, instantAlertOnEntry: e.target.checked })}
                className="w-4 h-4 rounded text-[#EA580C] accent-[#EA580C] mt-0.5 shrink-0"
              />
              <div>
                <span className="font-bold text-slate-800 block">
                  Alerte visuelle immédiate en direct lors de la saisie
                </span>
                <span className="text-slate-500 font-medium leading-relaxed block mt-0.5">
                  Affiche un avertissement critique instantané dès qu&apos;une absence fait basculer un étudiant au seuil de convocation ({settings.disciplineThreshold} absences).
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50/80 cursor-pointer transition-colors">
              <input 
                type="checkbox" 
                checked={settings.autoConvocationNotice} 
                onChange={e => setSettings({ ...settings, autoConvocationNotice: e.target.checked })}
                className="w-4 h-4 rounded text-[#EA580C] accent-[#EA580C] mt-0.5 shrink-0"
              />
              <div>
                <span className="font-bold text-slate-800 block">
                  Générer automatiquement un avis dans le dossier des convocations
                </span>
                <span className="text-slate-500 font-medium leading-relaxed block mt-0.5">
                  Inscrit immédiatement l&apos;étudiant dans le dossier officiel des convocations de la Direction des Études.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50/80 cursor-pointer transition-colors">
              <input 
                type="checkbox" 
                checked={settings.autoRefocus} 
                onChange={e => setSettings({ ...settings, autoRefocus: e.target.checked })}
                className="w-4 h-4 rounded text-[#EA580C] accent-[#EA580C] mt-0.5 shrink-0"
              />
              <div>
                <span className="font-bold text-slate-800 block">
                  Refocus automatique du champ de recherche après enregistrement
                </span>
                <span className="text-slate-500 font-medium leading-relaxed block mt-0.5">
                  Permet au surveillant d&apos;enchaîner les saisies ultra-rapidement sans réutiliser la souris.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Card 4: Modèle de message aux parents / tuteurs */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#EA580C]" />
              <h3 className="font-bold text-base text-slate-900">
                Modèle de notification aux parents & tuteurs
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Variables disponibles : <code className="bg-slate-100 px-1 py-0.5 rounded text-orange-700 font-mono text-[11px]">{'{etudiant}'}</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-orange-700 font-mono text-[11px]">{'{absences}'}</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-orange-700 font-mono text-[11px]">{'{classe}'}</code>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setSettings({ ...settings, parentNotificationChannel: 'WHATSAPP' })}
              className={`p-3 rounded-xl border text-left font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                settings.parentNotificationChannel === 'WHATSAPP'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span>WhatsApp (Privilégié)</span>
            </button>

            <button
              type="button"
              onClick={() => setSettings({ ...settings, parentNotificationChannel: 'SMS' })}
              className={`p-3 rounded-xl border text-left font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                settings.parentNotificationChannel === 'SMS'
                  ? 'border-blue-500 bg-blue-50 text-blue-900 ring-2 ring-blue-500/20'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span>SMS Direct</span>
            </button>

            <button
              type="button"
              onClick={() => setSettings({ ...settings, parentNotificationChannel: 'EMAIL' })}
              className={`p-3 rounded-xl border text-left font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                settings.parentNotificationChannel === 'EMAIL'
                  ? 'border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-500/20'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span>Email officiel</span>
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Texte du message officiel à envoyer
            </label>
            <textarea
              rows={3}
              value={settings.parentNoticeTemplate}
              onChange={e => setSettings({ ...settings, parentNoticeTemplate: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-medium text-xs text-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              placeholder="Texte du message..."
            />
          </div>

          {/* Dynamic Interactive Preview */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-[#EA580C]" />
              <span>Aperçu en direct du message généré pour les parents :</span>
            </div>
            <p className="text-xs font-medium text-slate-800 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed">
              « {previewMessage} »
            </p>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-start gap-4 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="w-full sm:w-auto px-7 py-3 rounded-xl bg-[#EA580C] hover:bg-[#D94600] disabled:bg-slate-400 text-white font-bold text-xs sm:text-sm shadow-md shadow-orange-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            {isSaving ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : saveSuccess ? (
              <CheckCircle2 className="w-4 h-4 text-white" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{isSaving ? 'Enregistrement en cours...' : saveSuccess ? 'Modifications enregistrées !' : 'Enregistrer les paramètres'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
