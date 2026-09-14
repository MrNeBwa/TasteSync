export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:8000/api';
export const WS_URL = process.env.EXPO_PUBLIC_WS_URL ?? API_URL.replace(/^http/, 'ws').replace(/\/api\/?$/, '');
