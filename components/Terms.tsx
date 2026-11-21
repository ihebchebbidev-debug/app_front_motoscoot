import React from 'react';
import { PageBreadcrumb } from './ui/PageBreadcrumb';
import { READING_PROSE } from './ui/readingProse';
import { InfoHero, KeyPoints, TocList, FoldedToc } from './ui/InfoPage';

/**
 * Conditions générales d'utilisation (/conditions).
 *
 * Read surface: same hero as the other information pages (Sécurité, Cookies,
 * Mentions légales), then a sommaire beside the text on large screens and
 * folded above it on phones. Articles keep their numbers because the text
 * refers to them ("voir l'article 3").
 *
 * Legal frame: droit tunisien — loi n° 2000-83 (commerce électronique) and
 * loi organique n° 2004-63 (données personnelles). Change UPDATED_AT with
 * every change of substance.
 */
const UPDATED_AT = { label: '21 novembre 2026', iso: '2026-11-21' };

type Nav = (view: string) => void;

const SECTIONS: { id: string; title: string }[] = [
  { id: 'objet', title: '1. Qui sommes-nous' },
  { id: 'compte', title: '2. Votre compte' },
  { id: 'annonces', title: '3. Publier une annonce' },
  { id: 'moderation', title: '4. Modération et signalement' },
  { id: 'vente', title: '5. La vente entre utilisateurs' },
  { id: 'messages-avis', title: '6. Messages et avis' },
  { id: 'fiches', title: '7. Fiches techniques et prix du neuf' },
  { id: 'contenus', title: '8. Photos et contenus' },
  { id: 'responsabilite', title: '9. Responsabilité' },
  { id: 'donnees', title: '10. Données personnelles' },
  { id: 'modifications', title: '11. Modification et suspension' },
  { id: 'droit', title: '12. Droit applicable et contact' },
];

const SUMMARY = [
  'Moto-Scoot.tn met en relation acheteurs et vendeurs : nous ne vendons aucun véhicule.',
  'Publier une annonce est gratuit pour les particuliers. Le véhicule doit exister, vous appartenir et avoir ses papiers en règle.',
  'Nous pouvons refuser ou retirer une annonce qui ne respecte pas ces règles.',
  'Aucun paiement ne passe par le site : la vente se conclut directement entre vous.',
  'Ces conditions relèvent du droit tunisien.',
];

