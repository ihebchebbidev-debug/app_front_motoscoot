import React, { memo, useMemo } from 'react';
import {
  TrendingUp,
} from 'lucide-react';
import { Reveal } from '../ui/Reveal';
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

const StatCard = memo(({ label, value, image, alt, isLoading, sub, onClick }: any) => {
  const Wrapper: any = onClick ? 'button' : 'div';
  return (
  <Wrapper
    {...(onClick ? { type: 'button', onClick, 'aria-label': `Ouvrir ${label}` } : {})}
    className={`bg-card p-4 md:p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between min-h-[120px] md:min-h-[150px] relative overflow-hidden group transition-all hover:shadow-md hover:border-orange-100 text-left w-full ${onClick ? 'cursor-pointer active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600' : ''}`}
  >
    <div className="flex justify-between items-start">
      <img
        src={image}
        alt={alt}
        loading="lazy"
        width={512}
        height={512}
        className="w-12 h-12 md:w-14 md:h-14 object-contain transition-transform group-hover:scale-110 group-hover:-rotate-6 duration-300 drop-shadow-sm"
      />
      {sub && !isLoading && (
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider tabular-nums text-right max-w-[55%] leading-tight">
          {sub}
        </span>
      )}
    </div>
    <div className="space-y-1 mt-4">
      {isLoading ? (
        <Skeleton className="h-9 md:h-10 w-24" />
      ) : (
        <h4 className="text-[26px] md:text-[32px] font-black text-gray-900 leading-none tabular-nums">{value}</h4>
      )}
      <p className="text-[11px] md:text-[12px] text-gray-500 font-bold uppercase tracking-tight">{label}</p>
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
    <div className="space-y-6 md:space-y-8 animate-fade-in" style={{ letterSpacing: '0px' }}>
      <div className="hidden md:block">
        <h2 className="text-xl md:text-2xl font-extrabold text-foreground">
          {user?.firstName ? `Bienvenue, ${user.firstName} 👋` : 'Tableau de bord'}
        </h2>
        <p className="text-xs md:text-sm text-gray-500 font-medium mt-1">
          Suivez la performance de vos annonces en temps réel.
        </p>
      </div>

      {/* Primary KPI grid: 4 cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
        <Reveal animation="fade-in-up" delay={50}>
          <StatCard
            label="Annonces en ligne"
            value={fmt(totalAds)}
            sub={totalListings > 0 ? `/ ${totalListings}` : undefined}
            image={iconListings}
            alt="Annonces"
            isLoading={showSkeleton}
            onClick={() => onNavigate?.('dashboard', { tab: 'my-ads' })}
          />
        </Reveal>
        <Reveal animation="fade-in-up" delay={100}>
          <StatCard
            label="Vues cumulées"
            value={fmt(totalViews)}
            sub={avgViewsPerAd > 0 ? `~${fmt(avgViewsPerAd)}/annonce` : undefined}
            image={iconViews}
            alt="Vues"
            isLoading={showSkeleton}
            onClick={() => onNavigate?.('dashboard', { tab: 'my-ads' })}
          />
        </Reveal>
        <Reveal animation="fade-in-up" delay={150}>
          <StatCard
            label="Contacts reçus"
            value={fmt(totalContacts)}
            sub={isPro && conversionRate > 0 ? `${conversionRate}% conv.` : undefined}
            image={iconContacts}
            alt="Contacts"
            isLoading={showSkeleton}
            onClick={() => onNavigate?.('dashboard', { tab: 'messages' })}
          />
        </Reveal>
        <Reveal animation="fade-in-up" delay={200}>
          <StatCard
            label="Mises en favori"
            value={fmt(adFavorites)}
            sub={totalFavorites > 0 ? `${fmt(totalFavorites)} sauvegardées` : undefined}
            image={iconFavorites}
            alt="Favoris"
            isLoading={showSkeleton}
            onClick={() => onNavigate?.('dashboard', { tab: 'favorites' })}
          />
        </Reveal>
      </div>

      {/* Performance summary */}
      <Reveal animation="fade-in-up" delay={250}>
        <div className="bg-card rounded-2xl border border-gray-100 shadow-sm p-5 md:p-7">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-base text-foreground">Performance</h3>
              <p className="text-[12px] text-gray-500 mt-0.5">Indicateurs clés de votre activité.</p>
            </div>
            <TrendingUp size={18} className="text-primary-600" />
          </div>

          <div className={`grid grid-cols-1 ${isPro ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3 md:gap-5`}>
            {isPro && (
              <PerfTile
                label="Taux de conversion"
                value={`${conversionRate}%`}
                hint="contacts / vues"
                tone="text-emerald-600"
                loading={showSkeleton}
              />
            )}
            <PerfTile
              label="Annonces vendues"
              value={fmt(soldListings)}
              hint={sellThroughRate > 0 ? `${sellThroughRate}% du total` : '—'}
              tone="text-blue-600"
              loading={showSkeleton}
            />
            <PerfTile
              label="Vues moyennes"
              value={fmt(avgViewsPerAd)}
              hint="par annonce active"
              tone="text-orange-600"
              loading={showSkeleton}
            />
          </div>

          <div className="mt-6 pt-5 border-t border-gray-100">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-orange-50 text-primary-600 flex items-center justify-center shrink-0">
                <TrendingUp size={16} strokeWidth={2.25} />
              </div>
              <div className="flex-1">
                <p className="text-[12px] font-bold uppercase text-foreground tracking-wide">Conseil performance</p>
                <p className="text-[13px] text-muted-foreground font-medium leading-relaxed mt-1">
                  Les annonces avec <strong className="text-foreground">5 photos HD</strong> reçoivent en moyenne{' '}
                  <strong className="text-primary-600">2.5× plus de messages</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  );
};

const PerfTile: React.FC<{
  label: string;
  value: string;
  hint: string;
  tone: string;
  loading?: boolean;
}> = ({ label, value, hint, tone, loading }) => (
  <div className="rounded-xl bg-gray-50/60 p-3 md:p-4 border border-gray-100">
    <p className="text-[10px] md:text-[11px] font-bold uppercase text-gray-500 tracking-wider mb-2 leading-tight">
      {label}
    </p>
    {loading ? (
      <Skeleton className="h-7 w-16" />
    ) : (
      <p className={`text-xl md:text-2xl font-black tabular-nums leading-none ${tone}`}>{value}</p>
    )}
    <p className="text-[10px] text-gray-400 font-medium mt-1.5">{hint}</p>
  </div>
);

export default memo(OverviewTab);
