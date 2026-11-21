import React from 'react';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import { PageBreadcrumb } from './ui/PageBreadcrumb';
import { READING_PROSE } from './ui/readingProse';
import { InfoHero, KeyPoints, TocList, FoldedToc } from './ui/InfoPage';
import { BUYER_SAFETY_TIPS } from '../constants/safetyTips';

/**
 * Sécurité (/securite): how to buy and sell a used motorbike safely in
 * Tunisia. Same hero and key-points box as the Conditions générales; the
 * five buyer reflexes are shared with the box on every listing.
 *
 * Tunisian steps (contrat signé à la municipalité, mutation à l'ATTT dans
 * les 15 jours) follow the Idaraty procedure sheets. Change UPDATED_AT
 * with every change of substance.
 */
const UPDATED_AT = { label: '21 novembre 2026', iso: '2026-11-21' };

const SECTIONS = [
  { id: 'vous-achetez', title: 'Vous achetez' },
  { id: 'vous-vendez', title: 'Vous vendez' },
  { id: 'papiers', title: 'Les papiers en Tunisie' },
  { id: 'arnaques', title: 'Les arnaques les plus courantes' },
  { id: 'signaler', title: 'Signaler un problème' },
] as const;

const H2 = 'scroll-mt-28 focus:outline-none';

const IDARATY_MUTATION = 'https://idaraty.tn/fr/procedures/mutation-dun-vehicule';

