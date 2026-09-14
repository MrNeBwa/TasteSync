import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiFetch as request } from '../shared/api/client';
import { getRuntimeWsBaseUrl } from '../shared/api/config';
import { clearTokens, getAccessToken, saveTokens } from '../shared/lib/storage';
import { getYouTubeEmbedUrl } from '../shared/lib/youtube';
import type { AuthMode, Genre, Movie, Palette, Room, RoomMember, Screen, Session, User, VoteValue } from '../shared/types/domain';

function App() {
  const [screen, setScreen] = useState<Screen>(() => getAccessToken() ? 'home' : 'landing');
  const [token, setToken] = useState(() => getAccessToken());
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authLoading, setAuthLoading] = useState(Boolean(getAccessToken()));
  const [room, setRoom] = useState<Room | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [matchMovie, setMatchMovie] = useState<Movie | null>(null);
  const [error, setError] = useState('');
  const [ageGateOpen, setAgeGateOpen] = useState(false);
  const [ageSaving, setAgeSaving] = useState(false);

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
    const ws = new WebSocket(`${wsBase}/ws/rooms/${room.id}?token=${encodeURIComponent(token)}`);
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as { type: string; payload?: unknown };
        if (msg.type === 'ROOM_READY_CHANGED' && msg.payload && typeof msg.payload === 'object') setRoom(msg.payload as Room);
        if (msg.type === 'SESSION_STARTED' && msg.payload && typeof msg.payload === 'object') {
          const payload = msg.payload as { session_id: string; room_id?: string; created_at?: string };
          setSession({ id: payload.session_id, room_id: payload.room_id ?? room.id, status: 'ACTIVE', created_at: payload.created_at ?? new Date().toISOString() });
          setScreen('session');
        }
        if (msg.type === 'MATCH_FOUND' && msg.payload && typeof msg.payload === 'object') {
          const payload = msg.payload as { movie_id: string; session_id: string };
          setScreen('match');
          request<Movie[]>(`/sessions/${payload.session_id}/movies?limit=50`, {}, token)
            .then(movies => setMatchMovie(movies.find(movie => movie.id === payload.movie_id) ?? null))
            .catch(() => undefined);
        }
        if (msg.type === 'SESSION_FINISHED') setSession(prev => prev ? { ...prev, status: 'FINISHED' } : prev);
      } catch {
        // Ignore malformed realtime messages.
      }
    };
    ws.onerror = () => setError('Realtime-соединение с комнатой недоступно.');
    return () => ws.close();
  }, [room, token, screen]);

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
      {authenticated && screen === 'room' && room && <RoomLobby user={user} token={token} room={room} onBack={() => setScreen('home')} onRoomChange={setRoom} onStarted={(s) => { setSession(s); setScreen('session'); }} onError={setError} />}
      {authenticated && screen === 'session' && session && room && <MovieSession token={token} session={session} room={room} onMatch={(movie) => { setMatchMovie(movie); setScreen('match'); }} onFinish={() => { setScreen('home'); setSession(null); }} />}
      {authenticated && screen === 'match' && room && <MatchScreen movie={matchMovie} onBack={() => setScreen('home')} />}
      {authenticated && screen === 'settings' && <Settings user={user} onBack={() => setScreen('home')} onLogout={logout} onEditAge={() => setAgeGateOpen(true)} />}
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
  return <Shell eyebrow="YOUR DASHBOARD" title={<>Выбираем <span>вместе.</span></>} subtitle={`${user?.username ?? 'Пользователь'}, создайте новую комнату или присоединитесь к друзьям.`} actions={<button className="avatar-button" onClick={onOpenSettings}>{(user?.username ?? 'U').slice(0, 1).toUpperCase()}</button>}>
    <div className="dashboard-grid">
      <button className="big-action dark" onClick={() => setCreateOpen(true)}><span className="action-number">01</span><span className="action-icon">＋</span><strong>Создать комнату</strong><small>Начните новый movie night</small><em>→</em></button>
      <button className="big-action yellow" onClick={() => setJoinOpen(true)}><span className="action-number">02</span><span className="action-icon">⌂</span><strong>Войти в комнату</strong><small>У вас уже есть код?</small><em>→</em></button>
    </div>
    <div className="dashboard-note"><div><span className="eyebrow">СЕЙЧАС</span><h3>Никакого doom-scrolling.</h3></div><p>Каждый новый batch — смесь любимых жанров и случайного exploration. Ваша вкусовая модель растёт на ходу.</p></div>
    {error && <div className="form-error dashboard-error">{error}</div>}
    {createOpen && <Modal title="Новая комната" onClose={() => setCreateOpen(false)}><label>Название<input autoFocus value={name} onChange={e => setName(e.target.value)} /></label><button disabled={loading || !name.trim()} className="btn btn-primary wide" onClick={create}>{loading ? 'Создаём…' : 'Создать комнату →'}</button></Modal>}
    {joinOpen && <Modal title="Войти по коду" onClose={() => setJoinOpen(false)}><label>Код комнаты<input autoFocus value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={8} placeholder="K7P2QA" /></label><button disabled={loading || code.length < 4} className="btn btn-primary wide" onClick={join}>{loading ? 'Входим…' : 'Войти →'}</button></Modal>}
  </Shell>;
}

