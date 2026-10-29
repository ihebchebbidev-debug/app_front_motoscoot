/**
 * SeoSetupGuide — guide pas-à-pas intégré au tab SEO/Analytics.
 *
 * Affiche 6 étapes pour qu'un admin non-technique configure :
 *   1. Méta SEO par défaut
 *   2. Google Analytics 4 (création + Measurement ID)
 *   3. Vérification Google Search Console
 *   4. Service Account Google Cloud (pour rapports live)
 *   5. Test des identifiants
 *   6. Vérification finale
 *
 * Chaque étape affiche un statut en direct (✅ configuré / ⏳ à faire)
 * en fonction des valeurs déjà renseignées dans le formulaire.
 */
import React, { useMemo, useState } from 'react';
import {
  CheckCircle2, Circle, ChevronDown, ChevronRight, BookOpen,
  ExternalLink, Lightbulb, AlertTriangle, XCircle, Info,
} from 'lucide-react';
import type { AdminSeoSettings } from '../../services/seoSettingsApi';

interface Props {
  settings?: AdminSeoSettings;
  draft: Partial<AdminSeoSettings>;
  hasServiceAccount: boolean;
  serviceAccountText?: string;
}

interface Step {
  id: number;
  title: string;
  done: boolean;
  body: React.ReactNode;
}

type IssueLevel = 'error' | 'warning' | 'info';
interface Issue {
  level: IssueLevel;
  field: string;
  message: string;
  hint: string;
}

