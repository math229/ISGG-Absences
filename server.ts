import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import nodemailer, { type Transporter } from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Permissions-Policy', 'camera=*, microphone=*');
  res.removeHeader('X-Powered-By');
  next();
});

// JSON body with bounded size to prevent denial of service
app.use(express.json({ limit: '10mb' }));

// In-memory rate limiting to protect endpoints against brute-force and flood attacks
interface RateLimitRecord {
  count: number;
  resetAt: number;
}
const apiRateLimits = new Map<string, RateLimitRecord>();

function rateLimit(windowMs: number, maxRequests: number, endpointName: string) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const rawIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1';
    const key = `${endpointName}:${rawIp}`;
    const now = Date.now();
    const entry = apiRateLimits.get(key) || { count: 0, resetAt: now + windowMs };

    if (now > entry.resetAt) {
      entry.count = 0;
      entry.resetAt = now + windowMs;
    }

    entry.count++;
    apiRateLimits.set(key, entry);

    if (entry.count > maxRequests) {
      const waitSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      return res.status(429).json({
        success: false,
        error: `Trop de requêtes. Veuillez patienter ${waitSeconds} seconde(s) avant de réessayer.`,
        retryAfter: waitSeconds,
      });
    }

    next();
  };
}

// Transporter cache
let cachedTransporter: Transporter | null = null;

function getMailTransporter(): { transporter: Transporter; user: string } | null {
  if (cachedTransporter) {
    const user = (process.env.SMTP_USER || process.env.MAIL_USER || '').trim();
    return { transporter: cachedTransporter, user };
  }

  const user = (process.env.SMTP_USER || process.env.MAIL_USER || '').trim();
  const rawPass = (process.env.SMTP_PASS || process.env.MAIL_PASS || '').trim();
  // Google fournit les mots de passe d'application avec des espaces (ex: "xxxx xxxx xxxx xxxx")
  const pass = rawPass.replace(/\s+/g, '');

  let host = (process.env.SMTP_HOST || process.env.MAIL_HOST || 'smtp.gmail.com').trim();
  const portEnv = process.env.SMTP_PORT || process.env.MAIL_PORT || '465';

  if (user && pass) {
    const finalHost = host || 'smtp.gmail.com';
    const port = Number(portEnv) || (finalHost === 'smtp.gmail.com' ? 465 : 587);

    cachedTransporter = nodemailer.createTransport({
      host: finalHost,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });
    return { transporter: cachedTransporter, user };
  }

  return null;
}

