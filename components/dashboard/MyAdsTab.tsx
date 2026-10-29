import React, { useMemo, useState, memo, useCallback, useRef, useEffect } from 'react';
import { 
  Eye, EyeOff, Clock, Trash2, Search, Filter, Handshake, Pencil,
  ChevronLeft, ChevronRight, Check, ChevronDown
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { Reveal } from '../ui/Reveal';
import { Button } from '../ui/Button';
import { useToast } from '../../context/ToastContext';
import { useMyListings, useDeleteListing, useSetListingStatus } from '../../hooks/useMyListings';
import { Skeleton } from '../ui/Skeleton';
// EditListingModal has been replaced by a full-page edit screen at
// /mon-compte/annonce/:id/modifier so editing has its own URL, supports
// browser back, and is easier to deep-link from notifications.
import { useConfirm } from '../admin/ConfirmDialog';

type UiStatus = 'Actif' | 'Inactif' | 'Vendu' | 'En attente';

function backendStatusToUi(s?: string): UiStatus {
  if (s === 'sold') return 'Vendu';
  if (s === 'active') return 'Actif';
  if (s === 'pending' || s === 'draft') return 'En attente';
  return 'Inactif';
}

const MyAdsTab: React.FC<any> = ({ onNavigate }) => {
  const { addToast } = useToast();
  const { data: listings = [], isLoading } = useMyListings();
  const deleteMut = useDeleteListing();
  const statusMut = useSetListingStatus();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Tous");
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const itemsPerPage = 6;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsStatusMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Map backend listings to the UI shape this tab expects.
  // Read the real status from the raw backend row (`_raw.status`) — the
  // mapped Listing strips it out, so without this every ad would render as
  // "Actif" regardless of its actual state (pending/sold/expired).
  const ads = useMemo(() => listings.map((l: any) => {
    const rawStatus = l?._raw?.status || 'active';
    return {
      id: l.id,
      title: l.title,
      price: l.price,
      image: l.image,
      views: Number(l?._raw?.views_count ?? 0),
      date: l.date || '',
      status: backendStatusToUi(rawStatus),
      backendStatus: rawStatus,
      // Forward the raw backend row so the Edit modal can prefill technical
      // fields with original numeric values. Without this, _raw is lost
      // during the UI mapping above and clicking "Edit" always errored with
      // "Données de cette annonce indisponibles".
      _raw: l._raw || null,
    };
  }), [listings]);

  // Open the full edit modal. We pass the raw backend row attached by
  // useMyListings so technical fields keep their original numeric values
  // (year/mileage/cc) instead of the formatted display strings.
  const handleEditClick = useCallback((ad: any) => {
    if (!ad?.id) {
      addToast('Données de cette annonce indisponibles, réessayez.', 'error');
      return;
    }
    onNavigate?.('edit-listing', { id: ad.id });
  }, [addToast, onNavigate]);

  const handleToggleStatus = useCallback(async (id: number | string, currentStatus: UiStatus) => {
    if (currentStatus === 'Vendu') return;
    const next = currentStatus === 'Actif' ? 'expired' : 'active';
    try {
      await statusMut.mutateAsync({ id, status: next });
      addToast(`Visibilité modifiée : ${next === 'active' ? 'Actif' : 'Inactif'}`, "info");
    } catch (e: any) {
      addToast(e?.message || "Action impossible.", "error");
    }
  }, [statusMut, addToast]);

  const handleMarkAsSold = useCallback(async (id: number | string) => {
    const ok = await confirm({
      title: 'Marquer cette annonce comme vendue ?',
      message: 'Elle ne sera plus visible dans les résultats de recherche.',
      confirmLabel: 'Marquer vendue',
      variant: 'info',
    });
    if (!ok) return;
    try {
      await statusMut.mutateAsync({ id, status: 'sold' });
      addToast("Vente enregistrée !", "success");
    } catch (e: any) {
      addToast(e?.message || "Action impossible.", "error");
    }
  }, [statusMut, addToast, confirm]);

  const handleDelete = useCallback(async (id: number | string) => {
    const ok = await confirm({
      title: 'Supprimer cette annonce ?',
      message: 'Cette action est définitive et ne peut pas être annulée.',
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await deleteMut.mutateAsync(id);
      addToast("Annonce supprimée.", "info");
    } catch (e: any) {
      addToast(e?.message || "Suppression impossible.", "error");
    }
  }, [deleteMut, addToast, confirm]);

  const filteredAds = useMemo(() => ads.filter(ad => {
    const matchesSearch = ad.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "Tous" || ad.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [ads, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredAds.length / itemsPerPage));
  const paginatedAds = filteredAds.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const statusOptions = [
    { id: 'Tous',       label: 'Toutes les annonces',  color: 'bg-gray-400' },
    { id: 'Actif',      label: 'Annonces en ligne',    color: 'bg-emerald-500' },
    { id: 'En attente', label: 'En attente de validation', color: 'bg-yellow-500' },
    { id: 'Inactif',    label: 'Annonces masquées',    color: 'bg-amber-500' },
    { id: 'Vendu',      label: 'Ventes terminées',     color: 'bg-blue-500' }
  ];

  const statusBadge = (s: UiStatus): { variant: any; label: string } => {
    if (s === 'Actif')      return { variant: 'success', label: 'EN LIGNE' };
    if (s === 'Vendu')      return { variant: 'info',    label: 'VENDU' };
    if (s === 'En attente') return { variant: 'warning', label: 'EN ATTENTE' };
    return { variant: 'default', label: 'MASQUÉ' };
  };

  return (
    <div className="space-y-6 md:space-y-8 font-['Inter'] relative animate-fade-in">
      <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-extrabold text-foreground">Mes Annonces</h2>
          <p className="text-sm text-gray-500 font-medium mt-1 truncate">Gérez vos publications et suivez leur impact sur le marché.</p>
        </div>
        <div className="hidden md:flex items-center gap-3 w-full max-w-[340px] relative" ref={dropdownRef}>
          <div className="flex-1">
            <Input 
              placeholder="Rechercher..." 
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              leftIcon={<Search size={18} className="text-gray-400" />}
              className="bg-card border-gray-100 rounded-xl h-11 text-sm font-medium shadow-sm"
            />
          </div>
          <button
            onClick={() => setIsStatusMenuOpen(!isStatusMenuOpen)}
            className={`w-11 h-11 flex items-center justify-center rounded-xl border transition-all shadow-sm shrink-0 ${isStatusMenuOpen || statusFilter !== 'Tous' ? 'bg-orange-50 border-orange-500 text-orange-600' : 'bg-card border-gray-100 text-gray-400 hover:border-gray-300'}`}
          >
            <Filter size={18} />
          </button>
          {isStatusMenuOpen && (
            <div className="absolute top-full right-0 mt-3 w-64 bg-card rounded-2xl shadow-2xl border border-gray-100 py-2 z-[200] animate-scale-in origin-top-right overflow-hidden">
              {statusOptions.map((opt) => (
                <button key={opt.id} onClick={() => { setStatusFilter(opt.id); setCurrentPage(1); setIsStatusMenuOpen(false); }} className={`w-full flex items-center justify-between px-4 py-3 text-xs font-bold ${statusFilter === opt.id ? 'bg-orange-50 text-orange-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                  <div className="flex items-center gap-3"><div className={`w-2 h-2 rounded-full ${opt.color}`}></div><span>{opt.label}</span></div>
                  {statusFilter === opt.id && <Check size={16} className="text-orange-600" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {confirmDialog}

      <div className="md:hidden flex flex-col gap-3">
        <div className="relative">
          <input
            type="text"
            placeholder="Rechercher une annonce..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full h-12 pl-12 pr-4 bg-card border border-gray-100 rounded-xl text-sm font-medium text-gray-700 shadow-sm outline-none focus:border-orange-300"
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <Search size={18}/>
          </div>
        </div>
        <div className="relative">
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} className="w-full h-12 pl-12 pr-10 bg-card border border-gray-100 rounded-xl text-sm font-bold text-gray-700 shadow-sm appearance-none outline-none">
            <option value="Tous">Toutes les annonces</option>
            <option value="Actif">Annonces En ligne</option>
            <option value="En attente">En attente de validation</option>
            <option value="Inactif">Annonces Masquées</option>
            <option value="Vendu">Ventes terminées</option>
          </select>
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-600 pointer-events-none"><Filter size={18}/></div>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"><ChevronDown size={18}/></div>
        </div>
      </div>

      {isLoading && ads.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl border border-gray-100" />
          ))}
        </div>
      ) : ads.length === 0 ? (
        <div className="bg-card rounded-2xl border border-gray-100 p-10 text-center">
          <p className="text-gray-500 font-bold mb-4">Vous n'avez pas encore d'annonces.</p>
          <Button variant="primary" onClick={() => onNavigate?.('deposit')}>Publier ma première annonce</Button>
        </div>
      ) : (
        <>
          <div className="hidden md:block bg-card rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50/50 border-b border-gray-50">
                <tr>
                  <th className="px-8 py-6 text-[13px] font-bold text-foreground">Annonce</th>
                  <th className="px-8 py-6 text-[13px] font-bold text-foreground">Statut</th>
                  <th className="px-8 py-6 text-[13px] font-bold text-foreground text-center">Vues</th>
                  <th className="px-8 py-6 text-[13px] font-bold text-foreground text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedAds.map(ad => (
                  <tr key={ad.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-card border border-gray-50 shadow-sm">
                          <img src={ad.image} className="w-full h-full object-cover" alt={ad.title} />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-[14px] text-foreground line-clamp-1">{ad.title}</span>
                          <span className="text-[12px] font-bold text-orange-600 uppercase mt-1">{ad.price}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      {(() => { const b = statusBadge(ad.status); return (
                        <Badge variant={b.variant} size="xs" className="font-bold px-3 py-1">{b.label}</Badge>
                      ); })()}
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center justify-center gap-1.5 text-foreground">
                        <Eye size={15} className="text-primary-600" />
                        <span className="text-[14px] font-extrabold tabular-nums">{ad.views.toLocaleString('fr-FR')}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center justify-center gap-2.5">
                        <button onClick={() => handleEditClick(ad)} className="p-3 rounded-2xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all" title="Modifier l'annonce"><Pencil size={16}/></button>
                        <button onClick={() => handleToggleStatus(ad.id, ad.status)} disabled={ad.status === 'Vendu'} className="p-3 rounded-2xl bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white disabled:opacity-20 transition-all" title="Visibilité">
                          {ad.status === 'Actif' ? <EyeOff size={16}/> : <Eye size={16}/>}
                        </button>
                        <button onClick={() => handleMarkAsSold(ad.id)} disabled={ad.status === 'Vendu'} className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white disabled:opacity-50 transition-all" title="Vendu"><Handshake size={16}/></button>
                        <button onClick={() => handleDelete(ad.id)} className="p-3 rounded-2xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all" title="Supprimer"><Trash2 size={16}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-4">
            {paginatedAds.map((ad, idx) => (
              <Reveal key={ad.id} delay={idx * 50} animation="fade-in-up">
                <div className="bg-card rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex gap-3 p-3">
                    <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-gray-50 border border-gray-100">
                      <img src={ad.image} className="w-full h-full object-cover" alt={ad.title} loading="lazy" />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-gray-900 leading-tight line-clamp-2 text-sm flex-1">{ad.title}</h4>
                        <Badge variant={statusBadge(ad.status).variant} size="xs" className="font-bold shrink-0 px-2 py-0.5 text-[9px]">
                          {statusBadge(ad.status).label}
                        </Badge>
                      </div>
                      <p className="text-orange-600 font-extrabold text-base mt-1">{ad.price}</p>
                      <div className="mt-auto flex items-center gap-3 text-gray-400 text-[11px] font-bold uppercase">
                        <span className="flex items-center gap-1.5"><Clock size={12}/> {ad.date}</span>
                        <span className="flex items-center gap-1.5 text-primary-600"><Eye size={12}/> {ad.views.toLocaleString('fr-FR')} vues</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-px bg-gray-100 border-t border-gray-100">
                    <button onClick={() => handleEditClick(ad)} className="flex flex-col items-center justify-center gap-1 py-2.5 bg-card text-blue-600 active:bg-blue-50 transition-colors">
                      <Pencil size={16}/>
                      <span className="text-[9px] font-bold uppercase">Modifier</span>
                    </button>
                    <button onClick={() => handleToggleStatus(ad.id, ad.status)} disabled={ad.status === 'Vendu'} className="flex flex-col items-center justify-center gap-1 py-2.5 bg-card text-orange-600 active:bg-orange-50 transition-colors disabled:opacity-30">
                      {ad.status === 'Actif' ? <EyeOff size={16}/> : <Eye size={16}/>}
                      <span className="text-[9px] font-bold uppercase">{ad.status === 'Actif' ? 'Masquer' : 'Activer'}</span>
                    </button>
                    <button onClick={() => handleMarkAsSold(ad.id)} disabled={ad.status === 'Vendu'} className="flex flex-col items-center justify-center gap-1 py-2.5 bg-card text-emerald-600 active:bg-emerald-50 transition-colors disabled:opacity-30">
                      <Handshake size={16}/>
                      <span className="text-[9px] font-bold uppercase">Vendu</span>
                    </button>
                    <button onClick={() => handleDelete(ad.id)} className="flex flex-col items-center justify-center gap-1 py-2.5 bg-card text-red-600 active:bg-red-50 transition-colors">
                      <Trash2 size={16}/>
                      <span className="text-[9px] font-bold uppercase">Suppr.</span>
                    </button>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 bg-card rounded-2xl border border-gray-100 shadow-sm">
              <span className="text-[12px] font-bold text-gray-300 uppercase">Page {currentPage} / {totalPages}</span>
              <div className="flex gap-2">
                <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-3 rounded-xl bg-gray-50 text-gray-500 disabled:opacity-30"><ChevronLeft size={18}/></button>
                <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-3 rounded-xl bg-gray-50 text-gray-500 disabled:opacity-30"><ChevronRight size={18}/></button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default memo(MyAdsTab);
