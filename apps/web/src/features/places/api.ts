import { apiFetch } from '../../shared/api';
import type { Coords, Place, SearchMode } from '../../shared/types';

const PLACE_CATEGORY: Record<Exclude<SearchMode, 'movies'>, 'RESTAURANT' | 'ENTERTAINMENT'> = {
  restaurants: 'RESTAURANT',
  entertainment: 'ENTERTAINMENT',
};

export const placesApi = {
  forSession(
    sessionId: string,
    token: string,
    mode: Exclude<SearchMode, 'movies'>,
    coords: Coords,
    limit = 8,
  ) {
    const params = new URLSearchParams({
      category: PLACE_CATEGORY[mode],
      lat: String(coords.latitude),
      lon: String(coords.longitude),
      limit: String(limit),
    });
    return apiFetch<Place[]>(`/sessions/${sessionId}/places?${params.toString()}`, {}, token);
  },

  detail(placeId: string, token: string) {
    return apiFetch<Place>(`/places/${placeId}`, {}, token);
  },
};