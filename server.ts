import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import nodemailer, { type Transporter } from 'nodemailer';
import dotenv from 'dotenv';
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  writeBatch,
  query,
  where 
} from 'firebase/firestore';
import { serverDb } from './serverFirebase';

dotenv.config();

const app = express();
const PORT = 3000;

// Trust reverse proxy for accurate client IP resolution
app.set('trust proxy', 1);

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https: blob:; connect-src 'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://*.firebaseio.com https://*.googleapis.com; frame-ancestors *;"
  );
  res.setHeader('Permissions-Policy', 'camera=*, microphone=*');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.removeHeader('X-Powered-By');
  next();
});

// JSON body with bounded size to prevent denial of service
app.use(express.json({ limit: '5mb' }));

// In-memory rate limiting to protect endpoints against brute-force and flood attacks
interface RateLimitRecord {
  count: number;
  resetAt: number;
}
const apiRateLimits = new Map<string, RateLimitRecord>();

// Periodic cleanup of expired rate limit records every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of apiRateLimits.entries()) {
    if (now > entry.resetAt) {
      apiRateLimits.delete(key);
    }
  }
}, 5 * 60 * 1000);

function rateLimit(windowMs: number, maxRequests: number, endpointName: string) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const rawIp = req.ip || (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1';
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

// Persistent institutional SMTP engine is declared below in security & services section.

// API Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==========================================
// SESSION MANAGEMENT (HttpOnly Cookie + HMAC-SHA256)
// ==========================================
// CRYPTOGRAPHY & SECURITY HELPERS
// ==========================================
const SESSION_COOKIE_NAME = 'isgg_auth_session';
const SESSION_SECRET = (process.env.SESSION_SECRET || 'isgg-inst-auth-token-secret-2026-secure-key-9821').trim();
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60; // 8 heures (durée d'une journée de cours)
const SERVER_PASSWORD_SALT = 'ISGG_SECURE_SALT_v1_2026_BENIN_STUDIES';

/**
 * Constant-time string comparison to prevent timing attacks.
 * Uses SHA-256 digests so both operands have identical 32-byte buffers.
 */
function secureCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const hashA = crypto.createHash('sha256').update(Buffer.from(a, 'utf8')).digest();
  const hashB = crypto.createHash('sha256').update(Buffer.from(b, 'utf8')).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * AES-256-GCM symmetric encryption using server secret
 */
function encryptWithServerKey(text: string): string {
  if (!text) return '';
  const key = crypto.createHash('sha256').update(SESSION_SECRET).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v2:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * AES-256-GCM symmetric decryption using server secret
 */
function decryptWithServerKey(ciphertext: string): string {
  if (!ciphertext) return '';
  if (!ciphertext.startsWith('enc:v2:')) return ciphertext;
  const parts = ciphertext.split(':');
  if (parts.length !== 5) return ciphertext;
  try {
    const iv = Buffer.from(parts[2], 'hex');
    const tag = Buffer.from(parts[3], 'hex');
    const encrypted = Buffer.from(parts[4], 'hex');
    const key = crypto.createHash('sha256').update(SESSION_SECRET).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch (e) {
    console.warn('[Crypto] Decrypt with server key failed:', e);
    return '';
  }
}

// ==========================================
// PERSISTENT INSTITUTIONAL SMTP ENGINE (Firestore + AES-256)
// ==========================================
interface SmtpResolvedConfig {
  transporter: Transporter;
  user: string;
  fromName: string;
  host: string;
  port: number;
}

let cachedSmtpTransporter: Transporter | null = null;
let cachedSmtpUser: string = '';
let cachedSmtpFromName: string = '';
let cachedSmtpHost: string = '';
let cachedSmtpPort: number = 465;
let lastSmtpFetchTimestamp: number = 0;
const SMTP_CACHE_TTL_MS = 60 * 1000; // Cache 60 secondes

export function invalidateSmtpCache() {
  cachedSmtpTransporter = null;
  cachedSmtpUser = '';
  cachedSmtpFromName = '';
  cachedSmtpHost = '';
  cachedSmtpPort = 465;
  lastSmtpFetchTimestamp = 0;
}

async function getMailTransporterAsync(): Promise<SmtpResolvedConfig | null> {
  // 1. Utiliser le cache mémoire s'il est frais
  if (cachedSmtpTransporter && (Date.now() - lastSmtpFetchTimestamp < SMTP_CACHE_TTL_MS)) {
    return {
      transporter: cachedSmtpTransporter,
      user: cachedSmtpUser,
      fromName: cachedSmtpFromName,
      host: cachedSmtpHost,
      port: cachedSmtpPort,
    };
  }

  // 2. Priorité Production : Charger les paramètres SMTP chiffrés depuis Firestore
  try {
    const settingsDoc = await getDoc(doc(serverDb, 'isgg_metadata', 'settings'));
    if (settingsDoc.exists()) {
      const data = settingsDoc.data();
      let smtpData: any = null;

      if (data?.smtpConfigEncrypted) {
        const decrypted = decryptWithServerKey(data.smtpConfigEncrypted);
        if (decrypted) {
          try {
            smtpData = JSON.parse(decrypted);
          } catch (jsonErr) {
            console.warn('[SMTP Engine] Erreur parsing JSON config SMTP:', jsonErr);
          }
        }
      } else if (data?.smtpConfig && data.smtpConfig.user && data.smtpConfig.pass) {
        smtpData = data.smtpConfig;
      }

      if (smtpData?.user && smtpData?.pass) {
        const host = String(smtpData.host || 'smtp.gmail.com').trim();
        const port = Number(smtpData.port) || (host === 'smtp.gmail.com' ? 465 : 587);
        const pass = String(smtpData.pass).trim().replace(/\s+/g, '');
        const user = String(smtpData.user).trim();
        const fromName = String(smtpData.fromName || "ISGG Institut Supérieur de Génie Civil et de Gestion").trim();

        const transporter = nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: {
            user,
            pass,
          },
          tls: {
            rejectUnauthorized: false, // Résilience certificats intermédiaires
          }
        });

        cachedSmtpTransporter = transporter;
        cachedSmtpUser = user;
        cachedSmtpFromName = fromName;
        cachedSmtpHost = host;
        cachedSmtpPort = port;
        lastSmtpFetchTimestamp = Date.now();

        console.log(`[SMTP Engine] Transporteur opérationnel initialisé depuis Firestore (${user} sur ${host}:${port})`);
        return {
          transporter: cachedSmtpTransporter,
          user: cachedSmtpUser,
          fromName: cachedSmtpFromName,
          host: cachedSmtpHost,
          port: cachedSmtpPort,
        };
      }
    }
  } catch (err) {
    console.warn('[SMTP Engine] Erreur lecture configuration Firestore:', err);
  }

  // 3. Repli : Variables d'environnement système (.env)
  const envUser = (process.env.SMTP_USER || process.env.MAIL_USER || '').trim();
  const envRawPass = (process.env.SMTP_PASS || process.env.MAIL_PASS || '').trim();
  const envPass = envRawPass.replace(/\s+/g, '');
  const envHost = (process.env.SMTP_HOST || process.env.MAIL_HOST || 'smtp.gmail.com').trim();
  const envPort = Number(process.env.SMTP_PORT || process.env.MAIL_PORT || '465');

  if (envUser && envPass) {
    const transporter = nodemailer.createTransport({
      host: envHost,
      port: envPort,
      secure: envPort === 465,
      auth: {
        user: envUser,
        pass: envPass,
      },
      tls: {
        rejectUnauthorized: false,
      }
    });

    cachedSmtpTransporter = transporter;
    cachedSmtpUser = envUser;
    cachedSmtpFromName = process.env.SMTP_FROM_NAME || "ISGG Institut Supérieur de Génie Civil et de Gestion";
    cachedSmtpHost = envHost;
    cachedSmtpPort = envPort;
    lastSmtpFetchTimestamp = Date.now();

    console.log(`[SMTP Engine] Initialisé depuis variables d'environnement (.env) pour ${envUser}`);
    return {
      transporter: cachedSmtpTransporter,
      user: cachedSmtpUser,
      fromName: cachedSmtpFromName,
      host: cachedSmtpHost,
      port: cachedSmtpPort,
    };
  }

  return null;
}

/**
 * Server-side PBKDF2 Password Hashing (100,000 iters)
 */
function hashPasswordServer(password: string): string {
  const hash = crypto.pbkdf2Sync(password, SERVER_PASSWORD_SALT, 100000, 32, 'sha256');
  return 'pbkdf2$' + hash.toString('hex');
}

/**
 * Password verification supporting PBKDF2, SHA-256, and legacy hashes
 */
function verifyPasswordServer(plain: string, storedHashOrPlain: string): boolean {
  if (!plain || !storedHashOrPlain) return false;
  if (storedHashOrPlain.startsWith('pbkdf2$')) {
    const computed = hashPasswordServer(plain);
    return secureCompare(computed, storedHashOrPlain);
  }
  if (storedHashOrPlain.startsWith('sha256$')) {
    const textToHash = `${SERVER_PASSWORD_SALT}:${plain}:${SERVER_PASSWORD_SALT}`;
    const hash = crypto.createHash('sha256').update(textToHash).digest('hex');
    return secureCompare('sha256$' + hash, storedHashOrPlain);
  }
  if (storedHashOrPlain.startsWith('legacy$')) {
    const textToHash = `${SERVER_PASSWORD_SALT}:${plain}:${SERVER_PASSWORD_SALT}`;
    let hash = 0;
    for (let i = 0; i < textToHash.length; i++) {
      const char = textToHash.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return secureCompare('legacy$' + Math.abs(hash).toString(16), storedHashOrPlain);
  }
  return secureCompare(plain, storedHashOrPlain);
}

// ==========================================
// INSTITUTIONAL SECURITY CODES MANAGEMENT
// ==========================================
let cachedSecurityCodes: { directorCode: string; surveillantCode: string } | null = null;

async function getServerSecurityCodes(): Promise<{ directorCode: string; surveillantCode: string }> {
  if (cachedSecurityCodes) return cachedSecurityCodes;
  try {
    const settingsDoc = await getDoc(doc(serverDb, 'isgg_metadata', 'settings'));
    if (settingsDoc.exists()) {
      const data = settingsDoc.data();
      if (data?.securityCodesEncrypted) {
        const decryptedJson = decryptWithServerKey(data.securityCodesEncrypted);
        if (decryptedJson) {
          const parsed = JSON.parse(decryptedJson);
          cachedSecurityCodes = {
            directorCode: parsed.directorCode || 'ISGG-DIR-9482',
            surveillantCode: parsed.surveillantCode || 'ISGG-SURV-2026',
          };
          return cachedSecurityCodes;
        }
      }
    }
  } catch (e) {
    console.warn('[SecurityCodes] Error reading settings from serverDb:', e);
  }
  cachedSecurityCodes = {
    directorCode: 'ISGG-DIR-9482',
    surveillantCode: 'ISGG-SURV-2026',
  };
  return cachedSecurityCodes;
}

async function saveServerSecurityCodes(codes: { directorCode?: string; surveillantCode?: string }) {
  const current = await getServerSecurityCodes();
  const updated = {
    directorCode: codes.directorCode?.trim() || current.directorCode,
    surveillantCode: codes.surveillantCode?.trim() || current.surveillantCode,
  };
  cachedSecurityCodes = updated;
  try {
    const settingsRef = doc(serverDb, 'isgg_metadata', 'settings');
    await setDoc(settingsRef, {
      securityCodesEncrypted: encryptWithServerKey(JSON.stringify(updated)),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (e) {
    console.warn('[SecurityCodes] Error persisting encrypted codes to settings:', e);
  }
  return updated;
}

// ==========================================
// SERVER-SIDE OTP MANAGEMENT
// ==========================================
interface ServerOtpRecord {
  codeHash: string;
  expiresAt: number;
  attempts: number;
  verified: boolean;
  purpose: 'REGISTRATION' | 'PASSWORD_RESET';
  email: string;
  createdAt: number;
}
const serverOtpStore = new Map<string, ServerOtpRecord>();

// Cleanup expired OTPs every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of serverOtpStore.entries()) {
    if (now > entry.expiresAt + 15 * 60 * 1000) {
      serverOtpStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

function hashOtpCode(email: string, code: string): string {
  return crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(`${email.trim().toLowerCase()}:${code.trim()}`)
    .digest('hex');
}

// ==========================================
// SESSION MANAGEMENT (HttpOnly Cookie + HMAC-SHA256)
// ==========================================
interface SessionPayload {
  userId: string;
  email: string;
  role: string;
  issuedAt: number;
  expiresAt: number;
}

function signSessionToken(payload: Omit<SessionPayload, 'issuedAt' | 'expiresAt'>): string {
  const now = Date.now();
  const sessionData: SessionPayload = {
    ...payload,
    issuedAt: now,
    expiresAt: now + (SESSION_MAX_AGE_SECONDS * 1000),
  };
  const json = Buffer.from(JSON.stringify(sessionData)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(json)
    .digest('base64url');
  return `${json}.${signature}`;
}

function verifySessionToken(token: string): SessionPayload | null {
  try {
    if (!token || !token.includes('.')) return null;
    const [json, signature] = token.split('.');
    if (!json || !signature) return null;

    const expectedSig = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(json)
      .digest('base64url');

    if (!secureCompare(signature, expectedSig)) {
      return null;
    }

    const data: SessionPayload = JSON.parse(Buffer.from(json, 'base64url').toString('utf8'));
    if (Date.now() > data.expiresAt) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    if (parts.length >= 2) {
      const name = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      list[name] = decodeURIComponent(val);
    }
  });
  return list;
}

// ==========================================
// RATE LIMITING & LOCKOUT CONTROLLER
// ==========================================
interface LockoutRecord {
  failures: number;
  lockedUntil: number;
  banned: boolean;
}
const lockoutStore = new Map<string, LockoutRecord>();

function getLockoutState(identifier: string): LockoutRecord {
  const key = identifier.toLowerCase().trim();
  return lockoutStore.get(key) || { failures: 0, lockedUntil: 0, banned: false };
}

function recordAuthFailure(identifier: string): LockoutRecord {
  const key = identifier.toLowerCase().trim();
  const state = getLockoutState(key);
  state.failures++;
  if (state.failures >= 100) {
    state.banned = true;
  } else if (state.failures % 3 === 0) {
    state.lockedUntil = Date.now() + 5 * 60 * 1000; // 5 min lockout
  }
  lockoutStore.set(key, state);
  return state;
}

function resetAuthFailure(identifier: string) {
  const key = identifier.toLowerCase().trim();
  lockoutStore.delete(key);
}

// Route d'initialisation de session HttpOnly
app.post('/api/auth/session', rateLimit(60000, 30, 'auth-session'), (req, res) => {
  try {
    const { userId, email, role } = req.body;
    if (!userId || !email || !role) {
      return res.status(400).json({ success: false, error: 'Paramètres utilisateur requis.' });
    }

    const token = signSessionToken({
      userId: String(userId).trim(),
      email: String(email).trim().toLowerCase(),
      role: String(role).trim(),
    });

    const isSecure = process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
    const cookieHeader = `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MAX_AGE_SECONDS}${isSecure ? '; Secure' : ''}`;
    
    res.setHeader('Set-Cookie', cookieHeader);
    return res.json({
      success: true,
      message: 'Session sécurisée initialisée avec succès.',
      expiresIn: SESSION_MAX_AGE_SECONDS,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Erreur lors de l\'initialisation de session.' });
  }
});

// Route de vérification de session HttpOnly
app.get('/api/auth/session', (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE_NAME];
  const session = token ? verifySessionToken(token) : null;

  if (!session) {
    return res.status(401).json({ authenticated: false });
  }

  return res.json({
    authenticated: true,
    userId: session.userId,
    email: session.email,
    role: session.role,
    expiresAt: session.expiresAt,
  });
});

// Route de déconnexion : détruit le cookie HttpOnly
app.post('/api/auth/logout', (req, res) => {
  const isSecure = process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${isSecure ? '; Secure' : ''}`
  );
  return res.json({ success: true, message: 'Session fermée.' });
});

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Helper to send institutional emails via SMTP
async function sendInstitutionalEmail(params: {
  to: string;
  code: string;
  purpose: 'REGISTRATION' | 'PASSWORD_RESET' | string;
  recipientName?: string;
  role?: string;
  subject?: string;
}): Promise<{
  delivered: boolean;
  warning?: string;
  smtpError?: string;
  message: string;
  messageId?: string;
}> {
  const { to, code, purpose, recipientName, role, subject } = params;
  const cleanTo = String(to).trim().toLowerCase();
  const cleanCode = String(code).trim().replace(/[^a-zA-Z0-9]/g, '');
  const formattedRole = role === 'ADMIN' ? 'Directeur' : (role === 'SURVEILLANT' ? 'Surveillant' : 'Membre du Personnel');
  const safeRecipientName = recipientName ? escapeHtml(String(recipientName).trim()) : '';
  const greetingName = safeRecipientName ? `Bonjour ${safeRecipientName},` : 'Bonjour,';

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
  `.trim();

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

  const mailConfig = await getMailTransporterAsync();

  if (mailConfig) {
    const senderFrom = process.env.SMTP_FROM || `"${mailConfig.fromName}" <${mailConfig.user}>`;
    try {
      const info = await mailConfig.transporter.sendMail({
        from: senderFrom,
        to: cleanTo,
        subject: subject || `[ISGG] Votre code de sécurité officiel : ${cleanCode}`,
        text: textContent,
        html: htmlContent,
      });

      console.log(`[SMTP] Email expédié à ${cleanTo} avec succès via ${mailConfig.user}. MessageId: ${info.messageId}`);
      return {
        delivered: true,
        messageId: info.messageId,
        message: `L'email officiel contenant votre code à 6 chiffres a été expédié avec succès à ${cleanTo}.`,
      };
    } catch (smtpErr: any) {
      console.error('[SMTP] Échec de transmission SMTP:', smtpErr);
      return {
        delivered: false,
        warning: 'SMTP_CONFIG_ERROR',
        smtpError: smtpErr?.message || 'Erreur d\'authentification ou de connexion au serveur SMTP.',
        message: `La connexion au serveur SMTP a échoué (${smtpErr?.message || 'vérifiez vos identifiants SMTP'}).`,
      };
    }
  }

  console.log(`[EMAIL-SERVICE] Aucun serveur SMTP opérationnel. Email pour ${cleanTo} avec code OTP: ${cleanCode}`);
  return {
    delivered: false,
    warning: 'SMTP_NOT_CONFIGURED',
    message: `Attention : Le serveur SMTP d'expédition institutionnel n'est pas configuré.`,
  };
}

// API Send Institutional Email
app.post('/api/send-email', rateLimit(60000, 15, 'send-email'), async (req, res) => {
  try {
    const { to, subject, code, purpose, recipientName, role } = req.body;
    if (!to || !code) {
      return res.status(400).json({ success: false, error: 'Destinataire (to) et code OTP requis.' });
    }
    const cleanTo = String(to).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanTo) || cleanTo.length > 120) {
      return res.status(400).json({ success: false, error: 'Format d\'adresse email invalide.' });
    }
    const cleanCode = String(code).trim().replace(/[^a-zA-Z0-9]/g, '');
    if (cleanCode.length < 4 || cleanCode.length > 12) {
      return res.status(400).json({ success: false, error: 'Code de sécurité invalide.' });
    }

    const result = await sendInstitutionalEmail({
      to: cleanTo,
      code: cleanCode,
      purpose,
      recipientName,
      role,
      subject,
    });

    return res.json({
      success: true,
      delivered: result.delivered,
      warning: result.warning,
      smtpError: result.smtpError,
      destination: cleanTo,
      message: result.message,
    });
  } catch (error) {
    console.error('[API Send-Email] Erreur lors de l\'envoi:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de l\'acheminement de l\'email institutionnel.' });
  }
});

// ==========================================
// SECURE SERVER-SIDE AUTHENTICATION API
// ==========================================

// 1. Authentification Sécurisée (Login avec Rate Limiting & Lockout)
app.post('/api/auth/login', rateLimit(60000, 15, 'auth-login'), async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Identifiant et mot de passe requis.' });
    }
    const cleanIdent = String(identifier).trim().toLowerCase();
    const lockout = getLockoutState(cleanIdent);
    if (lockout.banned) {
      return res.status(403).json({ success: false, isBanned: true, message: 'Ce compte a été verrouillé par mesure de sécurité.' });
    }
    if (lockout.lockedUntil > Date.now()) {
      const waitMinutes = Math.ceil((lockout.lockedUntil - Date.now()) / 60000);
      return res.status(429).json({ 
        success: false, 
        lockedUntil: lockout.lockedUntil, 
        message: `Compte temporairement verrouillé. Veuillez patienter ${waitMinutes} minute(s).` 
      });
    }

    // Query user in Firestore
    let matchedUser: any = null;
    try {
      const usersSnap = await getDocs(collection(serverDb, 'isgg_users'));
      usersSnap.forEach((docSnap) => {
        const u = docSnap.data();
        if (u.email && u.email.trim().toLowerCase() === cleanIdent) {
          matchedUser = { ...u, id: docSnap.id };
        } else if (u.name && u.name.trim().toLowerCase() === cleanIdent) {
          matchedUser = { ...u, id: docSnap.id };
        }
      });
    } catch (dbErr: any) {
      console.warn('[API Auth Login] Firestore query notice:', dbErr?.message || dbErr);
    }

    if (!matchedUser) {
      const state = recordAuthFailure(cleanIdent);
      return res.status(401).json({ 
        success: false, 
        message: 'Identifiant ou mot de passe incorrect.',
        lockedUntil: state.lockedUntil || undefined,
        isBanned: state.banned,
      });
    }

    if (matchedUser.isActive === false) {
      return res.status(403).json({ success: false, message: 'Votre compte est désactivé. Contactez l\'administration.' });
    }

    const isValidPassword = verifyPasswordServer(password, matchedUser.password);
    if (!isValidPassword) {
      const state = recordAuthFailure(cleanIdent);
      return res.status(401).json({ 
        success: false, 
        message: 'Identifiant ou mot de passe incorrect.',
        lockedUntil: state.lockedUntil || undefined,
        isBanned: state.banned,
      });
    }

    // Reset failure state
    resetAuthFailure(cleanIdent);

    // Sign session cookie
    const token = signSessionToken({
      userId: matchedUser.id,
      email: matchedUser.email,
      role: matchedUser.role,
    });

    const isSecure = process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
    const cookieHeader = `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MAX_AGE_SECONDS}${isSecure ? '; Secure' : ''}`;
    res.setHeader('Set-Cookie', cookieHeader);

    // Update lastLogin in Firestore
    try {
      await setDoc(doc(serverDb, 'isgg_users', matchedUser.id), {
        lastLogin: new Date().toISOString(),
      }, { merge: true });
    } catch (err) {
      console.warn('Update lastLogin error:', err);
    }

    // Return sanitized user (NEVER send the password to client!)
    const safeUser = { ...matchedUser, password: '' };
    return res.json({
      success: true,
      message: 'Connexion réussie',
      user: safeUser,
    });
  } catch (err: any) {
    console.error('[API Auth Login] Error:', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur lors de la connexion.' });
  }
});

// 2. Vérification de Code d'Habilitation Institutionnel (Directeur / Surveillant)
app.post('/api/auth/verify-auth-code', rateLimit(60000, 30, 'verify-auth-code'), async (req, res) => {
  try {
    const { role, authCode } = req.body;
    if (!role || !authCode) {
      return res.json({ valid: false, message: 'Rôle et code requis.' });
    }
    const codes = await getServerSecurityCodes();
    const normalize = (s: string) => (s || '').trim().toUpperCase().replace(/[\s\-_]/g, '');
    const entered = normalize(String(authCode));
    const target = role === 'ADMIN' ? normalize(codes.directorCode) : normalize(codes.surveillantCode);
    const isValid = secureCompare(entered, target);
    return res.json({ valid: isValid });
  } catch (err) {
    return res.status(500).json({ valid: false, message: 'Erreur vérification code.' });
  }
});

// 3. Expédition OTP Inscription
app.post(['/api/otp/send-registration', '/api/auth/register-initiate'], rateLimit(60000, 10, 'reg-otp'), async (req, res) => {
  try {
    const { name, email, role, title, password, authCode } = req.body;
    const cleanEmail = String(email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: 'Adresse email invalide.' });
    }

    // Validate institutional code
    if (authCode) {
      const codes = await getServerSecurityCodes();
      const normalize = (s: string) => (s || '').trim().toUpperCase().replace(/[\s\-_]/g, '');
      const target = role === 'ADMIN' ? normalize(codes.directorCode) : normalize(codes.surveillantCode);
      if (!secureCompare(normalize(String(authCode)), target)) {
        return res.status(403).json({
          success: false,
          message: `Code d'habilitation invalide pour le profil ${role === 'ADMIN' ? 'Directeur' : 'Surveillant'}.`
        });
      }
    }

    // Check if user already exists
    const usersSnap = await getDocs(collection(serverDb, 'isgg_users'));
    let exists = false;
    usersSnap.forEach((d) => {
      const u = d.data();
      if (u.email && u.email.trim().toLowerCase() === cleanEmail) {
        exists = true;
      }
    });
    if (exists) {
      return res.status(409).json({ success: false, message: 'Un compte avec cette adresse email existe déjà.' });
    }

    // Generate cryptographically secure 6-digit OTP
    const code = crypto.randomInt(100000, 1000000).toString();
    const codeHash = hashOtpCode(cleanEmail, code);

    // Store securely in server memory
    serverOtpStore.set(`REG:${cleanEmail}`, {
      codeHash,
      expiresAt: Date.now() + 15 * 60 * 1000,
      attempts: 0,
      verified: false,
      purpose: 'REGISTRATION',
      email: cleanEmail,
      createdAt: Date.now(),
    });

    // Dispatch official institutional email
    const emailResult = await sendInstitutionalEmail({
      to: cleanEmail,
      code,
      purpose: 'REGISTRATION',
      recipientName: name,
      role,
    });

    return res.json({
      success: true,
      delivered: emailResult.delivered,
      warning: emailResult.warning,
      smtpError: emailResult.smtpError,
      message: emailResult.delivered
        ? `Code officiel envoyé avec succès à ${cleanEmail}.`
        : emailResult.message,
    });
  } catch (err: any) {
    console.error('[API Send Registration OTP] Error:', err);
    return res.status(500).json({ success: false, message: 'Erreur lors de la génération du code.' });
  }
});

