import { apiFetch } from '../../shared/api';
import type { Room } from '../../shared/types';

export const roomsApi = {
  create(name: string, token: string) {
    return apiFetch<Room>('/rooms', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }, token);
  },

  get(roomId: string, token: string) {
    return apiFetch<Room>(`/rooms/${roomId}`, {}, token);
  },

  join(code: string, token: string) {
    return apiFetch<Room>('/rooms/join', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }, token);
  },

  setReady(roomId: string, ready: boolean, token: string) {
    return apiFetch<{ room: Room; is_ready: boolean }>(
      `/rooms/${roomId}/ready?ready=${ready}`,
      { method: 'PATCH' },
      token,
    );
  },

  start(roomId: string, token: string) {
    return apiFetch<{ session_id: string; room_id: string; status: string; created_at: string }>(
      `/rooms/${roomId}/start`,
      { method: 'POST' },
      token,
    );
  },
};
