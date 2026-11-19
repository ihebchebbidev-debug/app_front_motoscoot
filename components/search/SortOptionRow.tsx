import React from 'react';
import { Check } from 'lucide-react';

/**
 * One row of a phone sort panel: round choice mark (empty circle, or orange
 * disc with a tick), label, orange tint on the chosen row. The one look for
 * every « Trier » panel (/annonces, /fiches-techniques, a brand's page):
 * the brand list showed a bare tick on the right instead.
 */
interface SortOptionRowProps {
  label: string;
  checked: boolean;
  onSelect: () => void;
  /** After the label (e.g. the location arrow of « Plus proches de moi »). */
  trailing?: React.ReactNode;
}

export const SortOptionRow: React.FC<SortOptionRowProps> = ({ label, checked, onSelect, trailing }) => (
  <button
    type="button"
    role="option"
    aria-selected={checked}
    onClick={onSelect}
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
      {label}
    </span>
    {trailing}
  </button>
);

export default SortOptionRow;
