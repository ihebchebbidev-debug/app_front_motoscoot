import React, { forwardRef, useId, useState } from 'react';
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
 * - `tiles`: a photo above the name (the listing's category, the first choice).
 */

export interface ChoiceOption {
  value: string;
  label?: string;
  hint?: string;
  /** `tiles` only: the photo (no photo, or a failed one: the name alone). */
  image?: { src: string; srcSet?: string } | null;
}

interface ChoiceChipsProps {
  label: string;
  name: string;
  options: ChoiceOption[];
  value?: string | null;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  variant?: 'chips' | 'cards' | 'tiles';
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
  const tiles = variant === 'tiles';
  return (
    <fieldset
      className={`min-w-0 ${className}`}
      aria-invalid={!!error || undefined}
      aria-describedby={error ? errorId : undefined}
    >
      <legend className={`${type.label} ml-1 mb-2`}>{label}</legend>
      <div className={tiles ? 'grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3' : cards ? 'grid grid-cols-1 sm:grid-cols-2 gap-2' : 'flex flex-wrap gap-2'}>
        {options.map((o, i) => {
          const checked = value === o.value;
          return (
            <label
              key={o.value}
              className={`${BOX} ${tiles ? 'group flex flex-col overflow-hidden bg-card' : cards ? 'flex items-start gap-3 px-4 py-3 min-h-[64px]' : 'inline-flex items-center justify-center min-h-[44px] min-w-[52px] px-4'} ${error && !value ? 'border-red-300' : ''}`}
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
              {tiles ? (
                <>
                  <TilePhoto image={o.image} />
                  <span className="px-3 py-2.5 text-center text-[15px] font-semibold">{o.label ?? o.value}</span>
                </>
              ) : cards ? (
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

/** Square-ish photo of a tile; a photo that fails to load leaves the name alone. */
const TilePhoto: React.FC<{ image?: ChoiceOption['image'] }> = ({ image }) => {
  const [failed, setFailed] = useState(false);
  if (!image || failed) return null;
  return (
    <span className="block aspect-[4/3] overflow-hidden bg-gray-50">
      <img
        src={image.src}
        srcSet={image.srcSet}
        // 2 columns on phones, 4 from 640 px in the 896 px form.
        sizes="(max-width: 639px) 46vw, 210px"
        alt=""
        width={300}
        height={225}
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => setFailed(true)}
        className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03] motion-reduce:group-hover:scale-100"
      />
    </span>
  );
};
