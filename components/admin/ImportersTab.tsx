/**
 * ImportersTab — admin CRUD for "Importateurs" (brand importers/distributors).
 *
 * Each tech_specs row can be linked to one importer (see TechSpecsTab).
 * The public fiche-technique details page renders the assigned importer's
 * contact card dynamically.
 */
import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, Trash2, Edit3, X, BarChart3, Phone, FileText, Scale } from 'lucide-react';
import { adminApi } from '../../services/adminApi';
import { useToast } from '../../context/ToastContext';
import { AdminTable } from './AdminPrimitives';
import { useConfirm } from './ConfirmDialog';
import AdminImageUpload from './AdminImageUpload';
import { displayPhone } from '../../utils/phoneUtils';
import { ImporterLeadsPanel, WhatsappIcon } from './ImporterLeadsPanel';
import { subscriptionStatus, extendSubscription, daysLeft } from '../../utils/importerSubscription';

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
  /** Abonnement: last day (YYYY-MM-DD), '' = none. */
  subscription_until: string;
}

const empty = (): ImporterForm => ({
  name: '', logo_url: '', address: '', city: '', phone: '', whatsapp: '',
  email: '', website: '', description: '', rating: '', is_active: true, subscription_until: '',
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

  // Contacts of the last 30 days for every importer (one request).
  const { data: leads } = useQuery({
    queryKey: ['admin', 'leads', 'summary', 30],
    queryFn: ({ signal }) => adminApi.getLeadsSummary(30, signal),
    staleTime: 60_000,
    retry: false,
  });
  const leadsById = useMemo(() => new Map((leads?.importers || []).map((r) => [r.id, r])), [leads]);
  const [statsFor, setStatsFor] = useState<{ id: string; name: string; opener: HTMLElement | null } | null>(null);
  // Header line: who pays, whose subscription ends soon, what the site brought this month.
  const overview = useMemo(() => {
    const rows = leads?.importers || [];
    const subs = importers.map((i: any) => subscriptionStatus(i.subscription_until));
    return {
      active: subs.filter((x) => x.tone === 'on' || x.tone === 'soon').length,
      soon: subs.filter((x) => x.tone === 'soon').length,
      contacts: rows.reduce((t, r) => t + r.calls + r.whatsapp_taps + r.quotes + r.compares, 0),
      quotes: rows.reduce((t, r) => t + r.quotes, 0),
      ready: !!leads,
    };
  }, [importers, leads]);

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
    subscription_until: f.subscription_until || null,
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
      subscription_until: i.subscription_until ? String(i.subscription_until).slice(0, 10) : '',
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

      {/* What matters for the subscriptions, at a glance. */}
      <dl className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Abonnés actifs', overview.active],
          ['Expirent sous 14 jours', overview.soon],
          ['Contacts (30 jours)', overview.ready ? overview.contacts : '—'],
          ['Demandes de devis (30 jours)', overview.ready ? overview.quotes : '—'],
        ].map(([label, value]) => (
          <div key={label as string} className="bg-white rounded-xl border border-slate-200 px-4 py-3">
            <dt className="text-[11px] font-bold text-slate-500">{label}</dt>
            <dd className={`mt-0.5 text-2xl font-black tabular-nums ${label === 'Expirent sous 14 jours' && Number(value) > 0 ? 'text-amber-700' : 'text-slate-900'}`}>{value}</dd>
          </div>
        ))}
      </dl>

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

          {/* Abonnement: the date decides whether its fiches show Appel,
              WhatsApp and Devis; quick buttons for the usual durations. */}
          <fieldset className="rounded-xl border border-slate-200 p-4">
            <legend className="px-1 text-[11px] font-bold text-slate-600">Abonnement</legend>
            <div className="flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="block text-[11px] font-bold text-slate-600 mb-1">Fin d'abonnement</span>
                <input type="date" value={form.subscription_until} onChange={(e) => setForm({ ...form, subscription_until: e.target.value })} className={`${inputCls} w-44`} />
              </label>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Prolonger l'abonnement">
                {[[1, '+1 mois'], [3, '+3 mois'], [12, '+1 an']].map(([m, label]) => (
                  <button key={m} type="button" onClick={() => setForm({ ...form, subscription_until: extendSubscription(form.subscription_until, m as number) })} className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50">{label}</button>
                ))}
                {form.subscription_until && (
                  <button type="button" onClick={() => setForm({ ...form, subscription_until: '' })} className="px-3 py-2 rounded-lg text-xs font-bold text-red-700 hover:bg-red-50">Retirer</button>
                )}
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              {(() => {
                const st = subscriptionStatus(form.subscription_until);
                return st.tone === 'none'
                  ? "Pas d'abonnement : ses fiches n'affichent pas les boutons Appel, WhatsApp et Devis."
                  : st.tone === 'off'
                    ? `${st.label} : les boutons Appel, WhatsApp et Devis ne s'affichent plus.`
                    : `Boutons Appel, WhatsApp et Devis affichés sur ses fiches jusqu'au ${st.label.replace(/^(Jusqu'au|Expire le) /, '')} inclus.`;
              })()}
            </p>
          </fieldset>

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

      {statsFor && (
        <ImporterLeadsPanel key={statsFor.id} importerId={statsFor.id} importerName={statsFor.name} returnFocus={statsFor.opener} onClose={() => setStatsFor(null)} />
      )}

      <AdminTable
        columns={['Importateur', 'Contact', 'Abonnement', 'Contacts (30 j)', 'Actions']}
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
                  {/* City, rating and « Inactif » under the name: two columns
                      fewer, the counters and the « Rapport » button fit. */}
                  <p className="text-[11px] text-slate-500">
                    {[i.city, i.rating != null ? `★ ${Number(i.rating).toFixed(1)}` : ''].filter(Boolean).join(' · ') || '—'}
                    {!i.is_active && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-bold">Inactif</span>}
                  </p>
                </div>
              </div>
            </td>
            <td className="p-3 text-xs text-slate-600">
              {i.phone && <div>{displayPhone(i.phone)}</div>}
              {i.email && <div className="text-slate-400">{i.email}</div>}
            </td>
            <td className="p-3 text-xs">
              {(() => {
                const st = subscriptionStatus(i.subscription_until);
                const left = daysLeft(i.subscription_until);
                return (
                  <div className="space-y-0.5">
                    <span className={`inline-block px-2 py-0.5 rounded font-bold whitespace-nowrap ${st.tone === 'on' ? 'bg-emerald-100 text-emerald-800' : st.tone === 'soon' ? 'bg-amber-100 text-amber-800' : st.tone === 'off' ? 'bg-slate-200 text-slate-700' : 'text-slate-500'}`}>
                      {st.tone === 'on' || st.tone === 'soon' ? 'Abonné' : st.tone === 'off' ? 'Expiré' : 'Aucun'}
                    </span>
                    {st.tone !== 'none' && (
                      <p className="text-[11px] text-slate-500 whitespace-nowrap tabular-nums">
                        {st.tone === 'off' ? st.label.replace('Expiré le', 'le') : `${st.label.replace(/^(Jusqu'au|Expire le)/, "jusqu'au")} · ${left} j`}
                      </p>
                    )}
                  </div>
                );
              })()}
            </td>
            <td className="p-3 text-xs text-slate-700">
              {(() => {
                const r = leadsById.get(i.id);
                if (!r) return <span className="text-slate-400">—</span>;
                const items: [React.ReactNode, number, string][] = [
                  [<Phone size={13} aria-hidden="true" />, r.calls, 'appels'],
                  [<WhatsappIcon size={13} />, r.whatsapp_taps, 'WhatsApp'],
                  [<FileText size={13} aria-hidden="true" />, r.quotes, 'devis'],
                  [<Scale size={13} aria-hidden="true" />, r.compares, 'comparaisons'],
                ];
                return (
                  <ul className="flex items-center gap-3" aria-label="Contacts des 30 derniers jours">
                    {items.map(([icon, n, label]) => (
                      <li key={label} className={`inline-flex items-center gap-1 tabular-nums ${n ? 'text-slate-900 font-bold' : 'text-slate-300'}`} title={`${n} ${label}`}>
                        {icon}<span>{n}</span><span className="sr-only">{label}</span>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </td>
            <td className="p-3 text-right">
              <div className="flex items-center justify-end gap-1">
                <button onClick={(e) => setStatsFor({ id: i.id, name: i.name, opener: e.currentTarget })} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 mr-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50" aria-label={`Rapport de ${i.name}`}><BarChart3 size={14} aria-hidden="true" />Rapport</button>
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