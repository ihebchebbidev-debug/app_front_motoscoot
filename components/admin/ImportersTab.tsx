/**
 * ImportersTab — admin CRUD for "Importateurs" (brand importers/distributors).
 *
 * Each tech_specs row can be linked to one importer (see TechSpecsTab).
 * The public fiche-technique details page renders the assigned importer's
 * contact card dynamically.
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, Trash2, Edit3, X } from 'lucide-react';
import { adminApi } from '../../services/adminApi';
import { useToast } from '../../context/ToastContext';
import { AdminTable } from './AdminPrimitives';
import { useConfirm } from './ConfirmDialog';
import AdminImageUpload from './AdminImageUpload';
import { displayPhone } from '../../utils/phoneUtils';

interface ImporterForm {
  id?: string;
  name: string;
  logo_url: string;
  address: string;
  city: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  description: string;
  rating: string;
  is_active: boolean;
}

const empty = (): ImporterForm => ({
  name: '', logo_url: '', address: '', city: '', phone: '', whatsapp: '',
  email: '', website: '', description: '', rating: '', is_active: true,
});

const inputCls =
  'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-200 outline-none';

const Field: React.FC<{ label: string; children: React.ReactNode; hint?: string }> = ({ label, children, hint }) => (
  <label className="block">
    <span className="block text-[11px] font-bold text-slate-600 mb-1">{label}</span>
    {children}
    {hint && <span className="block text-[10px] text-slate-400 mt-0.5">{hint}</span>}
  </label>
);

const ImportersTab: React.FC = () => {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { confirm, dialog } = useConfirm();

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ImporterForm>(empty());

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'importers', search],
    queryFn: ({ signal }) => adminApi.getImporters({ search: search || undefined }, signal),
    staleTime: 30_000,
  });
  const importers = data?.importers || [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'importers'] });
    qc.invalidateQueries({ queryKey: ['importers'] });
    // Importer changes may affect the dynamic dealer card on tech-spec details.
    qc.invalidateQueries({ queryKey: ['tech-spec'] });
    qc.invalidateQueries({ queryKey: ['tech-specs'] });
  };

  const buildPayload = (f: ImporterForm) => ({
    name: f.name.trim(),
    logo_url: f.logo_url || null,
    address: f.address || null,
    city: f.city || null,
    phone: f.phone || null,
    whatsapp: f.whatsapp || null,
    email: f.email || null,
    website: f.website || null,
    description: f.description || null,
    rating: f.rating ? Number(f.rating) : null,
    is_active: !!f.is_active,
  });

  const create = useMutation({
    mutationFn: (payload: any) => adminApi.createImporter(payload),
    onSuccess: () => { invalidate(); setShowForm(false); setForm(empty()); addToast('Importateur créé', 'success'); },
    onError: (e: any) => addToast(e?.message || 'Erreur', 'error'),
  });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => adminApi.updateImporter(id, payload),
    onSuccess: () => { invalidate(); setShowForm(false); setForm(empty()); addToast('Importateur mis à jour', 'success'); },
    onError: (e: any) => addToast(e?.message || 'Erreur', 'error'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => adminApi.deleteImporter(id),
    onSuccess: () => { invalidate(); addToast('Importateur supprimé', 'success'); },
    onError: (e: any) => addToast(e?.message || 'Erreur', 'error'),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { addToast('Le nom est requis', 'error'); return; }
    const payload = buildPayload(form);
    if (form.id) update.mutate({ id: form.id, payload });
    else create.mutate(payload);
  };

  const startEdit = (i: any) => {
    setForm({
      id: i.id,
      name: i.name || '',
      logo_url: i.logo_url || '',
      address: i.address || '',
      city: i.city || '',
      phone: i.phone || '',
      whatsapp: i.whatsapp || '',
      email: i.email || '',
      website: i.website || '',
      description: i.description || '',
      rating: i.rating != null ? String(i.rating) : '',
      is_active: i.is_active !== false,
    });
    setShowForm(true);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const del = async (id: string, name: string) => {
    if (await confirm({
      title: `Supprimer "${name}" ?`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
    })) remove.mutate(id);
  };

  const submitting = create.isPending || update.isPending;
  const isEditing = !!form.id;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
          <Building2 size={20} /> Importateurs
        </h2>
        <button
          onClick={() => { setForm(empty()); setShowForm((s) => !s); }}
          className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-bold"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Fermer' : 'Nouvel importateur'}
        </button>
      </div>

      <p className="text-[12px] text-slate-500">
        Gérez les importateurs/distributeurs officiels. Chaque fiche technique peut être assignée à un importateur — sa carte de contact apparaîtra automatiquement sur la page publique du modèle.
      </p>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher par nom, ville, email…"
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
      />

      {showForm && (
        <form onSubmit={submit} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Nom *">
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="Moto Kingdom Tunis" />
            </Field>
            <Field label="Ville">
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={inputCls} placeholder="Tunis" />
            </Field>
            <Field label="Note (sur 5)">
              <input type="number" step="0.1" min="0" max="5" value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} className={inputCls} placeholder="4.2" />
            </Field>
          </div>

          <Field label="Adresse complète">
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputCls} placeholder="123 Avenue de Carthage, Tunis 1000" />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Téléphone">
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} placeholder="+216 71 123 456" />
            </Field>
            <Field label="WhatsApp">
              <input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className={inputCls} placeholder="+216 22 123 456" />
            </Field>
            <Field label="Email">
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} placeholder="contact@motokingdom.tn" />
            </Field>
          </div>

          <Field label="Site web">
            <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className={inputCls} placeholder="https://motokingdom.tn" />
          </Field>

          <Field label="Description (optionnel)">
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} />
          </Field>

          <AdminImageUpload
            label="Logo de l'importateur"
            value={form.logo_url}
            onChange={(url) => setForm({ ...form, logo_url: url })}
          />

          <label className="flex items-center gap-2 text-[12px] font-bold text-slate-700">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            Actif (disponible pour assignation)
          </label>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={() => { setShowForm(false); setForm(empty()); }} className="px-4 py-2 rounded-lg border text-sm font-bold">Annuler</button>
            <button disabled={submitting} className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold disabled:opacity-60">
              {submitting ? '…' : isEditing ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      )}

      <AdminTable
        columns={['Importateur', 'Ville', 'Contact', 'Statut', 'Actions']}
        loading={isLoading}
        rowCount={importers.length}
        empty="Aucun importateur."
      >
        {importers.map((i: any) => (
          <tr key={i.id} className="hover:bg-slate-50 align-top">
            <td className="p-3">
              <div className="flex items-start gap-3">
                {i.logo_url ? (
                  <img src={i.logo_url} alt="" className="w-12 h-12 object-contain border border-slate-200 rounded-lg p-1 bg-white shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                    <Building2 size={18} />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 line-clamp-1">{i.name}</p>
                  {i.rating != null && (
                    <p className="text-[11px] text-slate-500">★ {Number(i.rating).toFixed(1)} · {i.reviews_count || 0} avis</p>
                  )}
                </div>
              </div>
            </td>
            <td className="p-3 text-sm">{i.city || '—'}</td>
            <td className="p-3 text-xs text-slate-600">
              {i.phone && <div>{displayPhone(i.phone)}</div>}
              {i.email && <div className="text-slate-400">{i.email}</div>}
            </td>
            <td className="p-3 text-xs">
              <span className={`px-2 py-0.5 rounded font-bold ${i.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                {i.is_active ? 'Actif' : 'Inactif'}
              </span>
            </td>
            <td className="p-3 text-right">
              <div className="flex items-center justify-end gap-1">
                <button onClick={() => startEdit(i)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" aria-label="Modifier"><Edit3 size={14} /></button>
                <button onClick={() => del(i.id, i.name)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" aria-label="Supprimer"><Trash2 size={14} /></button>
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>
      {dialog}
    </div>
  );
};

export default ImportersTab;