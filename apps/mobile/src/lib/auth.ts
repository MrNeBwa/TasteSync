import * as SecureStore from 'expo-secure-store';
import type { User } from './api';

const TOKEN_KEY = 'movie_match_access';
const REFRESH_KEY = 'movie_match_refresh';
const USER_KEY = 'movie_match_user';

export async function saveAuth(access: string, refresh: string, user: User) {
  await SecureStore.setItemAsync(TOKEN_KEY, access);
  await SecureStore.setItemAsync(REFRESH_KEY, refresh);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function loadAuth(): Promise<{ access: string; refresh: string; user: User | null } | null> {
  const access = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!access) return null;
  const refresh = await SecureStore.getItemAsync(REFRESH_KEY);
  const raw = await SecureStore.getItemAsync(USER_KEY);
  return { access, refresh: refresh ?? '', user: raw ? JSON.parse(raw) : null };
}

export async function saveUser(user: User) {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function clearAuth() {
  await Promise.all([SecureStore.deleteItemAsync(TOKEN_KEY), SecureStore.deleteItemAsync(REFRESH_KEY), SecureStore.deleteItemAsync(USER_KEY)]);
}
