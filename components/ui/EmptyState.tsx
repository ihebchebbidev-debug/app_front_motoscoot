import React from 'react';
import { LucideIcon } from 'lucide-react';

export type EmptyStateVariant = 'default' | 'card' | 'compact' | 'inline';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

interface EmptyStateProps {
  /** Lucide icon component (e.g. `Heart`, `Search`, `Wrench`). */
  icon: LucideIcon;
  /** Bold title — keep under ~6 words. */
  title: string;
  /** Optional supporting line explaining what to do next. */
  description?: string;
  /** Primary CTA (filled). */
  action?: EmptyStateAction;
  /** Secondary CTA (outlined / ghost). */
  secondaryAction?: EmptyStateAction;
  /**
   * - `default`: full panel with dashed border on a light background.
   * - `card`:    elevated white card (used inside dashboards / favorites).
   * - `compact`: short padding, for sidebars or tight grids.
   * - `inline`:  no panel chrome, transparent — for embedding in another section.
   */
  variant?: EmptyStateVariant;
  className?: string;
}

const VARIANT_STYLES: Record<EmptyStateVariant, string> = {
  default:
    'bg-gray-50/60 rounded-[2.5rem] border border-dashed border-gray-200 py-20 px-6',
  card: 'bg-card rounded-3xl border border-gray-100 shadow-sm py-16 px-6',
  compact:
    'bg-gray-50/60 rounded-2xl border border-dashed border-gray-200 py-10 px-6',
  inline: 'py-12 px-6',
};

/**
 * Reusable polished empty-state for zero-result API surfaces:
 * search, favorites, garages, reviews, tech-specs, etc.
 *
 * The decorative icon halo uses brand-aligned token colors so it adapts to
 * dark mode and theme overrides automatically.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  variant = 'default',
  className = '',
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center text-center animate-fade-in-up ${VARIANT_STYLES[variant]} ${className}`}
    >
      {/* Decorative icon with concentric haloes */}
      <div className="relative mb-6">
        <span
          aria-hidden
          className="absolute inset-0 -m-6 rounded-full bg-primary-50/50 blur-xl"
        />
        <span
          aria-hidden
          className="absolute inset-0 -m-2 rounded-full bg-primary-100/60"
        />
        <span className="relative flex items-center justify-center w-16 h-16 rounded-full bg-card border border-primary-100 shadow-sm">
          <Icon className="w-7 h-7 text-primary-600" strokeWidth={2} />
        </span>
      </div>

      <h3 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-gray-500 text-sm md:text-[15px] font-medium max-w-md leading-relaxed">
          {description}
        </p>
      )}

      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-8">
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl bg-primary-600 text-white font-black text-[12px] uppercase tracking-widest shadow-lg shadow-primary-600/20 hover:bg-primary-700 active:scale-[0.98] transition-all"
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl bg-card text-gray-700 font-black text-[12px] uppercase tracking-widest border border-gray-200 hover:border-primary-200 hover:text-primary-600 active:scale-[0.98] transition-all"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
