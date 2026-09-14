import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

export default function Home(){
  return <SafeAreaView style={styles.container}>
    <View style={styles.topbar}><Text style={styles.greeting}>Здравствуйте, {'{name}'}</Text><Text style={styles.avatar}>●</Text></View>
    <View style={styles.content}>
      <Text style={styles.title}>Режим выбор{`\n`}фильма</Text>
      <Pressable style={styles.button} onPress={()=>router.push('/room')}><Text style={styles.buttonText}>Создать комнату</Text></Pressable>
      <Pressable style={styles.button} onPress={()=>router.push('/room')}><Text style={styles.buttonText}>Войти в комнату</Text></Pressable>
    </View>
  </SafeAreaView>
}
const styles=StyleSheet.create({container:{flex:1,backgroundColor:'#fff'},topbar:{height:62,backgroundColor:'#efbd43',alignItems:'center',justifyContent:'center'},greeting:{fontSize:20,fontWeight:'700'},avatar:{position:'absolute',right:12,fontSize:34,color:'#fff'},content:{padding:28},title:{fontSize:32,textAlign:'center',marginVertical:42},button:{backgroundColor:'#d7d7d7',borderRadius:22,padding:20,marginBottom:34}},buttonText:{fontSize:20,textAlign:'center'}})
