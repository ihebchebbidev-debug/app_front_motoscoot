import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Section } from '../ui/Section';
import { Button } from '../ui/Button';

interface TechSpecsErrorRetryProps {
  /** Short title shown to the user. */
  title?: string;
  /** Helper line describing what failed. */
  description?: string;
  /** Called when the user clicks the retry button. */
  onRetry: () => void;
  /** True while a refetch is in flight (button shows spinner + disabled). */
  isRetrying?: boolean;
  /** Render as a full page block instead of an inline card. */
  fullPage?: boolean;
}

/**
 * Friendly inline error + retry block used by the public Fiches Techniques
 * pages (brands list, models grid, single fiche). All three pages depend on
 * the backend, so we surface a consistent recovery UI rather than a blank
 * grid when a request fails (network, 500, CORS, etc.).
 */
export const TechSpecsErrorRetry: React.FC<TechSpecsErrorRetryProps> = ({
  title = 'Impossible de charger les données',
  description = 'Une erreur est survenue lors du chargement. Vérifiez votre connexion et réessayez.',
  onRetry,
  isRetrying = false,
  fullPage = false,
}) => {
  const block = (
    <div
      role="alert"
      aria-live="assertive"
      className="flex flex-col items-center justify-center text-center bg-card rounded-3xl border border-dashed border-gray-200 py-16 px-6 animate-fade-in-up"
    >
      <div className="relative mb-6">
        <span aria-hidden className="absolute inset-0 -m-6 rounded-full bg-orange-50 blur-xl" />
        <span className="relative flex items-center justify-center w-16 h-16 rounded-full bg-card border border-orange-100 shadow-sm">
          <AlertTriangle className="w-7 h-7 text-orange-500" strokeWidth={2} />
        </span>
      </div>

      <h3 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight mb-2">
        {title}
      </h3>
      <p className="text-sm text-gray-500 max-w-md mb-6">{description}</p>

      <Button
        variant="primary"
        onClick={onRetry}
        disabled={isRetrying}
        className="rounded-xl px-6 py-2.5 text-sm font-bold inline-flex items-center gap-2"
      >
        <RefreshCw size={16} className={isRetrying ? 'animate-spin' : ''} />
        {isRetrying ? 'Nouvelle tentative…' : 'Réessayer'}
      </Button>
    </div>
  );

  if (!fullPage) return block;
  return <Section className="pt-16 md:pt-24 pb-20">{block}</Section>;
};

export default TechSpecsErrorRetry;
