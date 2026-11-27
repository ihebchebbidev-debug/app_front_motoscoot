import React, { forwardRef, useId } from 'react';

interface HumanCheckProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Shown when the visitor tried to send without ticking the box. */
  error?: string;
}

/**
 * « Je suis humain »: a plain checkbox (keyboard, screen readers, 44 px
 * touch row), ticked at once — no fake « verifying » wait and no third-party
 * branding. It replaces the Cloudflare look-alike. Like the box it replaces,
 * it does not verify anything on the server.
 */
export const HumanCheck = forwardRef<HTMLInputElement, HumanCheckProps>(({ checked, onChange, error }, ref) => {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="flex-1 min-w-0">
      <label htmlFor={id} className="min-h-[44px] inline-flex items-center gap-2.5 cursor-pointer select-none text-[14px] font-medium text-gray-800">
        <input
          ref={ref}
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="h-5 w-5 shrink-0 cursor-pointer rounded-[5px] accent-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
        />
        Je suis humain
      </label>
      {error && (
        <p id={errorId} className="text-[13px] leading-snug text-red-600 font-medium">
          {error}
        </p>
      )}
    </div>
  );
});

HumanCheck.displayName = 'HumanCheck';
