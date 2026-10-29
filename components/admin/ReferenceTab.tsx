import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Database, Edit3, Check, X, Search } from 'lucide-react';
import { adminApi } from '../../services/adminApi';
import { useToast } from '../../context/ToastContext';
import { AdminTable } from './AdminPrimitives';
import { useConfirm } from './ConfirmDialog';
import { CategoryImagePicker } from './CategoryImagePicker';


type FieldType = 'text' | 'number' | 'checkbox' | 'brand' | 'categories' | 'accessory_types' | 'accessory_type_single' | 'image';
type Resource = {
  key: string;
  label: string;
  fields: { name: string; label: string; type?: FieldType; required?: boolean }[];
};

const RESOURCES: Resource[] = [
  { key: 'brands', label: 'Marques', fields: [
    { name: 'name', label: 'Nom', required: true },
    { name: 'logo_url', label: 'Logo URL' },
    // Multi-select linking the brand to one or more vehicle categories.
    // Powers the "intelligent" filter: when a buyer picks "Moto", only
    // brands flagged with that category appear in the brand dropdown.
    { name: 'categories', label: 'Catégories de véhicules', type: 'categories' },
    // Same idea but for accessory types (Casque, Gant, Veste, …): when a
    // buyer chooses "Accessoires" + "Casque", only brands tagged with
    // "Casque" show up. Curated by admins via /admin/reference/accessory-types.
    { name: 'accessory_types', label: "Types d'accessoires", type: 'accessory_types' },
  ]},
  { key: 'models', label: 'Modèles', fields: [
    // brand_id is rendered as a <select> populated from /admin/reference/brands
    // (see special-casing in the form below) — admins should never have to
    // memorize numeric brand IDs.
    { name: 'brand_id', label: 'Marque', type: 'brand', required: true },
    { name: 'name', label: 'Nom', required: true },
    { name: 'category', label: 'Catégorie' },
    // Optional accessory-type tags so e.g. "AGV K6" → Casque is filterable.
    { name: 'accessory_types', label: "Types d'accessoires", type: 'accessory_types' },
  ]},
  { key: 'cities', label: 'Villes', fields: [
    { name: 'name', label: 'Ville', required: true },
    { name: 'governorate', label: 'Gouvernorat', required: true },
  ]},
  { key: 'vehicle-categories', label: 'Catégories véhicules', fields: [
    { name: 'name', label: 'Nom (titre affiché)', required: true },
    { name: 'position', label: 'Position', type: 'number' },
    // Icône SVG/PNG affichée dans la barre de catégories de la page d'accueil.
    { name: 'icon_url', label: 'Icône (barre accueil)', type: 'image' },
    // Image plus large utilisée sur les pages de listing/recherche par catégorie.
    { name: 'image_url', label: 'Image de couverture', type: 'image' },
    { name: 'description', label: 'Description courte' },
  ]},
  { key: 'accessory-types', label: 'Types accessoires', fields: [
    { name: 'name', label: 'Nom', required: true },
    { name: 'position', label: 'Position', type: 'number' },
    { name: 'icon_url', label: 'Icône (barre accueil)', type: 'image' },
    { name: 'image_url', label: 'Image de couverture', type: 'image' },
  ]},
  { key: 'garage-specialties', label: 'Spécialités garages', fields: [
    { name: 'name', label: 'Nom', required: true },
    { name: 'position', label: 'Position', type: 'number' },
  ]},
  { key: 'garage-services', label: 'Services garages', fields: [
    { name: 'name', label: 'Nom', required: true },
    { name: 'position', label: 'Position', type: 'number' },
  ]},
  { key: 'equipment', label: 'Équipement', fields: [
    { name: 'name', label: 'Nom', required: true },
    { name: 'category', label: 'Catégorie' },
    // Optional — tag this equipment row as belonging to a specific accessory
    // type so it only appears in the wizard when the user is depositing
    // that kind of accessory (e.g. "Pinlock" → Casque).
    { name: 'accessory_type', label: "Type d'accessoire (optionnel)", type: 'accessory_type_single' },
  ]},
  { key: 'colors', label: 'Couleurs', fields: [
    { name: 'name', label: 'Nom', required: true },
    { name: 'hex', label: 'Hex (#RRGGBB)' },
  ]},
];

