
/**
 * Formate un nombre en devise Tunisienne (TND/DT)
 */
export const formatPrice = (amount: number | string): string => {
  const value = typeof amount === 'string' ? parseInt(amount.replace(/\D/g, ''), 10) : amount;
  if (isNaN(value)) return 'Prix sur demande';
  
  return new Intl.NumberFormat('fr-TN', {
    style: 'currency',
    currency: 'TND',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value).replace(/TND|TND\s*$/i, 'DT').trim();
};

/**
 * Génère un lien WhatsApp sécurisé avec fallback
 */
export const formatWhatsAppLink = (phone?: string, message?: string): string => {
  if (!phone) return '#';
  // Strip everything that isn't a digit (spaces, +, -, parentheses, dots, …).
  let digits = phone.replace(/\D/g, '');
  if (!digits) return '#';
  // Tunisian local numbers (8 digits) → prepend country code 216.
  // Numbers entered as "00216…" → strip the leading 00.
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 8) digits = `216${digits}`;
  const encodedMsg = message ? encodeURIComponent(message) : '';
  return `https://wa.me/${digits}${encodedMsg ? `?text=${encodedMsg}` : ''}`;
};

/**
 * Formate une date de manière relative (ex: "Il y a 2h")
 */
export const formatRelativeDate = (date: string | Date): string => {
  return "Aujourd'hui"; 
};

/**
 * Formate la date d'inscription d'un membre.
 * - "Aujourd'hui" / "Hier" pour les inscriptions très récentes.
 * - "il y a X jours" jusqu'à 30 jours.
 * - "il y a X mois" jusqu'à 12 mois.
 * - "Mois Année" (ex. "avr. 2024") au-delà.
 * Renvoie une chaîne vide pour une date invalide.
 */
export const formatMemberSince = (date?: string | Date | null): string => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const diffDays = Math.floor(diffMs / oneDay);

  if (diffDays <= 0) return "aujourd'hui";
  if (diffDays === 1) return 'hier';
  if (diffDays < 30) return `il y a ${diffDays} jours`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return diffMonths === 1 ? 'il y a 1 mois' : `il y a ${diffMonths} mois`;
  }

  const diffYears = Math.floor(diffMonths / 12);
  if (diffYears < 5) {
    // Mois + année lisibles pour les comptes anciens mais pas trop.
    return d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
  }

  return diffYears === 1 ? 'il y a 1 an' : `il y a ${diffYears} ans`;
};

