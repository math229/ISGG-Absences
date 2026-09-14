import React, { useState, useRef, useEffect } from 'react';
import { 
  KeyRound, 
  Copy, 
  Check, 
  Download, 
  Upload, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  FileSpreadsheet, 
  Code2, 
  Terminal, 
  ShieldCheck, 
  Globe, 
  Database,
  Layers,
  HelpCircle,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { storage } from '../../lib/storage';
import { useToast } from '../common/Toast';
import { SystemSettings } from '../../types';

export const IntegrationHubTab: React.FC = () => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState<SystemSettings>(storage.getSystemSettings());
  const [apiKey, setApiKey] = useState(settings.syncApiKey || 'isgg_live_key_9482f5b8e1');
  const [isCopied, setIsCopied] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Manual file import state
  const [isImporting, setIsImporting] = useState(false);
  const [importStats, setImportStats] = useState<{ created: number; updated: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Selected guide sub-tab
  const [guideMode, setGuideMode] = useState<'curl' | 'python' | 'node' | 'powershell'>('curl');

  useEffect(() => {
    const refresh = () => {
      const s = storage.getSystemSettings();
      setSettings(s);
      if (s.syncApiKey) setApiKey(s.syncApiKey);
    };
    return storage.subscribe(refresh);
  }, []);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setIsCopied(true);
    showToast('Clé API copiée dans le presse-papiers', 'success');
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleRegenerateKey = async () => {
    const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const newKey = `isgg_live_key_${randomHex}`;
    setApiKey(newKey);
    await storage.saveSystemSettings({ syncApiKey: newKey });
    showToast('Nouvelle clé API générée et enregistrée avec succès !', 'success');
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/v1/sync/status', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: `Connectivité confirmée ! ${data.service} (${data.status}).`,
        });
        showToast('Connexion API validée avec succès !', 'success');
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Échec d\'authentification avec cette clé.',
        });
        showToast('Échec du test de connectivité API', 'error');
      }
    } catch {
      setTestResult({
        success: false,
        message: 'Impossible de joindre le serveur API. Vérifiez le statut du serveur.',
      });
      showToast('Erreur réseau lors du test API', 'error');
    } finally {
      setIsTesting(false);
    }
  };

  // Traitement d'un fichier CSV ou JSON
  const handleFileProcess = async (file: File) => {
    setIsImporting(true);
    setImportStats(null);

    try {
      const text = await file.text();
      let studentsPayload: Array<{
        matricule: string;
        lastName: string;
        firstName: string;
        programId: string;
        levelId: string;
        classGroup?: string;
        email?: string;
        phone?: string;
      }> = [];

      if (file.name.endsWith('.json')) {
        const parsed = JSON.parse(text);
        const list = Array.isArray(parsed) ? parsed : (parsed.students || []);
        studentsPayload = list.map((item: any, idx: number) => {
          const prog = (item.program || item.filiere || 'GI').toUpperCase();
          const lvl = (item.level || item.niveau || 'L2').toUpperCase();
          return {
            matricule: item.matricule || `ISGG-${Date.now().toString().slice(-4)}${idx}`,
            lastName: (item.lastName || item.nom || 'INCONNU').trim().toUpperCase(),
            firstName: (item.firstName || item.prenom || item.prenoms || 'Étudiant').trim(),
            programId: prog.includes('GC') ? 'prog-gc' : prog.includes('GEI') ? 'prog-gei' : 'prog-gi',
            levelId: lvl.includes('1') ? 'lvl-l1' : lvl.includes('3') ? 'lvl-l3' : 'lvl-l2',
            classGroup: (item.classGroup || item.groupe || 'A').toUpperCase(),
            email: item.email || item.mail || undefined,
            phone: item.phone || item.tel || undefined,
          };
        });
      } else {
        // Parsing CSV simple avec prise en compte de séparateurs virgule ou point-virgule
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length < 2) {
          throw new Error('Le fichier CSV doit comporter une ligne d\'en-tête et au moins une ligne d\'étudiant.');
        }

        const separator = lines[0].includes(';') ? ';' : ',';
        const headers = lines[0].split(separator).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));

        const matriculeIdx = headers.findIndex(h => h.includes('matricule') || h.includes('ref') || h.includes('id'));
        const nomIdx = headers.findIndex(h => h.includes('nom') || h.includes('lastname'));
        const prenomIdx = headers.findIndex(h => h.includes('prenom') || h.includes('firstname'));
        const filiereIdx = headers.findIndex(h => h.includes('filiere') || h.includes('program'));
        const niveauIdx = headers.findIndex(h => h.includes('niveau') || h.includes('level') || h.includes('classe'));
        const groupeIdx = headers.findIndex(h => h.includes('groupe') || h.includes('group'));
        const emailIdx = headers.findIndex(h => h.includes('email') || h.includes('mail'));
        const phoneIdx = headers.findIndex(h => h.includes('tel') || h.includes('phone'));

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(separator).map(c => c.trim().replace(/^["']|["']$/g, ''));
          if (cols.length < 2) continue;

          const nom = (nomIdx !== -1 ? cols[nomIdx] : cols[1]) || '';
          const prenom = (prenomIdx !== -1 ? cols[prenomIdx] : cols[2]) || '';
          if (!nom && !prenom) continue;

          const matricule = (matriculeIdx !== -1 && cols[matriculeIdx]) 
            ? cols[matriculeIdx] 
            : `ISGG-${Date.now().toString().slice(-4)}${i}`;

          const filiereStr = (filiereIdx !== -1 ? cols[filiereIdx] : '').toUpperCase();
          const niveauStr = (niveauIdx !== -1 ? cols[niveauIdx] : '').toUpperCase();
          const groupeStr = (groupeIdx !== -1 ? cols[groupeIdx] : 'A').toUpperCase();

          studentsPayload.push({
            matricule,
            lastName: nom.toUpperCase(),
            firstName: prenom,
            programId: filiereStr.includes('GC') ? 'prog-gc' : filiereStr.includes('GEI') ? 'prog-gei' : 'prog-gi',
            levelId: niveauStr.includes('1') ? 'lvl-l1' : niveauStr.includes('3') ? 'lvl-l3' : 'lvl-l2',
            classGroup: groupeStr || 'A',
            email: emailIdx !== -1 ? cols[emailIdx] : undefined,
            phone: phoneIdx !== -1 ? cols[phoneIdx] : undefined,
          });
        }
      }

      if (studentsPayload.length === 0) {
        throw new Error('Aucun étudiant valide n\'a pu être extrait de ce fichier.');
      }

      // Upsert dans le storage local et Firestore
      const res = await storage.batchUpsertStudents(studentsPayload);
      setImportStats(res);
      showToast(`Import terminé : ${res.created} nouveaux inscrits, ${res.updated} actualisés.`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Erreur lors du traitement du fichier.', 'error');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Téléchargement du script d'automatisation pour le technicien de l'école
  const handleDownloadSyncScript = () => {
    const pythonScript = `#!/usr/bin/env python3
# =========================================================================
# SCRIPT DE SYNCHRONISATION AUTOMATIQUE DES ÉTUDIANTS - INSTITUT ISGG
# =========================================================================
# Ce script lit la base de données locale du logiciel de l'école
# ou un fichier CSV/Excel exporté, puis pousse les données vers l'API ISGG.
#
# Pré-requis : pip install requests
# =========================================================================

import json
import requests
import sys

# Configuration de votre instance
API_URL = "https://${typeof window !== 'undefined' ? window.location.host : 'localhost:3000'}/api/v1/sync/students"
API_KEY = "${apiKey}"

# Exemple de liste d'étudiants (peut être lu depuis une base SQL locale ou un fichier CSV)
sample_students = [
    {
        "matricule": "ISGG-2026-901",
        "lastName": "TOSSOU",
        "firstName": "Aubin",
        "programCode": "GI",
        "levelCode": "L2",
        "classGroup": "A",
        "email": "aubin.tossou@isgg-edu.com",
        "phone": "+229 97 00 11 22"
    }
]

def sync():
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    print(f"[ISGG-SYNC] Envoi de {len(sample_students)} étudiant(s) vers {API_URL}...")
    try:
        response = requests.post(API_URL, json=sample_students, headers=headers, timeout=15)
        if response.status_code == 200:
            print("[ISGG-SYNC] Succès !", response.json())
        else:
            print(f"[ISGG-SYNC] Erreur HTTP {response.status_code}:", response.text)
    except Exception as e:
        print("[ISGG-SYNC] Échec de connexion:", e)

if __name__ == "__main__":
    sync()
`;

    const blob = new Blob([pythonScript], { type: 'text/x-python;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'isgg_sync_connector.py');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Script de synchronisation Python téléchargé !', 'success');
  };

  // Téléchargement d'un modèle CSV type
  const handleDownloadCsvTemplate = () => {
    const csvContent = `matricule,nom,prenom,filiere,niveau,groupe,email,telephone
ISGG-2026-101,ADANHO,Koffi Marc,GI,L2,A,koffi.adanho@isgg-edu.com,+229 97 12 34 56
ISGG-2026-102,BIOKOU,Christian,GI,L2,A,c.biokou@isgg-edu.com,+229 96 45 67 89
ISGG-2026-103,DOSSA,Mariette,GC,L1,B,mariette.dossa@isgg-edu.com,+229 95 78 90 12
`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'modele_etudiants_isgg.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Modèle CSV exemple téléchargé', 'success');
  };

  const currentHost = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  return (
    <div className="space-y-6">
      {/* HEADER EXPLICATIF */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-orange-950 text-white shadow-sm border border-slate-700/60">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-[#EA580C] text-white text-[10px] font-black uppercase tracking-wider">
                Le Pont Invisible ISGG
              </span>
              <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                API REST En Ligne
              </span>
            </div>
            <h2 className="text-xl font-black tracking-tight text-white">
              Connecteur Universel du Logiciel de Scolarité
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Connectez le logiciel de l&apos;école (qu&apos;il soit installé sur un ordinateur local, sur un serveur interne ou sur Internet) 
              sans bouleverser leurs habitudes quotidiennes. À chaque nouvelle inscription ou mise à jour, les étudiants sont synchronisés en temps réel.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handleDownloadSyncScript}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-1.5 border border-white/20 cursor-pointer shadow-xs"
            >
              <Terminal className="w-4 h-4 text-orange-400" />
              <span>Télécharger le script de synchro (.py)</span>
            </button>
            <button
              onClick={handleDownloadCsvTemplate}
              className="px-3.5 py-2 rounded-xl bg-[#EA580C] hover:bg-[#D94600] text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Modèle CSV / Excel</span>
            </button>
          </div>
        </div>

        {/* STATUT DERNIÈRE SYNCHRO */}
        <div className="mt-5 pt-4 border-t border-slate-700/60 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/40">
            <span className="text-[11px] text-slate-400 block font-medium">Mécanisme d&apos;inscription</span>
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5 mt-0.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Upsert Intelligent (Matricule unique)
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/40">
            <span className="text-[11px] text-slate-400 block font-medium">Historique des Absences</span>
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5 mt-0.5">
              <Database className="w-3.5 h-3.5 text-orange-400" />
              100% Préservé lors des mises à jour
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/40">
            <span className="text-[11px] text-slate-400 block font-medium">Dernière synchronisation</span>
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5 mt-0.5">
              <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
              {settings.lastSyncAt 
                ? new Date(settings.lastSyncAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                : 'En attente du premier flux'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLONNE GAUCHE: CLÉ API & ENDPOINTS (7 COLS) */}
        <div className="lg:col-span-7 space-y-6">
          {/* SECTION 1: CLÉ D'AUTHENTIFICATION API */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-orange-50 text-[#EA580C]">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Clé Secrète de Synchronisation (API Key)</h3>
                  <p className="text-xs text-slate-500">Transmettez cette clé au responsable informatique ou au logiciel de l&apos;école</p>
                </div>
              </div>
              <button
                onClick={handleRegenerateKey}
                title="Générer une nouvelle clé"
                className="text-xs text-slate-500 hover:text-slate-800 font-semibold flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Régénérer</span>
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
              <div className="font-mono text-xs font-bold text-slate-800 break-all select-all">
                {apiKey}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleCopyKey}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    isCopied ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 shadow-xs'
                  }`}
                >
                  {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopied ? 'Copié !' : 'Copier'}</span>
                </button>
                <button
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#EA580C] hover:bg-[#D94600] text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>{isTesting ? 'Test...' : 'Tester le flux'}</span>
                </button>
              </div>
            </div>

            {testResult && (
              <div className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                testResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>

          {/* SECTION 2: GUIDE D'INTÉGRATION TECHNIQUE */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <Code2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Documentation de l&apos;API REST</h3>
                  <p className="text-xs text-slate-500">Exemples de code pour automatiser l&apos;envoi depuis leur système</p>
                </div>
              </div>
            </div>

            {/* SÉLECTEUR DE LANGAGE */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
              {(['curl', 'python', 'node', 'powershell'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setGuideMode(mode)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${
                    guideMode === mode ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {mode === 'curl' ? 'cURL' : mode === 'python' ? 'Python' : mode === 'node' ? 'Node.js' : 'PowerShell'}
                </button>
              ))}
            </div>

            {/* CODE BLOCK */}
            <div className="relative rounded-xl bg-slate-900 p-4 font-mono text-[11px] text-slate-200 overflow-x-auto">
              <button
                onClick={() => {
                  let textToCopy = '';
                  if (guideMode === 'curl') {
                    textToCopy = `curl -X POST "${currentHost}/api/v1/sync/students" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '[
    {
      "matricule": "ISGG-2026-880",
      "lastName": "HOUNKPE",
      "firstName": "Arnaud",
      "programCode": "GI",
      "levelCode": "L2",
      "classGroup": "A",
      "email": "a.hounkpe@isgg-edu.com"
    }
  ]'`;
                  } else if (guideMode === 'python') {
                    textToCopy = `import requests

url = "${currentHost}/api/v1/sync/students"
headers = {"Authorization": "Bearer ${apiKey}"}
data = [
    {
        "matricule": "ISGG-2026-880",
        "lastName": "HOUNKPE",
        "firstName": "Arnaud",
        "programCode": "GI",
        "levelCode": "L2",
        "classGroup": "A"
    }
]

res = requests.post(url, json=data, headers=headers)
print(res.json())`;
                  } else if (guideMode === 'node') {
                    textToCopy = `const res = await fetch("${currentHost}/api/v1/sync/students", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${apiKey}",
    "Content-Type": "application/json"
  },
  body: JSON.stringify([
    {
      matricule: "ISGG-2026-880",
      lastName: "HOUNKPE",
      firstName: "Arnaud",
      programCode: "GI",
      levelCode: "L2",
      classGroup: "A"
    }
  ])
});
console.log(await res.json());`;
                  } else {
                    textToCopy = `$body = @(
    @{
        matricule = "ISGG-2026-880"
        lastName = "HOUNKPE"
        firstName = "Arnaud"
        programCode = "GI"
        levelCode = "L2"
        classGroup = "A"
    }
) | ConvertTo-Json

Invoke-RestMethod -Uri "${currentHost}/api/v1/sync/students" -Method Post -Headers @{ Authorization = "Bearer ${apiKey}" } -Body $body -ContentType "application/json"`;
                  }
                  navigator.clipboard.writeText(textToCopy);
                  showToast('Exemple de code copié', 'success');
                }}
                className="absolute top-2.5 right-2.5 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 flex items-center gap-1 border border-slate-700 transition-colors cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>Copier</span>
              </button>

              <pre className="pr-12 whitespace-pre-wrap">
                {guideMode === 'curl' && `curl -X POST "${currentHost}/api/v1/sync/students" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '[
    {
      "matricule": "ISGG-2026-880",
      "lastName": "HOUNKPE",
      "firstName": "Arnaud",
      "programCode": "GI",
      "levelCode": "L2",
      "classGroup": "A",
      "email": "a.hounkpe@isgg-edu.com"
    }
  ]'`}

                {guideMode === 'python' && `import requests

url = "${currentHost}/api/v1/sync/students"
headers = {"Authorization": "Bearer ${apiKey}"}
data = [
    {
        "matricule": "ISGG-2026-880",
        "lastName": "HOUNKPE",
        "firstName": "Arnaud",
        "programCode": "GI",
        "levelCode": "L2",
        "classGroup": "A"
    }
]

res = requests.post(url, json=data, headers=headers)
print(res.json())`}

                {guideMode === 'node' && `const res = await fetch("${currentHost}/api/v1/sync/students", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${apiKey}",
    "Content-Type": "application/json"
  },
  body: JSON.stringify([
    {
      matricule: "ISGG-2026-880",
      lastName: "HOUNKPE",
      firstName: "Arnaud",
      programCode: "GI",
      levelCode: "L2",
      classGroup: "A"
    }
  ])
});
console.log(await res.json());`}

                {guideMode === 'powershell' && `$body = @(
    @{
        matricule = "ISGG-2026-880"
        lastName = "HOUNKPE"
        firstName = "Arnaud"
        programCode = "GI"
        levelCode = "L2"
        classGroup = "A"
    }
) | ConvertTo-Json

Invoke-RestMethod -Uri "${currentHost}/api/v1/sync/students" -Method Post -Headers @{ Authorization = "Bearer ${apiKey}" } -Body $body -ContentType "application/json"`}
              </pre>
            </div>

            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>
                <strong>Format accepté :</strong> Objet unique ou tableau JSON d&apos;étudiants. Le champ <code>matricule</code> sert de clé pivot.
              </span>
            </div>
          </div>
        </div>

        {/* COLONNE DROITE: IMPORT MANUEL SANS CONNEXION & FAQ (5 COLS) */}
        <div className="lg:col-span-5 space-y-6">
          {/* IMPORT PAS À PAS (POUR PLATEFORME HORS-LIGNE) */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Import de Fichier (CSV ou JSON)</h3>
                <p className="text-xs text-slate-500">Idéal si leur logiciel est hors-ligne ou exporte un tableau</p>
              </div>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileProcess(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`p-6 rounded-2xl border-2 border-dashed transition-all text-center cursor-pointer ${
                dragOver 
                  ? 'border-[#EA580C] bg-orange-50/50' 
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json,.txt"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileProcess(e.target.files[0]);
                  }
                }}
              />
              <div className="w-10 h-10 rounded-full bg-white shadow-xs border border-slate-200/80 flex items-center justify-center mx-auto mb-2 text-slate-600">
                {isImporting ? <RefreshCw className="w-5 h-5 animate-spin text-[#EA580C]" /> : <Upload className="w-5 h-5 text-slate-600" />}
              </div>
              <p className="text-xs font-bold text-slate-800">
                {isImporting ? 'Traitement en cours...' : 'Glissez le fichier exporté ici ou cliquez'}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Fichiers CSV (séparateur virgule ou point-virgule) ou JSON
              </p>
            </div>

            {importStats && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Rapport d&apos;importation réussi</span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                  <div>Total : <strong>{importStats.total}</strong></div>
                  <div>Créés : <strong>{importStats.created}</strong></div>
                  <div>Mis à jour : <strong>{importStats.updated}</strong></div>
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                onClick={handleDownloadCsvTemplate}
                className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Télécharger le modèle type pour l&apos;école</span>
              </button>
            </div>
          </div>

          {/* RÉPONSES AUX 2 QUESTIONS MAJEURES */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-[#EA580C]" />
              <span>Garanties & Fonctionnement</span>
            </h4>

            <div className="space-y-2.5 text-xs text-slate-600 leading-relaxed">
              <div className="p-2.5 rounded-xl bg-white border border-slate-200/60 space-y-1">
                <span className="font-bold text-slate-800 flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-blue-600" />
                  Et si la plateforme de l&apos;école n&apos;est pas en ligne ?
                </span>
                <p className="text-[11px] text-slate-500">
                  Leur logiciel local peut envoyer les données vers cette API car lui seul a besoin d&apos;un accès sortant. 
                  S&apos;ils n&apos;ont temporairement aucun Internet, l&apos;import CSV ci-dessus prend le relais sans aucun blocage.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-slate-200/60 space-y-1">
                <span className="font-bold text-slate-800 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-orange-600" />
                  Qu&apos;advient-il des étudiants déjà enregistrés ?
                </span>
                <p className="text-[11px] text-slate-500">
                  L&apos;algorithme Upsert vérifie le matricule : si l&apos;étudiant existe déjà, ses informations sont simplement rafraîchies. 
                  Toutes ses absences passées, justificatifs et convocations restent strictement intacts.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
