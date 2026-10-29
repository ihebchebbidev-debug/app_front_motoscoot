/**
 * AppearanceTab — admin landing-page customisation.
 *
 * Currently exposes the two hero background images (desktop + mobile) that
 * appear above the search bar on the homepage. Each slot:
 *   - shows a live preview of the current image (custom or default),
 *   - lets the admin upload a replacement (uses /api/admin/upload),
 *   - lets the admin reset to the bundled default via the X button.
 *
 * Saving sends both URLs in one PUT to /api/admin/site-settings/hero. The
 * frontend cache is then invalidated so every visitor sees the new hero
 * within seconds.
 */
import SocialLinksSection from './SocialLinksSection';
import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, X, Save, Monitor, Smartphone, Image as ImageIcon, RotateCcw, Palette, Type } from 'lucide-react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { uploadsApi } from '../../services/uploadsApi';
import { siteSettingsApi, HERO_DEFAULTS, HERO_TEXTS_DEFAULTS, APP_BG_DEFAULT } from '../../services/siteSettingsApi';
import { HERO_QUERY_KEY, useHeroImages } from '../../hooks/useHeroImages';
import { HERO_TEXTS_QUERY_KEY, useHeroTexts } from '../../hooks/useHeroTexts';
import { APP_BG_QUERY_KEY, applyAppBackground, previewAppBackground } from '../../hooks/useAppBackground';
import { useToast } from '../../context/ToastContext';

type Slot = 'desktop' | 'mobile';

const MAX_BYTES = 25 * 1024 * 1024; // backend hard cap