function RoomLobby({ user, token, room, onBack, onRoomChange, onStarted, onError }: { user: User | null; token: string; room: Room; onBack: () => void; onRoomChange: (r: Room) => void; onStarted: (s: Session) => void; onError: (e: string) => void }) {
  const me = room.members.find(m => m.user_id === user?.id);
  const allReady = room.members.length > 0 && room.members.every(m => m.is_ready);
  const isOwner = room.owner_id === user?.id;
  const [starting, setStarting] = useState(false);
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
  return <Shell eyebrow="ROOM LOBBY" title={<>{room.name}<br /><span>{room.code}</span></>} subtitle="Все готовы? Тогда запускаем поиск фильма." actions={<button className="nav-link" onClick={onBack}>← выйти</button>}>
    <div className="room-head"><div><span className="eyebrow">ROOM CODE</span><button className="code-pill" onClick={copyCode}>{room.code} ⧉</button></div><div className={`status-dot ${allReady ? 'ready' : ''}`}>{allReady ? 'Все готовы' : `${room.members.filter(m => m.is_ready).length}/${room.members.length} готовы`}</div></div>
    <div className="members-list">{room.members.map(m => <div className="member-row" key={m.user_id}><div className="member-avatar">{m.username.slice(0, 1).toUpperCase()}</div><div><strong>{m.username}{m.user_id === user?.id ? ' (вы)' : ''}</strong><small>{m.role === 'OWNER' ? 'owner' : m.is_ready ? 'готов' : 'ожидает'}</small></div><span className={`ready-badge ${m.is_ready ? 'on' : ''}`}>{m.is_ready ? 'READY' : '—'}</span></div>)}</div>
    <div className="room-footer"><button className={`btn ${me?.is_ready ? 'btn-dark' : 'btn-primary'}`} onClick={setReady}>{me?.is_ready ? 'Я готов ✓' : 'Готов'}</button><button disabled={!isOwner || !allReady || starting} className="btn btn-dark" onClick={start}>{starting ? 'Запуск…' : isOwner ? 'Начать сессию →' : 'Ждём владельца'}</button></div>
    {!isOwner && <p className="hint">Владелец комнаты запускает сессию после того, как все нажмут «Готов».</p>}
  </Shell>;
}

