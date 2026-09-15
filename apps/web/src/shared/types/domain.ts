export type Screen = 'landing' | 'auth' | 'home' | 'room' | 'session' | 'match' | 'settings';
export type AuthMode = 'login' | 'register';
export type VoteValue = 'LIKE' | 'DISLIKE' | 'SKIP';

export type User = {
  id: string;
  username: string;
  email: string;
  birth_date: string | null;
};

export type RoomMember = {
  user_id: string;
  username: string;
  role: 'OWNER' | 'MEMBER';
  is_ready: boolean;
  joined_at: string;
};

export type Room = {
  id: string;
  name: string;
  code: string;
  owner_id: string;
  status: string;
  created_at: string;
  members: RoomMember[];
};

export type Genre = { id: string; name: string };

export type Movie = {
  id: string;
  title: string;
  overview: string | null;
  release_date: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  popularity: number | null;
  vote_average: number | null;
  vote_count: number | null;
  is_adult: boolean;
  trailer_url: string | null;
  genres: Genre[];
};

export type Session = {
  id: string;
  room_id: string;
  status: string;
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
};

export type Palette = {
  primary: string;
  secondary: string;
  glow: string;
  ink: string;
};

export type HistoryItem = {
  room_id: string;
  room_name: string;
  room_code: string;
  room_status: string;
  created_at: string;
  member_count: number;
  matched_movies: Movie[];
};
