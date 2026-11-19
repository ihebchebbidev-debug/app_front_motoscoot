import React from 'react';

/**
 * A labelled on/off switch (native checkbox with role="switch": keyboard,
 * screen readers and the label click work without script). Rows of the phone
 * filter panels: /annonces (MobileFilters) and the shared FilterBar.
 */
export const SwitchRow: React.FC<{ icon: React.ReactNode; label: string; checked: boolean; onChange: (v: boolean) => void }> = ({ icon, label, checked, onChange }) => (
  <label className="flex items-center justify-between gap-3 min-h-[56px] cursor-pointer">
    <span className="flex items-center gap-3">
      <span className={checked ? 'text-primary-600' : 'text-gray-500'} aria-hidden="true">{icon}</span>
      <span className="text-[15px] font-semibold text-gray-900">{label}</span>
    </span>
    <span className="relative shrink-0">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className={`block w-12 h-7 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-gray-900 ${checked ? 'bg-primary-600' : 'bg-gray-300'}`} />
      <span className={`absolute left-1 top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </span>
  </label>
);
