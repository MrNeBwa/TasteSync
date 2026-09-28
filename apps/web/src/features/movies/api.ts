import { ApiError, apiFetch } from '../../shared/api';
import type { Movie } from '../../shared/types';

/** Shown when the API reports that its movie catalog has no entries at all. */
export const CATALOG_EMPTY_MESSAGE =
  'Каталог фильмов пуст — API не смог загрузить подборку. ' +
  'Проверьте TMDB_API_TOKEN в apps/api/.env и выполните POST /api/movies/sync-popular.';

export function describeMovieFeedError(error: unknown): string {
  if (error instanceof ApiError && error.status === 503) {
    return CATALOG_EMPTY_MESSAGE;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Не удалось загрузить фильмы';
}

export const moviesApi = {
  forSession(sessionId: string, token: string, limit = 8) {
    return apiFetch<Movie[]>(
      `/sessions/${sessionId}/movies?limit=${limit}&exploration_ratio=0.25`,
      {},
      token,
    );
  },
};
