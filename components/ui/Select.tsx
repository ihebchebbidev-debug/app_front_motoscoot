import React, { forwardRef, useId, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FIELD_TYPE, useTypeTone } from './TypeScale';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  label,
  error,
  children,
  className = '',
  onChange,
  ...props
}, ref) => {
  // Tie the visible label to the select so it is its accessible name.
  // Nothing chosen yet (the empty first option): grey placeholder text, as in
  // the inputs and the brand picker, so a filled field and an empty one differ.
  const autoId = useId();
  const id = props.id ?? autoId;
  const type = FIELD_TYPE[useTypeTone()];
  // Read from the element itself: the form library sets values without a
  // change event (defaults, a reset when the category changes). A CSS
  // :has(option:checked) rule was not repainted by Chrome after a choice.
  const inner = useRef<HTMLSelectElement | null>(null);
  const [empty, setEmpty] = useState(true);
  useLayoutEffect(() => {
    const el = inner.current;
    if (el && empty !== !el.value) setEmpty(!el.value);
  });
  const setRef = (el: HTMLSelectElement | null) => {
    inner.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  };
  return (
    <div className="space-y-2 w-full group">
      {label && (
        <label htmlFor={id} className={`block ${type.label} ml-1 transition-colors group-focus-within:text-primary-700`}>
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={setRef}
          id={id}
          data-empty={empty || undefined}
          className={`
            w-full pl-5 pr-12 py-4 rounded-2xl bg-gray-50 border border-gray-200 outline-none transition-all ${type.value} text-gray-900 shadow-none
            focus:bg-card focus:border-primary-600 focus:ring-4 focus:ring-primary-50
            appearance-none cursor-pointer truncate
            data-[empty]:text-gray-500 data-[empty]:font-normal [&_option]:text-gray-900
            ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-50' : ''}
            ${className}
          `}
          {...props}
          onChange={(e) => { setEmpty(!e.target.value); onChange?.(e); }}
        >
          {children}
        </select>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <ChevronDown size={20} />
        </div>
      </div>
      {error && <p className={`${type.error} text-red-600 ml-1 animate-scale-in`}>{error}</p>}
    </div>
  );
});

Select.displayName = 'Select';