// Addresses the SPA really serves. Anything else gets an HTTP 404 (no soft-404).
// Keep in sync with the vercel.json rewrites to /spa.html.
export const KNOWN_PAGE_RES: RegExp[] = [
  /^\/$/,
  /^\/(annonces|actualites|garages|conseils|contact|faq|a-propos|fiches-techniques|comparateur|mentions-legales|securite|conditions|cookies|plan-du-site|mes-favoris|deposer-une-annonce|mon-compte|espace-pro|admin|test|reinitialiser-mot-de-passe)\/?$/,
  /^\/(annonce|article|guide|garage|fiche-technique|fiches-techniques)\/[^/]+\/?$/,
  /^\/(mon-compte|espace-pro|admin)\/.+$/,
];
export const isKnownPagePath = (p: string) => KNOWN_PAGE_RES.some((re) => re.test(p));
