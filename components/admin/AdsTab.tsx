import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Megaphone, Plus, Trash2, Eye, MousePointerClick, Pencil, MonitorSmartphone, Target, Gauge, BarChart3, ArrowLeft, ChevronDown, X, Check, Search } from 'lucide-react';
import {
  useAdminAdCampaigns,
  useAdminAdCampaignAnalytics,
  useCreateAdCampaign,
  useUpdateAdCampaign,
  useDeleteAdCampaign,
} from '../../hooks/useAdmin';
import { useToast } from '../../context/ToastContext';
import { AdminTable } from './AdminPrimitives';
import { useConfirm } from './ConfirmDialog';
import type { AdminAdCampaign } from '../../services/adminApi';
import { governoratesList } from '../../constants/reference';
import { FullscreenAdPreview, type FullscreenAdPreviewData } from './FullscreenAdPreview';

/** Parse a stored target_location string ("Tunis,Sfax") into an array. */
function parseTargets(v?: string | null): string[] {
  if (!v) return [];
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

// Must stay in sync with backend `ad_zone` enum
// (migrations 001 + 008 — `popup` was added so admins can create popup
// campaigns served by the global <PopupAd /> mounted in App.tsx).
const ZONES = [
  'home_banner', 'news_top', 'search_feed', 'search_sidebar',
  'listing_sidebar', 'garage_sidebar', 'popup', 'fullscreen',
];

const MEDIA_TYPES = ['image', 'video'];

const ZONE_META: Record<string, { label: string; position: string; device: string; audience: string; viewability: number; cpm: number }> = {
  home_banner: { label: 'Banner homepage', position: 'Accueil · haut de page', device: 'Mobile + desktop', audience: 'Visiteurs principaux', viewability: 78, cpm: 5 },
  news_top: { label: 'Banner actualités', position: 'Articles · haut de page', device: 'Mobile + desktop', audience: 'Lecteurs contenu', viewability: 72, cpm: 4 },
  search_feed: { label: 'Feed recherche', position: 'Résultats · dans la liste', device: 'Mobile + desktop', audience: 'Acheteurs en recherche', viewability: 84, cpm: 6 },
  search_sidebar: { label: 'Sidebar recherche', position: 'Résultats · colonne latérale', device: 'Desktop prioritaire', audience: 'Acheteurs comparant', viewability: 68, cpm: 4 },
  listing_sidebar: { label: 'Sidebar annonce', position: 'Fiche annonce · côté vendeur', device: 'Mobile + desktop', audience: 'Acheteurs intention forte', viewability: 82, cpm: 7 },
  garage_sidebar: { label: 'Sidebar garage', position: 'Fiche garage · colonne latérale', device: 'Mobile + desktop', audience: 'Recherche service/pro', viewability: 70, cpm: 4 },
  popup: { label: 'Popup', position: 'Overlay session', device: 'Mobile + desktop', audience: 'Audience large', viewability: 92, cpm: 8 },
  fullscreen: { label: 'Fullscreen', position: 'Overlay quasi plein écran (mobile + desktop)', device: 'Mobile + desktop', audience: 'Impact maximum', viewability: 96, cpm: 12 },
};

function pct(num: number, den: number) {
  return den > 0 ? `${((num / den) * 100).toFixed(1)}%` : '0.0%';
}

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n || 0));
}

const emptyForm: Partial<AdminAdCampaign> = {
  title: '', client: '', zone: 'home_banner',
  description: '',
  media_type: 'image',
  media_url: '', link_url: '', cta_text: 'Voir',
  target_location: '',
  start_date: new Date().toISOString().slice(0, 10),
  end_date: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10),
  is_active: true,
};

/**
 * Normalize the form payload before sending it. Empty strings get converted
 * to NULL so the DB doesn't store "" for optional URLs / descriptions, and
 * date inputs are kept as YYYY-MM-DD which Postgres accepts as DATE.
 */
function sanitize(form: Partial<AdminAdCampaign>): Partial<AdminAdCampaign> {
  const out: Record<string, any> = { ...form };
  for (const k of ['description', 'media_url', 'link_url', 'cta_text', 'target_location']) {
    if (out[k] === '') out[k] = null;
  }
  return out;
}

