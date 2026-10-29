/**
 * Page /reinitialiser-mot-de-passe
 *
 * Lit le `?token=` envoyé dans l'e-mail de réinitialisation, demande à
 * l'utilisateur un nouveau mot de passe et appelle `authApi.resetPassword`.
 * Affiche les états :
 *   - lien invalide (pas de token dans l'URL)
 *   - formulaire (token présent)
 *   - succès (avec CTA pour retourner à l'accueil / se connecter)
 *   - erreur (token expiré ou mot de passe rejeté par le backend)
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import SEO from './common/SEO';
import { authApi } from '../services/authApi';
import { BasePageProps } from '../types';

const LOGO_COLOR = 'https://www.moto-scoot.tn/site-logo/logo-color.svg';

const PASSWORD_MIN = 6;

const ResetPassword: React.FC<BasePageProps> = ({ onNavigate, onTriggerLogin }) => {
  // Read token from the URL once at mount — the rest of the lifecycle uses
  // local state so the form survives a re-render without re-reading the URL.
  const token = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('token') || '';
  }, []);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Live validation booleans (mirror what the backend enforces).
  const longEnough = password.length >= PASSWORD_MIN;
  const matches = password.length > 0 && password === confirm;
  const canSubmit = !!token && longEnough && matches && !submitting;

  // Scroll to top when the component mounts so the user lands on the form.
  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      await authApi.resetPassword({ token, password });
      setSuccess(true);
    } catch (err: any) {
      // Backend returns 400 with { error: "Invalid or expired token" } or
      // "Password must be at least 6 characters". Surface the raw message —
      // it's already user-friendly and in English; we wrap it in a French
      // sentence for context.
      const msg = err?.data?.error || err?.message || 'Une erreur est survenue.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Render branches ----------

  if (!token) {
    return (
      <PageShell>
        <SEO title="Lien invalide • Réinitialisation" description="Ce lien de réinitialisation est invalide ou incomplet." />
        <Card>
          <IconBadge tone="error"><AlertCircle className="w-7 h-7" /></IconBadge>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 mt-4 mb-2">Lien invalide</h1>
          <p className="text-gray-600 leading-relaxed mb-6">
            Ce lien de réinitialisation est incomplet. Veuillez recommencer la procédure depuis la page de connexion.
          </p>
          <Button variant="primary" className="w-full" onClick={() => onNavigate?.('home')}>
            Retour à l'accueil <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </Card>
      </PageShell>
    );
  }

  if (success) {
    return (
      <PageShell>
        <SEO title="Mot de passe réinitialisé • MotoScoot" description="Votre mot de passe a été modifié avec succès." />
        <Card>
          <IconBadge tone="success"><CheckCircle2 className="w-7 h-7" /></IconBadge>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 mt-4 mb-2">Mot de passe modifié</h1>
          <p className="text-gray-600 leading-relaxed mb-6">
            Votre nouveau mot de passe est en place. Vous pouvez maintenant vous connecter avec.
          </p>
          <div className="flex flex-col gap-3">
            <Button
              variant="primary"
              className="w-full"
              onClick={() => {
                onNavigate?.('home');
                // Pop the login modal once we're back on the home page.
                setTimeout(() => onTriggerLogin?.(), 50);
              }}
            >
              Se connecter <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
            <button
              type="button"
              onClick={() => onNavigate?.('home')}
              className="text-sm text-gray-500 hover:text-gray-700 transition"
            >
              Retour à l'accueil
            </button>
          </div>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <SEO
        title="Réinitialiser votre mot de passe • MotoScoot"
        description="Choisissez un nouveau mot de passe sécurisé pour accéder à votre compte MotoScoot."
      />
      <Card>
        <IconBadge tone="brand"><ShieldCheck className="w-7 h-7" /></IconBadge>
        <h1 className="text-2xl md:text-3xl font-black text-gray-900 mt-4 mb-2">Nouveau mot de passe</h1>
        <p className="text-gray-600 leading-relaxed mb-6">
          Choisissez un mot de passe d'au moins {PASSWORD_MIN} caractères pour votre compte MotoScoot.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
          <PasswordField
            label="Nouveau mot de passe"
            value={password}
            onChange={setPassword}
            show={showPwd}
            onToggle={() => setShowPwd((v) => !v)}
            autoFocus
          />
          <PasswordField
            label="Confirmer le mot de passe"
            value={confirm}
            onChange={setConfirm}
            show={showConfirm}
            onToggle={() => setShowConfirm((v) => !v)}
          />

          {/* Inline rules feedback */}
          <ul className="text-xs space-y-1 mt-1">
            <Rule ok={longEnough}>Au moins {PASSWORD_MIN} caractères</Rule>
            <Rule ok={matches}>Les deux mots de passe sont identiques</Rule>
          </ul>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                {error.toLowerCase().includes('invalid') || error.toLowerCase().includes('expired')
                  ? 'Ce lien a expiré ou n\'est plus valide. Veuillez demander un nouvel e-mail de réinitialisation.'
                  : error}
              </span>
            </div>
          )}

          <Button type="submit" variant="primary" className="w-full mt-2" disabled={!canSubmit}>
            {submitting ? 'Enregistrement…' : (
              <>Enregistrer le nouveau mot de passe <ArrowRight className="w-4 h-4 ml-1" /></>
            )}
          </Button>
        </form>

        <p className="text-xs text-gray-400 mt-6">
          Pour votre sécurité, ce lien expire 1 heure après son envoi.
        </p>
      </Card>
    </PageShell>
  );
};

export default ResetPassword;

// ---------- Local presentational helpers ----------

const PageShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 bg-gradient-to-br from-orange-50 via-white to-orange-50/30">
    <div className="w-full max-w-md">
      <div className="flex justify-center mb-6">
        <img src={LOGO_COLOR} alt="moto-scoot.tn" className="h-8 w-auto object-contain" />
      </div>
      {children}
    </div>
  </div>
);

const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 md:p-8 text-center">
    {children}
  </div>
);

const IconBadge: React.FC<{ children: React.ReactNode; tone: 'brand' | 'success' | 'error' }> = ({ children, tone }) => {
  const map: Record<string, string> = {
    brand: 'bg-orange-100 text-orange-600',
    success: 'bg-green-100 text-green-600',
    error: 'bg-red-100 text-red-600',
  };
  return (
    <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl ${map[tone]}`}>
      {children}
    </div>
  );
};

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  autoFocus?: boolean;
}
const PasswordField: React.FC<PasswordFieldProps> = ({ label, value, onChange, show, onToggle, autoFocus }) => (
  <div className="relative">
    <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
    <div className="relative">
      <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <Input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        autoComplete="new-password"
        className="pl-9 pr-10"
        placeholder="••••••••"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
        aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  </div>
);

const Rule: React.FC<{ ok: boolean; children: React.ReactNode }> = ({ ok, children }) => (
  <li className={`flex items-center gap-1.5 ${ok ? 'text-green-600' : 'text-gray-400'}`}>
    <CheckCircle2 className={`w-3.5 h-3.5 ${ok ? 'opacity-100' : 'opacity-50'}`} />
    <span>{children}</span>
  </li>
);
