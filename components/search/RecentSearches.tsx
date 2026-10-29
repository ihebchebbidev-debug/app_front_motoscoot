import React, { useEffect, useState } from 'react';
import { Clock, X } from 'lucide-react';
import { getRecentSearches, removeRecentSearch, clearRecentSearches, RecentSearchEntry } from '../../utils/recentSearches';

interface RecentSearchesProps {
  /** Click handler — receives the saved nav params for `navigateTo('search', params)`. */
  onSelect: (params: Record<string, unknown>) => void;
  className?: string;
}

/**
 * Anonymous-friendly recent searches widget. Reads from localStorage and
 * stays live across same-tab updates via the custom `motoscoot:recentSearchesChanged`
 * event. Hidden when there's nothing to show — no empty placeholder noise.
 */
export const RecentSearches: React.FC<RecentSearchesProps> = ({ onSelect, className = '' }) => {
  const [entries, setEntries] = useState<RecentSearchEntry[]>([]);

  useEffect(() => {
    const refresh = () => setEntries(getRecentSearches());
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key.includes('recentSearches')) refresh();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('motoscoot:recentSearchesChanged', refresh);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('motoscoot:recentSearchesChanged', refresh);
    };
  }, []);

  if (entries.length === 0) return null;

  return (
    <div className={`mt-6 ${className}`}>
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2 text-[12px] font-black uppercase tracking-widest text-gray-500">
          <Clock size={14} className="text-primary-600" />
          Recherches récentes
        </div>
        <button
          type="button"
          onClick={() => { clearRecentSearches(); setEntries([]); }}
          className="text-[11px] font-bold text-gray-400 hover:text-primary-600 transition-colors"
        >
          Effacer
        </button>
      </div>
      <ul className="flex flex-wrap items-center gap-2">
        {entries.map(entry => (
          <li key={entry.label}>
            <button
              type="button"
              onClick={() => onSelect(entry.params)}
              className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-gray-200 text-[12px] font-bold text-gray-700 hover:border-primary-200 hover:bg-primary-50/50 hover:text-primary-700 transition-all"
            >
              <span className="truncate max-w-[200px]">{entry.label}</span>
              <span
                role="button"
                tabIndex={0}
                aria-label={`Retirer ${entry.label}`}
                onClick={(e) => { e.stopPropagation(); removeRecentSearch(entry.label); setEntries(getRecentSearches()); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); removeRecentSearch(entry.label); setEntries(getRecentSearches()); } }}
                className="opacity-50 group-hover:opacity-100 hover:text-red-500 transition-all"
              >
                <X size={12} strokeWidth={3} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RecentSearches;
