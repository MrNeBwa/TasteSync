import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { Button, Loading, type Palette } from '../../src/components/Ui';
import { useTheme } from '../../src/store/ThemeContext';
import { geocodeCityMobile, PRESET_CITIES, request, type Room, type SearchMode } from '../../src/lib/api';
import { getSavedLocation, getWsUrl, saveLocation, type SavedLocation } from '../../src/lib/config';
import { useAuth } from '../../src/store/AuthContext';

export function getJoinUrl(code: string): string {
  return `https://moviematch.app/join/${code}`;
}

const MODE_LABELS: Record<SearchMode, { title: string; badge: string }> = {
  movies: { title: 'Фильмы', badge: 'MOVIES' },
  restaurants: { title: 'Кафе и рестораны', badge: 'FOOD' },
  entertainment: { title: 'Развлечения', badge: 'PLACES' },
};

export default function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, user } = useAuth();
  const { theme, palette } = useTheme();
  const muted = theme === 'dark' ? '#B3B0A8' : '#777';
  const s = makeStyles(palette, muted);
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [location, setLocation] = useState<SavedLocation>(getSavedLocation);
  const [cityQuery, setCityQuery] = useState('');
  const [citySearching, setCitySearching] = useState(false);

  const navigated = useRef(false);
  function goToSession(sessionId: string | undefined | null) {
    if (!sessionId || navigated.current) return;
    navigated.current = true;
    router.replace(`/session/${sessionId}`);
  }

  async function load() {
    try {
      const fresh = await request<Room>(`/rooms/${id}`, {}, token);
      setRoom(fresh);
      if (fresh.active_session_id) goToSession(fresh.active_session_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка комнаты');
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  useEffect(() => {
    if (!room || !token) return;
    let closed = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    const connect = () => {
      ws = new WebSocket(`${getWsUrl()}/ws/rooms/${room.id}?token=${encodeURIComponent(token)}`);
      ws.onmessage = (ev) => {
        try {
          const m = JSON.parse(ev.data);
          if ((m.type === 'ROOM_READY_CHANGED' || m.type === 'ROOM_TASK_CHANGED' || m.type === 'ROOM_MEMBER_JOINED') && m.payload) {
            setRoom(m.payload);
            if (m.payload.active_session_id) goToSession(m.payload.active_session_id);
          }
          if (m.type === 'SESSION_STARTED' && m.payload) {
            goToSession(m.payload.session_id);
          }
        } catch {
          // Ignore malformed WS frames
        }
      };
      ws.onclose = () => {
        if (!closed) reconnectTimer = setTimeout(connect, 4000);
      };
    };
    connect();
    const timer = setInterval(load, 5000);
    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(timer);
      ws?.close();
    };
  }, [room?.id, token]);

  async function ready(v: boolean) {
    try {
      setError('');
      const r = await request<{ room: Room }>(`/rooms/${id}/ready?ready=${v}`, { method: 'PATCH' }, token);
      setRoom(r.room);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось изменить готовность');
    }
  }

  async function changeTask(nextTask: SearchMode) {
    if (!room || room.task === nextTask) return;
    try {
      setError('');
      const updated = await request<Room>(`/rooms/${id}/task`, {
        method: 'PATCH',
        body: JSON.stringify({ task: nextTask }),
      }, token);
      setRoom(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось изменить категорию');
    }
  }

  async function selectCity(loc: SavedLocation) {
    const saved = await saveLocation(loc);
    setLocation(saved);
  }

  async function searchCity() {
    if (!cityQuery.trim()) return;
    setCitySearching(true);
    setError('');
    try {
      const found = await geocodeCityMobile(cityQuery.trim());
      if (!found) {
        setError('Город не найден');
      } else {
        await selectCity(found);
        setCityQuery('');
      }
    } finally {
      setCitySearching(false);
    }
  }

  async function start() {
    setStarting(true);
    setError('');
    try {
      const r = await request<{ session_id?: string; id?: string }>(`/rooms/${id}/start`, { method: 'POST' }, token);
      goToSession(r.session_id ?? r.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось начать сессию');
    } finally {
      setStarting(false);
    }
  }

  async function leave() {
    try {
      await request(`/rooms/${id}/members/me`, { method: 'DELETE' }, token);
      router.replace('/home');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось выйти из комнаты');
    }
  }

  async function shareRoom() {
    if (!room) return;
    try {
      await Share.share({
        message: `Присоединяйся к комнате «${room.name}» в Movie Match! Код: ${room.code} — ${getJoinUrl(room.code)}`,
      });
    } catch {
      // Ignore share cancellation
    }
  }

  if (!room) return error ? <View style={s.center}><Text style={s.error}>{error}</Text><Button onPress={() => router.replace('/home')}>На главную</Button></View> : <Loading />;

  const me = room.members.find((m) => m.user_id === user?.id);
  const isOwner = room.owner_id === user?.id;
  const allReady = room.members.length > 0 && room.members.every((m) => m.is_ready);
  const currentTask: SearchMode = room.task ?? 'movies';

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.kicker}>ROOM · {room.code}</Text>
      <Text style={s.title}>{room.name}</Text>
      <View style={s.statusRow}>
        <Text style={s.status}>{room.status}</Text>
        <Text style={s.taskBadge}>{MODE_LABELS[currentTask].badge}</Text>
      </View>

      <View style={s.card}>
        <Text style={s.kicker}>{isOwner ? 'КАТЕГОРИЯ ПОИСКА' : 'ЧТО ИЩЕМ'}</Text>
        <View style={s.modeRow}>
          {(['movies', 'restaurants', 'entertainment'] as SearchMode[]).map((mode) => {
            const active = currentTask === mode;
            return (
              <Pressable
                key={mode}
                disabled={!isOwner}
                onPress={() => void changeTask(mode)}
                style={[s.modePill, active && s.modePillActive, !isOwner && !active && { opacity: 0.45 }]}
              >
                <Text style={[s.modePillText, active && s.modePillTextActive]}>{MODE_LABELS[mode].title}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {currentTask !== 'movies' && (
        <View style={s.card}>
          <Text style={s.kicker}>ЛОКАЦИЯ: {location.city.toUpperCase()}</Text>
          <View style={s.cityChips}>
            {PRESET_CITIES.map((c) => {
              const active = c.city === location.city;
              return (
                <Pressable key={c.city} onPress={() => void selectCity(c)} style={[s.cityChip, active && s.cityChipActive]}>
                  <Text style={[s.cityChipText, active && s.cityChipTextActive]}>{c.city}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={s.citySearchRow}>
            <TextInput
              value={cityQuery}
              onChangeText={setCityQuery}
              placeholder="Другой город…"
              placeholderTextColor={muted}
              style={s.cityInput}
              onSubmitEditing={() => void searchCity()}
            />
            <Pressable style={s.citySearchBtn} onPress={() => void searchCity()} disabled={citySearching}>
              <Text style={s.citySearchBtnText}>{citySearching ? '…' : 'Найти'}</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={s.members}>
        {room.members.map((m) => (
          <View key={m.user_id} style={s.member}>
            <View style={s.avatar}><Text style={{ color: '#111111', fontWeight: '900' }}>{m.username.slice(0, 1).toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{m.username}{m.user_id === user?.id ? ' (вы)' : ''}</Text>
              <Text style={s.role}>{m.role === 'OWNER' ? 'Владелец' : 'Участник'}</Text>
            </View>
            <Text style={[s.ready, m.is_ready && s.readyOn]}>{m.is_ready ? 'ГОТОВ' : 'НЕ ГОТОВ'}</Text>
          </View>
        ))}
      </View>

      {error ? <Text style={s.error}>{error}</Text> : null}

      <View style={s.qr}>
        <Text style={s.qrKicker}>ПРИГЛАШЕНИЕ ПО QR</Text>
        <View style={s.qrBox}>
          <QRCode value={getJoinUrl(room.code)} size={170} />
        </View>
        <Text style={s.qrHint}>Код комнаты: {room.code}</Text>
        <Button variant="secondary" onPress={() => void shareRoom()}>Поделиться приглашением</Button>
      </View>

      {me ? <Button variant={me.is_ready ? 'secondary' : 'primary'} onPress={() => void ready(!me.is_ready)}>{me.is_ready ? 'Я не готов' : 'Я готов ✓'}</Button> : null}
      {isOwner ? <Button disabled={!allReady || starting} onPress={() => void start()}>{starting ? 'Запускаем…' : 'Начать сессию →'}</Button> : <Text style={s.wait}>Ожидаем владельца комнаты…</Text>}
      {me?.role !== 'OWNER' ? <Button variant="danger" onPress={() => void leave()}>Покинуть комнату</Button> : null}
      <Pressable onPress={() => router.replace('/home')}><Text style={s.link}>← Вернуться</Text></Pressable>
    </ScrollView>
  );
}

function makeStyles(c: Palette, muted: string) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.paper },
    content: { padding: 20, gap: 14, paddingTop: 42, paddingBottom: 60 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 12 },
    kicker: { fontSize: 11, letterSpacing: 2, color: muted, fontWeight: '700' },
    title: { fontSize: 40, fontWeight: '900', letterSpacing: -1.5, color: c.ink },
    statusRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    status: { backgroundColor: c.yellow, borderWidth: 2, borderColor: c.ink, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, fontSize: 12, fontWeight: '900', color: '#111111' },
    taskBadge: { backgroundColor: c.pink, borderWidth: 2, borderColor: c.ink, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, fontSize: 12, fontWeight: '900', color: '#111111' },
    card: { borderWidth: 2, borderColor: c.ink, borderRadius: 20, backgroundColor: c.paper, padding: 14, gap: 10 },
    modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    modePill: { borderWidth: 2, borderColor: c.ink, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: c.soft },
    modePillActive: { backgroundColor: c.yellow },
    modePillText: { fontSize: 13, fontWeight: '800', color: c.ink },
    modePillTextActive: { color: '#111111' },
    cityChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    cityChip: { borderWidth: 1.5, borderColor: c.ink, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: c.soft },
    cityChipActive: { backgroundColor: c.yellow },
    cityChipText: { fontSize: 12, fontWeight: '700', color: c.ink },
    cityChipTextActive: { color: '#111111', fontWeight: '900' },
    citySearchRow: { flexDirection: 'row', gap: 8 },
    cityInput: { flex: 1, height: 44, borderWidth: 2, borderColor: c.soft, borderRadius: 12, paddingHorizontal: 12, fontSize: 14, color: c.ink, backgroundColor: c.paper },
    citySearchBtn: { borderWidth: 2, borderColor: c.ink, borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center', backgroundColor: c.yellow },
    citySearchBtnText: { fontWeight: '900', color: '#111111' },
    members: { gap: 10, marginTop: 4 },
    member: { minHeight: 72, borderWidth: 2, borderColor: c.ink, borderRadius: 18, backgroundColor: c.paper, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: c.ink, alignItems: 'center', justifyContent: 'center', backgroundColor: c.pink },
    name: { fontSize: 18, fontWeight: '900', color: c.ink },
    role: { fontSize: 12, color: muted, marginTop: 2 },
    ready: { fontSize: 10, fontWeight: '900', color: muted },
    readyOn: { color: c.ink === '#111111' ? '#22813B' : '#7CE1A0' },
    error: { color: '#8F1722', backgroundColor: themeErrorBg(c), padding: 12, borderRadius: 12 },
    wait: { textAlign: 'center', color: muted, padding: 10 },
    link: { textAlign: 'center', fontSize: 16, fontWeight: '800', paddingVertical: 10, color: c.ink },
    qr: { backgroundColor: c.ink === '#111111' ? '#fff' : '#0F1115', borderWidth: 2, borderColor: c.ink, borderRadius: 20, alignItems: 'center', padding: 18, gap: 12 },
    qrBox: { padding: 10, backgroundColor: '#fff', borderRadius: 12 },
    qrKicker: { fontSize: 11, letterSpacing: 2, color: c.ink === '#111111' ? '#777' : '#A3A19A', fontWeight: '700' },
    qrHint: { fontSize: 13, textAlign: 'center', color: c.ink === '#111111' ? '#777' : '#B3B0A8', lineHeight: 19, fontWeight: '700' },
  });
}

function themeErrorBg(c: Palette) {
  return c.ink === '#111111' ? '#FFE0E4' : '#3A2026';
}
