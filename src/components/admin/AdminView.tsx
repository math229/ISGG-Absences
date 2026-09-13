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
  RotateCcw
} from 'lucide-react';
import { storage } from '../../lib/storage';
import { rateLimiter } from '../../lib/rateLimiter';
import { User, Program, Subject, Level } from '../../types';
import { useToast } from '../common/Toast';

interface AdminViewProps {
  currentUser: User;
}

export const AdminView: React.FC<AdminViewProps> = ({ currentUser }) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'students' | 'programs' | 'subjects' | 'users' | 'school-year'>('students');

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

  // Editing Program Groups modal/panel state
  const [editingProgramGroupsId, setEditingProgramGroupsId] = useState<string | null>(null);
  const [customGroupInput, setCustomGroupInput] = useState('');

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
      showToast('Action impossible : vous ne pouvez pas suspendre votre propre session active.', 'warning');
      return;
    }
    const res = storage.toggleUserStatus(userId);
    if (res.success) {
      showToast(res.message, 'info');
    } else {
      showToast(res.message, 'error');
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
        <button
          onClick={() => storage.switchRole('ADMIN')}
          className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
        >
          Basculer en profil Administrateur (Dr. K. Mensah)
        </button>
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
            <span>Importation massive d&apos;effectifs étudiants disponible au format CSV / Excel standard ISGG.</span>
            <button
              onClick={() => showToast('Gabarit CSV téléchargé (Exemple disponible dans la documentation)', 'info')}
              className="font-bold text-[#EA580C] hover:underline"
            >
              Télécharger gabarit
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: FILIÈRES */}
      {activeTab === 'programs' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900">Filières académiques et gestion des groupes / classes</h3>
              <p className="text-xs text-slate-500">
                Configurez les divisions en classes (A, B, C...) pour la Génie Informatique et toute autre filière
              </p>
            </div>
            <span className="text-xs font-bold text-[#EA580C] bg-orange-50 px-3 py-1.5 rounded-xl border border-orange-200">
              {programs.length} filières actives
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {programs.map(prog => {
              const currentGroups = storage.getProgramGroups(prog.id);
              const isEditingThisProg = editingProgramGroupsId === prog.id;

              return (
                <div key={prog.id} className="p-5 rounded-2xl border border-slate-200 hover:border-orange-300 transition-all bg-slate-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-[#EA580C] bg-orange-100 px-2.5 py-1 rounded-lg">
                      {prog.code}
                    </span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                      Active
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{prog.name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{prog.description}</p>
                  </div>

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

          {/* SECTION 2: LISTE DU PERSONNEL & GESTION DES COMPTES */}
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
                      <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                        {u.avatarUrl ? (
                          <img src={u.avatarUrl} alt={u.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-slate-600">
                            {u.name.substring(0, 2).toUpperCase()}
                          </span>
                        )}
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
