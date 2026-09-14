import { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Button, COLORS, ErrorBox } from '../src/components/Ui';
import { useAuth } from '../src/store/AuthContext';

export default function AuthScreen() {
  const { login, register } = useAuth();
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

  return <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.brand}><Text style={styles.brandTitle}>Movie</Text><View style={styles.highlight}><Text style={styles.brandTitle}>Match</Text></View></View>
    <Text style={styles.subtitle}>Смотрите, выбирайте и находите общий фильм вместе.</Text>
    <View style={styles.card}>
      <View style={styles.tabs}><Text onPress={() => setMode('login')} style={[styles.tab, mode === 'login' && styles.tabActive]}>Войти</Text><Text onPress={() => setMode('register')} style={[styles.tab, mode === 'register' && styles.tabActive]}>Создать аккаунт</Text></View>
      {mode === 'register' && <TextInput value={username} onChangeText={setUsername} placeholder="Имя" style={styles.input} />}
      <TextInput value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" keyboardType="email-address" style={styles.input} />
      <TextInput value={password} onChangeText={setPassword} placeholder="Пароль" secureTextEntry style={styles.input} />
      {error ? <ErrorBox text={error} /> : null}
      <Button onPress={submit} disabled={busy}>{busy ? 'Подождите…' : mode === 'register' ? 'Создать аккаунт →' : 'Войти →'}</Button>
    </View>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.paper },
  content: { padding: 20, gap: 18, paddingBottom: 40 },
  brand: { marginTop: 30, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  brandTitle: { fontSize: 58, fontWeight: '900', letterSpacing: -3, color: COLORS.ink },
  highlight: { backgroundColor: COLORS.yellow, paddingHorizontal: 8 },
  subtitle: { fontSize: 18, color: '#5D5A52', lineHeight: 26 },
  card: { borderWidth: 2, borderColor: COLORS.ink, borderRadius: 24, backgroundColor: '#fff', padding: 18, gap: 14, shadowColor: '#111', shadowOffset: { width: 6, height: 6 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3 },
  tabs: { flexDirection: 'row', gap: 18, marginBottom: 4 },
  tab: { fontSize: 17, color: '#888', paddingBottom: 6 },
  tabActive: { color: COLORS.ink, fontWeight: '900', borderBottomWidth: 3, borderBottomColor: COLORS.pink },
  input: { height: 54, borderWidth: 2, borderColor: '#BDBDBD', borderRadius: 14, paddingHorizontal: 14, fontSize: 16, backgroundColor: '#FAF9F6' },
});
