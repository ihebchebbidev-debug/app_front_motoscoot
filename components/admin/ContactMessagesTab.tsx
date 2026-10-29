import React from 'react';
import { Mail, Check } from 'lucide-react';
import { useAdminContactMessages, useResolveContactMessage } from '../../hooks/useAdmin';
import { useToast } from '../../context/ToastContext';
import { AdminTable } from './AdminPrimitives';

export const ContactMessagesTab: React.FC = () => {
  const { data: messages = [], isLoading } = useAdminContactMessages();
  const resolve = useResolveContactMessage();
  const { addToast } = useToast();

  const handleResolve = async (id: string) => {
    try { await resolve.mutateAsync(id); addToast('Marqué comme traité', 'success'); }
    catch (e: any) { addToast(e?.message || 'Erreur', 'error'); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-2xl font-black text-gray-900">Messages de contact</h2>
      <AdminTable
        columns={['Expéditeur', 'Sujet / Message', 'Date', 'Statut', 'Actions']}
        loading={isLoading} rowCount={messages.length} empty="Aucun message."
      >
        {messages.map((m) => (
          <tr key={m.id} className="hover:bg-gray-50 align-top">
            <td className="p-4">
              <div className="flex items-center gap-2">
                <Mail size={16} className="text-primary-600" />
                <div>
                  <p className="font-bold text-gray-900">{m.name}</p>
                  <a href={`mailto:${m.email}`} className="text-xs text-primary-600 hover:underline">{m.email}</a>
                </div>
              </div>
            </td>
            <td className="p-4 max-w-md">
              {m.subject && <p className="font-bold text-gray-900 text-sm">{m.subject}</p>}
              <p className="text-xs text-gray-600 line-clamp-3">{m.message}</p>
            </td>
            <td className="p-4 text-xs text-gray-500 whitespace-nowrap">
              {new Date(m.created_at).toLocaleDateString('fr-FR')}
            </td>
            <td className="p-4">
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${m.is_resolved ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
                {m.is_resolved ? 'Traité' : 'Ouvert'}
              </span>
            </td>
            <td className="p-4 text-right">
              {!m.is_resolved && (
                <button
                  onClick={() => handleResolve(m.id)}
                  disabled={resolve.isPending}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold disabled:opacity-60"
                >
                  <Check size={14} /> Traiter
                </button>
              )}
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
};

export default ContactMessagesTab;
