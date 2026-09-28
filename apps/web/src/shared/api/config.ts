const DEFAULT_API_PORT = import.meta.env.VITE_API_PORT ?? "8000";

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export type RuntimeLocation = {
  hostname: string;
  protocol: string;
};

export type RuntimeApiOptions = {
  dev: boolean;
  apiPort?: string;
  apiUrl?: string;
  wsUrl?: string;
};

export function resolveApiBaseUrl(
  location: RuntimeLocation,
  options: RuntimeApiOptions,
): string {
  if (options.dev) {
    const scheme = location.protocol === "https:" ? "https:" : "http:";
    const port = options.apiPort ?? "8000";

    return `${scheme}//${location.hostname}:${port}/api`;
  }

  const scheme = location.protocol === "https:" ? "https:" : "http:";

  return stripTrailingSlash(
    options.apiUrl ?? `${scheme}//${location.hostname}/api`,
  );
}

export function resolveWsBaseUrl(
  location: RuntimeLocation,
  options: RuntimeApiOptions,
): string {
  if (options.dev) {
    const scheme = location.protocol === "https:" ? "wss:" : "ws:";
    const port = options.apiPort ?? "8000";

    return `${scheme}//${location.hostname}:${port}`;
  }

  const scheme = location.protocol === "https:" ? "wss:" : "ws:";

  return stripTrailingSlash(
    options.wsUrl ?? `${scheme}//${location.hostname}`,
  );
}

export function getApiBaseUrl(): string {
  return resolveApiBaseUrl(
    {
      hostname: window.location.hostname,
      protocol: window.location.protocol,
    },
    {
      dev: import.meta.env.DEV,
      apiPort: DEFAULT_API_PORT,
      apiUrl: import.meta.env.VITE_API_URL,
      wsUrl: import.meta.env.VITE_WS_URL,
    },
  );
}

export function getWsBaseUrl(): string {
  return resolveWsBaseUrl(
    {
      hostname: window.location.hostname,
      protocol: window.location.protocol,
    },
    {
      dev: import.meta.env.DEV,
      apiPort: DEFAULT_API_PORT,
      apiUrl: import.meta.env.VITE_API_URL,
      wsUrl: import.meta.env.VITE_WS_URL,
    },
  );
}

export const getRuntimeApiBaseUrl = getApiBaseUrl;
export const getRuntimeWsBaseUrl = getWsBaseUrl;

/**
 * Join a server-supplied asset path onto an API base.
 *
 * The API base already ends in `/api`, while paths it hands out are absolute
 * from the origin (`/api/places/{id}/cover.svg`). Joining those naively
 * produces `/api/api/...`, which 404s. The path's own `/api` segment is dropped
 * before the join, and a path that is already absolute is left alone.
 */
export function joinApiAssetPath(
  base: string,
  path: string | null | undefined,
): string | null {
  if (!path) return null;
  if (/^(https?:)?\/\//.test(path)) return path;
  // Anchored on a full segment so a path like "apifoo/x" is left intact.
  const relative = path
    .replace(/^\/+/, "")
    .replace(/^api$/, "")
    .replace(/^api\//, "");
  return `${stripTrailingSlash(base)}/${relative}`;
}

/**
 * Turn a server-supplied path (e.g. a place cover) into a URL an `<img>` or CSS
 * `background-image` can load. These cannot go through `apiFetch`, because
 * neither can attach a bearer token.
 */
export function resolveApiAssetUrl(path: string | null | undefined): string | null {
  return joinApiAssetPath(getRuntimeApiBaseUrl(), path);
}
