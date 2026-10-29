import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';

type Theme = 'light' | 'dark';
type ThemePreference = Theme | 'system';

interface ThemeContextValue {
  theme: Theme;                  // resolved theme actually applied
  preference: ThemePreference;   // user-chosen preference
  setPreference: (p: ThemePreference) => void;
  toggle: () => void;            // quick light <-> dark flip
}

const STORAGE_KEY = 'ms-theme-preference';

const ThemeContext = createContext<ThemeContextValue | null>(null);

const getSystemTheme = (): Theme => {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const readStoredPreference = (): ThemePreference => {
  if (typeof window === 'undefined') return 'system';
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    /* ignore — private mode etc. */
  }
  return 'system';
};

const applyThemeClass = (theme: Theme) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Theme switching disabled — app is locked to light mode.
  const theme: Theme = 'light';
  const preference: ThemePreference = 'light';

  useEffect(() => {
    applyThemeClass('light');
  }, []);

  const setPreference = useCallback((_p: ThemePreference) => {
    /* no-op: theme is locked to light */
  }, []);

  const toggle = useCallback(() => {
    /* no-op: theme is locked to light */
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, preference, setPreference, toggle }),
    [setPreference, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>');
  return ctx;
};
