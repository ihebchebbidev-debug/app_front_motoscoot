import React, { useState } from 'react';
import { ShieldAlert, Check } from 'lucide-react';
import { useAdminReports, useResolveReport } from '../../hooks/useAdmin';
import { useToast } from '../../context/ToastContext';
import { AdminTable } from './AdminPrimitives';

export const ReportsTab: React.FC = () => {
  const [resolved, setResolved] = useState(false);
  const { data: reports = [], isLoading } = useAdminReports(resolved);
  const resolve = useResolveReport();
  const { addToast } = useToast();

  const handleResolve = async (id: number | string) => {
    try {
      await resolve.mutateAsync(id);
      addToast('Signalement traité', 'success');
    } catch (e: any) {
      addToast(e?.message || 'Action impossible', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-gray-900">Signalements</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setResolved(false)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              !resolved ? 'bg-primary-600 text-white' : 'bg-card border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Ouverts
          </button>
          <button
            onClick={() => setResolved(true)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              resolved ? 'bg-primary-600 text-white' : 'bg-card border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Résolus
          </button>
        </div>
      </div>

      <AdminTable
        columns={['Motif', 'Annonce', 'Auteur', 'Date', 'Actions']}
        loading={isLoading}
        rowCount={reports.length}
        empty={resolved ? 'Aucun signalement résolu.' : 'Aucun signalement ouvert. ✨'}
      >
        {reports.map((r) => (
          <tr key={r.id} className="hover:bg-gray-50 transition-colors">
            <td className="p-4">
              <div className="flex items-start gap-2">
                <ShieldAlert size={16} className="text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-gray-900">{r.reason}</p>
                  {r.description && <p className="text-xs text-gray-500 line-clamp-2">{r.description}</p>}
                </div>
              </div>
            </td>
            <td className="p-4 text-sm text-gray-700">{r.listing_title || '—'}</td>
            <td className="p-4 text-sm text-gray-700">{r.reporter_name || 'Anonyme'}</td>
            <td className="p-4 text-xs text-gray-500 whitespace-nowrap">
              {new Date(r.created_at).toLocaleDateString('fr-FR')}
            </td>
            <td className="p-4">
              <div className="flex items-center justify-end">
                {!r.is_resolved && (
                  <button
                    onClick={() => handleResolve(r.id)}
                    disabled={resolve.isPending}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold disabled:opacity-60"
                  >
                    <Check size={14} /> Résoudre
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
};

export default ReportsTab;
