import {
  getRuntimeApiBaseUrl,
} from './config';
import { clearTokens, getRefreshToken, saveTokens } from '../lib/storage';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch(`${getRuntimeApiBaseUrl()}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        clearTokens();
        return null;
      }

      const data = (await response.json()) as {
        access_token: string;
        refresh_token: string;
      };

      saveTokens(data.access_token, data.refresh_token);
      return data.access_token;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const KNOWN_VALIDATION_MESSAGES: Record<string, string> = {
  'Field required': 'поле не заполнено',
  'String should have at least 1 character': 'строка не должна быть пустой',
  'Input should be a valid dictionary or object to extract fields from':
    'тело запроса должно быть JSON',
  'String should have at most 128 characters': 'значение слишком длинное',
  'String should have at least 3 characters': 'слишком короткое значение',
  'String should have at least 8 characters': 'не короче 8 символов',
};

function translateValidationMessage(message: string): string {
  return KNOWN_VALIDATION_MESSAGES[message] ?? message;
}

/**
 * Turn a FastAPI 422 `detail` (a list of validation errors) into a readable
 * string. The old `String(detail)` rendered `[object Object]`, which left users
 * staring at an unactionable 422 whenever a field failed validation.
 */
function describeValidation(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (!Array.isArray(detail)) return '';
  return detail
    .map((item) => {
      if (typeof item !== 'object' || item === null) return '';
      const { loc, msg } = item as { loc?: unknown; msg?: unknown };
      const field = (Array.isArray(loc) ? loc.filter((part) => part !== 'body') : [])
        .map(String)
        .join('.');
      const message = translateValidationMessage(typeof msg === 'string' ? msg : '');
      return field ? `${field}: ${message}` : message;
    })
    .filter(Boolean)
    .join(' · ');
}

function getErrorMessage(body: unknown, status: number): string {
  if (typeof body === 'object' && body !== null && 'detail' in body) {
    const described = describeValidation((body as { detail: unknown }).detail);
    if (described) return described;
  }
  return `HTTP ${status}`;
}

/** @internal exposed for tests */
export { getErrorMessage };

async function performRequest<T>(
  path: string,
  options: RequestInit,
  token?: string,
): Promise<{ response: Response; body: unknown }> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${getRuntimeApiBaseUrl()}${path}`, {
    ...options,
    headers,
  });

  return { response, body: await parseBody(response) };
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  let { response, body } = await performRequest<T>(path, options, token);

  // One transparent refresh/retry. It is shared by concurrent requests.
  if (response.status === 401 && token && !path.startsWith('/auth/refresh')) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      ({ response, body } = await performRequest<T>(path, options, refreshed));
    }
  }

  if (!response.ok) {
    throw new ApiError(getErrorMessage(body, response.status), response.status, body);
  }

  return body as T;
}
