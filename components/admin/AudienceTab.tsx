import React, { useMemo, useState } from 'react';
import {
  Globe2, Users, Clock, MousePointerClick, Eye, MapPin, Smartphone,
  Monitor, Tablet, ArrowRight, Search, X, Loader2, TrendingUp, TrendingDown,
  DollarSign, Target, Activity, Chrome, Calendar, UserCheck, Zap,
  Filter as FilterIcon, FileText, Phone, Share2, Search as SearchIcon, MousePointer, Link2, BarChart3,
} from 'lucide-react';
import { useAudience, useFunnel, useFunnelBySource, useVisitors, useVisitorDetail } from '../../hooks/useAudience';
import type { VisitorRow, AudienceDailyTrafficRow, FunnelStep, FunnelSourceBucket } from '../../services/analyticsApi';
import BrandTrendsPanel from './BrandTrendsPanel';

/* ---------- helpers ---------- */

const PERIODS: { value: number; label: string }[] = [
  { value: 1, label: '24 h' },
  { value: 7, label: '7 j' },
  { value: 30, label: '30 j' },
  { value: 90, label: '90 j' },
];

// Industry-standard CPM (€ per 1000 impressions) for display-style ads in MENA region.
const ASSUMED_CPM_EUR = 2.5;
// Avg ads shown per page view (banner + sidebar).
const ADS_PER_VIEW = 1.4;

function flagFromCountryCode(cc?: string | null): string {
  if (!cc || cc.length !== 2) return '🏳️';
  const A = 0x1f1e6;
  return String.fromCodePoint(
    A + cc.toUpperCase().charCodeAt(0) - 65,
    A + cc.toUpperCase().charCodeAt(1) - 65,
  );
}

function fmtDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function fmtMs(ms: number | null | undefined): string {
  if (!ms) return '—';
  return fmtDuration(Math.round(ms / 1000));
}

function fmtNumber(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n || 0));
}

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
}

function fmtPct(n: number): string {
  return `${(n || 0).toFixed(1)}%`;
}

function deviceIcon(d: string) {
  if (d === 'mobile') return Smartphone;
  if (d === 'tablet') return Tablet;
  return Monitor;
}

function normalizeDevice(d: string) {
  const value = String(d || '').toLowerCase();
  if (value === 'phone' || value === 'mobile' || value === 'smartphone') return 'mobile';
  if (value === 'tablet' || value === 'ipad') return 'tablet';
  if (value === 'desktop' || value === 'computer') return 'desktop';
  return 'desktop';
}

function osLabel(os: string) {
  const labels: Record<string, string> = {
    ios: 'iOS',
    android: 'Android',
    windows: 'Windows',
    macos: 'macOS',
    linux: 'Linux',
    unknown: 'Inconnu',
    other: 'Autre',
  };
  return labels[os] || os;
}

/** Map raw tracker view_name slugs to user-friendly French page names. */
const VIEW_NAME_LABELS: Record<string, string> = {
  'home': 'Accueil',
  'search': 'Recherche / Annonces',
  'listing-details': "Détail d'une annonce",
  'deposit': 'Déposer une annonce',
  'favorites': 'Favoris',
  'dashboard': 'Mon tableau de bord',
  'dashboard-pro': 'Tableau de bord Pro',
  'news': 'Actualités',
  'article-details': "Détail d'un article",
  'tips': 'Conseils',
  'tip-details': "Détail d'un conseil",
  'garages': 'Garages',
  'garage-details': "Détail d'un garage",
  'tech-specs-brands': 'Fiches techniques — Marques',
  'tech-specs-models': 'Fiches techniques — Modèles',
  'tech-specs-details': 'Fiches techniques — Détail',
  'comparator': 'Comparateur',
  'contact': 'Contact',
  'about': 'À propos',
  'faq': 'FAQ',
  'sitemap': 'Plan du site',
  'legal': 'Mentions légales',
  'terms': "Conditions d'utilisation",
  'security': 'Sécurité',
  'cookies': 'Cookies',
  'reset-password': 'Réinitialisation du mot de passe',
  'admin': 'Administration',
  'api-test': 'Test API',
};

function viewNameLabel(view: string | null | undefined): string {
  const key = String(view || '').trim();
  if (!key) return 'Page inconnue';
  return VIEW_NAME_LABELS[key] || key;
}

function browserIcon(_b: string) {
  return Chrome;
}

/** Compare two halves of a series and return the % delta of the recent half vs older half. */
function trendDelta(rows: AudienceDailyTrafficRow[], key: 'sessions' | 'visitors'): number {
  if (!rows || rows.length < 4) return 0;
  const half = Math.floor(rows.length / 2);
  const older = rows.slice(0, half).reduce((s, r) => s + Number(r[key] || 0), 0);
  const recent = rows.slice(half).reduce((s, r) => s + Number(r[key] || 0), 0);
  if (older <= 0) return recent > 0 ? 100 : 0;
  return ((recent - older) / older) * 100;
}

/* ---------- small UI bits ---------- */

const Card: React.FC<React.PropsWithChildren<{ title: string; subtitle?: string; right?: React.ReactNode }>> = ({
  title, subtitle, right, children,
}) => (
  <div className="bg-card border border-border rounded-2xl p-5">
    <div className="flex items-center justify-between mb-4 gap-3">
      <div className="min-w-0">
        <h3 className="text-sm font-black text-foreground uppercase tracking-wider">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
    {children}
  </div>
);

/**
 * Visual divider between top-level sections of the page. Gives the admin a
 * clear scent of "where am I?" when the page becomes long.
 */
const SectionHeader: React.FC<{
  index: number;
  icon: React.ElementType;
  title: string;
  subtitle?: string;
}> = ({ index, icon: Icon, title, subtitle }) => (
  <div className="flex items-center gap-3 pt-2">
    <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
      <Icon size={18} />
    </div>
    <div className="min-w-0">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
        Section {String(index).padStart(2, '0')}
      </div>
      <h3 className="text-base sm:text-lg font-black text-foreground leading-tight">{title}</h3>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  </div>
);

