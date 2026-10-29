import React, { useEffect, useState } from 'react';
import { Plus, Search, ShieldCheck, ShieldOff } from 'lucide-react';
import { useAdminGaragesPaginated, useSetGarageVerified } from '../../hooks/useAdmin';
import { useToast } from '../../context/ToastContext';
import { AdminTable } from './AdminPrimitives';
import { AdminPagination } from './AdminPagination';
import { GarageFormModal } from './GarageFormModal';

const PAGE_SIZE = 25;

export const GaragesTab: React.FC = () => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'true' | 'false'>('all');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  // Debounce search so we don't hit the backend on every keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 1 whenever filters change so admins don't land beyond the
  // new result set.
  useEffect(() => { setPage(1); }, [debouncedSearch, filter]);

  const { data, isLoading, isFetching } = useAdminGaragesPaginated({
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
    verified: filter === 'all' ? undefined : (filter as 'true' | 'false'),
  });
  const garages = data?.garages ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.total_pages ?? 1;

  const setVerified = useSetGarageVerified();
  const { addToast } = useToast();

  const toggleVerified = async (id: string, current: boolean) => {
    try {
      await setVerified.mutateAsync({ id, verified: !current });
      addToast(current ? 'Garage non vérifié' : 'Garage vérifié', 'success');
    } catch (e: any) {
      addToast(e?.message || 'Action impossible', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-black text-gray-900">Garages Pro</h2>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom, ville, téléphone, email, spécialité…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:border-primary-600"
            />
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black hover:bg-primary-700 transition-colors whitespace-nowrap"
          >
            <Plus size={16} /> Nouveau garage
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        {(['all', 'true', 'false'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              filter === f
                ? 'bg-primary-600 text-white'
                : 'bg-card border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {f === 'all' ? 'Tous' : f === 'true' ? 'Vérifiés' : 'Non vérifiés'}
          </button>
        ))}
      </div>

      <AdminTable
        columns={['Garage', 'Localisation', 'Propriétaire', 'Statut', 'Actions']}
        loading={isLoading}
        rowCount={garages.length}
        empty="Aucun garage trouvé."
      >
        {garages.map((g) => (
          <tr key={g.id} className="hover:bg-gray-50 transition-colors">
            <td className="p-4">
              <div className="flex items-center gap-3">
                {g.image && <img src={g.image} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-100" />}
                <div>
                  <p className="font-bold text-gray-900">{g.name}</p>
                  <p className="text-xs text-gray-500">
                    {g.reviews_count ?? 0} avis · note {Number(g.rating || 0).toFixed(1)} / 5
                  </p>
                </div>
              </div>
            </td>
            <td className="p-4 text-sm text-gray-700">{g.city || '—'} · {g.governorate || '—'}</td>
            <td className="p-4 text-sm">
              <p className="text-gray-900">{g.owner_name || '—'}</p>
              <p className="text-xs text-gray-500">{g.email || g.phone || ''}</p>
            </td>
            <td className="p-4">
              {g.is_verified ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold">
                  <ShieldCheck size={12} /> Vérifié
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-bold">
                  Non vérifié
                </span>
              )}
            </td>
            <td className="p-4">
              <div className="flex items-center justify-end">
                <button
                  onClick={() => toggleVerified(g.id, g.is_verified)}
                  disabled={setVerified.isPending}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-white text-xs font-bold disabled:opacity-60 ${
                    g.is_verified ? 'bg-gray-700 hover:bg-gray-800' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {g.is_verified ? <><ShieldOff size={14} /> Retirer la vérif.</> : <><ShieldCheck size={14} /> Vérifier</>}
                </button>
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminPagination
        currentPage={page}
        totalPages={totalPages}
        total={total}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        isFetching={isFetching && !isLoading}
      />

      <GarageFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => setPage(1)}
      />
    </div>
  );
};

export default GaragesTab;
