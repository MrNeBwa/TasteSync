import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch as request } from '../shared/api/client';
import { getRuntimeWsBaseUrl } from '../shared/api/config';
import { clearTokens, getAccessToken, saveTokens } from '../shared/lib/storage';
import { getYouTubeEmbedUrl } from '../shared/lib/youtube';
import { getCurrentCity, geocodeCity, isGeoSupported } from '../shared/lib/geo';
import { placesApi } from '../features/places/api';
import { roomsApi } from '../features/rooms/api';
import { ModeCircle, MODE_OPTIONS } from '../components/ModeCircle';
import { PlaceCard } from '../components/PlaceCard';
import { PlaceCategoryIcon, SearchModeIcon } from '../components/icons';
import type { AuthMode, Coords, Genre, HistoryItem, MatchResult, Movie, Palette, Place, Room, RoomMember, Screen, SearchMode, Session, User, UserLocation, VoteValue } from '../shared/types/domain';

const FALLBACK_PALETTE: Palette = {
  primary: '#efbd42',
  secondary: '#e5679f',
  glow: 'rgba(239,189,66,.28)',
  ink: '#121212',
};

function App() {
  const [screen, setScreen] = useState<Screen>(() => getAccessToken() ? 'home' : 'landing');
  const [token, setToken] = useState(() => getAccessToken());
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authLoading, setAuthLoading] = useState(Boolean(getAccessToken()));
  const [room, setRoom] = useState<Room | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [error, setError] = useState('');
  const [ageGateOpen, setAgeGateOpen] = useState(false);
  const [ageSaving, setAgeSaving] = useState(false);
  const [location, setLocation] = useState<UserLocation | null>(null);

  const authenticated = Boolean(token && user);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setAuthLoading(false);
      return;
    }
    let active = true;
    setAuthLoading(true);
    request<User>('/auth/me', {}, token)
      .then((me) => {
        if (!active) return;
        setUser(me);
        setScreen((current) => current === 'landing' || current === 'auth' ? 'home' : current);
        setAgeGateOpen(!me.birth_date);
      })
      .catch(() => {
        if (!active) return;
        clearTokens();
        setToken('');
        setUser(null);
        setScreen('landing');
      })
      .finally(() => active && setAuthLoading(false));
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (!room || !token || !['room', 'session', 'match'].includes(screen)) return;
    const wsBase = getRuntimeWsBaseUrl();
    let closed = false;
    const ws = new WebSocket(`${wsBase}/ws/rooms/${room.id}?token=${encodeURIComponent(token)}`);
    ws.onmessage = (event) => {
      try {
        if (closed) return;
        const msg = JSON.parse(event.data) as { type: string; payload?: unknown };
        if (msg.type === 'ROOM_READY_CHANGED' && msg.payload && typeof msg.payload === 'object') setRoom(msg.payload as Room);
        if (msg.type === 'ROOM_TASK_CHANGED' && msg.payload && typeof msg.payload === 'object') setRoom(msg.payload as Room);
        if (msg.type === 'SESSION_STARTED' && msg.payload && typeof msg.payload === 'object') {
          const payload = msg.payload as { session_id: string; room_id?: string; created_at?: string };
          setSession({ id: payload.session_id, room_id: payload.room_id ?? room.id, status: 'ACTIVE', created_at: payload.created_at ?? new Date().toISOString() });
          setScreen('session');
        }
        if (msg.type === 'MATCH_FOUND' && msg.payload && typeof msg.payload === 'object') {
          const payload = msg.payload as { movie_id?: string | null; place_id?: string | null; category?: string | null; session_id: string };
          setScreen('match');
          if (payload.place_id) {
            request<Place>(`/places/${payload.place_id}`, {}, token)
              .then(place => setMatchResult({
                kind: 'place',
                category: payload.category === 'RESTAURANT' ? 'restaurants' : 'entertainment',
                place,
              }))
              .catch(() => undefined);
          } else if (payload.movie_id) {
            request<Movie[]>(`/sessions/${payload.session_id}/movies?limit=50`, {}, token)
              .then(movies => {
                const movie = movies.find(item => item.id === payload.movie_id) ?? null;
                setMatchResult(movie ? { kind: 'movie', category: 'movies', movie } : null);
              })
              .catch(() => undefined);
          }
        }
        if (msg.type === 'SESSION_FINISHED') setSession(prev => prev ? { ...prev, status: 'FINISHED' } : prev);
      } catch {
        // Ignore malformed realtime messages.
      }
    };
    ws.onerror = () => { if (!closed) setError('Realtime-соединение с комнатой недоступно.'); };
    return () => { closed = true; ws.close(); };
  }, [room, token, screen]);

  useEffect(() => {
    if (!room || !token) return;
    setError('');
    return () => setError('');
  }, [room?.id, token]);

  const saveBirthDate = async (birthDate: string) => {
    if (!birthDate) return;
    setAgeSaving(true);
    setError('');
    try {
      const updated = await request<User>('/users/me/age', {
        method: 'PATCH',
        body: JSON.stringify({ birth_date: birthDate }),
      }, token);
      setUser(updated);
      setAgeGateOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить возраст');
    } finally {
      setAgeSaving(false);
    }
  };

  const logout = () => {
    clearTokens();
    setToken('');
    setUser(null);
    setRoom(null);
    setSession(null);
    setLocation(null);
    setScreen('landing');
  };

  const handleAuth = async (mode: AuthMode, data: { username?: string; email: string; password: string }) => {
    setError('');
    try {
      if (mode === 'register') {
        await request<User>('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ username: data.username, email: data.email, password: data.password }),
        });
        // Registration intentionally does not create a session on the API.
        // The client immediately performs the second request: login with the same credentials.
      }
      const result = await request<{ access_token: string; refresh_token: string; token_type: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: data.email, password: data.password }),
      });
      saveTokens(result.access_token, result.refresh_token);
      setToken(result.access_token);
      const me = await request<User>('/auth/me', {}, result.access_token);
      setUser(me);
      setScreen('home');
      setAgeGateOpen(!me.birth_date);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось выполнить вход');
    }
  };

  if (authLoading && !user) {
    return <div className="app-shell boot-screen"><div className="boot-card"><span className="brand-mark">M</span><strong>Подключаем Movie Match…</strong><span>Проверяем сессию</span></div></div>;
  }

  return (
    <div className="app-shell">
      <div className="grain" />
      {screen === 'landing' && <Landing onAuth={(mode) => { setError(''); setAuthMode(mode); setScreen('auth'); }} />}
      {screen === 'auth' && <Auth mode={authMode} error={error} onModeChange={(mode) => { setError(''); setAuthMode(mode); }} onBack={() => { setError(''); setScreen('landing'); }} onSubmit={handleAuth} />}
      {authenticated && screen === 'home' && <Home user={user} token={token} onOpenSettings={() => setScreen('settings')} onRoom={(r) => { setRoom(r); setScreen('room'); }} onError={setError} error={error} />}
      {authenticated && screen === 'room' && room && <RoomLobby user={user} token={token} room={room} onBack={() => setScreen('home')} onRoomChange={setRoom} onStarted={(s) => { setSession(s); setScreen('session'); }} onError={setError} location={location} onLocation={setLocation} />}
      {authenticated && screen === 'session' && session && room && <SearchSession token={token} session={session} room={room} onMatch={(result) => { setMatchResult(result); setScreen('match'); }} onFinish={() => { setScreen('home'); setSession(null); }} location={location} onLocation={setLocation} />}
      {authenticated && screen === 'match' && room && <MatchScreen result={matchResult} onBack={() => setScreen('home')} />}
      {authenticated && screen === 'settings' && <Settings user={user} token={token} onBack={() => setScreen('home')} onLogout={logout} onEditAge={() => setAgeGateOpen(true)} />}
      {error && screen === 'home' && <div className="toast" role="alert">{error}<button onClick={() => setError('')}>×</button></div>}
      {authenticated && ageGateOpen && <AgeGate user={user} saving={ageSaving} required={!user?.birth_date} onSave={saveBirthDate} onClose={() => !user?.birth_date ? undefined : setAgeGateOpen(false)} />}
    </div>
  );
}

