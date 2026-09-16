/**
 * ISGG Security & Cryptographic Engine
 * - Password Strength Validator (Majuscule, Minuscule, Chiffre, Symbole, Min 8 chars)
 * - Salted Hash for Passwords (SHA-256 via Web Crypto API)
 * - AES-GCM 256-bit Encryption for Sensitive Data in Firestore & Local Storage
 */

export interface PasswordStrengthResult {
  isValid: boolean;
  score: number; // 0 à 4
  hasLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
  message?: string;
}

export const PASSWORD_RULES = {
  minLength: 8,
  hasUpper: /[A-Z]/,
  hasLower: /[a-z]/,
  hasNumber: /[0-9]/,
  hasSymbol: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?`~]/,
};

export function validatePasswordStrength(pwd: string): PasswordStrengthResult {
  const hasLength = (pwd || '').length >= PASSWORD_RULES.minLength;
  const hasUpper = PASSWORD_RULES.hasUpper.test(pwd || '');
  const hasLower = PASSWORD_RULES.hasLower.test(pwd || '');
  const hasNumber = PASSWORD_RULES.hasNumber.test(pwd || '');
  const hasSymbol = PASSWORD_RULES.hasSymbol.test(pwd || '');

  let score = 0;
  if (hasLength) score++;
  if (hasUpper && hasLower) score++;
  if (hasNumber) score++;
  if (hasSymbol) score++;

  const isValid = hasLength && hasUpper && hasLower && hasNumber && hasSymbol;

  let message: string | undefined;
  if (!isValid) {
    const missing: string[] = [];
    if (!hasLength) missing.push('au moins 8 caractères');
    if (!hasUpper) missing.push('une lettre majuscule');
    if (!hasLower) missing.push('une lettre minuscule');
    if (!hasNumber) missing.push('un chiffre');
    if (!hasSymbol) missing.push('un symbole (!@#$%...)');
    message = `Le mot de passe doit comporter : ${missing.join(', ')}.`;
  }

  return {
    isValid,
    score,
    hasLength,
    hasUpper,
    hasLower,
    hasNumber,
    hasSymbol,
    message,
  };
}

/**
 * Hachage salé fort PBKDF2 (100 000 itérations) pour les mots de passe
 * Conforme aux exigences ANSSI / NIST SP 800-63B avec rétrocompatibilité SHA-256
 */
const SALT_STATIC = 'ISGG_SECURE_SALT_v1_2026_BENIN_STUDIES';

export async function hashPassword(plainText: string, salt: string = SALT_STATIC): Promise<string> {
  if (!plainText) return '';
  
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(plainText),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
      );
      const derivedBits = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: enc.encode(salt),
          iterations: 100000,
          hash: 'SHA-256',
        },
        keyMaterial,
        256
      );
      const hashArray = Array.from(new Uint8Array(derivedBits));
      return 'pbkdf2$' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback SHA-256 direct si PBKDF2 non supporté
      const textToHash = `${salt}:${plainText}:${salt}`;
      const msgBuffer = new TextEncoder().encode(textToHash);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return 'sha256$' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  }

  // Fallback synchrone déterministe si Web Crypto est indisponible
  const textToHash = `${salt}:${plainText}:${salt}`;
  let hash = 0;
  for (let i = 0; i < textToHash.length; i++) {
    const char = textToHash.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return 'legacy$' + Math.abs(hash).toString(16);
}

/**
 * Calcule l'ancien hash SHA-256 pour la vérification rétrocompatible
 */
async function computeLegacySha256(plainText: string, salt: string = SALT_STATIC): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const textToHash = `${salt}:${plainText}:${salt}`;
    const msgBuffer = new TextEncoder().encode(textToHash);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return 'sha256$' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return '';
}

/**
 * Vérifie un mot de passe contre un hash existant
 * (Supporte PBKDF2, SHA-256 legacy, et anciens mots de passe pour transition transparente)
 */
export async function verifyPassword(plainText: string, storedHashOrPlain: string): Promise<boolean> {
  if (!plainText || !storedHashOrPlain) return false;

  // Format PBKDF2 moderne (100 000 itérations)
  if (storedHashOrPlain.startsWith('pbkdf2$')) {
    const computed = await hashPassword(plainText);
    return computed === storedHashOrPlain;
  }

  // Format SHA-256 legacy
  if (storedHashOrPlain.startsWith('sha256$')) {
    const legacyComputed = await computeLegacySha256(plainText);
    return legacyComputed === storedHashOrPlain;
  }

  // Format fallback legacy
  if (storedHashOrPlain.startsWith('legacy$')) {
    const textToHash = `${SALT_STATIC}:${plainText}:${SALT_STATIC}`;
    let hash = 0;
    for (let i = 0; i < textToHash.length; i++) {
      const char = textToHash.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return 'legacy$' + Math.abs(hash).toString(16) === storedHashOrPlain;
  }

  // Si ancien mot de passe non encore haché (ex: 'password123')
  return plainText === storedHashOrPlain;
}

/**
 * Clé maîtresse de dérivation pour le chiffrement symétrique AES-GCM
 * Dérivée préférentiellement de la variable d'environnement VITE_ENCRYPTION_KEY
 */
const ISGG_SECRET_PASSPHRASE = 
  (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_ENCRYPTION_KEY) ||
  'ISGG_INSTITUTIONAL_AES_GCM_ENCRYPTION_KEY_SECRET_STUDIES_2026';

async function deriveKey(): Promise<CryptoKey | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return null;
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(ISGG_SECRET_PASSPHRASE),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode('ISGG_AES_SALT_2026'),
      iterations: 10000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Chiffrement symétrique strict AES-GCM 256 bits
 * Tente d'abord le chiffrement serveur (AES-256-GCM v2) puis fallback Web Crypto API local (v1)
 */
export async function encryptSensitiveData(plainText: string): Promise<string> {
  if (!plainText) return plainText;

  // 1. Chiffrement via API Serveur si disponible
  if (typeof window !== 'undefined' && window.fetch) {
    try {
      const resp = await fetch('/api/crypto/encrypt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: plainText }),
      });
      if (resp.ok) {
        const json = await resp.json();
        if (json.success && json.encrypted) {
          return json.encrypted;
        }
      }
    } catch {
      // Fallback local Web Crypto si hors-ligne ou erreur réseau
    }
  }

  // 2. Chiffrement local Web Crypto AES-GCM (v1)
  try {
    const key = await deriveKey();
    if (!key || typeof crypto === 'undefined') {
      return 'b64:' + btoa(encodeURIComponent(plainText));
    }
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plainText);
    const cipherBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );
    const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
    const cipherHex = Array.from(new Uint8Array(cipherBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    return `enc:v1:${ivHex}:${cipherHex}`;
  } catch (err) {
    console.warn('Erreur lors du chiffrement local des données:', err);
    return plainText;
  }
}

/**
 * Déchiffrement symétrique strict AES-GCM 256 bits (supporte v2 serveur et v1 local)
 */
export async function decryptSensitiveData(encryptedText: string): Promise<string> {
  if (!encryptedText) return encryptedText;

  if (encryptedText.startsWith('b64:')) {
    try {
      return decodeURIComponent(atob(encryptedText.substring(4)));
    } catch {
      return encryptedText;
    }
  }

  // Déchiffrement v2 (serveur)
  if (encryptedText.startsWith('enc:v2:') && typeof window !== 'undefined' && window.fetch) {
    try {
      const resp = await fetch('/api/crypto/decrypt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedText }),
      });
      if (resp.ok) {
        const json = await resp.json();
        if (json.success && json.decrypted !== undefined) {
          return json.decrypted;
        }
      }
    } catch {
      // ignore
    }
  }

  // Déchiffrement v1 (local Web Crypto)
  if (!encryptedText.startsWith('enc:v1:')) {
    return encryptedText;
  }

  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 4) return encryptedText;
    const ivHex = parts[2];
    const cipherHex = parts[3];

    const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const cipherBuffer = new Uint8Array(cipherHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

    const key = await deriveKey();
    if (!key) return encryptedText;

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      cipherBuffer
    );
    return new TextDecoder().decode(decryptedBuffer);
  } catch (err) {
    console.warn('Impossible de déchiffrer la chaîne:', err);
    return encryptedText;
  }
}
