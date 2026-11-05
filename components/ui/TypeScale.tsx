import React, { createContext, useContext } from 'react';

/**
 * Typographic tone for the shared form controls (Input, Select, Button).
 *
 * - `caps` (default, rest of the site): labels and buttons in extra-bold
 *   tracked capitals.
 * - `calm`: the deposit's Apple-style scale — sentence case, fewer weights.
 *   Label 14/600, typed value 16/500 (placeholder 400), help/error 13,
 *   button 16/700 sentence case.
 *
 * Wrap a screen in <TypeScaleProvider tone="calm"> to try the calm scale
 * there without changing the rest of the site.
 */
export type TypeTone = 'caps' | 'calm';

const TypeScaleContext = createContext<TypeTone>('caps');

export const TypeScaleProvider: React.FC<{ tone: TypeTone; children: React.ReactNode }> = ({ tone, children }) => (
  <TypeScaleContext.Provider value={tone}>{children}</TypeScaleContext.Provider>
);

export const useTypeTone = (): TypeTone => useContext(TypeScaleContext);

/** Class sets per tone, shared by Input and Select. */
export const FIELD_TYPE = {
  caps: {
    label: 'text-[12px] font-extrabold text-foreground uppercase tracking-[1px]',
    value: 'font-bold',
    error: 'text-[12px] font-bold',
  },
  calm: {
    label: 'text-[14px] leading-[1.3] font-semibold text-gray-900',
    value: 'font-medium placeholder:font-normal',
    error: 'text-[13px] font-medium',
  },
} as const;

/** Button text per tone (size classes stay with the Button sizes). */
export const BUTTON_TYPE = {
  caps: 'font-black uppercase tracking-widest',
  calm: 'font-bold normal-case tracking-normal',
} as const;
