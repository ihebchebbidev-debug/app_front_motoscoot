/**
 * TechSpecsTab — admin CRUD for "Fiches Techniques" (3-step UX).
 *
 * Step 1 (public): list of brands with logos (TechSpecsBrands)
 * Step 2 (public): list of models for the chosen brand (TechSpecsModels) — ADMIN
 *                  creates these models from this tab.
 * Step 3 (public): full detailed fiche for one model (TechSpecsDetails).
 *
 * The form here mirrors EVERY field the public details page renders so the
 * admin can author a complete sheet — engine, chassis, electronics,
 * dimensions, performance, gallery and the optional emission norm logo.
 *
 * Backed by:
 *   GET    /admin/tech-specs
 *   POST   /admin/tech-specs       (creates a row in tech_specs)
 *   PUT    /admin/tech-specs/:id
 *   DELETE /admin/tech-specs/:id
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Wrench, Plus, Trash2, Edit3, X, FileUp, Eye } from 'lucide-react';
import { adminApi } from '../../services/adminApi';
import { useToast } from '../../context/ToastContext';
import { AdminTable } from './AdminPrimitives';
import { useConfirm } from './ConfirmDialog';
import AdminImageUpload from './AdminImageUpload';
import AdminGalleryUpload from './AdminGalleryUpload';
import { useBrands, useVehicleCategories } from '../../hooks/useReferenceData';
import TechSpecsLivePreview from './TechSpecsLivePreview';
import TechSpecsJsonImport from './TechSpecsJsonImport';
import TechSpecsBatchImport from './TechSpecsBatchImport';
import { AdminPagination } from './AdminPagination';
import {
  SORT_OPTIONS, PAGE_SIZE, loadFilters, saveFilters, updateFilters, activeFilterCount,
  toQuery, isIncomplete, DEFAULT_FILTERS, type SpecFilters, type SpecStatus, type SpecSort,
} from '../../utils/techSpecAdminFilters';

const sessionStore = (): Storage | null => {
  try { return typeof window !== 'undefined' ? window.sessionStorage : null; } catch { return null; }
};

const STATUS_TABS: { value: SpecStatus; label: string; countKey: 'all' | 'published' | 'draft' | 'incomplete' }[] = [
  { value: '', label: 'Toutes', countKey: 'all' },
  { value: 'published', label: 'Publiées', countKey: 'published' },
  { value: 'draft', label: 'Brouillons', countKey: 'draft' },
  { value: 'incomplete', label: 'À compléter', countKey: 'incomplete' },
];

const dateFr = (v?: string | null) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

interface SpecForm {
  id?: number | string;
  brand: string;
  model: string;
  year: number;
  category: string;
  price_new: string;
  image: string;
  gallery: string[];
  norm_logo: string;
  importer_id: string;
  available_in_tunisia: boolean;
  /** false = brouillon: only the back-office sees it. */
  is_published: boolean;
  // Engine
  engine_type: string;
  engine_cc: string;
  engine_power: string;
  engine_torque: string;
  fuel_system: string;
  cooling: string;
  transmission: string;
  // Chassis
  frame: string;
  suspension_front: string;
  travel_front: string;
  suspension_rear: string;
  travel_rear: string;
  brakes_front: string;
  brakes_rear: string;
  tire_front: string;
  tire_rear: string;
  // Electronics
  abs: string;
  tcs: string;
  riding_modes: string;
  quickshifter: string;
  lighting: string;
  usb: string;
  dashboard: string;
  connectivity: string;
  cruise_control: string;
  keyless: string;
  other_equipment: string;
  warranty: string;
  first_service: string;
  service_interval: string;
  /** « Blanc, Noir mat, Bleu » — stored as a list (tech_specs.colors). */
  colors: string;
  // Dimensions
  weight: string;
  seat_height: string;
  tank: string;
  length: string;
  wheelbase: string;
  // Performance
  consumption: string;
  top_speed: string;
}

const emptyForm = (): SpecForm => ({
  brand: '', model: '', year: new Date().getFullYear(), category: '',
  price_new: '', image: '', gallery: [], norm_logo: '', importer_id: '', available_in_tunisia: true, is_published: true,
  engine_type: '', engine_cc: '', engine_power: '', engine_torque: '',
  fuel_system: '', cooling: '', transmission: '',
  frame: '', suspension_front: '', travel_front: '',
  suspension_rear: '', travel_rear: '',
  brakes_front: '', brakes_rear: '',
  tire_front: '', tire_rear: '',
  abs: '', tcs: '', riding_modes: '', quickshifter: '',
  lighting: '', usb: '', dashboard: '', connectivity: '', cruise_control: '', keyless: '', other_equipment: '', warranty: '', first_service: '', service_interval: '', colors: '',
  weight: '', seat_height: '', tank: '', length: '', wheelbase: '',
  consumption: '', top_speed: '',
});

