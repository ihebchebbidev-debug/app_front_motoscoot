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
import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wrench, Plus, Trash2, Edit3, X } from 'lucide-react';
import { adminApi } from '../../services/adminApi';
import { useToast } from '../../context/ToastContext';
import { AdminTable } from './AdminPrimitives';
import { useConfirm } from './ConfirmDialog';
import AdminImageUpload from './AdminImageUpload';
import AdminGalleryUpload from './AdminGalleryUpload';
import { useBrands, useVehicleCategories } from '../../hooks/useReferenceData';
import TechSpecsLivePreview from './TechSpecsLivePreview';
import TechSpecsJsonImport from './TechSpecsJsonImport';

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
  price_new: '', image: '', gallery: [], norm_logo: '', importer_id: '', available_in_tunisia: true,
  engine_type: '', engine_cc: '', engine_power: '', engine_torque: '',
  fuel_system: '', cooling: '', transmission: '',
  frame: '', suspension_front: '', travel_front: '',
  suspension_rear: '', travel_rear: '',
  brakes_front: '', brakes_rear: '',
  tire_front: '', tire_rear: '',
  abs: '', tcs: '', riding_modes: '', quickshifter: '',
  lighting: '', usb: '', dashboard: '', connectivity: '', cruise_control: '', keyless: '', other_equipment: '', warranty: '', first_service: '', service_interval: '',
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

export const TechSpecsTab: React.FC = () => {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { confirm, dialog } = useConfirm();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<SpecForm>(emptyForm());
  

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

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'tech-specs', search],
    queryFn: ({ signal }) => adminApi.getTechSpecs({ search: search || undefined, limit: 100 }, signal),
    staleTime: 30_000,
  });
  const specs = data?.specs || [];

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
        <button
          onClick={() => { setForm(emptyForm()); setShowForm((s) => !s); }}
          className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-bold"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Fermer' : 'Nouvelle fiche'}
        </button>
      </div>

      <StepHeader />

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Marque, modèle, année, moteur, dimensions…"
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
      />

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
          </Section>

          {/* MEDIA */}
          <Section title="Médias">
            <AdminImageUpload
              label="Image principale (cover)"
              value={form.image}
              onChange={(url) => setForm({ ...form, image: url })}
            />
            <div className="mt-4">
              <AdminGalleryUpload
                label="Galerie (images supplémentaires)"
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
        columns={['Fiche', 'Année', 'Catégorie', 'Prix', 'Actions']}
        loading={isLoading}
        rowCount={specs.length}
        empty="Aucune fiche."
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
                  <p className="font-bold text-slate-900 line-clamp-1">{s.brand} {s.model}</p>
                  {(s.engine?.cc || s.engine_cc) && (
                    <p className="text-[11px] text-slate-500">
                      {s.engine?.cc || s.engine_cc} · {s.engine?.power || s.engine_power || '—'}
                    </p>
                  )}
                </div>
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
            <td className="p-3 text-right">
              <div className="flex items-center justify-end gap-1">
                <button onClick={() => startEdit(s)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" aria-label="Modifier"><Edit3 size={14} /></button>
                <button onClick={() => del(s.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" aria-label="Supprimer"><Trash2 size={14} /></button>
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>
      {dialog}
    </div>
  );
};

export default TechSpecsTab;
