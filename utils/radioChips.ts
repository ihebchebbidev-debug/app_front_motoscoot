import type React from 'react';

/**
 * Chips where one choice is picked among several (filter panels): radio
 * buttons for screen readers, keyboard as the ARIA radio group pattern.
 * Tab reaches the group once, on the chosen chip (else the first usable one);
 * the arrows move to the next usable chip and pick it, Home / End too.
 */
export function radioTabIndex<T>(items: T[], i: number, isChecked: (t: T) => boolean, isDisabled: (t: T) => boolean): 0 | -1 {
  const checked = items.findIndex(isChecked);
  const target = checked >= 0 ? checked : items.findIndex((t) => !isDisabled(t));
  return i === target ? 0 : -1;
}

/** Index reached from `from` by a key among `count` chips (null: not a move key). */
export function nextRadioIndex(key: string, from: number, count: number, disabled: (i: number) => boolean): number | null {
  const step = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 0;
  if (key === 'Home' || key === 'End') {
    const order = Array.from({ length: count }, (_, k) => (key === 'Home' ? k : count - 1 - k));
    const hit = order.find((k) => !disabled(k));
    return hit ?? null;
  }
  if (!step || count === 0) return null;
  for (let n = 1; n <= count; n++) {
    const k = (from + step * n + count * n) % count; // wraps around
    if (!disabled(k)) return k;
  }
  return null;
}

/** onKeyDown of a role="radiogroup": focus and pick (click) the chip reached. */
export function onRadioKeyDown(e: React.KeyboardEvent<HTMLElement>): void {
  const radios = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
  const from = radios.indexOf(e.target as HTMLButtonElement);
  if (from < 0) return;
  const to = nextRadioIndex(e.key, from, radios.length, (k) => radios[k].disabled);
  if (to === null) return;
  e.preventDefault();
  radios[to].focus();
  if (radios[to].getAttribute('aria-checked') !== 'true') radios[to].click();
}
