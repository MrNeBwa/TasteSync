import { apiFetch } from '../../shared/api';
import type { AuthResult, LoginInput, RegisterInput, User } from './types';

export const authApi = {
  register(input: RegisterInput) {
    return apiFetch<User>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  login(input: LoginInput) {
    return apiFetch<AuthResult>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  me(token: string) {
    return apiFetch<User>('/auth/me', {}, token);
  },
};
