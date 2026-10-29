/**
 * TipsTab — admin CRUD for "Conseils" (guides / how-tos).
 *
 * Mirrors ArticlesTab in DX & layout, but exposes the extra fields specific
 * to a guide:
 *   • Difficulté (Débutant / Intermédiaire / Expert)
 *   • Temps de lecture (read_time, e.g. "6 min")
 *   • Matériel requis (tools[], CSV in form, normalized to string[])
 *
 * Backed by:
 *   GET    /admin/tips
 *   POST   /admin/tips
 *   PUT    /admin/tips/:id
 *   DELETE /admin/tips/:id
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Lightbulb, Plus, Trash2, Edit3, Eye, EyeOff, X, Wrench, Clock, Gauge } from 'lucide-react';
import { adminApi } from '../../services/adminApi';
import { useToast } from '../../context/ToastContext';
import { AdminTable } from './AdminPrimitives';
import { useConfirm } from './ConfirmDialog';
import AdminImageUpload from './AdminImageUpload';
import RichTextEditor, { sanitizeRichHtml } from './RichTextEditor';

const TIP_CATEGORIES = ['Entretien', 'Sécurité', 'Équipement', 'Conduite', 'Législation'];
const TIP_DIFFICULTIES = ['Débutant', 'Intermédiaire', 'Expert'];

interface TipForm {
  id?: number | string;
  title: string;
  slug: string;
  category: string;
  difficulty: string;
  read_time: string;     // free-form ("6 min")
  tools: string;         // CSV → string[]
  summary: string;
  content: string;
  image: string;
  is_published: boolean;
}

const emptyForm = (): TipForm => ({
  title: '', slug: '', category: 'Entretien', difficulty: 'Débutant',
  read_time: '6', tools: '', summary: '', content: '', image: '',
  is_published: true,
});

const slugify = (s: string) =>
  s.toLowerCase()
   .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
   .replace(/[^a-z0-9]+/g, '-')
   .replace(/^-|-$/g, '')
   .slice(0, 80);

const diffBadgeClass = (d: string) => {
  if (d === 'Débutant') return 'bg-green-50 text-green-700';
  if (d === 'Expert')   return 'bg-red-50 text-red-700';
  return 'bg-amber-50 text-amber-700';
};

export const TipsTab: React.FC = () => {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { confirm, dialog } = useConfirm();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'published' | 'draft'>('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TipForm>(emptyForm());

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'tips', search, statusFilter],
    queryFn: ({ signal }) => adminApi.getTips(
      { search: search || undefined, status: statusFilter || undefined, limit: 100 },
      signal,
    ),
    staleTime: 30_000,
  });
  const tips = data?.tips || [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'tips'] });
    // The public /conseils page also uses the 'tips' key — refresh it too so
    // newly published guides appear immediately without a hard reload.
    qc.invalidateQueries({ queryKey: ['tips'] });
  };

  const create = useMutation({
    mutationFn: (payload: any) => adminApi.createTip(payload),
    onSuccess: () => { invalidate(); setForm(emptyForm()); setShowForm(false); addToast('Conseil créé', 'success'); },
    onError: (e: any) => addToast(e?.message || 'Erreur', 'error'),
  });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: any; payload: any }) => adminApi.updateTip(id, payload),
    onSuccess: () => { invalidate(); setForm(emptyForm()); setShowForm(false); addToast('Conseil mis à jour', 'success'); },
    onError: (e: any) => addToast(e?.message || 'Erreur', 'error'),
  });
  const remove = useMutation({
    mutationFn: (id: any) => adminApi.deleteTip(id),
    onSuccess: () => { invalidate(); addToast('Conseil supprimé', 'success'); },
    onError: (e: any) => addToast(e?.message || 'Erreur', 'error'),
  });

  const buildPayload = (f: TipForm) => ({
    title: f.title,
    slug: f.slug || slugify(f.title),
    category: f.category,
    difficulty: f.difficulty,
    // Keep read_time as a string ("6 min") — schema is VARCHAR(20).
    // If user typed only a number, suffix " min" automatically.
    read_time: /^\d+$/.test(String(f.read_time).trim())
      ? `${String(f.read_time).trim()} min`
      : (f.read_time || undefined),
    tools: f.tools ? f.tools.split(',').map((t) => t.trim()).filter(Boolean) : [],
    summary: f.summary || undefined,
    content: f.content ? sanitizeRichHtml(f.content) : undefined,
    image: f.image || undefined,
    is_published: !!f.is_published,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { addToast('Titre requis', 'error'); return; }
    const payload = buildPayload(form);
    if (form.id != null) update.mutate({ id: form.id, payload });
    else create.mutate(payload);
  };

  const startEdit = (t: any) => {
    setForm({
      id: t.id,
      title: t.title || '',
      slug: t.slug || '',
      category: t.category || 'Entretien',
      difficulty: t.difficulty || 'Débutant',
      // read_time may come back as "6 min" or "6" — keep as-is so admin can re-edit.
      read_time: t.read_time != null ? String(t.read_time) : '6',
      tools: Array.isArray(t.tools) ? t.tools.join(', ') : '',
      summary: t.summary || '',
      content: t.content || '',
      image: t.image || t.cover_image || '',
      is_published: t.is_published !== false,
    });
    setShowForm(true);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const togglePublish = (t: any) =>
    update.mutate({ id: t.id, payload: { is_published: !t.is_published } });

  const del = async (id: any) => {
    if (await confirm({ title: 'Supprimer ce conseil ?', confirmLabel: 'Supprimer', variant: 'danger' })) {
      remove.mutate(id);
    }
  };

  const isEditing = form.id != null;
  const submitting = create.isPending || update.isPending;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
          <Lightbulb size={20} /> Conseils
        </h2>
        <button
          onClick={() => { setForm(emptyForm()); setShowForm((s) => !s); }}
          className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-bold"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Fermer' : 'Nouveau conseil'}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Titre, slug, contenu, catégorie, outils…"
          className="flex-1 min-w-[200px] px-3 py-2 border border-slate-200 rounded-lg text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
        >
          <option value="">Tous statuts</option>
          <option value="published">Publiés</option>
          <option value="draft">Brouillons</option>
        </select>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              required
              value={form.title}
              onChange={(e) => {
                const title = e.target.value;
                setForm((f) => ({ ...f, title, slug: f.slug || slugify(title) }));
              }}
              placeholder="Titre"
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
            <input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
              placeholder="Slug (auto)"
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
            />
          </div>

          {/* "En bref" — Catégorie / Difficulté / Temps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <label className="block">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Catégorie</span>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              >
                {TIP_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block flex items-center gap-1.5"><Gauge size={11}/> Difficulté</span>
              <select
                value={form.difficulty}
                onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              >
                {TIP_DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block flex items-center gap-1.5"><Clock size={11}/> Temps (min)</span>
              <input
                value={form.read_time}
                onChange={(e) => setForm({ ...form, read_time: e.target.value })}
                placeholder="ex: 6"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              />
            </label>
          </div>

          {/* Matériel requis */}
          <label className="block">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Wrench size={11}/> Matériel requis
            </span>
            <input
              value={form.tools}
              onChange={(e) => setForm({ ...form, tools: e.target.value })}
              placeholder="ex: Mainteneur batterie, Stabilisateur, Housse"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              Séparez chaque outil par une virgule.
            </span>
          </label>

          <AdminImageUpload
            label="Image de couverture"
            value={form.image}
            onChange={(url) => setForm({ ...form, image: url })}
          />

          <textarea
            value={form.summary}
            onChange={(e) => setForm({ ...form, summary: e.target.value })}
            placeholder="Résumé (1-2 phrases)"
            rows={2}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
          />

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700">Contenu du conseil</label>
              <span className="text-[10px] text-slate-400">
                Mise en forme (gras, titres, listes…) — rendu identique à la page publique.
              </span>
            </div>
            <RichTextEditor
              value={form.content}
              onChange={(html) => setForm({ ...form, content: html })}
              placeholder="Rédigez votre guide étape par étape…"
              minHeight={320}
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} />
              Publié
            </label>
            <div className="flex-1" />
            <button type="button" onClick={() => { setShowForm(false); setForm(emptyForm()); }} className="px-4 py-2 rounded-lg border text-sm font-bold">
              Annuler
            </button>
            <button disabled={submitting} className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold disabled:opacity-60">
              {submitting ? '…' : isEditing ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      )}

      <AdminTable
        columns={['Conseil', 'Catégorie', 'Difficulté', 'Statut', 'Actions']}
        loading={isLoading}
        rowCount={tips.length}
        empty="Aucun conseil."
      >
        {tips.map((t: any) => (
          <tr key={t.id} className="hover:bg-slate-50 align-top">
            <td className="p-3">
              <div className="flex items-start gap-3">
                {t.image ? (
                  <img src={t.image} alt="" className="w-14 h-14 object-cover rounded-lg shrink-0 border border-slate-200" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                    <Lightbulb size={18} />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 line-clamp-1">{t.title}</p>
                  <p className="text-[11px] font-mono text-slate-500 truncate">/{t.slug}</p>
                  {t.read_time && (
                    <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                      <Clock size={10} /> {String(t.read_time).match(/min/i) ? t.read_time : `${t.read_time} min`}
                    </p>
                  )}
                  {Array.isArray(t.tools) && t.tools.length > 0 && (
                    <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 flex items-center gap-1">
                      <Wrench size={10} /> {t.tools.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            </td>
            <td className="p-3 text-xs">
              <span className="px-2 py-0.5 bg-slate-100 rounded font-bold text-slate-700">{t.category}</span>
            </td>
            <td className="p-3 text-xs">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-bold ${diffBadgeClass(t.difficulty)}`}>
                {t.difficulty || '—'}
              </span>
            </td>
            <td className="p-3">
              <button
                onClick={() => togglePublish(t)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  t.is_published ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {t.is_published ? <Eye size={11} /> : <EyeOff size={11} />}
                {t.is_published ? 'Publié' : 'Brouillon'}
              </button>
            </td>
            <td className="p-3 text-right">
              <div className="flex items-center justify-end gap-1">
                <button onClick={() => startEdit(t)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit3 size={14} /></button>
                <button onClick={() => del(t.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>
      {dialog}
    </div>
  );
};

export default TipsTab;
