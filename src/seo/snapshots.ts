/**
 * Static SEO snapshots for build-time prerender.
 *
 * Why this exists
 * ---------------
 * Our app is a pure SPA. The initial HTML Google/LLMs receive contains an empty
 * `<div id="root">` — the real content + meta tags are injected by React after
 * JS executes. Modern Googlebot does run JS, but:
 *   1. It's a two-pass process (crawl → render queue → re-index) that can take
 *      days, hurting time-to-first-index for fresh content.
 *   2. LLM training crawlers (GPTBot, ClaudeBot, PerplexityBot, CCBot) very
 *      often DO NOT execute JS — they see the empty shell and skip the page.
 *   3. Social previews (FB, X, WhatsApp, LinkedIn, iMessage) read tags from
 *      the raw HTML response — JS-injected OG tags are missed entirely.
 *
 * The fix: at build time, generate one fully-stamped HTML file per static
 * marketing route. Each file contains route-specific <title>, <meta>, OG, and
 * JSON-LD inlined into the source HTML — exactly what crawlers want — plus
 * the same <script src="/index.tsx"> so the SPA still hydrates and replaces
 * the static content with the live React app for real users.
 *
 * Each entry maps a URL path to its SEO snapshot. Add new public routes here.
 */

export interface SeoSnapshot {
  /** URL path the route is served at (e.g. "/about"). */
  path: string;
  /** Full <title> tag text. Should already include the brand suffix. */
  title: string;
  /** Meta description (≤160 chars recommended). */
  description: string;
  /** Optional H1 + intro paragraph rendered into the noscript fallback so
   *  non-JS crawlers see real, indexable content (not just meta tags). */
  h1: string;
  intro: string;
  /** Optional OG image override (defaults to logo). */
  ogImage?: string;
  /** Optional extra schema.org JSON-LD blocks for this page. */
  schemas?: Record<string, unknown>[];
}

const SITE = 'https://www.moto-scoot.tn';
const DEFAULT_OG_IMAGE = 'https://www.moto-scoot.tn/og-banner.webp';

const breadcrumb = (items: { name: string; path: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: it.name,
    item: `${SITE}${it.path}`,
  })),
});

