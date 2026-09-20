import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, type Palette } from '../src/components/Ui';
import { QrScanModal } from '../src/components/QrScan';
import { request, type Room } from '../src/lib/api';
import { useTheme } from '../src/store/ThemeContext';
import { useAuth } from '../src/store/AuthContext';

export default function Home() {
  const { token, user } = useAuth();
  const { theme, palette, toggleTheme } = useTheme();
  const muted = theme === 'dark' ? '#B3B0A8' : '#5D5A52';
  const s = makeStyles(palette, muted);
  const insets = useSafeAreaInsets();
  const [roomName, setRoomName] = useState('Movie Night');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  async function createRoom() {
    try {
      const room = await request<Room>('/rooms', { method: 'POST', body: JSON.stringify({ name: roomName || 'Movie Night' }) }, token);
      router.push(`/room/${room.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось создать комнату'); }
  }
  async function joinRoom(joinCode = code) {
    try {
      const room = await request<Room>('/rooms/join', { method: 'POST', body: JSON.stringify({ code: joinCode.toUpperCase() }) }, token);
      setScanOpen(false);
      router.push(`/room/${room.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось войти в комнату'); }
  }
  useEffect(() => { if (!user?.birth_date) router.replace('/age-gate'); }, [user?.birth_date]);
  return (
    <View style={s.screen}>
      <View style={[s.top, { paddingTop: insets.top + 16 }]}>
        <Text style={s.greeting}>Здравствуйте, {user?.username}</Text>
        <Pressable onPress={toggleTheme} style={s.theme}>
          <Text style={s.themeText}>{theme === 'dark' ? '☀' : '☾'}</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/profile')} style={s.avatar}>
          <Text style={s.avatarText}>●</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Режим выбора{'\n'}фильма</Text>
        <View style={s.card}>
          <Text style={s.kicker}>НОВАЯ КОМНАТА</Text>
          <Text style={s.fieldLabel}>Название</Text>
          <TextInput value={roomName} onChangeText={setRoomName} placeholder="Movie Night" placeholderTextColor={muted} style={s.input} />
          <Button onPress={createRoom}>Создать комнату</Button>
        </View>
        <View style={s.card}>
          <Text style={s.kicker}>ПРИСОЕДИНИТЬСЯ</Text>
          <Text style={s.fieldLabel}>Код комнаты</Text>
          <TextInput value={code} onChangeText={setCode} placeholder="PA4IQO" autoCapitalize="characters" placeholderTextColor={muted} style={s.input} />
          <Button variant="secondary" onPress={() => joinRoom()}>Войти в комнату</Button>
          <Button variant="primary" onPress={() => setScanOpen(true)}>Сканировать QR-код</Button>
        </View>
        {!!error && <Text style={s.error}>{error}</Text>}
      </ScrollView>
      <QrScanModal visible={scanOpen} onClose={() => setScanOpen(false)} onScanned={(scannedCode) => { setError(''); joinRoom(scannedCode); }} />
    </View>
  );
}
function makeStyles(c: Palette, muted: string) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.paper },
    top: { minHeight: 66, backgroundColor: c.yellow, borderBottomWidth: 2, borderBottomColor: c.ink, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
    greeting: { fontSize: 20, fontWeight: '900', color: c.ink },
    avatar: { position: 'absolute', right: 16, width: 44, height: 44, borderWidth: 2, borderColor: c.ink, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.paper },
    avatarText: { fontSize: 24, color: c.pink, lineHeight: 26 },
    theme: { position: 'absolute', left: 16, width: 44, height: 44, borderWidth: 2, borderColor: c.ink, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.paper },
    themeText: { fontSize: 20, color: c.ink },
    body: { padding: 20, paddingTop: 16, gap: 16, paddingBottom: 96 },
    title: { fontSize: 42, fontWeight: '900', textAlign: 'center', marginVertical: 16, letterSpacing: -1.5, color: c.ink },
    card: { backgroundColor: c.paper, borderWidth: 2, borderColor: c.ink, borderRadius: 22, padding: 16, gap: 10 },
    kicker: { fontSize: 11, letterSpacing: 2, color: muted, fontWeight: '700' },
    fieldLabel: { fontSize: 14, fontWeight: '800', color: c.ink },
    input: { height: 50, borderWidth: 2, borderColor: c.soft, borderRadius: 14, paddingHorizontal: 12, fontSize: 16, backgroundColor: c.paper, color: c.ink },
    error: { color: '#FFA8B0', backgroundColor: c.ink === '#111111' ? '#FFE0E4' : '#3A2026', padding: 12, borderRadius: 12 },
  });
}