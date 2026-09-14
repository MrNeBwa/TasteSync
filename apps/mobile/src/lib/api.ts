import { API_URL } from './config';

export type User = { id: string; username: string; email: string; birth_date: string | null };
export type RoomMember = { user_id: string; username: string; role: 'OWNER' | 'MEMBER'; is_ready: boolean; joined_at: string };
export type Room = { id: string; name: string; code: string; owner_id: string; status: string; created_at: string; members: RoomMember[] };
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
export type Session = { id: string; room_id: string; status: string; created_at: string; started_at?: string | null; finished_at?: string | null };

export async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const detail = typeof body === 'object' && body && 'detail' in body ? String((body as { detail: unknown }).detail) : `HTTP ${res.status}`;
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
  try {
    const parsed = new URL(url);
    let id = parsed.searchParams.get('v');
    if (!id && parsed.hostname.includes('youtu.be')) id = parsed.pathname.slice(1);
    if (!id && parsed.pathname.includes('/embed/')) id = parsed.pathname.split('/embed/')[1]?.split('/')[0];
    if (!id) return null;
    return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&playsinline=1&controls=1&rel=0`;
  } catch {
    return null;
  }
}
