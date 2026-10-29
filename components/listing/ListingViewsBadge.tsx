/**
 * ListingViewsBadge — compact owner-only "views" counter.
 *
 * Particulier owners see this lightweight card on their own listing detail
 * page. It shows just the total number of clicks/views, with a soft hint that
 * full analytics (favorites, contacts, shares, trends) are reserved for Pro
 * sellers — driving an upgrade. Pro owners get <ListingStatsWidget /> instead.
 */
import React from 'react';
import { Eye, Loader2, Lock } from 'lucide-react';
import { useListingStats } from '../../hooks/useListingStats';

interface ListingViewsBadgeProps {
  listingId: string | number;
}

export const ListingViewsBadge: React.FC<ListingViewsBadgeProps> = ({ listingId }) => {
  const { data, isLoading, isError, error } = useListingStats(listingId);

  // Silently hide if backend says we shouldn't see this (auth/owner check).
  if (isError) {
    const status = (error as any)?.status;
    if (status === 401 || status === 403 || status === 404) return null;
  }

  return (
    <div className="bg-card rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
      <div className="flex items-stretch border-b border-gray-50/50 h-14 md:h-16">
        <div className="w-[12%] md:w-[49px] flex items-center justify-center border-r border-gray-100 bg-gray-50/20 shrink-0">
          <Eye size={22} className="text-primary-600" strokeWidth={2.5} />
        </div>
        <div className="flex-1 flex items-center justify-between px-[10px] md:px-[14px]">
          <div className="flex items-center gap-2">
            <span className="font-sans text-[16px] font-extrabold text-foreground">Vues de votre annonce</span>
            <span className="text-[10px] font-black text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full uppercase tracking-widest">
              Privé
            </span>
          </div>
        </div>
      </div>

      <div className="px-6 md:px-8 py-5 md:py-6">
        {isLoading ? (
          <div className="py-4 flex items-center justify-center text-gray-400">
            <Loader2 size={18} className="animate-spin mr-2" />
            <span className="text-sm font-bold">Chargement…</span>
          </div>
        ) : isError ? (
          <div className="py-4 text-center text-sm font-medium text-gray-500">
            Statistiques indisponibles pour le moment.
          </div>
        ) : data ? (
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center ring-1 ring-primary-100">
                <Eye size={22} strokeWidth={2.5} />
              </div>
              <div>
                <div className="text-[28px] md:text-[32px] font-extrabold text-foreground leading-none tabular-nums">
                  {data.views_count.toLocaleString('fr-FR')}
                </div>
                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                  Clics totaux
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 text-[12px] font-semibold text-gray-500 max-w-[280px]">
              <Lock size={14} className="text-gray-400 mt-0.5 shrink-0" />
              <span>
                Statistiques détaillées (favoris, contacts, partages){' '}
                <strong className="text-primary-600">réservées aux comptes Pro</strong>.
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ListingViewsBadge;
