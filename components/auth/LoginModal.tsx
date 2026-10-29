import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Mail,
  Lock,
  ArrowRight,
  User,
  Building2,
  MapPin,
  Upload,
  CheckCircle2,
  Briefcase,
  AlertCircle,
  Phone,
  Loader2,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { useClerkGoogleSignIn } from '../../hooks/useClerkGoogleSignIn';
import CloudflareTurnstileMock from './CloudflareTurnstileMock';
import { useAuth } from '../../hooks/useAuth';
import { useGovernorates } from '../../hooks/useReferenceData';
import { useToast } from '../../context/ToastContext';
import { authApi } from '../../services/authApi';
import { compressImage } from '../../utils/imageCompression';
import {
  cleanPhoneInput,
  formatTunisiaPhone,
  isValidTunisiaPhone,
  TUNISIA_PHONE_ERROR,
} from '../../utils/phoneUtils';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (role?: 'user' | 'admin') => void;
}

type UserType = 'individual' | 'pro';

const AppleIcon = () => (
  <img
    src="https://www.moto-scoot.tn/site-logo/apple.svg"
    className="w-5 h-5 object-contain"
    alt="Apple"
  />
);

const GoogleIcon = () => (
  <img
    src="https://www.moto-scoot.tn/site-logo/googleColored.svg"
    className="w-5 h-5 object-contain"
    alt="Google"
  />
);


