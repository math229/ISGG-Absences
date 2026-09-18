import React, { useState, useEffect } from 'react';
import { 
  Key, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink, 
  Trash2, 
  X, 
  Eye, 
  EyeOff, 
  Sparkles,
  Zap,
  Shield,
  Loader2
} from 'lucide-react';
import { useToast } from './Toast';

export interface UserAiConfig {
  provider: 'gemini' | 'openai' | 'anthropic';
  apiKey: string;
  savedAt?: string;
}

interface ApiKeyConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: () => void;
}

export const ApiKeyConfigModal: React.FC<ApiKeyConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
}) => {
  const { showToast } = useToast();

  const [provider, setProvider] = useState<'gemini' | 'openai' | 'anthropic'>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [hasExistingKey, setHasExistingKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTestResult(null);
      try {
        const stored = localStorage.getItem('isgg_user_ai_config');
        if (stored) {
          const cfg = JSON.parse(stored) as UserAiConfig;
          if (cfg.apiKey) {
            setProvider(cfg.provider || 'gemini');
            setApiKey(cfg.apiKey);
            setHasExistingKey(true);
            return;
          }
        }
      } catch {}
      setApiKey('');
      setHasExistingKey(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestKey = async () => {
    if (!apiKey.trim()) {
      showToast('Veuillez saisir votre clé API avant de tester.', 'info');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/ai/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          provider,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({ success: true, message: data.message || 'Clé validée avec succès !' });
        showToast(data.message || 'Clé API fonctionnelle !', 'success');
      } else {
        setTestResult({ success: false, message: data.error || 'Clé refusée par le fournisseur.' });
        showToast(data.error || 'Erreur lors du test de la clé.', 'error');
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err?.message || 'Impossible de joindre le serveur de vérification.' });
      showToast('Erreur réseau lors de la vérification.', 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    if (!apiKey.trim()) {
      showToast('Veuillez saisir votre clé API.', 'info');
      return;
    }

    const config: UserAiConfig = {
      provider,
      apiKey: apiKey.trim(),
      savedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem('isgg_user_ai_config', JSON.stringify(config));
      setHasExistingKey(true);
      showToast(`Clé ${provider.toUpperCase()} enregistrée avec succès !`, 'success');
      if (onConfigSaved) onConfigSaved();
      onClose();
    } catch {
      showToast('Erreur lors de l\'enregistrement local.', 'error');
    }
  };

  const handleRemove = () => {
    try {
      localStorage.removeItem('isgg_user_ai_config');
      setApiKey('');
      setHasExistingKey(false);
      setTestResult(null);
      showToast('Clé personnalisée supprimée. Retour au moteur IA par défaut.', 'info');
      if (onConfigSaved) onConfigSaved();
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Clé API Personnelle (BYOK)
                <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Prioritaire
                </span>
              </h2>
              <p className="text-xs text-slate-300 font-medium">
                Connectez votre compte Gemini, ChatGPT ou Claude pour une disponibilité 100% garantie
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Provider tabs */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              1. Choisissez votre fournisseur d&apos;IA
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => { setProvider('gemini'); setTestResult(null); }}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all ${
                  provider === 'gemini'
                    ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 text-blue-900'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs mb-1">
                  G
                </div>
                <span className="text-xs font-bold">Google Gemini</span>
                <span className="text-[10px] text-blue-600 font-semibold mt-0.5">Recommandé</span>
              </button>

              <button
                type="button"
                onClick={() => { setProvider('openai'); setTestResult(null); }}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all ${
                  provider === 'openai'
                    ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-900'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs mb-1">
                  O
                </div>
                <span className="text-xs font-bold">OpenAI</span>
                <span className="text-[10px] text-slate-500 mt-0.5">ChatGPT / GPT-4o</span>
              </button>

              <button
                type="button"
                onClick={() => { setProvider('anthropic'); setTestResult(null); }}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all ${
                  provider === 'anthropic'
                    ? 'bg-amber-50/80 border-amber-500 ring-2 ring-amber-500/20 text-amber-900'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-xs mb-1">
                  A
                </div>
                <span className="text-xs font-bold">Anthropic</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Claude 3.5</span>
              </button>
            </div>
          </div>

          {/* Direct Link to get key */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-600 flex items-start gap-2.5">
            <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold text-slate-800">
                {provider === 'gemini' && 'Obtenez votre clé Gemini gratuitement sur Google AI Studio (aucun moyen de paiement requis).'}
                {provider === 'openai' && 'Générez votre clé sur OpenAI Platform (note : votre compte OpenAI doit avoir un solde de crédits actif sur platform.openai.com/billing).'}
                {provider === 'anthropic' && 'Générez votre clé API sur la console Anthropic.'}
              </span>
              <div className="mt-1">
                <a
                  href={
                    provider === 'gemini' 
                      ? 'https://aistudio.google.com/app/apikey' 
                      : provider === 'openai' 
                      ? 'https://platform.openai.com/api-keys' 
                      : 'https://console.anthropic.com/settings/keys'
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-bold text-indigo-600 hover:text-indigo-700 underline underline-offset-2"
                >
                  Ouvrir la page de génération de clé
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          {/* API Key input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              2. Collez votre clé API {provider === 'gemini' ? 'Gemini (AIza...)' : provider === 'openai' ? 'OpenAI (sk-...)' : 'Anthropic (sk-ant-...)'}
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setTestResult(null);
                }}
                placeholder={
                  provider === 'gemini' 
                    ? 'AIzaSy...' 
                    : provider === 'openai' 
                    ? 'sk-proj-...' 
                    : 'sk-ant-api03-...'
                }
                className="w-full pl-3 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Test result banner */}
          {testResult && (
            <div className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 animate-in fade-in duration-200 ${
              testResult.success 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}>
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="font-medium">
                {testResult.message}
              </div>
            </div>
          )}

          {/* Security note */}
          <div className="flex items-start gap-2 text-[11px] text-slate-500">
            <Shield className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <span>
              Votre clé est stockée localement dans votre navigateur et utilisée uniquement pour vos requêtes d&apos;analyse de fiches. Elle n&apos;est jamais partagée ni enregistrée en clair sur un serveur public.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between gap-3">
          <div>
            {hasExistingKey && (
              <button
                type="button"
                onClick={handleRemove}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-100/60 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Supprimer la clé
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isTesting || !apiKey.trim()}
              onClick={handleTestKey}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition-colors shadow-xs"
            >
              {isTesting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                  Test en cours...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Tester la clé
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={!apiKey.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#EA580C] hover:bg-[#C2410C] text-white disabled:opacity-50 transition-colors shadow-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Enregistrer et Utiliser
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
