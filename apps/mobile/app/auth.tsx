import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Button, ErrorBox, type Palette } from '../src/components/Ui';
import { getApiUrl, saveCustomApiUrl } from '../src/lib/config';
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
  const [serverOpen, setServerOpen] = useState(false);
  const [serverUrl, setServerUrl] = useState(getApiUrl);
  const [serverSaved, setServerSaved] = useState(false);

  async function submit() {
    setBusy(true); setError('');
    try {
      const me = mode === 'register' ? await register(username.trim(), email.trim(), password) : await login(email.trim(), password);
      router.replace(me.birth_date ? '/home' : '/age-gate');
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось выполнить запрос'); }
    finally { setBusy(false); }
  }

  async function saveServer() {
    const updated = await saveCustomApiUrl(serverUrl);
    setServerUrl(updated);
    setServerSaved(true);
    setTimeout(() => setServerSaved(false), 2000);
  }

  return <SafeAreaView style={s.screen}><ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <View style={s.brand}><Text style={s.brandTitle}>Movie</Text><View style={s.highlight}><Text style={[s.brandTitle, { color: '#111111' }]}>Match</Text></View></View>
    <Text style={s.subtitle}>Смотрите, выбирайте фильмы или места и находите общее решение вместе.</Text>
    <View style={s.card}>
      <View style={s.tabs}><Text onPress={() => setMode('login')} style={[s.tab, mode === 'login' && s.tabActive]}>Войти</Text><Text onPress={() => setMode('register')} style={[s.tab, mode === 'register' && s.tabActive]}>Создать аккаунт</Text></View>
      {mode === 'register' && <TextInput value={username} onChangeText={setUsername} placeholder="Имя" placeholderTextColor={muted} style={s.input} />}
      <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={muted} autoCapitalize="none" keyboardType="email-address" style={s.input} />
      <TextInput value={password} onChangeText={setPassword} placeholder="Пароль" placeholderTextColor={muted} secureTextEntry style={s.input} />
      {error ? <ErrorBox text={error} /> : null}
      <Button onPress={submit} disabled={busy}>{busy ? 'Подождите…' : mode === 'register' ? 'Создать аккаунт →' : 'Войти →'}</Button>
    </View>
    <Pressable onPress={() => setServerOpen((v) => !v)} style={s.serverToggle}>
      <Text style={s.serverToggleText}>⚙ Сервер API: {serverUrl}</Text>
    </Pressable>
    {serverOpen && (
      <View style={s.card}>
        <Text style={s.serverHint}>Укажите адрес вашего API-сервера в локальной сети (например http://192.168.100.8:8000/api):</Text>
        <TextInput value={serverUrl} onChangeText={setServerUrl} placeholder="http://192.168.100.8:8000/api" placeholderTextColor={muted} autoCapitalize="none" style={s.input} />
        <Button variant="secondary" onPress={saveServer}>{serverSaved ? 'Сохранено ✓' : 'Сохранить адрес сервера'}</Button>
      </View>
    )}
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
    serverToggle: { alignSelf: 'center', paddingVertical: 6 },
    serverToggleText: { fontSize: 13, fontWeight: '700', color: muted },
    serverHint: { fontSize: 13, lineHeight: 19, color: muted },
  });
}
