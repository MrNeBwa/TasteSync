/** Theme selection helpers shared by the app shell and settings. */

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "movie-match-theme";
export const DARK_CLASS = "theme-dark";

export function normalizeTheme(value: string | null | undefined): Theme {
  return value === "dark" ? "dark" : "light";
}

export function readStoredTheme(): Theme {
  try {
    return normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "light";
  }
}

export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  root.classList.toggle(DARK_CLASS, theme === "dark");
  root.style.colorScheme = theme;
}

export function persistTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private-mode browsers can reject writes; the in-memory theme still works.
  }
}
