import { Program, Level, Subject, Student, SchoolYear, User, SecurityCodes } from '../types';

export const INITIAL_SCHOOL_YEAR: SchoolYear = {
  id: 'sy-2026-2027',
  name: '2026-2027',
  startDate: '2026-09-01',
  endDate: '2027-07-31',
  isActive: true,
};

export const DEFAULT_SECURITY_CODES: SecurityCodes = {
  surveillantCode: 'ISGG-SURV-2026',
  directorCode: 'ISGG-DIR-9482',
  updatedAt: new Date().toISOString(),
};

export const INITIAL_USERS: User[] = [];

export const INITIAL_PROGRAMS: Program[] = [
  {
    id: 'prog-gi',
    name: 'Génie Informatique',
    code: 'GI',
    description: 'Systèmes d\'information, réseaux, bases de données et développement logiciel.',
    availableGroups: ['A', 'B'],
    isActive: true,
  },
  {
    id: 'prog-gc',
    name: 'Génie Civil / BTP',
    code: 'GC',
    description: 'Calcul des structures, béton armé, mécanique des sols et conduite de travaux.',
    availableGroups: ['A', 'B'],
    isActive: true,
  },
  {
    id: 'prog-gt',
    name: 'Géomètre Topographe',
    code: 'GT',
    description: 'Topométrie, géodésie, cartographie numérique et foncier.',
    availableGroups: ['A'],
    isActive: true,
  },
  {
    id: 'prog-gp',
    name: 'Gestion des Projets',
    code: 'GP',
    description: 'Planification, budgétisation, pilotage des opérations et gouvernance.',
    availableGroups: ['A', 'B'],
    isActive: true,
  },
  {
    id: 'prog-pgmp',
    name: 'Passation et Gestion des Marchés Publics',
    code: 'PGMP',
    description: 'Réglementation, passation, audits et exécution contractuelle des marchés.',
    availableGroups: ['A'],
    isActive: true,
  },
];

export const INITIAL_LEVELS: Level[] = [
  { id: 'lvl-l1', name: 'Licence 1', code: 'L1', order: 1 },
  { id: 'lvl-l2', name: 'Licence 2', code: 'L2', order: 2 },
  { id: 'lvl-l3', name: 'Licence 3', code: 'L3', order: 3 },
  { id: 'lvl-m1', name: 'Master 1', code: 'M1', order: 4 },
  { id: 'lvl-m2', name: 'Master 2', code: 'M2', order: 5 },
];

