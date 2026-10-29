import React, { useEffect, useMemo, useState } from 'react';
import { Search, Check, X, Eye, AlertTriangle, Map as MapIcon, List as ListIcon, Trash2 } from 'lucide-react';
import { useAdminListingsPaginated, useModerateListing, useAdminDeleteListing } from '../../hooks/useAdmin';
import { useToast } from '../../context/ToastContext';
import { AdminTable, StatusPill } from './AdminPrimitives';
import { AdminPagination } from './AdminPagination';
import { ListingsMapView } from './ListingsMapView';

const PAGE_SIZE = 25;

const STATUS_TABS: { key: string; label: string }[] = [
  { key: 'pending',  label: 'En attente' },
  { key: 'active',   label: 'Actives' },
  { key: 'rejected', label: 'Rejetées' },
  { key: '',         label: 'Toutes' },
];

interface Props {
  onPreview?: (id: string) => void;
}

/**
 * Admin moderation queue for listings.
 *
 * Capabilities:
 *  - Browse listings by moderation status (pending / active / rejected / all)
 *  - Search by title or seller
 *  - Single-row approve / reject (reject opens a modal to capture an optional
 *    reason that's persisted with the moderation event so the seller can be
 *    notified of *why* their ad was rejected)
 *  - Bulk select + bulk approve / reject for fast queue triage
 *
 * The component intentionally batches mutations sequentially with
 * `Promise.allSettled` rather than one big bulk endpoint so that a partial
 * failure (e.g. one row already moderated by another admin) doesn't block the
 * rest of the batch — and we can surface a per-row count in the toast.
 */