function Shell({ children, eyebrow, title, subtitle, actions }: { children: React.ReactNode; eyebrow?: string; title?: React.ReactNode; subtitle?: string; actions?: React.ReactNode }) {
  return <main className="page"><div className="nav"><div className="brand"><span className="brand-mark">M</span><span>MOVIE<span>MATCH</span></span></div><div className="nav-actions">{actions}</div></div><div className="page-inner"><div className="hero-copy">{eyebrow && <span className="eyebrow">{eyebrow}</span>}{title && <h1>{title}</h1>}{subtitle && <p>{subtitle}</p>}</div>{children}</div></main>;
}

function Landing({ onAuth }: { onAuth: (mode: AuthMode) => void }) {
  return <Shell eyebrow="SOCIAL MOVIE DISCOVERY" title={<>Не спорьте, <span>что смотреть.</span><br />Найдите фильм вместе.</>} subtitle="Комната для друзей, умные рекомендации и общий match без бесконечного листания стримингов.">
    <div className="hero-actions"><button className="btn btn-primary" onClick={() => onAuth('register')}>Создать аккаунт <span>→</span></button><button className="btn btn-ghost" onClick={() => onAuth('login')}>Войти</button></div>
    <div className="feature-grid">
      <div className="feature-card accent"><small>01</small><h3>Создайте комнату</h3><p>Название, код и приглашение друзей — всё в одном месте.</p></div>
      <div className="feature-card"><small>02</small><h3>Голосуйте вместе</h3><p>Like, dislike или skip. Ваш выбор формирует следующие фильмы.</p></div>
      <div className="feature-card"><small>03</small><h3>Поймайте match</h3><p>Когда все нашли один фильм — приложение останавливает поиск.</p></div>
    </div>
    <div className="idea-strip"><span>Моя идея для продукта</span><strong>Не только рекомендации, но и exploration: часть ленты специально выходит за пределы любимых жанров.</strong></div>
  </Shell>;
}

function Auth({ mode, onModeChange, onBack, onSubmit, error }: { mode: AuthMode; onModeChange: (m: AuthMode) => void; onBack: () => void; onSubmit: (m: AuthMode, d: { username?: string; email: string; password: string }) => void; error: string }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSubmit(mode, { username, email, password });
    setLoading(false);
  };
  return <Shell eyebrow="ACCOUNT" title={mode === 'login' ? <>С возвращением.</> : <>Добро пожаловать<br />в <span>Movie Match.</span></>} subtitle={mode === 'login' ? 'Войдите, чтобы вернуться к своим комнатам.' : 'Создайте аккаунт и начните искать фильмы вместе.'} actions={<button className="nav-link" onClick={onBack}>← назад</button>}>
    <form className="auth-card" onSubmit={submit}>
      {mode === 'register' && <label>Имя<input value={username} onChange={e => setUsername(e.target.value)} minLength={3} placeholder="nebwa" required /></label>}
      <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required /></label>
      <label>Пароль<input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} placeholder="••••••••" required /></label>
      {error && <div className="form-error">{error}</div>}
      <button className="btn btn-primary wide" type="submit" disabled={loading}>{loading ? 'Подключаем…' : mode === 'login' ? 'Войти' : 'Создать аккаунт'} <span>→</span></button>
      <button type="button" className="switch-link" onClick={() => onModeChange(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}</button>
    </form>
  </Shell>;
}

