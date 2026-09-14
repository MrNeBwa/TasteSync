const ACCESS_TOKEN_KEY = 'tastesync_access_token';
const REFRESH_TOKEN_KEY = 'tastesync_refresh_token';

export function getAccessToken(): string {
  return localStorage.getItem(ACCESS_TOKEN_KEY) ?? '';
}

export function getRefreshToken(): string {
  return localStorage.getItem(REFRESH_TOKEN_KEY) ?? '';
}

export function saveTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}
