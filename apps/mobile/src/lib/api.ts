import { getApiUrl, type SavedLocation } from './config';
import { refreshAccessToken } from './auth';

let tokenRefreshedListener: ((token: string) => void) | null = null;

export function onTokenRefreshed(listener: ((token: string) => void) | null) {
  tokenRefreshedListener = listener;
}

export type SearchMode = 'movies' | 'restaurants' | 'entertainment';
export type User = { id: string; username: string; email: string; birth_date: string | null };
export type RoomMember = { user_id: string; username: string; role: 'OWNER' | 'MEMBER'; is_ready: boolean; joined_at: string };
export type Room = {
  id: string;
  name: string;
  code: string;
  owner_id: string;
  status: string;
  task?: SearchMode;
  created_at: string;
  members: RoomMember[];
  active_session_id?: string | null;
};
export type Genre = { id: string; name: string };
export type Movie = {
  id: string;
  title: string;
  overview: string | null;
  release_date: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  popularity: number | null;
  vote_average: number | null;
  vote_count: number | null;
  is_adult: boolean;
  trailer_url: string | null;
  genres: Genre[];
};
export type Place = {
  id: string;
  category: 'RESTAURANT' | 'ENTERTAINMENT';
  name: string;
  address: string | null;
  city: string | null;
  latitude: number;
  longitude: number;
  rating: number | null;
  price_level: string | null;
  phone: string | null;
  website: string | null;
  opening_hours: string | null;
  cuisine: string | null;
  image_url: string | null;
  cover_url?: string | null;
  tags: string[];
};
export type Session = { id: string; room_id: string; status: string; created_at: string; started_at?: string | null; finished_at?: string | null };
export type Match = { id: string; session_id: string; movie_id: string; created_at: string; started_at?: string | null; finished_at?: string | null };
export type SessionMatch = {
  kind: 'movie' | 'place';
  match_id: string;
  created_at: string;
  category?: 'RESTAURANT' | 'ENTERTAINMENT' | null;
  movie?: Movie | null;
  place?: Place | null;
};
export type HistoryItem = {
  room_id: string;
  room_name: string;
  room_code: string;
  room_status: string;
  created_at: string;
  member_count: number;
  matched_movies: Movie[];
};

export const PRESET_CITIES: SavedLocation[] = [
  { city: 'Москва', latitude: 55.7558, longitude: 37.6173 },
  { city: 'Санкт-Петербург', latitude: 59.9343, longitude: 30.3351 },
  { city: 'Казань', latitude: 55.7961, longitude: 49.1064 },
  { city: 'Екатеринбург', latitude: 56.8389, longitude: 60.6057 },
  { city: 'Новосибирск', latitude: 55.0084, longitude: 82.9357 },
  { city: 'Минск', latitude: 53.9006, longitude: 27.559 },
];

export async function geocodeCityMobile(query: string): Promise<SavedLocation | null> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return null;
  const preset = PRESET_CITIES.find((c) => c.city.toLowerCase() === normalized);
  if (preset) return preset;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query.trim())}&format=jsonv2&limit=1&accept-language=ru`,
      { headers: { 'User-Agent': 'MovieMatchMobile/0.2' } }
    );
    if (!res.ok) return null;
    const items = (await res.json()) as Array<{ lat?: string; lon?: string; name?: string; display_name?: string }>;
    const first = items[0];
    if (!first || !first.lat || !first.lon) return null;
    const lat = Number(first.lat);
    const lon = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const city = (first.name || first.display_name?.split(',')[0] || query).trim();
    return { city, latitude: lat, longitude: lon };
  } catch {
    return null;
  }
}

/**
 * Turn a FastAPI 422 `detail` (a list of validation errors) into a readable
 * string. The old `String(detail)` rendered `[object Object]`, so users could
 * not see which field failed.
 */
function formatApiDetail(body: unknown): string {
  if (typeof body !== 'object' || body === null || !('detail' in body)) {
    return '';
  }
  const detail = (body as { detail: unknown }).detail;
  if (!Array.isArray(detail)) return String(detail);
  return detail
    .map((item) => {
      if (typeof item !== 'object' || item === null) return '';
      const { loc, msg } = item as { loc?: unknown; msg?: unknown };
      const field = (Array.isArray(loc) ? loc.filter((part) => part !== 'body') : [])
        .map(String)
        .join('.');
      const message = typeof msg === 'string' ? msg : '';
      return field ? `${field}: ${message}` : message;
    })
    .filter(Boolean)
    .join(' · ');
}

export async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const doFetch = async (authToken?: string): Promise<Response> => {
    const headers = new Headers(options.headers);
    if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (authToken) headers.set('Authorization', `Bearer ${authToken}`);
    return fetch(`${getApiUrl()}${path}`, { ...options, headers });
  };

  let res = await doFetch(token);
  if (res.status === 401 && token) {
    try {
      const next = await refreshAccessToken();
      tokenRefreshedListener?.(next);
      res = await doFetch(next);
    } catch {
      // Refresh failed; the response below reports the original 401.
    }
  }
  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const detail = formatApiDetail(body) || `HTTP ${res.status}`;
    throw new Error(detail);
  }
  return body as T;
}

export async function register(username: string, email: string, password: string) {
  await request('/auth/register', { method: 'POST', body: JSON.stringify({ username, email, password }) });
  return request<{ access_token: string; refresh_token: string; token_type: string }>('/auth/login', {
    method: 'POST', body: JSON.stringify({ email, password }),
  });
}

export function youtubeEmbed(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/);
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}?autoplay=1&mute=1&playsinline=1&controls=1&rel=0&modestbranding=1` : null;
}
