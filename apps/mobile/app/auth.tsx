import { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Button, ErrorBox, type Palette } from '../src/components/Ui';
import { useTheme } from '../src/store/ThemeContext';
import { useAuth } from '../src/store/AuthContext';

export default function AuthScreen() {
  const { login, register } = useAuth();
  const { theme, palette } = useTheme();
  const muted = theme === 'dark' ? '#B3B0A8' : '#5D5A52';
  const s = makeStyles(palette, muted);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setBusy(true); setError('');
    try {
      const me = mode === 'register' ? await register(username, email, password) : await login(email, password);
      router.replace(me.birth_date ? '/home' : '/age-gate');
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось выполнить запрос'); }
    finally { setBusy(false); }
  }

  return <SafeAreaView style={s.screen}><ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <View style={s.brand}><Text style={s.brandTitle}>Movie</Text><View style={s.highlight}><Text style={s.brandTitle}>Match</Text></View></View>
    <Text style={s.subtitle}>Смотрите, выбирайте и находите общий фильм вместе.</Text>
    <View style={s.card}>
      <View style={s.tabs}><Text onPress={() => setMode('login')} style={[s.tab, mode === 'login' && s.tabActive]}>Войти</Text><Text onPress={() => setMode('register')} style={[s.tab, mode === 'register' && s.tabActive]}>Создать аккаунт</Text></View>
      {mode === 'register' && <TextInput value={username} onChangeText={setUsername} placeholder="Имя" style={s.input} />}
      <TextInput value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" keyboardType="email-address" style={s.input} />
      <TextInput value={password} onChangeText={setPassword} placeholder="Пароль" secureTextEntry style={s.input} />
      {error ? <ErrorBox text={error} /> : null}
      <Button onPress={submit} disabled={busy}>{busy ? 'Подождите…' : mode === 'register' ? 'Создать аккаунт →' : 'Войти →'}</Button>
    </View>
  </ScrollView></SafeAreaView>;
}

function makeStyles(c: Palette, muted: string) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.paper },
    content: { padding: 20, gap: 18, paddingBottom: 40 },
    brand: { marginTop: 30, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
    brandTitle: { fontSize: 58, fontWeight: '900', letterSpacing: -3, color: c.ink },
    highlight: { backgroundColor: c.yellow, paddingHorizontal: 8 },
    subtitle: { fontSize: 18, color: muted, lineHeight: 26 },
    card: { borderWidth: 2, borderColor: c.ink, borderRadius: 24, backgroundColor: c.paper, padding: 18, gap: 14, shadowColor: '#000', shadowOffset: { width: 6, height: 6 }, shadowOpacity: 0.35, shadowRadius: 0, elevation: 3 },
    tabs: { flexDirection: 'row', gap: 18, marginBottom: 4 },
    tab: { fontSize: 17, color: '#888', paddingBottom: 6 },
    tabActive: { color: c.ink, fontWeight: '900', borderBottomWidth: 3, borderBottomColor: c.pink },
    input: { height: 54, borderWidth: 2, borderColor: c.soft, borderRadius: 14, paddingHorizontal: 14, fontSize: 16, backgroundColor: c.paper, color: c.ink },
  });
}