export const ListingsTab: React.FC<Props> = ({ onPreview }) => {
  const [status, setStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [view, setView] = useState<'table' | 'map'>('table');
  // Reject modal state — stores the listing(s) being rejected and the reason
  // input. When `ids` is null the modal is closed.
  const [rejectModal, setRejectModal] = useState<{ ids: string[]; reason: string } | null>(null);
  // Hard-delete confirm modal
  const [deleteModal, setDeleteModal] = useState<{ ids: string[]; reason: string } | null>(null);

  // Debounce search so we don't hit the backend on every keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 1 whenever filters change so admins don't land beyond the
  // new result set.
  useEffect(() => { setPage(1); }, [debouncedSearch, status]);

  const { data, isLoading, isFetching } = useAdminListingsPaginated({
    page: view === 'map' ? 1 : page,
    limit: view === 'map' ? 500 : PAGE_SIZE,
    status: status || undefined,
    search: debouncedSearch || undefined,
  });
  const listings = data?.listings ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.total_pages ?? 1;

  const moderate = useModerateListing();
  const deleteListing = useAdminDeleteListing();
  const { addToast } = useToast();

  // Reset selection when filters or page change — selected ids may no longer
  // be visible, and "select all" should reflect the current page only.
  useEffect(() => {
    setSelected(new Set());
  }, [status, debouncedSearch, page]);

  const allVisibleIds = useMemo(() => listings.map((l) => l.id), [listings]);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id));

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(allVisibleIds));

  /**
   * Run a moderation action over one or many listings. Returns once every
   * mutation has settled so the caller can clear the selection / close the
   * modal once feedback has been emitted.
   */
  const runModeration = async (
    ids: string[],
    action: 'approve' | 'reject',
    reason?: string,
  ) => {
    if (ids.length === 0) return;
    const results = await Promise.allSettled(
      ids.map((id) => moderate.mutateAsync({ id, action, reason })),
    );
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const ko = results.length - ok;
    if (ok > 0) {
      addToast(
        action === 'approve'
          ? `${ok} annonce${ok > 1 ? 's' : ''} approuvée${ok > 1 ? 's' : ''}`
          : `${ok} annonce${ok > 1 ? 's' : ''} rejetée${ok > 1 ? 's' : ''}`,
        'success',
      );
    }
    if (ko > 0) {
      addToast(`${ko} échec${ko > 1 ? 's' : ''} de modération`, 'error');
    }
    setSelected(new Set());
  };

  const approveSelected = () => runModeration(Array.from(selected), 'approve');
  const openRejectModal = (ids: string[]) =>
    setRejectModal({ ids, reason: '' });

  const confirmReject = async () => {
    if (!rejectModal) return;
    const { ids, reason } = rejectModal;
    setRejectModal(null);
    await runModeration(ids, 'reject', reason.trim() || undefined);
  };

  const openDeleteModal = (ids: string[]) => setDeleteModal({ ids, reason: '' });

  const confirmDelete = async () => {
    if (!deleteModal) return;
    const { ids, reason } = deleteModal;
    setDeleteModal(null);
    if (ids.length === 0) return;
    const results = await Promise.allSettled(
      ids.map((id) => deleteListing.mutateAsync({ id, reason: reason.trim() || undefined })),
    );
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const ko = results.length - ok;
    if (ok > 0) {
      addToast(`${ok} annonce${ok > 1 ? 's' : ''} supprimée${ok > 1 ? 's' : ''}`, 'success');
    }
    if (ko > 0) {
      addToast(`${ko} échec${ko > 1 ? 's' : ''} de suppression`, 'error');
    }
    setSelected(new Set());
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div className="hidden md:block">
          <h2 className="text-2xl font-black text-gray-900">File de modération</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Approuvez ou rejetez les annonces avant publication.
          </p>
        </div>
        <div className="relative w-full md:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Titre, marque, modèle, vendeur, ville…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:border-primary-600"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 -mx-3 md:mx-0 px-3 md:px-0 overflow-x-auto md:overflow-visible">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key || 'all'}
            onClick={() => setStatus(t.key)}
            className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-colors whitespace-nowrap ${
              status === t.key
                ? 'bg-primary-600 text-white'
                : 'bg-card border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 bg-card p-1 shrink-0">
          <button
            onClick={() => setView('table')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
              view === 'table' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <ListIcon size={14} /> Liste
          </button>
          <button
            onClick={() => setView('map')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
              view === 'map' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <MapIcon size={14} /> Carte
          </button>
        </div>
      </div>

      {view === 'map' ? (
        <ListingsMapView listings={listings} onPreview={onPreview} />
      ) : (
        <>
          {/* Bulk action bar — shown only when at least one row is selected. Keeps
              the controls visually anchored to the table so admins can act on the
              queue without scrolling back to the top. */}
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-primary-50 border border-primary-200">
              <span className="text-sm font-bold text-primary-700">
                {selected.size} annonce{selected.size > 1 ? 's' : ''} sélectionnée{selected.size > 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelected(new Set())}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-gray-600 hover:bg-card"
                >
                  Annuler la sélection
                </button>
                <button
                  onClick={approveSelected}
                  disabled={moderate.isPending}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold disabled:opacity-60"
                >
                  <Check size={14} /> Tout approuver
                </button>
                <button
                  onClick={() => openRejectModal(Array.from(selected))}
                  disabled={moderate.isPending}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold disabled:opacity-60"
                >
                  <X size={14} /> Tout rejeter
                </button>
                <button
                  onClick={() => openDeleteModal(Array.from(selected))}
                  disabled={deleteListing.isPending}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-black text-white text-xs font-bold disabled:opacity-60"
                >
                  <Trash2 size={14} /> Tout supprimer
                </button>
              </div>
            </div>
          )}

          <AdminTable
            columns={[
              (
                <input
                  key="all"
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Tout sélectionner"
                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
              ) as any,
              'Annonce',
              'Vendeur',
              'Localisation',
              'Prix',
              'Statut',
              'Actions',
            ]}
            loading={isLoading}
            rowCount={listings.length}
            empty="Aucune annonce dans cette catégorie."
          >
            {listings.map((l) => {
              const lat = Number(l.latitude);
              const lng = Number(l.longitude);
              const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
              return (
              <tr
                key={l.id}
                className={`hover:bg-gray-50 transition-colors ${
                  selected.has(l.id) ? 'bg-primary-50/40' : ''
                }`}
              >
                <td className="p-4 w-10">
                  <input
                    type="checkbox"
                    checked={selected.has(l.id)}
                    onChange={() => toggleOne(l.id)}
                    aria-label={`Sélectionner ${l.title}`}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    {l.images?.[0] && (
                      <img src={l.images[0]} alt="" className="w-12 h-12 rounded-lg object-cover bg-gray-100" />
                    )}
                    <div>
                      <p className="font-bold text-gray-900 line-clamp-1">{l.title}</p>
                      <p className="text-xs text-gray-500">{l.brand} {l.model}</p>
                    </div>
                  </div>
                </td>
                <td className="p-4 text-sm">
                  <p className="font-medium text-gray-900">{l.seller_name || '—'}</p>
                  <p className="text-xs text-gray-500">{l.seller_email}</p>
                </td>
                <td className="p-4 text-sm max-w-[220px]">
                  <p className="font-medium text-gray-900 line-clamp-1" title={l.address || ''}>
                    {l.address || `${l.city || ''}${l.governorate ? ', ' + l.governorate : ''}` || '—'}
                  </p>
                  {hasCoords ? (
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-primary-600 hover:underline font-bold"
                    >
                      {lat.toFixed(4)}, {lng.toFixed(4)} ↗
                    </a>
                  ) : (
                    <p className="text-[11px] text-amber-600 font-bold">Sans GPS</p>
                  )}
                </td>
                <td className="p-4 text-sm font-bold text-gray-900 whitespace-nowrap">
                  {Number(l.price).toLocaleString('fr-FR')} TND
                </td>
                <td className="p-4"><StatusPill status={l.status} /></td>
                <td className="p-4">
                  <div className="flex items-center justify-end gap-2">
                    {onPreview && (
                      <button
                        onClick={() => onPreview(l.id)}
                        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
                        aria-label="Aperçu"
                        title="Aperçu de l'annonce"
                      >
                        <Eye size={16} />
                      </button>
                    )}
                    {l.status !== 'active' && (
                      <button
                        onClick={() => runModeration([l.id], 'approve')}
                        disabled={moderate.isPending}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold disabled:opacity-60"
                      >
                        <Check size={14} /> Approuver
                      </button>
                    )}
                    {l.status !== 'rejected' && (
                      <button
                        onClick={() => openRejectModal([l.id])}
                        disabled={moderate.isPending}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold disabled:opacity-60"
                      >
                        <X size={14} /> Rejeter
                      </button>
                    )}
                    <button
                      onClick={() => openDeleteModal([l.id])}
                      disabled={deleteListing.isPending}
                      className="p-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-60"
                      aria-label="Supprimer définitivement"
                      title="Supprimer définitivement"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
              );
            })}
          </AdminTable>

          <AdminPagination
            currentPage={page}
            totalPages={totalPages}
            total={total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            isFetching={isFetching && !isLoading}
          />
        </>
      )}

      {/* Reject modal — captures an optional reason that's persisted with the
          moderation event. Reasons help sellers understand why their ad was
          refused and reduce repeat-submissions of the same offending ad. */}
      {rejectModal && (
        <div
          className="fixed inset-0 z-[10010] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50"
          onClick={() => setRejectModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-card rounded-t-2xl md:rounded-2xl shadow-xl border border-gray-200 overflow-hidden"
          >
            <div className="p-5 border-b border-gray-100 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-900">
                  Rejeter {rejectModal.ids.length > 1
                    ? `${rejectModal.ids.length} annonces`
                    : 'cette annonce'} ?
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Le motif sera communiqué au vendeur.
                </p>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                Motif du rejet (optionnel)
              </label>
              <textarea
                value={rejectModal.reason}
                onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
                rows={4}
                placeholder="Ex : photos non conformes, prix incohérent, doublon…"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-primary-600 resize-none"
                autoFocus
              />
            </div>
            <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setRejectModal(null)}
                className="px-4 py-2 rounded-lg text-sm font-bold text-gray-700 hover:bg-card"
              >
                Annuler
              </button>
              <button
                onClick={confirmReject}
                disabled={moderate.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-60"
              >
                <X size={14} /> Confirmer le rejet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hard-delete confirm modal — irreversible removal of one or many
          listings. Captures an optional reason logged in admin_audit_log. */}
      {deleteModal && (
        <div
          className="fixed inset-0 z-[10010] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50"
          onClick={() => setDeleteModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-card rounded-t-2xl md:rounded-2xl shadow-xl border border-gray-200 overflow-hidden"
          >
            <div className="p-5 border-b border-gray-100 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
                <Trash2 size={18} />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-900">
                  Supprimer définitivement {deleteModal.ids.length > 1
                    ? `${deleteModal.ids.length} annonces`
                    : 'cette annonce'} ?
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Action irréversible. L'annonce, ses images et ses statistiques seront retirées du site.
                </p>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                Motif (optionnel — journal d'audit)
              </label>
              <textarea
                value={deleteModal.reason}
                onChange={(e) => setDeleteModal({ ...deleteModal, reason: e.target.value })}
                rows={3}
                placeholder="Ex : contenu illégal, doublon, demande du vendeur…"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-primary-600 resize-none"
                autoFocus
              />
            </div>
            <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteModal(null)}
                className="px-4 py-2 rounded-lg text-sm font-bold text-gray-700 hover:bg-card"
              >
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteListing.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-60"
              >
                <Trash2 size={14} /> {deleteListing.isPending ? 'Suppression…' : 'Supprimer définitivement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListingsTab;