const KpiCard: React.FC<{
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: string;
  tone?: 'primary' | 'success' | 'blue' | 'gray' | 'amber' | 'violet';
  delta?: number;
}> = ({ icon: Icon, label, value, hint, tone = 'primary', delta }) => {
  const tones: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success-100 text-success-700',
    blue:    'bg-blue-100 text-blue-700',
    gray:    'bg-muted text-foreground',
    amber:   'bg-amber-100 text-amber-700',
    violet:  'bg-violet-100 text-violet-700',
  };
  const showDelta = typeof delta === 'number' && Number.isFinite(delta) && Math.abs(delta) >= 0.1;
  const positive = (delta ?? 0) >= 0;
  return (
    <div className="bg-card border border-border rounded-2xl p-5 relative overflow-hidden">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tones[tone]}`}>
          <Icon size={20} />
        </div>
        {showDelta && (
          <div className={`inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full ${
            positive ? 'bg-success-100 text-success-700' : 'bg-destructive/10 text-destructive'
          }`}>
            {positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(delta!).toFixed(1)}%
          </div>
        )}
      </div>
      <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-black text-foreground mt-1 tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
};

const Bar: React.FC<{ value: number; max: number; tone?: 'primary' | 'success' | 'amber' }> = ({ value, max, tone = 'primary' }) => {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  const toneCls = tone === 'success' ? 'bg-success-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-primary';
  return (
    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
      <div className={`h-full ${toneCls}`} style={{ width: `${pct}%` }} />
    </div>
  );
};

const DeviceChart: React.FC<{
  label: string;
  sessions: number;
  total: number;
  max: number;
  icon: React.ElementType;
  tone: 'primary' | 'success' | 'amber';
}> = ({ label, sessions, total, max, icon: Icon, tone }) => {
  const share = total > 0 ? Math.round((sessions / total) * 100) : 0;
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const dash = total > 0 ? (share / 100) * circumference : 0;
  const strokeCls = tone === 'success' ? 'stroke-success-500' : tone === 'amber' ? 'stroke-amber-500' : 'stroke-primary';

  return (
    <Card title={label} subtitle="Sessions" right={<Icon size={16} className="text-muted-foreground" />}>
      <div className="flex items-center gap-4">
        <div className="relative h-24 w-24 shrink-0">
          <svg viewBox="0 0 96 96" className="h-24 w-24 -rotate-90" aria-hidden>
            <circle cx="48" cy="48" r={radius} fill="none" className="stroke-muted" strokeWidth="10" />
            <circle
              cx="48"
              cy="48"
              r={radius}
              fill="none"
              className={strokeCls}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference - dash}`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-sm font-black text-foreground tabular-nums">
            {share}%
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-3xl font-black text-foreground tabular-nums">{fmtNumber(sessions)}</div>
          <div className="text-xs font-bold text-muted-foreground mt-1">sessions enregistrées</div>
          <div className="mt-3"><Bar value={sessions} max={max} tone={tone} /></div>
        </div>
      </div>
    </Card>
  );
};

/* ---------- Traffic chart (SVG sparkline area) ---------- */

