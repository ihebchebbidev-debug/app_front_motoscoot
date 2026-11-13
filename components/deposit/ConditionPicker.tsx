import React, { forwardRef, useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { ChoiceSheet } from '../search/ChoiceSheet';
import { FIELD_TYPE, useTypeTone } from '../ui/TypeScale';
import { TAP } from './pickerParts';

/**
 * « État » of the listing form: a field that opens a modal (phones: a sheet
 * from the bottom; from 768 px: a dialog in the middle) listing each
 * condition with the one line that says what it means. Choosing closes it.
 */

interface ConditionPickerProps {
  label: string;
  value: string;
  onChange: (condition: string) => void;
  onBlur?: () => void;
  options: { value: string; hint?: string }[];
  error?: string;
}

export const ConditionPicker = forwardRef<HTMLButtonElement, ConditionPickerProps>(({ label, value, onChange, onBlur, options, error }, ref) => {
  const type = FIELD_TYPE[useTypeTone()];
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  const openModal = () => setOpen(true);
  // Keyboard: once the modal is on screen, start on the chosen condition (else
  // the first one). The sheet mounts in a portal a few frames later.
  useEffect(() => {
    if (!open) return;
    // A short timer, not requestAnimationFrame (paused in a hidden tab).
    let tries = 0;
    let timer = 0;
    const focusChoice = () => {
      const list = document.querySelector('[data-searchbar-sheet] [role=listbox]');
      const target = list?.querySelector<HTMLElement>('[aria-selected=true]') ?? list?.querySelector<HTMLElement>('[role=option]');
      if (target) target.focus({ preventScroll: true });
      else if (++tries < 20) timer = window.setTimeout(focusChoice, 16);
    };
    timer = window.setTimeout(focusChoice, 16);
    return () => window.clearTimeout(timer);
  }, [open]);
  const close = () => {
    setOpen(false);
    onBlur?.();
    window.setTimeout(() => buttonRef.current?.focus(), 0);
  };
  const pick = (v: string) => { onChange(v); close(); };

  return (
    <div className="space-y-2 w-full group">
      <label htmlFor={id} className={`block ${type.label} ml-1 transition-colors group-focus-within:text-primary-700`}>
        {label}
      </label>
      <div className="relative">
        <button
          id={id}
          ref={(el) => {
            buttonRef.current = el;
            if (typeof ref === 'function') ref(el);
            else if (ref) ref.current = el;
          }}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-invalid={!!error || undefined}
          onClick={openModal}
          className={`
            ${TAP} w-full flex flex-col items-start pl-5 pr-12 py-4 rounded-2xl bg-gray-50 border border-gray-200 outline-none transition-all ${type.value} text-left text-gray-900
            focus-visible:bg-card focus-visible:border-primary-600 focus-visible:ring-4 focus-visible:ring-primary-50
            ${open ? 'bg-card border-primary-600 ring-4 ring-primary-50' : ''}
            ${error ? 'border-red-500 focus-visible:border-red-500 focus-visible:ring-red-50' : ''}
          `}
        >
          <span className={`truncate max-w-full ${value ? '' : 'text-gray-500 font-normal'}`}>{value || 'Choisir l’état'}</span>
          {/* The chosen condition's meaning, under it: the seller sees what he promised. */}
          {current?.hint && <span className="mt-0.5 max-w-full truncate text-[13px] font-normal text-gray-600">{current.hint}</span>}
        </button>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <ChevronDown size={20} />
        </div>
      </div>
      {error && <p className={`${type.error} text-red-600 ml-1 animate-scale-in`}>{error}</p>}

      {/* No anchor: a modal everywhere (bottom sheet on phones, centred dialog from 768 px). */}
      <ChoiceSheet open={open} label={label} onClose={close}>
        {options.map((o) => {
          const checked = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={checked}
              onClick={() => pick(o.value)}
              className={`${TAP} w-full min-h-[64px] flex items-start gap-3 px-5 py-3 text-left transition-colors active:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gray-900 ${checked ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 shrink-0 w-5 h-5 rounded-full border flex items-center justify-center ${checked ? 'bg-primary-600 border-primary-600 text-white' : 'border-gray-300 bg-white'}`}
              >
                {checked && <Check size={13} strokeWidth={3} />}
              </span>
              <span className="min-w-0">
                <span className={`block text-[15px] font-semibold ${checked ? 'text-primary-800' : 'text-gray-900'}`}>{o.value}</span>
                {o.hint && <span className="block mt-0.5 text-[13px] leading-snug text-gray-600">{o.hint}</span>}
              </span>
            </button>
          );
        })}
      </ChoiceSheet>
    </div>
  );
});

ConditionPicker.displayName = 'ConditionPicker';
