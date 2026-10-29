/**
 * ArticlesTab — admin CRUD for "Actualités" (articles).
 *
 * Lets admins create, edit, publish/unpublish, feature, and delete articles
 * with image upload, tags, category, and read time. Backed by:
 *   GET    /admin/articles
 *   POST   /admin/articles
 *   PUT    /admin/articles/:id
 *   DELETE /admin/articles/:id
 */
import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Trash2, Edit3, Star, Eye, EyeOff, X } from 'lucide-react';
import { adminApi } from '../../services/adminApi';
import { useToast } from '../../context/ToastContext';
import { AdminTable } from './AdminPrimitives';
import { useConfirm } from './ConfirmDialog';
import AdminImageUpload from './AdminImageUpload';
import RichTextEditor, { sanitizeRichHtml } from './RichTextEditor';

const ARTICLE_CATEGORIES = ['Nouveautés', 'Essais', 'Tech', 'Scooters', 'Électrique'];

interface ArticleForm {
  id?: number | string;
  title: string;
  slug: string;
  category: string;
  summary: string;
  content: string;
  image: string;
  tags: string;     // CSV in form, normalized to string[] before submit
  read_time: number;
  is_featured: boolean;
  is_published: boolean;
}

const emptyForm = (): ArticleForm => ({
  title: '', slug: '', category: 'Nouveautés', summary: '', content: '',
  image: '', tags: '', read_time: 5, is_featured: false, is_published: true,
});

const slugify = (s: string) =>
  s.toLowerCase()
   .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
   .replace(/[^a-z0-9]+/g, '-')
   .replace(/^-|-$/g, '')
   .slice(0, 80);

