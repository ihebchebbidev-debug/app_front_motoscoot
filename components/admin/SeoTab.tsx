/**
 * SeoTab — admin-managed SEO + Google Analytics 4 + Search Console.
 *
 * One screen lets a non-technical admin:
 *   1. Edit default SEO meta (title template, description, OG image, keywords).
 *   2. Configure organisation schema (LocalBusiness JSON-LD) used site-wide.
 *   3. Paste the GA4 measurement ID — gtag.js is injected automatically on
 *      every page; existing tracking + cookie consent keep working.
 *   4. Paste the Google Search Console verification code — rendered as a
 *      <meta name="google-site-verification"> tag site-wide.
 *   5. Upload a Google Cloud Service Account JSON to unlock live GA4
 *      reports (sessions, page views, top pages) and Search Console
 *      reports (top queries, impressions, clicks) directly inside this tab.
 *
 * All values are persisted to /api/admin/site-settings/seo. The public
 * endpoint /api/site-settings/seo strips secrets (API secret + service
 * account JSON) and is consumed by SEO.tsx and the GA4 loader.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Save, Loader2, BarChart3, Search, KeyRound, Building2, Sparkles,
  CheckCircle2, AlertCircle, Eye, EyeOff, RefreshCw, Globe, Tag, Image as ImageIcon, ShieldCheck,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { seoSettingsApi, AdminSeoSettings } from '../../services/seoSettingsApi';
import { SEO_SETTINGS_QUERY_KEY } from '../../hooks/useSeoSettings';
import { useToast } from '../../context/ToastContext';
import SeoSetupGuide from './SeoSetupGuide';

const TEXT_INPUT = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40';
const TEXTAREA   = TEXT_INPUT + ' min-h-[80px] font-mono';
const LABEL      = 'text-xs font-medium text-muted-foreground uppercase tracking-wide';
const SECTION    = 'rounded-2xl border border-border bg-card p-5 space-y-4';

type Draft = Partial<AdminSeoSettings>;

const SeoTab: React.FC = () => {
  const { addToast } = useToast();
  const qc = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ['admin', 'seo-settings'],
    queryFn: () => seoSettingsApi.getAdmin(),
    staleTime: 1000 * 60 * 2,
  });

  const [draft, setDraft] = useState<Draft>({});
  const [saving, setSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [serviceAccountText, setServiceAccountText] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [ga4Report, setGa4Report] = useState<any>(null);
  const [gscReport, setGscReport] = useState<any>(null);
  const [loadingReports, setLoadingReports] = useState(false);

  // Hydrate the draft once the server payload arrives.
  useEffect(() => {
    if (!settingsQuery.data) return;
    const s = settingsQuery.data;
    setDraft({
      default_title: s.default_title || '',
      title_template: s.title_template || '%s | MotoScoot',
      default_description: s.default_description || '',
      default_keywords: s.default_keywords || '',
      default_og_image: s.default_og_image || '',
      twitter_handle: s.twitter_handle || '',
      organization_name: s.organization_name || '',
      organization_logo: s.organization_logo || '',
      organization_phone: s.organization_phone || '',
      organization_email: s.organization_email || '',
      organization_address: s.organization_address || '',
      ga4_measurement_id: s.ga4_measurement_id || '',
      ga4_api_secret: s.ga4_api_secret || '',
      ga4_property_id: s.ga4_property_id || '',
      gsc_verification_code: s.gsc_verification_code || '',
      gsc_site_url: s.gsc_site_url || '',
      robots_extra: s.robots_extra || '',
      enable_analytics: s.enable_analytics !== false,
      enable_organization_jsonld: s.enable_organization_jsonld !== false,
    });
    setServiceAccountText(s.google_service_account ? JSON.stringify(s.google_service_account, null, 2) : '');
  }, [settingsQuery.data]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Draft = { ...draft };
      // Service account JSON: send only when non-empty; let the controller parse it.
      if (serviceAccountText.trim()) {
        payload.google_service_account = serviceAccountText.trim() as any;
      } else if (settingsQuery.data?._meta?.has_service_account === false) {
        payload.google_service_account = null;
      }
      await seoSettingsApi.update(payload);
      await qc.invalidateQueries({ queryKey: ['admin', 'seo-settings'] });
      await qc.invalidateQueries({ queryKey: SEO_SETTINGS_QUERY_KEY });
      addToast('Paramètres SEO enregistrés.', 'success');
    } catch (e: any) {
      addToast(e?.message || 'Échec de l\'enregistrement.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const r = await seoSettingsApi.testCredentials();
      setTestResult(r);
    } catch (e: any) {
      setTestResult({ error: e?.message || 'Test échoué.' });
    } finally {
      setTesting(false);
    }
  };

  const handleLoadReports = async () => {
    setLoadingReports(true);
    setGa4Report(null); setGscReport(null);
    try {
      const [ga, gs] = await Promise.allSettled([
        seoSettingsApi.ga4Report({
          body: {
            dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
            metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }, { name: 'sessions' }],
            dimensions: [{ name: 'pagePath' }],
            orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
            limit: 10,
          },
        }),
        seoSettingsApi.gscReport({ days: 28 }),
      ]);
      if (ga.status === 'fulfilled') setGa4Report(ga.value);
      else setGa4Report({ error: (ga.reason as any)?.message || 'GA4 indisponible.' });
      if (gs.status === 'fulfilled') setGscReport(gs.value);
      else setGscReport({ error: (gs.reason as any)?.message || 'GSC indisponible.' });
    } finally {
      setLoadingReports(false);
    }
  };

  const verificationMetaPreview = useMemo(() => {
    const code = draft.gsc_verification_code?.trim();
    if (!code) return null;
    return `<meta name="google-site-verification" content="${code}" />`;
  }, [draft.gsc_verification_code]);

  if (settingsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement des paramètres SEO…
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header + global save */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> SEO & Analytics
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configurez les méta-données par défaut, Google Analytics 4 et Search Console.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Enregistrer
        </button>
      </div>

      {/* Guide pas à pas + problèmes détectés */}
      <SeoSetupGuide
        settings={settingsQuery.data}
        draft={draft}
        hasServiceAccount={!!settingsQuery.data?._meta?.has_service_account || !!serviceAccountText.trim()}
        serviceAccountText={serviceAccountText}
      />

      {/* 1. Default meta */}
      <div className={SECTION}>
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Méta par défaut</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Titre par défaut</label>
            <input className={TEXT_INPUT} value={draft.default_title || ''} onChange={(e) => set('default_title', e.target.value)} placeholder="MotoScoot — Vente Moto en Tunisie" />
          </div>
          <div>
            <label className={LABEL}>Modèle de titre</label>
            <input className={TEXT_INPUT} value={draft.title_template || ''} onChange={(e) => set('title_template', e.target.value)} placeholder="%s | MotoScoot" />
            <p className="text-[11px] text-muted-foreground mt-1">{`Utilise %s comme placeholder du titre de page.`}</p>
          </div>
          <div className="md:col-span-2">
            <label className={LABEL}>Description par défaut</label>
            <textarea className={TEXTAREA} value={draft.default_description || ''} onChange={(e) => set('default_description', e.target.value)} maxLength={400} placeholder="Description affichée dans Google et les partages sociaux (≤ 160 car.)" />
          </div>
          <div className="md:col-span-2">
            <label className={LABEL}>Mots-clés (séparés par virgules)</label>
            <input className={TEXT_INPUT} value={draft.default_keywords || ''} onChange={(e) => set('default_keywords', e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className={LABEL}>Image OG / Twitter (URL)</label>
            <div className="flex gap-2 items-start">
              <input className={TEXT_INPUT} value={draft.default_og_image || ''} onChange={(e) => set('default_og_image', e.target.value)} placeholder="https://..." />
              {draft.default_og_image && (
                <img src={draft.default_og_image} alt="" className="h-12 w-20 object-cover rounded border border-border" />
              )}
            </div>
          </div>
          <div>
            <label className={LABEL}>Compte Twitter / X</label>
            <input className={TEXT_INPUT} value={draft.twitter_handle || ''} onChange={(e) => set('twitter_handle', e.target.value)} placeholder="@motoscoot_tn" />
          </div>
        </div>
      </div>

      {/* 2. Organisation schema */}
      <div className={SECTION}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Organisation (JSON-LD)</h3>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={!!draft.enable_organization_jsonld} onChange={(e) => set('enable_organization_jsonld', e.target.checked)} />
            Activer
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Nom</label>
            <input className={TEXT_INPUT} value={draft.organization_name || ''} onChange={(e) => set('organization_name', e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Logo (URL)</label>
            <input className={TEXT_INPUT} value={draft.organization_logo || ''} onChange={(e) => set('organization_logo', e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Téléphone</label>
            <input className={TEXT_INPUT} value={draft.organization_phone || ''} onChange={(e) => set('organization_phone', e.target.value)} placeholder="+216 ..." />
          </div>
          <div>
            <label className={LABEL}>Email</label>
            <input className={TEXT_INPUT} value={draft.organization_email || ''} onChange={(e) => set('organization_email', e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className={LABEL}>Adresse</label>
            <input className={TEXT_INPUT} value={draft.organization_address || ''} onChange={(e) => set('organization_address', e.target.value)} placeholder="Tunis, Tunisie" />
          </div>
        </div>
      </div>

      {/* 3. Google Analytics 4 — measurement tag hardcoded (G-LMCBTZXV3Q).
          Only the fields needed for live admin reports remain editable. */}
      <div className={SECTION}>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Google Analytics 4 — Rapports</h3>
        </div>
        <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            Le tag <code className="font-mono">G-LMCBTZXV3Q</code> est intégré directement dans l'application
            et se déclenche après acceptation de la bannière cookies (Consent Mode v2).
            Aucune configuration nécessaire ici pour le tracking.
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Property ID (pour les rapports ci-dessous)</label>
            <input className={TEXT_INPUT} value={draft.ga4_property_id || ''} onChange={(e) => set('ga4_property_id', e.target.value)} placeholder="123456789" />
            <p className="text-[11px] text-muted-foreground mt-1">Numérique uniquement — Admin GA4 → Détails de la propriété.</p>
          </div>
          <div>
            <label className={LABEL}>API Secret (optionnel — Measurement Protocol)</label>
            <div className="relative">
              <input
                className={TEXT_INPUT + ' pr-10'}
                type={showSecret ? 'text' : 'password'}
                value={draft.ga4_api_secret || ''}
                onChange={(e) => set('ga4_api_secret', e.target.value)}
              />
              <button type="button" onClick={() => setShowSecret((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Search Console */}
      <div className={SECTION}>
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Google Search Console</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Code de vérification</label>
            <input className={TEXT_INPUT} value={draft.gsc_verification_code || ''} onChange={(e) => set('gsc_verification_code', e.target.value)} placeholder="abcDEF123..." />
            {verificationMetaPreview && (
              <pre className="text-[11px] mt-2 p-2 bg-muted rounded text-foreground overflow-x-auto">{verificationMetaPreview}</pre>
            )}
          </div>
          <div>
            <label className={LABEL}>Site URL (rapports)</label>
            <input className={TEXT_INPUT} value={draft.gsc_site_url || ''} onChange={(e) => set('gsc_site_url', e.target.value)} placeholder="sc-domain:moto-scoot.tn  ou  https://www.moto-scoot.tn/" />
            <p className="text-[11px] text-muted-foreground mt-1">Format Domain property: <code>sc-domain:moto-scoot.tn</code>.</p>
          </div>
        </div>
      </div>

      {/* 5. Service Account */}
      <div className={SECTION}>
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Service Account Google (JSON)</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Collez ici le contenu complet du fichier JSON téléchargé depuis Google Cloud Console
          (Service Account avec rôles « Viewer » sur GA4 + Search Console).
        </p>
        <textarea
          className={TEXTAREA + ' min-h-[180px]'}
          value={serviceAccountText}
          onChange={(e) => setServiceAccountText(e.target.value)}
          placeholder='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'
          spellCheck={false}
        />
        {settingsQuery.data?._meta?.service_account_email && (
          <p className="text-xs text-emerald-600 flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" /> Compte actuellement actif&nbsp;:
            <code className="ml-1">{settingsQuery.data._meta.service_account_email}</code>
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button onClick={handleTest} disabled={testing} className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50">
            {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Tester les identifiants
          </button>
        </div>
        {testResult && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {['ga4', 'gsc'].map((k) => {
              const r = testResult[k];
              if (!r) return null;
              return (
                <div key={k} className={`rounded-lg border p-3 ${r.ok ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-red-500/40 bg-red-500/5'}`}>
                  <div className="flex items-center gap-2 font-semibold">
                    {r.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-red-600" />}
                    {k === 'ga4' ? 'Google Analytics 4' : 'Search Console'}
                  </div>
                  <div className="mt-1 text-muted-foreground">{r.ok ? 'Connexion OK' : r.error}</div>
                </div>
              );
            })}
            {testResult.error && <div className="md:col-span-2 text-xs text-red-600">{testResult.error}</div>}
          </div>
        )}
      </div>

      {/* 6. Reports */}
      <div className={SECTION}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Rapports en direct (28 derniers jours)</h3>
          </div>
          <button onClick={handleLoadReports} disabled={loadingReports} className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50">
            {loadingReports ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Charger
          </button>
        </div>

        {ga4Report && (
          <div>
            <h4 className="text-xs font-semibold text-foreground mb-2">Top pages (GA4)</h4>
            {ga4Report.error ? (
              <div className="text-xs text-red-600">{ga4Report.error}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground border-b border-border">
                    <tr><th className="text-left py-1.5">Page</th><th className="text-right">Utilisateurs</th><th className="text-right">Vues</th><th className="text-right">Sessions</th></tr>
                  </thead>
                  <tbody>
                    {(ga4Report.rows || []).slice(0, 10).map((row: any, i: number) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-1.5 truncate max-w-xs">{row.dimensionValues?.[0]?.value || '—'}</td>
                        <td className="text-right">{row.metricValues?.[0]?.value || 0}</td>
                        <td className="text-right">{row.metricValues?.[1]?.value || 0}</td>
                        <td className="text-right">{row.metricValues?.[2]?.value || 0}</td>
                      </tr>
                    ))}
                    {!(ga4Report.rows || []).length && (
                      <tr><td colSpan={4} className="text-center py-4 text-muted-foreground">Aucune donnée.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {gscReport && (
          <div>
            <h4 className="text-xs font-semibold text-foreground mb-2">Top requêtes (Search Console)</h4>
            {gscReport.error ? (
              <div className="text-xs text-red-600">{gscReport.error}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground border-b border-border">
                    <tr><th className="text-left py-1.5">Requête</th><th className="text-right">Clics</th><th className="text-right">Impressions</th><th className="text-right">CTR</th><th className="text-right">Position</th></tr>
                  </thead>
                  <tbody>
                    {(gscReport.rows || []).slice(0, 15).map((row: any, i: number) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-1.5 truncate max-w-xs">{row.keys?.[0] || '—'}</td>
                        <td className="text-right">{row.clicks || 0}</td>
                        <td className="text-right">{row.impressions || 0}</td>
                        <td className="text-right">{((row.ctr || 0) * 100).toFixed(1)}%</td>
                        <td className="text-right">{(row.position || 0).toFixed(1)}</td>
                      </tr>
                    ))}
                    {!(gscReport.rows || []).length && (
                      <tr><td colSpan={5} className="text-center py-4 text-muted-foreground">Aucune donnée.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 7. Robots extra */}
      <div className={SECTION}>
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Règles robots.txt additionnelles (avancé)</h3>
        </div>
        <textarea className={TEXTAREA} value={draft.robots_extra || ''} onChange={(e) => set('robots_extra', e.target.value)} placeholder="Disallow: /private-section" />
        <RobotsPreview />
        <p className="text-[11px] text-muted-foreground">
          Le robots.txt fusionné est servi dynamiquement sur <code>/api/robots.txt</code>.
          Pour qu'il remplace le fichier statique, ajoutez une réécriture côté hébergeur :
          <code className="ml-1">/robots.txt → {`{API_URL}`}/robots.txt</code>.
        </p>
      </div>
    </div>
  );
};

const RobotsPreview: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    try { setText(await seoSettingsApi.robotsPreview()); }
    catch (e: any) { setText(e?.message || 'Échec du chargement.'); }
    finally { setLoading(false); setOpen(true); }
  };
  return (
    <div className="space-y-2">
      <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50">
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        Aperçu robots.txt fusionné
      </button>
      {open && (
        <pre className="text-[11px] p-3 bg-muted rounded text-foreground overflow-x-auto max-h-80">{text}</pre>
      )}
    </div>
  );
};

export default SeoTab;
