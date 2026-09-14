export type RegisterInput = {
  username: string;
  email: string;
  password: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type AuthResult = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export type User = {
  id: string;
  username: string;
  email: string;
  birth_date: string | null;
};