// 4. Vérification OTP Inscription
app.post('/api/otp/verify-registration', rateLimit(60000, 20, 'verify-reg-otp'), async (req, res) => {
  try {
    const { email, code } = req.body;
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanCode = String(code || '').trim();
    const record = serverOtpStore.get(`REG:${cleanEmail}`);

    if (!record) {
      return res.status(404).json({ success: false, message: 'Aucun code actif trouvé pour cet email. Veuillez redemander un code.' });
    }
    if (Date.now() > record.expiresAt) {
      serverOtpStore.delete(`REG:${cleanEmail}`);
      return res.status(410).json({ success: false, message: 'Le code a expiré (validité 15 min). Veuillez redemander un nouveau code.' });
    }
    if (record.attempts >= 5) {
      serverOtpStore.delete(`REG:${cleanEmail}`);
      return res.status(429).json({ success: false, message: 'Nombre maximal de tentatives dépassé. Veuillez redemander un code.' });
    }

    const expectedHash = hashOtpCode(cleanEmail, cleanCode);
    if (!secureCompare(expectedHash, record.codeHash)) {
      record.attempts++;
      const remaining = 5 - record.attempts;
      return res.status(400).json({
        success: false,
        remainingAttempts: remaining,
        message: `Code incorrect. Il vous reste ${remaining} tentative(s).`,
      });
    }

    record.verified = true;
    return res.json({ success: true, message: 'Adresse email vérifiée avec succès !' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Erreur lors de la vérification.' });
  }
});

// 5. Finalisation Création de Compte
app.post('/api/auth/register-complete', rateLimit(60000, 10, 'reg-complete'), async (req, res) => {
  try {
    const { name, email, role, title, password, authCode, otpCode } = req.body;
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanOtp = String(otpCode || '').trim();

    const record = serverOtpStore.get(`REG:${cleanEmail}`);
    if (!record) {
      return res.status(400).json({ success: false, message: 'Session de validation expirée. Veuillez redemander un code.' });
    }

    // Verify OTP if not yet verified
    if (!record.verified) {
      const expectedHash = hashOtpCode(cleanEmail, cleanOtp);
      if (!secureCompare(expectedHash, record.codeHash)) {
        record.attempts++;
        return res.status(400).json({ success: false, message: 'Code de vérification incorrect.' });
      }
      record.verified = true;
    }

    // Verify institutional code
    const codes = await getServerSecurityCodes();
    const normalize = (s: string) => (s || '').trim().toUpperCase().replace(/[\s\-_]/g, '');
    const target = role === 'ADMIN' ? normalize(codes.directorCode) : normalize(codes.surveillantCode);
    if (!secureCompare(normalize(String(authCode)), target)) {
      return res.status(403).json({ success: false, message: 'Code d\'habilitation incorrect.' });
    }

    // Check duplicate
    const usersSnap = await getDocs(collection(serverDb, 'isgg_users'));
    let exists = false;
    usersSnap.forEach((d) => {
      const u = d.data();
      if (u.email && u.email.trim().toLowerCase() === cleanEmail) exists = true;
    });
    if (exists) {
      return res.status(409).json({ success: false, message: 'Un compte avec cette adresse email existe déjà.' });
    }

    // Create User with strong PBKDF2 hash
    const newUserId = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const hashedPassword = hashPasswordServer(password);
    const newUser = {
      id: newUserId,
      name: String(name).trim(),
      email: cleanEmail,
      role,
      title: title ? String(title).trim() : (role === 'ADMIN' ? 'Directeur des Études' : 'Surveillant Général'),
      password: hashedPassword,
      isActive: true,
      emailVerified: true,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };

    await setDoc(doc(serverDb, 'isgg_users', newUserId), newUser);
    serverOtpStore.delete(`REG:${cleanEmail}`);

    // Set session cookie
    const token = signSessionToken({
      userId: newUserId,
      email: cleanEmail,
      role,
    });
    const isSecure = process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
    res.setHeader('Set-Cookie', `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MAX_AGE_SECONDS}${isSecure ? '; Secure' : ''}`);

    const safeUser = { ...newUser, password: '' };
    return res.json({
      success: true,
      message: 'Compte institutionnel créé et vérifié avec succès !',
      user: safeUser,
    });
  } catch (err: any) {
    console.error('[API Register Complete] Error:', err);
    return res.status(500).json({ success: false, message: 'Erreur lors de la création du compte.' });
  }
});

// 6. Demande OTP Réinitialisation Mot de Passe
app.post(['/api/otp/send-password-reset', '/api/auth/request-password-reset'], rateLimit(60000, 8, 'reset-otp'), async (req, res) => {
  try {
    const { email } = req.body;
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail) {
      return res.status(400).json({ success: false, message: 'Adresse email requise.' });
    }

    // Verify user exists
    const usersSnap = await getDocs(collection(serverDb, 'isgg_users'));
    let foundUser: any = null;
    usersSnap.forEach((d) => {
      const u = d.data();
      if (u.email && u.email.trim().toLowerCase() === cleanEmail) {
        foundUser = u;
      }
    });

    if (!foundUser) {
      return res.status(404).json({ success: false, message: 'Aucun compte associé à cette adresse email.' });
    }

    const code = crypto.randomInt(100000, 1000000).toString();
    const codeHash = hashOtpCode(cleanEmail, code);

    serverOtpStore.set(`RESET:${cleanEmail}`, {
      codeHash,
      expiresAt: Date.now() + 15 * 60 * 1000,
      attempts: 0,
      verified: false,
      purpose: 'PASSWORD_RESET',
      email: cleanEmail,
      createdAt: Date.now(),
    });

    const emailResult = await sendInstitutionalEmail({
      to: cleanEmail,
      code,
      purpose: 'PASSWORD_RESET',
      recipientName: foundUser.name,
      role: foundUser.role,
    });

    return res.json({
      success: true,
      delivered: emailResult.delivered,
      warning: emailResult.warning,
      smtpError: emailResult.smtpError,
      message: emailResult.delivered
        ? `Code officiel de réinitialisation envoyé à ${cleanEmail}.`
        : emailResult.message,
    });
  } catch (err: any) {
    console.error('[API Password Reset OTP] Error:', err);
    return res.status(500).json({ success: false, message: 'Erreur lors de la demande de réinitialisation.' });
  }
});

// 7. Vérification OTP Réinitialisation
app.post(['/api/otp/verify-password-reset', '/api/auth/verify-password-reset-otp'], rateLimit(60000, 20, 'verify-reset-otp'), async (req, res) => {
  try {
    const { email, code } = req.body;
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanCode = String(code || '').trim();
    const record = serverOtpStore.get(`RESET:${cleanEmail}`);

    if (!record) {
      return res.status(404).json({ success: false, message: 'Aucun code actif trouvé pour cet email.' });
    }
    if (Date.now() > record.expiresAt) {
      serverOtpStore.delete(`RESET:${cleanEmail}`);
      return res.status(410).json({ success: false, message: 'Le code a expiré. Veuillez redemander un code.' });
    }
    if (record.attempts >= 5) {
      serverOtpStore.delete(`RESET:${cleanEmail}`);
      return res.status(429).json({ success: false, message: 'Trop de tentatives erronées.' });
    }

    const expectedHash = hashOtpCode(cleanEmail, cleanCode);
    if (!secureCompare(expectedHash, record.codeHash)) {
      record.attempts++;
      const remaining = 5 - record.attempts;
      return res.status(400).json({
        success: false,
        remainingAttempts: remaining,
        message: `Code incorrect. Il vous reste ${remaining} tentative(s).`,
      });
    }

    record.verified = true;
    return res.json({ success: true, message: 'Code de sécurité validé.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur lors de la vérification.' });
  }
});

// 8. Réinitialisation Complète du Mot de Passe
app.post('/api/auth/reset-password', rateLimit(60000, 10, 'reset-pass-finish'), async (req, res) => {
  try {
    const { email, otpCode, authCode, newPassword } = req.body;
    const cleanEmail = String(email || '').trim().toLowerCase();

    // Find user
    const usersSnap = await getDocs(collection(serverDb, 'isgg_users'));
    let foundDocId: string | null = null;
    let foundUser: any = null;
    usersSnap.forEach((d) => {
      const u = d.data();
      if (u.email && u.email.trim().toLowerCase() === cleanEmail) {
        foundDocId = d.id;
        foundUser = u;
      }
    });

    if (!foundDocId || !foundUser) {
      return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
    }

    // Verify OTP
    const record = serverOtpStore.get(`RESET:${cleanEmail}`);
    if (!record) {
      return res.status(400).json({ success: false, message: 'Session de validation expirée. Veuillez redemander un code.' });
    }
    if (!record.verified) {
      const expectedHash = hashOtpCode(cleanEmail, String(otpCode || '').trim());
      if (!secureCompare(expectedHash, record.codeHash)) {
        return res.status(400).json({ success: false, message: 'Code de vérification incorrect.' });
      }
      record.verified = true;
    }

    // Verify authCode
    const codes = await getServerSecurityCodes();
    const normalize = (s: string) => (s || '').trim().toUpperCase().replace(/[\s\-_]/g, '');
    const target = foundUser.role === 'ADMIN' ? normalize(codes.directorCode) : normalize(codes.surveillantCode);
    if (!secureCompare(normalize(String(authCode)), target)) {
      return res.status(403).json({ success: false, message: 'Code d\'habilitation incorrect pour votre profil.' });
    }

    // Validate new password length
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Le mot de passe doit comporter au moins 8 caractères.' });
    }

    // Hash with PBKDF2
    const hashedPassword = hashPasswordServer(newPassword);
    await setDoc(doc(serverDb, 'isgg_users', foundDocId), {
      password: hashedPassword,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    serverOtpStore.delete(`RESET:${cleanEmail}`);
    resetAuthFailure(cleanEmail);

    return res.json({
      success: true,
      message: 'Votre mot de passe a été réinitialisé avec succès ! Vous pouvez maintenant vous connecter.',
    });
  } catch (err: any) {
    console.error('[API Reset Password] Error:', err);
    return res.status(500).json({ success: false, message: 'Erreur lors de la réinitialisation.' });
  }
});

// ==========================================
// ADMIN SECURITY CODES (Protégé par Session ADMIN)
// ==========================================
app.get('/api/admin/security-codes', async (req, res) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[SESSION_COOKIE_NAME];
    const session = token ? verifySessionToken(token) : null;
    if (!session || session.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
    }
    const codes = await getServerSecurityCodes();
    return res.json({
      directorCode: codes.directorCode,
      surveillantCode: codes.surveillantCode,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur lecture codes.' });
  }
});

app.post('/api/admin/security-codes', rateLimit(60000, 10, 'update-sec-codes'), async (req, res) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[SESSION_COOKIE_NAME];
    const session = token ? verifySessionToken(token) : null;
    if (!session || session.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
    }
    const { directorCode, surveillantCode } = req.body;
    const updated = await saveServerSecurityCodes({ directorCode, surveillantCode });
    return res.json({
      success: true,
      message: 'Codes d\'habilitation mis à jour avec succès.',
      codes: updated,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur mise à jour codes.' });
  }
});

// ==========================================
// INSTITUTIONAL SMTP MANAGEMENT API (ADMIN)
// ==========================================
app.get('/api/admin/smtp', async (req, res) => {
  try {
    const currentConfig = await getMailTransporterAsync();
    let publicConfig: any = {
      isConfigured: false,
      host: 'smtp.gmail.com',
      port: 465,
      user: '',
      fromName: 'ISGG Institut Supérieur de Génie Civil et de Gestion',
      updatedAt: null,
    };

    try {
      const settingsDoc = await getDoc(doc(serverDb, 'isgg_metadata', 'settings'));
      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        if (data.smtpConfigPublic) {
          publicConfig = {
            ...publicConfig,
            ...data.smtpConfigPublic,
          };
        }
      }
    } catch (e) {
      console.warn('[Admin SMTP] Erreur lecture public config:', e);
    }

    if (currentConfig) {
      publicConfig.isConfigured = true;
      publicConfig.user = currentConfig.user;
      publicConfig.host = currentConfig.host;
      publicConfig.port = currentConfig.port;
      publicConfig.fromName = currentConfig.fromName;
    }

    return res.json({
      success: true,
      config: publicConfig,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Erreur lecture configuration SMTP.' });
  }
});

app.post('/api/admin/smtp', rateLimit(60000, 10, 'update-smtp-cfg'), async (req, res) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[SESSION_COOKIE_NAME];
    const session = token ? verifySessionToken(token) : null;
    
    // Authorization: session Admin or valid admin credentials
    if (!session || session.role !== 'ADMIN') {
      return res.status(403).json({ success: false, error: 'Accès réservé aux administrateurs.' });
    }

    const { host = 'smtp.gmail.com', port = 465, user, pass, fromName } = req.body;
    const cleanUser = String(user || '').trim().toLowerCase();
    const cleanPass = String(pass || '').trim().replace(/\s+/g, '');
    const cleanHost = String(host || 'smtp.gmail.com').trim();
    const cleanPort = Number(port) || (cleanHost === 'smtp.gmail.com' ? 465 : 587);
    const cleanFromName = String(fromName || 'ISGG Institut Supérieur de Génie Civil et de Gestion').trim();

    if (!cleanUser || !cleanPass) {
      return res.status(400).json({ success: false, error: 'Adresse email SMTP et mot de passe d\'application requis.' });
    }

    // 1. Tester la connexion SMTP avant enregistrement
    const testTransporter = nodemailer.createTransport({
      host: cleanHost,
      port: cleanPort,
      secure: cleanPort === 465,
      auth: {
        user: cleanUser,
        pass: cleanPass,
      },
      tls: {
        rejectUnauthorized: false,
      }
    });

    try {
      await testTransporter.verify();
      console.log(`[Admin SMTP] Vérification réussie pour ${cleanUser} sur ${cleanHost}:${cleanPort}`);
    } catch (verifyErr: any) {
      console.error('[Admin SMTP] Échec vérification SMTP:', verifyErr);
      return res.status(400).json({
        success: false,
        error: `Échec de connexion au serveur SMTP (${verifyErr?.message || 'Identifiants ou mot de passe d\'application incorrects'}).`,
      });
    }

    // 2. Chiffrement AES-256 et sauvegarde permanente dans Firestore
    const smtpPayload = {
      host: cleanHost,
      port: cleanPort,
      secure: cleanPort === 465,
      user: cleanUser,
      pass: cleanPass,
      fromName: cleanFromName,
      updatedAt: new Date().toISOString(),
    };

    const encryptedData = encryptWithServerKey(JSON.stringify(smtpPayload));
    const publicData = {
      host: cleanHost,
      port: cleanPort,
      user: cleanUser,
      fromName: cleanFromName,
      isConfigured: true,
      updatedAt: new Date().toISOString(),
    };

    const settingsRef = doc(serverDb, 'isgg_metadata', 'settings');
    await setDoc(settingsRef, {
      smtpConfigEncrypted: encryptedData,
      smtpConfigPublic: publicData,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    // Invalider le cache pour prise en compte immédiate
    invalidateSmtpCache();

    return res.json({
      success: true,
      message: 'Configuration SMTP enregistrée et testée avec succès ! Les emails OTP sont immédiatement opérationnels.',
      config: publicData,
    });
  } catch (err: any) {
    console.error('[Admin SMTP Update] Erreur:', err);
    return res.status(500).json({ success: false, error: 'Erreur lors de l\'enregistrement SMTP.' });
  }
});

// Envoi d'un email de test en direct pour l'administrateur
app.post('/api/admin/smtp/test', rateLimit(60000, 5, 'smtp-test-email'), async (req, res) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[SESSION_COOKIE_NAME];
    const session = token ? verifySessionToken(token) : null;
    if (!session || session.role !== 'ADMIN') {
      return res.status(403).json({ success: false, error: 'Accès réservé aux administrateurs.' });
    }

    const { targetEmail } = req.body;
    const cleanTarget = String(targetEmail || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanTarget)) {
      return res.status(400).json({ success: false, error: 'Adresse email de test invalide.' });
    }

    const mailConfig = await getMailTransporterAsync();
    if (!mailConfig) {
      return res.status(400).json({ success: false, error: 'Aucun serveur SMTP configuré.' });
    }

    const info = await mailConfig.transporter.sendMail({
      from: `"${mailConfig.fromName}" <${mailConfig.user}>`,
      to: cleanTarget,
      subject: '[ISGG] Test officiel de transmission SMTP réussi',
      text: `Félicitations !\n\nLe serveur SMTP institutionnel ISGG (${mailConfig.user}) est parfaitement connecté et configuré pour acheminer tous les codes OTP et alertes d'absences.\n\nDate : ${new Date().toLocaleString('fr-FR')}\nDirection des Systèmes d'Information - ISGG Calavi, Bénin`,
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 24px; color: #0f172a;">
          <div style="max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
            <div style="background: #0f172a; padding: 20px 24px; border-bottom: 4px solid #ea580c;">
              <h2 style="color: #ffffff; margin: 0; font-size: 18px;">ISGG <span style="color: #ea580c;">ABSENCES</span></h2>
              <p style="color: #94a3b8; font-size: 11px; margin: 4px 0 0 0; text-transform: uppercase;">Validation Serveur SMTP</p>
            </div>
            <div style="padding: 24px;">
              <h3 style="color: #166534; font-size: 16px; margin-top: 0;">✅ Serveur SMTP opérationnel</h3>
              <p style="font-size: 13px; line-height: 1.6; color: #334155;">
                Ce message certifie que le serveur SMTP institutionnel est correctement connecté et que les emails (codes OTP d'inscription, alertes de réinitialisation) sont acheminés en direct dans les boîtes de réception.
              </p>
              <div style="background: #f1f5f9; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #475569; margin: 16px 0;">
                <div><strong>Compte expéditeur :</strong> ${mailConfig.user}</div>
                <div><strong>Serveur :</strong> ${mailConfig.host}:${mailConfig.port} (SSL/TLS)</div>
                <div><strong>Horodatage :</strong> ${new Date().toLocaleString('fr-FR')}</div>
              </div>
              <p style="font-size: 11px; color: #64748b;">
                Direction des Systèmes d'Information &bull; ISGG Calavi, Bénin
              </p>
            </div>
          </div>
        </div>
      `.trim(),
    });

    return res.json({
      success: true,
      messageId: info.messageId,
      message: `Email de test expédié avec succès à ${cleanTarget}. Vérifiez votre boîte de réception !`,
    });
  } catch (testErr: any) {
    console.error('[Admin SMTP Test] Erreur:', testErr);
    return res.status(500).json({
      success: false,
      error: testErr?.message || 'Erreur lors de l\'envoi de l\'email de test.',
    });
  }
});

// ==========================================
// DATA PROTECTION CRYPTO API (AES-256-GCM)
// ==========================================
app.post('/api/crypto/encrypt', rateLimit(60000, 60, 'crypto-enc'), (req, res) => {
  const { text } = req.body;
  if (typeof text !== 'string') return res.status(400).json({ error: 'Texte requis' });
  const encrypted = encryptWithServerKey(text);
  return res.json({ success: true, encrypted });
});

app.post('/api/crypto/decrypt', rateLimit(60000, 60, 'crypto-dec'), (req, res) => {
  const { encryptedText } = req.body;
  if (typeof encryptedText !== 'string') return res.status(400).json({ error: 'Texte chiffré requis' });
  const decrypted = decryptWithServerKey(encryptedText);
  return res.json({ success: true, decrypted });
});

// ==========================================
// API REST DE SYNCHRONISATION ÉTUDIANTS ISGG
// ==========================================

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

  // 1. Clé configurée dans l'environnement (Timing-safe comparison)
  const envKey = (process.env.ISGG_SYNC_API_KEY || '').trim();
  if (envKey && secureCompare(incomingKey, envKey)) return true;

  // 2. Clé configurée dans les paramètres Firestore (Timing-safe comparison)
  try {
    const settingsDoc = await getDoc(doc(serverDb, 'isgg_metadata', 'settings'));
    if (settingsDoc.exists()) {
      const data = settingsDoc.data();
      if (data?.syncApiKey && secureCompare(incomingKey, data.syncApiKey.trim())) {
        return true;
      }
    }
  } catch (e) {
    console.warn('[Sync API] Erreur lecture settings Firestore:', e);
  }

  // 3. Aucune clé valide trouvée
  return false;
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
    const now = new Date().toISOString();

    const processedStudents: any[] = [];
    const BATCH_SIZE = 400;
    const batches: Array<ReturnType<typeof writeBatch>> = [];
    let currentBatch = writeBatch(serverDb);
    let currentOps = 0;

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

      if (currentOps >= BATCH_SIZE) {
        batches.push(currentBatch);
        currentBatch = writeBatch(serverDb);
        currentOps = 0;
      }

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
        currentBatch.set(docRef, updatedStudent, { merge: true });
        currentOps++;
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
        currentBatch.set(docRef, newStudent);
        currentOps++;
        matriculeMap.set(safeMatricule.toUpperCase(), newStudent);
        createdCount++;
        processedStudents.push(newStudent);
      }
    }

    if (currentOps > 0) {
      batches.push(currentBatch);
    }

    if (createdCount > 0 || updatedCount > 0) {
      for (const b of batches) {
        await b.commit();
      }

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
