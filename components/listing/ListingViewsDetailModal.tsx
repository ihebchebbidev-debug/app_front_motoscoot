/**
 * ListingViewsDetailModal — Pro-only daily views breakdown.
 *
 * Opened from the Performance widget. Shows a per-day bar chart and a
 * table with views & contacts for every day of the stats window.
 */
import React, { useMemo, useEffect } from 'react';
import { X, Eye, MessageCircle, BarChart3 } from 'lucide-react';
import type { ListingStats } from '../../services/listingsApi';

interface Props {
  stats: ListingStats;
  listingTitle?: string;
  onClose: () => void;
}

interface Row { day: string; views: number; contacts: number; }

function buildRows(stats: ListingStats): Row[] {
  const v = new Map(stats.views_by_day.map(p => [p.day, p.count]));
  const c = new Map(stats.contacts_by_day.map(p => [p.day, p.count]));
  const out: Row[] = [];
  const today = new Date();
  for (let i = stats.window_days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ day: key, views: v.get(key) ?? 0, contacts: c.get(key) ?? 0 });
  }
  return out;
}

const ListingViewsDetailModal: React.FC<Props> = ({ stats, listingTitle, onClose }) => {
  const rows = useMemo(() => buildRows(stats), [stats]);
  const maxViews = useMemo(() => Math.max(1, ...rows.map(r => r.views)), [rows]);
  const totalViews = rows.reduce((s, r) => s + r.views, 0);
  const totalContacts = rows.reduce((s, r) => s + r.contacts, 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const fmtDay = (iso: string) => {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' });
  };

  return (
    <div
      className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-card w-full md:max-w-2xl max-h-[92vh] rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-5 md:px-7 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center ring-1 ring-primary-100 shrink-0">
              <BarChart3 size={20} strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-foreground text-base md:text-lg leading-tight truncate">
                Détail des vues par jour
              </h3>
              {listingTitle && (
                <p className="text-[12px] text-gray-500 font-semibold truncate">{listingTitle}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700 shrink-0"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-2 gap-3 px-5 md:px-7 py-4 border-b border-gray-100 bg-gray-50/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center">
              <Eye size={16} strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-xl font-extrabold tabular-nums leading-none">{totalViews.toLocaleString('fr-FR')}</div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                Vues / {stats.window_days}j
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <MessageCircle size={16} strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-xl font-extrabold tabular-nums leading-none">{totalContacts.toLocaleString('fr-FR')}</div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                Contacts / {stats.window_days}j
              </div>
            </div>
          </div>
        </div>

        {/* Body — scrollable list with bars */}
        <div className="flex-1 overflow-y-auto px-3 md:px-5 py-3">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <th className="text-left px-2 py-2">Jour</th>
                <th className="text-left px-2 py-2 w-[55%]">Vues</th>
                <th className="text-right px-2 py-2">Contacts</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const pct = (r.views / maxViews) * 100;
                return (
                  <tr key={r.day} className="border-t border-gray-50">
                    <td className="px-2 py-2 font-semibold text-foreground whitespace-nowrap">
                      {fmtDay(r.day)}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="tabular-nums text-[12px] font-extrabold text-foreground w-8 text-right">
                          {r.views}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums font-bold text-emerald-600">
                      {r.contacts > 0 ? r.contacts : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ListingViewsDetailModal;
