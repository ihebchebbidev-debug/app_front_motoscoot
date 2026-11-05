import React, { memo } from 'react';
import { Check } from 'lucide-react';

interface StepProgressProps {
  /** Current step, 1-based. */
  step: number;
  /** Names of the steps, in order (their count is the number of steps). */
  steps: string[];
  /** Go back to a finished step (wide screens: the finished steps are buttons). */
  onStepClick?: (step: number) => void;
}

/**
 * Where am I, how many are left, what comes next.
 * - Phones and tablets: one segment per step, « Étape 2 sur 5 » and
 *   « Ensuite : Équipements ».
 * - Wide screens (xl): the steps by name; finished steps go back to that step.
 * No percentage: a number of steps says it better, and « 20 % » on an empty
 * first step read as work already done.
 */
export const StepProgress = memo(({ step, steps, onStepClick }: StepProgressProps) => {
  const total = steps.length;
  const next = steps[step]; // undefined on the last step

  return (
    <nav aria-label="Progression du dépôt" className="px-4 md:px-12 pt-6 md:pt-10">
      {/* Phones / tablets */}
      <div className="xl:hidden">
        <ol className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
          {steps.map((name, i) => (
            <li
              key={name}
              aria-current={i + 1 === step ? 'step' : undefined}
              className={`h-1.5 rounded-full transition-colors duration-300 ${i < step ? 'bg-primary-600' : 'bg-gray-200'}`}
            >
              <span className="sr-only">{`${name}${i + 1 < step ? ' (terminée)' : i + 1 === step ? ' (en cours)' : ''}`}</span>
            </li>
          ))}
        </ol>
        <div className="mt-3 flex items-baseline justify-between gap-4 text-[13px]">
          <p className="font-semibold text-gray-900 tabular-nums">Étape {step} sur {total}</p>
          <p className="text-gray-600 truncate">{next ? `Ensuite : ${next}` : 'Dernière étape'}</p>
        </div>
      </div>

      {/* Wide screens: named steps. The first step sits on the content's left
          edge and the last on its right edge (like the title and the fields
          below); the others are evenly spaced between, so every name stays on
          one line. Circle 24 px, connectors 8 px from each circle. */}
      <ol className="hidden xl:block relative h-[52px]">
        {steps.map((name, i) => {
          const n = i + 1;
          const done = n < step;
          const current = n === step;
          const first = i === 0;
          const last = i === total - 1;
          // Centre of circle i, as a fraction of the track between the outer circles.
          const at = total > 1 ? i / (total - 1) : 0;
          const position: React.CSSProperties = first
            ? { left: 0 }
            : last
              ? { right: 0 }
              : { left: `calc(${at} * (100% - 24px) + 12px)`, transform: 'translateX(-50%)' };
          const align = first ? 'items-start text-left' : last ? 'items-end text-right' : 'items-center text-center';
          const marker = (
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold tabular-nums ${
                done ? 'bg-primary-600 text-white' : current ? 'bg-card ring-2 ring-inset ring-primary-600 text-primary-700' : 'bg-card ring-1 ring-inset ring-gray-300 text-gray-500'
              }`}
              aria-hidden="true"
            >
              {done ? <Check size={13} strokeWidth={3} /> : n}
            </span>
          );
          const label = (
            <span className={`mt-2 block whitespace-nowrap text-[13px] leading-[18px] ${current ? 'font-semibold text-gray-900' : done ? 'font-medium text-gray-700' : 'font-medium text-gray-500'}`}>
              {name}
            </span>
          );
          return (
            <li key={name} className={`absolute top-0 flex flex-col ${align}`} style={position} aria-current={current ? 'step' : undefined}>
              {done && onStepClick ? (
                <button
                  type="button"
                  onClick={() => onStepClick(n)}
                  aria-label={`Revenir à l'étape ${n} : ${name}`}
                  className={`flex flex-col ${align} rounded-lg [&>span:last-child]:hover:text-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gray-900`}
                >
                  {marker}
                  {label}
                </button>
              ) : (
                <>
                  {marker}
                  {label}
                  {current && <span className="sr-only">(en cours)</span>}
                </>
              )}
            </li>
          );
        })}
        {/* Connectors between circles i and i+1, 8 px clear of each circle. */}
        {steps.slice(0, -1).map((name, i) => (
          <span
            key={`line-${name}`}
            aria-hidden="true"
            className={`absolute top-[11px] h-0.5 rounded-full ${i + 1 < step ? 'bg-primary-600' : 'bg-gray-200'}`}
            style={{
              left: `calc(${i / (total - 1)} * (100% - 24px) + 32px)`,
              width: `calc((100% - 24px) / ${total - 1} - 40px)`,
            }}
          />
        ))}
      </ol>
    </nav>
  );
});