const InternalLink: React.FC<{ view: string; href: string; onNavigate?: Nav; children: React.ReactNode }> = ({ view, href, onNavigate, children }) => (
  <a
    href={href}
    onClick={(e) => {
      if (!onNavigate || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      onNavigate(view);
    }}
  >
    {children}
  </a>
);

const Section: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => (
  <section aria-labelledby={id}>
    <h2 id={id} tabIndex={-1} className="scroll-mt-28 focus:outline-none">
      {SECTIONS.find((s) => s.id === id)?.title}
    </h2>
    {children}
  </section>
);

const Terms: React.FC<any> = ({ onGoHome, onNavigate }) => {
  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-16">
      <InfoHero
        title="Conditions générales d'utilisation"
        subtitle="Les règles pour publier, acheter et vendre sur Moto-Scoot.tn."
      />

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-10 md:py-16">
        <header className="mb-8 md:mb-12">
          <PageBreadcrumb
            parents={[{ label: 'Accueil', href: '/', onClick: onGoHome }]}
            current="Conditions générales"
          />
        </header>

        <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10 xl:gap-14">
          {/* Sommaire: sticky column on large screens. */}
          <nav aria-label="Sommaire" className="hidden lg:block">
            <div className="sticky top-28">
              <p className="px-3 mb-3 text-sm font-bold text-gray-900">Sommaire</p>
              <TocList items={SECTIONS} />
            </div>
          </nav>

          <article className="bg-card rounded-3xl md:rounded-[2.5rem] border border-gray-100 shadow-sm px-5 py-8 sm:px-8 md:px-12 md:py-12">
            <div className="max-w-[68ch]">
              <p className="text-sm text-gray-600">
                Dernière mise à jour : <time dateTime={UPDATED_AT.iso}>{UPDATED_AT.label}</time>
              </p>

              <KeyPoints id="en-bref" title="En bref" items={SUMMARY} note="Ce résumé ne remplace pas le texte complet ci-dessous." />

              <FoldedToc items={SECTIONS} />

              <div className={`${READING_PROSE} prose-base md:prose-lg mt-2 prose-h2:text-xl md:prose-h2:text-2xl`}>
                <Section id="objet">
                  <p>
                    Moto-Scoot.tn est un site tunisien de petites annonces de motos, scooters et équipements, édité par Magma Studio
                    (voir les <InternalLink view="legal" href="/mentions-legales" onNavigate={onNavigate}>mentions légales</InternalLink>).
                    Il met en relation des acheteurs et des vendeurs, particuliers ou professionnels, et propose aussi des fiches
                    techniques, des prix du neuf et des articles.
                  </p>
                  <p>
                    Moto-Scoot.tn n'achète et ne vend aucun véhicule. En utilisant le site, vous acceptez les présentes conditions.
                  </p>
                </Section>

                <Section id="compte">
                  <p>
                    Consulter les annonces ne demande pas de compte. Pour publier une annonce, envoyer un message, enregistrer des favoris
                    ou laisser un avis, vous devez créer un compte.
                  </p>
                  <ul>
                    <li>Vous devez avoir au moins 18 ans.</li>
                    <li>Vos informations (nom, téléphone, e-mail) doivent être exactes et à jour.</li>
                    <li>Votre compte est personnel : vous êtes responsable de ce qui y est publié et de la confidentialité de vos accès.</li>
                    <li>Un professionnel (concessionnaire, garage, revendeur) se présente comme tel et ne se fait pas passer pour un particulier.</li>
                  </ul>
                </Section>

                <Section id="annonces">
                  <p>La publication d'une annonce est gratuite pour les particuliers. Chaque annonce doit :</p>
                  <ul>
                    <li>décrire un véhicule ou un équipement qui existe, qui vous appartient ou que vous êtes autorisé à vendre ;</li>
                    <li>indiquer un prix réel en dinars tunisiens, ainsi que l'année, le kilométrage et la ville exacts ;</li>
                    <li>montrer de vraies photos du véhicule, sans photo reprise d'un autre site ni coordonnées ajoutées sur l'image ;</li>
                    <li>concerner un seul véhicule, publié une seule fois.</li>
                  </ul>
                  <p>Sont interdits :</p>
                  <ul>
                    <li>les véhicules volés, sans carte grise ou dont les papiers ne sont pas en règle ;</li>
                    <li>les annonces trompeuses : faux prix d'appel, kilométrage modifié, défaut important caché ;</li>
                    <li>tout contenu illégal, insultant, discriminatoire ou sans rapport avec la moto et le scooter.</li>
                  </ul>
                </Section>

                <Section id="moderation">
                  <p>
                    Nous pouvons vérifier une annonce avant ou après sa publication, demander une correction, la refuser ou la retirer
                    lorsqu'elle ne respecte pas l'article 3. En cas d'abus répétés, le compte peut être suspendu (article 11).
                  </p>
                  <p>
                    Vous pouvez signaler une annonce avec le lien « Signaler un abus » de sa page, ou nous écrire depuis la
                    page <InternalLink view="contact" href="/contact" onNavigate={onNavigate}>Contact</InternalLink>. Nous examinons
                    chaque signalement.
                  </p>
                  <p>L'ordre des annonces dans les résultats dépend des filtres et du tri que vous choisissez.</p>
                </Section>

                <Section id="vente">
                  <p>
                    La vente se conclut directement entre l'acheteur et le vendeur. Moto-Scoot.tn n'est pas partie au contrat de vente,
                    ne reçoit aucun paiement et ne garantit ni l'état du véhicule, ni le sérieux de l'acheteur ou du vendeur.
                  </p>
                  <p>
                    Avant de payer, voyez le véhicule, vérifiez la carte grise et l'identité du vendeur, puis faites la mutation selon la
                    loi. Ne versez jamais d'acompte pour un véhicule que vous n'avez pas vu. Nos conseils sont sur la
                    page <InternalLink view="security" href="/securite" onNavigate={onNavigate}>Sécurité</InternalLink>.
                  </p>
                  <p>
                    Un professionnel qui vend sur le site reste tenu des obligations que la loi tunisienne lui impose envers ses clients,
                    notamment celles de la loi n° 2000-83 relative aux échanges et au commerce électroniques.
                  </p>
                </Section>

                <Section id="messages-avis">
                  <p>
                    La messagerie sert uniquement à échanger à propos d'une annonce. Le spam, le démarchage et les tentatives
                    d'arnaque y sont interdits.
                  </p>
                  <p>
                    Un avis doit raconter une expérience réelle, rester poli et ne pas contenir de données personnelles d'un tiers.
                    Nous pouvons retirer un avis faux, insultant ou hors sujet.
                  </p>
                </Section>

                <Section id="fiches">
                  <p>
                    Les fiches techniques, les prix du neuf et les articles sont donnés à titre indicatif. Nous les vérifions avec soin,
                    mais les caractéristiques et les prix peuvent changer : seul le vendeur ou l'importateur officiel peut confirmer
                    une offre.
                  </p>
                </Section>

                <Section id="contenus">
                  <p>
                    Vous restez propriétaire des textes et photos que vous publiez. Vous nous autorisez, gratuitement et pendant la durée
                    de publication, à les afficher sur le site et à les adapter (recadrage, compression) pour cet affichage.
                  </p>
                  <p>
                    La marque, le logo, la présentation du site, les fiches techniques et les articles appartiennent à Moto-Scoot.tn. Leur
                    reproduction, en tout ou en partie, demande notre accord écrit. La copie automatique des annonces est interdite.
                  </p>
                </Section>

                <Section id="responsabilite">
                  <p>
                    Chaque utilisateur est seul responsable de ce qu'il publie et des ventes qu'il conclut. Moto-Scoot.tn ne répond pas
                    des échanges entre utilisateurs, ni des dommages liés à une interruption momentanée du site. Nous retirons
                    rapidement tout contenu illicite qui nous est signalé.
                  </p>
                </Section>

                <Section id="donnees">
                  <p>
                    Nous traitons vos données (nom, téléphone, e-mail, annonces, messages) pour faire fonctionner le site, conformément à
                    la loi organique n° 2004-63 relative à la protection des données à caractère personnel. Nous ne vendons pas vos
                    données.
                  </p>
                  <p>
                    Vous pouvez accéder à vos données, les corriger ou demander leur suppression en écrivant à{' '}
                    <a href="mailto:contact@moto-scoot.tn">contact@moto-scoot.tn</a>. L'usage des cookies est détaillé sur la
                    page <InternalLink view="cookies" href="/cookies" onNavigate={onNavigate}>Cookies</InternalLink>.
                  </p>
                </Section>

                <Section id="modifications">
                  <p>
                    Nous pouvons modifier ces conditions pour suivre l'évolution du site ou de la loi. La date en haut de page indique
                    la version en vigueur ; une modification importante est signalée sur le site.
                  </p>
                  <p>
                    En cas de non-respect de ces conditions, nous pouvons suspendre ou supprimer un compte. Vous pouvez supprimer votre
                    compte à tout moment depuis votre espace personnel.
                  </p>
                </Section>

                <Section id="droit">
                  <p>
                    Ces conditions sont soumises au droit tunisien. En cas de désaccord, nous cherchons d'abord une solution amiable ;
                    à défaut, les tribunaux de Tunis sont compétents.
                  </p>
                  <p>
                    Pour toute question : <a href="mailto:contact@moto-scoot.tn">contact@moto-scoot.tn</a>, par téléphone au{' '}
                    <a href="tel:+21621719109" className="whitespace-nowrap">+216 21 719 109</a>, ou depuis la
                    page <InternalLink view="contact" href="/contact" onNavigate={onNavigate}>Contact</InternalLink>.
                  </p>
                </Section>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
};

export default Terms;
