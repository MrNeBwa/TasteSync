import { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Button, COLORS, ErrorBox } from '../src/components/Ui';
import { request, type User } from '../src/lib/api';
import { saveUser } from '../src/lib/auth';
import { useAuth } from '../src/store/AuthContext';

export default function AgeGate() {
  const { token, user, refreshMe } = useAuth();
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
  return <SafeAreaView style={styles.screen}><View style={styles.wrap}><View style={styles.card}>
    <Text style={styles.kicker}>ПЕРЕД ПЕРВЫМ ФИЛЬМОМ</Text>
    <Text style={styles.title}>Сколько вам лет?</Text>
    <Text style={styles.copy}>Укажи дату рождения один раз — мы не будем показывать несовершеннолетним фильмы 18+.</Text>
    <TextInput value={date} onChangeText={setDate} placeholder="2005-08-17" keyboardType="numbers-and-punctuation" style={styles.input} />
    {error ? <ErrorBox text={error} /> : null}
    <Button onPress={save} disabled={busy}>{busy ? 'Сохраняем…' : 'Продолжить →'}</Button>
  </View></View></SafeAreaView>;
}
const styles=StyleSheet.create({screen:{flex:1,backgroundColor:COLORS.yellow},wrap:{flex:1,alignItems:'center',justifyContent:'center',padding:20},card:{width:'100%',maxWidth:440,borderWidth:2,borderColor:COLORS.ink,borderRadius:26,padding:24,backgroundColor:'#fff',gap:14},kicker:{fontSize:11,letterSpacing:2,color:'#777',fontWeight:'700'},title:{fontSize:38,fontWeight:'900',letterSpacing:-1.5},copy:{fontSize:17,lineHeight:25,color:'#5D5A52'},input:{height:56,borderWidth:2,borderColor:'#BDBDBD',borderRadius:14,paddingHorizontal:14,fontSize:18,backgroundColor:'#FAF9F6'}});
