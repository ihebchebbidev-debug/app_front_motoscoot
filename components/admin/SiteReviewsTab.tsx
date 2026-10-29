import React, { useState } from 'react';
import { Star, Check, Trash2, X } from 'lucide-react';
import {
  useAdminSiteReviews,
  usePublishSiteReview,
  useDeleteSiteReview,
  useCreateSiteReview,
} from '../../hooks/useAdmin';
import { useToast } from '../../context/ToastContext';
import { AdminTable } from './AdminPrimitives';
import { useConfirm } from './ConfirmDialog';

const AddReviewForm: React.FC<{ onDone: (published: boolean) => void }> = ({ onDone }) => {
  const create = useCreateSiteReview();
  const { addToast } = useToast();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [content, setContent] = useState('');
  const [rating, setRating] = useState(5);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [published, setPublished] = useState(true);
  const input = 'h-10 px-3 rounded-lg border border-gray-200 bg-card text-sm w-full';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || content.trim().length < 5) {
      addToast('Nom et avis (5 caractères min.) obligatoires', 'error');
      return;
    }
    try {
      await create.mutateAsync({ name: name.trim(), role: role.trim() || undefined, content: content.trim(), rating, is_published: published, created_at: date });
      addToast('Avis ajouté', 'success');
      onDone(published);
    } catch (err: any) {
      addToast(err?.message || 'Ajout impossible', 'error');
    }
  };

  return (
    <form onSubmit={submit} className="bg-card rounded-2xl border border-gray-200 p-5 space-y-3 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 text-xs font-bold text-gray-600">Nom du client *
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-gray-600">Rôle / ville
          <input className={input} value={role} onChange={(e) => setRole(e.target.value)} maxLength={100} placeholder="Acheteur, Tunis" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-gray-600">Date
          <input type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Note">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} étoile${n > 1 ? 's' : ''}`}>
            <Star size={22} className={n <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'} />
          </button>
        ))}
      </div>
      <textarea className="w-full min-h-[100px] p-3 rounded-lg border border-gray-200 bg-card text-sm" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Texte de l'avis *" />
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> Publier immédiatement
      </label>
      <button type="submit" disabled={create.isPending} className="px-5 h-10 rounded-lg bg-primary-600 text-white text-sm font-bold disabled:opacity-50">
        {create.isPending ? 'Enregistrement…' : "Enregistrer l'avis"}
      </button>
    </form>
  );
};

export const SiteReviewsTab: React.FC = () => {
  const [tab, setTab] = useState<'pending' | 'published'>('pending');
  const [showForm, setShowForm] = useState(false);
  const { data: reviews = [], isLoading } = useAdminSiteReviews(tab);
  const publish = usePublishSiteReview();
  const remove = useDeleteSiteReview();
  const { addToast } = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const approve = async (id: number | string) => {
    try {
      await publish.mutateAsync({ id, isPublished: true });
      addToast('Avis publié sur le site', 'success');
    } catch (e: any) {
      addToast(e?.message || 'Publication impossible', 'error');
    }
  };

  const unpublish = async (id: number | string) => {
    try {
      await publish.mutateAsync({ id, isPublished: false });
      addToast('Avis dépublié', 'success');
    } catch (e: any) {
      addToast(e?.message || 'Action impossible', 'error');
    }
  };

  const reject = async (id: number | string) => {
    const ok = await confirm({
      title: 'Supprimer cet avis ?',
      message: 'Cette action est définitive.',
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(id);
      addToast('Avis supprimé', 'success');
    } catch (e: any) {
      addToast(e?.message || 'Suppression impossible', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-gray-900">Avis clients</h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 rounded-lg text-sm font-bold bg-primary-600 text-white"
        >
          {showForm ? 'Fermer' : '+ Ajouter un avis'}
        </button>
      </div>

      {showForm && <AddReviewForm onDone={(published) => { setShowForm(false); setTab(published ? 'published' : 'pending'); }} />}

      <div className="flex gap-2">
        {(['pending', 'published'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              tab === t
                ? 'bg-primary-600 text-white'
                : 'bg-card border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {t === 'pending' ? 'En attente' : 'Publiés'}
          </button>
        ))}
      </div>

      <AdminTable
        columns={['Auteur', 'Note', 'Avis', 'Date', 'Actions']}
        loading={isLoading}
        rowCount={reviews.length}
        empty={tab === 'pending' ? 'Aucun avis en attente de modération.' : 'Aucun avis publié pour le moment.'}
      >
        {reviews.map((r) => (
          <tr key={r.id} className="hover:bg-gray-50 transition-colors">
            <td className="p-4">
              <p className="font-bold text-gray-900">{r.name}</p>
              {r.role && <p className="text-xs text-gray-500">{r.role}</p>}
            </td>
            <td className="p-4">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} size={14} className={i <= r.rating ? 'text-warning-400 fill-warning-400' : 'text-gray-200 fill-gray-200'} />
                ))}
              </div>
            </td>
            <td className="p-4 max-w-md">
              <p className="text-sm text-gray-700 line-clamp-3">{r.content}</p>
            </td>
            <td className="p-4 text-xs text-gray-500 whitespace-nowrap">
              {new Date(r.created_at).toLocaleDateString('fr-FR')}
            </td>
            <td className="p-4">
              <div className="flex items-center justify-end gap-2">
                {tab === 'pending' ? (
                  <button
                    onClick={() => approve(r.id)}
                    disabled={publish.isPending}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold disabled:opacity-60"
                  >
                    <Check size={14} /> Approuver
                  </button>
                ) : (
                  <button
                    onClick={() => unpublish(r.id)}
                    disabled={publish.isPending}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-800 text-white text-xs font-bold disabled:opacity-60"
                  >
                    <X size={14} /> Dépublier
                  </button>
                )}
                <button
                  onClick={() => reject(r.id)}
                  disabled={remove.isPending}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold disabled:opacity-60"
                >
                  <Trash2 size={14} /> Supprimer
                </button>
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>
      {confirmDialog}
    </div>
  );
};

export default SiteReviewsTab;
