import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, COLORS, Loading } from '../../src/components/Ui';
import { request, type Room, type Session } from '../../src/lib/api';
import { WS_URL } from '../../src/lib/config';
import { useAuth } from '../../src/store/AuthContext';

export default function RoomScreen(){
  const { id } = useLocalSearchParams<{id:string}>(); const { token,user }=useAuth();
  const [room,setRoom]=useState<Room|null>(null); const [error,setError]=useState(''); const [starting,setStarting]=useState(false);
  async function load(){try{setRoom(await request<Room>(`/rooms/${id}`,{},token))}catch(e){setError(e instanceof Error?e.message:'Ошибка комнаты')}}
  useEffect(()=>{load()},[id]);
  useEffect(()=>{if(!room||!token)return; let closed=false; let ws:WebSocket|null=null; let reconnectTimer:ReturnType<typeof setTimeout>|null=null;
    const connect=()=>{ws=new WebSocket(`${WS_URL}/ws/rooms/${room.id}?token=${encodeURIComponent(token)}`); ws.onmessage=(ev)=>{try{const m=JSON.parse(ev.data); if(m.type==='ROOM_READY_CHANGED'&&m.payload)setRoom(m.payload); if(m.type==='SESSION_STARTED'&&m.payload)router.replace(`/session/${m.payload.session_id}`);}catch{}}; ws.onclose=()=>{if(!closed)reconnectTimer=setTimeout(connect,4000);};};
    connect(); const timer=setInterval(load,5000); return()=>{closed=true; if(reconnectTimer)clearTimeout(reconnectTimer); clearInterval(timer); ws?.close();};
  },[room?.id,token]);
  async function ready(v:boolean){try{const r=await request<{room:Room}>(`/rooms/${id}/ready?ready=${v}`,{method:'PATCH'},token);setRoom(r.room)}catch(e){setError(e instanceof Error?e.message:'Не удалось изменить готовность')}}
  async function start(){setStarting(true);setError('');try{const s=await request<Session>(`/rooms/${id}/start`,{method:'POST'},token); router.replace(`/session/${s.id}`)}catch(e){setError(e instanceof Error?e.message:'Не удалось начать сессию')}finally{setStarting(false)}}
  if(!room)return error?<View style={styles.center}><Text style={styles.error}>{error}</Text></View>:<Loading/>;
  const me=room.members.find(m=>m.user_id===user?.id); const allReady=room.members.length>0&&room.members.every(m=>m.is_ready);
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}><Text style={styles.kicker}>ROOM · {room.code}</Text><Text style={styles.title}>{room.name}</Text><Text style={styles.status}>{room.status}</Text><View style={styles.members}>{room.members.map(m=><View key={m.user_id} style={styles.member}><View style={styles.avatar}><Text>●</Text></View><View style={{flex:1}}><Text style={styles.name}>{m.username}</Text><Text style={styles.role}>{m.role==='OWNER'?'Владелец':'Участник'}</Text></View><Text style={[styles.ready,m.is_ready&&styles.readyOn]}>{m.is_ready?'ГОТОВ':'НЕ ГОТОВ'}</Text></View>)}</View>
    {error?<Text style={styles.error}>{error}</Text>:null}
    {me?<Button variant={me.is_ready?'secondary':'primary'} onPress={()=>ready(!me.is_ready)}>{me.is_ready?'Я не готов':'Я готов'}</Button>:null}
    {room.owner_id===user?.id?<Button disabled={!allReady||starting} onPress={start}>{starting?'Запускаем…':'Начать сессию'}</Button>:<Text style={styles.wait}>Ожидаем владельца комнаты…</Text>}
    <Pressable onPress={()=>router.replace('/home')}><Text style={styles.link}>← Вернуться</Text></Pressable>
  </ScrollView>
}
const styles=StyleSheet.create({screen:{flex:1,backgroundColor:COLORS.paper},content:{padding:20,gap:14,paddingTop:34},center:{flex:1,alignItems:'center',justifyContent:'center',padding:20},kicker:{fontSize:11,letterSpacing:2,color:'#777',fontWeight:'700'},title:{fontSize:44,fontWeight:'900',letterSpacing:-1.5},status:{alignSelf:'flex-start',backgroundColor:COLORS.yellow,borderWidth:2,borderColor:COLORS.ink,borderRadius:999,paddingHorizontal:12,paddingVertical:7,fontSize:12,fontWeight:'900'},members:{gap:10,marginTop:8},member:{minHeight:72,borderWidth:2,borderColor:COLORS.ink,borderRadius:18,backgroundColor:'#fff',padding:12,flexDirection:'row',alignItems:'center',gap:12},avatar:{width:44,height:44,borderRadius:22,borderWidth:2,borderColor:COLORS.ink,alignItems:'center',justifyContent:'center',backgroundColor:COLORS.pink},name:{fontSize:18,fontWeight:'900'},role:{fontSize:12,color:'#777',marginTop:2},ready:{fontSize:10,fontWeight:'900',color:'#777'},readyOn:{color:'#22813B'},error:{color:'#8F1722',backgroundColor:'#FFE0E4',padding:12,borderRadius:12},wait:{textAlign:'center',color:'#666',padding:10},link:{textAlign:'center',fontSize:16,fontWeight:'800',paddingVertical:10}}
)