export const SEO_SNAPSHOTS: SeoSnapshot[] = [
  {
    path: '/',
    title: "Motos et Scooters en Tunisie | Neufs & Occasion",
    description:
      "Trouvez, vendez et comparez des motos et scooters en Tunisie : annonces neuves et d'occasion, prix, fiches techniques et nouveautés du marché.",
    h1: "MotoScoot — Motos & Scooters d'Occasion en Tunisie",
    intro:
      "moto-scoot.tn est la 1ʳᵉ plateforme tunisienne dédiée à l'achat et la vente de motos et scooters d'occasion. Découvrez plus de 500 annonces vérifiées par nos modérateurs, des fiches techniques détaillées et un réseau de garages partenaires partout en Tunisie.",
  },
  {
    path: '/annonces',
    title: "Annonces Moto & Scooter d'Occasion en Tunisie | MotoScoot",
    description:
      "Parcourez plus de 500 annonces de motos et scooters d'occasion en Tunisie. Filtrez par marque, modèle, prix, kilométrage et ville. Mises à jour quotidiennes.",
    h1: "Annonces de Motos et Scooters d'Occasion",
    intro:
      "Découvrez toutes les annonces de motos et scooters d'occasion en Tunisie — Yamaha, Honda, Suzuki, Kawasaki, BMW, KTM, Piaggio, Vespa et plus. Filtrez par prix, marque, modèle, cylindrée et localisation.",
    schemas: [
      breadcrumb([
        { name: 'Accueil', path: '/' },
        { name: 'Annonces', path: '/annonces' },
      ]),
    ],
  },
  {
    path: '/garages',
    title: "Garages Moto en Tunisie — Réparation & Entretien | MotoScoot",
    description:
      "Annuaire des meilleurs garages moto en Tunisie. Réparation, entretien, diagnostic, accessoires. Avis vérifiés, contacts, horaires et géolocalisation.",
    h1: "Garages Moto Partenaires en Tunisie",
    intro:
      "Trouvez le garage moto idéal près de chez vous. Notre annuaire référence des dizaines de garages spécialisés en moto et scooter à Tunis, Sousse, Sfax, Nabeul et partout en Tunisie, avec avis clients et services détaillés.",
    schemas: [
      breadcrumb([
        { name: 'Accueil', path: '/' },
        { name: 'Garages', path: '/garages' },
      ]),
    ],
  },
  {
    path: '/actualites',
    title: "Actualités Moto en Tunisie — Nouveautés, Tests, Marché | MotoScoot",
    description:
      "Actualités du monde de la moto en Tunisie : nouveautés, essais, tendances marché, nouveaux modèles et événements. Restez informé sur l'univers deux-roues.",
    h1: "Actualités Moto & Scooter",
    intro:
      "Découvrez l'actualité de la moto en Tunisie : essais des derniers modèles, comparatifs, tendances du marché de l'occasion, événements, salons et conseils d'experts.",
    schemas: [
      breadcrumb([
        { name: 'Accueil', path: '/' },
        { name: 'Actualités', path: '/actualites' },
      ]),
    ],
  },
  {
    path: '/conseils',
    title: "Conseils & Guides Moto — Achat, Entretien, Sécurité | MotoScoot",
    description:
      "Tous nos conseils pour bien acheter, vendre et entretenir votre moto ou scooter en Tunisie. Guides pratiques, sécurité, assurance, équipement.",
    h1: "Conseils et Guides Pratiques",
    intro:
      "Nos guides experts pour acheter votre première moto, négocier le prix d'un scooter d'occasion, entretenir votre véhicule, choisir votre équipement et rouler en sécurité en Tunisie.",
    schemas: [
      breadcrumb([
        { name: 'Accueil', path: '/' },
        { name: 'Conseils', path: '/conseils' },
      ]),
    ],
  },
  {
    path: '/fiches-techniques',
    title: "Fiches Techniques Motos & Scooters — Toutes Marques | MotoScoot",
    description:
      "Base de données complète des fiches techniques moto et scooter : Yamaha, Honda, Suzuki, Kawasaki, BMW, KTM, Piaggio. Caractéristiques, performances, prix.",
    h1: "Fiches Techniques Moto & Scooter",
    intro:
      "Consultez les fiches techniques détaillées de toutes les motos et scooters disponibles en Tunisie : cylindrée, puissance, couple, poids, consommation, équipements et prix neuf.",
    schemas: [
      breadcrumb([
        { name: 'Accueil', path: '/' },
        { name: 'Fiches techniques', path: '/fiches-techniques' },
      ]),
    ],
  },
  {
    path: '/comparateur',
    title: "Comparateur de Motos & Scooters | MotoScoot",
    description:
      "Comparez deux motos ou scooters côte à côte : caractéristiques techniques, performances, équipements, prix. Faites le meilleur choix pour votre prochain deux-roues.",
    h1: "Comparateur Moto & Scooter",
    intro:
      "Sélectionnez deux modèles et comparez en détail leurs spécifications techniques, leurs performances, leur consommation, leurs équipements et leurs prix pour faire le bon choix.",
  },
  {
    path: '/a-propos',
    title: "À Propos — MotoScoot | MotoScoot.tn",
    description:
      "moto-scoot.tn est la première plateforme tunisienne pensée par des motards, pour des motards. Découvrez notre mission, nos valeurs et notre équipe.",
    h1: "À Propos de moto-scoot.tn",
    intro:
      "moto-scoot.tn est née de la passion d'une équipe de motards tunisiens. Notre mission : rendre l'achat et la vente de motos fluides, sûrs et passionnants partout en Tunisie.",
    schemas: [
      breadcrumb([
        { name: 'Accueil', path: '/' },
        { name: 'À propos', path: '/a-propos' },
      ]),
    ],
  },
  {
    path: '/contact',
    title: "Contact — Nous Joindre | MotoScoot",
    description:
      "Contactez l'équipe moto-scoot.tn : support utilisateur, partenariats, signalements. Téléphone +216 29 249 512 ou via le formulaire de contact.",
    h1: "Contactez moto-scoot.tn",
    intro:
      "Une question, une suggestion, un problème ? L'équipe MotoScoot est joignable par téléphone, email ou via notre formulaire de contact. Nous répondons sous 24h ouvrées.",
    schemas: [
      {
        '@context': 'https://schema.org',
        '@type': 'ContactPage',
        name: 'Contact moto-scoot.tn',
        url: `${SITE}/contact`,
      },
      breadcrumb([
        { name: 'Accueil', path: '/' },
        { name: 'Contact', path: '/contact' },
      ]),
    ],
  },
  {
    path: '/faq',
    title: "Questions Fréquentes — FAQ | MotoScoot",
    description:
      "Réponses aux questions les plus posées sur moto-scoot.tn : comment acheter, vendre, déposer une annonce, sécurité, paiement, modération.",
    h1: "Foire Aux Questions",
    intro:
      "Toutes les réponses à vos questions sur l'utilisation de moto-scoot.tn : création de compte, dépôt d'annonces, recherche, contact entre acheteur et vendeur, sécurité des transactions.",
    schemas: [
      breadcrumb([
        { name: 'Accueil', path: '/' },
        { name: 'FAQ', path: '/faq' },
      ]),
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: "Comment déposer une annonce sur MotoScoot ?",
            acceptedAnswer: {
              '@type': 'Answer',
              text: "Créez un compte gratuit, cliquez sur « Déposer une annonce », renseignez la marque, le modèle, l'année, le kilométrage et le prix, ajoutez jusqu'à 10 photos, puis publiez. Votre annonce est validée sous 24h.",
            },
          },
          {
            '@type': 'Question',
            name: "Le dépôt d'annonce est-il payant ?",
            acceptedAnswer: {
              '@type': 'Answer',
              text: "Non, la publication d'annonces de motos et scooters d'occasion est 100% gratuite pour les particuliers en Tunisie.",
            },
          },
          {
            '@type': 'Question',
            name: "Comment contacter un vendeur en toute sécurité ?",
            acceptedAnswer: {
              '@type': 'Answer',
              text: "Utilisez la messagerie interne MotoScoot ou le numéro affiché sur l'annonce. Ne payez jamais avant d'avoir vu le véhicule et vérifié les papiers (carte grise, certificat de non-gage).",
            },
          },
          {
            '@type': 'Question',
            name: "MotoScoot couvre-t-il toute la Tunisie ?",
            acceptedAnswer: {
              '@type': 'Answer',
              text: "Oui — Tunis, Sousse, Sfax, Nabeul, Bizerte, Gabès, Monastir et toutes les villes tunisiennes. La recherche permet de filtrer par gouvernorat ou par rayon autour de votre position.",
            },
          },
          {
            '@type': 'Question',
            name: "Comment signaler une annonce frauduleuse ?",
            acceptedAnswer: {
              '@type': 'Answer',
              text: "Chaque annonce dispose d'un bouton « Signaler ». Notre équipe de modération traite les signalements sous 24h et retire les contenus non conformes.",
            },
          },
        ],
      },
    ],
  },
  {
    path: '/securite',
    title: "Conseils de Sécurité — Acheter & Vendre en Confiance | MotoScoot",
    description:
      "Tous nos conseils pour acheter ou vendre une moto en toute sécurité en Tunisie : éviter les arnaques, vérifier les documents, transactions sécurisées.",
    h1: "Sécurité — Acheter et Vendre en Confiance",
    intro:
      "Protégez-vous lors de vos transactions : nos recommandations pour identifier les annonces frauduleuses, vérifier les papiers du véhicule, organiser un essai et un paiement en toute sécurité.",
  },
  {
    path: '/mentions-legales',
    title: "Mentions Légales | MotoScoot",
    description: "Mentions légales du site moto-scoot.tn : éditeur, hébergement, propriété intellectuelle, contact.",
    h1: "Mentions Légales",
    intro: "Informations légales relatives au site moto-scoot.tn — éditeur, hébergeur, contact.",
  },
  {
    path: '/conditions',
    title: "Conditions Générales d'Utilisation | MotoScoot",
    description:
      "Conditions générales d'utilisation de moto-scoot.tn : règles de publication d'annonces, comportement des utilisateurs, modération, responsabilités.",
    h1: "Conditions Générales d'Utilisation",
    intro:
      "Les conditions générales qui régissent l'utilisation de moto-scoot.tn — publication d'annonces, modération, droits et obligations des utilisateurs.",
  },
  {
    path: '/cookies',
    title: "Politique de Cookies | MotoScoot",
    description: "Politique d'utilisation des cookies sur moto-scoot.tn : types de cookies, finalités, gestion de votre consentement.",
    h1: "Politique de Cookies",
    intro:
      "Nous utilisons des cookies pour améliorer votre expérience. Détail des cookies déposés et de la manière dont vous pouvez gérer vos préférences.",
  },
];

export const DEFAULT_OG = DEFAULT_OG_IMAGE;
export const SITE_ORIGIN = SITE;
