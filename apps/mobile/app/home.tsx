import { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Button, COLORS } from '../src/components/Ui';
import { request, type Room } from '../src/lib/api';
import { useAuth } from '../src/store/AuthContext';

export default function Home() {
  const { token, user, logout } = useAuth();
  const [roomName, setRoomName] = useState('Movie Night'); const [code, setCode] = useState('');
  const [error, setError] = useState('');
  async function createRoom() { try { const room = await request<Room>('/rooms',{method:'POST',body:JSON.stringify({name:roomName || 'Movie Night'})},token); router.push(`/room/${room.id}`); } catch(e){ setError(e instanceof Error?e.message:'Не удалось создать комнату'); } }
  async function joinRoom() { try { const room = await request<Room>('/rooms/join',{method:'POST',body:JSON.stringify({code})},token); router.push(`/room/${room.id}`); } catch(e){ setError(e instanceof Error?e.message:'Не удалось войти в комнату'); } }
  useEffect(() => { if (!user?.birth_date) router.replace('/age-gate'); }, [user?.birth_date]);
  return <SafeAreaView style={styles.screen}><View style={styles.top}><Text style={styles.greeting}>Здравствуйте, {user?.username}</Text><Text style={styles.avatar}>●</Text></View><View style={styles.body}>
    <Text style={styles.title}>Режим выбора{`\n`}фильма</Text>
    <View style={styles.card}><Text style={styles.kicker}>НОВАЯ КОМНАТА</Text><Text style={styles.fieldLabel}>Название</Text><TextInput value={roomName} onChangeText={setRoomName} placeholder="Movie Night" style={styles.input} /><Button onPress={createRoom}>Создать комнату</Button></View>
    <View style={styles.card}><Text style={styles.kicker}>ПРИСОЕДИНИТЬСЯ</Text><Text style={styles.fieldLabel}>Код комнаты</Text><TextInput value={code} onChangeText={setCode} placeholder="PA4IQO" autoCapitalize="characters" style={styles.input} /><Button variant="secondary" onPress={joinRoom}>Войти в комнату</Button></View>
    {!!error && <Text style={styles.error}>{error}</Text>}
    <Button variant="secondary" onPress={()=>router.push('/settings')}>Настройки</Button>
    <Button variant="danger" onPress={logout}>Выйти</Button>
  </View></SafeAreaView>;
}
const styles=StyleSheet.create({screen:{flex:1,backgroundColor:COLORS.paper},top:{height:66,backgroundColor:COLORS.yellow,borderBottomWidth:2,borderBottomColor:COLORS.ink,alignItems:'center',justifyContent:'center',flexDirection:'row'},greeting:{fontSize:20,fontWeight:'900'},avatar:{position:'absolute',right:16,fontSize:34,color:COLORS.pink},body:{padding:20,gap:16},title:{fontSize:42,fontWeight:'900',textAlign:'center',marginVertical:16,letterSpacing:-1.5},card:{backgroundColor:'#fff',borderWidth:2,borderColor:COLORS.ink,borderRadius:22,padding:16,gap:10},kicker:{fontSize:11,letterSpacing:2,color:'#777',fontWeight:'700'},fieldLabel:{fontSize:14,fontWeight:'800'},input:{height:50,borderWidth:2,borderColor:'#BDBDBD',borderRadius:14,paddingHorizontal:12,fontSize:16,backgroundColor:'#FAF9F6'},error:{color:'#9A2029',backgroundColor:'#FFE0E4',padding:12,borderRadius:12}}
)