const SeoSetupGuide: React.FC<Props> = ({ draft, hasServiceAccount, serviceAccountText }) => {

  const [open, setOpen] = useState(true);
  const [activeStep, setActiveStep] = useState<number | null>(1);

  const steps: Step[] = [
    {
      id: 1,
      title: 'Renseigner les méta SEO par défaut',
      done: !!(draft.default_title && draft.default_description),
      body: (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Ces valeurs apparaissent par défaut dans Google et lors d'un partage Facebook/WhatsApp/X lorsqu'une page n'a pas de méta dédiée.</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Descendez à la section <strong>« Méta par défaut »</strong> ci-dessous.</li>
            <li>Remplissez <strong>Titre par défaut</strong> (ex : « MotoScoot — Vente Moto en Tunisie »).</li>
            <li>Remplissez <strong>Description par défaut</strong> (≤ 160 caractères, accrocheur).</li>
            <li>Ajoutez une <strong>Image OG</strong> (1200×630 px recommandé) — c'est l'image qui s'affiche dans les partages sociaux.</li>
            <li>Cliquez sur <strong>Enregistrer</strong> en haut à droite.</li>
          </ol>
        </div>
      ),
    },
    {
      id: 2,
      title: 'Activer Google Analytics 4',
      done: !!draft.ga4_measurement_id,
      body: (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Pour suivre les visites en temps réel sur votre site.</p>
          <ol className="list-decimal pl-5 space-y-1.5">
            <li>
              Ouvrez{' '}
              <a href="https://analytics.google.com/" target="_blank" rel="noreferrer" className="text-primary underline inline-flex items-center gap-1">
                analytics.google.com <ExternalLink className="h-3 w-3" />
              </a>{' '}
              et connectez-vous.
            </li>
            <li>Cliquez sur <strong>Administration</strong> (icône engrenage) → <strong>Créer une propriété</strong>.</li>
            <li>Nom : <code className="px-1 bg-muted rounded">MotoScoot</code> · Fuseau : <strong>Tunisie</strong> · Devise : <strong>TND</strong>.</li>
            <li>Type de plateforme : <strong>Web</strong>. URL : <code className="px-1 bg-muted rounded">https://moto-scoot.tn</code>.</li>
            <li>Copiez le <strong>Measurement ID</strong> affiché (format <code>G-XXXXXXXXXX</code>).</li>
            <li>Collez-le dans le champ <strong>« Measurement ID »</strong> de la section Google Analytics 4 ci-dessous.</li>
            <li>Notez aussi le <strong>Property ID</strong> (chiffres uniquement, dans Détails propriété) — utile pour l'étape 4.</li>
            <li>Cliquez sur <strong>Enregistrer</strong>. Le tracking démarre immédiatement (respecte la bannière cookies).</li>
          </ol>
        </div>
      ),
    },
    {
      id: 3,
      title: 'Vérifier le site dans Search Console',
      done: !!draft.gsc_verification_code,
      body: (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Permet à Google d'indexer votre site et de vous fournir les requêtes recherchées.</p>
          <ol className="list-decimal pl-5 space-y-1.5">
            <li>
              Ouvrez{' '}
              <a href="https://search.google.com/search-console" target="_blank" rel="noreferrer" className="text-primary underline inline-flex items-center gap-1">
                search.google.com/search-console <ExternalLink className="h-3 w-3" />
              </a>.
            </li>
            <li>Cliquez sur <strong>Ajouter une propriété</strong> → choisissez <strong>« Préfixe d'URL »</strong>.</li>
            <li>Saisissez <code className="px-1 bg-muted rounded">https://moto-scoot.tn</code> et validez.</li>
            <li>Sélectionnez la méthode <strong>« Balise HTML »</strong>.</li>
            <li>Copiez uniquement la valeur entre guillemets de <code>content="..."</code>.</li>
            <li>Collez-la dans <strong>« Code de vérification »</strong> ci-dessous → <strong>Enregistrer</strong>.</li>
            <li>Attendez 1 minute, puis retournez dans Search Console et cliquez sur <strong>Valider</strong>.</li>
            <li>Renseignez aussi le <strong>Site URL</strong> au format <code>sc-domain:moto-scoot.tn</code>.</li>
          </ol>
          <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 p-2 text-xs flex gap-2 mt-2">
            <Lightbulb className="h-4 w-4 flex-shrink-0" />
            <span>Pensez aussi à soumettre votre sitemap : <code>https://moto-scoot.tn/sitemap.xml</code> dans l'onglet « Sitemaps » de Search Console.</span>
          </div>
        </div>
      ),
    },
    {
      id: 4,
      title: 'Connecter un Service Account Google (rapports live)',
      done: hasServiceAccount,
      body: (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Permet d'afficher les rapports GA4 et Search Console directement dans cet écran.</p>
          <ol className="list-decimal pl-5 space-y-1.5">
            <li>
              Ouvrez{' '}
              <a href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noreferrer" className="text-primary underline inline-flex items-center gap-1">
                console.cloud.google.com → Service Accounts <ExternalLink className="h-3 w-3" />
              </a>.
            </li>
            <li>Créez un projet (ou sélectionnez-en un existant).</li>
            <li>Cliquez sur <strong>+ Créer un compte de service</strong>. Nom : <code className="px-1 bg-muted rounded">motoscoot-seo</code>.</li>
            <li>Skip le rôle (laissez vide) → <strong>OK</strong>.</li>
            <li>Ouvrez le compte créé → onglet <strong>« Clés »</strong> → <strong>Ajouter une clé</strong> → <strong>JSON</strong>. Un fichier <code>.json</code> est téléchargé.</li>
            <li>Copiez l'adresse email du compte (format <code>...@...iam.gserviceaccount.com</code>).</li>
            <li>
              Activez les APIs :{' '}
              <a href="https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com" target="_blank" rel="noreferrer" className="text-primary underline">Analytics Data API</a>{' '}
              et{' '}
              <a href="https://console.cloud.google.com/apis/library/searchconsole.googleapis.com" target="_blank" rel="noreferrer" className="text-primary underline">Search Console API</a>.
            </li>
            <li>Dans <strong>GA4 → Administration → Gestion des accès propriété</strong>, ajoutez l'email du Service Account avec le rôle <strong>« Lecteur »</strong>.</li>
            <li>Dans <strong>Search Console → Paramètres → Utilisateurs et autorisations</strong>, ajoutez le même email avec accès <strong>« Restreint »</strong>.</li>
            <li>Ouvrez le fichier JSON dans un éditeur, copiez tout son contenu, et collez-le dans la zone <strong>« Service Account Google (JSON) »</strong> ci-dessous.</li>
            <li>Cliquez sur <strong>Enregistrer</strong>.</li>
          </ol>
        </div>
      ),
    },
    {
      id: 5,
      title: 'Tester les identifiants',
      done: false,
      body: (
        <div className="space-y-2 text-sm text-muted-foreground">
          <ol className="list-decimal pl-5 space-y-1">
            <li>Dans la section <strong>Service Account Google</strong> ci-dessous, cliquez sur <strong>« Tester les identifiants »</strong>.</li>
            <li>Vous devez voir <span className="text-emerald-600 font-medium">« Connexion OK »</span> à la fois pour GA4 et Search Console.</li>
            <li>Si une erreur apparaît : vérifiez que vous avez bien partagé l'accès au Service Account (étapes 8 et 9 ci-dessus) et que le Property ID + Site URL sont remplis.</li>
          </ol>
        </div>
      ),
    },
    {
      id: 6,
      title: 'Vérifier que tout fonctionne',
      done: false,
      body: (
        <div className="space-y-2 text-sm text-muted-foreground">
          <ol className="list-decimal pl-5 space-y-1.5">
            <li>Ouvrez votre site dans un nouvel onglet — acceptez la bannière cookies.</li>
            <li>Revenez dans GA4 → <strong>Rapports → Temps réel</strong> : vous devez voir au moins 1 utilisateur actif sous 60 secondes.</li>
            <li>Dans Search Console, allez dans <strong>Inspection d'URL</strong> et testez votre page d'accueil → cliquez sur <strong>« Demander l'indexation »</strong>.</li>
            <li>Revenez ici → section <strong>« Rapports en direct »</strong> → cliquez sur <strong>« Charger »</strong>. Les top pages GA4 et top requêtes GSC s'affichent (peut prendre 24–48 h après installation pour avoir des données significatives).</li>
            <li>Partagez l'URL de votre site sur WhatsApp/Facebook pour vérifier que l'aperçu (titre + image OG) s'affiche correctement.</li>
          </ol>
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 p-2 text-xs flex gap-2 mt-2">
            <Lightbulb className="h-4 w-4 flex-shrink-0" />
            <span>Les données Search Console prennent 2 à 3 jours avant d'apparaître. GA4 est instantané.</span>
          </div>
        </div>
      ),
    },
  ];

  const completed = steps.filter((s) => s.done).length;

  // -------- Détection des problèmes (validation en direct) --------
  const issues = useMemo<Issue[]>(() => {
    const out: Issue[] = [];

    // --- Méta par défaut ---
    if (!draft.default_title?.trim()) {
      out.push({ level: 'error', field: 'Titre par défaut', message: 'Aucun titre par défaut configuré.', hint: 'Google affichera le titre de chaque page individuellement, mais sans fallback unique pour le branding. Renseignez « Titre par défaut » dans la section Méta.' });
    } else if ((draft.default_title || '').length > 60) {
      out.push({ level: 'warning', field: 'Titre par défaut', message: `Titre trop long (${draft.default_title!.length}/60 caractères).`, hint: 'Google tronque les titres au-delà de 60 caractères. Raccourcissez pour un meilleur rendu.' });
    }

    if (!draft.default_description?.trim()) {
      out.push({ level: 'error', field: 'Description par défaut', message: 'Aucune description par défaut.', hint: 'C\'est le texte affiché sous votre titre dans Google. Rédigez une phrase accrocheuse (140–160 caractères).' });
    } else if ((draft.default_description || '').length > 160) {
      out.push({ level: 'warning', field: 'Description par défaut', message: `Description trop longue (${draft.default_description!.length}/160).`, hint: 'Google tronque au-delà de 160 caractères. Resserrez votre message.' });
    } else if ((draft.default_description || '').length < 70) {
      out.push({ level: 'info', field: 'Description par défaut', message: 'Description un peu courte.', hint: 'Visez 140–160 caractères pour maximiser l\'espace alloué par Google.' });
    }

    if (!draft.default_og_image?.trim()) {
      out.push({ level: 'warning', field: 'Image OG', message: 'Aucune image de partage social configurée.', hint: 'Sans image, vos liens partagés sur Facebook/WhatsApp/X afficheront un aperçu vide. Ajoutez une image 1200×630 px.' });
    } else if (!/^https?:\/\//i.test(draft.default_og_image)) {
      out.push({ level: 'error', field: 'Image OG', message: 'L\'URL de l\'image OG doit être absolue (https://…).', hint: 'Les réseaux sociaux ne suivent pas les URLs relatives. Utilisez l\'URL publique complète.' });
    }

    // --- GA4 --- (Measurement ID hardcoded G-LMCBTZXV3Q — only Property ID is admin-editable for live reports)
    if (!draft.ga4_property_id?.trim()) {
      out.push({ level: 'info', field: 'GA4 — Property ID', message: 'Property ID manquant — les rapports live ci-dessous ne se chargeront pas.', hint: 'Trouvez-le dans Admin GA4 → Détails de la propriété (uniquement des chiffres, ex : 123456789).' });
    } else if (!/^\d+$/.test(draft.ga4_property_id.trim())) {
      out.push({ level: 'error', field: 'GA4 — Property ID', message: 'Le Property ID doit contenir uniquement des chiffres.', hint: 'Vous avez peut-être collé un Measurement ID (G-...) par erreur. Le Property ID est purement numérique.' });
    }

    // --- Search Console ---
    if (!draft.gsc_verification_code?.trim()) {
      out.push({ level: 'warning', field: 'Search Console — Vérification', message: 'Aucun code de vérification Google Search Console.', hint: 'Sans cela, Google ne peut pas vérifier la propriété du site. Suivez l\'étape 3 du guide.' });
    }

    if (draft.gsc_verification_code && !draft.gsc_site_url?.trim()) {
      out.push({ level: 'warning', field: 'Search Console — Site URL', message: 'Site URL manquant — rapports GSC indisponibles.', hint: 'Indiquez sc-domain:moto-scoot.tn (recommandé) ou https://www.moto-scoot.tn/ — doit correspondre exactement à la propriété dans Search Console.' });
    } else if (draft.gsc_site_url && !/^(sc-domain:|https?:\/\/)/.test(draft.gsc_site_url.trim())) {
      out.push({ level: 'error', field: 'Search Console — Site URL', message: 'Format du Site URL invalide.', hint: 'Utilisez sc-domain:moto-scoot.tn pour une Domain Property, ou https://moto-scoot.tn/ pour une URL-prefix Property.' });
    }

    // --- Service Account ---
    if (!hasServiceAccount) {
      out.push({ level: 'info', field: 'Service Account Google', message: 'Aucun Service Account configuré.', hint: 'Optionnel mais recommandé : permet d\'afficher les rapports GA4 et Search Console directement dans cet écran (étape 4 du guide).' });
    } else if (serviceAccountText && serviceAccountText.trim()) {
      try {
        const parsed = JSON.parse(serviceAccountText);
        if (parsed.type !== 'service_account') {
          out.push({ level: 'error', field: 'Service Account Google', message: 'Le JSON n\'est pas un compte de service Google.', hint: 'Le champ "type" doit valoir "service_account". Téléchargez à nouveau le fichier JSON depuis Google Cloud Console.' });
        } else if (!parsed.client_email || !parsed.private_key) {
          out.push({ level: 'error', field: 'Service Account Google', message: 'JSON incomplet (client_email ou private_key manquant).', hint: 'Re-téléchargez la clé JSON depuis Google Cloud Console → Service Accounts → Clés.' });
        }
      } catch {
        out.push({ level: 'error', field: 'Service Account Google', message: 'Le JSON collé est invalide.', hint: 'Ouvrez le fichier téléchargé dans un éditeur de texte et copiez-collez l\'intégralité de son contenu (commence par { et termine par }).' });
      }
    }

    // --- Organisation JSON-LD ---
    if (draft.enable_organization_jsonld !== false) {
      if (!draft.organization_name?.trim()) {
        out.push({ level: 'warning', field: 'Organisation — Nom', message: 'Nom d\'organisation manquant (JSON-LD activé).', hint: 'Le schéma Organization aide Google à afficher votre marque dans le Knowledge Panel. Renseignez le nom dans la section Organisation.' });
      }
      if (!draft.organization_logo?.trim()) {
        out.push({ level: 'info', field: 'Organisation — Logo', message: 'Logo de l\'organisation non renseigné.', hint: 'Recommandé pour le Knowledge Panel Google. URL absolue (https://…), ratio carré, minimum 112×112 px.' });
      }
    }

    return out;
  }, [draft, hasServiceAccount, serviceAccountText]);

  const errorCount = issues.filter((i) => i.level === 'error').length;
  const warningCount = issues.filter((i) => i.level === 'warning').length;
  const infoCount = issues.filter((i) => i.level === 'info').length;

  return (
    <div className="space-y-4 mb-6">
      {/* ============ Section : Problèmes détectés ============ */}
      <div className={`rounded-2xl border-2 p-5 ${
        errorCount > 0
          ? 'border-red-300 bg-red-50/50'
          : warningCount > 0
            ? 'border-amber-300 bg-amber-50/50'
            : 'border-emerald-300 bg-emerald-50/50'
      }`}>
        <div className="flex items-start gap-3">
          <div className={`rounded-full p-2 ${
            errorCount > 0 ? 'bg-red-100' : warningCount > 0 ? 'bg-amber-100' : 'bg-emerald-100'
          }`}>
            {errorCount > 0
              ? <XCircle className="h-5 w-5 text-red-600" />
              : warningCount > 0
                ? <AlertTriangle className="h-5 w-5 text-amber-600" />
                : <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-foreground">
              {issues.length === 0
                ? 'Aucun problème détecté'
                : `Problèmes détectés (${issues.length})`}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {issues.length === 0
                ? 'Votre configuration SEO est complète et valide. 🎉'
                : `${errorCount} erreur${errorCount > 1 ? 's' : ''} · ${warningCount} avertissement${warningCount > 1 ? 's' : ''} · ${infoCount} info${infoCount > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        {issues.length > 0 && (
          <ul className="space-y-2 mt-4">
            {issues.map((issue, i) => {
              const styles = issue.level === 'error'
                ? { border: 'border-red-200', bg: 'bg-red-50', icon: <XCircle className="h-4 w-4 text-red-600" />, label: 'Erreur', labelClass: 'bg-red-100 text-red-700' }
                : issue.level === 'warning'
                  ? { border: 'border-amber-200', bg: 'bg-amber-50', icon: <AlertTriangle className="h-4 w-4 text-amber-600" />, label: 'Avertissement', labelClass: 'bg-amber-100 text-amber-700' }
                  : { border: 'border-blue-200', bg: 'bg-blue-50', icon: <Info className="h-4 w-4 text-blue-600" />, label: 'Info', labelClass: 'bg-blue-100 text-blue-700' };
              return (
                <li key={i} className={`rounded-lg border ${styles.border} ${styles.bg} p-3`}>
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex-shrink-0">{styles.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${styles.labelClass}`}>
                          {styles.label}
                        </span>
                        <span className="text-xs font-semibold text-foreground">{issue.field}</span>
                      </div>
                      <p className="text-sm text-foreground mt-1">{issue.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">💡 {issue.hint}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ============ Section : Guide pas à pas ============ */}
      <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-background p-5">

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-primary/10 p-2">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Guide de configuration pas à pas</h3>
            <p className="text-xs text-muted-foreground">
              {completed}/{steps.length} étapes essentielles complétées · cliquez pour {open ? 'réduire' : 'afficher'}
            </p>
          </div>
        </div>
        {open ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-4 space-y-2">
          {/* Progress bar */}
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${(completed / steps.length) * 100}%` }}
            />
          </div>

          <div className="space-y-1.5 mt-3">
            {steps.map((step) => {
              const expanded = activeStep === step.id;
              return (
                <div
                  key={step.id}
                  className={`rounded-lg border ${expanded ? 'border-primary/40 bg-card' : 'border-border bg-card/50'} transition-colors`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveStep(expanded ? null : step.id)}
                    className="flex items-center gap-3 w-full p-3 text-left"
                  >
                    {step.done ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className="text-xs font-bold text-muted-foreground w-6">{step.id}.</span>
                    <span className={`text-sm font-medium flex-1 ${step.done ? 'text-foreground' : 'text-foreground'}`}>
                      {step.title}
                    </span>
                    {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  {expanded && (
                    <div className="px-4 pb-4 pl-14 border-t border-border/50 pt-3">
                      {step.body}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default SeoSetupGuide;
