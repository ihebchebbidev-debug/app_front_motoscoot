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

      {/* Wide screens: named steps, one column each (circle, name below), so
          long names wrap instead of colliding. */}
      <ol className="hidden xl:grid" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
        {steps.map((name, i) => {
          const n = i + 1;
          const done = n < step;
          const current = n === step;
          const marker = (
            <span
              className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold tabular-nums ${
                done ? 'bg-primary-600 text-white' : current ? 'bg-card border-2 border-primary-600 text-primary-700' : 'bg-card border border-gray-300 text-gray-500'
              }`}
              aria-hidden="true"
            >
              {done ? <Check size={14} strokeWidth={3} /> : n}
            </span>
          );
          const label = (
            <span className={`mt-2 block text-[13px] leading-snug text-center ${current ? 'font-semibold text-gray-900' : done ? 'font-medium text-gray-900' : 'font-medium text-gray-500'}`}>
              {name}
            </span>
          );
          return (
            <li key={name} className="relative flex flex-col items-center px-1" aria-current={current ? 'step' : undefined}>
              {/* Connector to the next step, from circle edge to circle edge. */}
              {n < total && (
                <span
                  aria-hidden="true"
                  className={`absolute top-3.5 left-[calc(50%+18px)] right-[calc(-50%+18px)] h-px ${done ? 'bg-primary-600' : 'bg-gray-200'}`}
                />
              )}
              {done && onStepClick ? (
                <button
                  type="button"
                  onClick={() => onStepClick(n)}
                  aria-label={`Revenir à l'étape ${n} : ${name}`}
                  className="flex flex-col items-center rounded-xl px-1 hover:text-primary-700 [&>span:last-child]:hover:text-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
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
      </ol>
    </nav>
  );
});
