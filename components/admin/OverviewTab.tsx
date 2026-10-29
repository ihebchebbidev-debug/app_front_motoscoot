import React, { useMemo } from 'react';
import {
  Users, FileText, Store, AlertCircle, CheckCircle2, Clock, ShieldAlert,
  MessageSquareQuote, Activity, RefreshCw, Eye, Ban, BadgeCheck, ArrowUpRight,
  TrendingUp, TrendingDown, MousePointerClick, Globe2,
} from 'lucide-react';
import { useAdminStats } from '../../hooks/useAdmin';
import { useAudience } from '../../hooks/useAudience';
import { StatCard } from './AdminPrimitives';

/** Tiny SVG sparkline — uses semantic primary token. */
const Sparkline: React.FC<{ values: number[]; height?: number; tone?: 'primary' | 'success' }> = ({
  values, height = 40, tone = 'primary',
}) => {
  if (!values || values.length < 2) {
    return <div className="h-10 flex items-center text-[10px] text-slate-400">Données insuffisantes</div>;
  }
  const W = 200;
  const max = Math.max(1, ...values);
  const stepX = W / (values.length - 1);
  const pts = values.map((v, i) => `${(i * stepX).toFixed(1)},${(height - (v / max) * (height - 4) - 2).toFixed(1)}`).join(' ');
  const areaPath = `M 0,${height} L ${pts.split(' ').join(' L ')} L ${W},${height} Z`;
  const stroke = tone === 'success' ? 'hsl(142 71% 45%)' : 'hsl(var(--primary))';
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full h-10" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`spark-${tone}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#spark-${tone})`} />
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

const fmt = (n: number | undefined | null) =>
  typeof n === 'number' ? n.toLocaleString('fr-FR') : '—';

const pct = (num: number, denom: number) =>
  denom > 0 ? Math.round((num / denom) * 1000) / 10 : 0;

interface MiniBarProps { value: number; max: number; tone: string; }
const MiniBar: React.FC<MiniBarProps> = ({ value, max, tone }) => {
  const w = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full ${tone} rounded-full transition-all duration-500`} style={{ width: `${w}%` }} />
    </div>
  );
};

export const OverviewTab: React.FC = () => {
  const { data: stats, isLoading, error, refetch, isFetching } = useAdminStats();
  const { data: audience, isLoading: audienceLoading } = useAudience(7);

  const audienceTrend = useMemo(() => {
    if (!audience?.daily_traffic?.length) {
      return { sessions: [], visitors: [], delta: 0, totalSessions: 0, totalVisitors: 0, totalClicks: 0 };
    }
    const sessions = audience.daily_traffic.map((d) => Number(d.sessions || 0));
    const visitors = audience.daily_traffic.map((d) => Number(d.visitors || 0));
    const half = Math.max(1, Math.floor(sessions.length / 2));
    const older = sessions.slice(0, half).reduce((s, v) => s + v, 0);
    const recent = sessions.slice(half).reduce((s, v) => s + v, 0);
    const delta = older > 0 ? ((recent - older) / older) * 100 : (recent > 0 ? 100 : 0);
    const totalSessions = sessions.reduce((s, v) => s + v, 0);
    const totalVisitors = audience.kpis?.unique_visitors || 0;
    const totalClicks = (audience.top_clicked_listings || []).reduce((s, l) => s + Number(l.clicks || 0), 0);
    return { sessions, visitors, delta, totalSessions, totalVisitors, totalClicks };
  }, [audience]);

  if (error) {
    return (
      <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-red-700 text-sm font-medium">
        Impossible de charger les statistiques. Vérifiez que vous êtes bien connecté en tant qu'administrateur.
      </div>
    );
  }

  // Derived insights
  const totalListings = stats?.listings.total ?? 0;
  const activeRate = stats ? pct(stats.listings.active, stats.listings.total) : 0;
  const pendingRate = stats ? pct(stats.listings.pending, stats.listings.total) : 0;
  const banRate = stats ? pct(stats.users.banned, stats.users.total) : 0;
  const verifiedGarageRate = stats?.garages
    ? pct(stats.garages.verified, stats.garages.total)
    : 0;
  const dailyAvgSessions = stats ? Math.round(stats.sessions_30d / 30) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with refresh action - hidden on mobile (already in top bar) */}
      <div className="hidden md:flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Vue d'ensemble</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Indicateurs clés et rappels de modération.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-slate-200 text-[12px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors"
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          {isFetching ? 'Actualisation…' : 'Actualiser'}
        </button>
      </div>

      {/* Top KPI grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          tone="blue"
          label="Utilisateurs totaux"
          value={isLoading ? '—' : fmt(stats?.users.total)}
          hint={stats ? `${stats.users.banned} bannis · ${banRate}%` : undefined}
        />
        <StatCard
          icon={CheckCircle2}
          tone="green"
          label="Annonces actives"
          value={isLoading ? '—' : fmt(stats?.listings.active)}
          hint={stats ? `${activeRate}% du catalogue` : undefined}
          trend={stats && activeRate > 70 ? { value: activeRate, positive: true } : undefined}
        />
        <StatCard
          icon={Clock}
          tone="orange"
          label="Annonces en attente"
          value={isLoading ? '—' : fmt(stats?.listings.pending)}
          hint={stats ? `${pendingRate}% à modérer` : 'À modérer'}
        />
        <StatCard
          icon={AlertCircle}
          tone="red"
          label="Signalements ouverts"
          value={isLoading ? '—' : fmt(stats?.reports.unresolved)}
          hint={stats ? `${stats.reports.total} au total` : undefined}
        />
      </div>

      {/* Catalogue health + audience */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Catalogue health */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Santé du catalogue</h3>
              <p className="text-xs text-slate-500 mt-0.5">Répartition des annonces et garages.</p>
            </div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider tabular-nums">
              {fmt(totalListings)} annonces
            </div>
          </div>

          <div className="space-y-4">
            <CatalogRow
              icon={CheckCircle2}
              label="Actives"
              value={stats?.listings.active ?? 0}
              total={totalListings}
              tone="bg-green-500"
              textTone="text-green-600"
              loading={isLoading}
            />
            <CatalogRow
              icon={Clock}
              label="En attente de modération"
              value={stats?.listings.pending ?? 0}
              total={totalListings}
              tone="bg-orange-500"
              textTone="text-orange-600"
              loading={isLoading}
            />
            <CatalogRow
              icon={Ban}
              label="Comptes suspendus"
              value={stats?.users.banned ?? 0}
              total={stats?.users.total ?? 0}
              tone="bg-red-500"
              textTone="text-red-600"
              loading={isLoading}
            />
            {stats?.garages && (
              <CatalogRow
                icon={BadgeCheck}
                label="Garages vérifiés"
                value={stats.garages.verified}
                total={stats.garages.total}
                tone="bg-blue-500"
                textTone="text-blue-600"
                loading={isLoading}
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 mt-6 pt-6 border-t border-slate-100">
            <MiniStat
              icon={FileText}
              label="Annonces"
              value={fmt(stats?.listings.total)}
              loading={isLoading}
            />
            <MiniStat
              icon={Store}
              label="Garages"
              value={fmt(stats?.garages?.total)}
              hint={stats?.garages ? `${verifiedGarageRate}% vérifiés` : undefined}
              loading={isLoading}
            />
          </div>
        </div>

        {/* Audience + reminders */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Audience 7j</h3>
              <Activity size={16} className="text-slate-400" />
            </div>
            <p className="text-3xl font-black text-slate-900 tabular-nums leading-none mt-2">
              {audienceLoading ? '—' : fmt(audienceTrend.totalSessions)}
            </p>
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-[11px] text-slate-500 font-medium">sessions cette semaine</p>
              {!audienceLoading && Math.abs(audienceTrend.delta) >= 0.1 && (
                <span className={`inline-flex items-center gap-0.5 text-[10px] font-black px-1.5 py-0.5 rounded ${
                  audienceTrend.delta >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                  {audienceTrend.delta >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  {Math.abs(audienceTrend.delta).toFixed(0)}%
                </span>
              )}
            </div>
            {!audienceLoading && audienceTrend.sessions.length >= 2 && (
              <div className="mt-3 -mx-1">
                <Sparkline values={audienceTrend.sessions} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100">
              <div>
                <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                  <Eye size={10} /> Visiteurs
                </div>
                <p className="text-base font-black text-slate-900 tabular-nums mt-0.5">
                  {audienceLoading ? '—' : fmt(audienceTrend.totalVisitors)}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-1 text-[10px] font-bold text-orange-600 uppercase tracking-wider">
                  <MousePointerClick size={10} /> Clics ann.
                </div>
                <p className="text-base font-black text-slate-900 tabular-nums mt-0.5">
                  {audienceLoading ? '—' : fmt(audienceTrend.totalClicks)}
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
              <Globe2 size={10} />
              <span className="uppercase tracking-wider">
                {audience?.by_country?.[0]
                  ? `Top: ${audience.by_country[0].country || audience.by_country[0].country_code}`
                  : 'Audience mondiale'}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="text-base font-bold text-slate-900 tracking-tight mb-4">À traiter</h3>
            <ul className="space-y-2.5 text-sm">
              <ReminderItem
                icon={Clock}
                tone="orange"
                title={`${stats?.listings.pending ?? 0} annonces en attente`}
                hint="À approuver ou refuser."
              />
              <ReminderItem
                icon={MessageSquareQuote}
                tone="blue"
                title="Avis clients à modérer"
                hint="Onglet Avis."
              />
              <ReminderItem
                icon={ShieldAlert}
                tone="red"
                title={`${stats?.reports.unresolved ?? 0} signalements`}
                hint="Onglet Signalements."
              />
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------- atoms ---------- */

const CatalogRow: React.FC<{
  icon: React.ElementType;
  label: string;
  value: number;
  total: number;
  tone: string;
  textTone: string;
  loading?: boolean;
}> = ({ icon: Icon, label, value, total, tone, textTone, loading }) => (
  <div>
    <div className="flex items-center justify-between mb-1.5 text-[12px]">
      <span className="flex items-center gap-2 font-semibold text-slate-700">
        <Icon size={13} className={textTone} />
        {label}
      </span>
      <span className="tabular-nums font-bold text-slate-900">
        {loading ? '—' : value.toLocaleString('fr-FR')}
        <span className="text-slate-400 font-medium ml-1.5">
          {total > 0 ? `· ${pct(value, total)}%` : ''}
        </span>
      </span>
    </div>
    <MiniBar value={value} max={total} tone={tone} />
  </div>
);

const MiniStat: React.FC<{
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: string;
  loading?: boolean;
}> = ({ icon: Icon, label, value, hint, loading }) => (
  <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
    <div className="flex items-center gap-2 text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-1.5">
      <Icon size={13} /> {label}
    </div>
    <p className="text-xl font-black text-slate-900 tabular-nums leading-none">
      {loading ? '—' : value}
    </p>
    {hint && <p className="text-[10px] text-slate-500 mt-1 font-medium">{hint}</p>}
  </div>
);

const ReminderItem: React.FC<{
  icon: React.ElementType;
  tone: 'orange' | 'blue' | 'red';
  title: string;
  hint: string;
}> = ({ icon: Icon, tone, title, hint }) => {
  const styles = {
    orange: 'bg-orange-50 border-orange-100 text-orange-600',
    blue: 'bg-blue-50 border-blue-100 text-blue-600',
    red: 'bg-red-50 border-red-100 text-red-600',
  } as const;
  const titleStyles = {
    orange: 'text-orange-900',
    blue: 'text-blue-900',
    red: 'text-red-900',
  } as const;
  return (
    <li className={`flex gap-2.5 p-2.5 rounded-lg border ${styles[tone]}`}>
      <Icon size={16} className="shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className={`font-bold text-[12.5px] leading-tight ${titleStyles[tone]}`}>{title}</p>
        <p className="text-[11px] mt-0.5 opacity-80">{hint}</p>
      </div>
      <ArrowUpRight size={13} className="opacity-60 shrink-0 mt-0.5" />
    </li>
  );
};

export default OverviewTab;
