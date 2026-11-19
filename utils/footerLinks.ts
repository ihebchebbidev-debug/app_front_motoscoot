/**
 * The « Informations » links of the site footer (components/Footer.tsx),
 * also written into the HTML Google receives (technical audit 2026-11-19):
 * the footer only existed after JavaScript, so /a-propos, /contact, /faq,
 * /securite, /mentions-legales, /conditions and /cookies had no link Google
 * could follow and were known from the sitemap only. One list for both, so
 * the HTML never links to anything the visitor does not see.
 */

export interface FooterInfoLink { view: string; href: string; label: string }

export const FOOTER_INFO_LINKS: FooterInfoLink[] = [
  { view: 'about', href: '/a-propos', label: 'À propos de nous' },
  { view: 'terms', href: '/conditions', label: 'Conditions Générales' },
  { view: 'legal', href: '/mentions-legales', label: 'Confidentialité' },
  { view: 'cookies', href: '/cookies', label: 'Cookies' },
  { view: 'faq', href: '/faq', label: 'FAQ' },
  { view: 'security', href: '/securite', label: 'Sécurité' },
  { view: 'sitemap', href: '/plan-du-site', label: 'Plan du site' },
];

/** Contact sits in the footer's « Navigation » column; the HTML lists it with the rest. */
export const FOOTER_CONTACT_LINK: FooterInfoLink = { view: 'contact', href: '/contact', label: 'Contact' };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The footer links as plain HTML, without the page's own address. */
export function footerLinksHtml(currentPath = ''): string {
  const items = [FOOTER_CONTACT_LINK, ...FOOTER_INFO_LINKS]
    .filter((l) => l.href !== currentPath.replace(/\/$/, ''))
    .map((l) => `<li><a href="${l.href}">${esc(l.label)}</a></li>`)
    .join('');
  return `<footer><nav aria-label="Informations"><ul>${items}</ul></nav></footer>`;
}
