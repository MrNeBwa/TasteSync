import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { Button, Loading, type Palette } from '../../src/components/Ui';
import { useTheme } from '../../src/store/ThemeContext';
import { request, type Room, type Session } from '../../src/lib/api';
import { WS_URL } from '../../src/lib/config';
import { useAuth } from '../../src/store/AuthContext';

export function getJoinUrl(code: string): string {
  return `https://moviematch.app/join/${code}`;
}

export default function RoomScreen(){
  const { id } = useLocalSearchParams<{id:string}>(); const { token,user }=useAuth();
  const { theme, palette } = useTheme();
  const muted = theme === 'dark' ? '#B3B0A8' : '#777';
  const s = makeStyles(palette, muted);
  const [room,setRoom]=useState<Room|null>(null); const [error,setError]=useState(''); const [starting,setStarting]=useState(false);
  async function load(){try{setRoom(await request<Room>(`/rooms/${id}`,{},token))}catch(e){setError(e instanceof Error?e.message:'Ошибка комнаты')}}
  useEffect(()=>{load()},[id]);
  useEffect(()=>{if(!room||!token)return; let closed=false; let ws:WebSocket|null=null; let reconnectTimer:ReturnType<typeof setTimeout>|null=null;
    const connect=()=>{ws=new WebSocket(`${WS_URL}/ws/rooms/${room.id}?token=${encodeURIComponent(token)}`); ws.onmessage=(ev)=>{try{const m=JSON.parse(ev.data); if(m.type==='ROOM_READY_CHANGED'&&m.payload)setRoom(m.payload); if(m.type==='SESSION_STARTED'&&m.payload)router.replace(`/session/${m.payload.session_id}`);}catch{}}; ws.onclose=()=>{if(!closed)reconnectTimer=setTimeout(connect,4000);};};
    connect(); const timer=setInterval(load,5000); return()=>{closed=true; if(reconnectTimer)clearTimeout(reconnectTimer); clearInterval(timer); ws?.close();};
  },[room?.id,token]);
  async function ready(v:boolean){try{const r=await request<{room:Room}>(`/rooms/${id}/ready?ready=${v}`,{method:'PATCH'},token);setRoom(r.room)}catch(e){setError(e instanceof Error?e.message:'Не удалось изменить готовность')}}
  async function start(){setStarting(true);setError('');try{const r=await request<Session>(`/rooms/${id}/start`,{method:'POST'},token); router.replace(`/session/${r.id}`)}catch(e){setError(e instanceof Error?e.message:'Не удалось начать сессию')}finally{setStarting(false)}}
  async function leave(){try{await request(`/rooms/${id}/members/me`,{method:'DELETE'},token); router.replace('/home')}catch(e){setError(e instanceof Error?e.message:'Не удалось выйти из комнаты')}}
  if(!room)return error?<View style={s.center}><Text style={s.error}>{error}</Text></View>:<Loading/>;
  const me=room.members.find(m=>m.user_id===user?.id); const allReady=room.members.length>0&&room.members.every(m=>m.is_ready);
  return <ScrollView style={s.screen} contentContainerStyle={s.content}><Text style={s.kicker}>ROOM · {room.code}</Text><Text style={s.title}>{room.name}</Text><Text style={s.status}>{room.status}</Text><View style={s.members}>{room.members.map(m=><View key={m.user_id} style={s.member}><View style={s.avatar}><Text>●</Text></View><View style={{flex:1}}><Text style={s.name}>{m.username}</Text><Text style={s.role}>{m.role==='OWNER'?'Владелец':'Участник'}</Text></View><Text style={[s.ready,m.is_ready&&s.readyOn]}>{m.is_ready?'ГОТОВ':'НЕ ГОТОВ'}</Text></View>)}</View>
    {error?<Text style={s.error}>{error}</Text>:null}
    <View style={s.qr}>
      <Text style={s.qrKicker}>ПРИГЛАШЕНИЕ ПО QR</Text>
      <QRCode value={getJoinUrl(room.code)} size={180} />
      <Text style={s.qrHint}>Откройте приложение на телефоне друга → «Сканировать QR-код»</Text>
    </View>
    {me?<Button variant={me.is_ready?'secondary':'primary'} onPress={()=>ready(!me.is_ready)}>{me.is_ready?'Я не готов':'Я готов'}</Button>:null}
    {room.owner_id===user?.id?<Button disabled={!allReady||starting} onPress={start}>{starting?'Запускаем…':'Начать сессию'}</Button>:<Text style={s.wait}>Ожидаем владельца комнаты…</Text>}
    {me?.role!=='OWNER'?<Button variant="danger" onPress={leave}>Покинуть комнату</Button>:null}
    <Pressable onPress={()=>router.replace('/home')}><Text style={s.link}>← Вернуться</Text></Pressable>
  </ScrollView>
}
function makeStyles(c: Palette, muted: string) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.paper },
    content: { padding: 20, gap: 14, paddingTop: 34, paddingBottom: 60 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
    kicker: { fontSize: 11, letterSpacing: 2, color: muted, fontWeight: '700' },
    title: { fontSize: 44, fontWeight: '900', letterSpacing: -1.5, color: c.ink },
    status: { alignSelf: 'flex-start', backgroundColor: c.yellow, borderWidth: 2, borderColor: c.ink, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, fontSize: 12, fontWeight: '900', color: c.ink },
    members: { gap: 10, marginTop: 8 },
    member: { minHeight: 72, borderWidth: 2, borderColor: c.ink, borderRadius: 18, backgroundColor: c.paper, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: c.ink, alignItems: 'center', justifyContent: 'center', backgroundColor: c.pink },
    name: { fontSize: 18, fontWeight: '900', color: c.ink },
    role: { fontSize: 12, color: muted, marginTop: 2 },
    ready: { fontSize: 10, fontWeight: '900', color: muted },
    readyOn: { color: c.ink === '#111111' ? '#22813B' : '#7CE1A0' },
    error: { color: '#FFA8B0', backgroundColor: themeErrorBg(c), padding: 12, borderRadius: 12 },
    wait: { textAlign: 'center', color: muted, padding: 10 },
    link: { textAlign: 'center', fontSize: 16, fontWeight: '800', paddingVertical: 10, color: c.ink },
    qr: { backgroundColor: c.ink === '#111111' ? '#fff' : '#0F1115', borderWidth: 2, borderColor: c.ink, borderRadius: 20, alignItems: 'center', padding: 18, gap: 12 },
    qrKicker: { fontSize: 11, letterSpacing: 2, color: c.ink === '#111111' ? '#777' : '#A3A19A', fontWeight: '700' },
    qrHint: { fontSize: 13, textAlign: 'center', color: c.ink === '#111111' ? '#777' : '#B3B0A8', lineHeight: 19 },
  });
}
function themeErrorBg(c: Palette) {
  return c.ink === '#111111' ? '#FFE0E4' : '#3A2026';
}