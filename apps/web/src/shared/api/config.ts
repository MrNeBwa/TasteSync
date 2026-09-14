const DEFAULT_API_PORT = import.meta.env.VITE_API_PORT ?? '8000';

function cleanBase(value: string): string {
  return value.replace(/\/$/, '');
}

export function getApiBaseUrl(): string {
  const { hostname, protocol } = window.location;
  const scheme = protocol === 'https:' ? 'https:' : 'http:';

  // In local development the API follows the host used to open the web app.
  // This makes LAN testing work without changing .env every time the IP changes.
  if (import.meta.env.DEV) {
    return `${scheme}//${hostname}:${DEFAULT_API_PORT}/api`;
  }

  return cleanBase(
    (import.meta.env.VITE_API_URL as string | undefined) ?? `${scheme}//${hostname}/api`,
  );
}

export function getWsBaseUrl(): string {
  const { hostname, protocol } = window.location;
  const wsScheme = protocol === 'https:' ? 'wss:' : 'ws:';

  if (import.meta.env.DEV) {
    return `${wsScheme}//${hostname}:${DEFAULT_API_PORT}`;
  }

  return cleanBase(
    (import.meta.env.VITE_WS_URL as string | undefined) ?? `${wsScheme}//${hostname}`,
  );
}

export const API_BASE_URL = getApiBaseUrl();
export const WS_BASE_URL = getWsBaseUrl();

if (import.meta.env.DEV) {
  console.info(`[TasteSync] Web: ${window.location.origin}`);
  console.info(`[TasteSync] API: ${API_BASE_URL}`);
  console.info(`[TasteSync] WS: ${WS_BASE_URL}`);
}
