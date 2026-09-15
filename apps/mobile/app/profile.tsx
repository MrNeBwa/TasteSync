import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, ErrorBox, type Palette } from '../src/components/Ui';
import { request, type HistoryItem, type User } from '../src/lib/api';
import { saveUser } from '../src/lib/auth';
import { useTheme } from '../src/store/ThemeContext';
import { useAuth } from '../src/store/AuthContext';

export default function Profile() {
  const { token, user, refreshMe, logout } = useAuth();
  const { theme, palette, toggleTheme } = useTheme();
  const muted = theme === 'dark' ? '#B3B0A8' : '#777';
  const s = makeStyles(palette, muted);
  const insets = useSafeAreaInsets();
  const [date, setDate] = useState(user?.birth_date ?? '');
  const [error, setError] = useState('');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordDone, setPasswordDone] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  async function save() {
    try {
      const updated = await request<User>('/users/me/age', { method: 'PATCH', body: JSON.stringify({ birth_date: date }) }, token);
      await saveUser(updated);
      await refreshMe();
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить');
    }
  }
  async function changePassword() {
    setPasswordDone(false); setError('');
    if (next.length < 8) return setError('Новый пароль должен быть не короче 8 символов.');
    if (next !== confirm) return setError('Новые пароли не совпадают.');
    setPasswordBusy(true);
    try {
      await request('/users/me/password', { method: 'PATCH', body: JSON.stringify({ current_password: current, new_password: next }) }, token);
      setPasswordDone(true); setCurrent(''); setNext(''); setConfirm('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось сменить пароль'); }
    finally { setPasswordBusy(false); }
  }
  useEffect(() => {
    let active = true;
    request<{ items: HistoryItem[] }>('/me/history?limit=6', {}, token)
      .then((data) => { if (active) setHistory(data.items); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [token]);
  return <View style={s.screen}>
    <View style={[s.header, { paddingTop: insets.top + 16, flexDirection: 'row' }]}><Text style={s.headerText}>Профиль</Text></View>
    <ScrollView contentContainerStyle={s.body}>
      <Text style={s.avatar}>●</Text>
      <Text style={s.username}>{user?.username}</Text>
      <Text style={s.kicker}>НАСТРОЙКИ</Text>
      <PressableRow label="Тема оформления" value={theme === 'dark' ? 'тёмная' : 'светлая'} onPress={toggleTheme} s={s} />
      <Text style={s.label}>Дата рождения</Text>
      <TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={muted} style={s.input} />
      <Button onPress={save}>Сохранить возраст</Button>
      <Text style={s.kicker}>СМЕНА ПАРОЛЯ</Text>
      <TextInput value={current} onChangeText={setCurrent} placeholder="Текущий пароль" secureTextEntry placeholderTextColor={muted} style={s.input} />
      <TextInput value={next} onChangeText={setNext} placeholder="Новый пароль" secureTextEntry placeholderTextColor={muted} style={s.input} />
      <TextInput value={confirm} onChangeText={setConfirm} placeholder="Повторите новый пароль" secureTextEntry placeholderTextColor={muted} style={s.input} />
      <Button variant="secondary" disabled={passwordBusy} onPress={changePassword}>{passwordBusy ? 'Сохраняем…' : 'Сменить пароль'}</Button>
      {!!passwordDone && <Text style={s.done}>Пароль обновлён ✓</Text>}
      {!!error && <ErrorBox text={error} />}
      <Text style={s.kicker}>ИСТОРИЯ</Text>
      {history.length === 0 ? <Text style={s.hint}>Здесь появятся комнаты и найденные фильмы.</Text> : history.map((item) => (
        <View key={item.room_id} style={s.historyCard}>
          <View style={s.historyHead}><Text style={s.historyName}>{item.room_name}</Text><Text style={s.historyCode}>{item.room_code}</Text></View>
          <Text style={s.historyMeta}>{new Date(item.created_at).toLocaleDateString('ru-RU')} · {item.member_count} чел. · {item.matched_movies.length > 0 ? `${item.matched_movies.length} match` : item.room_status.toLowerCase()}</Text>
          {item.matched_movies.length > 0 ? <View style={s.posters}>{item.matched_movies.slice(0, 3).map((movie) => movie.poster_url ? <Image key={movie.id} source={{ uri: movie.poster_url }} style={s.poster} /> : <View key={movie.id} style={[s.poster, s.posterFallback]}><Text style={s.posterFallbackText}>{movie.title}</Text></View>)}</View> : null}
        </View>
      ))}
      <Button variant="danger" onPress={async () => { await logout(); router.replace('/auth'); }}>Выйти из аккаунта</Button>
      <Button variant="secondary" onPress={() => router.back()}>Назад</Button>
    </ScrollView>
  </View>;
}
function PressableRow({ label, value, onPress, s }: { label: string; value: string; onPress: () => void; s: ReturnType<typeof makeStyles> }) {
  const { palette } = useTheme();
  return <View style={s.row}><Text style={s.rowLabel}>{label}</Text><Text onPress={onPress} style={[s.rowValue, { color: palette.pink }]}>{value} · нажмите</Text></View>;
}
function makeStyles(c: Palette, muted: string) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.paper },
    header: { minHeight: 68, backgroundColor: c.yellow, borderBottomWidth: 2, borderBottomColor: c.ink, alignItems: 'center', justifyContent: 'center' },
    headerText: { fontSize: 21, fontWeight: '900', color: c.ink },
    body: { padding: 22, gap: 14, paddingBottom: 80 },
    avatar: { fontSize: 82, color: c.pink, textAlign: 'center' },
    username: { fontSize: 30, fontWeight: '900', textAlign: 'center', marginBottom: 12, color: c.ink },
    kicker: { fontSize: 11, letterSpacing: 2, color: muted, fontWeight: '700', marginTop: 8 },
    label: { fontSize: 14, fontWeight: '800', color: c.ink },
    input: { height: 56, borderWidth: 2, borderColor: c.soft, borderRadius: 14, paddingHorizontal: 14, fontSize: 18, backgroundColor: c.paper, color: c.ink },
    row: { minHeight: 56, borderWidth: 2, borderColor: c.ink, borderRadius: 16, backgroundColor: c.paper, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    rowLabel: { fontSize: 16, fontWeight: '800', color: c.ink },
    rowValue: { fontSize: 14, fontWeight: '800' },
    done: { color: c.ink === '#111111' ? '#22813B' : '#7CE1A0', fontWeight: '800', textAlign: 'center' },
    hint: { color: muted, fontSize: 14, textAlign: 'center', padding: 8 },
    historyCard: { borderWidth: 2, borderColor: c.ink, borderRadius: 18, backgroundColor: c.paper, padding: 14, gap: 8 },
    historyHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    historyName: { fontSize: 17, fontWeight: '900', color: c.ink, flexShrink: 1 },
    historyCode: { fontSize: 12, fontWeight: '800', color: c.ink, backgroundColor: c.yellow, borderWidth: 2, borderColor: c.ink, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
    historyMeta: { fontSize: 12, fontWeight: '600', color: muted },
    posters: { flexDirection: 'row', gap: 8 },
    poster: { width: 72, height: 108, borderRadius: 8, borderWidth: 1, borderColor: c.ink, backgroundColor: '#222' },
    posterFallback: { alignItems: 'center', justifyContent: 'center', padding: 4 },
    posterFallbackText: { color: '#fff', fontSize: 9, textAlign: 'center' },
  });
}