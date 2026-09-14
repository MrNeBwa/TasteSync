import { apiFetch } from '../../shared/api';
import type { Movie } from '../../shared/types';

export const moviesApi = {
  forSession(sessionId: string, token: string, limit = 8) {
    return apiFetch<Movie[]>(
      `/sessions/${sessionId}/movies?limit=${limit}&exploration_ratio=0.25`,
      {},
      token,
    );
  },
};
