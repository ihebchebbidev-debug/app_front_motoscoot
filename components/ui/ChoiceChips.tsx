import React, { forwardRef, useId } from 'react';
import { Check } from 'lucide-react';
import { FIELD_TYPE, useTypeTone } from './TypeScale';

/**
 * A short list shown whole instead of hidden in a drop-down (Baymard: with
 * few options, radio buttons beat a drop-down; every choice is seen at once
 * and takes one tap). Real radio inputs, so the keyboard (arrows) and screen
 * readers work as for any radio group.
 *
 * - `chips`: one line each, wrapping (sizes, types…).
 * - `cards`: a name and a one-line explanation (the listing's condition).
 */

export interface ChoiceOption {
  value: string;
  label?: string;
  hint?: string;
}

interface ChoiceChipsProps {
  label: string;
  name: string;
  options: ChoiceOption[];
  value?: string | null;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  variant?: 'chips' | 'cards';
  className?: string;
}

const BOX = 'relative cursor-pointer select-none touch-manipulation rounded-xl border transition-colors '
  + 'text-gray-900 font-medium border-gray-200 bg-gray-50 hover:border-gray-400 active:bg-gray-100 '
  // The chosen one reads at a glance: a 2 px orange edge, tinted, dark-orange text (no bold: it would shift the row).
  + 'has-[:checked]:border-primary-600 has-[:checked]:ring-1 has-[:checked]:ring-primary-600 has-[:checked]:bg-primary-50 has-[:checked]:text-primary-800 '
  + 'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gray-900';

export const ChoiceChips = forwardRef<HTMLInputElement, ChoiceChipsProps>(({
  label, name, options, value, onChange, onBlur, error, variant = 'chips', className = '',
}, ref) => {
  const type = FIELD_TYPE[useTypeTone()];
  const errorId = useId();
  const cards = variant === 'cards';
  return (
    <fieldset
      className={`min-w-0 ${className}`}
      aria-invalid={!!error || undefined}
      aria-describedby={error ? errorId : undefined}
    >
      <legend className={`${type.label} ml-1 mb-2`}>{label}</legend>
      <div className={cards ? 'grid grid-cols-1 sm:grid-cols-2 gap-2' : 'flex flex-wrap gap-2'}>
        {options.map((o, i) => {
          const checked = value === o.value;
          return (
            <label
              key={o.value}
              className={`${BOX} ${cards ? 'flex items-start gap-3 px-4 py-3 min-h-[64px]' : 'inline-flex items-center justify-center min-h-[44px] min-w-[52px] px-4'} ${error && !value ? 'border-red-300' : ''}`}
            >
              <input
                // The first radio takes the form's ref: an error focuses the group.
                ref={i === 0 ? ref : undefined}
                type="radio"
                name={name}
                value={o.value}
                checked={checked}
                onChange={() => onChange(o.value)}
                onBlur={onBlur}
                className="sr-only"
              />
              {cards && (
                <span
                  aria-hidden="true"
                  className={`mt-0.5 shrink-0 w-5 h-5 rounded-full border flex items-center justify-center ${checked ? 'bg-primary-600 border-primary-600 text-white' : 'border-gray-300 bg-white'}`}
                >
                  {checked && <Check size={13} strokeWidth={3} />}
                </span>
              )}
              {cards ? (
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold">{o.label ?? o.value}</span>
                  {o.hint && <span className="block mt-0.5 text-[13px] leading-snug text-gray-600">{o.hint}</span>}
                </span>
              ) : (
                <span className="text-[15px]">{o.label ?? o.value}</span>
              )}
            </label>
          );
        })}
      </div>
      {error && <p id={errorId} className={`${type.error} text-red-600 ml-1 mt-2 animate-scale-in`}>{error}</p>}
    </fieldset>
  );
});

ChoiceChips.displayName = 'ChoiceChips';
