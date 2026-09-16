import React, { useState, useMemo, useEffect } from 'react';
import { 
  Shield, 
  Users, 
  Building, 
  BookOpen, 
  UserCheck, 
  Calendar, 
  Settings, 
  Plus, 
  Edit, 
  Trash2, 
  Check, 
  X, 
  AlertCircle,
  Sparkles,
  KeyRound,
  Copy,
  Lock,
  ShieldCheck,
  UserX,
  AlertTriangle,
  RotateCcw,
  Mail,
  Send,
  Server,
  RefreshCw
} from 'lucide-react';
import { storage } from '../../lib/storage';
import { rateLimiter } from '../../lib/rateLimiter';
import { User, Program, Subject, Level } from '../../types';
import { useToast } from '../common/Toast';
import { IntegrationHubTab } from './IntegrationHubTab';
import { Network } from 'lucide-react';

interface AdminViewProps {
  currentUser: User;
}

const getUserInitials = (name?: string): string => {
  if (!name) return 'IS';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const AdminView: React.FC<AdminViewProps> = ({ currentUser }) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'students' | 'integration' | 'programs' | 'subjects' | 'users' | 'school-year'>('students');

  // Programs & Levels
  const [programs, setPrograms] = useState<Program[]>(storage.getAllPrograms());
  const levels = useMemo(() => storage.getLevels(), []);
  const [subjects, setSubjects] = useState<Subject[]>(storage.getAllSubjects());
  const [users, setUsers] = useState<User[]>(storage.getUsers());
  const [studentsList, setStudentsList] = useState(storage.getStudents());

  // Security Codes state
  const [securityCodes, setSecurityCodes] = useState(storage.getSecurityCodes());
  const [isEditingCodes, setIsEditingCodes] = useState(false);
  const [editSurvCode, setEditSurvCode] = useState(securityCodes.surveillantCode);
  const [editDirCode, setEditDirCode] = useState(securityCodes.directorCode);
  const [copiedKey, setCopiedKey] = useState<'surv' | 'dir' | null>(null);

  // Institutional SMTP Server State
  const [smtpConfig, setSmtpConfig] = useState<{
    isConfigured: boolean;
    host: string;
    port: number;
    user: string;
    fromName: string;
    updatedAt?: string | null;
  } | null>(null);
  const [isLoadingSmtp, setIsLoadingSmtp] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState(currentUser.email || 'isggabsence@gmail.com');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailFeedback, setTestEmailFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const [isEditingSmtp, setIsEditingSmtp] = useState(false);
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState(465);
  const [smtpUser, setSmtpUser] = useState('isggabsence@gmail.com');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFromName, setSmtpFromName] = useState('ISGG Institut Supérieur de Génie Civil et de Gestion');
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);
  const [smtpSaveError, setSmtpSaveError] = useState<string | null>(null);

  // Editing Program Groups modal/panel state
  const [editingProgramGroupsId, setEditingProgramGroupsId] = useState<string | null>(null);
  const [customGroupInput, setCustomGroupInput] = useState('');

  // Program Creation & Edition state
  const [isAddingProgram, setIsAddingProgram] = useState(false);
  const [newProgramName, setNewProgramName] = useState('');
  const [newProgramCode, setNewProgramCode] = useState('');
  const [newProgramDesc, setNewProgramDesc] = useState('');

  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [editProgramName, setEditProgramName] = useState('');
  const [editProgramCode, setEditProgramCode] = useState('');
  const [editProgramDesc, setEditProgramDesc] = useState('');

  // Editing Student Group modal/panel state
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [studentEditGroup, setStudentEditGroup] = useState('A');

  // Form states for New Student
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [newMatricule, setNewMatricule] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newFirstName, setNewFirstName] = useState('');
  const [newProgramId, setNewProgramId] = useState(programs[0]?.id || 'prog-gi');
  const [newLevelId, setNewLevelId] = useState(levels[0]?.id || 'lvl-l1');
  const [newClassGroup, setNewClassGroup] = useState('A');

  // Refresh helper
  const refreshData = () => {
    setPrograms([...storage.getAllPrograms()]);
    setStudentsList([...storage.getStudents()]);
    setSubjects([...storage.getAllSubjects()]);
    setUsers([...storage.getUsers()]);
    setSecurityCodes(storage.getSecurityCodes());
  };

  useEffect(() => {
    const unsub = storage.subscribe(() => {
      setUsers([...storage.getUsers()]);
      const updatedCodes = storage.getSecurityCodes();
      setSecurityCodes(updatedCodes);
      setEditSurvCode(updatedCodes.surveillantCode);
      setEditDirCode(updatedCodes.directorCode);
      setPrograms([...storage.getAllPrograms()]);
      setStudentsList([...storage.getStudents()]);
      setSubjects([...storage.getAllSubjects()]);
    });
    return () => unsub();
  }, []);

  const handleCopyCode = (code: string, type: 'surv' | 'dir') => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => {
        setCopiedKey(type);
        showToast('Clé d\'habilitation copiée dans le presse-papier !', 'success');
        setTimeout(() => setCopiedKey(null), 2500);
      }).catch(() => {
        showToast(`Code : ${code}`, 'info');
      });
    } else {
      showToast(`Code : ${code}`, 'info');
    }
  };

  const handleSaveCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await storage.updateSecurityCodes({
      surveillantCode: editSurvCode.trim(),
      directorCode: editDirCode.trim(),
    });
    if (res.success) {
      showToast(res.message, 'success');
      setIsEditingCodes(false);
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleToggleUserStatus = (userId: string) => {
    if (userId === currentUser.id) {
      showToast('Action impossible : vous ne pouvez pas suspendre votre propre session active.', 'error');
      return;
    }
    const res = storage.toggleUserStatus(userId);
    if (res.success) {
      showToast(res.message, 'info');
    } else {
      showToast(res.message, 'error');
    }
  };

  // Fetch SMTP config from backend
  const fetchSmtpConfig = async () => {
    setIsLoadingSmtp(true);
    try {
      const res = await fetch('/api/admin/smtp');
      const data = await res.json();
      if (data.success && data.config) {
        setSmtpConfig(data.config);
        if (data.config.user) setSmtpUser(data.config.user);
        if (data.config.host) setSmtpHost(data.config.host);
        if (data.config.port) setSmtpPort(data.config.port);
        if (data.config.fromName) setSmtpFromName(data.config.fromName);
      }
    } catch (err) {
      console.warn('Erreur chargement SMTP config:', err);
    } finally {
      setIsLoadingSmtp(false);
    }
  };

  useEffect(() => {
    fetchSmtpConfig();
  }, []);

  const handleSendTestEmail = async () => {
    if (!testEmailAddress || !testEmailAddress.includes('@')) {
      showToast('Veuillez renseigner une adresse email valide pour le test.', 'error');
      return;
    }
    setIsSendingTestEmail(true);
    setTestEmailFeedback(null);
    try {
      const res = await fetch('/api/admin/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetEmail: testEmailAddress.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setTestEmailFeedback({ success: true, message: data.message });
        showToast('Email de test officiel expédié avec succès !', 'success');
      } else {
        setTestEmailFeedback({ success: false, message: data.error || 'Échec de l\'envoi de test.' });
        showToast(data.error || 'Échec du test SMTP', 'error');
      }
    } catch {
      setTestEmailFeedback({ success: false, message: 'Erreur de connexion au serveur.' });
      showToast('Erreur lors de l\'envoi du test SMTP.', 'error');
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smtpUser || !smtpPass) {
      setSmtpSaveError('L\'adresse email SMTP et le mot de passe d\'application sont obligatoires.');
      return;
    }
    setIsSavingSmtp(true);
    setSmtpSaveError(null);
    try {
      const res = await fetch('/api/admin/smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: smtpHost.trim(),
          port: Number(smtpPort),
          user: smtpUser.trim(),
          pass: smtpPass.trim(),
          fromName: smtpFromName.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Configuration SMTP validée et enregistrée en production !', 'success');
        setIsEditingSmtp(false);
        setSmtpPass('');
        fetchSmtpConfig();
      } else {
        setSmtpSaveError(data.error || 'Erreur lors de la configuration SMTP.');
        showToast(data.error || 'Erreur enregistrement SMTP', 'error');
      }
    } catch {
      setSmtpSaveError('Erreur de communication avec le serveur.');
      showToast('Erreur réseau lors de la mise à jour SMTP.', 'error');
    } finally {
      setIsSavingSmtp(false);
    }
  };

  // Form states for New Subject
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectCode, setNewSubjectCode] = useState('');
  const [newSubjectTeacher, setNewSubjectTeacher] = useState('');
  const [newSubjectProgramId, setNewSubjectProgramId] = useState(programs[0]?.id || 'prog-gi');
  const [newSubjectLevelId, setNewSubjectLevelId] = useState(levels[0]?.id || 'lvl-l2');

  // If user is not admin, show permission notice with quick test switch
  if (currentUser.role !== 'ADMIN') {
    return (
      <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center max-w-lg mx-auto space-y-4 my-12 shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
          <Shield className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Espace réservé à la Direction</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Votre compte actuel ({currentUser.name}) dispose du rôle <strong>SURVEILLANT</strong>. Les fonctions d&apos;administration, de paramétrage des filières et de gestion des comptes sont réservées aux administrateurs.
        </p>
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 font-medium">
          Pour accéder aux réglages et à la gestion des filières, veuillez vous connecter avec les identifiants d&apos;un compte Directeur/Administrateur.
        </div>
      </div>
    );
  }

  // Handle Add Student
  const handleCreateStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLastName.trim() || !newFirstName.trim() || !newMatricule.trim()) {
      showToast('Veuillez remplir tous les champs obligatoires', 'error');
      return;
    }

    try {
      storage.saveStudent({
        matricule: newMatricule.trim().toUpperCase(),
        lastName: newLastName.trim().toUpperCase(),
        firstName: newFirstName.trim(),
        programId: newProgramId,
        levelId: newLevelId,
        classGroup: (newClassGroup || 'A').trim().toUpperCase(),
        isActive: true,
      });

      refreshData();
      showToast(`Étudiant ${newLastName.toUpperCase()} ${newFirstName} (Classe ${newClassGroup}) ajouté avec succès`, 'success');
      setIsAddingStudent(false);
      setNewMatricule('');
      setNewLastName('');
      setNewFirstName('');
      setNewClassGroup('A');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      showToast(msg, 'error');
    }
  };

  // Handle Quick Student Group Change
  const handleUpdateStudentGroup = (studentId: string, group: string) => {
    const cleanGroup = (group || 'A').trim().toUpperCase();
    const stu = storage.getStudentById(studentId);
    if (!stu) return;

    storage.saveStudent({
      id: stu.id,
      matricule: stu.matricule,
      lastName: stu.lastName,
      firstName: stu.firstName,
      programId: stu.programId,
      levelId: stu.levelId,
      classGroup: cleanGroup,
      email: stu.email,
      phone: stu.phone,
      avatarUrl: stu.avatarUrl,
      isActive: stu.isActive,
    });

    refreshData();
    setEditingStudentId(null);
    showToast(`Classe de ${stu.lastName} ${stu.firstName} mise à jour : Groupe ${cleanGroup}`, 'success');
  };

  // Add group to program (e.g. adding 'C' to Génie Informatique or another filière)
  const handleAddGroupToProgram = (programId: string, groupToAdd: string) => {
    const cleanGroup = groupToAdd.trim().toUpperCase();
    if (!cleanGroup) return;

    const currentGroups = storage.getProgramGroups(programId);
    if (currentGroups.includes(cleanGroup)) {
      showToast(`Le groupe ${cleanGroup} existe déjà pour cette filière`, 'info');
      return;
    }

    const updated = [...currentGroups, cleanGroup].sort();
    storage.setProgramGroups(programId, updated);
    refreshData();
    setCustomGroupInput('');
    showToast(`Groupe ${cleanGroup} ajouté avec succès à la filière`, 'success');
  };

  // Remove group from program
  const handleRemoveGroupFromProgram = (programId: string, groupToRemove: string) => {
    const currentGroups = storage.getProgramGroups(programId);
    if (currentGroups.length <= 1) {
      showToast('Une filière doit conserver au minimum un groupe (ex: A)', 'error');
      return;
    }

    const updated = currentGroups.filter(g => g !== groupToRemove);
    storage.setProgramGroups(programId, updated);
    refreshData();
    showToast(`Groupe ${groupToRemove} retiré de la filière`, 'info');
  };

  // Program Management Handlers
  const handleCreateProgram = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newProgramName.trim();
    const cleanCode = newProgramCode.trim().toUpperCase();

    if (!cleanName || !cleanCode) {
      showToast('Veuillez renseigner le nom complet et les initiales de la filière.', 'error');
      return;
    }

    const existingCode = programs.find(p => p.code.toUpperCase() === cleanCode);
    if (existingCode) {
      showToast(`Une filière avec les initiales "${cleanCode}" existe déjà (${existingCode.name}).`, 'error');
      return;
    }

    const created = storage.saveProgram({
      name: cleanName,
      code: cleanCode,
      description: newProgramDesc.trim() || `Filière d'études supérieures ${cleanCode} à l'ISGG`,
      availableGroups: ['A', 'B'],
    });

    refreshData();
    setIsAddingProgram(false);
    setNewProgramName('');
    setNewProgramCode('');
    setNewProgramDesc('');
    showToast(`Filière ${created.name} (${created.code}) ajoutée avec succès !`, 'success');
  };

  const handleStartEditProgram = (prog: Program) => {
    setEditingProgramId(prog.id);
    setEditProgramName(prog.name);
    setEditProgramCode(prog.code);
    setEditProgramDesc(prog.description || '');
  };

  const handleCancelEditProgram = () => {
    setEditingProgramId(null);
    setEditProgramName('');
    setEditProgramCode('');
    setEditProgramDesc('');
  };

  const handleSaveEditProgram = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProgramId) return;

    const cleanName = editProgramName.trim();
    const cleanCode = editProgramCode.trim().toUpperCase();

    if (!cleanName || !cleanCode) {
      showToast('Le nom et les initiales ne peuvent pas être vides.', 'error');
      return;
    }

    const existingOther = programs.find(p => p.id !== editingProgramId && p.code.toUpperCase() === cleanCode);
    if (existingOther) {
      showToast(`Une autre filière utilise déjà les initiales "${cleanCode}" (${existingOther.name}).`, 'error');
      return;
    }

    storage.saveProgram({
      id: editingProgramId,
      name: cleanName,
      code: cleanCode,
      description: editProgramDesc.trim(),
    });

    refreshData();
    setEditingProgramId(null);
    showToast(`Filière mise à jour : ${cleanCode} - ${cleanName}`, 'success');
  };

  const handleDeleteProgram = (prog: Program) => {
    const studentCount = studentsList.filter(s => s.programId === prog.id).length;
    if (studentCount > 0) {
      showToast(`Action bloquée : ${studentCount} étudiant(s) sont inscrits en filière ${prog.code}. Réaffectez-les avant suppression.`, 'error');
      return;
    }

    if (window.confirm(`Confirmez-vous la suppression définitive de la filière "${prog.name} (${prog.code})" ?`)) {
      const res = storage.deleteProgram(prog.id);
      if (res.success) {
        refreshData();
        showToast(`Filière ${prog.code} supprimée avec succès.`, 'info');
      } else {
        showToast(res.message || 'Erreur lors de la suppression.', 'error');
      }
    }
  };

  // Handle Add Subject
  const handleCreateSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim() || !newSubjectCode.trim()) {
      showToast('Veuillez remplir le nom et le code matière', 'error');
      return;
    }

    storage.saveSubject({
      name: newSubjectName.trim(),
      code: newSubjectCode.trim().toUpperCase(),
      teacherName: newSubjectTeacher.trim() || 'Enseignant non désigné',
      programId: newSubjectProgramId,
      levelId: newSubjectLevelId,
    });

    setSubjects(storage.getAllSubjects());
    showToast(`Matière ${newSubjectName} enregistrée`, 'success');
    setIsAddingSubject(false);
    setNewSubjectName('');
    setNewSubjectCode('');
    setNewSubjectTeacher('');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
              Administration ISGG
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800">
              Directeur
            </span>
          </div>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Gestion du référentiel académique, des matières, des filières et des utilisateurs
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-2xl p-2 border border-slate-200/80 shadow-xs flex items-center gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('students')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'students' ? 'bg-[#EA580C] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Gestion des Étudiants</span>
        </button>

        <button
          onClick={() => setActiveTab('integration')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'integration' ? 'bg-[#EA580C] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Network className="w-4 h-4" />
          <span className="flex items-center gap-1.5">
            <span>Intégration & API</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          </span>
        </button>

        <button
          onClick={() => setActiveTab('programs')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'programs' ? 'bg-[#EA580C] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Filières ISGG ({programs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('subjects')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'subjects' ? 'bg-[#EA580C] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Matières ({subjects.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'users' ? 'bg-[#EA580C] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Utilisateurs & Rôles ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('school-year')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'school-year' ? 'bg-[#EA580C] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Année académique</span>
        </button>
      </div>

      {/* TAB 1: GESTION DES ÉTUDIANTS */}
      {activeTab === 'students' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Enrôlement et inscription des étudiants</h3>
              <p className="text-xs text-slate-500">Ajoutez manuellement ou importez de nouveaux apprenants</p>
            </div>
            <button
              onClick={() => setIsAddingStudent(!isAddingStudent)}
              className="px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#D94600] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isAddingStudent ? 'Annuler' : 'Ajouter un étudiant'}</span>
            </button>
          </div>

          {/* Add Student Form Drawer */}
          {isAddingStudent && (
            <form onSubmit={handleCreateStudent} className="p-5 rounded-2xl bg-orange-50/50 border border-orange-200/80 space-y-4 animate-in fade-in">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#EA580C]">Nouvelle inscription</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Matricule ISGG *</label>
                  <input
                    type="text"
                    required
                    value={newMatricule}
                    onChange={e => setNewMatricule(e.target.value)}
                    placeholder="ex: ISGG-2024-099"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nom de famille *</label>
                  <input
                    type="text"
                    required
                    value={newLastName}
                    onChange={e => setNewLastName(e.target.value)}
                    placeholder="ex: SOSSOU"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Prénom(s) *</label>
                  <input
                    type="text"
                    required
                    value={newFirstName}
                    onChange={e => setNewFirstName(e.target.value)}
                    placeholder="ex: Jean-Luc"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Filière</label>
                  <select
                    value={newProgramId}
                    onChange={e => setNewProgramId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    {programs.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Classe / Groupe</label>
                  <select
                    value={newClassGroup}
                    onChange={e => setNewClassGroup(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    {storage.getProgramGroups(newProgramId).map(grp => (
                      <option key={grp} value={grp}>Groupe {grp} (Classe {grp})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Niveau / Année d&apos;étude</label>
                  <select
                    value={newLevelId}
                    onChange={e => setNewLevelId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    {levels.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingStudent(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#EA580C] hover:bg-[#D94600]"
                >
                  Enregistrer l&apos;étudiant
                </button>
              </div>
            </form>
          )}

          {/* Student List with fast Group Re-assignment */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">
                Liste des étudiants inscrits ({studentsList.length})
              </h4>
              <span className="text-[11px] text-slate-500">
                Modifiez la classe (A, B, C...) directement pour chaque étudiant
              </span>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {studentsList.map(stu => {
                const prog = programs.find(p => p.id === stu.programId);
                const lvl = levels.find(l => l.id === stu.levelId);
                const availableGroups = prog ? storage.getProgramGroups(prog.id) : ['A', 'B'];
                const isEditing = editingStudentId === stu.id;

                return (
                  <div key={stu.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center">
                        {stu.lastName.slice(0, 1)}{stu.firstName.slice(0, 1)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs">{stu.lastName} {stu.firstName}</span>
                          <span className="font-mono text-[10px] text-slate-400">({stu.matricule})</span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {prog?.code || 'ISGG'} • {lvl?.name}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 bg-orange-50 border border-[#EA580C] p-1.5 rounded-xl animate-in fade-in">
                          <span className="text-[11px] font-bold text-slate-700 pl-1">Groupe :</span>
                          <select
                            value={studentEditGroup}
                            onChange={e => setStudentEditGroup(e.target.value)}
                            className="bg-white px-2 py-1 rounded text-xs font-bold border border-slate-300"
                          >
                            {availableGroups.map(g => (
                              <option key={g} value={g}>Classe {g}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleUpdateStudentGroup(stu.id, studentEditGroup)}
                            className="p-1 rounded-lg bg-[#EA580C] text-white hover:bg-[#D94600]"
                            title="Valider"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingStudentId(null)}
                            className="p-1 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300"
                            title="Annuler"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-orange-100 text-[#EA580C] border border-orange-200">
                            Classe {stu.classGroup || 'A'}
                          </span>
                          <button
                            onClick={() => {
                              setEditingStudentId(stu.id);
                              setStudentEditGroup(stu.classGroup || 'A');
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-[#EA580C] hover:bg-white hover:border-orange-300 text-xs transition-colors cursor-pointer"
                            title="Changer de classe / groupe"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick instructions for import */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
            <span>Importation massive ou synchronisation automatique avec le logiciel de l&apos;école disponible.</span>
            <button
              onClick={() => setActiveTab('integration')}
              className="font-bold text-[#EA580C] hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>Accéder au Connecteur & API</span>
              <span>→</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB INTÉGRATION & API (LE PONT INVISIBLE) */}
      {activeTab === 'integration' && (
        <IntegrationHubTab />
      )}

      {/* TAB 2: FILIÈRES */}
      {activeTab === 'programs' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-[#EA580C]" />
                <h3 className="text-base font-bold text-slate-900">Filières académiques de l&apos;ISGG</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Consultez la liste des filières et leurs initiales, modifiez leurs dénominations ou ajoutez une nouvelle filière à l&apos;école.
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-xs font-bold text-[#EA580C] bg-orange-50 px-3 py-1.5 rounded-xl border border-orange-200 whitespace-nowrap">
                {programs.length} filières actives
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsAddingProgram(!isAddingProgram);
                  if (editingProgramId) setEditingProgramId(null);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-[#EA580C] hover:bg-[#D94600] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer whitespace-nowrap"
              >
                {isAddingProgram ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span>{isAddingProgram ? 'Fermer' : 'Nouvelle filière'}</span>
              </button>
            </div>
          </div>

          {/* Form: Add New Program */}
          {isAddingProgram && (
            <form onSubmit={handleCreateProgram} className="p-5 rounded-2xl bg-orange-50/70 border-2 border-orange-200 space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-2 border-b border-orange-200/60">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#EA580C] text-white flex items-center justify-center font-black text-xs shadow-2xs">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Créer une nouvelle filière pour l&apos;ISGG</h4>
                    <p className="text-[11px] text-slate-500">Ajoutez une filière avec ses initiales officielles et sa description pédagogique</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddingProgram(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Nom complet de la filière *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex: Réseaux & Télécommunications"
                    value={newProgramName}
                    onChange={e => setNewProgramName(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-xl focus:border-[#EA580C] focus:ring-1 focus:ring-[#EA580C] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Initiales / Sigle officiel *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    placeholder="ex: RT, GC, FC, EL..."
                    value={newProgramCode}
                    onChange={e => setNewProgramCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 text-xs font-bold text-slate-900 uppercase bg-white border border-slate-200 rounded-xl focus:border-[#EA580C] focus:ring-1 focus:ring-[#EA580C] outline-none"
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Description pédagogique
                  </label>
                  <input
                    type="text"
                    placeholder="ex: Systèmes réseaux, télécommunications et cybersécurité..."
                    value={newProgramDesc}
                    onChange={e => setNewProgramDesc(e.target.value)}
                    className="w-full px-3 py-2 text-xs text-slate-900 bg-white border border-slate-200 rounded-xl focus:border-[#EA580C] focus:ring-1 focus:ring-[#EA580C] outline-none"
                  />
                </div>
              </div>

              {newProgramCode && (
                <div className="flex items-center gap-2 text-xs text-slate-700 bg-white/90 p-2.5 rounded-xl border border-orange-200/60 shadow-2xs">
                  <span className="font-semibold text-slate-500">Aperçu du badge :</span>
                  <span className="text-xs font-black text-[#EA580C] bg-orange-100 px-2.5 py-0.5 rounded-lg">
                    {newProgramCode.toUpperCase()}
                  </span>
                  <span className="font-bold text-slate-800">{newProgramName || 'Nom de la filière'}</span>
                  <span className="text-[11px] text-slate-400 font-mono ml-auto">Classes par défaut : A, B</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-orange-200/60">
                <button
                  type="button"
                  onClick={() => setIsAddingProgram(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#EA580C] hover:bg-[#D94600] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Enregistrer la filière</span>
                </button>
              </div>
            </form>
          )}

          {/* Programs Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {programs.map(prog => {
              const currentGroups = storage.getProgramGroups(prog.id);
              const isEditingThisProg = editingProgramGroupsId === prog.id;
              const isEditingInfo = editingProgramId === prog.id;
              const enrolledStudentsCount = studentsList.filter(s => s.programId === prog.id).length;

              return (
                <div
                  key={prog.id}
                  className={`p-5 rounded-2xl border transition-all space-y-3.5 ${
                    isEditingInfo 
                      ? 'border-[#EA580C] bg-orange-50/20 shadow-xs' 
                      : 'border-slate-200 hover:border-orange-300 bg-slate-50/50'
                  }`}
                >
                  {/* Top Bar: Initials badge, status, and actions */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-[#EA580C] bg-orange-100 px-2.5 py-1 rounded-lg tracking-wider">
                        {prog.code}
                      </span>
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold border border-emerald-200/60">
                        Active
                      </span>
                      <span className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
                        <Users className="w-3 h-3 text-slate-400" />
                        <span>{enrolledStudentsCount} étudiant{enrolledStudentsCount > 1 ? 's' : ''}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {!isEditingInfo && (
                        <button
                          type="button"
                          onClick={() => handleStartEditProgram(prog)}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:border-orange-300 hover:text-[#EA580C] shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
                          title="Modifier le nom et les initiales"
                        >
                          <Edit className="w-3 h-3 text-slate-500" />
                          <span>Modifier</span>
                        </button>
                      )}

                      {enrolledStudentsCount === 0 && !isEditingInfo && (
                        <button
                          type="button"
                          onClick={() => handleDeleteProgram(prog)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all cursor-pointer"
                          title="Supprimer cette filière"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Form inline edit or standard view */}
                  {isEditingInfo ? (
                    <form onSubmit={handleSaveEditProgram} className="p-3 bg-white rounded-xl border border-orange-200 space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                        <span className="text-xs font-bold text-[#EA580C]">
                          Modifier la filière
                        </span>
                        <span className="text-[10px] text-slate-400">ID: {prog.id}</span>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-0.5">
                            Nom de la filière
                          </label>
                          <input
                            type="text"
                            required
                            value={editProgramName}
                            onChange={e => setEditProgramName(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:border-[#EA580C] outline-none"
                            placeholder="Intitulé complet"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-0.5">
                            Initiales / Sigle
                          </label>
                          <input
                            type="text"
                            required
                            maxLength={10}
                            value={editProgramCode}
                            onChange={e => setEditProgramCode(e.target.value.toUpperCase())}
                            className="w-full px-2.5 py-1.5 text-xs font-bold uppercase text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:border-[#EA580C] outline-none"
                            placeholder="ex: GI"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-0.5">
                            Description
                          </label>
                          <input
                            type="text"
                            value={editProgramDesc}
                            onChange={e => setEditProgramDesc(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:border-[#EA580C] outline-none"
                            placeholder="Description pédagogique"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={handleCancelEditProgram}
                          className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-lg cursor-pointer"
                        >
                          Annuler
                        </button>
                        <button
                          type="submit"
                          className="px-3 py-1.5 bg-[#EA580C] hover:bg-[#D94600] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Enregistrer</span>
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{prog.name}</h4>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{prog.description}</p>
                    </div>
                  )}

                  {/* Program Groups Section */}
                  <div className="pt-2 border-t border-slate-200/70 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-[#EA580C]" />
                        <span>Classes & Groupes paramétrés :</span>
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          if (isEditingThisProg) {
                            setEditingProgramGroupsId(null);
                          } else {
                            setEditingProgramGroupsId(prog.id);
                            setCustomGroupInput('');
                          }
                        }}
                        className="text-xs font-bold text-[#EA580C] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        {isEditingThisProg ? 'Terminer' : 'Gérer les groupes'}
                      </button>
                    </div>

                    {/* Chips for existing groups */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {currentGroups.map(grp => (
                        <div
                          key={grp}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 shadow-2xs text-xs font-bold text-slate-800"
                        >
                          <span>Classe {grp}</span>
                          {isEditingThisProg && currentGroups.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveGroupFromProgram(prog.id, grp)}
                              className="text-slate-400 hover:text-rose-600 cursor-pointer"
                              title={`Supprimer le groupe ${grp}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Editor: Add group A, B, C, D... */}
                    {isEditingThisProg && (
                      <div className="mt-2 p-3 bg-white rounded-xl border border-orange-200 space-y-2 animate-in fade-in">
                        <p className="text-[11px] text-slate-600 font-semibold">
                          Ajouter un groupe ou classe à <strong className="text-slate-900">{prog.name}</strong> :
                        </p>
                        
                        {/* Preset buttons for fast addition */}
                        <div className="flex flex-wrap items-center gap-1">
                          {['A', 'B', 'C', 'D', 'E'].map(quickLetter => {
                            const alreadyHas = currentGroups.includes(quickLetter);
                            return (
                              <button
                                key={quickLetter}
                                type="button"
                                disabled={alreadyHas}
                                onClick={() => handleAddGroupToProgram(prog.id, quickLetter)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                                  alreadyHas
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'bg-orange-50 text-[#EA580C] hover:bg-[#EA580C] hover:text-white border border-orange-200'
                                }`}
                              >
                                + Groupe {quickLetter}
                              </button>
                            );
                          })}
                        </div>

                        {/* Custom input */}
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="text"
                            maxLength={10}
                            placeholder="Autre lettre/intitulé (ex: F, Soir...)"
                            value={customGroupInput}
                            onChange={e => setCustomGroupInput(e.target.value)}
                            className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-bold"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddGroupToProgram(prog.id, customGroupInput)}
                            className="px-3 py-1.5 bg-[#EA580C] hover:bg-[#D94600] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                          >
                            Ajouter
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: MATIÈRES */}
      {activeTab === 'subjects' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Catalogue des matières enseignées</h3>
              <p className="text-xs text-slate-500">Assignation aux filières et enseignants responsables</p>
            </div>
            <button
              onClick={() => setIsAddingSubject(!isAddingSubject)}
              className="px-4 py-2 rounded-xl bg-[#EA580C] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isAddingSubject ? 'Fermer' : 'Nouvelle matière'}</span>
            </button>
          </div>

          {isAddingSubject && (
            <form onSubmit={handleCreateSubject} className="p-4 bg-orange-50/60 rounded-xl border border-orange-200 space-y-3 animate-in fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Intitulé de la matière (ex: Génie Parasismique)"
                  value={newSubjectName}
                  onChange={e => setNewSubjectName(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                />
                <input
                  type="text"
                  required
                  placeholder="Code matière (ex: GP305)"
                  value={newSubjectCode}
                  onChange={e => setNewSubjectCode(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold uppercase"
                />
                <input
                  type="text"
                  placeholder="Enseignant (ex: Dr. Houessou)"
                  value={newSubjectTeacher}
                  onChange={e => setNewSubjectTeacher(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  value={newSubjectProgramId}
                  onChange={e => setNewSubjectProgramId(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                >
                  {programs.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <select
                  value={newSubjectLevelId}
                  onChange={e => setNewSubjectLevelId(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                >
                  {levels.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#EA580C] text-white text-xs font-bold rounded-xl"
                >
                  Ajouter la matière
                </button>
              </div>
            </form>
          )}

          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {subjects.map(sub => {
              const prog = programs.find(p => p.id === sub.programId);
              const lvl = levels.find(l => l.id === sub.levelId);
              return (
                <div key={sub.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    {sub.code && <span className="font-mono font-bold text-[#EA580C] mr-2">{sub.code}</span>}
                    <strong className="text-slate-900 text-sm">{sub.name}</strong>
                    <span className="text-slate-400 ml-2">Enseignant : {sub.teacherName || 'Non assigné'}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                    {prog?.code} • {lvl?.code}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: UTILISATEURS & CLÉS D'HABILITATION */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* SECTION 1: CLÉS D'HABILITATION SECRÈTES ISGG */}
          <div className="bg-white rounded-2xl p-6 border border-orange-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#EA580C] flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    Clés d&apos;habilitation secrètes ISGG
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-orange-50 text-[#EA580C] border border-orange-200">
                      Protection Inscriptions
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Ces codes secrets sont obligatoires pour créer un compte Surveillant ou Directeur sur la page d&apos;accueil.
                  </p>
                </div>
              </div>

              {!isEditingCodes ? (
                <button
                  onClick={() => {
                    setEditSurvCode(securityCodes.surveillantCode);
                    setEditDirCode(securityCodes.directorCode);
                    setIsEditingCodes(true);
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer w-fit"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Modifier les clés</span>
                </button>
              ) : (
                <button
                  onClick={() => setIsEditingCodes(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors flex items-center gap-1 cursor-pointer w-fit"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Annuler</span>
                </button>
              )}
            </div>

            {/* Note sur la sécurité */}
            <div className="p-3.5 bg-amber-50/60 border border-amber-200/80 rounded-xl flex items-start gap-2.5 text-xs text-amber-900 leading-relaxed">
              <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong>Sécurité renforcée :</strong> Toute personne disposant du lien du site ne peut pas s&apos;inscrire sans connaître la clé secrète dédiée. Les adresses email professionnelles comme personnelles sont acceptées sans blocage de domaine dès lors que la clé secrète renseignée correspond au rôle sélectionné.
              </div>
            </div>

            {!isEditingCodes ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                {/* Clé Surveillant */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-[#EA580C]" />
                      Profil Surveillant
                    </span>
                    <span className="text-[11px] font-semibold text-orange-700 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                      Vie Scolaire
                    </span>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Clé actuelle requise à l&apos;inscription :</div>
                    <div className="flex items-center justify-between bg-white px-3.5 py-2 rounded-lg border border-slate-200 font-mono font-bold text-sm text-slate-900">
                      <span>{securityCodes.surveillantCode}</span>
                      <button
                        onClick={() => handleCopyCode(securityCodes.surveillantCode, 'surv')}
                        className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer transition-colors p-1 rounded hover:bg-slate-100"
                        title="Copier la clé"
                      >
                        {copiedKey === 'surv' ? (
                          <span className="text-emerald-600 flex items-center gap-1 text-[11px] font-bold">
                            <Check className="w-3.5 h-3.5" /> Copié
                          </span>
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    À transmettre aux surveillants autorisés à saisir les absences.
                  </p>
                </div>

                {/* Clé Directeur */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-slate-900" />
                      Profil Directeur
                    </span>
                    <span className="text-[11px] font-semibold text-slate-800 bg-slate-200/80 px-2 py-0.5 rounded border border-slate-300">
                      Administration
                    </span>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Clé actuelle requise à l&apos;inscription :</div>
                    <div className="flex items-center justify-between bg-white px-3.5 py-2 rounded-lg border border-slate-200 font-mono font-bold text-sm text-slate-900">
                      <span>{securityCodes.directorCode}</span>
                      <button
                        onClick={() => handleCopyCode(securityCodes.directorCode, 'dir')}
                        className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer transition-colors p-1 rounded hover:bg-slate-100"
                        title="Copier la clé"
                      >
                        {copiedKey === 'dir' ? (
                          <span className="text-emerald-600 flex items-center gap-1 text-[11px] font-bold">
                            <Check className="w-3.5 h-3.5" /> Copié
                          </span>
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Strictement confidentielle, réservée aux directeurs de l&apos;ISGG.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveCodes} className="p-4 rounded-xl bg-orange-50/40 border border-orange-200 space-y-4">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Mettre à jour les clés d&apos;habilitation secrètes
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nouvelle clé pour Surveillant
                    </label>
                    <input
                      type="text"
                      required
                      value={editSurvCode}
                      onChange={e => setEditSurvCode(e.target.value)}
                      placeholder="ex: ISGG-SURV-2026"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C]"
                    />
                    <span className="text-[10px] text-slate-500">Min. 4 caractères alphanumériques</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nouvelle clé pour Directeur
                    </label>
                    <input
                      type="text"
                      required
                      value={editDirCode}
                      onChange={e => setEditDirCode(e.target.value)}
                      placeholder="ex: ISGG-DIR-9482"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C]"
                    />
                    <span className="text-[10px] text-slate-500">Min. 6 caractères alphanumériques</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#EA580C] hover:bg-[#D94600] text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
                  >
                    Enregistrer les nouvelles clés
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingCodes(false)}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* SECTION 2: SERVEUR SMTP INSTITUTIONNEL & EXPÉDITION D'EMAILS */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    Serveur SMTP Institutionnel & Expédition des Emails
                    {smtpConfig?.isConfigured ? (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Opérationnel (Firestore)
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                        En attente
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Acheminement en direct des codes OTP d&apos;inscription, réinitialisations de mot de passe et notifications.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchSmtpConfig}
                  disabled={isLoadingSmtp}
                  className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Rafraîchir le statut SMTP"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingSmtp ? 'animate-spin text-[#EA580C]' : ''}`} />
                </button>
                {!isEditingSmtp ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingSmtp(true);
                      setSmtpSaveError(null);
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer w-fit"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Modifier les paramètres SMTP</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingSmtp(false)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors flex items-center gap-1 cursor-pointer w-fit"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Annuler</span>
                  </button>
                )}
              </div>
            </div>

            {!isEditingSmtp ? (
              <div className="space-y-4">
                {/* Carte Statut Actuel */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Compte Expéditeur
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-900 break-all">
                      {smtpConfig?.user || 'isggabsence@gmail.com'}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {smtpConfig?.fromName || 'ISGG Institut Supérieur de Génie Civil et de Gestion'}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Serveur & Port
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-900">
                      {smtpConfig?.host || 'smtp.gmail.com'} : {smtpConfig?.port || 465}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">
                      Chiffrement SSL / TLS sécurisé
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Persistance Cloud
                    </span>
                    <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Firestore Chiffré AES-256
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Persistant sur tous les redéploiements
                    </span>
                  </div>
                </div>

                {/* Boîte de Test d'Envoi en Direct */}
                <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5 text-blue-600" />
                      Tester l&apos;acheminement d&apos;un email en direct
                    </span>
                    <span className="text-[11px] text-blue-700 font-medium">
                      Envoie un email réel de confirmation
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="email"
                      value={testEmailAddress}
                      onChange={e => setTestEmailAddress(e.target.value)}
                      placeholder="votre-adresse@gmail.com"
                      className="flex-1 px-3.5 py-2 bg-white border border-blue-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleSendTestEmail}
                      disabled={isSendingTestEmail}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                    >
                      {isSendingTestEmail ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Expédition en cours...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Envoyer le test</span>
                        </>
                      )}
                    </button>
                  </div>

                  {testEmailFeedback && (
                    <div className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                      testEmailFeedback.success 
                        ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' 
                        : 'bg-rose-50 text-rose-900 border border-rose-200'
                    }`}>
                      {testEmailFeedback.success ? (
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <span>{testEmailFeedback.message}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Formulaire de modification SMTP */
              <form onSubmit={handleSaveSmtp} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-[#EA580C]" />
                    Configuration du Serveur SMTP Institutionnel
                  </h4>
                  <span className="text-[10px] text-slate-500">
                    Les identifiants sont chiffrés en AES-256 dans Firestore
                  </span>
                </div>

                {smtpSaveError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{smtpSaveError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Serveur SMTP (Hôte)
                    </label>
                    <input
                      type="text"
                      required
                      value={smtpHost}
                      onChange={e => setSmtpHost(e.target.value)}
                      placeholder="smtp.gmail.com"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Port SMTP (465 SSL ou 587 TLS)
                    </label>
                    <input
                      type="number"
                      required
                      value={smtpPort}
                      onChange={e => setSmtpPort(Number(e.target.value))}
                      placeholder="465"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Adresse Email Expéditrice (Compte Google / Domaine)
                    </label>
                    <input
                      type="email"
                      required
                      value={smtpUser}
                      onChange={e => setSmtpUser(e.target.value)}
                      placeholder="isggabsence@gmail.com"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Mot de passe d&apos;application Google (16 caractères)
                    </label>
                    <input
                      type="password"
                      required
                      value={smtpPass}
                      onChange={e => setSmtpPass(e.target.value)}
                      placeholder="xxxx xxxx xxxx xxxx"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C]"
                    />
                    <span className="text-[10px] text-slate-500">
                      Généré dans Mon Compte Google &gt; Sécurité &gt; Mots de passe des applications
                    </span>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nom affiché de l&apos;expéditeur
                    </label>
                    <input
                      type="text"
                      required
                      value={smtpFromName}
                      onChange={e => setSmtpFromName(e.target.value)}
                      placeholder="ISGG Institut Supérieur de Génie Civil et de Gestion"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                  <button
                    type="submit"
                    disabled={isSavingSmtp}
                    className="px-4 py-2 bg-[#EA580C] hover:bg-[#D94600] disabled:bg-orange-300 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    {isSavingSmtp ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Vérification & Sauvegarde...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Enregistrer & Vérifier la connexion</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingSmtp(false)}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* SECTION 3: LISTE DU PERSONNEL & GESTION DES COMPTES */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Personnel enregistré & statut d&apos;accès</h3>
                <p className="text-xs text-slate-500">
                  Comptes créés via le formulaire d&apos;inscription sécurisé ou synchronisés avec Firestore.
                </p>
              </div>
              <span className="text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-full">
                {users.length} compte{users.length > 1 ? 's' : ''}
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {users.map(u => {
                const isCurrent = u.id === currentUser.id;
                const isActive = u.isActive !== false;

                return (
                  <div key={u.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div 
                        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-xs text-white shadow-xs border border-white/20 ${
                          u.role === 'ADMIN' ? 'bg-[#EA580C]' : 'bg-slate-800'
                        }`}
                      >
                        {getUserInitials(u.name)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-slate-900">{u.name}</p>
                          {isCurrent && (
                            <span className="text-[10px] font-bold bg-orange-100 text-[#EA580C] px-2 py-0.5 rounded-full">
                              Vous
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">{u.email}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {u.title || (u.role === 'ADMIN' ? 'Directeur' : 'Surveillant')} • Connexion: {u.lastLogin || 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 self-end sm:self-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        u.role === 'ADMIN' ? 'bg-slate-900 text-white' : 'bg-orange-100 text-[#EA580C]'
                      }`}>
                        {u.role === 'ADMIN' ? 'Directeur' : 'Surveillant'}
                      </span>

                      <span className={`text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1 ${
                        isActive 
                          ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' 
                          : 'text-rose-700 bg-rose-50 border border-rose-200'
                      }`}>
                        {isActive ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        {isActive ? 'Actif' : 'Suspendu'}
                      </span>

                      {!isCurrent && (
                        <button
                          onClick={() => handleToggleUserStatus(u.id)}
                          className={`text-xs px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                            isActive
                              ? 'text-rose-600 hover:bg-rose-50 border border-rose-200'
                              : 'text-emerald-600 hover:bg-emerald-50 border border-emerald-200'
                          }`}
                        >
                          {isActive ? 'Suspendre' : 'Réactiver'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 3: CYBERSÉCURITÉ, CHIFFREMENT & GESTION DES IP BANNIES */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center text-[#EA580C]">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Bouclier Anti-BruteForce & Chiffrement</h3>
                  <p className="text-xs text-slate-500">
                    Chiffrement AES-GCM & Hachage SHA-256 au repos. Blocage 5 min après 3 échecs, Bannissement IP après 100 échecs.
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>Protection Active</span>
              </span>
            </div>

            {/* Banned IP Management */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Postes & Adresses IP Révoqués (&gt; 100 échecs)</span>
                </span>
                <span className="text-[11px] font-bold text-slate-500">
                  {rateLimiter.getBannedList().length} IP bannie(s)
                </span>
              </div>

              {rateLimiter.getBannedList().length === 0 ? (
                <p className="text-xs text-slate-500 italic py-1">
                  Aucune adresse IP n&apos;est actuellement bannie. Les contrôles de sécurité fonctionnent nominalement.
                </p>
              ) : (
                <div className="space-y-2">
                  {rateLimiter.getBannedList().map(bannedIp => (
                    <div key={bannedIp} className="flex items-center justify-between p-2.5 bg-white border border-rose-200 rounded-lg text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-rose-700">{bannedIp}</span>
                        <span className="text-[11px] text-slate-500">• Plus de 100 tentatives malveillantes</span>
                      </div>
                      <button
                        onClick={async () => {
                          await rateLimiter.unbanClient(bannedIp);
                          showToast(`L'adresse IP ${bannedIp} a été réhabilitée avec succès.`, 'success');
                          refreshData();
                        }}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Réhabiliter l&apos;IP</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: ANNÉE ACADÉMIQUE */}
      {activeTab === 'school-year' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-slate-900">Configuration de l&apos;année académique</h3>
          <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Année active</span>
              <h4 className="text-2xl font-black text-slate-900 mt-0.5">{storage.getSchoolYear()?.name || '2026-2027'}</h4>
              <p className="text-xs text-slate-600 mt-1">Période du 1er Septembre 2026 au 31 Juillet 2027</p>
              <p className="text-[11px] text-slate-500 mt-1 italic">Cycle académique du Bénin : rentrée en septembre, clôture en juillet au plus tard, nouvelle année annoncée dès août.</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-bold">
              En cours
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
