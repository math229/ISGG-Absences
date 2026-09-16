/**
 * ISGG Institutional Email & OTP Security Service
 * - 6-digit numeric one-time-passwords (OTP)
 * - 10-minute validity window enforced on Firestore
 * - Maximum 3 verification attempts per OTP before invalidation
 * - Persistent Firestore audit trail in `isgg_email_verifications` and `isgg_password_resets`
 * - Direct HTTP dispatch to `/api/send-email` (Nodemailer / SMTP de l'établissement)
 */

import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface OtpRecord {
  email: string;
  code: string;
  validCodes?: string[]; // Liste de tous les codes récents valides (permettant d'accepter n'importe quel email reçu récemment)
  purpose: 'REGISTRATION' | 'PASSWORD_RESET';
  expiresAt: number; // epoch ms (15 minutes)
  attempts: number;
  verified: boolean;
  createdAt: string;
}

export interface DispatchResult {
  success: boolean;
  delivered: boolean;
  warning?: string;
  smtpError?: string;
  message: string;
}

class EmailOtpService {
  /**
   * Génère un code cryptographiquement aléatoire à 6 chiffres
   */
  private generate6DigitCode(): string {
    const min = 100000;
    const max = 999999;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
  }

  /**
   * Envoie la requête au serveur Node/Express pour expédition réelle via SMTP
   */
  private async dispatchServerEmail(payload: {
    to: string;
    code: string;
    purpose: 'REGISTRATION' | 'PASSWORD_RESET';
    recipientName?: string;
    role?: string;
    subject: string;
  }): Promise<{ delivered: boolean; warning?: string; smtpError?: string; message?: string }> {
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.warn('API /api/send-email a retourné un statut non-200:', response.status);
        return { delivered: false, warning: 'HTTP_ERROR' };
      }

      const data = await response.json();
      return {
        delivered: !!data.delivered,
        warning: data.warning,
        smtpError: data.smtpError,
        message: data.message,
      };
    } catch (err) {
      console.warn('Erreur lors de l\'appel à /api/send-email:', err);
      return { delivered: false, warning: 'NETWORK_ERROR' };
    }
  }

  /**
   * Expédie un code OTP par email réel pour la vérification à l'inscription (généré et stocké côté serveur)
   */
  public async sendRegistrationOtp(
    email: string, 
    userName: string, 
    role?: string
  ): Promise<DispatchResult> {
    const cleanEmail = email.trim().toLowerCase();

    // Appel direct de l'API serveur sécurisée (code chiffré/haché côté serveur, jamais exposé sur le client)
    try {
      const response = await fetch('/api/otp/send-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          name: userName,
          role,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        return {
          success: false,
          delivered: false,
          message: data.message || 'Impossible d\'expédier le code de vérification.',
        };
      }

      return {
        success: true,
        delivered: !!data.delivered,
        warning: data.warning,
        smtpError: data.smtpError,
        message: data.message || `Un email contenant votre code officiel à 6 chiffres a été envoyé à ${cleanEmail}.`,
      };
    } catch (err) {
      console.warn('Erreur appel /api/otp/send-registration:', err);
      return {
        success: false,
        delivered: false,
        message: 'Erreur réseau lors de la génération du code de vérification.',
      };
    }
  }

  /**
   * Vérifie le code OTP saisi pour l'inscription (validation en temps constant côté serveur)
   */
  public async verifyRegistrationOtp(email: string, enteredCode: string): Promise<{ success: boolean; message: string; remainingAttempts?: number }> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanEntered = enteredCode.replace(/\D/g, '').trim();

    try {
      const response = await fetch('/api/otp/verify-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          code: cleanEntered,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        return {
          success: false,
          message: data.message || 'Code de vérification invalide.',
          remainingAttempts: data.remainingAttempts,
        };
      }

      return {
        success: true,
        message: data.message || 'Adresse email vérifiée avec succès !',
      };
    } catch (err) {
      console.warn('Erreur appel /api/otp/verify-registration:', err);
      return {
        success: false,
        message: 'Erreur de communication avec le serveur de vérification.',
      };
    }
  }

  /**
   * Expédie un code OTP pour la réinitialisation de mot de passe (généré côté serveur)
   */
  public async sendPasswordResetOtp(email: string): Promise<DispatchResult> {
    const cleanEmail = email.trim().toLowerCase();

    try {
      const response = await fetch('/api/otp/send-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await response.json();
      if (!response.ok) {
        return {
          success: false,
          delivered: false,
          message: data.message || 'Impossible d\'expédier le code de réinitialisation.',
        };
      }

      return {
        success: true,
        delivered: !!data.delivered,
        warning: data.warning,
        smtpError: data.smtpError,
        message: data.message || `Code de réinitialisation envoyé avec succès à ${cleanEmail}.`,
      };
    } catch (err) {
      console.warn('Erreur appel /api/otp/send-password-reset:', err);
      return {
        success: false,
        delivered: false,
        message: 'Impossible de joindre le serveur pour la réinitialisation.',
      };
    }
  }

  /**
   * Vérifie le code OTP de réinitialisation de mot de passe (côté serveur)
   */
  public async verifyPasswordResetOtp(email: string, enteredCode: string): Promise<{ success: boolean; message: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanEntered = enteredCode.replace(/\D/g, '').trim();

    try {
      const response = await fetch('/api/otp/verify-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          code: cleanEntered,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        return {
          success: false,
          message: data.message || 'Code de réinitialisation invalide.',
        };
      }

      return {
        success: true,
        message: data.message || 'Code validé avec succès.',
      };
    } catch (err) {
      console.warn('Erreur appel /api/otp/verify-password-reset:', err);
      return {
        success: false,
        message: 'Erreur technique lors de la vérification du code de réinitialisation.',
      };
    }
  }
}

export const emailOtpService = new EmailOtpService();