export const AdsTab: React.FC = () => {
  const { data: ads = [], isLoading } = useAdminAdCampaigns();
  const create = useCreateAdCampaign();
  const update = useUpdateAdCampaign();
  const remove = useDeleteAdCampaign();
  const { addToast } = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<AdminAdCampaign>>(emptyForm);
  // When editing, `editingId` holds the ad id and the same `form` object is
  // reused so we don't duplicate every input. Clearing `editingId` switches
  // back to "create" mode.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const { data: detail, isLoading: detailLoading } = useAdminAdCampaignAnalytics(detailId, 30);
  const [previewAd, setPreviewAd] = useState<FullscreenAdPreviewData | null>(null);

  const adToPreview = (a: Partial<AdminAdCampaign>): FullscreenAdPreviewData => ({
    title: a.title || '',
    description: a.description || '',
    mediaUrl: a.media_url || '',
    ctaText: a.cta_text || '',
    linkUrl: a.link_url || '',
  });

  const startCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const startEdit = (ad: AdminAdCampaign) => {
    setForm({
      ...ad,
      // Normalize ISO timestamps to YYYY-MM-DD so <input type="date"> can render them.
      start_date: ad.start_date ? String(ad.start_date).slice(0, 10) : '',
      end_date: ad.end_date ? String(ad.end_date).slice(0, 10) : '',
    });
    setEditingId(ad.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = sanitize(form);
      if (editingId) {
        await update.mutateAsync({ id: editingId, payload });
        addToast('Campagne mise à jour', 'success');
      } else {
        await create.mutateAsync(payload);
        addToast('Campagne créée', 'success');
      }
      closeForm();
    } catch (err: any) { addToast(err?.message || 'Erreur', 'error'); }
  };

  const toggleActive = async (ad: AdminAdCampaign) => {
    // Guard against double-clicks while a mutation is in flight — without
    // this the same ad could fire two PATCH /ad-campaigns/:id requests in
    // a row and end up in a state inconsistent with what the admin saw.
    if (update.isPending) return;
    try {
      await update.mutateAsync({ id: ad.id, payload: { is_active: !ad.is_active } });
      addToast(ad.is_active ? 'Campagne désactivée' : 'Campagne activée', 'success');
    } catch (e: any) { addToast(e?.message || 'Erreur', 'error'); }
  };

  const del = async (id: string) => {
    const ok = await confirm({
      title: 'Supprimer cette campagne ?',
      message: 'Les statistiques (vues, clics) seront également perdues.',
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!ok) return;
    try { await remove.mutateAsync(id); addToast('Supprimée', 'success'); }
    catch (e: any) { addToast(e?.message || 'Erreur', 'error'); }
  };

  const submitting = create.isPending || update.isPending;
  const adStats = useMemo(() => {
    return [...ads].sort((a, b) => Number(b.views || 0) - Number(a.views || 0));
  }, [ads]);

  if (detailId) {
    const campaign = detail?.campaign || ads.find((ad) => ad.id === detailId);
    const maxDaily = Math.max(...(detail?.daily || []).map((d) => Math.max(d.impressions, d.clicks)), 1);
    const hasDetailAnalytics = !!detail && (
      Number(detail.totals.impressions || 0) > 0 ||
      Number(detail.totals.clicks || 0) > 0 ||
      detail.daily.some((day) => Number(day.impressions || 0) > 0 || Number(day.clicks || 0) > 0)
    );
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <button onClick={() => setDetailId(null)} className="inline-flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-gray-900 mb-2">
              <ArrowLeft size={16} /> Retour aux publicités
            </button>
            <h2 className="text-2xl font-black text-gray-900">Analytics publicité</h2>
            <p className="text-sm text-gray-500">{campaign?.title || 'Campagne'} · {campaign?.client || ''}</p>
          </div>
          {campaign && <span className="px-3 py-1.5 rounded-full bg-primary-50 text-primary-700 text-xs font-bold">{campaign.zone}</span>}
        </div>

        {detailLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => <div key={i} className="bg-card border border-gray-100 rounded-2xl p-5 shadow-sm animate-pulse"><div className="h-3 w-24 bg-gray-100 rounded" /><div className="h-9 w-20 bg-gray-100 rounded mt-3" /></div>)}
            </div>
            <div className="bg-card border border-gray-100 rounded-2xl p-5 shadow-sm animate-pulse space-y-3">
              <div className="h-5 w-48 bg-gray-100 rounded" />
              {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-4 bg-gray-100 rounded" />)}
            </div>
          </div>
        ) : detail && hasDetailAnalytics ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-card border border-gray-100 rounded-2xl p-5 shadow-sm"><div className="text-xs font-bold text-gray-500 uppercase">Impressions</div><div className="text-3xl font-black text-gray-900 tabular-nums mt-1">{fmt(detail.totals.impressions)}</div></div>
              <div className="bg-card border border-gray-100 rounded-2xl p-5 shadow-sm"><div className="text-xs font-bold text-gray-500 uppercase">Clics</div><div className="text-3xl font-black text-gray-900 tabular-nums mt-1">{fmt(detail.totals.clicks)}</div></div>
              <div className="bg-card border border-gray-100 rounded-2xl p-5 shadow-sm"><div className="text-xs font-bold text-gray-500 uppercase">CTR</div><div className="text-3xl font-black text-gray-900 tabular-nums mt-1">{detail.totals.ctr.toFixed(1)}%</div></div>
            </div>

            <section className="bg-card border border-gray-100 rounded-2xl p-5 shadow-sm">
              <h3 className="text-lg font-black text-gray-900 mb-4">Performance journalière</h3>
              <div className="space-y-3">
                {detail.daily.map((day) => (
                  <div key={day.day} className="grid grid-cols-12 items-center gap-3 text-sm">
                    <div className="col-span-3 sm:col-span-2 font-bold text-gray-700">{new Date(day.day).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</div>
                    <div className="col-span-6 sm:col-span-7 h-3 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full bg-primary-600" style={{ width: `${Math.max((day.impressions / maxDaily) * 100, day.impressions ? 4 : 0)}%` }} />
                    </div>
                    <div className="col-span-3 text-right text-gray-600 tabular-nums">{fmt(day.impressions)} vues · {fmt(day.clicks)} clics · {day.ctr.toFixed(1)}%</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-card border border-gray-100 rounded-2xl p-5 shadow-sm">
              <h3 className="text-lg font-black text-gray-900 mb-4">Top landing pages</h3>
              <div className="divide-y divide-gray-100">
                {detail.top_landing_pages.map((page) => (
                  <div key={page.landing_page} className="py-3 flex items-center justify-between gap-4">
                    <span className="text-sm font-medium text-gray-700 truncate">{page.landing_page}</span>
                    <span className="text-sm font-black text-gray-900 tabular-nums">{fmt(page.clicks)} clics</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : (
          <div className="bg-card border border-gray-100 rounded-2xl p-8 text-center shadow-sm">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
              <BarChart3 size={22} />
            </div>
            <h3 className="text-lg font-black text-gray-900">Aucune donnée analytics pour le moment</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">Les impressions, clics, CTR et landing pages apparaîtront dès que cette publicité sera affichée ou cliquée.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-gray-900">Campagnes publicitaires</h2>
        <button
          onClick={() => (showForm ? closeForm() : startCreate())}
          className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-bold"
        >
          <Plus size={16} /> Nouvelle campagne
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-card p-6 rounded-2xl border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 text-sm font-bold text-gray-900">
            {editingId ? 'Modifier la campagne' : 'Nouvelle campagne'}
          </div>
          <input required placeholder="Titre"   value={form.title || ''}   onChange={(e) => setForm({ ...form, title: e.target.value })}   className="px-4 py-2 border rounded-lg" />
          <input required placeholder="Client"  value={form.client || ''}  onChange={(e) => setForm({ ...form, client: e.target.value })}  className="px-4 py-2 border rounded-lg" />
          <select value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} className="px-4 py-2 border rounded-lg">
            {ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
          <select value={form.media_type || 'image'} onChange={(e) => setForm({ ...form, media_type: e.target.value })} className="px-4 py-2 border rounded-lg">
            {MEDIA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input placeholder="CTA"        value={form.cta_text || ''}  onChange={(e) => setForm({ ...form, cta_text: e.target.value })}  className="px-4 py-2 border rounded-lg" />
          <div className="md:col-span-2">
            <GovernorateMultiSelect
              value={parseTargets(form.target_location)}
              onChange={(next) => setForm({ ...form, target_location: next.join(',') })}
            />
          </div>
          <input placeholder="Image / Video URL"  value={form.media_url || ''} onChange={(e) => setForm({ ...form, media_url: e.target.value })} className="px-4 py-2 border rounded-lg md:col-span-2" />
          <input placeholder="Lien URL"   value={form.link_url || ''}  onChange={(e) => setForm({ ...form, link_url: e.target.value })}  className="px-4 py-2 border rounded-lg md:col-span-2" />
          <textarea placeholder="Description (optionnelle)" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="px-4 py-2 border rounded-lg md:col-span-2 resize-none" />
          <input type="date" required value={form.start_date || ''} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="px-4 py-2 border rounded-lg" />
          <input type="date" required value={form.end_date || ''}   onChange={(e) => setForm({ ...form, end_date: e.target.value })}   className="px-4 py-2 border rounded-lg" />
          <label className="md:col-span-2 inline-flex items-center gap-2 text-sm font-medium text-gray-700">
            <input type="checkbox" checked={!!form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            Campagne active
          </label>
          <div className="md:col-span-2 flex justify-end gap-2">
            {form.zone === 'fullscreen' && (
              <button
                type="button"
                onClick={() => setPreviewAd(adToPreview(form))}
                className="px-4 py-2 rounded-lg border border-primary-600 text-primary-700 hover:bg-primary-50 text-sm font-bold inline-flex items-center gap-2"
              >
                <MonitorSmartphone size={16} /> Aperçu mobile / desktop
              </button>
            )}
            <button type="button" onClick={closeForm} className="px-4 py-2 rounded-lg border text-sm font-bold">Annuler</button>
            <button disabled={submitting} className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold disabled:opacity-60">
              {submitting ? 'Enregistrement…' : (editingId ? 'Enregistrer' : 'Créer')}
            </button>
          </div>
        </form>
      )}

      <AdminTable
        columns={['Campagne', 'Zone', 'Période', 'Stats', 'Statut', 'Actions']}
        loading={isLoading} rowCount={ads.length} empty="Aucune campagne."
      >
        {ads.map((a) => (
          <tr key={a.id} className="hover:bg-gray-50">
            <td className="p-4">
              <div className="flex items-center gap-2">
                <Megaphone size={16} className="text-primary-600" />
                <div>
                  <p className="font-bold text-gray-900">{a.title}</p>
                  <p className="text-xs text-gray-500">{a.client}</p>
                </div>
              </div>
            </td>
            <td className="p-4 text-xs font-mono text-gray-700">{a.zone}</td>
            <td className="p-4 text-xs text-gray-500 whitespace-nowrap">
              {new Date(a.start_date).toLocaleDateString('fr-FR')} → {new Date(a.end_date).toLocaleDateString('fr-FR')}
            </td>
            <td className="p-4 text-xs text-gray-700">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1"><Eye size={12} />{a.views}</span>
                <span className="inline-flex items-center gap-1"><MousePointerClick size={12} />{a.clicks}</span>
              </div>
            </td>
            <td className="p-4">
              <button
                onClick={() => toggleActive(a)}
                disabled={update.isPending}
                className={`px-2.5 py-1 rounded-full text-xs font-bold disabled:opacity-60 ${a.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}
              >
                {a.is_active ? 'Actif' : 'Inactif'}
              </button>
            </td>
            <td className="p-4 text-right">
              <div className="inline-flex items-center gap-1">
                {a.zone === 'fullscreen' && (
                  <button
                    onClick={() => setPreviewAd(adToPreview(a))}
                    className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg"
                    title="Aperçu mobile / desktop"
                  >
                    <MonitorSmartphone size={16} />
                  </button>
                )}
                <button onClick={() => startEdit(a)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Modifier">
                  <Pencil size={16} />
                </button>
                <button onClick={() => setDetailId(a.id)} className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg" title="Analytics détaillées">
                  <BarChart3 size={16} />
                </button>
                <button onClick={() => del(a.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Supprimer">
                  <Trash2 size={16} />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>

      <section className="space-y-4">
        <div>
          <h3 className="text-xl font-black text-gray-900">Analytics par publicité</h3>
          <p className="text-sm text-gray-500 mt-0.5">Chaque campagne affiche ses propres impressions, clics, CTR, visibilité, position, device et audience.</p>
        </div>
        {adStats.length ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {adStats.map((ad) => {
              const meta = ZONE_META[ad.zone] || { label: ad.zone, position: ad.zone, device: 'Mobile + desktop', audience: 'Audience moto-scoot.tn', viewability: 70, cpm: 4 };
              const impressions = Number(ad.views || 0);
              const clicks = Number(ad.clicks || 0);
              const hasImpressions = impressions > 0;
              const hasClicks = clicks > 0;
              const hasAnalytics = hasImpressions || hasClicks;
              return (
                <div key={ad.id} className="bg-card border border-gray-100 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="text-xs font-black uppercase tracking-widest text-primary-600">Publicité</div>
                      <h4 className="text-lg font-black text-gray-900 mt-0.5">{ad.title}</h4>
                      <p className="text-xs text-gray-500">{ad.client} · {meta.label}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${ad.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                      {ad.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </div>

                  <button
                    onClick={() => setDetailId(ad.id)}
                    className="mb-4 inline-flex items-center gap-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white px-3 py-2 text-xs font-bold"
                  >
                    <BarChart3 size={14} /> Voir détail analytics
                  </button>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="rounded-xl bg-gray-50 p-3">
                      <div className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-500 uppercase"><Eye size={12} /> Impressions</div>
                      <div className="text-2xl font-black text-gray-900 tabular-nums mt-1">{hasImpressions ? fmt(impressions) : '—'}</div>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-3">
                      <div className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-500 uppercase"><MousePointerClick size={12} /> CTR</div>
                      <div className="text-2xl font-black text-gray-900 tabular-nums mt-1">{hasImpressions ? pct(clicks, impressions) : '—'}</div>
                    </div>
                  </div>

                  {!hasAnalytics && (
                    <div className="mb-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-3 text-sm font-medium text-gray-500">
                      Analytics en attente : les données apparaîtront après les premières impressions ou clics.
                    </div>
                  )}
                  {hasClicks && !hasImpressions && (
                    <div className="mb-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-3 text-sm font-medium text-gray-500">
                      Impressions en attente : les clics sont disponibles, le CTR sera calculé dès qu’une impression est enregistrée.
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-700"><MousePointerClick size={15} className="text-primary-600" /> Clics : <strong>{hasClicks ? fmt(clicks) : '—'}</strong></div>
                    <div className="flex items-center gap-2 text-gray-700"><Megaphone size={15} className="text-primary-600" /> Période : <strong>{new Date(ad.start_date).toLocaleDateString('fr-FR')}</strong></div>
                    <div className="flex items-center gap-2 text-gray-700"><Gauge size={15} className="text-primary-600" /> Visibilité estimée : <strong>{meta.viewability}%</strong></div>
                    <div className="flex items-center gap-2 text-gray-700"><MonitorSmartphone size={15} className="text-primary-600" /> Device : <strong>{meta.device}</strong></div>
                    <div className="flex items-center gap-2 text-gray-700"><Target size={15} className="text-primary-600" /> Audience : <strong>{meta.audience}</strong></div>
                    <div className="flex items-center gap-2 text-gray-700"><Megaphone size={15} className="text-primary-600" /> CPM moyen : <strong>{meta.cpm}€</strong></div>
                    <div className="sm:col-span-2 text-xs text-gray-500 pt-1">Position : {meta.position}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-card border border-gray-100 rounded-2xl p-5 text-sm text-gray-500">Créez une campagne pour afficher les analytics par publicité.</div>
        )}
      </section>
      {confirmDialog}
      {previewAd && <FullscreenAdPreview ad={previewAd} onClose={() => setPreviewAd(null)} />}
    </div>
  );
};

/* ---------- Governorate multi-select dropdown ---------- */

interface GovernorateMultiSelectProps {
  value: string[];
  onChange: (next: string[]) => void;
}

const GovernorateMultiSelect: React.FC<GovernorateMultiSelectProps> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 640px)').matches : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 640px)');
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  // Close on outside (mouse + touch) and Escape
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc, { passive: true });
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  // Lock body scroll on mobile sheet
  useEffect(() => {
    if (!open || !isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open, isMobile]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [...governoratesList];
    return governoratesList.filter((g) => g.toLowerCase().includes(q));
  }, [search]);

  const toggle = (g: string) => {
    if (value.includes(g)) onChange(value.filter((x) => x !== g));
    else onChange([...value, g]);
  };

  const allSelected = value.length === governoratesList.length;
  const summary = value.length === 0
    ? 'Toutes les régions'
    : allSelected
      ? `Tous les gouvernorats (${value.length})`
      : `${value.length} gouvernorat${value.length > 1 ? 's' : ''} sélectionné${value.length > 1 ? 's' : ''}`;

  const list = (
    <ul className={`overflow-y-auto py-1 ${isMobile ? 'max-h-[55vh]' : 'max-h-72'}`}>
      {filtered.length === 0 ? (
        <li className="px-3 py-4 text-sm text-gray-500 text-center">Aucun résultat</li>
      ) : filtered.map((g) => {
        const checked = value.includes(g);
        return (
          <li key={g}>
            <button
              type="button"
              onClick={() => toggle(g)}
              className={`w-full flex items-center gap-3 px-4 py-3 sm:py-2.5 text-[15px] sm:text-sm text-left active:bg-primary-100 hover:bg-gray-50 transition-colors min-h-[48px] sm:min-h-0 ${
                checked ? 'bg-primary-50/70 text-primary-800 font-semibold' : 'text-gray-800'
              }`}
            >
              <span className={`h-5 w-5 sm:h-4 sm:w-4 rounded border flex items-center justify-center shrink-0 ${
                checked ? 'bg-primary-600 border-primary-600 text-white' : 'border-gray-300 bg-card'
              }`}>
                {checked && <Check size={14} />}
              </span>
              <span className="truncate flex-1">{g}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  const searchBar = (
    <div className="p-2 border-b bg-gray-50 flex items-center gap-2">
      <Search size={16} className="text-gray-400 shrink-0" />
      <input
        autoFocus={!isMobile}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher un gouvernorat…"
        className="flex-1 bg-transparent text-sm outline-none min-w-0"
      />
      <button
        type="button"
        onClick={() => onChange(allSelected ? [] : [...governoratesList])}
        className="text-[11px] font-bold text-primary-600 hover:underline whitespace-nowrap px-2 py-1"
      >
        {allSelected ? 'Désélectionner' : 'Tout cocher'}
      </button>
    </div>
  );

  return (
    <div className="border rounded-lg p-3 bg-gray-50">
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">
          Ciblage géographique (gouvernorats)
        </label>
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-[11px] text-red-600 font-bold hover:underline px-2 py-1"
          >
            Tout effacer
          </button>
        )}
      </div>
      <p className="text-[11px] text-gray-500 mb-2">
        Aucune sélection = toutes les régions. Sinon l'annonce sera affichée uniquement aux utilisateurs des gouvernorats cochés.
      </p>

      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="w-full flex items-center justify-between gap-2 px-3 py-3 sm:py-2 bg-card border rounded-lg text-sm font-medium text-gray-800 hover:border-primary-400 transition-colors min-h-[44px]"
        >
          <span className="flex items-center gap-2 min-w-0">
            <Target size={14} className="text-primary-600 shrink-0" />
            <span className="truncate">{summary}</span>
          </span>
          <ChevronDown size={16} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {/* Desktop popover */}
        {open && !isMobile && (
          <div className="absolute z-[1000] left-0 right-0 mt-1 bg-card border border-gray-200 rounded-lg shadow-lg overflow-hidden animate-scale-in origin-top">
            {searchBar}
            {list}
          </div>
        )}

        {/* Mobile bottom sheet */}
        {open && isMobile && (
          <>
            <div
              className="fixed inset-0 z-[1000] bg-black/40 animate-fade-in"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <div
              className="fixed left-0 right-0 bottom-0 z-[1001] bg-card rounded-t-2xl shadow-2xl border-t border-gray-200 max-h-[85vh] flex flex-col animate-fade-in-up"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-gray-900">Gouvernorats</h3>
                  <p className="text-[11px] text-gray-500 truncate">{summary}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-9 w-9 -mr-2 inline-flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200"
                  aria-label="Fermer"
                >
                  <X size={20} />
                </button>
              </div>
              {searchBar}
              <div className="flex-1 overflow-y-auto">
                {list}
              </div>
              <div className="p-3 border-t bg-gray-50 flex items-center gap-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="flex-1 px-4 py-3 rounded-lg border border-gray-300 bg-card text-sm font-bold text-gray-700 active:bg-gray-100"
                >
                  Effacer
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 px-4 py-3 rounded-lg bg-primary-600 text-white text-sm font-bold active:bg-primary-700"
                >
                  Valider ({value.length})
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {value.map((g) => (
            <span
              key={g}
              className="inline-flex items-center gap-1 bg-primary-50 text-primary-700 border border-primary-200 pl-2 pr-1 py-1 rounded-md text-xs font-semibold"
            >
              {g}
              <button
                type="button"
                onClick={() => toggle(g)}
                className="hover:text-primary-900 h-5 w-5 inline-flex items-center justify-center rounded-full hover:bg-primary-100"
                aria-label={`Retirer ${g}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdsTab;
