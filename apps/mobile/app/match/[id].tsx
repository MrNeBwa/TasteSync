import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, COLORS, Loading } from '../../src/components/Ui';
import { request, type Match, type Movie } from '../../src/lib/api';
import { useAuth } from '../../src/store/AuthContext';

export default function Match() {
  const { id, movieId, matchId } = useLocalSearchParams<{ id: string; movieId?: string; matchId?: string }>();
  const { token } = useAuth();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let targetId: string | undefined = movieId;
    (async () => {
      try {
        if (!targetId) {
          const matches = await request<Match[]>(`/sessions/${id}/matches`, {}, token);
          const match = matches.find((m) => m.id === matchId) ?? matches[matches.length - 1];
          targetId = match?.movie_id;
        }
        if (!targetId) {
          if (active) setError('Совпадение не найдено');
          return;
        }
        const found = await request<Movie>(`/movies/${targetId}`, {}, token);
        if (active) setMovie(found);
      } catch (e) {
        if (!active) return;
        try {
          const movies = await request<Movie[]>(`/movies?limit=100`, {}, token);
          const found = targetId ? movies.find((m) => m.id === targetId) : undefined;
          if (found) {
            setMovie(found);
            return;
          }
        } catch {
          // fall through to the error state below
        }
        setError(e instanceof Error ? e.message : 'Не удалось загрузить матч');
      }
    })();
    return () => { active = false; };
  }, [id, movieId, matchId, token]);

  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text><Button onPress={() => router.replace('/home')}>На главную</Button></View>;
  if (!movie) return <Loading />;
  return (
    <View style={styles.screen}>
      {movie.backdrop_url ? <Image source={{ uri: movie.backdrop_url }} style={styles.bg} /> : null}
      <View style={styles.overlay} />
      <View style={styles.card}>
        <Text style={styles.kicker}>EVERYONE AGREED</Text>
        <Text style={styles.title}>Ваш фильм найден.</Text>
        {movie.poster_url ? <Image source={{ uri: movie.poster_url }} style={styles.poster} /> : null}
        <Text style={styles.movieTitle}>{movie.title}</Text>
        <Text style={styles.copy}>{movie.overview ?? 'Похоже, на сегодня решение принято.'}</Text>
        <Button onPress={() => router.replace('/home')}>Вернуться</Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 12 },
  bg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(17,17,17,.75)' },
  card: { margin: 18, marginTop: 70, backgroundColor: '#F5F3ED', borderWidth: 2, borderColor: '#111', borderRadius: 28, padding: 20, gap: 12 },
  kicker: { fontSize: 11, letterSpacing: 2, color: '#777', fontWeight: '800' },
  title: { fontSize: 40, fontWeight: '900', letterSpacing: -1.5 },
  poster: { width: '100%', aspectRatio: 2 / 3, borderRadius: 18 },
  movieTitle: { fontSize: 28, fontWeight: '900' },
  copy: { fontSize: 17, color: '#5D5A52', lineHeight: 24 },
  error: { color: '#8F1722', backgroundColor: '#FFE0E4', padding: 12, borderRadius: 12, textAlign: 'center' },
});