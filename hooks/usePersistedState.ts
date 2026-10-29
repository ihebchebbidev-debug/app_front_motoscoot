import { useState, useEffect, useRef, Dispatch, SetStateAction } from 'react';

/**
 * useState backed by localStorage. SSR-safe (reads only on the client).
 * Writes are best-effort — quota errors are swallowed so private browsing
 * never crashes the UI.
 */
export function usePersistedState<T>(
  key: string,
  initialValue: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw == null) return initialValue;
      return JSON.parse(raw) as T;
    } catch {
      return initialValue;
    }
  });

  const isFirst = useRef(true);
  useEffect(() => {
    // Skip the first effect tick so we don't immediately rewrite the value
    // we just hydrated from storage (avoids a needless storage event).
    if (isFirst.current) { isFirst.current = false; return; }
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore quota / private mode errors
    }
  }, [key, value]);

  return [value, setValue];
}