export const ReferenceTab: React.FC = () => {
  const [active, setActive] = useState<Resource>(RESOURCES[0]);
  const [globalSearch, setGlobalSearch] = useState('');
  const [form, setForm] = useState<Record<string, any>>({});
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const qc = useQueryClient();
  const { addToast } = useToast();

  const { data: rows = [], isLoading } = useQuery<any[]>({
    queryKey: ['admin', 'reference', active.key],
    queryFn: ({ signal }) => adminApi.refList(active.key, signal),
    staleTime: 1000 * 30,
  });

  // Always-loaded brands list — small, only fetched when the active resource
  // actually needs a brand picker (currently: "models"). Avoids a needless
  // request on every other tab.
  const needsBrands = active.fields.some((f) => f.type === 'brand');
  const { data: brands = [] } = useQuery<any[]>({
    queryKey: ['admin', 'reference', 'brands'],
    queryFn: ({ signal }) => adminApi.refList('brands', signal),
    staleTime: 1000 * 60 * 5,
    enabled: needsBrands,
  });

  // Vehicle category list — fetched only on the brands tab where we render
  // the multi-select linking each brand to one or more categories. Uses the
  // same admin endpoint so admins can curate categories themselves.
  const needsCategories = active.fields.some((f) => f.type === 'categories');
  const { data: vehicleCats = [] } = useQuery<any[]>({
    queryKey: ['admin', 'reference', 'vehicle-categories'],
    queryFn: ({ signal }) => adminApi.refList('vehicle-categories', signal),
    staleTime: 1000 * 60 * 5,
    enabled: needsCategories,
  });

  // Accessory-type list — fetched only on tabs that expose an accessory-type
  // picker (currently brands, models, equipment). Same admin endpoint as the
  // dedicated "Types accessoires" tab so the chip choices stay in sync with
  // whatever the admin curates there.
  const needsAccessoryTypes = active.fields.some(
    (f) => f.type === 'accessory_types' || f.type === 'accessory_type_single'
  );
  const { data: accessoryTypes = [] } = useQuery<any[]>({
    queryKey: ['admin', 'reference', 'accessory-types'],
    queryFn: ({ signal }) => adminApi.refList('accessory-types', signal),
    staleTime: 1000 * 60 * 5,
    enabled: needsAccessoryTypes,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'reference', active.key] });
    qc.invalidateQueries({ queryKey: ['reference'] });
  };

  const create = useMutation({
    mutationFn: (payload: any) => adminApi.refCreate(active.key, payload),
    onSuccess: () => { invalidate(); setForm({}); addToast('Créé', 'success'); },
    onError: (e: any) => addToast(e?.message || 'Erreur', 'error'),
  });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: any; payload: any }) =>
      adminApi.refUpdate(active.key, id, payload),
    onSuccess: () => { invalidate(); setEditingId(null); addToast('Mise à jour', 'success'); },
    onError: (e: any) => addToast(e?.message || 'Erreur', 'error'),
  });
  const remove = useMutation({
    mutationFn: (id: any) => adminApi.refDelete(active.key, id),
    onSuccess: () => { invalidate(); addToast('Supprimé', 'success'); },
    onError: (e: any) => addToast(e?.message || 'Erreur', 'error'),
  });

  /**
   * Strip empty-string values before sending. Without this, optional fields
   * (logo_url, governorate, hex, category, …) get persisted as "" instead of
   * NULL, which then breaks COALESCE-based partial updates and clutters the
   * UI with empty pills. Trims string values too.
   */
  const cleanPayload = (p: Record<string, any>): Record<string, any> => {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(p)) {
      if (typeof v === 'string') {
        const t = v.trim();
        if (t === '') continue;       // drop empty strings entirely
        out[k] = t;
      } else if (v !== undefined && v !== null) {
        out[k] = v;
      }
    }
    return out;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmEmptyCategories(form)) return;
    create.mutate(cleanPayload(form));
  };
  const startEdit = (r: any) => { setEditingId(r.id); setEditForm({ ...r }); };
  const saveEdit = () => {
    if (editingId == null) return;
    if (!confirmEmptyCategories(editForm)) return;
    update.mutate({ id: editingId, payload: cleanPayload(editForm) });
  };

  /**
   * When the active resource has a `categories` field (currently: brands),
   * warn the admin if they're about to save with an empty list — a brand
   * without categories disappears from the type-scoped buyer dropdowns.
   * Returns true when it's safe to proceed.
   */
  const confirmEmptyCategories = (payload: Record<string, any>): boolean => {
    const hasCatField = active.fields.some((f) => f.type === 'categories');
    if (!hasCatField) return true;
    const cats = payload.categories;
    const isEmpty = !Array.isArray(cats) || cats.length === 0;
    if (!isEmpty) return true;
    return window.confirm(
      'Aucune catégorie sélectionnée. Cette marque ne sera pas proposée quand un acheteur filtre par type de véhicule. Continuer ?'
    );
  };
  const { confirm: askConfirm, dialog: confirmDialog } = useConfirm();
  const del = async (id: any) => {
    const ok = await askConfirm({ title: 'Supprimer cet élément ?', confirmLabel: 'Supprimer', variant: 'danger' });
    if (ok) remove.mutate(id);
  };

  const columns = [...active.fields.map((f) => f.label), 'Actions'];
  const filteredRows = useMemo(() => {
    const term = globalSearch.trim().toLowerCase();
    if (!term) return rows;

    return rows.filter((row) => {
      const values = [active.label, row.id, row.brand_name];
      for (const field of active.fields) {
        const value = row[field.name];
        if (Array.isArray(value)) values.push(value.join(' '));
        else if (value && typeof value === 'object') values.push(JSON.stringify(value));
        else values.push(value);
      }
      return values.some((value) => String(value ?? '').toLowerCase().includes(term));
    });
  }, [active.fields, active.label, globalSearch, rows]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
          <Database size={20} /> Données de référence
        </h2>
        <div className="relative w-full md:w-96">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            placeholder="Rechercher partout dans les références…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:border-primary-600"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {RESOURCES.map((r) => (
          <button
            key={r.key}
            onClick={() => { setActive(r); setForm({}); setEditingId(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              active.key === r.key ? 'bg-primary-600 text-white' : 'bg-card border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="bg-card p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {active.fields.map((f) => (
            f.type === 'categories' ? (
              <CategoriesPicker
                key={f.name}
                label={f.label}
                options={vehicleCats.map((c: any) => ({ id: c.id, name: c.name }))}
                value={Array.isArray(form[f.name]) ? form[f.name] : []}
                onChange={(next) => setForm({ ...form, [f.name]: next })}
              />
            ) : f.type === 'accessory_types' ? (
              <CategoriesPicker
                key={f.name}
                label={f.label}
                options={accessoryTypes.map((c: any) => ({ id: c.id, name: c.name }))}
                value={Array.isArray(form[f.name]) ? form[f.name] : []}
                onChange={(next) => setForm({ ...form, [f.name]: next })}
              />
            ) : f.type === 'image' ? (
              <CategoryImagePicker
                key={f.name}
                label={f.label}
                value={form[f.name] ?? ''}
                onChange={(url) => setForm({ ...form, [f.name]: url })}

              />
            ) : f.type === 'accessory_type_single' ? (
              <select
                key={f.name}
                value={form[f.name] ?? ''}
                onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
              >
                <option value="">— Aucun (équipement véhicule) —</option>
                {accessoryTypes.map((t: any) => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
            ) : f.type === 'brand' ? (
              <select
                key={f.name}
                required={f.required}
                value={form[f.name] ?? ''}
                onChange={(e) => setForm({ ...form, [f.name]: e.target.value ? Number(e.target.value) : '' })}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
              >
                <option value="">— {f.label} —</option>
                {brands.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            ) : (
              <input
                key={f.name}
                required={f.required}
                type={f.type === 'number' ? 'number' : 'text'}
                placeholder={f.label}
                value={form[f.name] ?? ''}
                onChange={(e) =>
                  setForm({ ...form, [f.name]: f.type === 'number' ? Number(e.target.value) : e.target.value })
                }
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            )
          ))}
        </div>
        <div className="mt-3 flex justify-end">
          <button
            disabled={create.isPending}
            className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-60"
          >
            <Plus size={14} /> Ajouter
          </button>
        </div>
      </form>

      <AdminTable columns={columns} loading={isLoading} rowCount={filteredRows.length} empty={globalSearch ? 'Aucun résultat.' : 'Aucun élément.'}>
        {filteredRows.map((r) => (
          <tr key={r.id} className="hover:bg-gray-50">
            {active.fields.map((f) => (
              <td key={f.name} className="p-3 text-sm text-gray-800">
                {editingId === r.id ? (
                  f.type === 'categories' ? (
                    <CategoriesPicker
                      compact
                      label={f.label}
                      options={vehicleCats.map((c: any) => ({ id: c.id, name: c.name }))}
                      value={Array.isArray(editForm[f.name]) ? editForm[f.name] : []}
                      onChange={(next) => setEditForm({ ...editForm, [f.name]: next })}
                    />
                  ) : f.type === 'accessory_types' ? (
                    <CategoriesPicker
                      compact
                      label={f.label}
                      options={accessoryTypes.map((c: any) => ({ id: c.id, name: c.name }))}
                      value={Array.isArray(editForm[f.name]) ? editForm[f.name] : []}
                      onChange={(next) => setEditForm({ ...editForm, [f.name]: next })}
                    />
                  ) : f.type === 'image' ? (
                    <CategoryImagePicker
                      label={f.label}
                      value={editForm[f.name] ?? ''}
                      onChange={(url) => setEditForm({ ...editForm, [f.name]: url })}

                    />
                  ) : f.type === 'accessory_type_single' ? (
                    <select
                      value={editForm[f.name] ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, [f.name]: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-200 rounded text-sm bg-white"
                    >
                      <option value="">—</option>
                      {accessoryTypes.map((t: any) => (
                        <option key={t.id} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                  ) : f.type === 'brand' ? (
                    <select
                      value={editForm[f.name] ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, [f.name]: e.target.value ? Number(e.target.value) : '' })}
                      className="w-full px-2 py-1 border border-gray-200 rounded text-sm bg-white"
                    >
                      <option value="">—</option>
                      {brands.map((b: any) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={f.type === 'number' ? 'number' : 'text'}
                      value={editForm[f.name] ?? ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, [f.name]: f.type === 'number' ? Number(e.target.value) : e.target.value })
                      }
                      className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
                    />
                  )
                ) : (
                  (f.type === 'categories' || f.type === 'accessory_types') ? (
                    Array.isArray(r[f.name]) && r[f.name].length ? (
                      <div className="flex flex-wrap gap-1">
                        {r[f.name].map((c: string) => (
                          <span key={c} className="px-2 py-0.5 bg-primary-50 text-primary-700 text-[11px] font-bold rounded-full border border-primary-100">{c}</span>
                        ))}
                      </div>
                    ) : <span className="text-gray-400">—</span>
                  ) : f.type === 'image' ? (
                    r[f.name]
                      ? <img src={r[f.name]} alt="" className="w-12 h-12 object-cover rounded-lg border border-gray-200" />
                      : <span className="text-gray-400">—</span>
                  ) : f.type === 'accessory_type_single' ? (
                    r[f.name]
                      ? <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[11px] font-bold rounded-full border border-amber-100">{String(r[f.name])}</span>
                      : <span className="text-gray-400">—</span>
                  ) : f.type === 'brand'
                    ? (r.brand_name || brands.find((b: any) => String(b.id) === String(r[f.name]))?.name || String(r[f.name] ?? '—'))
                    : String(r[f.name] ?? '—')
                )}
              </td>
            ))}
            <td className="p-3 text-right">
              <div className="flex items-center justify-end gap-1">
                {editingId === r.id ? (
                  <>
                    <button onClick={saveEdit} className="p-2 text-green-600 hover:bg-green-50 rounded-lg"><Check size={14} /></button>
                    <button onClick={() => setEditingId(null)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"><X size={14} /></button>
                  </>
                ) : (
                  <button onClick={() => startEdit(r)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit3 size={14} /></button>
                )}
                <button onClick={() => del(r.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>
      {confirmDialog}
    </div>
  );
};

export default ReferenceTab;

/**
 * Compact multi-select used to attach a brand to one or more vehicle
 * categories. Renders a row of toggleable chips — far friendlier than a
 * native multi-<select> for a 4-5 option list and matches the rest of
 * the admin design language.
 */
const CategoriesPicker: React.FC<{
  label: string;
  options: { id: number | string; name: string }[];
  value: string[];
  onChange: (next: string[]) => void;
  compact?: boolean;
}> = ({ label, options, value, onChange, compact }) => {
  const toggle = (opt: string) => {
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  };
  return (
    <div className={compact ? 'col-span-1' : 'md:col-span-3'}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
          {label}
          {value.length > 0 && (
            <span className="ml-2 normal-case tracking-normal text-primary-600">
              ({value.length} sélectionnée{value.length > 1 ? 's' : ''})
            </span>
          )}
        </div>
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-[11px] font-bold text-red-600 hover:text-red-700 hover:underline"
          >
            Tout effacer
          </button>
        )}
      </div>
      {options.length === 0 ? (
        <div className="text-xs text-gray-400 italic">Aucune catégorie disponible — créez-en une dans l'onglet "Catégories véhicules".</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {options.map((opt) => {
            const isActive = value.includes(opt.name);
            return (
              <button
                type="button"
                key={opt.id}
                onClick={() => toggle(opt.name)}
                title={`ID: ${opt.id}`}
                className={`px-2.5 py-1 rounded-full text-[12px] font-bold border transition-colors inline-flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300 hover:text-primary-600'
                }`}
              >
                <span className={`text-[10px] font-mono px-1 rounded ${isActive ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>#{opt.id}</span>
                {opt.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
