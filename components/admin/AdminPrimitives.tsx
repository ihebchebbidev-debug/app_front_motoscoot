import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  trend?: { value: number; positive?: boolean };
  tone?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'slate';
}

const TONE: Record<NonNullable<StatCardProps['tone']>, { bg: string; text: string }> = {
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-600' },
  green:  { bg: 'bg-green-50',  text: 'text-green-600' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-600' },
  red:    { bg: 'bg-red-50',    text: 'text-red-600' },
  slate:  { bg: 'bg-slate-100', text: 'text-slate-700' },
};

export const StatCard: React.FC<StatCardProps> = ({ icon: Icon, label, value, hint, trend, tone = 'slate' }) => {
  const { bg, text } = TONE[tone];
  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bg} ${text}`}>
          <Icon size={20} strokeWidth={2.25} />
        </div>
        {trend && (
          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md ${
            trend.positive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
          }`}>
            {trend.positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(trend.value)}%
          </span>
        )}
      </div>
      <p className="text-[12px] font-medium text-slate-500 mb-1">{label}</p>
      <h3 className="text-[28px] leading-none font-black text-slate-900 tracking-tight tabular-nums">{value}</h3>
      {hint && <p className="text-[11px] text-slate-400 mt-2">{hint}</p>}
    </div>
  );
};

interface AdminTableProps {
  columns: string[];
  loading?: boolean;
  empty?: string;
  rowCount: number;
  children: React.ReactNode;
}

export const AdminTable: React.FC<AdminTableProps> = ({ columns, loading, empty = 'Aucun résultat', rowCount, children }) => (
  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
    <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
      <table className="w-full text-left border-collapse min-w-[640px]">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/60 text-slate-500 text-[11px] uppercase tracking-wider">
            {columns.map((c) => (
              <th key={typeof c === 'string' ? c : Math.random()} className="px-3 md:px-4 py-3 font-bold whitespace-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? (
            <tr><td colSpan={columns.length} className="p-10 text-center text-sm font-medium text-slate-400">Chargement…</td></tr>
          ) : rowCount === 0 ? (
            <tr><td colSpan={columns.length} className="p-10 text-center text-sm font-medium text-slate-400">{empty}</td></tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  </div>
);

export const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { bg: string; text: string; label: string; dot: string }> = {
    pending:   { bg: 'bg-orange-50', text: 'text-orange-700', label: 'En attente', dot: 'bg-orange-500' },
    active:    { bg: 'bg-green-50',  text: 'text-green-700',  label: 'Active',     dot: 'bg-green-500' },
    rejected:  { bg: 'bg-red-50',    text: 'text-red-700',    label: 'Rejetée',    dot: 'bg-red-500' },
    sold:      { bg: 'bg-slate-100', text: 'text-slate-700',  label: 'Vendue',     dot: 'bg-slate-400' },
    expired:   { bg: 'bg-slate-100', text: 'text-slate-500',  label: 'Expirée',    dot: 'bg-slate-300' },
    published: { bg: 'bg-green-50',  text: 'text-green-700',  label: 'Publié',     dot: 'bg-green-500' },
    verified:  { bg: 'bg-blue-50',   text: 'text-blue-700',   label: 'Vérifié',    dot: 'bg-blue-500' },
  };
  const cfg = map[status] || { bg: 'bg-slate-100', text: 'text-slate-600', label: status, dot: 'bg-slate-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

/* ============================================================
 * Section / Card primitives — for consistent spacing across tabs
 * ============================================================ */

export const AdminCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white rounded-xl border border-slate-200 ${className}`}>
    {children}
  </div>
);

interface AdminSectionProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export const AdminSection: React.FC<AdminSectionProps> = ({ title, description, actions, children }) => (
  <section className="mb-8 last:mb-0">
    <div className="flex items-end justify-between gap-4 mb-4">
      <div>
        <h2 className="text-base font-bold text-slate-900 tracking-tight">{title}</h2>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
    {children}
  </section>
);
