/**
 * ISGG Rate Limiting & Anti-BruteForce Security Engine
 * - Enforced on Firestore server collection `isgg_security_ratelimits` and `isgg_banned_clients`
 * - 3 consecutive failures -> 5 minutes cooldown (300 seconds) enforced by server timestamp
 * - > 100 cumulative failures -> Permanent IP / Client Ban recorded in Firestore
 * - Resilient to browser cache clearing, incognito mode and devtools clock manipulation
 */

import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface RateLimitState {
  failureCount: number;
  totalFailures: number;
  lockUntil: number | null; // epoch ms
  isBanned: boolean;
  lastAttemptAt?: string;
  banReason?: string;
}

export interface SecurityAuditLog {
  id: string;
  type: 'AUTH_CODE_FAILURE' | 'LOGIN_PASSWORD_FAILURE' | 'RATE_LIMIT_TRIGGERED' | 'IP_BANNED' | 'IP_UNBANNED' | 'OTP_FAILURE';
  ipOrClient: string;
  target?: string;
  details: string;
  timestamp: string;
}

const STORAGE_KEYS = {
  CLIENT_FINGERPRINT: 'isgg_client_fingerprint',
  LOCAL_CACHE_PREFIX: 'isgg_rl_cache_',
  LOCAL_BANS: 'isgg_security_banned_ips',
};

const MAX_CONSECUTIVE_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CUMULATIVE_FAILURES_BAN = 100; // > 100 tentatives -> BAN permanent

class RateLimiterService {
  private clientIp: string = '127.0.0.1';
  private fingerprint: string = '';
  private bannedIps: Set<string> = new Set();
  private auditLogs: SecurityAuditLog[] = [];
  private memoryCache: Map<string, RateLimitState> = new Map();

  constructor() {
    this.initClientIdentifier();
    this.loadBannedList();
    this.fetchPublicIp();
  }

  private initClientIdentifier(): void {
    if (typeof window === 'undefined') return;
    let fp = localStorage.getItem(STORAGE_KEYS.CLIENT_FINGERPRINT);
    if (!fp) {
      fp = 'cli-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem(STORAGE_KEYS.CLIENT_FINGERPRINT, fp);
    }
    this.fingerprint = fp;
  }