const Security: React.FC<any> = ({ onGoHome, onNavigate }) => {
  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-16">
      <InfoHero
        title="Sécurité : acheter et vendre en confiance"
        subtitle="Les bons réflexes pour une moto ou un scooter d'occasion en Tunisie."
      />

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-10 md:py-16">
        <header className="mb-8 md:mb-12">
          <PageBreadcrumb parents={[{ label: 'Accueil', href: '/', onClick: onGoHome }]} current="Sécurité" />
        </header>

        <div className="space-y-6 lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start lg:gap-8 lg:space-y-0 xl:gap-10">
          <article className="bg-card rounded-3xl md:rounded-[2.5rem] border border-gray-100 shadow-sm px-5 py-8 sm:px-8 md:px-12 md:py-12">
            <div className="max-w-[68ch]">
              <p className="text-sm text-gray-600">
                Dernière mise à jour&nbsp;: <time dateTime={UPDATED_AT.iso}>{UPDATED_AT.label}</time>
              </p>

              <KeyPoints id="reflexes" title="Les 5 réflexes de l'acheteur" items={BUYER_SAFETY_TIPS} />

              <FoldedToc items={SECTIONS} />

              <div className={`${READING_PROSE} prose-base md:prose-lg mt-2 prose-h2:text-xl md:prose-h2:text-2xl`}>
                <h2 id="vous-achetez" tabIndex={-1} className={H2}>Vous achetez</h2>
                <ul>
                  <li>
                    <strong>Voir avant de payer.</strong> Examinez la moto, démarrez-la moteur froid et faites un essai. Ne payez
                    rien à distance, même une partie du prix.
                  </li>
                  <li>
                    <strong>Pas d'acompte.</strong> Un vendeur qui demande de l'argent pour «&nbsp;garder&nbsp;» la moto, ou qui vous presse
                    de décider, doit vous alerter.
                  </li>
                  <li>
                    <strong>Un lieu public.</strong> Rencontrez le vendeur de jour, dans un endroit fréquenté, avec un proche ou
                    votre mécanicien.
                  </li>
                  <li>
                    <strong>Les papiers.</strong> Comparez le numéro de châssis gravé sur le cadre avec celui de la carte grise, et
                    le nom sur la carte grise avec la carte d'identité du vendeur.
                  </li>
                  <li>
                    <strong>Le prix.</strong> Un prix très en dessous du marché cache souvent une arnaque ou un défaut. Comparez avec
                    les autres annonces du même modèle.
                  </li>
                </ul>

                <h2 id="vous-vendez" tabIndex={-1} className={H2}>Vous vendez</h2>
                <ul>
                  <li>
                    <strong>L'argent d'abord.</strong> Remettez les clés et la carte grise seulement quand l'argent est réellement
                    à vous. Une capture d'écran de virement ou un SMS ne prouve rien&nbsp;: vérifiez votre compte.
                  </li>
                  <li>
                    <strong>Un essai encadré.</strong> Demandez à voir la carte d'identité et le permis de l'acheteur, et
                    accompagnez-le pendant l'essai.
                  </li>
                  <li>
                    <strong>Aucun code.</strong> Ne communiquez jamais un code reçu par SMS ni votre mot de passe, même à
                    quelqu'un qui dit appeler de la part de Moto-Scoot.tn.
                  </li>
                  <li>
                    <strong>Votre vie privée.</strong> Ne mettez dans l'annonce ni votre adresse, ni une photo de vos papiers.
                  </li>
                </ul>

                <h2 id="papiers" tabIndex={-1} className={H2}>Les papiers en Tunisie</h2>
                <p>Dans l'ordre, pour une vente entre particuliers&nbsp;:</p>
                <ol>
                  <li>Vérifiez que le vendeur est bien le propriétaire inscrit sur la carte grise et que le numéro de châssis correspond.</li>
                  <li>Demandez une attestation de non-gage&nbsp;: elle montre que la moto n'est pas gagée.</li>
                  <li>Signez le contrat de vente en deux exemplaires, auprès des services de la municipalité.</li>
                  <li>
                    Faites la mutation à l'ATTT dans les 15 jours qui suivent la signature, avec la carte grise, le contrat et le
                    certificat d'identification du véhicule.
                  </li>
                  <li>Assurez la moto avant de rouler.</li>
                </ol>
                <p className="!text-[0.9375rem] !text-gray-700">
                  Les pièces demandées peuvent changer. Vérifiez la liste à jour auprès de l'ATTT ou sur la{' '}
                  <a href={IDARATY_MUTATION} target="_blank" rel="noopener noreferrer">fiche «&nbsp;Mutation d'un véhicule&nbsp;» d'Idaraty</a>.
                </p>

                <h2 id="arnaques" tabIndex={-1} className={H2}>Les arnaques les plus courantes</h2>
                <ul>
                  <li>
                    <strong>L'acompte pour réserver.</strong> Le «&nbsp;vendeur&nbsp;» encaisse l'acompte, puis ne répond plus.
                  </li>
                  <li>
                    <strong>Le faux justificatif de paiement.</strong> Capture d'écran de virement, faux SMS de banque ou de La
                    Poste&nbsp;: l'argent n'est jamais arrivé.
                  </li>
                  <li>
                    <strong>Le lien reçu par SMS ou WhatsApp.</strong> La page imite un site connu pour voler vos codes ou votre
                    carte bancaire. N'y saisissez rien.
                  </li>
                  <li>
                    <strong>Le vendeur absent.</strong> Il serait à l'étranger et propose d'envoyer la moto après paiement. Il n'y
                    a pas de moto.
                  </li>
                </ul>
              </div>
            </div>
          </article>

          {/* Sticky only when the window is tall enough to show the whole column. */}
          <aside className="space-y-6 lg:[@media(min-height:50rem)]:sticky lg:[@media(min-height:50rem)]:top-28">
            <nav aria-label="Sommaire" className="hidden lg:block">
              <p className="px-3 mb-3 text-sm font-bold text-gray-900">Sommaire</p>
              <TocList items={SECTIONS} tracked />
            </nav>

          <section aria-labelledby="signaler" className="rounded-3xl md:rounded-[2.5rem] bg-neutral-900 px-5 py-8 sm:px-8 md:px-12 md:py-10 lg:rounded-3xl lg:px-7 lg:py-8 text-white">
            <div className="max-w-[68ch]">
              <div className="flex items-center gap-3">
                <ShieldAlert size={26} className="shrink-0 text-primary-400" aria-hidden="true" />
                <h2 id="signaler" tabIndex={-1} className="scroll-mt-28 focus:outline-none text-xl md:text-2xl lg:text-xl font-extrabold tracking-tight">Un doute&nbsp;? Signalez-le</h2>
              </div>
              <p className="mt-4 text-base lg:text-[0.9375rem] leading-relaxed text-gray-300">
                Sur chaque annonce, le lien «&nbsp;Signaler un abus&nbsp;» prévient notre équipe de modération. Vous pouvez aussi nous écrire.
                Si vous avez perdu de l'argent, déposez plainte auprès de la police et prévenez votre banque au plus vite.
              </p>
              <p className="mt-4 text-base lg:text-[0.9375rem] leading-relaxed font-semibold text-white">
                Moto-Scoot.tn ne vous demandera jamais de paiement, de code reçu par SMS ni de mot de passe.
              </p>
              <a
                href="/contact"
                onClick={(e) => {
                  if (!onNavigate || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                  e.preventDefault();
                  onNavigate('contact');
                }}
                className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-primary-600 px-6 py-3 font-bold text-white transition-[transform,background-color] duration-150 ease-out [@media(hover:hover)]:hover:bg-primary-700 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
              >
                Contacter la modération
                <ArrowRight size={18} aria-hidden="true" />
              </a>
            </div>
          </section>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Security;