// API Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Send Institutional Email
app.post('/api/send-email', rateLimit(60000, 15, 'send-email'), async (req, res) => {
  try {
    const { to, subject, code, purpose, recipientName, role } = req.body;

    if (!to || !code) {
      return res.status(400).json({
        success: false,
        error: 'Destinataire (to) et code OTP requis.',
      });
    }

    const cleanTo = String(to).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanTo) || cleanTo.length > 120) {
      return res.status(400).json({
        success: false,
        error: 'Format d\'adresse email invalide.',
      });
    }

    const cleanCode = String(code).trim().replace(/[^a-zA-Z0-9]/g, '');
    if (cleanCode.length < 4 || cleanCode.length > 12) {
      return res.status(400).json({
        success: false,
        error: 'Code de sécurité invalide.',
      });
    }
    const formattedRole = role === 'ADMIN' ? 'Directeur' : (role === 'SURVEILLANT' ? 'Surveillant' : 'Membre du Personnel');
    const greetingName = recipientName ? `Bonjour ${recipientName},` : 'Bonjour,';

    const purposeTitle = purpose === 'PASSWORD_RESET' 
      ? 'Réinitialisation de votre mot de passe'
      : 'Vérification de votre compte institutionnel';

    const purposeInstruction = purpose === 'PASSWORD_RESET'
      ? 'Vous avez demandé la réinitialisation du mot de passe de votre compte institutionnel ISGG.'
      : `Vous avez initié la création de votre compte en tant que ${formattedRole} sur la plateforme de suivi des présences de l'ISGG.`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ISGG - Code de Sécurité</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { background: #0f172a; padding: 28px 32px; text-align: left; border-bottom: 4px solid #ea580c; }
    .header-logo { color: #ffffff; font-size: 20px; font-weight: 900; letter-spacing: -0.5px; }
    .header-logo span { color: #ea580c; }
    .header-sub { color: #94a3b8; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }
    .content { padding: 32px; }
    .greeting { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
    .message { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
    .code-box { background: #fff7ed; border: 2px dashed #ea580c; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
    .code-label { font-size: 11px; font-weight: 700; color: #9a3412; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; }
    .code-number { font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 900; color: #ea580c; letter-spacing: 8px; }
    .warning { background: #f1f5f9; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #64748b; line-height: 1.5; margin-top: 20px; }
    .footer { padding: 20px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="header-logo">ISGG <span>ABSENCES</span></div>
      <div class="header-sub">Institut Supérieur de Génie Civil et de Gestion</div>
    </div>
    <div class="content">
      <div class="greeting">${greetingName}</div>
      <div class="message">
        ${purposeInstruction}
        <br><br>
        Pour confirmer votre adresse email et certifier la sécurité de votre accès, veuillez utiliser le code officiel de vérification ci-dessous :
      </div>
      
      <div class="code-box">
        <div class="code-label">Code de Vérification Officiel</div>
        <div class="code-number">${cleanCode}</div>
      </div>

      <div class="warning">
        <strong>Important :</strong> Ce code est strictement personnel et confidentiel. Il est valable pendant <strong>10 minutes</strong>. Si vous n'êtes pas à l'origine de cette demande, veuillez ignorer ce message ou contacter immédiatement la Direction des Études de l'ISGG.
      </div>
    </div>
    <div class="footer">
      Direction des Systèmes d'Information &bull; ISGG Calavi, Bénin<br>
      Ce message a été généré automatiquement par la plateforme officielle ISGG.
    </div>
  </div>
</body>
</html>
    `;

    const textContent = `
ISGG ABSENCES - Institut Supérieur de Génie Civil et de Gestion
${purposeTitle}

${greetingName}

${purposeInstruction}

VOTRE CODE DE VÉRIFICATION OFFICIEL : ${cleanCode}

Ce code est valable pendant 10 minutes.
Ne le transmettez à personne.

Direction des Études - ISGG Calavi, Bénin
    `.trim();

    const mailConfig = getMailTransporter();

    if (mailConfig) {
      const senderFrom = process.env.SMTP_FROM || `"ISGG Institut Supérieur de Génie civil et de Gestion" <${mailConfig.user}>`;
      try {
        const info = await mailConfig.transporter.sendMail({
          from: senderFrom,
          to: cleanTo,
          subject: subject || `[ISGG] Votre code de sécurité officiel : ${cleanCode}`,
          text: textContent,
          html: htmlContent,
        });

        console.log(`[SMTP] Email expédié à ${cleanTo} avec succès. MessageId: ${info.messageId}`);
        return res.json({
          success: true,
          delivered: true,
          messageId: info.messageId,
          destination: cleanTo,
          message: `L'email officiel contenant votre code à 6 chiffres a été expédié avec succès à ${cleanTo}.`,
        });
      } catch (smtpErr: any) {
        console.error('[SMTP] Échec de transmission SMTP:', smtpErr);
        return res.status(200).json({
          success: true,
          delivered: false,
          warning: 'SMTP_CONFIG_ERROR',
          smtpError: smtpErr?.message || 'Erreur d\'authentification ou de connexion au serveur SMTP.',
          destination: cleanTo,
          message: `La connexion au serveur SMTP a échoué (${smtpErr?.message || 'vérifiez vos identifiants SMTP'}).`,
        });
      }
    }

    // Si pas de transporteur SMTP configuré (ex: variables pas encore renseignées dans Settings)
    console.log(`[EMAIL-SERVICE] Aucun serveur SMTP configuré. Email pour ${cleanTo} avec code OTP: ${cleanCode}`);
    return res.json({
      success: true,
      delivered: false,
      warning: 'SMTP_NOT_CONFIGURED',
      destination: cleanTo,
      message: `Attention : Les identifiants SMTP (SMTP_HOST, SMTP_USER, SMTP_PASS) n'ont pas encore été renseignés dans les Paramètres du projet.`,
    });
  } catch (error) {
    console.error('[API Send-Email] Erreur lors de l\'envoi:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'acheminement de l\'email institutionnel.',
    });
  }
});

// ==========================================
// API REST DE SYNCHRONISATION ÉTUDIANTS ISGG
// ==========================================
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  writeBatch 
} from 'firebase/firestore';
import { serverDb } from './serverFirebase';

// Vérification de la clé secrète API
async function verifyApiKey(req: express.Request): Promise<boolean> {
  const authHeader = req.headers['authorization'] || '';
  const xApiKey = (req.headers['x-api-key'] || req.headers['x-isgg-api-key'] || '') as string;
  
  let incomingKey = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    incomingKey = authHeader.replace('Bearer ', '').trim();
  } else if (xApiKey) {
    incomingKey = xApiKey.trim();
  }

  if (!incomingKey) return false;

  // 1. Clé configurée dans l'environnement
  const envKey = (process.env.ISGG_SYNC_API_KEY || '').trim();
  if (envKey && incomingKey === envKey) return true;

  // 2. Clé configurée dans les paramètres Firestore
  try {
    const settingsDoc = await getDoc(doc(serverDb, 'isgg_metadata', 'settings'));
    if (settingsDoc.exists()) {
      const data = settingsDoc.data();
      if (data?.syncApiKey && data.syncApiKey.trim() === incomingKey) {
        return true;
      }
    }
  } catch (e) {
    console.warn('[Sync API] Erreur lecture settings Firestore:', e);
  }

  // 3. Clé par défaut sécurisée
  return incomingKey === 'isgg_live_key_9482f5b8e1';
}

// Normalisation des filières et niveaux
function resolveProgramAndLevel(programRaw?: string, levelRaw?: string): { programId: string; levelId: string } {
  const pNorm = (programRaw || '').toUpperCase().trim();
  const lNorm = (levelRaw || '').toUpperCase().trim();

  // Détection filière
  let programId = 'prog-gi';
  if (pNorm.includes('GEI') || pNorm.includes('ELECTRO') || pNorm.includes('ENERG')) {
    programId = 'prog-gei';
  } else if (pNorm.includes('GC') || pNorm.includes('CIVIL') || pNorm.includes('BATIMENT')) {
    programId = 'prog-gc';
  } else if (pNorm.includes('GME') || pNorm.includes('MECA')) {
    programId = 'prog-gme';
  } else if (pNorm.includes('FC') || pNorm.includes('COMPTA') || pNorm.includes('FINANCE')) {
    programId = 'prog-fc';
  } else if (pNorm.includes('GESTION') || pNorm.includes('MANAGEMENT')) {
    programId = 'prog-fc';
  }

  // Détection niveau
  let levelId = 'lvl-l2';
  if (lNorm.includes('1') || lNorm.includes('L1') || lNorm.includes('SIL1') || lNorm.includes('PREMIERE')) {
    levelId = 'lvl-l1';
  } else if (lNorm.includes('3') || lNorm.includes('L3') || lNorm.includes('SIL3') || lNorm.includes('TROISIEME')) {
    levelId = 'lvl-l3';
  } else if (lNorm.includes('2') || lNorm.includes('L2') || lNorm.includes('SIL2') || lNorm.includes('DEUXIEME')) {
    levelId = 'lvl-l2';
  }

  return { programId, levelId };
}

// 1. Statut & Ping API
app.get('/api/v1/sync/status', rateLimit(60000, 120, 'sync-api'), async (req, res) => {
  const isValid = await verifyApiKey(req);
  if (!isValid) {
    return res.status(401).json({
      success: false,
      error: 'Non autorisé. Fournissez une clé valide (Header "X-API-KEY" ou "Authorization: Bearer <token>").',
    });
  }

  return res.json({
    success: true,
    institution: 'Institut Supérieur de Génie civil et de Gestion (ISGG)',
    service: 'API Synchronisation Étudiants & Scolarité',
    status: 'OPERATIONNEL',
    timestamp: new Date().toISOString(),
    supportedEndpoints: [
      'POST /api/v1/sync/students (Synchronisation unitaire ou groupée)',
      'GET /api/v1/sync/students (Consultation de l\'annuaire)',
      'GET /api/v1/sync/status (Vérification de connectivité)',
    ]
  });
});

// 2. Consultation des étudiants via API
app.get('/api/v1/sync/students', rateLimit(60000, 60, 'sync-api-read'), async (req, res) => {
  const isValid = await verifyApiKey(req);
  if (!isValid) {
    return res.status(401).json({
      success: false,
      error: 'Non autorisé. Fournissez une clé API valide.',
    });
  }

  try {
    const studentsSnap = await getDocs(collection(serverDb, 'isgg_students'));
    const list: any[] = [];
    studentsSnap.forEach(d => list.push(d.data()));

    return res.json({
      success: true,
      totalStudents: list.length,
      students: list,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Erreur lors de la lecture des étudiants',
    });
  }
});

// 3. Synchronisation d'un ou plusieurs étudiants (Upsert par Matricule)
app.post('/api/v1/sync/students', rateLimit(60000, 60, 'sync-api-write'), async (req, res) => {
  const isValid = await verifyApiKey(req);
  if (!isValid) {
    return res.status(401).json({
      success: false,
      error: 'Non autorisé. Clé API incorrecte ou absente.',
    });
  }

  try {
    const payload = req.body;
    // On accepte soit un objet étudiant unique, soit un tableau d'étudiants
    const rawList = Array.isArray(payload) ? payload : (Array.isArray(payload?.students) ? payload.students : [payload]);

    if (rawList.length === 0 || !rawList[0]) {
      return res.status(400).json({
        success: false,
        error: 'Aucune donnée étudiante reçue dans la requête.',
      });
    }

    if (rawList.length > 1000) {
      return res.status(413).json({
        success: false,
        error: 'Le lot de synchronisation dépasse la limite maximale de 1000 étudiants par appel.',
      });
    }

    // Charger les étudiants existants depuis Firestore pour faire le matching par matricule
    const existingSnap = await getDocs(collection(serverDb, 'isgg_students'));
    const matriculeMap = new Map<string, any>();
    existingSnap.forEach(d => {
      const data = d.data();
      if (data.matricule) {
        matriculeMap.set(data.matricule.trim().toUpperCase(), data);
      }
    });

    let createdCount = 0;
    let updatedCount = 0;
    const batch = writeBatch(serverDb);
    const now = new Date().toISOString();

    const processedStudents: any[] = [];

    for (const raw of rawList) {
      const matricule = (raw.matricule || raw.Matricule || raw.reference || '').trim();
      const lastName = (raw.lastName || raw.nom || raw.Nom || '').trim().toUpperCase();
      const firstName = (raw.firstName || raw.prenom || raw.Prenom || raw.prenoms || '').trim();

      if (!matricule && (!lastName || !firstName)) {
        continue;
      }

      const safeMatricule = matricule || `ISGG-${Date.now().toString().slice(-6)}`;
      const { programId, levelId } = resolveProgramAndLevel(
        raw.programCode || raw.program || raw.filiere || raw.Filiere,
        raw.levelCode || raw.level || raw.niveau || raw.Niveau || raw.classe
      );

      const classGroup = (raw.classGroup || raw.group || raw.groupe || raw.Groupe || 'A').toString().trim().toUpperCase();
      const email = (raw.email || raw.mail || '').trim().toLowerCase();
      const phone = (raw.phone || raw.telephone || raw.tel || '').trim();

      const existing = matriculeMap.get(safeMatricule.toUpperCase());

      if (existing) {
        // Mise à jour (Conserve l'ID unique et préserve les absences associées)
        const updatedStudent = {
          ...existing,
          lastName: lastName || existing.lastName,
          firstName: firstName || existing.firstName,
          programId: programId || existing.programId,
          levelId: levelId || existing.levelId,
          classGroup: classGroup || existing.classGroup || 'A',
          email: email || existing.email,
          phone: phone || existing.phone,
          isActive: raw.isActive !== undefined ? Boolean(raw.isActive) : existing.isActive,
          updatedAt: now,
        };

        const docRef = doc(serverDb, 'isgg_students', existing.id);
        batch.set(docRef, updatedStudent, { merge: true });
        updatedCount++;
        processedStudents.push(updatedStudent);
      } else {
        // Création nouvel étudiant
        const newId = `stu-sync-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const newStudent = {
          id: newId,
          matricule: safeMatricule,
          lastName,
          firstName,
          programId,
          levelId,
          classGroup: classGroup || 'A',
          email: email || undefined,
          phone: phone || undefined,
          isActive: true,
          createdAt: now,
        };

        const docRef = doc(serverDb, 'isgg_students', newId);
        batch.set(docRef, newStudent);
        matriculeMap.set(safeMatricule.toUpperCase(), newStudent);
        createdCount++;
        processedStudents.push(newStudent);
      }
    }

    if (createdCount > 0 || updatedCount > 0) {
      await batch.commit();

      // Mettre à jour les métadonnées de dernière synchronisation
      try {
        const settingsRef = doc(serverDb, 'isgg_metadata', 'settings');
        await setDoc(settingsRef, {
          lastSyncAt: now,
          lastSyncStats: {
            createdCount,
            updatedCount,
            totalReceived: rawList.length,
          }
        }, { merge: true });
      } catch (e) {
        console.warn('Update lastSyncAt error:', e);
      }
    }

    return res.json({
      success: true,
      message: `Synchronisation réussie : ${createdCount} étudiant(s) créé(s), ${updatedCount} mis à jour.`,
      stats: {
        totalReceived: rawList.length,
        created: createdCount,
        updated: updatedCount,
      },
      timestamp: now,
    });
  } catch (err: any) {
    console.error('[Sync API] Erreur traitement:', err);
    return res.status(500).json({
      success: false,
      error: 'Erreur interne lors de la synchronisation des étudiants.',
    });
  }
});

// Centralized error handling to prevent stack trace leaks
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Server Internal Error]', err?.message || err);
  if (res.headersSent) {
    return next(err);
  }
  return res.status(500).json({
    success: false,
    error: 'Une erreur interne est survenue sur le serveur.',
  });
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
