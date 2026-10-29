import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Navigation, ArrowUpDown, ChevronDown, Check } from 'lucide-react';

export type SortOption = string;

interface UserLocation {
  lat: number;
  lng: number;
}

interface SortDropdownProps {
  sortBy: SortOption[];
  onSortChange: (next: SortOption[]) => void;
  options: { value: SortOption; label: string }[];
  userLocation?: UserLocation | null;
  className?: string;
  proximityValue?: string;
}

export const SortDropdown: React.FC<SortDropdownProps> = ({ 
  sortBy, 
  onSortChange, 
  options,
  userLocation = null,
  className = "",
  proximityValue = 'proximity'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
      if (sortBy.length === 1) return; // Garder au moins un tri
      next = sortBy.filter(item => item !== option);
    } else {
      // Pour les garages, on permet le multi-tri si l'user le veut, 
      // mais souvent on veut un tri principal. Ici on suit le pattern multi-tri du Search.
      next = [option, ...sortBy.filter(o => o !== option)];
      
      // Exclusions mutuelles (ex: prix asc vs desc)
      if (option.includes('_asc')) {
        const opposing = option.replace('_asc', '_desc');
        next = next.filter(o => o !== opposing);
      } else if (option.includes('_desc')) {
        const opposing = option.replace('_desc', '_asc');
        next = next.filter(o => o !== opposing);
      }
    }

    onSortChange(next);
  }, [sortBy, onSortChange]);

  const availableOptions = useMemo(() => {
    return options.filter(opt => 
      opt.value !== proximityValue || userLocation !== null
    );
  }, [options, proximityValue, userLocation]);

  const buttonText = useMemo(() => {
    if (sortBy.length > 1) return `${sortBy.length} tris`;
    if (sortBy.length === 1) {
      const activeOpt = options.find(o => o.value === sortBy[0]);
      return activeOpt ? activeOpt.label : 'Trier';
    }
    return 'Trier';
  }, [sortBy, options]);

  const buttonIcon = useMemo(() => {
    if (sortBy.includes(proximityValue)) {
      return <Navigation size={16} className="text-primary-600" />;
    }
    const hasActiveSort = sortBy.length > 1 || (sortBy.length === 1 && sortBy[0] !== options[0]?.value);
    return (
      <ArrowUpDown 
        size={16} 
        className={hasActiveSort ? 'text-primary-600' : 'text-gray-400'} 
      />
    );
  }, [sortBy, options, proximityValue]);

  return (
    <div className={`relative inline-block w-full md:w-auto ${className}`} ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 h-11 rounded-xl border transition-all text-sm font-bold shadow-sm active:scale-95 w-full md:w-auto ${
          isOpen 
            ? 'bg-primary-50 border-primary-500 text-primary-700' 
            : 'bg-card border-gray-200 text-gray-700 hover:border-gray-300'
        }`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="shrink-0">{buttonIcon}</span>
        <span className="flex-1 text-left truncate">{buttonText}</span>
        <ChevronDown 
          size={14} 
          className={`shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div 
          className="absolute right-0 top-full mt-2 w-52 bg-card rounded-xl shadow-xl border border-gray-200 py-2 z-50 animate-scale-in origin-top-right overflow-hidden"
        >
          {availableOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleToggleOption(opt.value)}
              className={`w-full text-left px-4 py-3 text-sm font-bold flex items-center justify-between transition-colors ${
                sortBy.includes(opt.value) 
                  ? 'text-primary-600 bg-primary-50' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                {opt.value === proximityValue && (
                  <Navigation size={14} />
                )}
                {opt.label}
              </div>
              {sortBy.includes(opt.value) && (
                <Check size={14} strokeWidth={3} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
