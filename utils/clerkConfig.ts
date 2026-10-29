const CLERK_FALLBACK_PUBLISHABLE_KEY = 'pk_live_Y2xlcmsubW90by1zY29vdC50biQ';

const getRuntimeHostname = (): string => {
  try {
    return typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  } catch {
    return '';
  }
};

const getExplicitPublishableKey = (): string => {
  try {
    return (
      (import.meta as any).env?.VITE_CLERK_PUBLISHABLE_KEY ||
      (import.meta as any).env?.VITE_CLERK_PUBLISHABLE_KEY_DEV ||
      (typeof window !== 'undefined' && (window as any).__CLERK_PUBLISHABLE_KEY__) ||
      ''
    );
  } catch {
    return '';
  }
};

export const isMotoScootDomain = (hostname = getRuntimeHostname()): boolean => {
  const host = hostname.toLowerCase();
  return host === 'moto-scoot.tn' || host.endsWith('.moto-scoot.tn');
};

export const getClerkPublishableKey = (): string => {
  const explicit = getExplicitPublishableKey();
  if (explicit) return explicit;

  return isMotoScootDomain() ? CLERK_FALLBACK_PUBLISHABLE_KEY : '';
};

export const getClerkUnavailableMessage = (): string | null => {
  if (getExplicitPublishableKey() || isMotoScootDomain()) return null;
  return "Connexion Google indisponible dans l’aperçu : cette clé est autorisée uniquement sur moto-scoot.tn. Testez sur le domaine publié ou ajoutez une clé de développement.";
};