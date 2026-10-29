import React, { memo } from 'react';

interface StepProgressProps {
  step: number;
  totalSteps?: number;
  /** When true, the bar is dimmed and ignores pointer events — used during the
   *  post-publish reset transition so the user can't tap a step indicator
   *  while the form is being wiped. */
  disabled?: boolean;
}

export const StepProgress = memo(({ step, totalSteps = 5, disabled = false }: StepProgressProps) => {
  const percentage = Math.round((step / totalSteps) * 100);

  return (
    <div
      className={`px-8 md:px-10 pt-10 pb-4 bg-neutral-50 border-b border-neutral-100 shadow-none transition-opacity duration-300 ${disabled ? 'opacity-50 pointer-events-none select-none' : ''}`}
      aria-disabled={disabled || undefined}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-[12px] font-black text-primary-600 uppercase tracking-[0.2em]">
          Étape {step} / {totalSteps}
        </span>
        <span className="text-xl font-black text-gray-900">{percentage}%</span>
      </div>
      <div className="w-full h-2 bg-neutral-200 rounded-full shadow-none">
        <div
          className="h-full bg-primary-600 transition-all duration-700 ease-out rounded-full shadow-none"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
});
