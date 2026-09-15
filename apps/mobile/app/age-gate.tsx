import { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Button, ErrorBox, type Palette } from '../src/components/Ui';
import { useTheme } from '../src/store/ThemeContext';
import { request, type User } from '../src/lib/api';
import { saveUser } from '../src/lib/auth';
import { useAuth } from '../src/store/AuthContext';

export default function AgeGate() {
  const { token, user, refreshMe } = useAuth();
  const { theme, palette } = useTheme();
  const muted = theme === 'dark' ? '#B3B0A8' : '#5D5A52';
  const s = makeStyles(palette, muted);
  const [date, setDate] = useState(user?.birth_date ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Используйте формат ГГГГ-ММ-ДД');
    setBusy(true); setError('');
    try {
      const updated = await request<User>('/users/me/age', { method: 'PATCH', body: JSON.stringify({ birth_date: date }) }, token);
      await saveUser(updated); await refreshMe(); router.replace('/home');
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось сохранить дату рождения'); }
    finally { setBusy(false); }
  }
  return <SafeAreaView style={s.screen}><View style={s.wrap}><View style={s.card}>
    <Text style={s.kicker}>ПЕРЕД ПЕРВЫМ ФИЛЬМОМ</Text>
    <Text style={s.title}>Сколько вам лет?</Text>
    <Text style={s.copy}>Укажи дату рождения один раз — мы не будем показывать несовершеннолетним фильмы 18+.</Text>
    <TextInput value={date} onChangeText={setDate} placeholder="2005-08-17" keyboardType="numbers-and-punctuation" style={s.input} />
    {error ? <ErrorBox text={error} /> : null}
    <Button onPress={save} disabled={busy}>{busy ? 'Сохраняем…' : 'Продолжить →'}</Button>
  </View></View></SafeAreaView>;
}
function makeStyles(c: Palette, muted: string) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.yellow },
    wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
    card: { width: '100%', maxWidth: 440, borderWidth: 2, borderColor: c.ink, borderRadius: 26, padding: 24, backgroundColor: c.paper, gap: 14 },
    kicker: { fontSize: 11, letterSpacing: 2, color: c.ink === '#111111' ? '#777' : '#A3A19A', fontWeight: '700' },
    title: { fontSize: 38, fontWeight: '900', letterSpacing: -1.5, color: c.ink },
    copy: { fontSize: 17, lineHeight: 25, color: muted },
    input: { height: 56, borderWidth: 2, borderColor: c.soft, borderRadius: 14, paddingHorizontal: 14, fontSize: 18, backgroundColor: c.paper, color: c.ink },
  });
}