function Home({ user, token, onOpenSettings, onRoom, onError, error }: { user: User | null; token: string; onOpenSettings: () => void; onRoom: (r: Room) => void; onError: (e: string) => void; error: string }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [name, setName] = useState('Movie Night');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const create = async () => {
    setLoading(true);
    try {
      const created = await request<Room>('/rooms', { method: 'POST', body: JSON.stringify({ name }) }, token);
      const detail = await request<Room>(`/rooms/${created.id}`, {}, token);
      onRoom(detail);
      setCreateOpen(false);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Ошибка создания комнаты');
    } finally { setLoading(false); }
  };
  const join = async () => {
    setLoading(true);
    try {
      const joined = await request<Room>('/rooms/join', { method: 'POST', body: JSON.stringify({ code: code.trim().toUpperCase() }) }, token);
      onRoom(joined);
      setJoinOpen(false);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Комната не найдена');
    } finally { setLoading(false); }
  };
  useEffect(() => {
    let active = true;
    request<{ items: HistoryItem[] }>('/me/history?limit=6', {}, token)
      .then((data) => { if (active) setHistory(data.items); })
      .catch(() => undefined)
      .finally(() => active && setHistoryLoading(false));
    return () => { active = false; };
  }, [token]);
  return <Shell eyebrow="YOUR DASHBOARD" title={<>Выбираем <span>вместе.</span></>} subtitle={`${user?.username ?? 'Пользователь'}, создайте новую комнату или присоединитесь к друзьям.`} actions={<button className="avatar-button" onClick={onOpenSettings}>{(user?.username ?? 'U').slice(0, 1).toUpperCase()}</button>}>
    <div className="dashboard-grid">
      <button className="big-action dark" onClick={() => setCreateOpen(true)}><span className="action-number">01</span><span className="action-icon">＋</span><strong>Создать комнату</strong><small>Начните новый movie night</small><em>→</em></button>
      <button className="big-action yellow" onClick={() => setJoinOpen(true)}><span className="action-number">02</span><span className="action-icon">⌂</span><strong>Войти в комнату</strong><small>У вас уже есть код?</small><em>→</em></button>
    </div>
    <div className="dashboard-note"><div><span className="eyebrow">СЕЙЧАС</span><h3>Никакого doom-scrolling.</h3></div><p>Каждый новый batch — смесь любимых жанров и случайного exploration. Ваша вкусовая модель растёт на ходу.</p></div>
    {error && <div className="form-error dashboard-error">{error}</div>}
    <div className="history-section">
      <div className="history-head"><span className="eyebrow">ИСТОРИЯ КОМНАТ</span><h2>Что вы уже смотрели.</h2></div>
      {historyLoading ? <div className="loading-card history-loading">Загружаем историю…</div> : history.length === 0 ? <div className="empty-card history-empty"><span className="eyebrow">ПОКА ПУСТО</span><strong>Завершите первую сессию — matched-фильмы появятся здесь.</strong></div> : <div className="history-grid">{history.map(item => <div className="history-card" key={item.room_id}><div className="history-card-top"><strong>{item.room_name}</strong><span className="code-pill small">{item.room_code}</span></div><div className="history-card-meta"><span>{new Date(item.created_at).toLocaleDateString('ru-RU')}</span><span>{item.member_count} чел.</span><span>{item.matched_movies.length > 0 ? `${item.matched_movies.length} match` : item.room_status.toLowerCase()}</span></div>{item.matched_movies.length > 0 && <div className="history-posters">{item.matched_movies.slice(0, 3).map(movie => <div className="history-poster" key={movie.id} title={movie.title} style={{ backgroundImage: movie.poster_url ? `url(${movie.poster_url})` : 'none' }}><span>{!movie.poster_url ? movie.title : ''}</span></div>)}</div>}</div>)}</div>}
    </div>
    {createOpen && <Modal title="Новая комната" onClose={() => setCreateOpen(false)}><label>Название<input autoFocus value={name} onChange={e => setName(e.target.value)} /></label><button disabled={loading || !name.trim()} className="btn btn-primary wide" onClick={create}>{loading ? 'Создаём…' : 'Создать комнату →'}</button></Modal>}
    {joinOpen && <Modal title="Войти по коду" onClose={() => setJoinOpen(false)}><label>Код комнаты<input autoFocus value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={8} placeholder="K7P2QA" /></label><button disabled={loading || code.length < 4} className="btn btn-primary wide" onClick={join}>{loading ? 'Входим…' : 'Войти →'}</button></Modal>}
  </Shell>;
}

