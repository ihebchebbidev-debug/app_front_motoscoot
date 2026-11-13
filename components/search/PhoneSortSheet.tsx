import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ArrowUpDown, Check, Navigation } from 'lucide-react';
import { ChoiceSheet } from './ChoiceSheet';
import type { SortOption } from '../../hooks/useListingFilters';
import { nextPhoneSort } from '../../utils/phoneSort';

/**
 * Tri des annonces sur téléphone (moins de 768 px).
 *
 * Un bouton « trier » ouvre la feuille commune (ChoiceSheet) avec une liste à
 * choix UNIQUE : on touche une option, la feuille se ferme et la liste est
 * triée. L'ordinateur et la tablette gardent leur menu (SortDropdown).
 *
 * « Autour de moi » : le rayon ne filtre que si 'proximity' reste dans le tri
 * (filtersToServerParams). On le garde donc en second, invisible : le
 * visiteur voit et choisit un seul tri, la recherche autour de lui continue.
 */

interface PhoneSortSheetProps {
  sortBy: SortOption[];
  onSortChange: (next: SortOption[]) => void;
  /** « Plus proches » n'est proposé qu'une fois la position connue. */
  hasLocation: boolean;
}

const OPTIONS: { value: SortOption; label: string; short: string }[] = [
  { value: 'recent', label: 'Plus récentes', short: 'Plus récentes' },
  { value: 'proximity', label: 'Plus proches de moi', short: 'Plus proches' },
  { value: 'price_asc', label: 'Prix le plus bas', short: 'Prix bas' },
  { value: 'price_desc', label: 'Prix le plus haut', short: 'Prix haut' },
  { value: 'year_desc', label: 'Année la plus récente', short: 'Année récente' },
  { value: 'km_asc', label: 'Kilométrage le plus bas', short: 'Km bas' },
];

export const PhoneSortSheet: React.FC<PhoneSortSheetProps> = ({ sortBy, onSortChange, hasLocation }) => {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const current = sortBy[0] || 'recent';

  const options = useMemo(
    () => OPTIONS.filter((o) => o.value !== 'proximity' || hasLocation),
    [hasLocation],
  );
  const currentShort = OPTIONS.find((o) => o.value === current)?.short ?? 'Trier';
  const isDefault = current === 'recent';

  const close = useCallback(() => setOpen(false), []);

  const pick = (option: SortOption) => {
    if (option !== current) onSortChange(nextPhoneSort(option, sortBy));
    setOpen(false);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Trier les annonces : ${OPTIONS.find((o) => o.value === current)?.label ?? 'Plus récentes'}`}
        className={`w-full h-11 flex items-center justify-center gap-2 px-3 rounded-xl border text-sm font-bold shadow-sm transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.97] ${
          isDefault
            ? 'bg-card border-gray-200 text-gray-800'
            : 'bg-primary-50 border-primary-300 text-primary-800'
        }`}
      >
        {current === 'proximity'
          ? <Navigation size={16} aria-hidden="true" className="shrink-0" />
          : <ArrowUpDown size={16} aria-hidden="true" className={`shrink-0 ${isDefault ? 'text-gray-500' : ''}`} />}
        <span className="truncate">{currentShort}</span>
      </button>

      <ChoiceSheet open={open} label="Trier les annonces" onClose={close} returnFocus={buttonRef}>
        {options.map((o) => {
          const checked = o.value === current;
          return (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={checked}
              onClick={() => pick(o.value)}
              className={`w-full min-h-[52px] flex items-center gap-3 px-5 py-3 text-left transition-colors active:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gray-900 ${
                checked ? 'bg-primary-50' : ''
              }`}
            >
              <span
                aria-hidden="true"
                className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center ${
                  checked ? 'bg-primary-600 border-primary-600 text-white' : 'border-gray-300 bg-white'
                }`}
              >
                {checked && <Check size={13} strokeWidth={3} />}
              </span>
              <span className={`flex-1 text-[15px] font-semibold ${checked ? 'text-primary-800' : 'text-gray-900'}`}>
                {o.label}
              </span>
              {o.value === 'proximity' && <Navigation size={16} aria-hidden="true" className="shrink-0 text-gray-500" />}
            </button>
          );
        })}
      </ChoiceSheet>
    </>
  );
};

export default PhoneSortSheet;