const AppearanceTab: React.FC = () => {
  const { addToast } = useToast();
  const qc = useQueryClient();
  const { desktopUrl, mobileUrl, isCustomDesktop, isCustomMobile, raw } = useHeroImages();
  const { raw: textsRaw } = useHeroTexts();

  // Local draft — only persisted to the server when admin clicks Save.
  // null  = no custom image (use default)
  // string = custom URL (relative `/uploads/...` from the upload endpoint, or absolute)
  const [draftDesktop, setDraftDesktop] = useState<string | null>(null);
  const [draftMobile,  setDraftMobile]  = useState<string | null>(null);
  const [draftBgColor, setDraftBgColor] = useState<string>(HERO_DEFAULTS.background_color);
  const [draftTitle, setDraftTitle]       = useState<string>(HERO_TEXTS_DEFAULTS.title);
  const [draftSubtitle, setDraftSubtitle] = useState<string>(HERO_TEXTS_DEFAULTS.subtitle);
  const [draftBadge, setDraftBadge]       = useState<string>(HERO_TEXTS_DEFAULTS.badge_suffix);
  const [busy, setBusy] = useState<Slot | null>(null);
  const [saving, setSaving] = useState(false);

  // Sync the draft with the server response on first load / after invalidation.
  useEffect(() => {
    setDraftDesktop(raw?.desktop_url ?? null);
    setDraftMobile(raw?.mobile_url ?? null);
    setDraftBgColor(raw?.background_color || HERO_DEFAULTS.background_color);
  }, [raw?.desktop_url, raw?.mobile_url, raw?.background_color]);

  useEffect(() => {
    setDraftTitle((textsRaw?.title && textsRaw.title.trim()) || HERO_TEXTS_DEFAULTS.title);
    setDraftSubtitle((textsRaw?.subtitle && textsRaw.subtitle.trim()) || HERO_TEXTS_DEFAULTS.subtitle);
    setDraftBadge((textsRaw?.badge_suffix && textsRaw.badge_suffix.trim()) || HERO_TEXTS_DEFAULTS.badge_suffix);
  }, [textsRaw?.title, textsRaw?.subtitle, textsRaw?.badge_suffix]);

  const desktopInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef  = useRef<HTMLInputElement>(null);

  const onPick = async (slot: Slot, file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      addToast('Veuillez choisir un fichier image.', 'error');
      return;
    }
    if (file.size > MAX_BYTES) {
      addToast('Image trop volumineuse (max 25 Mo).', 'error');
      return;
    }
    setBusy(slot);
    try {
      const res = await uploadsApi.single(file);
      if (slot === 'desktop') setDraftDesktop(res.url);
      else setDraftMobile(res.url);
      addToast('Image téléversée — n\'oubliez pas d\'enregistrer.', 'success');
    } catch (e: any) {
      addToast(e?.message || 'Échec du téléversement.', 'error');
    } finally {
      setBusy(null);
      if (slot === 'desktop' && desktopInputRef.current) desktopInputRef.current.value = '';
      if (slot === 'mobile'  && mobileInputRef.current)  mobileInputRef.current.value  = '';
    }
  };

  const currentTitle    = (textsRaw?.title       && textsRaw.title.trim())       || HERO_TEXTS_DEFAULTS.title;
  const currentSubtitle = (textsRaw?.subtitle    && textsRaw.subtitle.trim())    || HERO_TEXTS_DEFAULTS.subtitle;
  const currentBadge    = (textsRaw?.badge_suffix && textsRaw.badge_suffix.trim()) || HERO_TEXTS_DEFAULTS.badge_suffix;

  const dirty =
    (draftDesktop ?? null) !== (raw?.desktop_url ?? null) ||
    (draftMobile  ?? null) !== (raw?.mobile_url  ?? null) ||
    draftBgColor !== (raw?.background_color || HERO_DEFAULTS.background_color) ||
    draftTitle.trim()    !== currentTitle ||
    draftSubtitle.trim() !== currentSubtitle ||
    draftBadge.trim()    !== currentBadge;

  const onSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        siteSettingsApi.updateHero({
          desktop_url: draftDesktop,
          mobile_url:  draftMobile,
          background_color: draftBgColor,
        }),
        siteSettingsApi.updateHeroTexts({
          title:        draftTitle.trim()    || null,
          subtitle:     draftSubtitle.trim() || null,
          badge_suffix: draftBadge.trim()    || null,
        }),
      ]);
      await Promise.all([
        qc.invalidateQueries({ queryKey: HERO_QUERY_KEY }),
        qc.invalidateQueries({ queryKey: HERO_TEXTS_QUERY_KEY }),
      ]);
      addToast('Hero mis à jour avec succès.', 'success');
    } catch (e: any) {
      addToast(e?.message || 'Échec de l\'enregistrement.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const onResetAll = () => {
    setDraftDesktop(null);
    setDraftMobile(null);
    setDraftBgColor(HERO_DEFAULTS.background_color);
    setDraftTitle(HERO_TEXTS_DEFAULTS.title);
    setDraftSubtitle(HERO_TEXTS_DEFAULTS.subtitle);
    setDraftBadge(HERO_TEXTS_DEFAULTS.badge_suffix);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Global app background — controls the "gray" surface used across the
          whole app (search results, dashboards, listing pages…). Live preview
          + presets palette so the admin can dial in the exact tint. */}
      <AppBackgroundSection />
      <SocialLinksSection />

      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
            <ImageIcon size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Image du hero (page d'accueil)</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Téléversez une image pour la version <strong>ordinateur</strong> et une autre pour la version <strong>mobile</strong>.
              Cliquez sur le ✕ pour revenir à l'image par défaut. Format recommandé : JPG ou WebP, max 25 Mo.
            </p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <SlotCard
          slot="desktop"
          icon={<Monitor size={16} />}
          title="Version ordinateur"
          subtitle="Affichée sur tablette et desktop (≥ 768 px)"
          aspect="aspect-[16/7]"
          previewUrl={draftDesktop || HERO_DEFAULTS.desktop_url}
          isCustom={!!draftDesktop}
          inputRef={desktopInputRef}
          busy={busy === 'desktop'}
          backgroundColor={draftBgColor}
          onPick={(f) => onPick('desktop', f)}
          onClear={() => setDraftDesktop(null)}
        />
        <SlotCard
          slot="mobile"
          icon={<Smartphone size={16} />}
          title="Version mobile"
          subtitle="Affichée sur smartphones (< 768 px)"
          aspect="aspect-[9/16] max-h-[420px] mx-auto"
          previewUrl={draftMobile || HERO_DEFAULTS.mobile_url}
          isCustom={!!draftMobile}
          inputRef={mobileInputRef}
          busy={busy === 'mobile'}
          backgroundColor={draftBgColor}
          onPick={(f) => onPick('mobile', f)}
          onClear={() => setDraftMobile(null)}
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-700 min-w-0">
            <Palette size={16} />
            <div className="min-w-0">
              <div className="text-sm font-black text-slate-900">Couleur du background</div>
              <div className="text-[11px] text-slate-500">Appliquée derrière le hero et dans l’aperçu.</div>
            </div>
      </div>

      {/* Editable hero copy (title / subtitle / badge suffix) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
            <Type size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Textes du hero</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Modifiez le titre, le sous-titre et le libellé qui suit le compteur d’annonces. Les changements sont visibles
              en quelques secondes après l’enregistrement.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-black uppercase tracking-wide text-slate-600">
              Titre principal
              <span className="ml-1 font-medium normal-case tracking-normal text-slate-400">
                (utilisez Entrée pour forcer un retour à la ligne sur mobile)
              </span>
            </span>
            <textarea
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value.slice(0, 200))}
              rows={3}
              maxLength={200}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-500 resize-y"
              placeholder={HERO_TEXTS_DEFAULTS.title}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-black uppercase tracking-wide text-slate-600">Sous-titre</span>
            <textarea
              value={draftSubtitle}
              onChange={(e) => setDraftSubtitle(e.target.value.slice(0, 400))}
              rows={3}
              maxLength={400}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-500 resize-y"
              placeholder={HERO_TEXTS_DEFAULTS.subtitle}
            />
          </label>

          <label className="flex flex-col gap-1.5 md:col-span-2">
            <span className="text-xs font-black uppercase tracking-wide text-slate-600">
              Badge — texte après le compteur
            </span>
            <input
              type="text"
              value={draftBadge}
              onChange={(e) => setDraftBadge(e.target.value.slice(0, 80))}
              maxLength={80}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-500"
              placeholder={HERO_TEXTS_DEFAULTS.badge_suffix}
            />
            <span className="text-[11px] text-slate-500">
              Aperçu : <strong>42 {draftBadge.trim() || HERO_TEXTS_DEFAULTS.badge_suffix}</strong>
            </span>
          </label>
        </div>
      </div>
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="color"
              value={draftBgColor}
              onChange={(e) => setDraftBgColor(e.target.value)}
              className="h-10 w-12 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
              aria-label="Couleur du background hero"
            />
            <input
              type="text"
              value={draftBgColor}
              onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && setDraftBgColor(e.target.value)}
              onBlur={() => !/^#[0-9a-fA-F]{6}$/.test(draftBgColor) && setDraftBgColor(HERO_DEFAULTS.background_color)}
              className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-primary-500"
              aria-label="Code hexadécimal du background hero"
            />
          </div>
        </div>
        <div className="h-12 rounded-xl border border-slate-200" style={{ backgroundColor: draftBgColor }} />
      </div>

      {/* Status / actions footer */}
      <div className="sticky bottom-0 -mx-3 md:mx-0 bg-white border border-slate-200 rounded-none md:rounded-xl px-4 py-3 flex items-center justify-between gap-3 shadow-sm" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
        <div className="text-xs text-slate-500 min-w-0">
          {dirty ? (
            <span className="text-amber-600 font-bold">Modifications non enregistrées</span>
          ) : isCustomDesktop || isCustomMobile ? (
            <span>Hero personnalisé actif.</span>
          ) : (
            <span>Hero par défaut affiché.</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onResetAll}
            disabled={saving || (!dirty && !draftDesktop && !draftMobile)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            <RotateCcw size={13} /> Tout réinitialiser
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-black disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
};

/* ============================================================ */

interface SlotCardProps {
  slot: Slot;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  aspect: string;
  previewUrl: string;
  isCustom: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  busy: boolean;
  backgroundColor: string;
  onPick: (file?: File) => void;
  onClear: () => void;
}

const SlotCard: React.FC<SlotCardProps> = ({
  icon, title, subtitle, aspect, previewUrl, isCustom, inputRef, busy, backgroundColor, onPick, onClear,
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-slate-700">
          {icon}
          <div>
            <div className="text-sm font-black text-slate-900">{title}</div>
            <div className="text-[11px] text-slate-500">{subtitle}</div>
          </div>
        </div>
        <span className={`text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full ${
          isCustom ? 'bg-primary-50 text-primary-700' : 'bg-slate-100 text-slate-500'
        }`}>
          {isCustom ? 'Personnalisé' : 'Par défaut'}
        </span>
      </div>

      {/* Preview */}
      <div className={`relative rounded-xl overflow-hidden bg-slate-100 border border-slate-200 ${aspect}`}>
        {previewUrl ? (
          <img
            src={previewUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            // Force reload when URL changes (cache-buster on /uploads/* paths
            // is unnecessary because each upload returns a unique filename).
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs">
            Aucune image
          </div>
        )}
        {/* Same overlay as the live hero so the preview matches reality */}
        <div className="absolute inset-0 opacity-95 mix-blend-multiply pointer-events-none" style={{ background: `linear-gradient(to bottom, ${backgroundColor}, ${backgroundColor})` }} />
        <div className="absolute inset-0 flex items-center justify-center text-white/90 text-[11px] font-bold uppercase tracking-wider drop-shadow">
          Aperçu hero
        </div>

        {isCustom && (
          <button
            type="button"
            onClick={onClear}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/95 hover:bg-white text-slate-700 hover:text-red-600 flex items-center justify-center shadow"
            aria-label="Réinitialiser à l'image par défaut"
            title="Revenir à l'image par défaut"
          >
            <X size={14} />
          </button>
        )}

        {busy && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white">
            <Loader2 size={22} className="animate-spin" />
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0] || undefined)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="inline-flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-black disabled:opacity-50"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
        {isCustom ? 'Remplacer l\'image' : 'Téléverser une image'}
      </button>
    </div>
  );
};

/* ============================================================ */
/* App background — global "gray" surface picker                 */
/* ============================================================ */

const APP_BG_PRESETS: { name: string; color: string }[] = [
  { name: 'Blanc cassé',     color: '#F8FAFC' },
  { name: 'Gris très clair', color: '#F1F5F9' },
  { name: 'Gris clair',      color: '#E2E8F0' },
  { name: 'Gris doux',       color: '#EEF2F7' },
  { name: 'Pierre',          color: '#F5F5F4' },
  { name: 'Sable',           color: '#FAF7F2' },
  { name: 'Crème',           color: '#FDF8EE' },
  { name: 'Bleu glacier',    color: '#EFF6FF' },
  { name: 'Vert menthe',     color: '#ECFDF5' },
  { name: 'Lavande',         color: '#F5F3FF' },
  { name: 'Rose poudré',     color: '#FFF1F2' },
  { name: 'Pêche',           color: '#FFF7ED' },
];

const AppBackgroundSection: React.FC = () => {
  const { addToast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: APP_BG_QUERY_KEY,
    queryFn: ({ signal }) => siteSettingsApi.getAppBackground(signal),
    staleTime: 30 * 1000,
  });

  const serverColor = data?.color || APP_BG_DEFAULT;
  const [draft, setDraft] = useState<string>(serverColor);
  const [saving, setSaving] = useState(false);

  // Sync local draft when server value loads / changes.
  useEffect(() => { setDraft(serverColor); }, [serverColor]);

  // Live preview: every change to the draft updates the CSS variable so the
  // admin sees the new tint applied to the surrounding chrome immediately.
  useEffect(() => {
    if (/^#[0-9a-fA-F]{6}$/.test(draft)) previewAppBackground(draft);
  }, [draft]);

  // On unmount (admin leaves the tab without saving), revert preview to the
  // committed server value so they don't see a stale tint elsewhere.
  useEffect(() => () => { applyAppBackground(serverColor); }, [serverColor]);

  const dirty = draft.toLowerCase() !== serverColor.toLowerCase();
  const valid = /^#[0-9a-fA-F]{6}$/.test(draft);

  const onSave = async () => {
    if (!valid) {
      addToast('Code couleur invalide (utilisez un hex #RRGGBB).', 'error');
      return;
    }
    setSaving(true);
    try {
      await siteSettingsApi.updateAppBackground({ color: draft });
      await qc.invalidateQueries({ queryKey: APP_BG_QUERY_KEY });
      applyAppBackground(draft);
      addToast('Couleur de fond mise à jour — visible en temps réel.', 'success');
    } catch (e: any) {
      addToast(e?.message || 'Échec de l\'enregistrement.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const onResetDefault = () => setDraft(APP_BG_DEFAULT);
  const onCancel       = () => setDraft(serverColor);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
          <Palette size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-black text-slate-900 tracking-tight">Couleur de fond de l'application</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Cette teinte est appliquée derrière les cartes sur toutes les pages
            (recherche, tableau de bord, fiches…). Choisissez un préréglage ou
            saisissez un code hex personnalisé&nbsp;— la modification est
            visible en temps réel sur tout le site dès l'enregistrement.
          </p>
        </div>
      </div>

      {/* Presets palette */}
      <div>
        <div className="text-xs font-black uppercase tracking-wide text-slate-600 mb-2">
          Palette prédéfinie
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-2">
          {APP_BG_PRESETS.map((p) => {
            const active = draft.toLowerCase() === p.color.toLowerCase();
            return (
              <button
                key={p.color}
                type="button"
                onClick={() => setDraft(p.color)}
                title={`${p.name} — ${p.color}`}
                aria-label={`${p.name} (${p.color})`}
                className={`relative aspect-square rounded-xl border-2 transition-all hover:scale-[1.04] focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  active ? 'border-primary-600 shadow-md' : 'border-slate-200'
                }`}
                style={{ backgroundColor: p.color }}
              >
                {active && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-primary-600" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom picker + hex input + live preview */}
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={valid ? draft : APP_BG_DEFAULT}
            onChange={(e) => setDraft(e.target.value.toUpperCase())}
            className="h-12 w-14 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
            aria-label="Sélecteur de couleur personnalisé"
          />
          <input
            type="text"
            value={draft}
            onChange={(e) => {
              const v = e.target.value;
              if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setDraft(v.toUpperCase());
            }}
            placeholder="#F8FAFC"
            className="w-32 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-primary-500"
            aria-label="Code hexadécimal"
          />
          {!valid && (
            <span className="text-[11px] font-bold text-amber-600">Format attendu : #RRGGBB</span>
          )}
        </div>

        <div
          className="flex-1 h-14 rounded-xl border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-500"
          style={{ backgroundColor: valid ? draft : APP_BG_DEFAULT }}
        >
          Aperçu en temps réel
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
        <div className="text-xs text-slate-500">
          {isLoading ? 'Chargement…' : dirty
            ? <span className="text-amber-600 font-bold">Modifications non enregistrées</span>
            : <span>Couleur actuelle&nbsp;: <code className="font-bold text-slate-700">{serverColor.toUpperCase()}</code></span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onResetDefault}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            <RotateCcw size={13} /> Valeur par défaut
          </button>
          {dirty && (
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Annuler
            </button>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={!dirty || !valid || saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-black disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
};

export default AppearanceTab;