const TrafficChart: React.FC<{ data: AudienceDailyTrafficRow[] }> = ({ data }) => {
  const [hoverIdx, setHoverIdx] = React.useState<number | null>(null);
  const [selectedIdx, setSelectedIdx] = React.useState<number | null>(null);
  const svgRef = React.useRef<SVGSVGElement | null>(null);

  // Reset selection when underlying data length changes (period switch)
  React.useEffect(() => {
    setSelectedIdx(null);
    setHoverIdx(null);
  }, [data?.length]);

  const chart = useMemo(() => {
    if (!data || data.length < 2) return null;
    const W = 800;
    const H = 220;
    const PAD = { l: 36, r: 12, t: 16, b: 28 };
    const innerW = W - PAD.l - PAD.r;
    const innerH = H - PAD.t - PAD.b;
    const maxY = Math.max(1, ...data.map((d) => Math.max(Number(d.sessions || 0), Number(d.visitors || 0))));
    const stepX = data.length > 1 ? innerW / (data.length - 1) : innerW;
    const x = (i: number) => PAD.l + i * stepX;
    const y = (v: number) => PAD.t + innerH - (v / maxY) * innerH;

    const sessionPts = data.map((d, i) => `${x(i)},${y(Number(d.sessions || 0))}`).join(' ');
    const visitorPts = data.map((d, i) => `${x(i)},${y(Number(d.visitors || 0))}`).join(' ');
    const areaPath =
      `M ${PAD.l},${PAD.t + innerH} L ${sessionPts.split(' ').join(' L ')} L ${PAD.l + (data.length - 1) * stepX},${PAD.t + innerH} Z`;

    const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(maxY * t));
    const xLabels = data.length <= 4
      ? data.map((d, i) => ({ i, label: new Date(d.day).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) }))
      : [
          { i: 0, label: new Date(data[0].day).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) },
          { i: Math.floor(data.length / 2), label: new Date(data[Math.floor(data.length / 2)].day).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) },
          { i: data.length - 1, label: new Date(data[data.length - 1].day).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) },
        ];

    return { W, H, PAD, innerW, innerH, sessionPts, visitorPts, areaPath, ticks, x, y, stepX, xLabels, maxY };
  }, [data]);

  if (!chart) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Pas assez de données pour tracer la tendance.</p>;
  }

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const xInChart = xRatio * chart.W;
    const idx = Math.round((xInChart - chart.PAD.l) / chart.stepX);
    const clamped = Math.max(0, Math.min(data.length - 1, idx));
    setHoverIdx(clamped);
  };

  const activeIdx = hoverIdx ?? selectedIdx;
  const activePoint = activeIdx != null ? data[activeIdx] : null;
  const activeDate = activePoint ? new Date(activePoint.day) : null;

  // Stats summary (sum/avg) over the whole period
  const totalSessions = data.reduce((a, d) => a + Number(d.sessions || 0), 0);
  const totalVisitors = data.reduce((a, d) => a + Number(d.visitors || 0), 0);
  const avgSessions = Math.round(totalSessions / data.length);

  const selectedPoint = selectedIdx != null ? data[selectedIdx] : null;
  const selectedDate = selectedPoint ? new Date(selectedPoint.day) : null;

  return (
    <div className="w-full">
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${chart.W} ${chart.H}`}
          className="w-full h-auto cursor-crosshair select-none"
          preserveAspectRatio="none"
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIdx(null)}
          onClick={() => { if (hoverIdx != null) setSelectedIdx(hoverIdx); }}
        >
          <defs>
            <linearGradient id="sessFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {/* Grid */}
          {chart.ticks.map((t, i) => (
            <g key={i}>
              <line
                x1={chart.PAD.l} x2={chart.W - chart.PAD.r}
                y1={chart.y(t)} y2={chart.y(t)}
                stroke="hsl(var(--border))" strokeDasharray="2 4" strokeWidth="0.5"
              />
              <text x={chart.PAD.l - 6} y={chart.y(t) + 3} textAnchor="end"
                fontSize="9" fill="hsl(var(--muted-foreground))" fontFamily="monospace">
                {fmtNumber(t)}
              </text>
            </g>
          ))}
          {/* Area for sessions */}
          <path d={chart.areaPath} fill="url(#sessFill)" />
          {/* Sessions line */}
          <polyline
            points={chart.sessionPts}
            fill="none" stroke="hsl(var(--primary))" strokeWidth="2"
            strokeLinejoin="round" strokeLinecap="round"
          />
          {/* Visitors line */}
          <polyline
            points={chart.visitorPts}
            fill="none" stroke="hsl(var(--success-500, 142 71% 45%))" strokeWidth="1.5"
            strokeLinejoin="round" strokeLinecap="round" strokeDasharray="4 3"
          />
          {/* Selection / hover guide */}
          {activeIdx != null && (
            <line
              x1={chart.x(activeIdx)} x2={chart.x(activeIdx)}
              y1={chart.PAD.t} y2={chart.PAD.t + chart.innerH}
              stroke="hsl(var(--primary))" strokeWidth="1" strokeDasharray="3 3" opacity="0.6"
            />
          )}
          {/* Selected anchor (persists) */}
          {selectedIdx != null && selectedIdx !== hoverIdx && (
            <circle
              cx={chart.x(selectedIdx)} cy={chart.y(Number(data[selectedIdx].sessions || 0))}
              r={5} fill="hsl(var(--primary))" stroke="hsl(var(--background))" strokeWidth="2"
            />
          )}
          {/* Data point dots */}
          {data.map((d, i) => {
            const isLast = i === data.length - 1;
            const isHover = i === hoverIdx;
            return (
              <circle
                key={i}
                cx={chart.x(i)} cy={chart.y(Number(d.sessions || 0))}
                r={isHover ? 4 : isLast ? 3.5 : 1.8}
                fill={isHover || isLast ? 'hsl(var(--primary))' : 'hsl(var(--card))'}
                stroke="hsl(var(--primary))" strokeWidth={isHover || isLast ? 0 : 1.2}
              />
            );
          })}
          {/* X labels */}
          {chart.xLabels.map((l) => (
            <text key={l.i} x={chart.x(l.i)} y={chart.H - 8}
              textAnchor="middle" fontSize="10" fill="hsl(var(--muted-foreground))">
              {l.label}
            </text>
          ))}
        </svg>

        {/* Hover tooltip — positioned in % of svg width */}
        {activeIdx != null && activePoint && activeDate && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -top-1 z-10"
            style={{ left: `${(chart.x(activeIdx) / chart.W) * 100}%` }}
          >
            <div className="bg-popover border border-border shadow-xl rounded-lg px-3 py-2 text-[11px] min-w-[140px]">
              <div className="font-bold text-foreground capitalize">
                {activeDate.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <span className="w-2 h-2 rounded-full bg-primary" /> Sessions
                </span>
                <span className="font-black tabular-nums text-foreground">{fmtNumber(Number(activePoint.sessions || 0))}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <span className="w-2 h-2 rounded-full bg-success-500" /> Visiteurs
                </span>
                <span className="font-black tabular-nums text-foreground">{fmtNumber(Number(activePoint.visitors || 0))}</span>
              </div>
              {hoverIdx != null && (
                <div className="mt-1 pt-1 border-t border-border text-[10px] text-muted-foreground italic">
                  Cliquez pour analyser
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Legend + summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-3 text-xs">
        <div className="flex items-center gap-5">
          <span className="inline-flex items-center gap-1.5 text-foreground">
            <span className="w-3 h-0.5 rounded bg-primary" /> Sessions
          </span>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className="w-3 h-0.5 rounded bg-success-500" style={{ borderTop: '1px dashed' }} /> Visiteurs uniques
          </span>
        </div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
          Σ {fmtNumber(totalSessions)} sessions · {fmtNumber(totalVisitors)} visiteurs · ⌀ {fmtNumber(avgSessions)}/j
        </div>
      </div>

      {/* Selected day analysis panel */}
      {selectedPoint && selectedDate && (
        <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                Analyse du jour sélectionné
              </div>
              <div className="text-base font-black text-foreground capitalize mt-0.5">
                {selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
            </div>
            <button
              onClick={() => setSelectedIdx(null)}
              className="p-1.5 rounded-lg hover:bg-background text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Effacer la sélection"
            >
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg bg-background border border-border p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Sessions</div>
              <div className="text-xl font-black text-foreground tabular-nums">{fmtNumber(Number(selectedPoint.sessions || 0))}</div>
            </div>
            <div className="rounded-lg bg-background border border-border p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Visiteurs uniques</div>
              <div className="text-xl font-black text-foreground tabular-nums">{fmtNumber(Number(selectedPoint.visitors || 0))}</div>
            </div>
            <div className="rounded-lg bg-background border border-border p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Sessions / visiteur</div>
              <div className="text-xl font-black text-foreground tabular-nums">
                {Number(selectedPoint.visitors || 0) > 0
                  ? (Number(selectedPoint.sessions || 0) / Number(selectedPoint.visitors || 0)).toFixed(2)
                  : '—'}
              </div>
            </div>
            <div className="rounded-lg bg-background border border-border p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">vs moyenne</div>
              <div className={`text-xl font-black tabular-nums ${
                Number(selectedPoint.sessions || 0) >= avgSessions ? 'text-success-600' : 'text-amber-600'
              }`}>
                {avgSessions > 0
                  ? `${Number(selectedPoint.sessions || 0) >= avgSessions ? '+' : ''}${Math.round(((Number(selectedPoint.sessions || 0) - avgSessions) / avgSessions) * 100)}%`
                  : '—'}
              </div>
            </div>
          </div>
          <div className="mt-3 text-[11px] text-muted-foreground">
            Astuce — survolez un autre point puis cliquez pour comparer une autre journée.
          </div>
        </div>
      )}

      {!selectedPoint && (
        <div className="mt-3 text-center text-[11px] text-muted-foreground italic">
          💡 Survolez un point pour voir le détail · cliquez pour épingler l'analyse d'une journée
        </div>
      )}
    </div>
  );
};

/* ===========================================================
 * Visitor drawer
 * =========================================================== */
const VisitorDrawer: React.FC<{ fingerprint: string | null; onClose: () => void }> = ({
  fingerprint, onClose,
}) => {
  const { data, isLoading } = useVisitorDetail(fingerprint);

  if (!fingerprint) return null;

  return (
    <div className="fixed inset-0 z-[80] flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <aside className="w-full max-w-2xl h-full bg-background border-l border-border overflow-y-auto">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Visiteur</div>
            <div className="font-mono text-sm text-foreground truncate max-w-[400px]">{fingerprint}</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted">
            <X size={18} />
          </button>
        </div>

        {isLoading || !data ? (
          <div className="p-10 flex items-center justify-center text-muted-foreground">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <KpiCard icon={Eye} label="Visites" value={fmtNumber(data.profile.total_visits)} tone="primary" />
              <KpiCard icon={Clock} label="Temps cumulé" value={fmtDuration(data.profile.total_duration)} tone="success" />
            </div>
            <div className="bg-card border border-border rounded-2xl p-5 space-y-2 text-sm">
              <Row k="Pays">
                <span className="inline-flex items-center gap-1.5">
                  {flagFromCountryCode(data.profile.country_code)} {data.profile.country || data.profile.country_code || '—'}
                </span>
              </Row>
              <Row k="Ville">{data.profile.city || '—'} {data.profile.region ? `· ${data.profile.region}` : ''}</Row>
              <Row k="IP">{data.profile.ip_address || '—'}</Row>
              <Row k="Compte lié">
                {data.profile.user_email ? (
                  <span>
                    {data.profile.user_name || '—'} <span className="text-muted-foreground">·</span>{' '}
                    <span className="font-mono text-xs">{data.profile.user_email}</span>
                  </span>
                ) : <span className="text-muted-foreground">Anonyme</span>}
              </Row>
              <Row k="Première visite">{new Date(data.profile.first_seen).toLocaleString('fr-FR')}</Row>
              <Row k="Dernière visite">{new Date(data.profile.last_seen).toLocaleString('fr-FR')}</Row>
            </div>

            <Card title="Annonces cliquées" subtitle={`${data.listing_clicks.length} clics récents`}>
              {data.listing_clicks.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Aucun clic récent</p>
              ) : (
                <ul className="divide-y divide-border">
                  {data.listing_clicks.slice(0, 15).map((c: any) => (
                    <li key={c.id} className="py-2 text-sm flex items-center justify-between gap-4">
                      <span className="truncate">
                        {c.title || <span className="text-muted-foreground">[supprimée]</span>}
                        <span className="text-muted-foreground"> · {c.brand} {c.model}</span>
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(c.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Pages visitées" subtitle={`${data.page_views.length} pages récentes`}>
              {data.page_views.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Aucune page enregistrée</p>
              ) : (
                <ul className="divide-y divide-border max-h-80 overflow-y-auto">
                  {data.page_views.slice(0, 50).map((p: any) => (
                    <li key={p.id} className="py-2 text-sm flex items-center justify-between gap-4">
                      <span className="truncate font-mono text-xs">{p.path}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {fmtMs(p.duration_ms)} · {new Date(p.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Sessions" subtitle={`${data.sessions.length} sessions`}>
              <ul className="divide-y divide-border">
                {data.sessions.slice(0, 10).map((s: any) => (
                  <li key={s.id} className="py-2 text-sm flex items-center justify-between gap-4">
                    <span className="truncate">
                      <span className="text-muted-foreground">{s.referral_source}</span>
                      <span className="mx-2">·</span>
                      {s.device || '—'} / {s.browser || '—'}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {fmtDuration(s.duration_seconds)} · {s.pages_viewed || 0} pages
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}
      </aside>
    </div>
  );
};

const Row: React.FC<React.PropsWithChildren<{ k: string }>> = ({ k, children }) => (
  <div className="flex items-center justify-between gap-4">
    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{k}</span>
    <span className="text-sm text-foreground text-right truncate">{children}</span>
  </div>
);

/* ===========================================================
 * Main tab
 * =========================================================== */
const AudienceTab: React.FC = () => {
  const [period, setPeriod] = useState(30);
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState<string>('');
  const [openFingerprint, setOpenFingerprint] = useState<string | null>(null);

  const { data, isLoading, error } = useAudience(period);
  const { data: funnel, isLoading: funnelLoading } = useFunnel(period);
  const { data: funnelBySource, isLoading: funnelBySourceLoading } = useFunnelBySource(period);
  const { data: visitors, isLoading: visitorsLoading } = useVisitors({
    country_code: countryFilter || undefined,
    search: search || undefined,
    limit: 25,
  });

  const maxCountrySessions = useMemo(
    () => Math.max(1, ...(data?.by_country?.map((c) => c.sessions) || [1])),
    [data],
  );
  const maxClicked = useMemo(
    () => Math.max(1, ...(data?.top_clicked_listings?.map((l) => l.clicks) || [1])),
    [data],
  );
  const maxPages = useMemo(
    () => Math.max(1, ...(data?.top_pages?.map((p) => p.views) || [1])),
    [data],
  );

  /* ---------- Derived KPIs ---------- */
  const derived = useMemo(() => {
    if (!data) {
      return {
        sessionsDelta: 0, visitorsDelta: 0,
        loginRate: 0, ctr: 0,
        totalPageViews: 0, totalClicks: 0,
        peakDay: null as null | { day: string; sessions: number },
        estImpressions: 0, estRevenue: 0,
        topCountryShare: 0,
      };
    }
    const sessionsDelta = trendDelta(data.daily_traffic, 'sessions');
    const visitorsDelta = trendDelta(data.daily_traffic, 'visitors');
    const totalPageViews = data.top_pages.reduce((s, p) => s + Number(p.views || 0), 0);
    const totalClicks = data.top_clicked_listings.reduce((s, l) => s + Number(l.clicks || 0), 0);
    const loginRate = data.kpis.total_sessions > 0
      ? (data.kpis.logged_in_sessions / data.kpis.total_sessions) * 100
      : 0;
    const ctr = totalPageViews > 0 ? (totalClicks / totalPageViews) * 100 : 0;
    const peakDay = data.daily_traffic.length
      ? data.daily_traffic.reduce((acc, d) =>
          Number(d.sessions || 0) > Number(acc.sessions || 0)
            ? { day: d.day, sessions: Number(d.sessions || 0) }
            : acc,
          { day: data.daily_traffic[0].day, sessions: Number(data.daily_traffic[0].sessions || 0) },
        )
      : null;
    const estImpressions = totalPageViews * ADS_PER_VIEW;
    const estRevenue = (estImpressions / 1000) * ASSUMED_CPM_EUR;
    const totalCountrySessions = data.by_country.reduce((s, c) => s + Number(c.sessions || 0), 0);
    const topCountryShare = totalCountrySessions > 0 && data.by_country[0]
      ? (Number(data.by_country[0].sessions || 0) / totalCountrySessions) * 100
      : 0;
    return { sessionsDelta, visitorsDelta, loginRate, ctr, totalPageViews, totalClicks, peakDay, estImpressions, estRevenue, topCountryShare };
  }, [data]);

  if (error) {
    return (
      <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-2xl p-6 text-sm">
        Impossible de charger les données d'audience.
      </div>
    );
  }

  const maxBrowser = Math.max(1, ...(data?.by_browser?.map((b) => b.sessions) || [1]));
  const deviceTotals = (data?.by_device || []).reduce(
    (acc, row) => {
      const key = normalizeDevice(row.device) as 'mobile' | 'tablet' | 'desktop';
      acc[key] += Number(row.sessions || 0);
      return acc;
    },
    { mobile: 0, tablet: 0, desktop: 0 },
  );
  const totalDeviceSessions = deviceTotals.mobile + deviceTotals.tablet + deviceTotals.desktop;
  const maxDevice = Math.max(1, deviceTotals.mobile, deviceTotals.tablet, deviceTotals.desktop);
  const maxOs = Math.max(1, ...(data?.by_os?.map((o) => o.sessions) || [1]));

  return (
    <div className="space-y-8 animate-fade-in pb-4">
      {/* ============= STICKY HEADER ============= */}
      <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-background/85 backdrop-blur-md border-b border-border">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-black text-foreground leading-tight">Audience &amp; monétisation</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Profilage des visiteurs, géolocalisation, engagement et inventaire publicitaire.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {countryFilter && (
              <button
                onClick={() => setCountryFilter('')}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
                title="Retirer le filtre pays"
              >
                {flagFromCountryCode(countryFilter)} {countryFilter}
                <X size={12} />
              </button>
            )}
            <div className="inline-flex rounded-xl bg-muted p-1">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    period === p.value
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ============= SECTION 01 — Vue d'ensemble ============= */}
      <section className="space-y-4">
        <SectionHeader
          index={1}
          icon={Activity}
          title="Vue d'ensemble"
          subtitle={`Indicateurs clés sur ${period} jour${period > 1 ? 's' : ''}`}
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={Users}
            label="Visiteurs uniques"
            value={isLoading ? '—' : fmtNumber(data?.kpis.unique_visitors || 0)}
            hint="Empreintes distinctes"
            tone="primary"
            delta={derived.visitorsDelta}
          />
          <KpiCard
            icon={Eye}
            label="Sessions"
            value={isLoading ? '—' : fmtNumber(data?.kpis.total_sessions || 0)}
            hint={`${fmtNumber(data?.kpis.logged_in_sessions || 0)} connectés (${fmtPct(derived.loginRate)})`}
            tone="blue"
            delta={derived.sessionsDelta}
          />
          <KpiCard
            icon={Clock}
            label="Durée moyenne"
            value={isLoading ? '—' : fmtDuration(data?.kpis.avg_duration || 0)}
            hint={`${(data?.kpis.avg_pages || 0).toFixed(1)} pages / session`}
            tone="success"
          />
          <KpiCard
            icon={MousePointerClick}
            label="Clics annonces"
            value={isLoading ? '—' : fmtNumber(derived.totalClicks)}
            hint={`CTR ${fmtPct(derived.ctr)} sur ${fmtNumber(derived.totalPageViews)} pages vues`}
            tone="amber"
          />
        </div>
      </section>

      {/* ============= SECTION 02 — Monétisation ============= */}
      <section className="space-y-4">
        <SectionHeader
          index={2}
          icon={DollarSign}
          title="Monétisation publicitaire"
          subtitle="Inventaire et revenu potentiel basés sur le trafic mesuré"
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Zap}
          label="Impressions ad. estimées"
          value={isLoading ? '—' : fmtNumber(derived.estImpressions)}
          hint={`${ADS_PER_VIEW} ad/page · base ${fmtNumber(derived.totalPageViews)} vues`}
          tone="violet"
        />
        <KpiCard
          icon={DollarSign}
          label="Revenu pub potentiel"
          value={isLoading ? '—' : fmtCurrency(derived.estRevenue)}
          hint={`CPM hypothèse ${ASSUMED_CPM_EUR}€ · ${period}j`}
          tone="success"
        />
        <KpiCard
          icon={UserCheck}
          label="Taux de connexion"
          value={isLoading ? '—' : fmtPct(derived.loginRate)}
          hint="Sessions avec compte connecté"
          tone="blue"
        />
        <KpiCard
          icon={Target}
          label="Concentration top pays"
          value={isLoading ? '—' : fmtPct(derived.topCountryShare)}
          hint={data?.by_country[0]
            ? `${flagFromCountryCode(data.by_country[0].country_code)} ${data.by_country[0].country || data.by_country[0].country_code}`
            : 'Audience'}
          tone="amber"
        />
        </div>
      </section>

      {/* ============= SECTION 03 — Trafic & conversion ============= */}
      <section className="space-y-4">
        <SectionHeader
          index={3}
          icon={TrendingUp}
          title="Trafic & conversion"
          subtitle="Évolution du trafic, tunnel produit et performance par canal d'acquisition"
        />

        {/* Traffic trend chart */}
        <Card
          title="Tendance trafic"
          subtitle={`Sessions et visiteurs uniques sur ${period} jour${period > 1 ? 's' : ''}`}
          right={
            derived.peakDay && (
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Pic</div>
                <div className="text-sm font-black text-foreground tabular-nums">
                  {fmtNumber(derived.peakDay.sessions)}
                  <span className="text-xs font-medium text-muted-foreground ml-1">
                    · {new Date(derived.peakDay.day).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
              </div>
            )
          }
        >
          {isLoading ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground">
              <Loader2 className="animate-spin" size={20} />
            </div>
          ) : (
            <TrafficChart data={data?.daily_traffic || []} />
          )}
        </Card>

        {/* Product funnel */}
        <FunnelSection
          steps={funnel?.steps}
          loading={funnelLoading}
          overallRate={funnel?.overall_conversion_rate}
          period={period}
        />

        {/* Funnel breakdown by traffic source */}
        <FunnelBySourceSection
          buckets={funnelBySource?.buckets}
          loading={funnelBySourceLoading}
        />
      </section>

      {/* ============= SECTION 04 — Géographie ============= */}
      <section className="space-y-4">
        <SectionHeader
          index={4}
          icon={Globe2}
          title="Géographie"
          subtitle="Origine des sessions par pays et par ville"
        />
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Card
              title="Top pays"
              subtitle="Cliquez sur un pays pour filtrer toute la page"
              right={<Globe2 size={16} className="text-muted-foreground" />}
            >
              {isLoading ? (
                <div className="h-32 flex items-center justify-center text-muted-foreground">
                  <Loader2 className="animate-spin" size={20} />
                </div>
              ) : data?.by_country?.length ? (
                <ul className="space-y-3">
                  {data.by_country.slice(0, 10).map((c) => {
                    const isActive = countryFilter === c.country_code;
                    return (
                      <li
                        key={c.country_code}
                        className={`cursor-pointer rounded-lg p-1.5 -mx-1.5 transition-colors ${
                          isActive ? 'bg-primary/10' : 'hover:bg-muted/40'
                        }`}
                        onClick={() => setCountryFilter(c.country_code === 'XX' ? '' : (isActive ? '' : c.country_code))}
                      >
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className={`font-semibold inline-flex items-center gap-2 ${isActive ? 'text-primary' : 'text-foreground'}`}>
                            <span className="text-base">{flagFromCountryCode(c.country_code)}</span>
                            {c.country || c.country_code}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            <strong className="text-foreground">{fmtNumber(c.sessions)}</strong> sessions ·{' '}
                            {fmtNumber(c.unique_visitors)} visiteurs
                          </span>
                        </div>
                        <Bar value={c.sessions} max={maxCountrySessions} />
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Aucune donnée</p>
              )}
            </Card>
          </div>

          <Card title="Top villes" subtitle="Tunisie & monde" right={<MapPin size={16} className="text-muted-foreground" />}>
            {data?.by_city?.length ? (
              <ul className="space-y-2 text-sm">
                {data.by_city.slice(0, 10).map((c) => (
                  <li key={c.city} className="flex items-center justify-between">
                    <span className="truncate text-foreground">{c.city}</span>
                    <span className="text-xs font-bold text-muted-foreground tabular-nums">{fmtNumber(c.sessions)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">—</p>}
          </Card>
        </div>
      </section>

      {/* ============= SECTION 05 — Technologie ============= */}
      <section className="space-y-4">
        <SectionHeader
          index={5}
          icon={Smartphone}
          title="Technologie"
          subtitle="Appareils et navigateurs utilisés par votre audience"
        />
        <div className="grid md:grid-cols-3 gap-4">
          <DeviceChart label="Téléphones" sessions={deviceTotals.mobile} total={totalDeviceSessions} max={maxDevice} icon={Smartphone} tone="primary" />
          <DeviceChart label="Tablettes" sessions={deviceTotals.tablet} total={totalDeviceSessions} max={maxDevice} icon={Tablet} tone="success" />
          <DeviceChart label="Ordinateurs" sessions={deviceTotals.desktop} total={totalDeviceSessions} max={maxDevice} icon={Monitor} tone="amber" />
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <Card title="Systèmes" subtitle="iOS, Android, desktop" right={<Smartphone size={16} className="text-muted-foreground" />}>
            {data?.by_os?.length ? (
              <ul className="space-y-2.5">
                {data.by_os.slice(0, 6).map((o) => (
                  <li key={o.os}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-foreground">{osLabel(o.os || 'unknown')}</span>
                      <span className="text-xs font-bold text-muted-foreground tabular-nums">{fmtNumber(o.sessions)}</span>
                    </div>
                    <Bar value={o.sessions} max={maxOs} tone={o.os === 'ios' || o.os === 'android' ? 'primary' : 'success'} />
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">Pas de données systèmes</p>}
          </Card>

          <Card title="Navigateurs" subtitle="Répartition par navigateur" right={<Chrome size={16} className="text-muted-foreground" />}>
            {data?.by_browser?.length ? (
              <ul className="space-y-2.5">
                {data.by_browser.slice(0, 6).map((b) => {
                  const Icon = browserIcon(b.browser);
                  return (
                    <li key={b.browser}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="inline-flex items-center gap-2 text-foreground">
                          <Icon size={14} className="text-muted-foreground" />
                          {b.browser || 'Inconnu'}
                        </span>
                        <span className="text-xs font-bold text-muted-foreground tabular-nums">{fmtNumber(b.sessions)}</span>
                      </div>
                      <Bar value={b.sessions} max={maxBrowser} tone="amber" />
                    </li>
                  );
                })}
              </ul>
            ) : <p className="text-sm text-muted-foreground">Pas de données navigateurs</p>}
          </Card>
        </div>
      </section>

      {/* ============= SECTION 06 — Contenu populaire ============= */}
      <section className="space-y-4">
        <SectionHeader
          index={6}
          icon={FileText}
          title="Contenu populaire"
          subtitle="Pages les plus consultées et annonces qui génèrent le plus d'intérêt"
        />
        <div className="grid lg:grid-cols-2 gap-4">
          <Card title="Pages les plus visitées" subtitle="Vues & temps moyen" right={<Activity size={16} className="text-muted-foreground" />}>
            {data?.top_pages?.length ? (
              <ul className="space-y-3">
                {data.top_pages.slice(0, 8).map((p) => (
                  <li key={p.view_name}>
                    <div className="flex items-center justify-between text-sm mb-1 gap-2">
                      <span className="text-foreground text-xs font-semibold truncate">{viewNameLabel(p.view_name)}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        <strong className="text-foreground tabular-nums">{fmtNumber(p.views)}</strong> vues · {fmtMs(p.avg_duration_ms)}
                      </span>
                    </div>
                    <Bar value={p.views} max={maxPages} tone="success" />
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">—</p>}
          </Card>

          <Card
            title="Annonces les plus cliquées"
            subtitle="Preuve de l'intérêt acheteur"
            right={<MousePointerClick size={16} className="text-muted-foreground" />}
          >
            {data?.top_clicked_listings?.length ? (
              <ul className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {data.top_clicked_listings.slice(0, 12).map((l) => (
                  <li key={l.id}>
                    <div className="flex items-center justify-between text-sm mb-1 gap-3">
                      <span className="truncate text-foreground font-semibold">
                        {l.title} <span className="text-muted-foreground font-normal">· {l.brand} {l.model}</span>
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                        <strong className="text-foreground">{fmtNumber(l.clicks)}</strong> clics ·{' '}
                        {fmtNumber(l.unique_clicks)} uniques
                      </span>
                    </div>
                    <Bar value={l.clicks} max={maxClicked} />
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">Pas encore de clics enregistrés</p>}
          </Card>
        </div>
      </section>

      {/* ============= SECTION 07 — Visiteurs ============= */}
      <section className="space-y-4">
        <SectionHeader
          index={7}
          icon={UserCheck}
          title="Liste des visiteurs"
          subtitle="Profilage individuel — cliquez sur une ligne pour ouvrir le détail"
        />
        <Card
          title="Visiteurs récents"
          subtitle={visitors?.visitors?.length ? `${visitors.visitors.length} visiteurs affichés` : undefined}
          right={
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="IP, ville, modèle…"
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-primary/30 w-56"
              />
            </div>
          }
        >
          {visitorsLoading ? (
            <div className="h-32 flex items-center justify-center text-muted-foreground">
              <Loader2 className="animate-spin" size={20} />
            </div>
          ) : visitors?.visitors?.length ? (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    <th className="px-5 py-2">Pays</th>
                    <th className="px-5 py-2">Ville</th>
                    <th className="px-5 py-2">IP</th>
                    <th className="px-5 py-2">Compte</th>
                    <th className="px-5 py-2 text-right">Visites</th>
                    <th className="px-5 py-2 text-right">Temps</th>
                    <th className="px-5 py-2">Dernière</th>
                    <th className="px-5 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {visitors.visitors.map((v: VisitorRow) => (
                    <tr
                      key={v.fingerprint}
                      className="border-t border-border hover:bg-muted/40 transition-colors cursor-pointer"
                      onClick={() => setOpenFingerprint(v.fingerprint)}
                    >
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-base">{flagFromCountryCode(v.country_code)}</span>
                          <span className="text-xs">{v.country_code || '—'}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs">{v.city || '—'}</td>
                      <td className="px-5 py-3 font-mono text-xs">{v.ip_address || '—'}</td>
                      <td className="px-5 py-3 text-xs truncate max-w-[180px]">
                        {v.user_email ? (
                          <span className="text-foreground">{v.user_email}</span>
                        ) : (
                          <span className="text-muted-foreground">Anonyme</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-bold tabular-nums">{fmtNumber(v.total_visits)}</td>
                      <td className="px-5 py-3 text-right text-xs tabular-nums">{fmtDuration(v.total_duration)}</td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">
                        {new Date(v.last_seen).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="px-5 py-3">
                        <ArrowRight size={14} className="text-muted-foreground" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun visiteur enregistré sur la période</p>
          )}
        </Card>
      </section>

      {/* Community brand trends — moved here from Reference tab so all audience
          analytics live in one place. */}
      <section className="space-y-4">
        <SectionHeader
          index={6}
          icon={TrendingUp}
          title="Marques populaires (communauté)"
          subtitle="Tendances de visites par marque sur les 30 derniers jours"
        />
        <BrandTrendsPanel />
      </section>

      {/* Pitch banner — closes the page on a sales note */}
      <div className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
          <Calendar size={24} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold uppercase tracking-widest opacity-80">Argumentaire commercial</div>
          <h3 className="text-lg sm:text-xl font-black mt-0.5">
            {fmtNumber(data?.kpis.unique_visitors || 0)} visiteurs uniques · {fmtNumber(derived.totalPageViews)} pages vues sur {period} jours
          </h3>
          <p className="text-sm opacity-90 mt-1">
            Une audience qualifiée à {fmtPct(derived.topCountryShare)} concentrée sur le marché principal,
            avec {(data?.kpis.avg_pages || 0).toFixed(1)} pages/session et un CTR de {fmtPct(derived.ctr)} —
            soit ≈ {fmtCurrency(derived.estRevenue)} de revenu publicitaire potentiel sur la période.
          </p>
        </div>
      </div>

      <VisitorDrawer fingerprint={openFingerprint} onClose={() => setOpenFingerprint(null)} />
    </div>
  );
};

/* ===========================================================
 * Product funnel — Visitor → Search → Detail → Contact
 * =========================================================== */
const FUNNEL_ICONS: Record<FunnelStep['key'], React.ElementType> = {
  visitor: Users,
  search:  FilterIcon,
  tech_spec: BarChart3,
  detail:  FileText,
  contact: Phone,
};

const FUNNEL_TONES: Record<FunnelStep['key'], { bar: string; chip: string; ring: string }> = {
  visitor: { bar: 'bg-blue-500',    chip: 'bg-blue-100 text-blue-700',       ring: 'text-blue-600' },
  search:  { bar: 'bg-violet-500',  chip: 'bg-violet-100 text-violet-700',   ring: 'text-violet-600' },
  tech_spec: { bar: 'bg-sky-500',   chip: 'bg-sky-100 text-sky-700',         ring: 'text-sky-600' },
  detail:  { bar: 'bg-amber-500',   chip: 'bg-amber-100 text-amber-700',     ring: 'text-amber-600' },
  contact: { bar: 'bg-success-500', chip: 'bg-success-100 text-success-700', ring: 'text-success-600' },
};

const FunnelSection: React.FC<{
  steps?: FunnelStep[];
  loading: boolean;
  overallRate?: number;
  period: number;
}> = ({ steps, loading, overallRate, period }) => {
  const top = steps && steps.length > 0 ? Math.max(1, steps[0].count) : 1;

  return (
    <Card
      title="Tunnel de conversion produit"
      subtitle={`Visiteur → Recherche → Fiche technique → Fiche annonce → Contact (${period} jour${period > 1 ? 's' : ''})`}
      right={
        typeof overallRate === 'number' && (
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Conversion</div>
            <div className={`text-sm font-black tabular-nums ${overallRate > 0 ? 'text-success-700' : 'text-foreground'}`}>
              {fmtPct(overallRate)}
            </div>
          </div>
        )
      }
    >
      {loading ? (
        <div className="h-40 flex items-center justify-center text-muted-foreground">
          <Loader2 className="animate-spin" size={20} />
        </div>
      ) : !steps || steps.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Pas encore de données pour la période.</p>
      ) : (
        <div className="space-y-4">
          {steps.map((step, i) => {
            const Icon = FUNNEL_ICONS[step.key] || Users;
            const tone = FUNNEL_TONES[step.key];
            const widthPct = Math.max(6, Math.round((step.count / top) * 100));
            const fromPrev = i > 0 && steps[i - 1].count > 0
              ? Math.round((step.count / steps[i - 1].count) * 1000) / 10
              : null;
            return (
              <div key={step.key} className="relative">
                {/* Connector line between steps */}
                {i > 0 && (
                  <div className="absolute -top-3 left-5 w-px h-3 bg-border" aria-hidden />
                )}
                <div className="flex items-stretch gap-3">
                  {/* Step number / icon */}
                  <div className={`w-12 min-h-16 shrink-0 rounded-xl flex flex-col items-center justify-center gap-1 text-[10px] font-black uppercase tracking-widest ${tone.chip}`}>
                    <Icon size={16} />
                    <span className="mt-0.5">{i + 1}</span>
                  </div>

                  {/* Bar + content */}
                  <div className="flex-1 min-w-0 bg-muted/40 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <div className="text-sm font-black text-foreground">{step.label}</div>
                        <div className="text-[11px] text-muted-foreground">{step.description}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-lg font-black text-foreground tabular-nums leading-none">
                          {fmtNumber(step.count)}
                        </div>
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                          {fmtPct(step.rate_from_top)} du top
                        </div>
                      </div>
                    </div>
                    {/* Funnel bar — width relative to top of funnel */}
                    <div className="h-2 w-full bg-background rounded-full overflow-hidden">
                      <div
                        className={`h-full ${tone.bar} transition-all duration-500`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    {/* Step-over-step delta */}
                    {fromPrev !== null && (
                      <div className="flex items-center justify-between mt-2 text-[11px]">
                        <span className={`inline-flex items-center gap-1 font-bold ${tone.ring}`}>
                          <ArrowRight size={11} />
                          {fmtPct(fromPrev)} de l'étape précédente
                        </span>
                        {step.drop_off > 0 && (
                          <span className="text-muted-foreground">
                            <strong className="text-destructive">{fmtNumber(step.drop_off)}</strong> abandons
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

/* ===========================================================
 * Funnel by traffic source — compares conversion across channels
 * =========================================================== */
const SOURCE_BUCKET_META: Record<FunnelSourceBucket['key'], {
  icon: React.ElementType;
  badge: string;
  bar: string;
  ring: string;
}> = {
  organic:  { icon: SearchIcon,    badge: 'bg-success-100 text-success-700', bar: 'bg-success-500', ring: 'border-success-300' },
  social:   { icon: Share2,        badge: 'bg-violet-100 text-violet-700',   bar: 'bg-violet-500',  ring: 'border-violet-300' },
  direct:   { icon: MousePointer,  badge: 'bg-blue-100 text-blue-700',       bar: 'bg-blue-500',    ring: 'border-blue-300' },
  referral: { icon: Link2,         badge: 'bg-amber-100 text-amber-700',     bar: 'bg-amber-500',   ring: 'border-amber-300' },
};

const FunnelBySourceSection: React.FC<{
  buckets?: FunnelSourceBucket[];
  loading: boolean;
}> = ({ buckets, loading }) => {
  // Find the "best" bucket (highest overall conversion) so we can highlight it.
  const bestKey = useMemo(() => {
    if (!buckets || buckets.length === 0) return null;
    const withTraffic = buckets.filter((b) => (b.steps[0]?.count || 0) > 0);
    if (withTraffic.length === 0) return null;
    return withTraffic.reduce((best, b) =>
      b.overall_conversion_rate > best.overall_conversion_rate ? b : best
    , withTraffic[0]).key;
  }, [buckets]);

  return (
    <Card
      title="Tunnel par source de trafic"
      subtitle="Comparaison Organique · Social · Direct · Référence — pour décider où investir"
      right={
        bestKey && (
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Meilleur canal</div>
            <div className="text-sm font-black tabular-nums text-success-700">
              {SOURCE_BUCKET_META[bestKey] && buckets?.find((b) => b.key === bestKey)?.label}
            </div>
          </div>
        )
      }
    >
      {loading ? (
        <div className="h-40 flex items-center justify-center text-muted-foreground">
          <Loader2 className="animate-spin" size={20} />
        </div>
      ) : !buckets || buckets.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Pas encore de données pour la période.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {buckets.map((b) => {
            const meta = SOURCE_BUCKET_META[b.key];
            const Icon = meta.icon;
            const top = Math.max(1, b.steps[0]?.count || 0);
            const isBest = b.key === bestKey;
            const hasTraffic = (b.steps[0]?.count || 0) > 0;
            return (
              <div
                key={b.key}
                className={`bg-card border rounded-2xl p-4 transition-shadow ${
                  isBest ? `${meta.ring} shadow-md` : 'border-border'
                }`}
              >
                {/* Bucket header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${meta.badge}`}>
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-black text-foreground">{b.label}</h4>
                        {isBest && (
                          <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-success-500 text-white">
                            Top
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{b.description}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-black text-foreground tabular-nums leading-none">
                      {fmtPct(b.overall_conversion_rate)}
                    </div>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                      conversion
                    </div>
                  </div>
                </div>

                {/* Mini-funnel: 4 horizontal bars */}
                {!hasTraffic ? (
                  <p className="text-xs text-muted-foreground py-3 text-center">
                    Aucun visiteur attribué
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {b.steps.map((step, i) => {
                      const widthPct = Math.max(6, Math.round((step.count / top) * 100));
                      const fromPrev = i > 0 && b.steps[i - 1].count > 0
                        ? Math.round((step.count / b.steps[i - 1].count) * 1000) / 10
                        : null;
                      return (
                        <div key={step.key}>
                          <div className="flex items-center justify-between text-[11px] mb-0.5 gap-2">
                            <span className="text-foreground font-semibold truncate">{step.label}</span>
                            <span className="text-muted-foreground tabular-nums shrink-0">
                              <strong className="text-foreground">{fmtNumber(step.count)}</strong>
                              {fromPrev !== null && (
                                <span className="ml-1.5 text-[10px]">({fmtPct(fromPrev)})</span>
                              )}
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full ${meta.bar} transition-all duration-500`}
                              style={{ width: `${widthPct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

export default AudienceTab;

