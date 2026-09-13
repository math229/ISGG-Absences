import React, { useState, useEffect } from 'react';
import { 
  KeyRound, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ArrowRight, 
  ArrowLeft,
  X,
  RefreshCw,
  ShieldCheck,
  Clock,
  Check
} from 'lucide-react';
import { storage } from '../../lib/storage';
import { validatePasswordStrength } from '../../lib/crypto';

interface PasswordResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
  onSuccess: (email: string) => void;
}

export const PasswordResetModal: React.FC<PasswordResetModalProps> = ({
  isOpen,
  onClose,
  initialEmail = '',
  onSuccess,
}) => {
  const [step, setStep] = useState<'email' | 'verify' | 'done'>('email');
  const [email, setEmail] = useState(initialEmail);
  const [otpCode, setOtpCode] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [showAuthCode, setShowAuthCode] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [smtpStatus, setSmtpStatus] = useState<{ delivered?: boolean; warning?: string; debugCode?: string } | null>(null);

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  useEffect(() => {
    if (!isOpen) {
      setStep('email');
      setError(null);
      setSuccess(null);
      setOtpCode('');
      setNewPassword('');
      setConfirmPassword('');
      setAuthCode('');
    }
  }, [isOpen]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(c => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  if (!isOpen) return null;

  const pwdStrength = validatePasswordStrength(newPassword);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Veuillez renseigner une adresse email valide.');
      return;
    }

    setLoading(true);
    try {
      const res = await storage.requestPasswordResetOtp(cleanEmail);
      setLoading(false);

      if (res.success) {
        setStep('verify');
        setResendCooldown(60);
        setSmtpStatus({
          delivered: res.delivered,
          warning: res.warning,
          debugCode: res.debugCode,
        });
        setSuccess(`Un code de réinitialisation sécurisé à 6 chiffres a été préparé pour ${cleanEmail}.`);
      } else {
        setError(res.message || 'Impossible d\'envoyer le code de réinitialisation.');
      }
    } catch {
      setLoading(false);
      setError('Une erreur est survenue lors de l\'envoi du code.');
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await storage.requestPasswordResetOtp(email.trim().toLowerCase());
      setLoading(false);
      if (res.success) {
        setResendCooldown(60);
        setSmtpStatus({
          delivered: res.delivered,
          warning: res.warning,
          debugCode: res.debugCode,
        });
        setSuccess('Un nouveau code de vérification a été transmis.');
      } else {
        setError(res.message);
      }
    } catch {
      setLoading(false);
      setError('Erreur lors du renvoi du code.');
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (otpCode.trim().length !== 6) {
      setError('Le code de vérification doit comporter exactement 6 chiffres.');
      return;
    }

    if (!authCode.trim()) {
      setError('Le code d\'habilitation institutionnel (Directeur ou Surveillant) est obligatoire.');
      return;
    }

    if (!pwdStrength.isValid) {
      setError(pwdStrength.message || 'Le mot de passe ne respecte pas les critères requis.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    try {
      const res = await storage.resetPasswordWithOtp({
        email: email.trim().toLowerCase(),
        otpCode: otpCode.trim(),
        authCode: authCode.trim(),
        newPassword,
      });

      setLoading(false);
      if (res.success) {
        setStep('done');
        setTimeout(() => {
          onSuccess(email.trim().toLowerCase());
          onClose();
        }, 1800);
      } else {
        setError(res.message);
      }
    } catch {
      setLoading(false);
      setError('Une erreur est survenue lors de la réinitialisation.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#EA580C]/20 border border-[#EA580C]/40 flex items-center justify-center text-[#EA580C]">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Récupération de mot de passe</h2>
              <p className="text-[11px] text-slate-400">Procédure institutionnelle vérifiée ISGG</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {/* STEP 1: EMAIL REQUEST */}
          {step === 'email' && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Indiquez l&apos;adresse email associée à votre compte Surveillant ou Directeur. Un code de vérification à 6 chiffres valable 10 minutes vous sera expédié.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  Adresse Email Institutionnelle
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="directeur@isgg.bj ou surveillant@isgg.bj"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] transition-all"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-[#EA580C] hover:bg-[#D94600] text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-orange-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Recevoir le code de réinitialisation</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: VERIFY OTP + SET NEW PASSWORD */}
          {step === 'verify' && (
            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-orange-950">
                  <Mail className="w-4 h-4 text-[#EA580C]" />
                  <span>Email de sécurité envoyé</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Veuillez consulter votre messagerie électronique (<strong className="text-slate-900">{email}</strong>). Un code de sécurité à 6 chiffres valable 10 minutes vous a été envoyé pour autoriser la redéfinition de votre mot de passe.
                </p>

                {smtpStatus && !smtpStatus.delivered && (
                  <div className="mt-2 pt-2 border-t border-orange-200/60 text-[11px] text-amber-900 bg-amber-50 p-2.5 rounded-xl border border-amber-200 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-amber-800">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>Serveur SMTP non encore configuré</span>
                    </div>
                    <p className="text-slate-600 leading-normal">
                      Pour acheminer les emails réels dans la boîte de réception, renseignez les paramètres SMTP dans les variables d&apos;environnement.
                    </p>
                    {smtpStatus.debugCode && (
                      <div className="mt-1 flex items-center justify-between bg-white px-2.5 py-1 rounded border border-amber-200">
                        <span className="text-slate-600">Code de secours généré :</span>
                        <span className="font-mono font-bold text-[#EA580C]">{smtpStatus.debugCode}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Code OTP */}
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  Code de vérification (6 chiffres)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    onPaste={e => {
                      e.preventDefault();
                      const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                      setOtpCode(text);
                    }}
                    placeholder="Ex: 482915"
                    className="w-full text-center py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-mono font-bold tracking-widest text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] transition-all"
                  />
                </div>
              </div>

              {/* Code d'habilitation de rôle */}
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  Code d&apos;habilitation institutionnel
                </label>
                <div className="relative">
                  <input
                    type={showAuthCode ? 'text' : 'password'}
                    required
                    value={authCode}
                    onChange={e => setAuthCode(e.target.value)}
                    placeholder="Clé Directeur ou Surveillant"
                    className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAuthCode(!showAuthCode)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    {showAuthCode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Double validation de sécurité : votre clé institutionnelle attribuée.
                </p>
              </div>

              {/* Nouveau Mot de passe */}
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  Nouveau mot de passe
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Saisissez un mot de passe robuste"
                    className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Password Strength Checklist */}
                {newPassword && (
                  <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1 text-[10px]">
                    <div className="grid grid-cols-2 gap-1">
                      <div className={`flex items-center gap-1 ${pwdStrength.hasLength ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                        {pwdStrength.hasLength ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-slate-400" />}
                        <span>8 caractères min.</span>
                      </div>
                      <div className={`flex items-center gap-1 ${pwdStrength.hasUpper ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                        {pwdStrength.hasUpper ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-slate-400" />}
                        <span>1 Majuscule</span>
                      </div>
                      <div className={`flex items-center gap-1 ${pwdStrength.hasLower ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                        {pwdStrength.hasLower ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-slate-400" />}
                        <span>1 Minuscule</span>
                      </div>
                      <div className={`flex items-center gap-1 ${pwdStrength.hasNumber ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                        {pwdStrength.hasNumber ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-slate-400" />}
                        <span>1 Chiffre</span>
                      </div>
                      <div className={`flex items-center gap-1 col-span-2 ${pwdStrength.hasSymbol ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                        {pwdStrength.hasSymbol ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-slate-400" />}
                        <span>1 Symbole spécial (!@#$%...)</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirmer Nouveau Mot de passe */}
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  Confirmer le nouveau mot de passe
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Répétez le nouveau mot de passe"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] transition-all"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep('email')}
                  className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Retour</span>
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 px-4 bg-[#EA580C] hover:bg-[#D94600] text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-orange-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Valider le nouveau mot de passe</span>
                      <ShieldCheck className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {/* Resend OTP */}
              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || loading}
                  className="text-xs text-[#EA580C] font-semibold hover:underline disabled:text-slate-400 disabled:no-underline cursor-pointer flex items-center justify-center gap-1.5 mx-auto"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                  <span>
                    {resendCooldown > 0 
                      ? `Renvoyer un code dans ${resendCooldown}s` 
                      : 'Renvoyer un nouveau code'}
                  </span>
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: SUCCESS CONFIRMATION */}
          {step === 'done' && (
            <div className="py-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto animate-in zoom-in-50 duration-300">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Mot de passe réinitialisé !</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Votre mot de passe a été sécurisé et mis à jour. Redirection immédiate vers la page de connexion...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
