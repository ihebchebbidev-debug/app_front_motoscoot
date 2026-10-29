import React, { useState, useMemo } from 'react';
import { Mail, Trash2, Download } from 'lucide-react';
import { useAdminNewsletter, useDeleteNewsletterSubscriber } from '../../hooks/useAdmin';
import { useToast } from '../../context/ToastContext';
import { AdminTable } from './AdminPrimitives';
import { useConfirm } from './ConfirmDialog';

export const NewsletterTab: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const activeParam = filter === 'all' ? undefined : filter === 'active';
  const { data: subs = [], isLoading } = useAdminNewsletter(activeParam);
  const remove = useDeleteNewsletterSubscriber();
  const { addToast } = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const csvUrl = useMemo(() => {
    const csv = ['email,is_active,subscribed_at', ...subs.map((s) => `${s.email},${s.is_active},${s.subscribed_at}`)].join('\n');
    return URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  }, [subs]);

  const del = async (id: string) => {
    const ok = await confirm({ title: 'Supprimer cet abonné ?', confirmLabel: 'Supprimer', variant: 'danger' });
    if (!ok) return;
    try { await remove.mutateAsync(id); addToast('Supprimé', 'success'); }
    catch (e: any) { addToast(e?.message || 'Erreur', 'error'); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-gray-900">Newsletter</h2>
        <div className="flex items-center gap-2">
          {(['all', 'active', 'inactive'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                filter === k ? 'bg-primary-600 text-white' : 'bg-card border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {k === 'all' ? 'Tous' : k === 'active' ? 'Actifs' : 'Désinscrits'}
            </button>
          ))}
          <a href={csvUrl} download="newsletter.csv" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-bold text-gray-700">
            <Download size={14} /> CSV
          </a>
        </div>
      </div>

      <AdminTable
        columns={['Email', 'Inscrit le', 'Statut', 'Actions']}
        loading={isLoading} rowCount={subs.length} empty="Aucun abonné."
      >
        {subs.map((s) => (
          <tr key={s.id} className="hover:bg-gray-50">
            <td className="p-4">
              <div className="flex items-center gap-2">
                <Mail size={16} className="text-primary-600" />
                <span className="font-bold text-gray-900">{s.email}</span>
              </div>
            </td>
            <td className="p-4 text-xs text-gray-500">{new Date(s.subscribed_at).toLocaleDateString('fr-FR')}</td>
            <td className="p-4">
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${s.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                {s.is_active ? 'Actif' : 'Désinscrit'}
              </span>
            </td>
            <td className="p-4 text-right">
              <button onClick={() => del(s.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Supprimer">
                <Trash2 size={16} />
              </button>
            </td>
          </tr>
        ))}
      </AdminTable>
      {confirmDialog}
    </div>
  );
};

export default NewsletterTab;