function MovieSession({ token, session, room, onMatch, onFinish }: { token: string; session: Session; room: Room; onMatch: (m: Movie) => void; onFinish: () => void }) {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [palette, setPalette] = useState<Palette>(FALLBACK_PALETTE);
  const movie = movies[index];

  const load = async () => {
    setLoading(true);
    setMsg('');
    try {
      const items = await request<Movie[]>(`/sessions/${session.id}/movies?limit=8&exploration_ratio=0.25`, {}, token);
      setMovies(items);
      setIndex(0);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Не удалось загрузить фильмы');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [session.id]);
  useEffect(() => {
    if (!movie?.poster_url) {
      setPalette(FALLBACK_PALETTE);
      return;
    }
    extractPalette(movie.poster_url).then(setPalette).catch(() => setPalette(FALLBACK_PALETTE));
  }, [movie?.poster_url]);

  const style = {
    '--poster-primary': palette.primary,
    '--poster-secondary': palette.secondary,
    '--poster-glow': palette.glow,
    '--poster-ink': palette.ink,
  } as React.CSSProperties;

  const vote = async (value: VoteValue) => {
    if (!movie || busy) return;
    setBusy(true);
    setMsg('');
    try {
      const result = await request<{ matched: boolean; match: unknown }>(`/sessions/${session.id}/votes`, { method: 'POST', body: JSON.stringify({ movie_id: movie.id, value }) }, token);
      if (result.matched) {
        onMatch(movie);
        return;
      }
      if (index + 1 >= movies.length) await load();
      else setIndex(i => i + 1);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Не удалось сохранить выбор');
    } finally { setBusy(false); }
  };

  return <div className="movie-session-page" style={style}>
    <div className="cinematic-backdrop" style={{ backgroundImage: movie?.backdrop_url || movie?.poster_url ? `url(${movie.backdrop_url || movie.poster_url})` : undefined }} />
    <div className="cinematic-tint" />
    <main className="page movie-page">
      <div className="nav"><div className="brand"><span className="brand-mark">M</span><span>MOVIE<span>MATCH</span></span></div><div className="nav-actions"><button className="nav-link" onClick={onFinish}>завершить</button></div></div>
      <div className="page-inner movie-page-inner">
        <div className="session-top"><div><span className="eyebrow">ROOM · {room.code}</span><h1>Найдём <span>ваш фильм.</span></h1></div><div className="poster-swatch"><span style={{ background: palette.primary }} /><span style={{ background: palette.secondary }} /></div></div>
        {loading ? <div className="loading-card movie-loading">Подбираем фильмы…</div> : movie ? <MovieCard movie={movie} busy={busy} onVote={vote} /> : <div className="empty-card">{msg || 'Фильмы закончились.'}<button className="btn btn-dark" onClick={load}>Обновить</button></div>}
        <div className="progress-line movie-progress"><span style={{ width: `${Math.min(100, ((index + 1) / Math.max(movies.length, 1)) * 100)}%` }} /></div>
        <div className="session-footnote"><span>{Math.min(index + 1, movies.length || 0)} / {movies.length || '—'}</span><span>EXPLORE · 25%</span></div>
        {msg && <div className="form-error">{msg}</div>}
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

function MatchScreen({ movie, onBack }: { movie: Movie | null; onBack: () => void }) {
  const [palette, setPalette] = useState<Palette>(FALLBACK_PALETTE);
  useEffect(() => { if (movie?.poster_url) extractPalette(movie.poster_url).then(setPalette).catch(() => undefined); }, [movie?.poster_url]);
  const style = { '--poster-primary': palette.primary, '--poster-secondary': palette.secondary, '--poster-glow': palette.glow } as React.CSSProperties;
  return <div className="match-page" style={style}>
    <div className="match-glow" />
    <main className="page match-inner-page">
      <div className="nav"><div className="brand"><span className="brand-mark">M</span><span>MOVIE<span>MATCH</span></span></div><div className="nav-actions"><button className="nav-link" onClick={onBack}>на главную</button></div></div>
      <div className="page-inner">
        <div className="hero-copy"><span className="eyebrow">MATCH FOUND</span><h1>Кажется, у вас <span>совпадение.</span></h1><p>Все участники выбрали один фильм. Вечер уже практически спасён.</p></div>
        <div className="match-card-enhanced">
          {movie?.poster_url && <div className="match-poster" style={{ backgroundImage: `url(${movie.poster_url})` }}><div className="match-poster-glow" /></div>}
          <div className="match-copy"><span className="match-kicker">TONIGHT’S PICK</span><h2>{movie?.title ?? 'Ваш фильм'}</h2><p>{movie?.overview ?? 'Совпадение найдено всеми участниками комнаты.'}</p><div className="tag-row">{movie?.genres.slice(0, 4).map(g => <span className="tag dark" key={g.id}>{g.name}</span>)}</div>{movie?.trailer_url && <a className="btn btn-primary wide" href={movie.trailer_url} target="_blank" rel="noreferrer">Открыть трейлер →</a>}</div>
        </div>
        <button className="btn btn-ghost wide" onClick={onBack}>Вернуться на главную</button>
      </div>
    </main>
  </div>;
}

function Settings({ user, onBack, onLogout, onEditAge }: { user: User | null; onBack: () => void; onLogout: () => void; onEditAge: () => void }) {
  const age = user?.birth_date ? calculateAge(user.birth_date) : null;
  return <Shell eyebrow="ACCOUNT" title={<>Ваш <span>профиль.</span></>} subtitle="Возраст определяет, можно ли показывать вам контент 18+. Настройка сохраняется в аккаунте." actions={<button className="nav-link" onClick={onBack}>← назад</button>}>
    <div className="profile-card"><div className="profile-avatar large">{(user?.username ?? 'U').slice(0, 1).toUpperCase()}</div><div><span className="eyebrow">USERNAME</span><h2>{user?.username}</h2><p>{user?.email}</p></div></div>
    <div className="settings-grid">
      <button className="settings-row" onClick={onEditAge}>Возраст и цензура <span>{age === null ? 'указать →' : `${age} лет →`}</span></button>
      <button className="settings-row">Сменить пароль <span>→</span></button>
      <button className="settings-row danger" onClick={onLogout}>Выйти из аккаунта <span>→</span></button>
    </div>
  </Shell>;
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