export const INITIAL_SUBJECTS: Subject[] = [
  // Génie Informatique - Licence 2 (Programme académique officiel - 21 Matières)
  { id: 'sub-l2-probabilites', name: 'Probabilités', code: '', programId: 'prog-gi', levelId: 'lvl-l2', teacherName: 'Dr. Tossou' },
  { id: 'sub-l2-algebre-lineaire', name: 'Algèbre linéaire', code: '', programId: 'prog-gi', levelId: 'lvl-l2', teacherName: 'Pr. Hounnou' },
  { id: 'sub-l2-tele-informatique-reseau', name: 'Télé Informatique et Réseau', code: '', programId: 'prog-gi', levelId: 'lvl-l2', teacherName: 'Ing. Dossou' },
  { id: 'sub-l2-maintenance-informatique', name: 'Maintenance informatique', code: '', programId: 'prog-gi', levelId: 'lvl-l2', teacherName: 'Ing. Houessou' },
  { id: 'sub-l2-poo-cpp', name: 'POO (C++)', code: '', programId: 'prog-gi', levelId: 'lvl-l2', teacherName: 'M. Sossou' },
  { id: 'sub-l2-visual-basic', name: 'Visual Basic', code: '', programId: 'prog-gi', levelId: 'lvl-l2', teacherName: 'M. Sossou' },
  { id: 'sub-l2-recherche-operationnelle', name: 'Recherche Opérationnelle', code: '', programId: 'prog-gi', levelId: 'lvl-l2', teacherName: 'Dr. Mensah' },
  { id: 'sub-l2-algorithmes-avances', name: 'Algorithmes avancés', code: '', programId: 'prog-gi', levelId: 'lvl-l2', teacherName: 'M. Sossou' },
  { id: 'sub-l2-theorie-des-graphes', name: 'Théorie des graphes (Programmation)', code: '', programId: 'prog-gi', levelId: 'lvl-l2', teacherName: 'Pr. Hounnou' },
  { id: 'sub-l2-communication-ecrite-2', name: 'Communication Écrite et Orale 2 (CEO II)', code: 'CEO II', programId: 'prog-gi', levelId: 'lvl-l2', teacherName: 'Mme. Houinato' },
  { id: 'sub-l2-anglais-2', name: 'Anglais II', code: '', programId: 'prog-gi', levelId: 'lvl-l2', teacherName: 'M. Johnson' },
  { id: 'sub-l2-deuxieme-langue-chinois', name: 'Deuxième langue vivante niveau 1 (Chinois)', code: '', programId: 'prog-gi', levelId: 'lvl-l2', teacherName: 'Mme. Wang' },
  { id: 'sub-l2-negociation-informatique', name: 'Négociation informatique', code: '', programId: 'prog-gi', levelId: 'lvl-l2', teacherName: 'Me. Soglo' },
  { id: 'sub-l2-applications-bureautique', name: 'Applications bureautique et de gestion', code: '', programId: 'prog-gi', levelId: 'lvl-l2', teacherName: 'Mme. Lawson' },
  { id: 'sub-l2-merise-2', name: 'Merise 2', code: '', programId: 'prog-gi', levelId: 'lvl-l2', teacherName: 'M. Amoussou' },
  { id: 'sub-l2-atelier-genie-logiciel', name: 'Atelier Génie Logiciel', code: '', programId: 'prog-gi', levelId: 'lvl-l2', teacherName: 'Dr. Agbossou' },
  { id: 'sub-l2-bases-de-donnees-2', name: 'Bases de données 2', code: '', programId: 'prog-gi', levelId: 'lvl-l2', teacherName: 'Dr. Agbossou' },
  { id: 'sub-l2-acces-sgbd', name: 'Accès SGBD', code: '', programId: 'prog-gi', levelId: 'lvl-l2', teacherName: 'Dr. Agbossou' },
  { id: 'sub-l2-projet-informatique-thematique', name: 'Projet informatique et thématique', code: '', programId: 'prog-gi', levelId: 'lvl-l2', teacherName: 'Dr. Agbossou' },
  { id: 'sub-l2-programmation-web-2', name: 'Programmation Web 2', code: '', programId: 'prog-gi', levelId: 'lvl-l2', teacherName: 'M. Amoussou' },
  { id: 'sub-l2-teleinformatique-reseau-2', name: 'Téléinformatique et réseau 2', code: '', programId: 'prog-gi', levelId: 'lvl-l2', teacherName: 'Ing. Dossou' },
  
  // Génie Informatique - Licence 1 (Programme académique officiel - 20 Matières)
  { id: 'sub-l1-analyse', name: 'Analyse', code: '', programId: 'prog-gi', levelId: 'lvl-l1', teacherName: 'Pr. Hounnou' },
  { id: 'sub-l1-statistique', name: 'Statistique', code: '', programId: 'prog-gi', levelId: 'lvl-l1', teacherName: 'Dr. Tossou' },
  { id: 'sub-l1-logique-combinatoire', name: 'Logique Combinatoire', code: '', programId: 'prog-gi', levelId: 'lvl-l1', teacherName: 'Ing. Dossou' },
  { id: 'sub-l1-mesures-electriques', name: 'Mesures électriques', code: '', programId: 'prog-gi', levelId: 'lvl-l1', teacherName: 'Ing. Houessou' },
  { id: 'sub-l1-architecture-technologies', name: 'Architecture et technologies des ordinateurs', code: '', programId: 'prog-gi', levelId: 'lvl-l1', teacherName: 'Dr. Agbossou' },
  { id: 'sub-l1-droit-civil', name: 'Droit civil', code: '', programId: 'prog-gi', levelId: 'lvl-l1', teacherName: 'Me. Soglo' },
  { id: 'sub-l1-droit-commercial', name: 'Droit commercial', code: '', programId: 'prog-gi', levelId: 'lvl-l1', teacherName: 'Me. Soglo' },
  { id: 'sub-l1-informatique-fondamentale', name: 'Informatique Fondamentale', code: '', programId: 'prog-gi', levelId: 'lvl-l1', teacherName: 'M. Sossou' },
  { id: 'sub-l1-algorithme', name: 'Algorithme', code: '', programId: 'prog-gi', levelId: 'lvl-l1', teacherName: 'M. Sossou' },
  { id: 'sub-l1-economie-generale', name: 'Economie générale', code: '', programId: 'prog-gi', levelId: 'lvl-l1', teacherName: 'Dr. Mensah' },
  { id: 'sub-l1-economie-entreprise', name: 'Economie d\'entreprise', code: '', programId: 'prog-gi', levelId: 'lvl-l1', teacherName: 'Mme. Lawson' },
  { id: 'sub-l1-comptabilite-societes', name: 'Comptabilité des Sociétés', code: '', programId: 'prog-gi', levelId: 'lvl-l1', teacherName: 'Mme. Lawson' },
  { id: 'sub-l1-comptabilite-generale', name: 'Comptabilité Générale', code: '', programId: 'prog-gi', levelId: 'lvl-l1', teacherName: 'Mme. Lawson' },
  { id: 'sub-l1-base-de-donnees', name: 'Base de données', code: '', programId: 'prog-gi', levelId: 'lvl-l1', teacherName: 'Dr. Agbossou' },
  { id: 'sub-l1-merise-1', name: 'Merise l', code: '', programId: 'prog-gi', levelId: 'lvl-l1', teacherName: 'M. Amoussou' },
  { id: 'sub-l1-langage-c', name: 'Langage C', code: '', programId: 'prog-gi', levelId: 'lvl-l1', teacherName: 'M. Sossou' },
  { id: 'sub-l1-programmation-web-1', name: 'Programmation web 1', code: '', programId: 'prog-gi', levelId: 'lvl-l1', teacherName: 'M. Amoussou' },
  { id: 'sub-l1-projet-informatique', name: 'Projet informatique', code: '', programId: 'prog-gi', levelId: 'lvl-l1', teacherName: 'Dr. Agbossou' },
  { id: 'sub-l1-anglais-1', name: 'Anglais niveau 1', code: '', programId: 'prog-gi', levelId: 'lvl-l1', teacherName: 'M. Johnson' },
  { id: 'sub-l1-communication-1', name: 'Communication Ecrite et Orale 1', code: 'CEO 1', programId: 'prog-gi', levelId: 'lvl-l1', teacherName: 'Mme. Houinato' },
  
  // Génie Informatique - Licence 3 (Programme académique officiel - 17 Matières)
  { id: 'sub-l3-entreprenariat', name: 'Entreprenariat', code: '', programId: 'prog-gi', levelId: 'lvl-l3', teacherName: 'Dr. Mensah' },
  { id: 'sub-l3-droit', name: 'Droit', code: '', programId: 'prog-gi', levelId: 'lvl-l3', teacherName: 'Me. Soglo' },
  { id: 'sub-l3-education-financiere', name: 'Education financière et auto-emploi', code: '', programId: 'prog-gi', levelId: 'lvl-l3', teacherName: 'Mme. Lawson' },
  { id: 'sub-l3-teleinformatique-reseaux-3', name: 'Téléinformatique et Réseaux 3', code: '', programId: 'prog-gi', levelId: 'lvl-l3', teacherName: 'Ing. Dossou' },
  { id: 'sub-l3-architecture-systemes-exploitation', name: 'Architecture des systèmes d\'exploitation', code: '', programId: 'prog-gi', levelId: 'lvl-l3', teacherName: 'Dr. Agbossou' },
  { id: 'sub-l3-base-de-donnees-avancees', name: 'Base de données avancées', code: '', programId: 'prog-gi', levelId: 'lvl-l3', teacherName: 'Dr. Agbossou' },
  { id: 'sub-l3-oracle', name: 'Oracle', code: '', programId: 'prog-gi', levelId: 'lvl-l3', teacherName: 'Dr. Agbossou' },
  { id: 'sub-l3-methodologie-redaction-memoire', name: 'Méthodologie de Rédaction de Mémoire', code: '', programId: 'prog-gi', levelId: 'lvl-l3', teacherName: 'Pr. Hounnou' },
  { id: 'sub-l3-teeo-3', name: 'TEEO 3', code: 'TEEO 3', programId: 'prog-gi', levelId: 'lvl-l3', teacherName: 'Mme. Houinato' },
  { id: 'sub-l3-anglais-du-travail-3', name: 'Anglais du travail 3', code: '', programId: 'prog-gi', levelId: 'lvl-l3', teacherName: 'M. Johnson' },
  { id: 'sub-l3-java', name: 'Java', code: '', programId: 'prog-gi', levelId: 'lvl-l3', teacherName: 'M. Sossou' },
  { id: 'sub-l3-langage-cpp', name: 'Langage C ++', code: '', programId: 'prog-gi', levelId: 'lvl-l3', teacherName: 'M. Sossou' },
  { id: 'sub-l3-programmation-web-3', name: 'Programmation web 3', code: '', programId: 'prog-gi', levelId: 'lvl-l3', teacherName: 'M. Amoussou' },
  { id: 'sub-l3-programmation-android', name: 'Programmation Android', code: '', programId: 'prog-gi', levelId: 'lvl-l3', teacherName: 'M. Amoussou' },
  { id: 'sub-l3-atelier-genie-logiciel-2', name: 'Atelier Génie Logiciel 2', code: '', programId: 'prog-gi', levelId: 'lvl-l3', teacherName: 'Dr. Agbossou' },
  { id: 'sub-l3-uml', name: 'UML', code: '', programId: 'prog-gi', levelId: 'lvl-l3', teacherName: 'M. Amoussou' },
  { id: 'sub-l3-stage-soutenance-memoire', name: 'Stage et soutenance de mémoire', code: '', programId: 'prog-gi', levelId: 'lvl-l3', teacherName: 'Pr. Hounnou' },

  // Génie Civil / BTP - Licence 3
  { id: 'sub-gc-l3-ba', name: 'Béton Armé', code: 'BA301', programId: 'prog-gc', levelId: 'lvl-l3', teacherName: 'Ing. Kpadonou' },
  { id: 'sub-gc-l3-ms', name: 'Mécanique des sols', code: 'MS302', programId: 'prog-gc', levelId: 'lvl-l3', teacherName: 'Dr. Tchabi' },
  { id: 'sub-gc-l3-rdm', name: 'Résistance des matériaux (RDM)', code: 'RDM303', programId: 'prog-gc', levelId: 'lvl-l3', teacherName: 'Ing. Kpadonou' },

  // Génie Civil / BTP - Licence 2
  { id: 'sub-gc-l2-ms', name: 'Mécanique des sols', code: 'MS201', programId: 'prog-gc', levelId: 'lvl-l2', teacherName: 'Dr. Tchabi' },
  { id: 'sub-gc-l2-rdm', name: 'Résistance des matériaux', code: 'RDM202', programId: 'prog-gc', levelId: 'lvl-l2', teacherName: 'Ing. Kpadonou' },

  // Génie Civil / BTP - Licence 1
  { id: 'sub-gc-l1-dt', name: 'Dessin technique & Bâtiment', code: 'DT101', programId: 'prog-gc', levelId: 'lvl-l1', teacherName: 'M. Zannou' },

  // Géomètre Topographe - Licence 1
  { id: 'sub-gt-l1-dt', name: 'Dessin technique', code: 'DT102', programId: 'prog-gt', levelId: 'lvl-l1', teacherName: 'M. Zannou' },
  { id: 'sub-gt-l1-topo', name: 'Topométrie générale', code: 'TOPO101', programId: 'prog-gt', levelId: 'lvl-l1', teacherName: 'Ing. Houessou' },

  // Gestion des Projets - Licence 2
  { id: 'sub-gp-l2-compta', name: 'Comptabilité analytique', code: 'COMP201', programId: 'prog-gp', levelId: 'lvl-l2', teacherName: 'Mme. Lawson' },
  { id: 'sub-gp-l2-gp', name: 'Management de projet', code: 'MGT202', programId: 'prog-gp', levelId: 'lvl-l2', teacherName: 'Dr. Mensah' },

  // Gestion des Projets - Licence 3
  { id: 'sub-gp-l3-mkt', name: 'Marketing & Stratégie', code: 'MKT301', programId: 'prog-gp', levelId: 'lvl-l3', teacherName: 'Mme. Lawson' },
  { id: 'sub-gp-l3-audit', name: 'Audit et contrôle de gestion', code: 'AUD302', programId: 'prog-gp', levelId: 'lvl-l3', teacherName: 'Dr. Mensah' },

  // Passation et Gestion des Marchés Publics
  { id: 'sub-pgmp-l2-droit', name: 'Droit des marchés publics', code: 'DMP201', programId: 'prog-pgmp', levelId: 'lvl-l2', teacherName: 'Me. Soglo' },
  { id: 'sub-pgmp-l3-proc', name: 'Procédures de passation', code: 'PPP301', programId: 'prog-pgmp', levelId: 'lvl-l3', teacherName: 'Me. Soglo' },
];

export const INITIAL_STUDENTS: Student[] = [];