const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLogin }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [userType, setUserType] = useState<UserType>('individual');
  const [isDragging, setIsDragging] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  // We keep the actual File so we can upload it (multipart) at submit time.
  // The base64 preview was previously sent as `shop_logo`, which bloated the
  // request and never got persisted properly.
  const [logoFile, setLogoFile] = useState<File | null>(null);

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [city, setCity] = useState(''); // For Particulier this is the governorate.
  const [proGovernorate, setProGovernorate] = useState(''); // Pro-account governorate.
  const [shopName, setShopName] = useState('');
  // Pro accounts: split first/last name so the dashboard can pre-fill them.
  // We compose `full_name` from these two at submit time.
  const [proFirstName, setProFirstName] = useState('');
  const [proLastName, setProLastName] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneTouched, setPhoneTouched] = useState(false);
  // Lightweight "I'm not a robot" check. Not a real CAPTCHA, but blocks
  // form submission until the user actively confirms the box.
  const [notRobot, setNotRobot] = useState(false);
  const [robotError, setRobotError] = useState(false);

  const phoneError =
    isSignUp && phoneTouched && phone && !isValidTunisiaPhone(phone)
      ? TUNISIA_PHONE_ERROR
      : undefined;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const clerkGoogle = useClerkGoogleSignIn();
  const { data: governorates = [] } = useGovernorates();
  const { addToast } = useToast();
  const [forgotLoading, setForgotLoading] = useState(false);

  // We deliberately do NOT pass `onSuccess` here. If we did, the parent would
  // close this modal as soon as `register()` resolves — unmounting us mid-way
  // through the optional Pro logo upload (which runs *after* register so it
  // can authenticate). We trigger `onLogin('user')` ourselves at the end of
  // `handleSubmit`, once every dependent step (logo upload + profile patch)
  // has finished, so the freshly-uploaded shop_logo is already persisted by
  // the time the dashboard mounts.
  const { login, register, exchangeClerk, loading, error, setError } = useAuth({});

  // Lock body scroll while modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Reset error when switching modes
  useEffect(() => {
    setError(null);
    setNotRobot(false);
    setRobotError(false);
  }, [isSignUp, userType, setError]);

  useEffect(() => {
    if (clerkGoogle.error) setError(clerkGoogle.error);
  }, [clerkGoogle.error, setError]);

  // After Clerk redirect-back, exchange the Clerk session for our backend JWT
  useEffect(() => {
    if (!isOpen) return;
    if (!clerkGoogle.isReady) return;
    // The Clerk hook keeps user data in its own state; if a Clerk user is
    // present and we don't yet have an internal token, exchange it.
    (async () => {
      try {
        const result = await clerkGoogle.exchangeWithBackend();
        if (result?.token) onLogin('user');
      } catch {
        // silent — user may not have completed Clerk flow
      }
    })();
    // We only run on mount of modal opening
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, clerkGoogle.isReady]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notRobot) {
      setRobotError(true);
      setError('Veuillez confirmer que vous n\u2019\u00eates pas un robot.');
      return;
    }
    setRobotError(false);
    try {
      if (isSignUp) {
        // Tunisia phone is required for signup so buyers can reach the seller.
        if (!isValidTunisiaPhone(phone)) {
          setPhoneTouched(true);
          setError(TUNISIA_PHONE_ERROR);
          return;
        }
        const normalizedPhone = formatTunisiaPhone(phone);

        if (userType === 'individual') {
          await register({
            email,
            password,
            first_name: firstName,
            last_name: lastName,
            city,
            phone: normalizedPhone,
            account_type: 'individual',
          });
          onLogin('user');
        } else {
          // Pro flow: register FIRST so we get an auth token, THEN upload the
          // logo (the upload endpoint requires authentication) and patch the
          // profile with the resulting URL. We MUST await the whole chain
          // before notifying the parent — otherwise `onLogin('user')` would
          // close+unmount this modal while the multipart upload is still in
          // flight, cancelling it. That's why Pro signups never had a logo.
          await register({
            email,
            password,
            shop_name: shopName,
            full_name: `${proFirstName} ${proLastName}`.trim(),
            first_name: proFirstName,
            last_name: proLastName,
            shop_address: shopAddress,
            phone: normalizedPhone,
            governorate: proGovernorate || undefined,
            city: proGovernorate || undefined,
            account_type: 'pro',
          });

          if (logoFile) {
            try {
              const { uploadsApi } = await import('../../services/uploadsApi');
              const compressed = await compressImage(logoFile);
              const uploaded = await uploadsApi.single(compressed);
              if (uploaded?.url) {
                // Patch the profile with the new shop_logo URL and refresh
                // the cached `me` so the dashboard renders it immediately.
                const updated = await authApi.updateProfile({ shopLogo: uploaded.url });
                addToast('Logo de la boutique téléversé.', 'success');
                // Best-effort cache hint — UserContext refetches /auth/me on
                // mount so this is mostly cosmetic, but it avoids a flash.
                try {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (window as any).__lastSignupUser = updated;
                } catch { /* noop */ }
              }
            } catch (uploadErr: any) {
              console.error('[signup] logo upload failed:', uploadErr?.message || uploadErr);
              addToast(
                "Compte créé, mais le logo n'a pas pu être téléversé. Vous pourrez le réessayer dans Réglages.",
                'error'
              );
              // Non-blocking — account is still useful without a logo.
            }
          }

          // Now that everything that depends on this component being mounted
          // has finished, hand control back to the parent (closes the modal,
          // navigates to the dashboard, etc.).
          onLogin('user');
        }
      } else {
        await login({ email, password });
        onLogin('user');
      }
    } catch {
      // error is surfaced via the `error` state from useAuth
    }
  };

  const handleForgotPassword = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Saisissez votre adresse e-mail puis cliquez à nouveau sur « Mot de passe oublié ».');
      return;
    }
    // Basic email shape check — backend re-validates, but this avoids a
    // wasted round-trip and gives instant feedback.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Adresse e-mail invalide.');
      return;
    }
    setError(null);
    setForgotLoading(true);
    try {
      await authApi.forgotPassword(cleanEmail);
      addToast(
        'Si un compte existe pour cette adresse, un e-mail de réinitialisation vient d’être envoyé. Pensez à vérifier vos spams.',
        'success',
        6000,
      );
    } catch (e: any) {
      // Backend returns the same generic message on success and unknown email,
      // so a real error here is a network/server problem.
      setError(e?.message || 'Impossible d’envoyer l’e-mail de réinitialisation. Réessayez dans un instant.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    try {
      const result = await clerkGoogle.start(provider);
      if (result?.token) onLogin('user');
    } catch {
      setError(provider === 'apple' ? 'Connexion Apple indisponible.' : 'Connexion Google indisponible.');
    }
  };

  const handleLogoUpload = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setLogoPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleLogoUpload(e.dataTransfer.files[0]);
    }
  };

  const inputCompactClass = '!py-3 !rounded-xl';

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in transition-all"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-card w-full h-[100dvh] md:h-auto md:max-h-[90vh] md:max-w-lg md:rounded-3xl overflow-hidden relative shadow-2xl animate-fade-in-up flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2.5 text-gray-500 hover:text-gray-900 bg-gray-100/50 hover:bg-gray-100 rounded-full transition-all z-20 active:scale-90"
          aria-label="Fermer"
        >
          <X size={24} strokeWidth={2.5} />
        </button>

        <div className="p-6 md:p-10 overflow-y-auto no-scrollbar flex-1 pt-16 md:pt-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-50 mb-4 border border-primary-100 overflow-hidden">
              <img
                src="https://www.moto-scoot.tn/site-logo/embleme_logo.svg"
                className="w-8 h-8 object-contain"
                alt="MotoScoot"
              />
            </div>
            <h2 className={`text-gray-900 mb-2 ${isSignUp ? 'text-2xl md:text-3xl font-black tracking-tight' : 'text-[24px] font-extrabold tracking-normal font-sans'}`}>
              {isSignUp ? 'Créer un compte' : 'Bienvenue sur moto-scoot.tn'}
            </h2>
            <p className="text-gray-500 text-sm font-medium">
              {isSignUp ? 'Rejoignez la communauté moto-scoot.tn' : 'Connectez-vous pour gérer vos annonces.'}
            </p>
          </div>

          <div className="flex items-center justify-center mb-8">
            <button
              type="button"
              onClick={() => handleSocialLogin('google')}
              disabled={clerkGoogle.loading}
              aria-busy={clerkGoogle.loading}
              className="flex items-center justify-center gap-2 w-full max-w-[320px] h-[52px] min-h-[52px] border border-border rounded-[10px] text-foreground font-bold text-[14px] font-sans hover:bg-gray-50 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {clerkGoogle.loading ? (
                <>
                  <Loader2 size={18} className="animate-spin text-primary-600" />
                  <span>Redirection vers Google…</span>
                </>
              ) : (
                <>
                  <GoogleIcon />
                  <span>Continuer avec Google</span>
                </>
              )}
            </button>
          </div>

          <div className="relative flex items-center justify-center mb-8">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
            <span className="relative px-4 bg-card text-[12px] font-black text-gray-300 uppercase tracking-[0.2em]">OU EMAIL</span>
          </div>

          {isSignUp && (
            <div className="flex p-1 bg-gray-100 rounded-2xl mb-8 border border-gray-200">
              <button
                type="button"
                onClick={() => setUserType('individual')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${userType === 'individual' ? 'bg-card text-primary-600 border border-gray-200 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <User size={16} />
                Particulier
              </button>
              <button
                type="button"
                onClick={() => setUserType('pro')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${userType === 'pro' ? 'bg-card text-primary-600 border border-gray-200 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Briefcase size={16} />
                Professionnel
              </button>
            </div>
          )}

          {error && (
            <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-100 flex items-start gap-3 animate-fade-in">
              <AlertCircle size={18} className="text-red-600 mt-0.5 shrink-0" />
              <p className="text-[13px] font-bold text-red-800 leading-snug">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-4 animate-scale-in">
                {userType === 'individual' ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="Prénom"
                        placeholder="Prénom"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                        className={inputCompactClass}
                      />
                      <Input
                        label="Nom"
                        placeholder="Nom"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                        className={inputCompactClass}
                      />
                    </div>
                    <Select
                      label="Gouvernorat"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      required
                      className={inputCompactClass}
                    >
                      <option value="" disabled>Choisir mon gouvernorat</option>
                      {governorates.map(gov => <option key={gov} value={gov}>{gov}</option>)}
                    </Select>
                    <div className="space-y-1">
                      <Input
                        label="Téléphone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="22 123 456"
                        value={phone}
                        onChange={(e) => setPhone(cleanPhoneInput(e.target.value))}
                        onBlur={() => setPhoneTouched(true)}
                        leftIcon={<Phone size={18} />}
                        required
                        error={phoneError}
                        className={inputCompactClass}
                      />
                      {!phoneError && (
                        <p className="text-[11px] text-gray-400 font-medium px-1">
                          Numéro tunisien — utilisé par les acheteurs pour vous contacter.
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <Input
                      label="Nom de la boutique"
                      placeholder="Ex: Tunis Moto Shop"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      leftIcon={<Building2 size={18} />}
                      required
                      className={inputCompactClass}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="Prénom"
                        placeholder="Prénom"
                        value={proFirstName}
                        onChange={(e) => setProFirstName(e.target.value)}
                        leftIcon={<User size={18} />}
                        required
                        className={inputCompactClass}
                      />
                      <Input
                        label="Nom"
                        placeholder="Nom"
                        value={proLastName}
                        onChange={(e) => setProLastName(e.target.value)}
                        required
                        className={inputCompactClass}
                      />
                    </div>
                    <Input
                      label="Adresse boutique"
                      placeholder="Rue, Ville..."
                      value={shopAddress}
                      onChange={(e) => setShopAddress(e.target.value)}
                      leftIcon={<MapPin size={18} />}
                      required
                      className={inputCompactClass}
                    />
                    <Select
                      label="Gouvernorat"
                      value={proGovernorate}
                      onChange={(e) => setProGovernorate(e.target.value)}
                      required
                      className={inputCompactClass}
                    >
                      <option value="" disabled>Choisir mon gouvernorat</option>
                      {governorates.map(gov => <option key={gov} value={gov}>{gov}</option>)}
                    </Select>
                    <div className="space-y-1">
                      <Input
                        label="Téléphone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="22 123 456"
                        value={phone}
                        onChange={(e) => setPhone(cleanPhoneInput(e.target.value))}
                        onBlur={() => setPhoneTouched(true)}
                        leftIcon={<Phone size={18} />}
                        required
                        error={phoneError}
                        className={inputCompactClass}
                      />
                      {!phoneError && (
                        <p className="text-[11px] text-gray-400 font-medium px-1">
                          Numéro tunisien — utilisé par les acheteurs pour vous contacter.
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[12px] font-black text-gray-400 uppercase tracking-widest ml-1">Logo de la boutique</label>
                      <div
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`relative h-28 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer group ${isDragging ? 'border-primary-600 bg-primary-50' : 'border-gray-200 bg-gray-50 hover:bg-card hover:border-primary-300'}`}
                      >
                        {logoPreview ? (
                          <div className="flex items-center gap-3">
                            <img src={logoPreview} alt="Preview" className="h-20 w-20 object-contain rounded-lg" />
                            <span className="text-xs font-bold text-gray-400">Cliquez pour modifier</span>
                          </div>
                        ) : (
                          <>
                            <Upload className={`mb-1 ${isDragging ? 'text-primary-600' : 'text-gray-400 group-hover:text-primary-500'}`} size={24} />
                            <span className="text-[12px] font-bold text-gray-500">Logo (JPG, PNG)</span>
                          </>
                        )}
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => e.target.files && handleLogoUpload(e.target.files[0])} />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="space-y-4 pt-2">
              <Input
                type="email"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail size={18} />}
                required
                className={inputCompactClass}
              />
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  leftIcon={<Lock size={18} />}
                  required
                  minLength={6}
                  className={inputCompactClass}
                />
                {!isSignUp && (
                  <div className="flex justify-end px-1">
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={forgotLoading}
                      className="text-[12px] font-bold text-primary-600 hover:underline focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {forgotLoading ? 'Envoi en cours…' : 'Mot de passe oublié'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Cloudflare Turnstile-style anti-bot check (visual only) */}
            <CloudflareTurnstileMock
              checked={notRobot}
              onChange={(v) => {
                setNotRobot(v);
                if (v) setRobotError(false);
              }}
              error={robotError}
            />

            <Button
              type="submit"
              fullWidth
              className="py-5 mt-4 h-14"
              disabled={loading || !notRobot}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="mr-3 h-5 w-5 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {isSignUp ? 'Création...' : 'Connexion...'}
                </span>
              ) : (
                <>
                  {isSignUp ? 'Créer mon compte' : 'Me connecter'}
                  <ArrowRight size={18} className="ml-2" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100 text-center pb-10">
            <p className="text-gray-500 text-sm font-medium">
              {isSignUp ? 'Déjà membre ?' : 'Pas encore de compte ?'}
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="font-black text-primary-600 hover:text-primary-700 ml-2 focus:outline-none"
              >
                {isSignUp ? 'Se connecter' : "S'inscrire gratuitement"}
              </button>
            </p>

            <div className="mt-6 flex items-center justify-center gap-2 text-[12px] text-gray-400 font-bold uppercase tracking-widest">
              <CheckCircle2 size={14} className="text-success-600" />
              Connexion sécurisée SSL
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