function RoomLobby({ user, token, room, onBack, onRoomChange, onStarted, onError, location, onLocation }: { user: User | null; token: string; room: Room; onBack: () => void; onRoomChange: (r: Room) => void; onStarted: (s: Session) => void; onError: (e: string) => void; location: UserLocation | null; onLocation: (l: UserLocation | null) => void }) {
  const me = room.members.find(m => m.user_id === user?.id);
  const allReady = room.members.length > 0 && room.members.every(m => m.is_ready);
  const isOwner = room.owner_id === user?.id;
  const task = room.task ?? 'movies';
  const [starting, setStarting] = useState(false);
  const [pendingTask, setPendingTask] = useState<SearchMode>(task);
  const taskTimerRef = useRef<number | undefined>(undefined);
  const taskSeqRef = useRef(0);
  useEffect(() => () => window.clearTimeout(taskTimerRef.current), []);
  useEffect(() => { setPendingTask(room.task ?? 'movies'); }, [room.task]);
  const setTask = (next: SearchMode) => {
    const seq = ++taskSeqRef.current;
    setPendingTask(next);
    window.clearTimeout(taskTimerRef.current);
    taskTimerRef.current = window.setTimeout(async () => {
      try {
        const updated = await roomsApi.updateTask(room.id, next, token);
        if (taskSeqRef.current !== seq) return;
        onRoomChange(updated);
      } catch (e) {
        if (taskSeqRef.current === seq) {
          onError(e instanceof Error ? e.message : 'Не удалось изменить категорию');
          setPendingTask(room.task ?? 'movies');
        }
      }
    }, 300);
  };
  const setReady = async () => {
    try {
      const result = await request<{ room: Room; is_ready: boolean }>(`/rooms/${room.id}/ready?ready=${!me?.is_ready}`, { method: 'PATCH' }, token);
      onRoomChange(result.room);
    } catch (e) { onError(e instanceof Error ? e.message : 'Не удалось обновить статус'); }
  };
  const start = async () => {
    setStarting(true);
    try {
      const result = await request<{ session_id: string; room_id: string; status: string; created_at: string }>('/rooms/' + room.id + '/start', { method: 'POST' }, token);
      onStarted({ id: result.session_id, room_id: result.room_id, status: 'ACTIVE', created_at: result.created_at });
    } catch (e) { onError(e instanceof Error ? e.message : 'Не удалось начать сессию'); }
    finally { setStarting(false); }
  };
  const copyCode = () => navigator.clipboard?.writeText(room.code).catch(() => undefined);
  const heading = MODE_OPTIONS.find(option => option.mode === pendingTask);
  const needsLocation = pendingTask !== 'movies';
  const canReady = !needsLocation || Boolean(location);
  return <Shell eyebrow="ROOM LOBBY" title={<>{room.name}<br /><span>{room.code}</span></>} subtitle="Выберите категорию для игры и ждите, пока все будут готовы." actions={<button className="nav-link" onClick={onBack}>← выйти</button>}>
    <div className="room-head"><div><span className="eyebrow">ROOM CODE</span><button className="code-pill" onClick={copyCode}>{room.code} ⧉</button></div><div className={`status-dot ${allReady ? 'ready' : ''}`}>{allReady ? 'Все готовы' : `${room.members.filter(m => m.is_ready).length}/${room.members.length} готовы`}</div></div>
    <div className="lobby-category">
      <div className="category-picker">
        <span className="eyebrow">{isOwner ? 'Крутите колесо — выберите категорию' : 'Категория игры'}</span>
        {isOwner
          ? <ModeCircle inline mode={pendingTask} onModeChange={setTask} />
          : <div className="category-picker-readout"><SearchModeIcon mode={pendingTask} size={20} /><span>{heading?.label ?? 'MOVIES'}</span></div>}
        <div className="category-picker-foot">Будем искать: <strong>{heading?.label ?? 'MOVIES'}</strong>{!isOwner && ' · выбирает владелец'}</div>
      </div>
    </div>
    {needsLocation && <div className="lobby-location">
      <span className="eyebrow">ВАША ЛОКАЦИЯ</span>
      <LocationPanel location={location} onLocation={onLocation} />
      {!location && <p className="hint">Заведения ищем рядом с вами — разрешите геолокацию или укажите город. Кнопка «Готов» откроется после этого.</p>}
    </div>}
    <div className="members-list">{room.members.map(m => <div className="member-row" key={m.user_id}><div className="member-avatar">{m.username.slice(0, 1).toUpperCase()}</div><div><strong>{m.username}{m.user_id === user?.id ? ' (вы)' : ''}</strong><small>{m.role === 'OWNER' ? 'owner' : m.is_ready ? 'готов' : 'ожидает'}</small></div><span className={`ready-badge ${m.is_ready ? 'on' : ''}`}>{m.is_ready ? 'READY' : '—'}</span></div>)}</div>
    <div className="room-footer"><button className={`btn ${me?.is_ready ? 'btn-dark' : 'btn-primary'}`} onClick={setReady} disabled={!canReady}>{!canReady ? 'Сначала — геолокация' : me?.is_ready ? 'Я готов ✓' : 'Готов'}</button><button disabled={!isOwner || !allReady || starting} className="btn btn-dark" onClick={start}>{starting ? 'Запуск…' : isOwner ? 'Начать сессию →' : 'Ждём владельца'}</button></div>
    {!isOwner && <p className="hint">Владелец комнаты выбирает категорию колесом и запускает сессию после того, как все нажмут «Готов».</p>}
  </Shell>;
}

function LocationPanel({ location, onLocation }: { location: UserLocation | null; onLocation: (l: UserLocation | null) => void }) {
  const [opening, setOpening] = useState(false);
  const [manual, setManual] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState('');
  const supported = isGeoSupported();

  if (location) {
    const label = location.city ?? `${location.coords.latitude.toFixed(3)}, ${location.coords.longitude.toFixed(3)}`;
    return <div className="location-chip ok"><span className="geo-dot" />{label}<button className="nav-link" onClick={() => onLocation(null)}>изменить</button></div>;
  }

  const open = async () => {
    setOpening(true);
    setErr('');
    try {
      const located = await getCurrentCity();
      onLocation(located);
    } catch {
      setErr('Не получилось определить местоположение.');
      setManual(true);
    } finally {
      setOpening(false);
    }
  };

  const find = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setErr('');
    try {
      const found = await geocodeCity(query.trim());
      if (!found) setErr('Город не найден');
      else onLocation(found);
    } catch {
      setErr('Не удалось найти город');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="location-panel">
      {supported && !manual ? (
        <button className="btn btn-primary wide" onClick={open} disabled={opening}>{opening ? 'Определяем…' : 'Разрешить геолокацию'}</button>
      ) : (
        <div className="location-manual">
          <input className="location-city-input" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') find(); }} placeholder="Город, например Москва" />
          <button className="btn btn-dark" onClick={find} disabled={searching || !query.trim()}>{searching ? 'Ищем…' : 'Найти'}</button>
        </div>
      )}
      {err && <div className="form-error">{err}</div>}
      {supported && !manual && <button type="button" className="switch-link" onClick={() => setManual(true)}>Геолокация не работает? Укажите город вручную</button>}
    </div>
  );
}

