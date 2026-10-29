import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  leftIcon,
  rightIcon,
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
        {leftIcon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          className={`
            w-full py-4 rounded-2xl bg-gray-50 border border-gray-200 outline-none transition-all font-bold text-gray-900 shadow-none
            focus:bg-card focus:border-primary-600 focus:ring-4 focus:ring-primary-50
            ${leftIcon ? 'pl-11' : 'pl-5'}
            ${rightIcon ? 'pr-11' : 'pr-5'}
            ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-50' : ''}
            ${className}
          `}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
            {rightIcon}
          </div>
        )}
      </div>
      {error && <p className="text-[12px] font-bold text-red-600 ml-1 animate-scale-in">{error}</p>}
    </div>
  );
});

Input.displayName = 'Input';