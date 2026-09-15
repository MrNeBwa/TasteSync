import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { COLORS, DARK_COLORS, type Palette } from '../components/Ui';

export type ThemeName = 'light' | 'dark';
type ThemeContextValue = {
  theme: ThemeName;
  palette: Palette;
  toggleTheme: () => void;
  setTheme: (theme: ThemeName) => void;
};

const THEME_KEY = 'movie_match_theme';
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>('light');

  useEffect(() => {
    SecureStore.getItemAsync(THEME_KEY)
      .then((value) => {
        if (value === 'dark' || value === 'light') setTheme(value);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    SecureStore.setItemAsync(THEME_KEY, theme).catch(() => undefined);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    palette: theme === 'dark' ? DARK_COLORS : COLORS,
    toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
    setTheme,
  }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}