function SearchSession({ token, session, room, onMatch, onFinish, location, onLocation }: { token: string; session: Session; room: Room; onMatch: (result: MatchResult) => void; onFinish: () => void; location: UserLocation | null; onLocation: (l: UserLocation | null) => void }) {
  const mode = room.task ?? 'movies';
  const [movies, setMovies] = useState<Movie[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [palette, setPalette] = useState<Palette>(FALLBACK_PALETTE);
  const [city, setCity] = useState<string | null>(null);
  const [geoDenied, setGeoDenied] = useState(false);
  const coordsRef = useRef<Coords | null>(null);

  useEffect(() => {
    if (location) {
      coordsRef.current = location.coords;
      setCity(location.city);
    }
  }, [location]);

  const movie = movies[index];
  const place = places[index];
  const item = mode === 'movies' ? movie : place;

  const loadFeed = useMemo(() => async (targetMode: SearchMode) => {
    setLoading(true);
    setMsg('');
    setIndex(0);
    try {
      if (targetMode === 'movies') {
        const items = await request<Movie[]>(`/sessions/${session.id}/movies?limit=8&exploration_ratio=0.25`, {}, token);
        setMovies(items);
        setPlaces([]);
        return;
      }
      let current = coordsRef.current;
      if (!current) {
        try {
          const located = await getCurrentCity();
          current = located.coords;
          coordsRef.current = located.coords;
          setCity(located.city);
        } catch {
          setGeoDenied(true);
          setLoading(false);
          setMsg('Разрешите доступ к геолокации — заведения ищем рядом с вами.');
          return;
        }
      }
      const items = await placesApi.forSession(session.id, token, targetMode, current);
      setPlaces(items);
      setMovies([]);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Не удалось загрузить подборку');
    } finally {
      setLoading(false);
    }
  }, [session.id, token]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setMsg('');
    setIndex(0);
    setGeoDenied(false);
    if (mode === 'movies') {
      request<Movie[]>(`/sessions/${session.id}/movies?limit=8&exploration_ratio=0.25`, {}, token)
        .then(items => { if (active) { setMovies(items); setPlaces([]); } })
        .catch(e => { if (active) setMsg(e instanceof Error ? e.message : 'Не удалось загрузить фильмы'); })
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }
    (async () => {
      let current = coordsRef.current;
      if (!current) {
        try {
          const located = await getCurrentCity();
          current = located.coords;
          coordsRef.current = located.coords;
          if (active) setCity(located.city);
        } catch {
          if (active) {
            setGeoDenied(true);
            setLoading(false);
            setMsg('Разрешите доступ к геолокации — заведения ищем рядом с вами.');
          }
          return;
        }
      }
      try {
        const items = await placesApi.forSession(session.id, token, mode, current);
        if (active) { setPlaces(items); setMovies([]); }
      } catch (e) {
        if (active) setMsg(e instanceof Error ? e.message : 'Не удалось найти заведения рядом');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [mode, session.id, token]);

  useEffect(() => {
    if (!movie?.poster_url) {
      setPalette(FALLBACK_PALETTE);
      return;
    }
    extractPalette(movie.poster_url).then(setPalette).catch(() => setPalette(FALLBACK_PALETTE));
  }, [movie?.poster_url]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === '1') vote('DISLIKE');
      else if (event.key === '2') vote('SKIP');
      else if (event.key === '3') vote('LIKE');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [movie, busy, index, movies.length]);

  const pageStyle = mode === 'movies'
    ? {
        '--poster-primary': palette.primary,
        '--poster-secondary': palette.secondary,
        '--poster-glow': palette.glow,
        '--poster-ink': palette.ink,
      }
    : {
        '--poster-primary': mode === 'restaurants' ? '#efbd42' : '#f06aa7',
        '--poster-secondary': mode === 'restaurants' ? '#f06aa7' : '#efbd42',
        '--poster-glow': mode === 'restaurants' ? 'rgba(239,189,66,.3)' : 'rgba(240,106,167,.3)',
        '--poster-ink': '#121212',
      };
  const pageStyleVar = pageStyle as React.CSSProperties;
  const swatchPrimary = mode === 'movies' ? palette.primary : pageStyle['--poster-primary'];
  const swatchSecondary = mode === 'movies' ? palette.secondary : pageStyle['--poster-secondary'];

  const vote = async (value: VoteValue) => {
    if (!item || busy) return;
    setBusy(true);
    setMsg('');
    try {
      if (mode === 'movies') {
        const result = await request<{ matched: boolean }>(`/sessions/${session.id}/votes`, { method: 'POST', body: JSON.stringify({ movie_id: movie.id, value }) }, token);
        if (result.matched) {
          onMatch({ kind: 'movie', category: 'movies', movie });
          return;
        }
      } else {
        const result = await request<{ matched: boolean }>(`/sessions/${session.id}/votes`, { method: 'POST', body: JSON.stringify({ place_id: place.id, category: mode === 'restaurants' ? 'RESTAURANT' : 'ENTERTAINMENT', value }) }, token);
        if (result.matched) {
          onMatch({ kind: 'place', category: mode, place });
          return;
        }
      }
      if (index + 1 >= (mode === 'movies' ? movies : places).length) await loadFeed(mode);
      else setIndex(i => i + 1);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Не удалось сохранить выбор');
    } finally { setBusy(false); }
  };

  const heading = MODE_OPTIONS.find(option => option.mode === mode);
  const area = mode === 'movies' ? 'EXPLORE · 25%' : 'NEAR · OPENSTREETMAP';
  const title = mode === 'movies'
    ? <>Найдём <span>ваш фильм.</span></>
    : mode === 'restaurants'
      ? <>Выберем, <span>где поесть.</span></>
      : <>Куда <span>сходить.</span></>;

  return <div className={`movie-session-page search-session-page`} style={pageStyleVar}>
    <div className="cinematic-backdrop" style={{ backgroundImage: movie?.backdrop_url || movie?.poster_url ? `url(${movie.backdrop_url || movie.poster_url})` : undefined }} />
    <div className="cinematic-tint" />
    <main className="page movie-page">
      <div className="nav"><div className="brand"><span className="brand-mark">M</span><span>MOVIE<span>MATCH</span></span></div><div className="nav-actions"><button className="nav-link" onClick={onFinish}>завершить</button></div></div>
      <div className="page-inner movie-page-inner">
        <div className="session-top"><div><span className="eyebrow">ROOM · {room.code}{mode === 'movies' ? '' : ` · ${city ?? 'РЯДОМ С ВАМИ'}`}</span><h1>{title}</h1></div><div className="poster-swatch"><span style={{ background: swatchPrimary }} /><span style={{ background: swatchSecondary }} /></div></div>
        {loading ? <div className="loading-card movie-loading">{mode === 'movies' ? 'Подбираем фильмы…' : 'Ищем заведения рядом…'}</div> : item ? (mode === 'movies' ? <MovieCard movie={movie} busy={busy} onVote={vote} /> : <PlaceCard place={place} busy={busy} onVote={vote} />) : <div className="empty-card">{msg || 'Подборка закончилась.'}{geoDenied ? <div className="empty-actions"><LocationPanel location={location} onLocation={(l) => { onLocation(l); if (l) { coordsRef.current = l.coords; setCity(l.city); setGeoDenied(false); loadFeed(mode); } }} /></div> : <button className="btn btn-dark" onClick={() => loadFeed(mode)}>Обновить</button>}</div>}
        <div className="progress-line movie-progress"><span style={{ width: `${Math.min(100, ((index + 1) / Math.max((mode === 'movies' ? movies : places).length, 1)) * 100)}%` }} /></div>
        <div className="session-footnote"><span>{Math.min(index + 1, (mode === 'movies' ? movies : places).length || 0)} / {(mode === 'movies' ? movies : places).length || '—'}</span><span>{heading?.label} · {area}</span></div>
        {msg && !geoDenied && <div className="form-error">{msg}</div>}
      </div>
    </main>
  </div>;
}

function MovieCard({ movie, busy, onVote }: { movie: Movie; busy: boolean; onVote: (value: VoteValue) => void }) {
  const embedUrl = getYouTubeEmbedUrl(movie.trailer_url);
  return <div className="movie-stage-enhanced">
    <section className="movie-visual-card">
      <div className="trailer-frame-wrap">
        {embedUrl ? <iframe className="trailer-frame" src={`${embedUrl}?autoplay=1&mute=1&controls=1&playsinline=1&rel=0&modestbranding=1`} title={`${movie.title} trailer`} allow="autoplay; encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" /> : movie.backdrop_url ? <img className="trailer-fallback" src={movie.backdrop_url} alt="" /> : movie.poster_url ? <img className="trailer-fallback" src={movie.poster_url} alt="" /> : <div className="poster-fallback">{movie.title}</div>}
        <div className="trailer-status">TRAILER · AUTOPLAY · MUTED</div>
      </div>
      <div className="movie-votes"><button className="vote no" disabled={busy} onClick={() => onVote('DISLIKE')} aria-label="Не нравится">✕</button><button className="vote skip" disabled={busy} onClick={() => onVote('SKIP')} aria-label="Пропустить">↗</button><button className="vote yes" disabled={busy} onClick={() => onVote('LIKE')} aria-label="Нравится">♥</button></div>
    </section>
    <aside className="movie-info-enhanced"><div className="info-title-block"><span className="info-label">NOW PLAYING</span><h2>{movie.title}</h2><div className="tag-row">{movie.genres.slice(0, 4).map(g => <span className="tag dark" key={g.id}>{g.name}</span>)}</div><span className="info-meta">{movie.release_date?.slice(0, 4) ?? '—'} · {movie.vote_average ? movie.vote_average.toFixed(1) : '—'} / 10</span></div><div className="info-label">ABOUT THIS FILM</div><p>{movie.overview || 'Описание пока недоступно.'}</p><div className="info-stat-grid"><div><span>POPULARITY</span><strong>{movie.popularity ? movie.popularity.toFixed(0) : '—'}</strong></div><div><span>VOTES</span><strong>{movie.vote_count?.toLocaleString() ?? '—'}</strong></div></div>{movie.trailer_url && <a className="trailer-link" href={movie.trailer_url} target="_blank" rel="noreferrer">Открыть трейлер отдельно ↗</a>}<div className="explore-note"><span>WHY THIS FILM</span><strong>Часть выдачи специально выходит за пределы ваших любимых жанров.</strong></div></aside>
  </div>;
}

function MatchScreen({ result, onBack }: { result: MatchResult | null; onBack: () => void }) {
  const movie = result?.kind === 'movie' ? result.movie : null;
  const place = result?.kind === 'place' ? result.place : null;
  const [palette, setPalette] = useState<Palette>(FALLBACK_PALETTE);
  useEffect(() => { if (movie?.poster_url) extractPalette(movie.poster_url).then(setPalette).catch(() => undefined); }, [movie?.poster_url]);

  const primary = movie ? palette.primary : place?.category === 'RESTAURANT' ? '#efbd42' : '#f06aa7';
  const secondary = movie ? palette.secondary : place?.category === 'RESTAURANT' ? '#f06aa7' : '#efbd42';
  const glow = movie ? palette.glow : place?.category === 'RESTAURANT' ? 'rgba(239,189,66,.3)' : 'rgba(240,106,167,.3)';
  const style = { '--poster-primary': primary, '--poster-secondary': secondary, '--poster-glow': glow } as React.CSSProperties;

  const mapUrl = place ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.latitude},${place.longitude}`)}` : null;
  const tags = place ? (place.tags.length > 0 ? place.tags : (place.cuisine ?? '').split(';').map(s => s.trim()).filter(Boolean).slice(0, 4)) : [];

  return <div className="match-page" style={style}>
    <div className="match-glow" />
    <main className="page match-inner-page">
      <div className="nav"><div className="brand"><span className="brand-mark">M</span><span>MOVIE<span>MATCH</span></span></div><div className="nav-actions"><button className="nav-link" onClick={onBack}>на главную</button></div></div>
      <div className="page-inner">
        <div className="hero-copy"><span className="eyebrow">MATCH FOUND</span><h1>Кажется, у вас <span>совпадение.</span></h1><p>{result?.kind === 'place' ? 'Все участники выбрали одно место. Осталось только дойти.' : 'Все участники выбрали один фильм. Вечер уже практически спасён.'}</p></div>
        <div className="match-card-enhanced">
          {movie?.poster_url && <div className="match-poster" style={{ backgroundImage: `url(${movie.poster_url})` }}><div className="match-poster-glow" /></div>}
          {result?.kind === 'place' && place && <div className="match-place-media"><div className="icon-scaffold"><PlaceCategoryIcon category={place.category} size={76} /></div><span className="match-kicker" style={{ color: 'rgba(255,255,255,.8)' }}>{place.category === 'RESTAURANT' ? 'RESTAURANT' : 'ENTERTAINMENT'} · {place.city ?? 'рядом с вами'}</span><h2 style={{ fontSize: 'clamp(32px,4vw,56px)', margin: '10px 0 0', letterSpacing: '-.04em', textAlign: 'center' }}>{place.name}</h2></div>}
          <div className="match-copy">
            {result?.kind === 'place' && place ? <>
              <span className="match-kicker">TONIGHT’S PICK</span>
              <h2>{place.name}</h2>
              <p>{place.address || 'Адрес пока недоступен.'}</p>
              {tags.length > 0 && <div className="tag-row">{tags.slice(0, 4).map(tag => <span className="tag dark" key={tag}>{tag}</span>)}</div>}
              {place.opening_hours && <p className="hint" style={{ marginTop: 12 }}>{place.opening_hours}</p>}
              <div className="place-actions wide">
                {(place.website || place.phone) && <a className="btn btn-dark" href={place.website ?? `tel:${place.phone}`} target={place.website ? '_blank' : undefined} rel="noreferrer">Сайт ↗</a>}
                {mapUrl && <a className="btn btn-primary" href={mapUrl} target="_blank" rel="noreferrer">Открыть на карте →</a>}
              </div>
            </> : <>
              <span className="match-kicker">TONIGHT’S PICK</span>
              <h2>{movie?.title ?? 'Ваш фильм'}</h2>
              <p>{movie?.overview ?? 'Совпадение найдено всеми участниками комнаты.'}</p>
              <div className="tag-row">{movie?.genres.slice(0, 4).map(g => <span className="tag dark" key={g.id}>{g.name}</span>)}</div>
              {movie?.trailer_url && <a className="btn btn-primary wide" href={movie.trailer_url} target="_blank" rel="noreferrer">Открыть трейлер →</a>}
            </>}
          </div>
        </div>
        <button className="btn btn-ghost wide" onClick={onBack}>Вернуться на главную</button>
      </div>
    </main>
  </div>;
}

function Settings({ user, token, onBack, onLogout, onEditAge }: { user: User | null; token: string; onBack: () => void; onLogout: () => void; onEditAge: () => void }) {
  const age = user?.birth_date ? calculateAge(user.birth_date) : null;
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordDone, setPasswordDone] = useState(false);
  return <Shell eyebrow="ACCOUNT" title={<>Ваш <span>профиль.</span></>} subtitle="Возраст определяет, можно ли показывать вам контент 18+. Настройка сохраняется в аккаунте." actions={<button className="nav-link" onClick={onBack}>← назад</button>}>
    <div className="profile-card"><div className="profile-avatar large">{(user?.username ?? 'U').slice(0, 1).toUpperCase()}</div><div><span className="eyebrow">USERNAME</span><h2>{user?.username}</h2><p>{user?.email}</p></div></div>
    <div className="settings-grid">
      <button className="settings-row" onClick={onEditAge}>Возраст и цензура <span>{age === null ? 'указать →' : `${age} лет →`}</span></button>
      <button className="settings-row" onClick={() => { setPasswordDone(false); setPasswordError(''); setPasswordOpen(true); }}>Сменить пароль <span>→</span></button>
      <button className="settings-row danger" onClick={onLogout}>Выйти из аккаунта <span>→</span></button>
    </div>
    {passwordOpen && <PasswordModal token={token} onClose={() => setPasswordOpen(false)} onError={setPasswordError} onSuccess={() => { setPasswordDone(true); setPasswordOpen(false); }} />}
    {(passwordError || passwordDone) && <div className={`age-result ${passwordDone ? 'adult' : ''}`}>{passwordDone ? 'Пароль обновлён ✓' : passwordError}</div>}
  </Shell>;
}

function PasswordModal({ token, onClose, onError, onSuccess }: { token: string; onClose: () => void; onError: (message: string) => void; onSuccess: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    onError('');
    if (next.length < 8) { onError('Новый пароль должен быть не короче 8 символов.'); return; }
    if (next !== confirm) { onError('Новые пароли не совпадают.'); return; }
    setBusy(true);
    try {
      await request('/users/me/password', { method: 'PATCH', body: JSON.stringify({ current_password: current, new_password: next }) }, token);
      setBusy(false);
      onSuccess();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Не удалось сменить пароль');
      setBusy(false);
    }
  };
  return <Modal title="Смена пароля" onClose={onClose}>
    <label>Текущий пароль<input type="password" value={current} onChange={e => setCurrent(e.target.value)} autoFocus /></label>
    <label>Новый пароль<input type="password" value={next} onChange={e => setNext(e.target.value)} minLength={8} placeholder="минимум 8 символов" /></label>
    <label>Повторите новый пароль<input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} /></label>
    <button className="btn btn-primary wide" disabled={busy || !current || !next || next !== confirm} onClick={submit}>{busy ? 'Сохраняем…' : 'Сменить пароль →'}</button>
  </Modal>;
}