export const ArticlesTab: React.FC = () => {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { confirm, dialog } = useConfirm();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'published' | 'draft'>('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ArticleForm>(emptyForm());

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'articles', search, statusFilter],
    queryFn: ({ signal }) => adminApi.getArticles(
      { search: search || undefined, status: statusFilter || undefined, limit: 100 },
      signal,
    ),
    staleTime: 30_000,
  });
  const articles = data?.articles || [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'articles'] });

  const create = useMutation({
    mutationFn: (payload: any) => adminApi.createArticle(payload),
    onSuccess: () => { invalidate(); setForm(emptyForm()); setShowForm(false); addToast('Article créé', 'success'); },
    onError: (e: any) => addToast(e?.message || 'Erreur', 'error'),
  });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: any; payload: any }) => adminApi.updateArticle(id, payload),
    onSuccess: () => { invalidate(); setForm(emptyForm()); setShowForm(false); addToast('Article mis à jour', 'success'); },
    onError: (e: any) => addToast(e?.message || 'Erreur', 'error'),
  });
  const remove = useMutation({
    mutationFn: (id: any) => adminApi.deleteArticle(id),
    onSuccess: () => { invalidate(); addToast('Article supprimé', 'success'); },
    onError: (e: any) => addToast(e?.message || 'Erreur', 'error'),
  });

  const buildPayload = (f: ArticleForm) => ({
    title: f.title,
    slug: f.slug || slugify(f.title),
    category: f.category,
    summary: f.summary || undefined,
    // Re-sanitize on submit as a defence-in-depth — the editor already
    // sanitizes on every keystroke, but this guards against a payload edited
    // outside the editor (e.g. through devtools).
    content: f.content ? sanitizeRichHtml(f.content) : undefined,
    image: f.image || undefined,
    tags: f.tags ? f.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    read_time: Number(f.read_time) || 5,
    is_featured: !!f.is_featured,
    is_published: !!f.is_published,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { addToast('Titre requis', 'error'); return; }
    const payload = buildPayload(form);
    if (form.id != null) update.mutate({ id: form.id, payload });
    else create.mutate(payload);
  };

  const startEdit = (a: any) => {
    setForm({
      id: a.id,
      title: a.title || '',
      slug: a.slug || '',
      category: a.category || 'Nouveautés',
      summary: a.summary || '',
      content: a.content || '',
      image: a.image || a.cover_image || '',
      tags: Array.isArray(a.tags) ? a.tags.join(', ') : '',
      read_time: a.read_time || 5,
      is_featured: !!a.is_featured,
      is_published: a.is_published !== false,
    });
    setShowForm(true);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const togglePublish = (a: any) =>
    update.mutate({ id: a.id, payload: { is_published: !a.is_published } });
  const toggleFeatured = (a: any) =>
    update.mutate({ id: a.id, payload: { is_featured: !a.is_featured } });

  const del = async (id: any) => {
    if (await confirm({ title: 'Supprimer cet article ?', confirmLabel: 'Supprimer', variant: 'danger' })) {
      remove.mutate(id);
    }
  };

  const isEditing = form.id != null;
  const submitting = create.isPending || update.isPending;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
          <FileText size={20} /> Actualités
        </h2>
        <button
          onClick={() => { setForm(emptyForm()); setShowForm((s) => !s); }}
          className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-bold"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Fermer' : 'Nouvel article'}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Titre, slug, résumé, contenu, catégorie…"
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
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
            >
              {ARTICLE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              type="number"
              min={1}
              value={form.read_time}
              onChange={(e) => setForm({ ...form, read_time: Number(e.target.value) })}
              placeholder="Temps de lecture (min)"
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>

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
              <label className="text-xs font-bold text-slate-700">Contenu de l'article</label>
              <span className="text-[10px] text-slate-400">
                Mise en forme (gras, titres, couleurs, listes…) — rendu identique à la page publique.
              </span>
            </div>
            <RichTextEditor
              value={form.content}
              onChange={(html) => setForm({ ...form, content: html })}
              placeholder="Rédigez votre article…"
              minHeight={320}
            />
            {/* Live preview — uses the EXACT same prose classes as
                components/ArticleDetails.tsx so the admin sees the final
                landing-page typography while editing. */}
            <details className="mt-3 group">
              <summary className="cursor-pointer text-[11px] font-bold text-slate-600 hover:text-primary-600 select-none">
                👁 Aperçu (vue utilisateur sur la landing page)
              </summary>
              <div className="mt-2 p-5 md:p-8 rounded-xl border border-slate-200 bg-white">
                <article
                  className="prose prose-lg prose-slate max-w-none
                    prose-headings:font-black prose-headings:text-gray-900 prose-headings:tracking-tight
                    prose-h2:text-2xl md:prose-h2:text-4xl prose-h2:mt-12 prose-h2:mb-5
                    prose-h3:text-xl md:prose-h3:text-2xl prose-h3:mt-8 prose-h3:mb-3
                    prose-p:text-gray-600 prose-p:leading-[1.75] prose-p:mb-5 md:prose-p:mb-8
                    prose-a:text-primary-600 prose-a:font-black prose-a:no-underline hover:prose-a:underline
                    prose-img:rounded-[1rem] md:prose-img:rounded-[2rem] prose-img:shadow-lg prose-img:my-8
                    prose-blockquote:border-l-[4px] prose-blockquote:border-primary-600 prose-blockquote:bg-gray-50 prose-blockquote:py-5 prose-blockquote:px-6 md:prose-blockquote:px-10 prose-blockquote:rounded-r-2xl prose-blockquote:italic prose-blockquote:text-gray-800 prose-blockquote:font-bold prose-blockquote:my-8"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeRichHtml(form.content || '<p class="text-slate-400 italic">Aucun contenu pour le moment.</p>'),
                  }}
                />
              </div>
            </details>
          </div>
          <input
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            placeholder="Tags (séparés par virgules) — ex: 2026, nouveauté, électrique"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
          />

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} />
              Publié
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} />
              À la une
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
        columns={['Article', 'Catégorie', 'Statut', 'Actions']}
        loading={isLoading}
        rowCount={articles.length}
        empty="Aucun article."
      >
        {articles.map((a: any) => (
          <tr key={a.id} className="hover:bg-slate-50 align-top">
            <td className="p-3">
              <div className="flex items-start gap-3">
                {a.image ? (
                  <img src={a.image} alt="" className="w-14 h-14 object-cover rounded-lg shrink-0 border border-slate-200" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                    <FileText size={18} />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 line-clamp-1">{a.title}</p>
                  <p className="text-[11px] font-mono text-slate-500 truncate">/{a.slug}</p>
                  {a.summary && <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{a.summary}</p>}
                </div>
              </div>
            </td>
            <td className="p-3 text-xs">
              <span className="px-2 py-0.5 bg-slate-100 rounded font-bold text-slate-700">{a.category}</span>
            </td>
            <td className="p-3">
              <div className="flex flex-col items-start gap-1">
                <button
                  onClick={() => togglePublish(a)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    a.is_published ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {a.is_published ? <Eye size={11} /> : <EyeOff size={11} />}
                  {a.is_published ? 'Publié' : 'Brouillon'}
                </button>
                {a.is_featured && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700">
                    <Star size={11} /> À la une
                  </span>
                )}
              </div>
            </td>
            <td className="p-3 text-right">
              <div className="flex items-center justify-end gap-1">
                <button onClick={() => toggleFeatured(a)} title="Mettre à la une" className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg">
                  <Star size={14} fill={a.is_featured ? 'currentColor' : 'none'} />
                </button>
                <button onClick={() => startEdit(a)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit3 size={14} /></button>
                <button onClick={() => del(a.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>
      {dialog}
    </div>
  );
};

export default ArticlesTab;
