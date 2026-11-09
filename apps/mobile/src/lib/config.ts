import * as SecureStore from 'expo-secure-store';

const DEFAULT_API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.100.8:8000/api';
const API_URL_STORAGE_KEY = 'movie_match_api_url';
const LOCATION_STORAGE_KEY = 'movie_match_user_location';

let runtimeApiUrl = normalizeApiUrl(DEFAULT_API_URL);

export function normalizeApiUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return DEFAULT_API_URL;
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  return withProto.endsWith('/api') ? withProto : `${withProto}/api`;
}

export function getApiUrl(): string {
  return runtimeApiUrl;
}

export function getWsUrl(): string {
  return runtimeApiUrl.replace(/^http/i, 'ws').replace(/\/api\/?$/, '');
}

export function resolveMobileAssetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
  const origin = runtimeApiUrl.replace(/\/api\/?$/, '');
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

export async function loadSavedApiUrl(): Promise<string> {
  try {
    const saved = await SecureStore.getItemAsync(API_URL_STORAGE_KEY);
    if (saved && saved.trim()) {
      runtimeApiUrl = normalizeApiUrl(saved);
    }
  } catch {
    // Ignore storage errors and keep default URL
  }
  return runtimeApiUrl;
}

export async function saveCustomApiUrl(raw: string): Promise<string> {
  const next = raw.trim() ? normalizeApiUrl(raw) : normalizeApiUrl(DEFAULT_API_URL);
  runtimeApiUrl = next;
  try {
    if (raw.trim()) {
      await SecureStore.setItemAsync(API_URL_STORAGE_KEY, next);
    } else {
      await SecureStore.deleteItemAsync(API_URL_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
  return runtimeApiUrl;
}

export type SavedLocation = {
  city: string;
  latitude: number;
  longitude: number;
};

const DEFAULT_LOCATION: SavedLocation = {
  city: 'Москва',
  latitude: 55.7558,
  longitude: 37.6173,
};

let runtimeLocation: SavedLocation = DEFAULT_LOCATION;

export function getSavedLocation(): SavedLocation {
  return runtimeLocation;
}

export async function loadSavedLocation(): Promise<SavedLocation> {
  try {
    const raw = await SecureStore.getItemAsync(LOCATION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SavedLocation>;
      if (typeof parsed.city === 'string' && typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
        runtimeLocation = { city: parsed.city, latitude: parsed.latitude, longitude: parsed.longitude };
      }
    }
  } catch {
    // Keep default location
  }
  return runtimeLocation;
}

export async function saveLocation(loc: SavedLocation): Promise<SavedLocation> {
  runtimeLocation = loc;
  try {
    await SecureStore.setItemAsync(LOCATION_STORAGE_KEY, JSON.stringify(loc));
  } catch {
    // Ignore storage errors
  }
  return runtimeLocation;
}

// Keep backwards-compatible exports for existing imports
export const API_URL = DEFAULT_API_URL;
export const WS_URL = DEFAULT_API_URL.replace(/^http/i, 'ws').replace(/\/api\/?$/, '');