function AgeGate({ user, saving, required, onSave, onClose }: { user: User | null; saving: boolean; required: boolean; onSave: (birthDate: string) => void; onClose: () => void }) {
  const [birthDate, setBirthDate] = useState(user?.birth_date ?? '');
  const age = birthDate ? calculateAge(birthDate) : null;
  return <Modal title={required ? 'Перед первым фильмом' : 'Возраст и цензура'} onClose={required ? () => undefined : onClose}>
    <div className="age-gate-copy">
      <span className="eyebrow">CONTENT FILTER</span>
      <h3>{required ? 'Сколько вам лет?' : 'Укажите дату рождения'}</h3>
      <p>{required ? 'Это нужно, чтобы не показывать фильмы 18+ пользователям младше 18 лет.' : 'Мы автоматически скрываем 18+ контент для пользователей младше 18 лет.'}</p>
    </div>
    <label>Дата рождения<input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} max={new Date().toISOString().slice(0, 10)} /></label>
    {age !== null && <div className={`age-result ${age >= 18 ? 'adult' : 'minor'}`}>{age} лет · {age >= 18 ? '18+ контент доступен' : '18+ контент скрыт'}</div>}
    <button className="btn btn-primary wide" disabled={!birthDate || saving} onClick={() => onSave(birthDate)}>{saving ? 'Сохраняем…' : 'Сохранить возраст →'}</button>
  </Modal>;
}

