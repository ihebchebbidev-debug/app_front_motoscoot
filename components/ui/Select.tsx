import React, { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  label,
  error,
  children,
  className = '',
  ...props
}, ref) => {
  return (
    <div className="space-y-2 w-full group">
      {label && (
        <label className="block text-[12px] font-extrabold text-foreground uppercase tracking-[1px] ml-1 transition-colors group-focus-within:text-primary-600">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          className={`
            w-full px-5 py-4 rounded-2xl bg-gray-50 border border-gray-200 outline-none transition-all font-bold text-gray-900 shadow-none
            focus:bg-card focus:border-primary-600 focus:ring-4 focus:ring-primary-50
            appearance-none cursor-pointer
            ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-50' : ''}
            ${className}
          `}
          {...props}
        >
          {children}
        </select>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <ChevronDown size={20} />
        </div>
      </div>
      {error && <p className="text-[12px] font-bold text-red-600 ml-1 animate-scale-in">{error}</p>}
    </div>
  );
});

Select.displayName = 'Select';