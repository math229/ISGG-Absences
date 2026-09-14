import React, { useState, useEffect } from 'react';
import { 
  User as UserIcon, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Award, 
  Lightbulb, 
  Briefcase, 
  ShieldCheck,
  Building2,
  Mail,
  UserPlus,
  LogIn,
  Shield,
  UserCheck,
  KeyRound,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  ArrowLeft,
  Check
} from 'lucide-react';
import { Logo } from '../common/Logo';
import { User, UserRole } from '../../types';
import { storage } from '../../lib/storage';
import { validatePasswordStrength } from '../../lib/crypto';
import { rateLimiter } from '../../lib/rateLimiter';
import { PasswordResetModal } from './PasswordResetModal';

interface LoginPageProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Forgot password modal
  const [showResetModal, setShowResetModal] = useState(false);

  // Register form state
  const [regStep, setRegStep] = useState<'form' | 'otp'>('form');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('SURVEILLANT');
  const [regTitle, setRegTitle] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regAuthCode, setRegAuthCode] = useState('');
  const [showRegAuthCode, setShowRegAuthCode] = useState(false);

  // Registration OTP state
  const [regOtpCode, setRegOtpCode] = useState('');
  const [regOtpExpirySec, setRegOtpExpirySec] = useState<number>(600); // 10 minutes
  const [regResendCooldown, setRegResendCooldown] = useState<number>(0);
  const [regSmtpStatus, setRegSmtpStatus] = useState<{ delivered?: boolean; warning?: string; debugCode?: string } | null>(null);

  // Status & feedback
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Rate Limiting & Lockout countdown state (enforced via server)
  const [lockRemainingSec, setLockRemainingSec] = useState<number | null>(null);
  const [isBannedClient, setIsBannedClient] = useState<boolean>(rateLimiter.isClientBanned());

  // Check rate limit status on Firestore server
  useEffect(() => {
    let isMounted = true;
    const checkLimits = async () => {
      const isBanned = await rateLimiter.checkCloudBanStatus();
      if (!isMounted) return;
      setIsBannedClient(isBanned || rateLimiter.isClientBanned());

      const activeKey = authMode === 'register' ? 'registration' : `login_${(loginIdentifier || '').trim().toLowerCase() || 'unknown'}`;
      const state = await rateLimiter.getCloudState(activeKey);
      if (!isMounted) return;

      if (state.lockUntil && Date.now() < state.lockUntil) {
        const sec = Math.ceil((state.lockUntil - Date.now()) / 1000);
        setLockRemainingSec(sec);
      } else {
        setLockRemainingSec(null);
      }
    };

    checkLimits();
    const interval = setInterval(checkLimits, 1500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [authMode, loginIdentifier]);

  // Expiry countdown for Registration OTP (10 min)
  useEffect(() => {
    if (regStep !== 'otp' || regOtpExpirySec <= 0) return;
    const timer = setInterval(() => {
      setRegOtpExpirySec(s => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [regStep, regOtpExpirySec]);

  // Resend cooldown timer for Registration OTP (60s)
  useEffect(() => {
    if (regResendCooldown <= 0) return;
    const timer = setInterval(() => {
      setRegResendCooldown(c => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [regResendCooldown]);

  // Dynamic password complexity evaluation
  const pwdStrength = validatePasswordStrength(regPassword);

  // Switch tabs cleanly
  const handleSwitchMode = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setRegStep('form');
    setError(null);
    setSuccessMessage(null);
  };

  // Format countdown mm:ss
  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Submit Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (isBannedClient) {
      setError('Accès définitivement refusé : Cette adresse IP / poste a été banni suite à un nombre excessif de tentatives malveillantes (> 100 échecs).');
      return;
    }

    if (lockRemainingSec && lockRemainingSec > 0) {
      setError(`Tentatives bloquées par le serveur. Veuillez patienter ${formatCountdown(lockRemainingSec)} avant de réessayer.`);
      return;
    }

    if (!loginIdentifier.trim()) {
      setError('Veuillez renseigner votre adresse email ou identifiant.');
      return;
    }
    if (!loginPassword) {
      setError('Veuillez renseigner votre mot de passe.');
      return;
    }

    setLoading(true);

    try {
      const result = await storage.authenticateUser(loginIdentifier, loginPassword);
      setLoading(false);

      if (result.success && result.user) {
        onLoginSuccess(result.user);
      } else {
        if (result.isBanned) {
          setIsBannedClient(true);
        }
        if (result.lockedUntil) {
          const sec = Math.ceil((result.lockedUntil - Date.now()) / 1000);
          setLockRemainingSec(sec);
        }
        setError(result.message || 'Identifiant ou mot de passe incorrect.');
      }
    } catch {
      setLoading(false);
      setError('Une erreur est survenue lors de la tentative de connexion.');
    }
  };

  // Step 1: Initiate Registration & send email OTP
  const handleRegisterInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (isBannedClient) {
      setError('Accès définitivement refusé : Cette adresse IP / poste a été banni suite à un nombre excessif de tentatives malveillantes (> 100 échecs).');
      return;
    }

    if (lockRemainingSec && lockRemainingSec > 0) {
      setError(`Inscription bloquée par le serveur pour 5 minutes suite à 3 codes erronés. Temps restant : ${formatCountdown(lockRemainingSec)}.`);
      return;
    }

    if (!regName.trim()) {
      setError('Veuillez renseigner votre nom et prénom.');
      return;
    }

    if (!regEmail.trim() || !regEmail.includes('@')) {
      setError('Veuillez renseigner une adresse email valide.');
      return;
    }

    if (!pwdStrength.isValid) {
      setError(pwdStrength.message || 'Le mot de passe doit comporter au moins 8 caractères, une majuscule, une minuscule, un chiffre et un symbole.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    if (!regAuthCode.trim()) {
      setError('Veuillez renseigner le code d\'habilitation institutionnel ISGG.');
      return;
    }

    setLoading(true);

    try {
      const result = await storage.initiateRegistration({
        name: regName,
        email: regEmail,
        role: regRole,
        title: regTitle.trim() || (regRole === 'ADMIN' ? 'Directeur / Administration' : 'Surveillant'),
        password: regPassword,
        authCode: regAuthCode.trim(),
      });

      setLoading(false);

      if (result.success) {
        setRegStep('otp');
        setRegOtpExpirySec(600);
        setRegResendCooldown(60);
        setRegSmtpStatus({
          delivered: result.delivered,
          warning: result.warning,
          debugCode: result.debugCode,
        });
        setSuccessMessage(`Un code de vérification à 6 chiffres a été généré pour ${regEmail.trim().toLowerCase()}.`);
      } else {
        if (result.isBanned) {
          setIsBannedClient(true);
        }
        if (result.lockedUntil) {
          const sec = Math.ceil((result.lockedUntil - Date.now()) / 1000);
          setLockRemainingSec(sec);
        }
        setError(result.message || 'Une erreur est survenue lors de l\'initialisation du compte.');
      }
    } catch {
      setLoading(false);
      setError('Erreur inattendue lors de la préparation de votre compte.');
    }
  };

  // Step 2: Verify Registration OTP & activate user
  const handleVerifyRegistrationOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (regOtpCode.trim().length !== 6) {
      setError('Veuillez renseigner le code complet à 6 chiffres reçu par email.');
      return;
    }

    setLoading(true);
    try {
      const result = await storage.completeRegistrationWithOtp(
        {
          name: regName,
          email: regEmail,
          role: regRole,
          title: regTitle.trim() || (regRole === 'ADMIN' ? 'Directeur / Administration' : 'Surveillant'),
          password: regPassword,
          authCode: regAuthCode.trim(),
        },
        regOtpCode.trim()
      );

      setLoading(false);

      if (result.success && result.user) {
        setSuccessMessage('Adresse email vérifiée ! Compte institutionnel activé avec succès.');
        setTimeout(() => {
          onLoginSuccess(result.user!);
        }, 700);
      } else {
        if (result.isBanned) {
          setIsBannedClient(true);
        }
        if (result.lockedUntil) {
          const sec = Math.ceil((result.lockedUntil - Date.now()) / 1000);
          setLockRemainingSec(sec);
        }
        setError(result.message || 'Code de vérification invalide ou expiré.');
      }
    } catch {
      setLoading(false);
      setError('Erreur technique lors de la validation du code.');
    }
  };

  // Resend Registration OTP
  const handleResendRegistrationOtp = async () => {
    if (regResendCooldown > 0 || loading) return;
    setError(null);
    setLoading(true);
    try {
      const result = await storage.initiateRegistration({
        name: regName,
        email: regEmail,
        role: regRole,
        title: regTitle.trim() || (regRole === 'ADMIN' ? 'Directeur / Administration' : 'Surveillant'),
        password: regPassword,
        authCode: regAuthCode.trim(),
      });
      setLoading(false);
      if (result.success) {
        setRegOtpExpirySec(600);
        setRegResendCooldown(60);
        setRegSmtpStatus({
          delivered: result.delivered,
          warning: result.warning,
          debugCode: result.debugCode,
        });
        setSuccessMessage('Un nouveau code de vérification a été transmis à votre adresse email.');
      } else {
        setError(result.message);
      }
    } catch {
      setLoading(false);
      setError('Erreur lors du renvoi du code.');
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#F8FAFC]">
      {/* Left Column: Branding, Imagery & Core Values */}
      <div className="lg:w-7/12 p-8 lg:p-14 flex flex-col justify-between relative bg-white overflow-hidden border-r border-slate-200/80">
        {/* Ambient background glows */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-orange-100/50 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 -right-40 w-96 h-96 bg-amber-50/60 rounded-full blur-3xl pointer-events-none" />

        {/* Top: ISGG Official Logo */}
        <div className="relative z-10">
          <Logo variant="dark" size="lg" />
        </div>

        {/* Main Headline */}
        <div className="mt-10 lg:mt-14 max-w-xl">
          <h1 className="text-4xl lg:text-5xl font-black text-slate-950 tracking-tight leading-tight">
            ISGG <span className="text-[#EA580C]">Absences</span>
          </h1>
          <p className="text-xl lg:text-2xl font-bold text-slate-800 mt-2">
            Plateforme de suivi de l&apos;assiduité des étudiants
          </p>
          <p className="text-base text-slate-600 mt-3 font-normal leading-relaxed">
            Une solution institutionnelle sécurisée conçue pour l&apos;enregistrement ultra-rapide des présences,
            le suivi rigoureux des filières de génie civil et de gestion, et la traçabilité administrative en temps réel.
          </p>
        </div>

        {/* Center: Modern Lecture Hall Photo */}
        <div className="relative z-10 my-6">
          <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-slate-200/90 group">
            <img 
              src="https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?w=1200&auto=format&fit=crop&q=80" 
              alt="Campus ISGG Institut Supérieur de Génie Civil et de Gestion" 
              className="w-full h-52 lg:h-60 object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent flex items-end p-6">
              <div className="text-white">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EA580C] text-xs font-bold uppercase tracking-wider mb-2 shadow-sm">
                  <Building2 className="w-3.5 h-3.5" /> UNIVERSITÉ
                </span>
                <p className="text-sm font-semibold text-slate-100">
                  Institut Supérieur de Génie Civil et de Gestion • Calavi
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom: Institutional Core Values */}
        <div className="relative z-10 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="flex items-center gap-2 text-slate-700">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-[#EA580C] flex-shrink-0">
              <Award className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold">Excellence</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-[#EA580C] flex-shrink-0">
              <Lightbulb className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold">Innovation</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-[#EA580C] flex-shrink-0">
              <Briefcase className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold">Professionnalisme</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-[#EA580C] flex-shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold">Engagement</span>
          </div>
        </div>
      </div>

      {/* Right Column: Authentication Card */}
      <div className="lg:w-5/12 flex items-center justify-center p-6 lg:p-12 relative bg-[#F8FAFC]">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200/90 p-7 lg:p-9 relative">
          
          {/* Top Mode Toggle: Connexion / Inscription */}
          <div className="flex items-center p-1 bg-slate-100 rounded-2xl mb-7">
            <button
              type="button"
              id="tab-login"
              onClick={() => handleSwitchMode('login')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                authMode === 'login'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>Connexion</span>
            </button>
            <button
              type="button"
              id="tab-register"
              onClick={() => handleSwitchMode('register')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                authMode === 'register'
                  ? 'bg-white text-[#EA580C] shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>Inscription</span>
            </button>
          </div>

          {/* Header */}
          <div className="mb-6">
            <h2 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
              {authMode === 'login' ? 'Se connecter' : 'Créer un compte'}
            </h2>
            <p className="text-sm font-medium text-slate-500 mt-1">
              {authMode === 'login'
                ? 'Accédez à votre espace institutionnel ISGG'
                : 'Enregistrez-vous comme Surveillant ou Directeur'}
            </p>
          </div>

          {/* Rate Limiting & Banned Warnings */}
          {isBannedClient && (
            <div className="mb-5 p-4 rounded-2xl bg-red-600 text-white shadow-lg shadow-red-500/20 space-y-1">
              <div className="flex items-center gap-2 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 text-amber-300" />
                <span>ACCÈS BLOQUÉ : ADRESSE IP BANNIE</span>
              </div>
              <p className="text-xs text-red-100 leading-relaxed">
                Plus de 100 tentatives non autorisées ont été détectées depuis votre poste ou adresse IP. Conformément à la politique de cybersécurité ISGG, votre accès est définitivement suspendu. Contactez la direction générale.
              </p>
            </div>
          )}

          {lockRemainingSec && lockRemainingSec > 0 && !isBannedClient && (
            <div className="mb-5 p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 shadow-sm flex items-start gap-3">
              <Clock className="w-5 h-5 text-[#EA580C] shrink-0 mt-0.5 animate-pulse" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-950">
                  Suspension temporaire de sécurité (3 échecs)
                </h4>
                <p className="text-xs text-amber-800">
                  Après 3 saisies erronées consécutives, les tentatives sont bloquées pendant 5 minutes.
                </p>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-xs font-mono font-bold text-[#EA580C]">
                  <span>Temps restant : {formatCountdown(lockRemainingSec)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Feedback banners */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold leading-relaxed">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold leading-relaxed">
              {successMessage}
            </div>
          )}

          {/* MODE: CONNEXION */}
          {authMode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {/* Identifiant ou Email */}
              <div>
                <label 
                  htmlFor="login-identifiant-input"
                  className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2"
                >
                  Adresse Email ou Identifiant
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    id="login-identifiant-input"
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={e => setLoginIdentifier(e.target.value)}
                    placeholder="ex: prenom.nom@isgg-edu.com"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Mot de passe */}
              <div>
                <label 
                  htmlFor="login-password-input"
                  className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2"
                >
                  Mot de passe
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="login-password-input"
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder="Saisissez votre mot de passe"
                    className="w-full pl-10 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showLoginPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Options */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 font-medium">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-[#EA580C] focus:ring-[#EA580C] border-slate-300 accent-[#EA580C]"
                  />
                  <span>Se souvenir de moi</span>
                </label>
                <button
                  type="button"
                  id="forgot-password-button"
                  onClick={() => setShowResetModal(true)}
                  className="text-[#EA580C] font-semibold hover:underline cursor-pointer"
                >
                  Mot de passe oublié ?
                </button>
              </div>

              {/* Submit Button */}
              <button
                id="login-submit-button"
                type="submit"
                disabled={loading || isBannedClient || Boolean(lockRemainingSec && lockRemainingSec > 0)}
                className="w-full mt-2 py-3.5 px-6 rounded-xl font-bold text-white bg-[#EA580C] hover:bg-[#D94600] active:scale-[0.99] transition-all shadow-lg shadow-orange-600/30 flex items-center justify-center gap-2 text-base cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Se connecter</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              <div className="pt-4 text-center">
                <p className="text-xs text-slate-500">
                  Pas encore de compte ?{' '}
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('register')}
                    className="text-[#EA580C] font-bold hover:underline"
                  >
                    Créer un compte Surveillant ou Directeur
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* MODE: INSCRIPTION (SURVEILLANT / DIRECTEUR) */}
          {authMode === 'register' && (
            <>
              {/* Registration Stepper Header */}
              <div className="mb-4 p-3 bg-orange-50/70 border border-orange-100 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    regStep === 'otp' ? 'bg-emerald-600 text-white' : 'bg-[#EA580C] text-white'
                  }`}>
                    {regStep === 'otp' ? '✓' : '1'}
                  </span>
                  <span className="font-bold text-slate-900">
                    {regStep === 'form' ? '1. Coordonnées' : '1. Coordonnées validées'}
                  </span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    regStep === 'otp' ? 'bg-[#EA580C] text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                    2
                  </span>
                  <span className={`font-bold ${regStep === 'otp' ? 'text-[#EA580C]' : 'text-slate-500'}`}>
                    2. Validation Email (OTP)
                  </span>
                </div>
              </div>

              {/* STEP 1: FORMULAIRE */}
              {regStep === 'form' && (
                <form onSubmit={handleRegisterInitiate} className="space-y-4">
              {/* Choix du rôle */}
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Profil professionnel
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    id="role-select-surveillant"
                    onClick={() => {
                      setRegRole('SURVEILLANT');
                      if (!regTitle || regTitle === 'Directeur des études' || regTitle === 'Directrice Pédagogique') {
                        setRegTitle('Surveillant général');
                      }
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      regRole === 'SURVEILLANT'
                        ? 'border-[#EA580C] bg-orange-50/60 ring-2 ring-[#EA580C]/20 shadow-sm'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                      <UserCheck className={`w-4 h-4 ${regRole === 'SURVEILLANT' ? 'text-[#EA580C]' : 'text-slate-400'}`} />
                      <span>Surveillant</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      Pointage et saisie des absences
                    </p>
                  </button>

                  <button
                    type="button"
                    id="role-select-admin"
                    onClick={() => {
                      setRegRole('ADMIN');
                      if (!regTitle || regTitle === 'Surveillant général' || regTitle === 'Surveillant') {
                        setRegTitle('Directeur des études');
                      }
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      regRole === 'ADMIN'
                        ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-600/20 shadow-sm'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                      <Shield className={`w-4 h-4 ${regRole === 'ADMIN' ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span>Directeur</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      Supervision, stats & rapports
                    </p>
                  </button>
                </div>
              </div>

              {/* Nom & Prénom */}
              <div>
                <label 
                  htmlFor="reg-name-input"
                  className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5"
                >
                  Nom et Prénom
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    id="reg-name-input"
                    type="text"
                    required
                    value={regName}
                    onChange={e => setRegName(e.target.value)}
                    placeholder="ex: Prénom et Nom de l'agent"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Titre / Fonction */}
              <div>
                <label 
                  htmlFor="reg-title-input"
                  className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5"
                >
                  Titre ou Fonction
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <input
                    id="reg-title-input"
                    type="text"
                    value={regTitle}
                    onChange={e => setRegTitle(e.target.value)}
                    placeholder={regRole === 'ADMIN' ? 'ex: Directeur des études' : 'ex: Surveillant général'}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Email institutionnel */}
              <div>
                <label 
                  htmlFor="reg-email-input"
                  className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5"
                >
                  Email professionnel / institutionnel
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="reg-email-input"
                    type="email"
                    required
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                    placeholder="ex: prenom.nom@isgg-edu.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Mot de passe et confirmation avec indicateurs de force */}
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label 
                      htmlFor="reg-password-input"
                      className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5"
                    >
                      Mot de passe
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-3.5 h-3.5" />
                      </div>
                      <input
                        id="reg-password-input"
                        type={showRegPassword ? 'text' : 'password'}
                        required
                        value={regPassword}
                        onChange={e => setRegPassword(e.target.value)}
                        placeholder="Mot de passe fort"
                        className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] focus:bg-white transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label 
                      htmlFor="reg-confirm-password-input"
                      className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5"
                    >
                      Confirmation
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-3.5 h-3.5" />
                      </div>
                      <input
                        id="reg-confirm-password-input"
                        type={showRegPassword ? 'text' : 'password'}
                        required
                        value={regConfirmPassword}
                        onChange={e => setRegConfirmPassword(e.target.value)}
                        placeholder="Confirmer"
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Checklist des exigences de sécurité du mot de passe */}
                {regPassword.length > 0 && (
                  <div className="mt-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <p className="text-[11px] font-bold text-slate-700">
                      Exigences obligatoires de sécurité :
                    </p>
                    <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                      <div className={`flex items-center gap-1.5 ${pwdStrength.hasLength ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                        {pwdStrength.hasLength ? <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" /> : <XCircle className="w-3 h-3 text-slate-400 shrink-0" />}
                        <span>8 caractères min.</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${pwdStrength.hasUpper ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                        {pwdStrength.hasUpper ? <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" /> : <XCircle className="w-3 h-3 text-slate-400 shrink-0" />}
                        <span>1 Majuscule (A-Z)</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${pwdStrength.hasLower ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                        {pwdStrength.hasLower ? <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" /> : <XCircle className="w-3 h-3 text-slate-400 shrink-0" />}
                        <span>1 Minuscule (a-z)</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${pwdStrength.hasNumber ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                        {pwdStrength.hasNumber ? <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" /> : <XCircle className="w-3 h-3 text-slate-400 shrink-0" />}
                        <span>1 Chiffre (0-9)</span>
                      </div>
                      <div className={`flex items-center gap-1.5 col-span-2 ${pwdStrength.hasSymbol ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                        {pwdStrength.hasSymbol ? <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" /> : <XCircle className="w-3 h-3 text-slate-400 shrink-0" />}
                        <span>1 Symbole spécial (!@#$%^&*...)</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Code d'habilitation institutionnel ISGG (strictement confidentiel, aucun bouton de pré-remplissage) */}
              <div className="p-3.5 bg-gradient-to-br from-amber-50/70 to-orange-50/50 border border-orange-200/90 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label 
                    htmlFor="reg-auth-code-input"
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-[#EA580C]" />
                    <span>Code d&apos;habilitation confidentiel</span>
                  </label>
                  <span className="text-[10px] font-bold text-orange-700 bg-white/90 px-2 py-0.5 rounded-full border border-orange-200/80 shadow-xs">
                    Rôle {regRole === 'ADMIN' ? 'Directeur' : 'Surveillant'}
                  </span>
                </div>

                <div className="relative">
                  <input
                    id="reg-auth-code-input"
                    type={showRegAuthCode ? 'text' : 'password'}
                    required
                    value={regAuthCode}
                    onChange={e => setRegAuthCode(e.target.value)}
                    placeholder="Saisissez la clé transmise par la Direction"
                    className="w-full pl-3.5 pr-10 py-2.5 bg-white border border-orange-200/90 rounded-lg text-xs font-mono font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] transition-all tracking-wider"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegAuthCode(!showRegAuthCode)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showRegAuthCode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="text-[11px] pt-0.5 text-slate-500">
                  <p className="leading-snug">
                    Clé nominative et confidentielle remise par la direction générale de l&apos;ISGG. Ne la communiquez jamais.
                  </p>
                </div>
              </div>

              {/* Submit Registration Step 1 */}
              <button
                id="register-submit-button"
                type="submit"
                disabled={loading || isBannedClient || Boolean(lockRemainingSec && lockRemainingSec > 0)}
                className="w-full mt-2 py-3.5 px-6 rounded-xl font-bold text-white bg-[#EA580C] hover:bg-[#D94600] active:scale-[0.99] transition-all shadow-lg shadow-orange-600/30 flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Continuer vers la validation par email</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <p className="text-xs text-slate-500">
                  Déjà enregistré ?{' '}
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('login')}
                    className="text-[#EA580C] font-bold hover:underline"
                  >
                    Connectez-vous ici
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* STEP 2: VALIDATION DU CODE OTP REÇU PAR MAIL */}
          {regStep === 'otp' && (
            <form onSubmit={handleVerifyRegistrationOtp} className="space-y-4">
              {/* Visual feedback box */}
              <div className="p-4 bg-orange-50/80 border border-orange-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-orange-950">
                    <Mail className="w-4 h-4 text-[#EA580C]" />
                    <span>Email de vérification envoyé</span>
                  </div>
                  <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-slate-600 bg-white px-2 py-0.5 rounded-md border border-orange-200">
                    <Clock className="w-3 h-3 text-[#EA580C]" />
                    <span>{formatCountdown(regOtpExpirySec)}</span>
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Un email institutionnel contenant votre code à 6 chiffres a été expédié à l&apos;adresse <strong className="text-slate-900 font-semibold">{regEmail}</strong>. Veuillez consulter votre boîte de réception pour valider votre compte.
                </p>

                {regSmtpStatus && !regSmtpStatus.delivered && (
                  <div className="pt-2 border-t border-orange-200/60 text-[11px] text-amber-900 bg-amber-50 p-2.5 rounded-xl border border-amber-200 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-amber-800">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>Serveur SMTP non encore configuré</span>
                    </div>
                    <p className="text-slate-600 leading-normal">
                      Pour acheminer les emails réels dans la boîte de réception Gmail, renseignez vos identifiants SMTP (ex: Gmail App Password) dans les réglages du projet.
                    </p>
                    {regSmtpStatus.debugCode && (
                      <div className="mt-1 flex items-center justify-between bg-white px-2.5 py-1 rounded border border-amber-200">
                        <span className="text-slate-600">Code de secours généré :</span>
                        <span className="font-mono font-bold text-[#EA580C]">{regSmtpStatus.debugCode}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 6-Digit Code Input */}
              <div>
                <label 
                  htmlFor="reg-otp-input"
                  className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 text-center"
                >
                  Saisir le code à 6 chiffres
                </label>
                <input
                  id="reg-otp-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  autoFocus
                  value={regOtpCode}
                  onChange={e => setRegOtpCode(e.target.value.replace(/\D/g, ''))}
                  onPaste={e => {
                    e.preventDefault();
                    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                    setRegOtpCode(text);
                  }}
                  placeholder="••••••"
                  className="w-full text-center py-3 bg-white border-2 border-orange-300 rounded-2xl text-2xl font-mono font-black tracking-[0.4em] text-slate-950 focus:outline-none focus:ring-4 focus:ring-[#EA580C]/20 focus:border-[#EA580C] transition-all"
                />
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setRegStep('form')}
                  className="px-3 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Modifier</span>
                </button>

                <button
                  type="submit"
                  disabled={loading || regOtpCode.trim().length !== 6}
                  className="flex-1 py-3 px-5 bg-[#EA580C] hover:bg-[#D94600] text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-orange-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Confirmer & Activer mon compte</span>
                      <ShieldCheck className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {/* Resend button */}
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={handleResendRegistrationOtp}
                  disabled={regResendCooldown > 0 || loading}
                  className="text-xs text-[#EA580C] font-semibold hover:underline disabled:text-slate-400 disabled:no-underline cursor-pointer flex items-center justify-center gap-1.5 mx-auto"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>
                    {regResendCooldown > 0
                      ? `Renvoyer le code par email (${regResendCooldown}s)`
                      : 'Renvoyer un nouveau code par email'}
                  </span>
                </button>
              </div>
            </form>
          )}
        </>
      )}

          {/* Institutional Card Footer */}
          <div className="mt-7 pt-4 border-t border-slate-100 text-center text-xs text-slate-400 font-medium">
            Institut Supérieur de Génie Civil et de Gestion • Accès Sécurisé
          </div>
        </div>
      </div>

      {/* Password Reset Modal */}
      <PasswordResetModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        initialEmail={loginIdentifier}
        onSuccess={(email) => {
          setLoginIdentifier(email);
          setAuthMode('login');
          setSuccessMessage('Votre mot de passe a été réinitialisé avec succès ! Vous pouvez maintenant vous connecter.');
        }}
      />
    </div>
  );
};