// Step indicator showing the admin where they are in the 3-step flow.
const StepHeader: React.FC = () => (
  <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
    <div className="grid grid-cols-3 gap-2 md:gap-4">
      {[
        { n: 1, label: 'Marques & logos', hint: 'Référencées dans "Marques"' },
        { n: 2, label: 'Modèles par marque', hint: 'Créés ici (étape actuelle)' },
        { n: 3, label: 'Fiche détaillée', hint: 'Visible côté utilisateur' },
      ].map((s) => (
        <div key={s.n} className={`flex items-start gap-2 p-2 rounded-lg ${s.n === 2 ? 'bg-primary-50 border border-primary-200' : 'bg-slate-50 border border-slate-100'}`}>
          <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${s.n === 2 ? 'bg-primary-600 text-white' : 'bg-slate-200 text-slate-600'}`}>{s.n}</span>
          <div className="min-w-0">
            <p className={`text-[12px] font-bold leading-tight ${s.n === 2 ? 'text-primary-800' : 'text-slate-700'}`}>{s.label}</p>
            <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{s.hint}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Module-scope helpers — defined OUTSIDE the component so React keeps the
// same component identity across renders. Defining `Field`/`Section` inside
// the component would create a new function on every render, unmounting the
// inputs on every keystroke (which caused the "type word by word" bug).
const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-200 outline-none';

const Field: React.FC<{ label: string; children: React.ReactNode; hint?: string }> = ({ label, children, hint }) => (
  <label className="block">
    <span className="block text-[11px] font-bold text-slate-600 mb-1">{label}</span>
    {children}
    {hint && <span className="block text-[10px] text-slate-400 mt-0.5">{hint}</span>}
  </label>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-slate-50/60 border border-slate-100 rounded-xl p-4">
    <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-3">{title}</h4>
    {children}
  </div>
);

/** canDelete=false for moderators: they add and edit, only admins delete. */
export const TechSpecsTab: React.FC<{ canDelete?: boolean }> = ({ canDelete = true }) => {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { confirm, dialog } = useConfirm();
  const [filters, setFilters] = useState<SpecFilters>(() => loadFilters(sessionStore()));
  const [searchInput, setSearchInput] = useState(filters.search);
  const setF = (patch: Partial<SpecFilters>) => setFilters((f) => updateFilters(f, patch));
  useEffect(() => { saveFilters(filters, sessionStore()); }, [filters]);
  // Search is sent 300 ms after the last keystroke, not on every letter.
  useEffect(() => {
    if (searchInput === filters.search) return;
    const t = setTimeout(() => setF({ search: searchInput }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<SpecForm>(emptyForm());
  const [showImport, setShowImport] = useState(false);


  const { data: brandRefs = [] } = useBrands();
  const { data: categories = [] } = useVehicleCategories();

  // Importateurs catalog — used by the assignment selector. Falls back to
  // an empty list silently when the admin hasn't created any yet.
  const { data: importersData } = useQuery({
    queryKey: ['admin', 'importers', 'all'],
    queryFn: ({ signal }) => adminApi.getImporters({ active: 'true' }, signal),
    staleTime: 60_000,
  });
  const importers: any[] = importersData?.importers || [];

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin', 'tech-specs', filters],
    queryFn: ({ signal }) => adminApi.getTechSpecs(toQuery(filters), signal),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
  const specs = data?.specs || [];
  const counts = data?.counts;
  const brandFacets = data?.facets?.brands || [];
  const categoryFacets = data?.facets?.categories || [];
  const totalPages = data?.total_pages || 1;
  // A filter can leave the admin on a page that no longer exists (e.g. the
  // last fiche of page 3 was just published): go back to the last page.
  useEffect(() => {
    if (data && filters.page > 1 && filters.page > totalPages) setF({ page: Math.max(totalPages, 1) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, totalPages]);
  const nbActive = activeFilterCount(filters);
  const resetFilters = () => { setSearchInput(''); setFilters({ ...DEFAULT_FILTERS, sort: filters.sort }); };

  const invalidate = () => {
    // Admin list
    qc.invalidateQueries({ queryKey: ['admin', 'tech-specs'] });
    // Public tech-specs caches (brand list, models by brand, search,
    // popular feed) — without these the deleted brand keeps appearing
    // on /fiches-techniques until the staleTime expires.
    qc.invalidateQueries({ queryKey: ['tech-specs'] });
    qc.invalidateQueries({ queryKey: ['tech-spec'] });
  };

  const create = useMutation({
    mutationFn: (payload: any) => adminApi.createTechSpec(payload),
    onSuccess: () => { invalidate(); setForm(emptyForm()); setShowForm(false); addToast('Fiche créée', 'success'); },
    onError: (e: any) => addToast(e?.message || 'Erreur', 'error'),
  });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: any; payload: any }) => adminApi.updateTechSpec(id, payload),
    onSuccess: () => { invalidate(); setForm(emptyForm()); setShowForm(false); addToast('Fiche mise à jour', 'success'); },
    onError: (e: any) => addToast(e?.message || 'Erreur', 'error'),
  });
  const publish = useMutation({
    mutationFn: (id: any) => adminApi.updateTechSpec(id, { is_published: true }),
    onSuccess: () => { invalidate(); addToast('Fiche publiée', 'success'); },
    onError: (e: any) => addToast(e?.message || 'Erreur', 'error'),
  });
  const remove = useMutation({
    mutationFn: (id: any) => adminApi.deleteTechSpec(id),
    onSuccess: () => { invalidate(); addToast('Fiche supprimée', 'success'); },
    onError: (e: any) => addToast(e?.message || 'Erreur', 'error'),
  });

  // Build the JSONB-shaped payload the backend expects.
  // We send sub-objects (engine/chassis/electronics/dimensions) — the public
  // mapper in services/techSpecsApi.ts reads from these first, then falls
  // back to flat columns, so this format renders the full details page.
  const buildPayload = (f: SpecForm) => ({
    brand: f.brand.trim(),
    model: f.model.trim(),
    year: Number(f.year),
    category: f.category || 'Roadster', // backend requires it
    // Accept any string (e.g. "Sur demande", "À partir de 35 000 DT") OR plain number.
    price_new: f.price_new && f.price_new.trim() ? f.price_new.trim() : null,
    image: f.image || null,
    gallery: f.gallery.filter(Boolean),
    norm_logo: f.norm_logo || null,
    importer_id: f.importer_id || null,
    available_in_tunisia: f.available_in_tunisia !== false,
    is_published: f.is_published !== false,
    engine: {
      type: f.engine_type,
      cc: f.engine_cc,
      power: f.engine_power,
      torque: f.engine_torque,
      fuelSystem: f.fuel_system,
      cooling: f.cooling,
      transmission: f.transmission,
    },
    chassis: {
      frame: f.frame,
      suspensionFront: f.suspension_front,
      travelFront: f.travel_front,
      suspensionRear: f.suspension_rear,
      travelRear: f.travel_rear,
      brakesFront: f.brakes_front,
      brakesRear: f.brakes_rear,
      tireFront: f.tire_front,
      tireRear: f.tire_rear,
    },
    electronics: {
      abs: f.abs,
      tcs: f.tcs,
      ridingModes: f.riding_modes,
      quickshifter: f.quickshifter,
      lighting: f.lighting,
      usb: f.usb,
      dashboard: f.dashboard,
      connectivity: f.connectivity,
      cruiseControl: f.cruise_control,
      keyless: f.keyless,
      other: f.other_equipment,
    },
    maintenance: {
      warranty: f.warranty,
      firstService: f.first_service,
      serviceInterval: f.service_interval,
    },
    colors: f.colors.split(/[,;\n]/).map((c) => c.trim()).filter(Boolean),
    dimensions: {
      weight: f.weight,
      seatHeight: f.seat_height,
      tank: f.tank,
      length: f.length,
      wheelbase: f.wheelbase,
    },
    consumption: f.consumption || null,
    top_speed: f.top_speed || null,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.brand.trim() || !form.model.trim()) {
      addToast('Marque et modèle requis', 'error');
      return;
    }
    const payload = buildPayload(form);
    if (form.id != null) update.mutate({ id: form.id, payload });
    else create.mutate(payload);
  };

  const startEdit = (s: any) => {
    // Read JSONB sub-objects first (the canonical source after backend save),
    // then fall back to flat columns for legacy rows.
    setForm({
      id: s.id,
      brand: s.brand || '',
      model: s.model || '',
      year: s.year || new Date().getFullYear(),
      category: s.category || '',
      price_new: s.price_new != null ? String(s.price_new) : '',
      image: s.image || s.cover_image || '',
      gallery: Array.isArray(s.gallery) ? s.gallery : [],
      norm_logo: s.norm_logo || '',
      importer_id: s.importer_id || s.importer?.id || '',
      available_in_tunisia: s.available_in_tunisia !== false,
      is_published: s.is_published !== false,
      engine_type: s.engine?.type || s.engine_type || '',
      engine_cc: s.engine?.cc || s.engine_cc || '',
      engine_power: s.engine?.power || s.engine_power || '',
      engine_torque: s.engine?.torque || s.engine_torque || '',
      fuel_system: s.engine?.fuelSystem || s.fuel_system || '',
      cooling: s.engine?.cooling || s.cooling || '',
      transmission: s.engine?.transmission || s.transmission || '',
      frame: s.chassis?.frame || s.frame || '',
      suspension_front: s.chassis?.suspensionFront || s.suspension_front || '',
      travel_front: s.chassis?.travelFront || s.travel_front || '',
      suspension_rear: s.chassis?.suspensionRear || s.suspension_rear || '',
      travel_rear: s.chassis?.travelRear || s.travel_rear || '',
      brakes_front: s.chassis?.brakesFront || s.brakes_front || '',
      brakes_rear: s.chassis?.brakesRear || s.brakes_rear || '',
      tire_front: s.chassis?.tireFront || s.tire_front || '',
      tire_rear: s.chassis?.tireRear || s.tire_rear || '',
      abs: s.electronics?.abs || s.abs || '',
      tcs: s.electronics?.tcs || s.tcs || '',
      riding_modes: s.electronics?.ridingModes || s.riding_modes || '',
      quickshifter: s.electronics?.quickshifter || s.quickshifter || '',
      lighting: s.electronics?.lighting || '',
      usb: s.electronics?.usb || '',
      dashboard: s.electronics?.dashboard || '',
      connectivity: s.electronics?.connectivity || '',
      cruise_control: s.electronics?.cruiseControl || '',
      keyless: s.electronics?.keyless || '',
      other_equipment: s.electronics?.other || '',
      warranty: s.maintenance?.warranty || '',
      first_service: s.maintenance?.firstService || '',
      service_interval: s.maintenance?.serviceInterval || '',
      colors: Array.isArray(s.colors) ? s.colors.join(', ') : '',

      weight: s.dimensions?.weight || s.weight || '',
      seat_height: s.dimensions?.seatHeight || s.seat_height || '',
      tank: s.dimensions?.tank || s.tank || '',
      length: s.dimensions?.length || s.length || '',
      wheelbase: s.dimensions?.wheelbase || s.wheelbase || '',
      consumption: s.consumption || '',
      top_speed: s.top_speed || '',
    });
    setShowForm(true);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // A fiche without photo or engine figures is a thin page: ask first.
  const publishDraft = async (s: any) => {
    const missing = [!s.image && 'photo', !(s.engine?.cc || s.engine?.power) && 'cylindrée / puissance'].filter(Boolean);
    if (missing.length && !(await confirm({
      title: `Publier sans ${missing.join(' ni ')} ?`,
      message: 'Une fiche incomplète aide peu les visiteurs et peut nuire au référencement.',
      confirmLabel: 'Publier quand même',
    }))) return;
    publish.mutate(s.id);
  };

  const del = async (id: any) => {
    if (await confirm({ title: 'Supprimer cette fiche ?', confirmLabel: 'Supprimer', variant: 'danger' })) {
      remove.mutate(id);
    }
  };

  const isEditing = form.id != null;
  const submitting = create.isPending || update.isPending;

  // Selected brand logo preview — helps the admin confirm step 1 is wired.
  const selectedBrandLogo = useMemo(
    () => brandRefs.find((b: any) => b.name?.toLowerCase() === form.brand.toLowerCase())?.logo_url || '',
    [brandRefs, form.brand],
  );

  // Gallery uploads/removal/reordering are handled by AdminGalleryUpload.

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
          <Wrench size={20} /> Fiches techniques
        </h2>
        <div className="flex items-center gap-2">
        {canDelete && (
          <button
            onClick={() => setShowImport((v) => !v)}
            className="inline-flex items-center gap-2 border border-slate-300 hover:bg-slate-50 text-slate-800 px-4 py-2 rounded-lg text-sm font-bold"
          >
            <FileUp size={16} /> Importer un lot
          </button>
        )}
        <button
          onClick={() => { setForm(emptyForm()); setShowForm((s) => !s); }}
          className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-bold"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Fermer' : 'Nouvelle fiche'}
        </button>
        </div>
      </div>

      <StepHeader />

      {showImport && <TechSpecsBatchImport onClose={() => setShowImport(false)} onImported={invalidate} />}

      {/* Status tabs with counters (other filters applied). */}
      <div role="tablist" aria-label="Statut des fiches" className="flex gap-1.5 overflow-x-auto pb-1">
        {STATUS_TABS.map((t) => {
          const active = filters.status === t.value;
          const n = counts?.[t.countKey];
          return (
            <button
              key={t.countKey}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setF({ status: t.value })}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold border transition-colors ${
                active ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {t.label}
              {n !== undefined && (
                <span className={`tabular-nums text-[11px] px-1.5 rounded ${active ? 'bg-white/20' : t.value === 'incomplete' && n > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{n}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filters + sort */}
      <div className="grid grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))] gap-2">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Marque, modèle, année, moteur…"
          aria-label="Rechercher une fiche"
          className="col-span-2 lg:col-span-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
        />
        <select value={filters.brand} onChange={(e) => setF({ brand: e.target.value })} aria-label="Filtrer par marque" className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
          <option value="">Toutes les marques</option>
          {brandFacets.map((b) => <option key={b.name} value={b.name}>{b.name} ({b.count})</option>)}
        </select>
        <select value={filters.category} onChange={(e) => setF({ category: e.target.value })} aria-label="Filtrer par catégorie" className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
          <option value="">Toutes les catégories</option>
          {categoryFacets.map((c) => <option key={c.name} value={c.name}>{c.name} ({c.count})</option>)}
        </select>
        <select value={filters.tunisia} onChange={(e) => setF({ tunisia: e.target.value as SpecFilters['tunisia'] })} aria-label="Filtrer par disponibilité en Tunisie" className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
          <option value="">Dispo. en Tunisie : toutes</option>
          <option value="true">Disponibles en Tunisie</option>
          <option value="false">Non disponibles</option>
        </select>
        <select value={filters.sort} onChange={(e) => setF({ sort: e.target.value as SpecSort })} aria-label="Trier par" className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>Trier : {o.label}</option>)}
        </select>
      </div>
      <div className="flex items-center justify-between gap-3 text-[12px] text-slate-500 -mt-3">
        <span aria-live="polite">
          {data ? `${data.total} fiche${data.total > 1 ? 's' : ''}` : ''}
        </span>
        {nbActive > 0 && (
          <button type="button" onClick={resetFilters} className="font-bold text-primary-700 hover:underline">
            Effacer les filtres ({nbActive})
          </button>
        )}
      </div>

      {showForm && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
          <form onSubmit={submit} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 min-w-0">
          {/* JSON IMPORT — paste a ChatGPT-generated payload to auto-fill all fields */}
          <TechSpecsJsonImport onApply={(partial) => setForm((prev) => ({ ...prev, ...partial }))} />
          {/* IDENTITY */}
          <Section title="Identité du modèle">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Marque *" hint="Issue de la liste de marques (étape 1)">
                <div className="flex items-center gap-2">
                  {selectedBrandLogo && (
                    <img src={selectedBrandLogo} alt="" className="w-9 h-9 object-contain border border-slate-200 rounded-md p-0.5 bg-white shrink-0" />
                  )}
                  <input list="brand-list" required value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className={inputCls} />
                </div>
                <datalist id="brand-list">
                  {brandRefs.map((b: any) => <option key={b.id} value={b.name} />)}
                </datalist>
              </Field>
              <Field label="Modèle *">
                <input required value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className={inputCls} placeholder="MT-07" />
              </Field>
              <Field label="Année *">
                <input required type="number" min={1990} max={2100} value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} className={inputCls} />
              </Field>
              <Field label="Catégorie">
                <input list="cat-list" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls} placeholder="Roadster" />
                <datalist id="cat-list">
                  {categories.map((c: string) => <option key={c} value={c} />)}
                </datalist>
              </Field>
              <Field label="Prix neuf" hint="Nombre (35000) ou texte libre (ex. « Sur demande »)">
                <input type="text" value={form.price_new} onChange={(e) => setForm({ ...form, price_new: e.target.value })} className={inputCls} placeholder="35000 ou Sur demande" />
              </Field>
              <Field label="Logo norme (Euro 5, etc.) URL">
                <input value={form.norm_logo} onChange={(e) => setForm({ ...form, norm_logo: e.target.value })} className={inputCls} placeholder="https://…/euro5.png" />
              </Field>
              <Field label="Importateur" hint="Carte de contact affichée publiquement">
                <select
                  value={form.importer_id}
                  onChange={(e) => setForm({ ...form, importer_id: e.target.value })}
                  className={inputCls}
                >
                  <option value="">— Aucun —</option>
                  {importers.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}{i.city ? ` · ${i.city}` : ''}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Visibility toggle — when off, the fiche disappears from the
                public landing-page Neuf flow (brands grid, models list,
                popular, search). Admin always sees it. */}
            <div className="mt-3 flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white">
              <button
                type="button"
                role="switch"
                aria-checked={form.available_in_tunisia}
                onClick={() => setForm({ ...form, available_in_tunisia: !form.available_in_tunisia })}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${form.available_in_tunisia ? 'bg-primary-600' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${form.available_in_tunisia ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-slate-800">Disponible neuf en Tunisie</p>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Quand activé, ce modèle apparaît sur la page « Fiches Techniques » côté visiteur.
                  Désactivez pour masquer la fiche du grand public (visible uniquement en admin).
                </p>
              </div>
            </div>
            {/* Draft toggle — off = brouillon: the fiche exists only in the
                back-office (no public page, no sitemap, no search). */}
            <div className="mt-3 flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white">
              <button
                type="button"
                role="switch"
                aria-checked={form.is_published}
                aria-label="Publiée sur le site"
                onClick={() => setForm({ ...form, is_published: !form.is_published })}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${form.is_published ? 'bg-primary-600' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${form.is_published ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-slate-800">{form.is_published ? 'Publiée sur le site' : 'Brouillon'}</p>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Un brouillon n’a pas de page publique : ni visiteurs, ni Google. Publiez quand la fiche est complète (photos comprises).
                </p>
              </div>
            </div>
          </Section>

          {/* MEDIA */}
          <Section title="Médias">
            <AdminImageUpload
              label="Image principale (cover)"
              crop
              value={form.image}
              onChange={(url) => setForm({ ...form, image: url })}
            />
            <div className="mt-4">
              <AdminGalleryUpload
                label="Galerie (images supplémentaires)"
                crop
                value={form.gallery}
                onChange={(gallery) => setForm({ ...form, gallery })}
              />
            </div>
          </Section>

          {/* ENGINE */}
          <Section title="Moteur">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="Type"><input value={form.engine_type} onChange={(e) => setForm({ ...form, engine_type: e.target.value })} className={inputCls} placeholder="Bicylindre 4T" /></Field>
              <Field label="Cylindrée"><input value={form.engine_cc} onChange={(e) => setForm({ ...form, engine_cc: e.target.value })} className={inputCls} placeholder="689 cc" /></Field>
              <Field label="Puissance"><input value={form.engine_power} onChange={(e) => setForm({ ...form, engine_power: e.target.value })} className={inputCls} placeholder="73 ch" /></Field>
              <Field label="Couple"><input value={form.engine_torque} onChange={(e) => setForm({ ...form, engine_torque: e.target.value })} className={inputCls} placeholder="67 Nm" /></Field>
              <Field label="Transmission"><input value={form.transmission} onChange={(e) => setForm({ ...form, transmission: e.target.value })} className={inputCls} placeholder="6 vitesses" /></Field>
              <Field label="Refroidissement"><input value={form.cooling} onChange={(e) => setForm({ ...form, cooling: e.target.value })} className={inputCls} placeholder="Liquide" /></Field>
              <Field label="Alimentation"><input value={form.fuel_system} onChange={(e) => setForm({ ...form, fuel_system: e.target.value })} className={inputCls} placeholder="Injection" /></Field>
            </div>
          </Section>

          {/* CHASSIS */}
          <Section title="Châssis & Roues">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="Type de cadre"><input value={form.frame} onChange={(e) => setForm({ ...form, frame: e.target.value })} className={inputCls} placeholder="Treillis acier" /></Field>
              <Field label="Suspension avant"><input value={form.suspension_front} onChange={(e) => setForm({ ...form, suspension_front: e.target.value })} className={inputCls} placeholder="Fourche inversée 41mm" /></Field>
              <Field label="Débattement avant"><input value={form.travel_front} onChange={(e) => setForm({ ...form, travel_front: e.target.value })} className={inputCls} placeholder="130 mm" /></Field>
              <Field label="Suspension arrière"><input value={form.suspension_rear} onChange={(e) => setForm({ ...form, suspension_rear: e.target.value })} className={inputCls} placeholder="Mono-amortisseur" /></Field>
              <Field label="Débattement arrière"><input value={form.travel_rear} onChange={(e) => setForm({ ...form, travel_rear: e.target.value })} className={inputCls} placeholder="130 mm" /></Field>
              <Field label="Frein avant"><input value={form.brakes_front} onChange={(e) => setForm({ ...form, brakes_front: e.target.value })} className={inputCls} placeholder="2 disques 298 mm" /></Field>
              <Field label="Frein arrière"><input value={form.brakes_rear} onChange={(e) => setForm({ ...form, brakes_rear: e.target.value })} className={inputCls} placeholder="Disque 245 mm" /></Field>
              <Field label="Pneu avant"><input value={form.tire_front} onChange={(e) => setForm({ ...form, tire_front: e.target.value })} className={inputCls} placeholder="120/70 ZR17" /></Field>
              <Field label="Pneu arrière"><input value={form.tire_rear} onChange={(e) => setForm({ ...form, tire_rear: e.target.value })} className={inputCls} placeholder="180/55 ZR17" /></Field>
            </div>
          </Section>

          {/* DIMENSIONS */}
          <Section title="Dimensions & Poids">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="Poids"><input value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} className={inputCls} placeholder="184 kg" /></Field>
              <Field label="Hauteur de selle"><input value={form.seat_height} onChange={(e) => setForm({ ...form, seat_height: e.target.value })} className={inputCls} placeholder="805 mm" /></Field>
              <Field label="Réservoir"><input value={form.tank} onChange={(e) => setForm({ ...form, tank: e.target.value })} className={inputCls} placeholder="14 L" /></Field>
              <Field label="Longueur"><input value={form.length} onChange={(e) => setForm({ ...form, length: e.target.value })} className={inputCls} placeholder="2085 mm" /></Field>
              <Field label="Empattement"><input value={form.wheelbase} onChange={(e) => setForm({ ...form, wheelbase: e.target.value })} className={inputCls} placeholder="1400 mm" /></Field>
            </div>
          </Section>

          {/* ELECTRONICS */}
          <Section title="Électronique & Équipements">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="ABS"><input value={form.abs} onChange={(e) => setForm({ ...form, abs: e.target.value })} className={inputCls} placeholder="Série" /></Field>
              <Field label="Contrôle de traction"><input value={form.tcs} onChange={(e) => setForm({ ...form, tcs: e.target.value })} className={inputCls} placeholder="Série" /></Field>
              <Field label="Modes de conduite"><input value={form.riding_modes} onChange={(e) => setForm({ ...form, riding_modes: e.target.value })} className={inputCls} placeholder="Sport / Street / Rain" /></Field>
              <Field label="Quick shifter"><input value={form.quickshifter} onChange={(e) => setForm({ ...form, quickshifter: e.target.value })} className={inputCls} placeholder="Optionnel" /></Field>
              <Field label="Éclairage"><input value={form.lighting} onChange={(e) => setForm({ ...form, lighting: e.target.value })} className={inputCls} placeholder="Full LED (série)" /></Field>
              <Field label="Prise USB"><input value={form.usb} onChange={(e) => setForm({ ...form, usb: e.target.value })} className={inputCls} placeholder="Oui (série)" /></Field>
              <Field label="Tableau de bord"><input value={form.dashboard} onChange={(e) => setForm({ ...form, dashboard: e.target.value })} className={inputCls} placeholder="TFT 5 pouces" /></Field>
              <Field label="Connectivité"><input value={form.connectivity} onChange={(e) => setForm({ ...form, connectivity: e.target.value })} className={inputCls} placeholder="Bluetooth" /></Field>
              <Field label="Régulateur de vitesse"><input value={form.cruise_control} onChange={(e) => setForm({ ...form, cruise_control: e.target.value })} className={inputCls} placeholder="Non" /></Field>
              <Field label="Démarrage sans clé"><input value={form.keyless} onChange={(e) => setForm({ ...form, keyless: e.target.value })} className={inputCls} placeholder="Oui" /></Field>
              <Field label="Autres équipements"><input value={form.other_equipment} onChange={(e) => setForm({ ...form, other_equipment: e.target.value })} className={inputCls} placeholder="Poignées chauffantes (option)" /></Field>
            </div>
          </Section>

          {/* WARRANTY & MAINTENANCE — hidden on the public page when empty */}
          <Section title="Garantie & Entretien">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="Garantie constructeur"><input value={form.warranty} onChange={(e) => setForm({ ...form, warranty: e.target.value })} className={inputCls} placeholder="2 ans kilométrage illimité" /></Field>
              <Field label="1ère révision"><input value={form.first_service} onChange={(e) => setForm({ ...form, first_service: e.target.value })} className={inputCls} placeholder="1 000 km" /></Field>
              <Field label="Révisions suivantes"><input value={form.service_interval} onChange={(e) => setForm({ ...form, service_interval: e.target.value })} className={inputCls} placeholder="Tous les 10 000 km" /></Field>
            </div>
          </Section>

          {/* COLOURS — « Caractéristiques » and « Questions fréquentes » of the public page */}
          <Section title="Couleurs">
            <Field label="Couleurs disponibles (séparées par des virgules)">
              <input value={form.colors} onChange={(e) => setForm({ ...form, colors: e.target.value })} className={inputCls} placeholder="Blanc, Noir mat, Bleu" />
            </Field>
          </Section>

          {/* PERFORMANCE */}
          <Section title="Performances">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="Vitesse max"><input value={form.top_speed} onChange={(e) => setForm({ ...form, top_speed: e.target.value })} className={inputCls} placeholder="220 km/h" /></Field>
              <Field label="Consommation"><input value={form.consumption} onChange={(e) => setForm({ ...form, consumption: e.target.value })} className={inputCls} placeholder="4.5 L/100" /></Field>
            </div>
          </Section>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={() => { setShowForm(false); setForm(emptyForm()); }} className="px-4 py-2 rounded-lg border text-sm font-bold">
              Annuler
            </button>
            <button disabled={submitting} className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold disabled:opacity-60">
              {submitting ? '…' : isEditing ? 'Enregistrer' : 'Créer la fiche'}
            </button>
          </div>
          </form>
          <TechSpecsLivePreview form={form} brandLogo={selectedBrandLogo} />
        </div>
      )}

      <AdminTable
        columns={['Fiche', 'Statut', 'Année', 'Catégorie', 'Prix', 'Ajoutée le', ...(filters.sort === 'views' ? ['Vues'] : []), 'Actions']}
        loading={isLoading}
        rowCount={specs.length}
        empty={nbActive > 0 ? 'Aucune fiche ne correspond à ces filtres.' : 'Aucune fiche.'}
      >
        {specs.map((s: any) => (
          <tr key={s.id} className="hover:bg-slate-50 align-top">
            <td className="p-3">
              <div className="flex items-start gap-3">
                {s.image ? (
                  <img src={s.image} alt="" className="w-14 h-14 object-cover rounded-lg border border-slate-200 shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                    <Wrench size={18} />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 line-clamp-1">
                    {s.brand} {s.model}
                  </p>
                  {(s.engine?.cc || s.engine_cc) && (
                    <p className="text-[11px] text-slate-500">
                      {s.engine?.cc || s.engine_cc} · {s.engine?.power || s.engine_power || '—'}
                    </p>
                  )}
                </div>
              </div>
            </td>
            <td className="p-3">
              <div className="flex flex-col items-start gap-1">
                {s.is_published === false ? (
                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-wide">Brouillon</span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-wide">Publiée</span>
                )}
                {isIncomplete(s) && (
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold">À compléter</span>
                )}
              </div>
            </td>
            <td className="p-3 text-sm tabular-nums">{s.year || '—'}</td>
            <td className="p-3 text-xs">
              {s.category ? <span className="px-2 py-0.5 bg-slate-100 rounded font-bold text-slate-700">{s.category}</span> : <span className="text-slate-400">—</span>}
            </td>
            <td className="p-3 text-sm tabular-nums">{(() => {
              const v = s.price_new;
              if (v == null || v === '') return '—';
              const str = String(v).trim();
              const isNum = /^-?\d+(\.\d+)?$/.test(str);
              return isNum ? `${Number(str).toLocaleString('fr-FR')} DT` : str;
            })()}</td>
            <td className="p-3 text-xs tabular-nums text-slate-600 whitespace-nowrap">{dateFr(s.created_at)}</td>
            {filters.sort === 'views' && <td className="p-3 text-sm tabular-nums">{Number(s.visits || 0).toLocaleString('fr-FR')}</td>}
            <td className="p-3 text-right">
              <div className="flex items-center justify-end gap-1">
                {s.is_published === false && (
                  <button
                    onClick={() => publishDraft(s)}
                    disabled={publish.isPending}
                    className="inline-flex items-center gap-1 px-2 py-1.5 text-[12px] font-bold text-emerald-700 hover:bg-emerald-50 rounded-lg disabled:opacity-60"
                  >
                    <Eye size={14} /> Publier
                  </button>
                )}
                <button onClick={() => startEdit(s)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" aria-label="Modifier"><Edit3 size={14} /></button>
                {canDelete && <button onClick={() => del(s.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" aria-label="Supprimer"><Trash2 size={14} /></button>}
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>
      <AdminPagination
        currentPage={filters.page}
        totalPages={totalPages}
        total={data?.total || 0}
        pageSize={PAGE_SIZE}
        onPageChange={(page) => { setF({ page }); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        isFetching={isFetching}
      />
      {dialog}
    </div>
  );
};

export default TechSpecsTab;
