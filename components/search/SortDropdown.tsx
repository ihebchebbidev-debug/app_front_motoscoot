import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Navigation, ArrowUpDown, ChevronDown, Check } from 'lucide-react';
import { SortOption } from '../../hooks/useListingFilters';

interface UserLocation {
  lat: number;
  lng: number;
}

interface SortDropdownProps {
  sortBy: SortOption[];
  onSortChange: (next: SortOption[]) => void;
  userLocation: UserLocation | null;
}

const SORT_LABELS: Record<SortOption, string> = {
  recent: 'Plus récentes',
  proximity: 'Plus proches',
  price_asc: 'Prix : Croissant',
  price_desc: 'Prix : Décroissant',
  year_desc: 'Année : Récente',
  km_asc: 'Kilométrage : Bas'
} as const;

const ALL_SORT_OPTIONS: readonly SortOption[] = [
  'recent',
  'proximity',
  'price_asc',
  'price_desc',
  'year_desc',
  'km_asc'
] as const;

export const SortDropdown: React.FC<SortDropdownProps> = ({ 
  sortBy, 
  onSortChange, 
  userLocation 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const closeDropdown = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, closeDropdown]);

  const handleToggleOption = useCallback((option: SortOption) => {
    const isActive = sortBy.includes(option);
    let next: SortOption[];

    if (isActive) {
      next = sortBy.filter(item => item !== option);
    } else {
      next = [option, ...sortBy.filter(o => o !== option)];
      
      if (option === 'price_asc') {
        next = next.filter(o => o !== 'price_desc');
      } else if (option === 'price_desc') {
        next = next.filter(o => o !== 'price_asc');
      }
    }

    if (next.length === 0) next = ['recent'];

    onSortChange(next);
  }, [sortBy, onSortChange]);

  const availableOptions = useMemo(() => {
    return ALL_SORT_OPTIONS.filter(option => 
      option !== 'proximity' || userLocation !== null
    );
  }, [userLocation]);

  const buttonText = useMemo(() => {
    if (sortBy.length > 1) return `${sortBy.length} tris`;
    if (sortBy.length === 1) return SORT_LABELS[sortBy[0]];
    return 'Trier';
  }, [sortBy]);

  const buttonIcon = useMemo(() => {
    if (sortBy.includes('proximity')) {
      return <Navigation size={16} className="text-primary-600" />;
    }
    const hasActiveSortOtherThanRecent = sortBy.length > 0 && (sortBy[0] !== 'recent' || sortBy.length > 1);
    return (
      <ArrowUpDown 
        size={16} 
        className={hasActiveSortOtherThanRecent ? 'text-primary-600' : 'text-gray-400'} 
      />
    );
  }, [sortBy]);

  return (
    <div className="relative inline-block w-full md:w-auto" ref={containerRef}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 h-11 rounded-xl border transition-all text-sm font-bold shadow-sm active:scale-95 w-full md:w-auto ${
          isOpen 
            ? 'bg-primary-50 border-primary-500 text-primary-700' 
            : 'bg-card border-gray-200 text-gray-700 hover:border-gray-300'
        }`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Options de tri"
      >
        <span className="shrink-0">{buttonIcon}</span>
        <span className="flex-1 text-left truncate">{buttonText}</span>
        <ChevronDown 
          size={14} 
          className={`shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div 
          className="absolute left-0 right-0 md:left-auto md:right-0 top-full mt-2 w-full md:w-52 bg-card rounded-xl shadow-xl border border-gray-200 py-2 z-50 animate-scale-in origin-top md:origin-top-right overflow-hidden max-w-[calc(100vw-2rem)]"
          role="listbox"
          aria-label="Options de tri disponibles"
        >
          {availableOptions.map((option) => (
            <button
              key={option}
              onClick={() => handleToggleOption(option)}
              className={`w-full text-left px-4 py-3 text-sm font-bold flex items-center justify-between transition-colors ${
                sortBy.includes(option) 
                  ? 'text-primary-600 bg-primary-50' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              role="option"
              aria-selected={sortBy.includes(option)}
            >
              <div className="flex items-center gap-2">
                {option === 'proximity' && (
                  <Navigation size={14} aria-hidden="true" />
                )}
                {SORT_LABELS[option]}
              </div>
              {sortBy.includes(option) && (
                <Check size={14} strokeWidth={3} aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};