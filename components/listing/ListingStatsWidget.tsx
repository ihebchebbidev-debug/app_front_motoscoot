/**
 * ListingStatsWidget — owner-only "performance" card.
 *
 * Renders a polished panel with 4 KPIs (views / favorites / contacts / shares)
 * and a tiny 14-day sparkline of views vs contacts. Hidden entirely while
 * loading or for non-owners (the parent decides when to mount).
 */
import React, { useMemo, useState } from 'react';
import { Eye, Heart, MessageCircle, Share2, TrendingUp, Loader2, BarChart3, CalendarDays } from 'lucide-react';
import { useListingStats } from '../../hooks/useListingStats';
import ListingViewsDetailModal from './ListingViewsDetailModal';

interface ListingStatsWidgetProps {
  listingId: string | number;
}

interface KpiProps {
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  label: string;
  value: number;
  accent: 'orange' | 'rose' | 'emerald' | 'sky';
}

const ACCENT: Record<KpiProps['accent'], { bg: string; text: string; ring: string }> = {
  orange: { bg: 'bg-primary-50', text: 'text-primary-600', ring: 'ring-primary-100' },
  rose:   { bg: 'bg-rose-50',    text: 'text-rose-600',    ring: 'ring-rose-100' },
  emerald:{ bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100' },
  sky:    { bg: 'bg-sky-50',     text: 'text-sky-600',     ring: 'ring-sky-100' },
};

const Kpi: React.FC<KpiProps> = ({ icon: Icon, label, value, accent }) => {
  const a = ACCENT[accent];
  return (
    <div className="flex flex-col gap-2 p-3 md:p-4 rounded-2xl bg-card border border-gray-100 hover:border-gray-200 transition-colors">
      <div className={`w-9 h-9 rounded-xl ${a.bg} ${a.text} flex items-center justify-center ring-1 ${a.ring}`}>
        <Icon size={18} strokeWidth={2.5} />
      </div>
      <div>
        <div className="text-[20px] md:text-[24px] font-extrabold text-foreground leading-none tabular-nums">
          {value.toLocaleString('fr-FR')}
        </div>
        <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-1">{label}</div>
      </div>
    </div>
  );
};

/** Build a continuous 14-day series filling missing days with 0. */
function buildSeries(points: { day: string; count: number }[], windowDays: number): number[] {
  const map = new Map(points.map(p => [p.day, p.count]));
  const out: number[] = [];
  const today = new Date();
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push(map.get(key) ?? 0);
  }
  return out;
}

interface SparklineProps {
  data: number[];
  color: string; // tailwind text-* or hex
}

const Sparkline: React.FC<SparklineProps> = ({ data, color }) => {
  const W = 100;
  const H = 28;
  const max = Math.max(1, ...data);
  const step = data.length > 1 ? W / (data.length - 1) : 0;
  const points = data.map((v, i) => `${(i * step).toFixed(2)},${(H - (v / max) * H).toFixed(2)}`).join(' ');
  const area = `0,${H} ${points} ${W},${H}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-7" preserveAspectRatio="none" aria-hidden>
      <polygon points={area} fill="currentColor" className={`${color} opacity-10`} />
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={color} />
    </svg>
  );
};

export const ListingStatsWidget: React.FC<ListingStatsWidgetProps> = ({ listingId }) => {
  const { data, isLoading, isError, error } = useListingStats(listingId);
  const [showDetail, setShowDetail] = useState(false);

  const viewsSeries = useMemo(
    () => (data ? buildSeries(data.views_by_day, data.window_days) : []),
    [data],
  );
  const contactsSeries = useMemo(
    () => (data ? buildSeries(data.contacts_by_day, data.window_days) : []),
    [data],
  );

  // Silently hide the whole block when we're not allowed to see it.
  if (isError) {
    const status = (error as any)?.status;
    if (status === 401 || status === 403 || status === 404) return null;
  }

  const totalViews14d = viewsSeries.reduce((s, n) => s + n, 0);
  const totalContacts14d = contactsSeries.reduce((s, n) => s + n, 0);
  const conversionRate = totalViews14d > 0 ? Math.round((totalContacts14d / totalViews14d) * 1000) / 10 : 0;

  return (
    <div className="bg-card rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-stretch border-b border-gray-50/50 h-14 md:h-16">
        <div className="w-[12%] md:w-[49px] flex items-center justify-center border-r border-gray-100 bg-gray-50/20 shrink-0">
          <BarChart3 size={22} className="text-primary-600" strokeWidth={2.5} />
        </div>
        <div className="flex-1 flex items-center justify-between px-[10px] md:px-[14px]">
          <div className="flex items-center gap-2">
            <span className="font-sans text-[16px] font-extrabold text-foreground">Performance</span>
            <span className="text-[10px] font-black text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full uppercase tracking-widest">
              Privé
            </span>
          </div>
          {!isLoading && !isError && (
            <span className="hidden md:inline text-[11px] font-bold text-gray-400 uppercase tracking-widest">
              14 derniers jours
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-6 md:px-8 pt-4 pb-6 md:pt-5 md:pb-7">
        {isLoading ? (
          <div className="py-10 flex items-center justify-center text-gray-400">
            <Loader2 size={20} className="animate-spin mr-2" />
            <span className="text-sm font-bold">Chargement de vos statistiques…</span>
          </div>
        ) : isError ? (
          <div className="py-6 text-center text-sm font-medium text-gray-500">
            Statistiques indisponibles pour le moment.
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <Kpi icon={Eye}            label="Vues"        value={data.views_count}     accent="orange" />
              <Kpi icon={Heart}          label="Favoris"     value={data.favorites_count} accent="rose" />
              <Kpi icon={MessageCircle}  label="Contacts"    value={data.contacts_count}  accent="emerald" />
              <Kpi icon={Share2}         label="Partages"    value={data.shares_count}    accent="sky" />
            </div>

            {/* Trend row */}
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-gray-50/60 border border-gray-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Vues / jour</span>
                  <span className="text-[12px] font-extrabold text-primary-600 tabular-nums">{totalViews14d}</span>
                </div>
                <Sparkline data={viewsSeries} color="text-primary-600" />
              </div>
              <div className="p-4 rounded-2xl bg-gray-50/60 border border-gray-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Contacts / jour</span>
                  <span className="text-[12px] font-extrabold text-emerald-600 tabular-nums">{totalContacts14d}</span>
                </div>
                <Sparkline data={contactsSeries} color="text-emerald-600" />
              </div>
            </div>

            {/* Conversion footer */}
            <div className="mt-4 flex items-center gap-2 text-[12px] font-semibold text-gray-500">
              <TrendingUp size={14} className="text-emerald-500" />
              <span>
                Taux de conversion vues → contacts :{' '}
                <strong className="text-foreground tabular-nums">{conversionRate}%</strong>
              </span>
            </div>

            {/* Detail trigger — opens a modal with the full per-day breakdown */}
            <button
              type="button"
              onClick={() => setShowDetail(true)}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary-50 hover:bg-primary-100 text-primary-700 font-extrabold text-[13px] uppercase tracking-wider transition-colors"
            >
              <CalendarDays size={16} strokeWidth={2.5} />
              Voir le détail des vues par jour
            </button>
          </>
        ) : null}
      </div>

      {showDetail && data && (
        <ListingViewsDetailModal stats={data} onClose={() => setShowDetail(false)} />
      )}
    </div>
  );
};

export default ListingStatsWidget;
