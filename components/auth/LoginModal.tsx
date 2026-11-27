import React, { useState, useRef, useEffect } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import clsx from 'clsx';
import {
  Mail,
  Lock,
  ArrowRight,
  User,
  Building2,
  Briefcase,
  AlertCircle,
  Phone,
  Loader2,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { ChoiceSheet } from '../search/ChoiceSheet';
import { Input } from '../ui/Input';
import { PasswordInput } from '../ui/PasswordInput';
import { TypeScaleProvider } from '../ui/TypeScale';
import { useClerkGoogleSignIn } from '../../hooks/useClerkGoogleSignIn';
import { HumanCheck } from './HumanCheck';
import { useSocialLinks } from '../../hooks/useSocialLinks';
import { BrandSocialIcon } from '../ui/BrandSocialIcon';

/** Light wash of each brand's colour behind its logo (as in the share window). */
const SOCIAL_WASH: Partial<Record<string, string>> = {
  facebook: 'bg-[#0866FF]/10 hover:bg-[#0866FF]/15',
  instagram: 'bg-[#FF0069]/10 hover:bg-[#FF0069]/15',
  tiktok: 'bg-black/[0.06] hover:bg-black/10',
};
import type { LoginMode } from '../../context/NavigationContext';
import { googleTapAction } from '../../utils/googleTap';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';
import { authApi } from '../../services/authApi';
import { cleanPhoneInput, formatTunisiaPhone } from '../../utils/phoneUtils';
import {
  emailProblem,
  EMAIL_EMPTY,
  emptyLoginForm,
  PASSWORD_MIN,
  loginFormModeOf,
  loginFormSchemas,
  type LoginFormMode,
  type LoginFormValues,
} from '../../utils/loginFormSchema';

interface LoginModalProps {
  isOpen: boolean;
  /** Screen to open on: the menu's « S'inscrire » opens « Créer un compte ». */
  initialMode?: LoginMode;
  onClose: () => void;
  onLogin: (role?: 'user' | 'admin') => void;
}

type UserType = 'individual' | 'pro';

/** Next to which control an error is shown. */
type ErrorPlace = 'google' | 'forgot' | 'form';

/** Error shown where it happened; role="alert" so screen readers read it. */
const ErrorNote: React.FC<{ message: string; className?: string }> = ({ message, className = '' }) => (
  <div role="alert" className={clsx('p-4 rounded-xl bg-red-50 border border-red-100 flex items-start gap-3 animate-fade-in', className)}>
    <AlertCircle size={18} className="text-red-600 mt-0.5 shrink-0" aria-hidden="true" />
    <p className="text-[13px] font-bold text-red-800 leading-snug">{message}</p>
  </div>
);

/** How long a Google tap waits for Clerk to finish loading. */
const GOOGLE_WAIT_MS = 15000;

const AppleIcon = () => (
  <img
    src="https://www.moto-scoot.tn/site-logo/apple.svg"
    className="w-5 h-5 object-contain"
    alt="Apple"
  />
);

/**
 * Left picture of the login window, tablet and desktop only (phones keep the
 * plain sheet). Temporary free photo — Unsplash licence, by Daniel
 * (unsplash.com/photos/OVXwS_oaoJE). To use the site's own picture, change
 * LOGIN_PHOTO and remove the credit line.
 */
const LOGIN_PHOTO =
  'https://images.unsplash.com/photo-1695014192162-e1d282ff5b40?auto=format&fit=crop&w=900&h=1300&q=70';
const LOGIN_PHOTO_CREDIT = 'Photo : Daniel / Unsplash';

/**
 * The site's social accounts (set in the backoffice, same links as the
 * footer): real logos in their own colours, 44 px round targets, opened in a
 * new tab so a half-filled form is not lost. `onPhoto`: white discs so the
 * logos stand out on the dark picture.
 */
const LoginSocialLinks: React.FC<{ onPhoto?: boolean; className?: string }> = ({ onPhoto = false, className }) => {
  const socialLinks = useSocialLinks();
  if (socialLinks.length === 0) return null;
  return (
    <div className={clsx('flex flex-col gap-2.5', className)}>
      <p className={clsx('text-[12px] font-medium', onPhoto ? 'text-white/85' : 'text-gray-500')}>Suivez Moto-Scoot</p>
      <ul className="flex items-center gap-3" aria-label="Moto-Scoot sur les réseaux sociaux">
        {socialLinks.map(({ key, label, href, Icon }) => (
          <li key={key}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${label} (nouvel onglet)`}
              className={clsx(
                'w-11 h-11 rounded-full flex items-center justify-center transition-[transform,background-color] hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                onPhoto ? 'bg-white shadow-sm' : (SOCIAL_WASH[key] ?? 'bg-gray-100'),
              )}
            >
              {/* Other networks (YouTube, LinkedIn, X) keep a plain icon. */}
              {key in SOCIAL_WASH ? <BrandSocialIcon network={key} size={22} /> : <Icon size={20} className="text-gray-700" />}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};

const LoginAside: React.FC<{ isSignUp: boolean }> = ({ isSignUp }) => (
  <div className="relative h-full overflow-hidden rounded-[20px] bg-[#0b0b0c]">
    <img
      src={LOGIN_PHOTO}
      alt=""
      decoding="async"
      className="absolute inset-0 h-full w-full object-cover"
    />
    {/* Dark at the top for the headline, and at the bottom for the links. */}
    <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/10 to-black/60" aria-hidden="true" />
    {/* Decoration: the page's promise, not read aloud. */}
    <p aria-hidden="true" className="relative px-8 pt-9 lg:px-10 lg:pt-11 text-white text-[28px] lg:text-[36px] font-bold leading-[1.12] tracking-[-0.02em] text-balance">
      {isSignUp
        ? 'Vendez votre moto ou votre scooter, gratuitement.'
        : 'Retrouvez vos annonces, vos messages et vos favoris.'}
    </p>
    {/* Bottom of the window: social links on the left, photo credit right. */}
    <div className="absolute inset-x-0 bottom-0 px-8 pb-7 lg:px-10 lg:pb-8 flex items-end justify-between gap-4">
      <LoginSocialLinks onPhoto />
      {LOGIN_PHOTO_CREDIT && (
        <p aria-hidden="true" className="text-[11px] font-medium text-white/70 pb-1">{LOGIN_PHOTO_CREDIT}</p>
      )}
    </div>
  </div>
);

const GoogleIcon = () => (
  <img
    src="https://www.moto-scoot.tn/site-logo/googleColored.svg"
    className="w-5 h-5 object-contain"
    alt="Google"
  />
);


const LoginModal: React.FC<LoginModalProps> = ({ isOpen, initialMode = 'login', onClose, onLogin }) => {
  const [isSignUp, setIsSignUp] = useState(initialMode === 'signup');
  // The sheet scrolls the parent of this block.
  const contentRef = useRef<HTMLDivElement>(null);

  // Each opening starts on the screen its button named (« Se connecter » or
  // « S'inscrire »), not on the one left open last time. Typed values stay.
  useEffect(() => {
    if (isOpen) setIsSignUp(initialMode === 'signup');
  }, [isOpen, initialMode]);

  // Switching between sign-in and sign-up starts at the top: the link is at
  // the bottom, and the new screen opened half-scrolled, title hidden.
  useEffect(() => {
    const scroller = contentRef.current?.parentElement;
    if (scroller) scroller.scrollTop = 0;
  }, [isSignUp, isOpen]);
  const [userType, setUserType] = useState<UserType>('individual');

  // Text fields: react-hook-form + the rules in utils/loginFormSchema.ts.
  // Each field is checked when the visitor leaves it, then as they correct
  // it; the error shows under the field. The rules follow the screen
  // (sign in, « Particulier », « Professionnel »); values typed on one
  // screen stay when switching.
  const formMode: LoginFormMode = loginFormModeOf(isSignUp, userType);
  const formModeRef = useRef(formMode);
  formModeRef.current = formMode;
  const form = useForm<LoginFormValues>({
    mode: 'onTouched',
    defaultValues: emptyLoginForm,
    // The library focuses fields in the order they were first shown (e-mail
    // before the sign-up fields); we focus the first one on screen instead.
    shouldFocusError: false,
    resolver: (values, context, options) =>
      zodResolver(loginFormSchemas[formModeRef.current])(values, context, options),
  });
  const fieldErrors: FieldErrors<LoginFormValues> = form.formState.errors;
  const field = form.register;
  // Phone: keep only digits and a leading « + » as the visitor types.
  const phoneField = field('phone');

  // Lightweight "I'm not a robot" check. Not a real CAPTCHA, but blocks
  // form submission until the user actively confirms the box.
  const [notRobot, setNotRobot] = useState(false);
  const [robotError, setRobotError] = useState(false);
  const humanCheckRef = useRef<HTMLInputElement>(null);

  const clerkGoogle = useClerkGoogleSignIn();
  const { addToast } = useToast();
  const [forgotLoading, setForgotLoading] = useState(false);
  // A tap on Google before Clerk has finished loading (it loads with this
  // window, ~250 KB): we wait for it instead of showing an error.
  const [googleWaiting, setGoogleWaiting] = useState(false);

  // We deliberately do NOT pass `onSuccess` here. If we did, the parent would
  // close this modal as soon as `register()` resolves — unmounting us mid-way
  // through the optional Pro logo upload (which runs *after* register so it
  // can authenticate). We trigger `onLogin('user')` ourselves at the end of
  // `handleSubmit`, once every dependent step (logo upload + profile patch)
  // has finished, so the freshly-uploaded shop_logo is already persisted by
  // the time the dashboard mounts.
  const { login, register, exchangeClerk, loading, error, setError } = useAuth({});
  // Where the error is shown: next to the control that caused it, so it is on
  // screen under the visitor's finger (the sign-up button is ~600 px below
  // the top of the form on a phone).
  const [errorAt, setErrorAt] = useState<ErrorPlace>('form');
  const submitAreaRef = useRef<HTMLDivElement>(null);

  // Scroll lock, focus, Tab, Escape, return focus, drag-to-close and the
  // exit animation come from the shared ChoiceSheet, as in every other
  // window of the site (sort, filters, quote request).

  // Reset errors when switching screens (the new screen has other rules).
  useEffect(() => {
    setError(null);
    setNotRobot(false);
    setRobotError(false);
    form.clearErrors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignUp, userType, setError]);

  useEffect(() => {
    if (!clerkGoogle.error) return;
    setErrorAt('google');
    setError(clerkGoogle.error);
  }, [clerkGoogle.error, setError]);

  // A sign-in / sign-up error appears just above the button: bring both into
  // view if the visitor scrolled away (no smooth scroll for reduced motion).
  useEffect(() => {
    if (!error || errorAt !== 'form') return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    submitAreaRef.current?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }, [error, errorAt]);

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

  // Clerk ready → start the Google sign-in the visitor already asked for.
  // Still not ready after 15 s (very slow or broken network) → say so.
  useEffect(() => {
    if (!googleWaiting) return;
    if (!isOpen) {
      setGoogleWaiting(false);
      return;
    }
    if (clerkGoogle.canStart) {
      setGoogleWaiting(false);
      void handleSocialLogin('google');
      return;
    }
    const timer = window.setTimeout(() => {
      setGoogleWaiting(false);
      setErrorAt('google');
      setError('Google ne répond pas pour le moment. Vérifiez votre connexion internet puis réessayez.');
    }, GOOGLE_WAIT_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleWaiting, clerkGoogle.canStart, isOpen]);

  const submitValid = async (v: LoginFormValues) => {
    try {
      if (isSignUp) {

        if (userType === 'individual') {
          await register({
            email: v.email,
            password: v.password,
            full_name: v.fullName.trim(),
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
            email: v.email,
            password: v.password,
            shop_name: v.shopName.trim(),
            full_name: v.fullName.trim(),
            // A Pro must be reachable: phone required for this account type.
            phone: formatTunisiaPhone(v.phone),
            account_type: 'pro',
          });

          // Now that everything that depends on this component being mounted
          // has finished, hand control back to the parent (closes the modal,
          // navigates to the dashboard, etc.).
          onLogin('user');
        }
      } else {
        await login({ email: v.email, password: v.password });
        onLogin('user');
      }
    } catch {
      // error is surfaced via the `error` state from useAuth
    }
  };

  const focusFirstInvalid = () => {
    requestAnimationFrame(() => {
      const first = contentRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
      if (!first) return;
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      first.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
      first.focus({ preventScroll: true });
    });
  };

  // Phones: the keyboard covers the bottom half of the sheet. Once it is up
  // (~300 ms), bring the touched field to the middle of what is left.
  const keepFocusedFieldVisible = (e: React.FocusEvent<HTMLDivElement>) => {
    const field = e.target as HTMLElement;
    if (!/^(INPUT|SELECT|TEXTAREA)$/.test(field.tagName) || field.getAttribute('type') === 'checkbox') return;
    if (!window.matchMedia?.('(max-width: 767px)').matches) return;
    window.setTimeout(() => {
      if (document.activeElement !== field) return;
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      field.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    }, 300);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorAt('form');
    // The button stays active; an unticked box is said right under it and
    // gets the focus (a greyed-out button did not say why).
    if (!notRobot) {
      setRobotError(true);
      humanCheckRef.current?.focus();
      return;
    }
    setRobotError(false);
    // Invalid fields: each shows its error and the first one on screen gets
    // the focus (and comes into view), so the visitor starts from the top.
    void form.handleSubmit(submitValid, focusFirstInvalid)(e);
  };

  const handleForgotPassword = async () => {
    setErrorAt('forgot');
    const cleanEmail = form.getValues('email').trim();
    // Same e-mail rule as the form; backend re-validates.
    const problem = emailProblem(cleanEmail);
    if (problem) {
      setError(problem === EMAIL_EMPTY
        ? 'Saisissez votre adresse e-mail puis cliquez à nouveau sur « Mot de passe oublié ».'
        : problem);
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
    setErrorAt('google');
    try {
      const result = await clerkGoogle.start(provider);
      if (result?.token) onLogin('user');
    } catch {
      setError(provider === 'apple' ? 'Connexion Apple indisponible.' : 'Connexion Google indisponible.');
    }
  };

  const googleBusy = clerkGoogle.loading || googleWaiting;

  const handleGoogleClick = () => {
    const action = googleTapAction({
      busy: googleBusy,
      configured: clerkGoogle.configured,
      canStart: clerkGoogle.canStart,
    });
    if (action === 'ignore') return;
    setErrorAt('google');
    setError(null);
    if (action === 'wait') setGoogleWaiting(true);
    else void handleSocialLogin('google');
  };

  const inputCompactClass = '!py-3 !rounded-xl';
  const segmentClass = 'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all';
  const segmentOn = 'bg-card text-primary-600 border border-gray-200 shadow-sm';
  const segmentOff = 'text-gray-500 hover:text-gray-700';

  return (
    <ChoiceSheet
      open={isOpen}
      label={isSignUp ? 'Créer un compte' : 'Bienvenue'}
      onClose={onClose}
      listbox={false}
      tall
      large
      aside={<LoginAside isSignUp={isSignUp} />}
    >
      {/* The deposit's calm scale (as on DepositAd and the dashboard):
          14 px sentence-case labels, 16 px medium values, light placeholders,
          13 px help and errors, sentence-case buttons. */}
      <TypeScaleProvider tone="calm">
        {/* Tablet / desktop: one left-aligned column beside the picture. */}
        <div ref={contentRef} onFocus={keepFocusedFieldVisible} className="min-h-full flex flex-col px-6 pt-4 [@media(max-height:700px)]:pt-2 pb-6 [@media(max-height:700px)]:pb-1 md:pb-0 md:px-10 lg:px-14 md:pt-8 md:max-w-[480px] md:mx-auto">
          {/* Emblem, title and promise. Phones: centred under the grabber.
              Tablet / desktop: left-aligned above a rule, beside the photo. */}
          <div className="text-center mb-6 [@media(max-height:700px)]:mb-3 md:text-left md:mb-6 md:pb-6 md:border-b md:border-gray-100">
            <div className="inline-flex items-center justify-center overflow-hidden mb-3 w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 [@media(max-height:700px)]:w-11 [@media(max-height:700px)]:h-11 [@media(max-height:700px)]:mb-2 md:w-auto md:h-auto md:rounded-none md:bg-transparent md:border-0 [@media(min-width:768px)_and_(max-height:780px)]:hidden">
              <img
                src="https://www.moto-scoot.tn/site-logo/embleme_logo.svg"
                className="w-8 h-8 object-contain"
                alt="Moto-Scoot.tn"
              />
            </div>
            {/* The window's name is the header title (hidden from 768 px);
                this is the same words shown large, so not read twice. */}
            <p aria-hidden="true" className="text-gray-900 text-[28px] [@media(max-height:700px)]:text-[24px] md:text-[34px] font-extrabold leading-[1.1] tracking-[-0.02em] mb-2 [@media(max-height:700px)]:mb-1 text-balance">
              {isSignUp ? 'Créer un compte' : 'Bienvenue'}
            </p>
            <p className="text-gray-500 text-[15px] font-medium">
              {isSignUp ? 'Rejoignez la communauté moto-scoot.tn' : 'Connectez-vous pour gérer vos annonces.'}
            </p>
          </div>

          <div className="flex items-center justify-center mb-4 [@media(max-height:700px)]:mb-3 md:mb-5">
            <button
              type="button"
              onClick={handleGoogleClick}
              disabled={googleBusy}
              aria-busy={googleBusy}
              className="flex items-center justify-center gap-2 w-full h-[52px] min-h-[52px] border border-gray-300 rounded-xl text-foreground font-bold text-[16px] font-sans hover:bg-gray-50 active:scale-[0.98] transition-[background-color,transform] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {googleBusy ? (
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

          {error && errorAt === 'google' && <ErrorNote message={error} className="-mt-2 mb-5" />}

          <div className="relative flex items-center justify-center mb-4 [@media(max-height:700px)]:mb-3 md:mb-5">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
            <span className="relative px-4 bg-card text-[13px] font-medium text-gray-500">ou</span>
          </div>

          {isSignUp && (
            <div className="flex p-1 bg-gray-100 rounded-2xl mb-8 border border-gray-200">
              <button
                type="button"
                onClick={() => setUserType('individual')}
                className={clsx(segmentClass, userType === 'individual' ? segmentOn : segmentOff)}
              >
                <User size={16} />
                Particulier
              </button>
              <button
                type="button"
                onClick={() => setUserType('pro')}
                className={clsx(segmentClass, userType === 'pro' ? segmentOn : segmentOff)}
              >
                <Briefcase size={16} />
                Professionnel
              </button>
            </div>
          )}

          {/* noValidate: the form's own French messages, under each field,
              instead of the browser's bubbles. */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4 [@media(max-height:700px)]:space-y-3 md:space-y-5">
            {isSignUp && (
              <div className="space-y-4 animate-scale-in">
                {userType === 'individual' ? (
                  <>
                    {/* « Particulier »: just a name here. Phone and governorate
                        are asked with the first ad, where they are used. */}
                    <Input
                      label="Votre nom"
                      autoComplete="name"
                      placeholder="Prénom et nom"
                      {...field('fullName')}
                      required
                      error={fieldErrors.fullName?.message}
                      hint="Le nom que verront les autres membres."
                      className={inputCompactClass}
                    />
                  </>
                ) : (
                  <>
                    {/* « Professionnel »: what a shop needs to start. Address,
                        governorate and logo are set afterwards in Réglages. */}
                    <Input
                      label="Nom de la boutique"
                      autoComplete="organization"
                      placeholder="Ex: Tunis Moto Shop"
                      {...field('shopName')}
                      leftIcon={<Building2 size={18} />}
                      required
                      error={fieldErrors.shopName?.message}
                      className={inputCompactClass}
                    />
                    <Input
                      label="Votre nom"
                      autoComplete="name"
                      placeholder="Prénom et nom"
                      {...field('fullName')}
                      leftIcon={<User size={18} />}
                      required
                      error={fieldErrors.fullName?.message}
                      className={inputCompactClass}
                    />
                    <Input
                      label="Téléphone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="22 123 456"
                      {...phoneField}
                      onChange={(e) => {
                        e.target.value = cleanPhoneInput(e.target.value);
                        void phoneField.onChange(e);
                      }}
                      leftIcon={<Phone size={18} />}
                      required
                      error={fieldErrors.phone?.message}
                      hint="Numéro tunisien — utilisé par les clients pour vous contacter."
                      className={inputCompactClass}
                    />
                    <p className="text-[13px] leading-snug text-gray-600 ml-1">
                      Adresse, gouvernorat et logo de la boutique : à compléter ensuite dans Réglages.
                    </p>
                  </>
                )}
              </div>
            )}

            <div className="space-y-4 [@media(max-height:700px)]:space-y-3 md:space-y-5">
              <Input
                label="Adresse e-mail"
                type="email"
                // « username » ties the saved password to this e-mail in
                // iCloud Keychain, Google and 1Password (web.dev guidance).
                {...field('email')}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                // Phone keyboard: « Suivant » goes to the password instead of
                // sending a half-filled form.
                enterKeyHint="next"
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  form.setFocus('password');
                }}
                placeholder="votre@email.com"
                leftIcon={<Mail size={18} />}
                required
                error={fieldErrors.email?.message}
                className={inputCompactClass}
              />
              <div className="space-y-2">
                <PasswordInput
                  label="Mot de passe"
                  // Sign-up: the browser offers a strong password and saves it.
                  {...field('password')}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  enterKeyHint={isSignUp ? 'done' : 'go'}
                  placeholder="mot de passe"
                  leftIcon={<Lock size={18} />}
                  required
                  error={fieldErrors.password?.message}
                  // The rule is shown before typing, not only as an error.
                  hint={isSignUp ? `${PASSWORD_MIN} caractères minimum.` : undefined}
                  className={inputCompactClass}
                />
                {/* « Je suis humain » on the left, « Mot de passe oublié ? »
                    on the right: one row instead of a separate block. */}
                <div className="flex items-start justify-between gap-3 -mb-1">
                  <HumanCheck
                    ref={humanCheckRef}
                    checked={notRobot}
                    onChange={(v) => {
                      setNotRobot(v);
                      if (v) setRobotError(false);
                    }}
                    error={robotError ? 'Cochez la case pour continuer.' : undefined}
                  />
                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={forgotLoading}
                      // 44 px tall: easy to hit with a thumb.
                      className="shrink-0 whitespace-nowrap min-h-[44px] px-1 inline-flex items-center text-[14px] font-semibold text-primary-700 hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-md disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {forgotLoading ? 'Envoi en cours…' : 'Mot de passe oublié ?'}
                    </button>
                  )}
                </div>
                {!isSignUp && error && errorAt === 'forgot' && (
                  <ErrorNote message={error} />
                )}
              </div>
            </div>

            <div ref={submitAreaRef}>
            {error && errorAt === 'form' && <ErrorNote message={error} className="mt-5" />}

            <Button
              type="submit"
              fullWidth
              className="mt-1 h-[52px] text-[16px]"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="mr-3 h-5 w-5 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {isSignUp ? 'Création…' : 'Connexion…'}
                </span>
              ) : (
                <>
                  {isSignUp ? 'Créer mon compte' : 'Se connecter'}
                  <ArrowRight size={18} className="ml-2" />
                </>
              )}
            </Button>
            </div>
          </form>

          {/* Acceptance of the CGU. Shown in both modes: "Continuer avec Google"
              creates an account from the sign-in screen too. The link opens a
              new tab so a half-filled form is not lost. */}
          <p className="mt-3 [@media(max-height:700px)]:mt-2 md:mt-4 text-center text-[13px] leading-relaxed text-gray-500 text-pretty">
            {isSignUp ? 'En créant votre compte' : 'En continuant'}, vous acceptez les{' '}
            <a
              href="/conditions"
              target="_blank"
              rel="noopener"
              className="font-semibold text-primary-700 underline decoration-primary-700/40 underline-offset-2 hover:decoration-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-sm"
            >
              conditions générales d'utilisation
            </a>{' '}
            de Moto-Scoot.tn.
          </p>

          {/* « Pas encore de compte ? » — always offered, as Google, Apple,
              Amazon or Instagram do: a secondary line under the form, the
              link a 44 px touch target so it is easy to hit on a phone. */}
          <div className="mt-3 pt-2 [@media(max-height:700px)]:mt-2 [@media(max-height:700px)]:pt-1 md:mt-6 md:pt-4 border-t border-gray-100 text-center">
            <p className="flex flex-wrap items-center justify-center gap-x-1.5 text-gray-600 text-sm font-medium">
              {isSignUp ? 'Déjà membre ?' : 'Pas encore de compte ?'}
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="min-h-[44px] md:min-h-[24px] inline-flex items-center px-1 font-bold text-primary-700 hover:underline underline-offset-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                {isSignUp ? 'Se connecter' : <>S'inscrire<span className="hidden min-[420px]:inline">&nbsp;gratuitement</span></>}
              </button>
            </p>
          </div>

          {/* Social links: tablet / desktop only, at the bottom of the picture
              (LoginAside). Phones keep the sheet for signing in. */}
        </div>
      </TypeScaleProvider>
    </ChoiceSheet>
  );
};

export default LoginModal;