function calculateAge(birthDate: string): number {
  const birth = new Date(`${birthDate}T00:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const month = today.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}


function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop"><div className="modal-card"><div className="modal-top"><h2>{title}</h2><button onClick={onClose}>×</button></div>{children}</div></div>;
}

async function extractPalette(url: string): Promise<Palette> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 32;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('Canvas unavailable');
        ctx.drawImage(image, 0, 0, size, size);
        const pixels = ctx.getImageData(0, 0, size, size).data;
        const bins = new Map<string, { weight: number; r: number; g: number; b: number }>();
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i]; const g = pixels[i + 1]; const b = pixels[i + 2]; const a = pixels[i + 3];
          if (a < 180) continue;
          const max = Math.max(r, g, b); const min = Math.min(r, g, b);
          const brightness = (r + g + b) / 3;
          if (brightness < 28 || brightness > 245) continue;
          const saturation = max - min;
          const qr = Math.round(r / 24) * 24; const qg = Math.round(g / 24) * 24; const qb = Math.round(b / 24) * 24;
          const key = `${qr}-${qg}-${qb}`;
          const weight = 1 + saturation / 255;
          const old = bins.get(key);
          bins.set(key, old ? { weight: old.weight + weight, r: old.r + r * weight, g: old.g + g * weight, b: old.b + b * weight } : { weight, r: r * weight, g: g * weight, b: b * weight });
        }
        const ranked = [...bins.values()].sort((a, b) => b.weight - a.weight).slice(0, 4);
        if (!ranked.length) throw new Error('No usable colors');
        const colors = ranked.map(item => {
          const r = Math.round(item.r / item.weight); const g = Math.round(item.g / item.weight); const b = Math.round(item.b / item.weight);
          return { r, g, b, hex: rgbToHex(r, g, b) };
        });
        const primary = colors[0].hex;
        const secondary = (colors[1] ?? colors[0]).hex;
        const luminance = (colors[0].r * 299 + colors[0].g * 587 + colors[0].b * 114) / 1000;
        resolve({ primary, secondary, glow: `rgba(${colors[0].r}, ${colors[0].g}, ${colors[0].b}, .32)`, ink: luminance > 150 ? '#121212' : '#ffffff' });
      } catch (error) { reject(error); }
    };
    image.onerror = () => reject(new Error('Poster CORS prevented palette extraction'));
    image.src = url;
  });
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(value => Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0')).join('');
}

export { App };
