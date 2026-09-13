import React, { useState } from 'react';
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
  CheckCircle2
} from 'lucide-react';
import { Logo } from '../common/Logo';
import { User } from '../../types';
import { storage } from '../../lib/storage';

interface LoginPageProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [identifier, setIdentifier] = useState('m.diallo@isgg-edu.com');
  const [password, setPassword] = useState('••••••••••');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    setTimeout(() => {
      // Find matching user or fallback to Diallo
      const users = storage.getUsers();
      const matched = users.find(
        u => u.email.toLowerCase() === identifier.trim().toLowerCase() ||
             u.name.toLowerCase().includes(identifier.trim().toLowerCase())
      );

      if (matched) {
        storage.setCurrentUser(matched);
        onLoginSuccess(matched);
      } else {
        // Log in default surveillant if generic
        const defaultUser = users[0];
        storage.setCurrentUser(defaultUser);
        onLoginSuccess(defaultUser);
      }
      setLoading(false);
    }, 400);
  };

  const handleQuickLogin = (role: 'SURVEILLANT' | 'ADMIN') => {
    const users = storage.getUsers();
    const user = users.find(u => u.role === role) || users[0];
    setIdentifier(user.email);
    setPassword('demo2026');
    storage.setCurrentUser(user);
    onLoginSuccess(user);
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#F8FAFC]">
      {/* Left Column: Branding, Imagery & Core Values */}
      <div className="lg:w-7/12 p-8 lg:p-14 flex flex-col justify-between relative bg-white overflow-hidden border-r border-slate-200/80">
        {/* Subtle orange ambient background glow */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-orange-100/50 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 -right-40 w-96 h-96 bg-amber-50/60 rounded-full blur-3xl pointer-events-none" />

        {/* Top: ISGG Official Logo */}
        <div className="relative z-10">
          <Logo variant="dark" size="lg" />
        </div>

        {/* Main Headline */}
        <div className="mt-12 lg:mt-16 max-w-xl">
          <h1 className="text-4xl lg:text-5xl font-black text-slate-950 tracking-tight leading-tight">
            ISGG <span className="text-[#EA580C]">Absences</span>
          </h1>
          <p className="text-xl lg:text-2xl font-bold text-slate-800 mt-2">
            Plateforme de suivi de l&apos;assiduité des étudiants
          </p>
          <p className="text-base text-slate-600 mt-3 font-normal leading-relaxed">
            Une solution institutionnelle conçue pour l&apos;enregistrement ultra-rapide des présences,
            le suivi rigoureux des filières de génie civil et de gestion, et la traçabilité administrative en temps réel.
          </p>
        </div>

        {/* Center: Modern Lecture Hall Photo */}
        <div className="relative z-10 my-8">
          <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-slate-200/90 group">
            <img 
              src="https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?w=1200&auto=format&fit=crop&q=80" 
              alt="Campus ISGG Institut Supérieur de Génie Civil et de Gestion" 
              className="w-full h-56 lg:h-64 object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent flex items-end p-6">
              <div className="text-white">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EA580C] text-xs font-bold uppercase tracking-wider mb-2 shadow-sm">
                  <Building2 className="w-3.5 h-3.5" /> UNIVERSITE
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

      {/* Right Column: High-End Login Card */}
      <div className="lg:w-5/12 flex items-center justify-center p-6 lg:p-12 relative bg-[#F8FAFC]">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200/90 p-8 lg:p-10 relative">
          
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
              Se connecter
            </h2>
            <p className="text-sm font-medium text-slate-500 mt-1.5">
              Accédez à votre espace surveillant ou administration
            </p>
          </div>

          {/* Error notice */}
          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Identifiant */}
            <div>
              <label 
                htmlFor="identifiant-input"
                className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2"
              >
                Identifiant ou Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <UserIcon className="w-5 h-5" />
                </div>
                <input
                  id="identifiant-input"
                  type="text"
                  required
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="ex: m.diallo@isgg-edu.com"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Mot de passe */}
            <div>
              <label 
                htmlFor="password-input"
                className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2"
              >
                Mot de passe
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  id="password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Entrez votre mot de passe"
                  className="w-full pl-11 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] focus:bg-white transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
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
                onClick={() => alert('Veuillez contacter le secrétariat administratif de l\'ISGG pour réinitialiser vos identifiants.')}
                className="text-[#EA580C] font-semibold hover:underline"
              >
                Mot de passe oublié ?
              </button>
            </div>

            {/* Primary Submit Button */}
            <button
              id="login-submit-button"
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 px-6 rounded-xl font-bold text-white bg-[#EA580C] hover:bg-[#D94600] active:scale-[0.99] transition-all shadow-lg shadow-orange-600/30 flex items-center justify-center gap-2 text-base cursor-pointer disabled:opacity-75"
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
          </form>

          {/* Quick Demo Access (for evaluation) */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 text-center mb-3">
              Accès démo rapide en 1 clic
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                id="quick-login-surveillant"
                onClick={() => handleQuickLogin('SURVEILLANT')}
                className="p-2.5 rounded-xl border border-orange-200 bg-orange-50/60 hover:bg-orange-100 text-left transition-all"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#EA580C]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Surveillant</span>
                </div>
                <p className="text-[11px] text-slate-600 font-medium mt-0.5">M. Diallo</p>
              </button>

              <button
                type="button"
                id="quick-login-admin"
                onClick={() => handleQuickLogin('ADMIN')}
                className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left transition-all"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Admin</span>
                </div>
                <p className="text-[11px] text-slate-600 font-medium mt-0.5">Dr. K. Mensah</p>
              </button>
            </div>
          </div>

          {/* Card Footer */}
          <div className="mt-8 text-center text-xs text-slate-400 font-medium">
            Institut Supérieur de Génie Civil et de Gestion
          </div>
        </div>
      </div>
    </div>
  );
};
