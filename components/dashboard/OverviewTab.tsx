import React, { memo, useMemo } from 'react';
import {
  TrendingUp,
} from 'lucide-react';
import { Skeleton } from '../ui/Skeleton';
import { useUserStats } from '../../hooks/useUserStats';
import { useUser } from '../../context/UserContext';
import iconListings from '../../src/assets/dashboard-icon-listings.png';
import iconViews from '../../src/assets/dashboard-icon-views.png';
import iconContacts from '../../src/assets/dashboard-icon-contacts.png';
import iconFavorites from '../../src/assets/dashboard-icon-favorites.png';

const fmt = (n: number | undefined | null) =>
  typeof n === 'number' ? n.toLocaleString('fr-FR') : '—';

const pct = (num: number, denom: number) =>
  denom > 0 ? Math.round((num / denom) * 1000) / 10 : 0;

interface NavProps { onNavigate?: (tab: string, params?: any) => void; }

const StatCard = memo(({ label, value, image, isLoading, sub, onClick }: any) => {
  const Wrapper: any = onClick ? 'button' : 'div';
  return (
  <Wrapper
    {...(onClick ? { type: 'button', onClick, 'aria-label': `Ouvrir ${label}` } : {})}
    className={`bg-card p-4 md:p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between min-h-[120px] md:min-h-[150px] relative overflow-hidden group transition-all hover:shadow-md hover:border-orange-100 text-left w-full ${onClick ? 'cursor-pointer active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600' : ''}`}
  >
    <div className="flex justify-between items-start">
      <img
        src={image}
        alt=""
        loading="lazy"
        width={112}
        height={112}
        className="w-12 h-12 md:w-14 md:h-14 object-contain transition-transform group-hover:scale-110 group-hover:-rotate-6 duration-300 drop-shadow-sm"
      />
      {sub && !isLoading && (
        <span className="text-xs font-medium text-gray-600 tabular-nums text-right max-w-[55%] leading-snug">
          {sub}
        </span>
      )}
    </div>
    <div className="space-y-1 mt-4">
      {isLoading ? (
        <Skeleton className="h-9 md:h-10 w-24" />
      ) : (
        <p className="text-[28px] md:text-[32px] font-bold text-gray-900 leading-tight tracking-tight tabular-nums">{value}</p>
      )}
      <p className="text-[13px] md:text-sm text-gray-600 font-medium">{label}</p>
    </div>
  </Wrapper>
  );
});

// QuickAction (Actions rapides) was removed to declutter the user dashboard.

const OverviewTab: React.FC<NavProps> = ({ onNavigate }) => {
  const { data: stats, isLoading } = useUserStats();
  const { user } = useUser();
  const isPro = user?.memberType === 'Pro';

  const totalAds = stats?.listings?.active ?? 0;
  const totalListings = stats?.listings?.total ?? 0;
  const soldListings = stats?.listings?.sold ?? 0;
  const totalViews = stats?.listings?.total_views ?? 0;
  const totalContacts = stats?.listings?.total_contacts ?? 0;
  const totalFavorites = stats?.favorites_count ?? 0;
  const adFavorites = stats?.listings?.total_favorites ?? 0;
  const unreadMessages = stats?.unread_notifications ?? 0;
  const showSkeleton = isLoading && !stats;

  // Conversion: contacts / views — Pro-only metric, irrelevant for Particuliers.
  const conversionRate = useMemo(() => pct(totalContacts, totalViews), [totalContacts, totalViews]);
  const sellThroughRate = useMemo(() => pct(soldListings, totalListings), [soldListings, totalListings]);
  const avgViewsPerAd = totalAds > 0 ? Math.round(totalViews / totalAds) : 0;

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="sr-only md:not-sr-only">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {user?.firstName ? `Bienvenue, ${user.firstName} 👋` : 'Tableau de bord'}
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Suivez la performance de vos annonces en temps réel.
        </p>
      </div>

      {/* Primary KPI grid: 4 cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
        <div>
          <StatCard
            label="Annonces en ligne"
            value={fmt(totalAds)}
            sub={totalListings > 0 ? `/ ${totalListings}` : undefined}
            image={iconListings}
            isLoading={showSkeleton}
            onClick={() => onNavigate?.('dashboard', { tab: 'my-ads' })}
          />
        </div>
        <div>
          <StatCard
            label="Vues cumulées"
            value={fmt(totalViews)}
            sub={avgViewsPerAd > 0 ? `~${fmt(avgViewsPerAd)}/annonce` : undefined}
            image={iconViews}
            isLoading={showSkeleton}
            onClick={() => onNavigate?.('dashboard', { tab: 'my-ads' })}
          />
        </div>
        <div>
          <StatCard
            label="Contacts reçus"
            value={fmt(totalContacts)}
            sub={isPro && conversionRate > 0 ? `${conversionRate}% conv.` : undefined}
            image={iconContacts}
            isLoading={showSkeleton}
            onClick={() => onNavigate?.('dashboard', { tab: 'messages' })}
          />
        </div>
        <div>
          <StatCard
            label="Mises en favori"
            value={fmt(adFavorites)}
            sub={totalFavorites > 0 ? `${fmt(totalFavorites)} sauvegardées` : undefined}
            image={iconFavorites}
            isLoading={showSkeleton}
            onClick={() => onNavigate?.('dashboard', { tab: 'favorites' })}
          />
        </div>
      </div>

      {/* Performance summary */}
      <div>
        <div className="bg-card rounded-2xl border border-gray-100 shadow-sm p-5 md:p-7">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-base md:text-lg text-foreground">Performance</h2>
              <p className="text-[13px] text-gray-600 mt-0.5">Indicateurs clés de votre activité.</p>
            </div>
            <TrendingUp size={18} className="text-primary-600" />
          </div>

          <div className={`grid grid-cols-1 ${isPro ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3 md:gap-5`}>
            {isPro && (
              <PerfTile
                label="Taux de conversion"
                value={`${conversionRate}%`}
                hint="contacts / vues"
                loading={showSkeleton}
              />
            )}
            <PerfTile
              label="Annonces vendues"
              value={fmt(soldListings)}
              hint={sellThroughRate > 0 ? `${sellThroughRate}% du total` : '—'}
              loading={showSkeleton}
            />
            <PerfTile
              label="Vues moyennes"
              value={fmt(avgViewsPerAd)}
              hint="par annonce active"
              loading={showSkeleton}
            />
          </div>

          <div className="mt-6 pt-5 border-t border-gray-100">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-orange-50 text-primary-600 flex items-center justify-center shrink-0">
                <TrendingUp size={16} strokeWidth={2.25} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Conseil performance</p>
                <p className="text-sm text-gray-600 leading-relaxed mt-1">
                  Les annonces avec <strong className="font-semibold text-foreground">5 photos HD</strong> reçoivent en moyenne{' '}
                  <strong className="font-semibold text-foreground">2.5× plus de messages</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PerfTile: React.FC<{
  label: string;
  value: string;
  hint: string;
  loading?: boolean;
}> = ({ label, value, hint, loading }) => (
  <div className="rounded-xl bg-gray-50/60 p-3 md:p-4 border border-gray-100">
    <p className="text-[13px] font-medium text-gray-600 mb-1.5 leading-snug">
      {label}
    </p>
    {loading ? (
      <Skeleton className="h-7 w-16" />
    ) : (
      <p className="text-2xl font-bold text-gray-900 tracking-tight tabular-nums leading-tight">{value}</p>
    )}
    <p className="text-xs text-gray-600 mt-1">{hint}</p>
  </div>
);

export default memo(OverviewTab);
