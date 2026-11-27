import React, { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from './Input';

type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, 'type' | 'rightIcon'>;

/**
 * Password field with an eye button to show what was typed (Google, Apple,
 * Baymard: fewer typos on phones, no need to type it twice). The button is a
 * 44 px touch target and keeps the focus in the field.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>((props, ref) => {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      {...props}
      ref={ref}
      type={visible ? 'text' : 'password'}
      rightIcon={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          // Keep the caret in the field while toggling.
          onMouseDown={(e) => e.preventDefault()}
          aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          aria-pressed={visible}
          className="-mr-3 w-11 h-11 flex items-center justify-center rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      }
    />
  );
});

PasswordInput.displayName = 'PasswordInput';
