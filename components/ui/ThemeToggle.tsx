import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface ThemeToggleProps {
  variant?: 'icon' | 'segmented';
  className?: string;
}

/**
 * Light / Dark / System theme switcher.
 *  - "icon"      : compact single-button cycle (light -> dark -> system)
 *  - "segmented" : 3-state segmented control (great for settings pages)
 */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({ variant = 'icon', className = '' }) => {
  const { theme, preference, setPreference } = useTheme();

  if (variant === 'segmented') {
    const opts: Array<{ key: 'light' | 'dark' | 'system'; label: string; Icon: typeof Sun }> = [
      { key: 'light',  label: 'Clair',   Icon: Sun },
      { key: 'dark',   label: 'Sombre',  Icon: Moon },
      { key: 'system', label: 'Système', Icon: Monitor },
    ];
    return (
      <div className={`inline-flex items-center gap-1 p-1 rounded-xl bg-muted border border-border ${className}`}>
        {opts.map(({ key, label, Icon }) => {
          const active = preference === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setPreference(key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                active
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-pressed={active}
              aria-label={`Thème ${label}`}
            >
              <Icon size={14} /> {label}
            </button>
          );
        })}
      </div>
    );
  }

  const next = preference === 'light' ? 'dark' : preference === 'dark' ? 'system' : 'light';
  const Icon = preference === 'system' ? Monitor : theme === 'dark' ? Moon : Sun;
  const title =
    preference === 'system'
      ? `Thème système (${theme === 'dark' ? 'sombre' : 'clair'})`
      : preference === 'dark'
      ? 'Thème sombre'
      : 'Thème clair';

  return (
    <button
      type="button"
      onClick={() => setPreference(next)}
      title={title}
      aria-label={title}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-full border border-border bg-card text-foreground hover:bg-accent transition-colors ${className}`}
    >
      <Icon size={16} />
    </button>
  );
};

export default ThemeToggle;
