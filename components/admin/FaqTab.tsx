import React, { useState } from 'react';
import { HelpCircle, Plus, Trash2, Edit3, Check, X } from 'lucide-react';
import { useAdminFaqs, useCreateFaq, useUpdateFaq, useDeleteFaq } from '../../hooks/useAdmin';
import { useToast } from '../../context/ToastContext';
import { AdminTable } from './AdminPrimitives';
import { useConfirm } from './ConfirmDialog';
import type { AdminFaq } from '../../services/adminApi';

const empty: Partial<AdminFaq> = { question: '', answer: '', category: 'general', position: 0, is_published: true };

export const FaqTab: React.FC = () => {
  const { data: faqs = [], isLoading } = useAdminFaqs();
  const create = useCreateFaq();
  const update = useUpdateFaq();
  const remove = useDeleteFaq();
  const { addToast } = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<AdminFaq>>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<AdminFaq>>({});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await create.mutateAsync(form);
      addToast('FAQ créée', 'success');
      setForm(empty); setShowForm(false);
    } catch (err: any) { addToast(err?.message || 'Erreur', 'error'); }
  };

  const startEdit = (f: AdminFaq) => { setEditingId(f.id); setEditForm(f); };
  const saveEdit = async () => {
    if (!editingId) return;
    try {
      await update.mutateAsync({ id: editingId, payload: editForm });
      addToast('Mise à jour', 'success');
      setEditingId(null);
    } catch (e: any) { addToast(e?.message || 'Erreur', 'error'); }
  };

  const togglePublish = async (f: AdminFaq) => {
    try { await update.mutateAsync({ id: f.id, payload: { is_published: !f.is_published } }); }
    catch (e: any) { addToast(e?.message || 'Erreur', 'error'); }
  };

  const del = async (id: string) => {
    const ok = await confirm({ title: 'Supprimer cette FAQ ?', confirmLabel: 'Supprimer', variant: 'danger' });
    if (!ok) return;
    try { await remove.mutateAsync(id); addToast('Supprimée', 'success'); }
    catch (e: any) { addToast(e?.message || 'Erreur', 'error'); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-gray-900">FAQ</h2>
        <button onClick={() => setShowForm((s) => !s)} className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-bold">
          <Plus size={16} /> Nouvelle question
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-card p-6 rounded-2xl border border-gray-100 shadow-sm space-y-3">
          <input required placeholder="Question" value={form.question || ''} onChange={(e) => setForm({ ...form, question: e.target.value })} className="w-full px-4 py-2 border rounded-lg" />
          <textarea required placeholder="Réponse" value={form.answer || ''} onChange={(e) => setForm({ ...form, answer: e.target.value })} rows={3} className="w-full px-4 py-2 border rounded-lg" />
          <div className="grid grid-cols-3 gap-3">
            <input placeholder="Catégorie" value={form.category || ''} onChange={(e) => setForm({ ...form, category: e.target.value })} className="px-4 py-2 border rounded-lg" />
            <input type="number" placeholder="Position" value={form.position ?? 0} onChange={(e) => setForm({ ...form, position: Number(e.target.value) })} className="px-4 py-2 border rounded-lg" />
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={!!form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} /> Publié
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border text-sm font-bold">Annuler</button>
            <button disabled={create.isPending} className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold disabled:opacity-60">
              {create.isPending ? 'Création…' : 'Créer'}
            </button>
          </div>
        </form>
      )}

      <AdminTable
        columns={['Question / Réponse', 'Catégorie', 'Statut', 'Actions']}
        loading={isLoading} rowCount={faqs.length} empty="Aucune FAQ."
      >
        {faqs.map((f) => (
          <tr key={f.id} className="hover:bg-gray-50 align-top">
            <td className="p-4 max-w-xl">
              {editingId === f.id ? (
                <div className="space-y-2">
                  <input value={editForm.question || ''} onChange={(e) => setEditForm({ ...editForm, question: e.target.value })} className="w-full px-3 py-1.5 border rounded text-sm" />
                  <textarea value={editForm.answer || ''} onChange={(e) => setEditForm({ ...editForm, answer: e.target.value })} rows={3} className="w-full px-3 py-1.5 border rounded text-sm" />
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <HelpCircle size={16} className="text-primary-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold text-gray-900">{f.question}</p>
                    <p className="text-xs text-gray-500 line-clamp-2">{f.answer}</p>
                  </div>
                </div>
              )}
            </td>
            <td className="p-4 text-xs font-mono text-gray-700">{f.category}</td>
            <td className="p-4">
              <button onClick={() => togglePublish(f)} className={`px-2.5 py-1 rounded-full text-xs font-bold ${f.is_published ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                {f.is_published ? 'Publié' : 'Brouillon'}
              </button>
            </td>
            <td className="p-4 text-right">
              <div className="flex items-center justify-end gap-1">
                {editingId === f.id ? (
                  <>
                    <button onClick={saveEdit} className="p-2 text-green-600 hover:bg-green-50 rounded-lg"><Check size={16} /></button>
                    <button onClick={() => setEditingId(null)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
                  </>
                ) : (
                  <button onClick={() => startEdit(f)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit3 size={16} /></button>
                )}
                <button onClick={() => del(f.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>
      {confirmDialog}
    </div>
  );
};

export default FaqTab;