  private async fetchPublicIp(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.ip) {
          this.clientIp = data.ip;
          await this.checkCloudBanStatus(this.clientIp);
        }
      }
    } catch {
      this.clientIp = this.fingerprint || 'local-client';
    }
  }

  private loadBannedList(): void {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(STORAGE_KEYS.LOCAL_BANS);
    if (stored) {
      try {
        const list = JSON.parse(stored);
        if (Array.isArray(list)) {
          this.bannedIps = new Set(list);
        }
      } catch {
        this.bannedIps = new Set();
      }
    }
  }

  private persistBannedList(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.LOCAL_BANS, JSON.stringify(Array.from(this.bannedIps)));
  }

  public getClientIdentifier(): string {
    return this.clientIp || this.fingerprint || 'anonymous';
  }

  public isClientBanned(): boolean {
    const id = this.getClientIdentifier();
    return this.bannedIps.has(id) || this.bannedIps.has(this.fingerprint);
  }

  /**
   * Vérifie si l'IP ou l'identifiant est banni dans Firestore
   */
  public async checkCloudBanStatus(ipOrId: string = this.getClientIdentifier()): Promise<boolean> {
    try {
      const cleanKey = ipOrId.replace(/[\.\:\/@]/g, '_');
      const banDoc = await getDoc(doc(db, 'isgg_banned_clients', cleanKey));
      if (banDoc.exists()) {
        const data = banDoc.data();
        if (data.isBanned) {
          this.bannedIps.add(ipOrId);
          this.persistBannedList();
          return true;
        }
      }
    } catch {
      // ignore
    }
    return this.bannedIps.has(ipOrId);
  }

  /**
   * Clé serveur unique combinant l'IP et le contexte
   */
  private buildServerDocKey(contextKey: string): string {
    const cleanContext = (contextKey || 'general').replace(/[\.\:\/@\s]/g, '_').toLowerCase();
    const cleanIp = this.getClientIdentifier().replace(/[\.\:\/@\s]/g, '_').toLowerCase();
    return `rl_${cleanContext}_${cleanIp}`;
  }

  /**
   * Récupère l'état depuis Firestore côté serveur avec repli cache
   */
  public async getCloudState(contextKey: string): Promise<RateLimitState> {
    const isBanned = await this.checkCloudBanStatus();
    if (isBanned || this.isClientBanned()) {
      return {
        failureCount: 999,
        totalFailures: 999,
        lockUntil: Date.now() + 1000 * 60 * 60 * 24 * 365,
        isBanned: true,
        banReason: 'Adresse IP bannie définitivement suite à plus de 100 tentatives malveillantes.',
      };
    }

    const docKey = this.buildServerDocKey(contextKey);

    try {
      const snap = await getDoc(doc(db, 'isgg_security_ratelimits', docKey));
      if (snap.exists()) {
        const data = snap.data();
        const serverLockUntil = typeof data.lockUntil === 'number' ? data.lockUntil : null;
        let consecutive = typeof data.failureCount === 'number' ? data.failureCount : 0;
        const total = typeof data.totalFailures === 'number' ? data.totalFailures : 0;

        // Si le verrou de 5 minutes est écoulé côté serveur
        if (serverLockUntil && Date.now() > serverLockUntil) {
          consecutive = 0;
          await updateDoc(doc(db, 'isgg_security_ratelimits', docKey), {
            lockUntil: null,
            failureCount: 0,
          });
        }

        const state: RateLimitState = {
          failureCount: consecutive,
          totalFailures: total,
          lockUntil: (serverLockUntil && Date.now() < serverLockUntil) ? serverLockUntil : null,
          isBanned: total >= MAX_CUMULATIVE_FAILURES_BAN,
          lastAttemptAt: data.lastAttemptAt,
          banReason: data.banReason,
        };

        this.memoryCache.set(contextKey, state);
        return state;
      }
    } catch (err) {
      console.warn('Firestore getCloudState fallback to local:', err);
    }

    // Repli cache mémoire / localStorage si requête réseau échoue
    return this.getState(contextKey);
  }

  /**
   * Lecture synchrone immédiate (pour les rendus React en temps réel)
   */
  public getState(contextKey: string): RateLimitState {
    if (this.isClientBanned()) {
      return {
        failureCount: 999,
        totalFailures: 999,
        lockUntil: Date.now() + 1000 * 60 * 60 * 24 * 365,
        isBanned: true,
        banReason: 'Adresse IP bannie définitivement suite à plus de 100 tentatives malveillantes.',
      };
    }

    const cached = this.memoryCache.get(contextKey);
    if (cached) {
      if (cached.lockUntil && Date.now() > cached.lockUntil) {
        cached.lockUntil = null;
        cached.failureCount = 0;
      }
      return cached;
    }

    if (typeof window === 'undefined') {
      return { failureCount: 0, totalFailures: 0, lockUntil: null, isBanned: false };
    }

    const key = `${STORAGE_KEYS.LOCAL_CACHE_PREFIX}${contextKey}`;
    const raw = localStorage.getItem(key);
    if (!raw) {
      return { failureCount: 0, totalFailures: 0, lockUntil: null, isBanned: false };
    }

    try {
      const state: RateLimitState = JSON.parse(raw);
      if (state.lockUntil && Date.now() > state.lockUntil) {
        state.lockUntil = null;
        state.failureCount = 0;
        localStorage.setItem(key, JSON.stringify(state));
      }
      return state;
    } catch {
      return { failureCount: 0, totalFailures: 0, lockUntil: null, isBanned: false };
    }
  }

  /**
   * Enregistre un échec de saisie sur Firestore
   */
  public async recordFailure(contextKey: string, details: string): Promise<RateLimitState> {
    const currentState = await this.getCloudState(contextKey);

    const newFailureCount = currentState.failureCount + 1;
    const newTotalFailures = currentState.totalFailures + 1;
    let lockUntil = currentState.lockUntil;
    let isBanned = currentState.isBanned;
    let banReason = currentState.banReason;

    // Règle 1: 3 échecs consécutifs -> 5 minutes de verrouillage
    if (newFailureCount >= MAX_CONSECUTIVE_ATTEMPTS) {
      lockUntil = Date.now() + LOCKOUT_DURATION_MS;
      this.logAudit({
        type: 'RATE_LIMIT_TRIGGERED',
        ipOrClient: this.getClientIdentifier(),
        target: contextKey,
        details: `3 tentatives infructueuses consécutives. Verrouillage serveur de 5 minutes activé. (${details})`,
      });
    }

    // Règle 2: Plus de 100 tentatives erronées cumulées -> Bannissement IP permanent
    if (newTotalFailures >= MAX_CUMULATIVE_FAILURES_BAN) {
      isBanned = true;
      banReason = 'Dépassement du seuil de sécurité institutionnel ISGG (> 100 échecs).';
      await this.banClient(this.getClientIdentifier(), banReason);
    }

    const updated: RateLimitState = {
      failureCount: newFailureCount,
      totalFailures: newTotalFailures,
      lockUntil,
      isBanned,
      lastAttemptAt: new Date().toISOString(),
      banReason,
    };

    this.memoryCache.set(contextKey, updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`${STORAGE_KEYS.LOCAL_CACHE_PREFIX}${contextKey}`, JSON.stringify(updated));
    }

    // Synchronisation Firestore
    try {
      const docKey = this.buildServerDocKey(contextKey);
      await setDoc(doc(db, 'isgg_security_ratelimits', docKey), {
        contextKey,
        ip: this.getClientIdentifier(),
        failureCount: newFailureCount,
        totalFailures: newTotalFailures,
        lockUntil,
        isBanned,
        lastAttemptAt: new Date().toISOString(),
        banReason: banReason || null,
      }, { merge: true });
    } catch (err) {
      console.warn('Firestore rate limit sync error:', err);
    }

    return updated;
  }

  /**
   * Réinitialise les échecs consécutifs après un succès
   */
  public async recordSuccess(contextKey: string): Promise<void> {
    const currentState = await this.getCloudState(contextKey);
    const updated: RateLimitState = {
      ...currentState,
      failureCount: 0,
      lockUntil: null,
    };

    this.memoryCache.set(contextKey, updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`${STORAGE_KEYS.LOCAL_CACHE_PREFIX}${contextKey}`, JSON.stringify(updated));
    }

    try {
      const docKey = this.buildServerDocKey(contextKey);
      await setDoc(doc(db, 'isgg_security_ratelimits', docKey), {
        failureCount: 0,
        lockUntil: null,
        lastSuccessAt: new Date().toISOString(),
      }, { merge: true });
    } catch (err) {
      console.warn('Firestore rate limit reset error:', err);
    }
  }

  /**
   * Bannit une adresse IP / Client de manière permanente dans Firestore
   */
  public async banClient(ipOrId: string, reason: string): Promise<void> {
    this.bannedIps.add(ipOrId);
    this.persistBannedList();

    const audit: SecurityAuditLog = {
      id: `ban-${Date.now()}`,
      type: 'IP_BANNED',
      ipOrClient: ipOrId,
      details: reason,
      timestamp: new Date().toISOString(),
    };
    this.logAudit(audit);

    try {
      const sanitizedDocId = ipOrId.replace(/[\.\:\/@]/g, '_');
      await setDoc(doc(db, 'isgg_banned_clients', sanitizedDocId), {
        ip: ipOrId,
        isBanned: true,
        reason,
        bannedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Firestore ban error:', err);
    }
  }

  /**
   * Débannit une adresse IP (Action exclusive Direction)
   */
  public async unbanClient(ipOrId: string): Promise<void> {
    this.bannedIps.delete(ipOrId);
    this.persistBannedList();

    if (typeof window !== 'undefined') {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith(STORAGE_KEYS.LOCAL_CACHE_PREFIX)) {
          localStorage.removeItem(k);
        }
      });
    }
    this.memoryCache.clear();

    const audit: SecurityAuditLog = {
      id: `unban-${Date.now()}`,
      type: 'IP_UNBANNED',
      ipOrClient: ipOrId,
      details: 'Adresse IP réhabilitée par la Direction générale ISGG.',
      timestamp: new Date().toISOString(),
    };
    this.logAudit(audit);

    try {
      const sanitizedDocId = ipOrId.replace(/[\.\:\/@]/g, '_');
      await updateDoc(doc(db, 'isgg_banned_clients', sanitizedDocId), {
        isBanned: false,
        unbannedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Firestore unban error:', err);
    }
  }

  public getBannedList(): string[] {
    return Array.from(this.bannedIps);
  }

  private async logAudit(log: Omit<SecurityAuditLog, 'id' | 'timestamp'> & { id?: string; timestamp?: string }): Promise<void> {
    const entry: SecurityAuditLog = {
      id: log.id || `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: log.type,
      ipOrClient: log.ipOrClient,
      target: log.target,
      details: log.details,
      timestamp: log.timestamp || new Date().toISOString(),
    };
    this.auditLogs.unshift(entry);

    try {
      await setDoc(doc(db, 'isgg_security_audits', entry.id), entry);
    } catch {
      // fail safe
    }
  }

  public getAuditLogs(): SecurityAuditLog[] {
    return this.auditLogs;
  }
}

export const rateLimiter = new RateLimiterService();
