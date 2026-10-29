import React, { useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';

interface SearchFieldProps {
  icon: React.ElementType;
  label: string;
  value: string;
  placeholder: string;
  isOpen: boolean;
  onToggle: () => void;
  isCombobox?: boolean;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  onFocus?: () => void;
  isDisabled?: boolean;
  isLoading?: boolean;
  children?: React.ReactNode;
  innerRef?: React.Ref<HTMLDivElement>;
  /** Optional clear handler — when provided, shows an X to reset the field. */
  onClear?: () => void;
}

export const SearchField: React.FC<SearchFieldProps> = ({
  icon: Icon,
  label,
  value,
  placeholder,
  isOpen,
  onToggle,
  isCombobox = false,
  searchValue = "",
  onSearchChange,
  onFocus,
  isDisabled = false,
  isLoading = false,
  children,
  innerRef,
  onClear,
}) => {
  const hasValue = !!value || (isCombobox && !!searchValue);

  // Close on Escape for keyboard accessibility.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onToggle();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onToggle]);

  // High z-index so the popup floats above sticky headers, hero overlays,
  // ad banners, etc. Stays below modals (z-[10000]+).
  const POPUP_CLASSES =
    "absolute top-[calc(100%+1rem)] left-0 w-full md:w-[calc(100%+2rem)] md:-ml-4 bg-card rounded-xl shadow-2xl border border-gray-100 py-2 max-h-60 overflow-y-auto z-[1000] animate-scale-in origin-top";

  return (
    <div
      className={`flex-1 flex items-center px-4 md:px-5 py-4 md:py-4 border-b md:border-b-0 md:border-r border-gray-100 relative group transition-colors ${isDisabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}`}
      ref={innerRef}
    >
      <Icon className="w-[18px] h-[18px] mr-3 flex-shrink-0 transition-colors text-primary-600" />

      <div className="flex-1 relative min-w-0">
        {isCombobox ? (
          <input
            type="text"
            placeholder={placeholder}
            value={searchValue || value}
            autoComplete="off"
            disabled={isDisabled}
            onFocus={onFocus}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="w-full bg-transparent outline-none font-bold placeholder:text-gray-700 border-none p-0 pr-12 focus:ring-0 transition-colors disabled:cursor-not-allowed text-[15px] text-gray-700"
          />
        ) : (
          <button
            type="button"
            onClick={onToggle}
            disabled={isDisabled}
            className="w-full text-left bg-transparent outline-none font-bold cursor-pointer pr-12 truncate transition-colors disabled:cursor-not-allowed text-[15px] text-gray-700"
          >
            {value || placeholder}
          </button>
        )}

        {/* Right-side controls: clear (when value present) + toggle/spinner. */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {hasValue && onClear && !isLoading && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
              aria-label={`Effacer ${label}`}
            >
              <X size={14} />
            </button>
          )}
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); if (!isDisabled) onToggle(); }}
              disabled={isDisabled}
              className="p-1 text-gray-400 hover:text-gray-700 transition disabled:cursor-not-allowed"
              aria-label={isOpen ? `Fermer ${label}` : `Ouvrir ${label}`}
              aria-expanded={isOpen}
            >
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        </div>

        {isOpen && !isDisabled && (
          <div className={POPUP_CLASSES} role="listbox">
            {children}
          </div>
        )}
      </div>
    </div>
  );
};
