import { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Button, COLORS, Loading } from '../../src/components/Ui';
import { request, youtubeEmbed, type Match, type Movie, type Session } from '../../src/lib/api';
import { useAuth } from '../../src/store/AuthContext';

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [voting, setVoting] = useState(false);
  const [finished, setFinished] = useState(false);
  const matched = useRef(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const items = await request<Movie[]>(`/sessions/${id}/movies?limit=8&exploration_ratio=0.25`, {}, token);
      setMovies(items);
      setIndex(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить фильмы');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    let active = true;
    const timer = setInterval(async () => {
      try {
        const session = await request<Session>(`/sessions/${id}`, {}, token);
        if (!active) return;
        if (session.status === 'FINISHED') {
          clearInterval(timer);
          setFinished(true);
          return;
        }
        if (session.status === 'MATCHED' && !matched.current) {
          clearInterval(timer);
          const matches = await request<Match[]>(`/sessions/${id}/matches`, {}, token);
          const match = matches[matches.length - 1];
          if (match) router.replace(`/match/${id}?movieId=${match.movie_id}&matchId=${match.id}`);
        }
      } catch {
        // Transient network/refresh errors are ignored by the polling loop.
      }
    }, 4000);
    return () => { active = false; clearInterval(timer); };
  }, [id, token]);

  const movie = movies[index];
  const embed = movie ? youtubeEmbed(movie.trailer_url) : null;

  async function vote(value: 'LIKE' | 'DISLIKE' | 'SKIP') {
    if (!movie || voting) return;
    setVoting(true);
    setError('');
    try {
      const result = await request<{ matched: boolean; match: Match | null }>(`/sessions/${id}/votes`, {
        method: 'POST',
        body: JSON.stringify({ movie_id: movie.id, value }),
      }, token);
      if (result.matched && result.match) {
        matched.current = true;
        router.replace(`/match/${id}?movieId=${result.match.movie_id}&matchId=${result.match.id}`);
        return;
      }
      if (index + 1 < movies.length) setIndex(index + 1);
      else await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить выбор');
    } finally {
      setVoting(false);
    }
  }

  if (finished) {
    return (
      <View style={styles.done}>
        <Text style={styles.kicker}>SESSION FINISHED</Text>
        <Text style={styles.doneTitle}>Сессия завершена.</Text>
        <Text style={styles.doneCopy}>Все участники закончили выбор. Можно начать новую комнату.</Text>
        <Button onPress={() => router.replace('/home')}>На главную</Button>
      </View>
    );
  }

  if (!movie || loading) {
    const message = error ?? (movies.length === 0 ? 'Фильмы закончились.' : null);
    if (loading && !error) return <Loading />;
    return (
      <ScrollView contentContainerStyle={styles.center}>
        <Text style={styles.error}>{message}</Text>
        <Button onPress={load}>Обновить</Button>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>NOW PLAYING · {index + 1}/{movies.length}</Text>
      <View style={styles.visual}>
        {embed ? (
          <WebView source={{ uri: embed }} allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} style={styles.webview} />
        ) : movie.poster_url ? (
          <Image source={{ uri: movie.poster_url }} style={styles.poster} />
        ) : (
          <View style={styles.fallback}><Text>NO POSTER</Text></View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.title}>{movie.title}</Text>
        <Text style={styles.meta}>{movie.genres.map(g => g.name).join(' · ')}</Text>
        <Text style={styles.meta}>{movie.release_date?.slice(0, 4) ?? '—'} · {movie.vote_average?.toFixed(1) ?? '—'} / 10</Text>
        {movie.overview ? <Text style={styles.overview}>{movie.overview}</Text> : null}
        <View style={styles.chips}>{movie.genres.map(g => <View key={g.id} style={styles.chip}><Text style={styles.chipText}>{g.name}</Text></View>)}</View>
      </View>
      <View style={styles.actions}>
        <Button variant="danger" disabled={voting} onPress={() => vote('DISLIKE')}>✕</Button>
        <Button variant="secondary" disabled={voting} onPress={() => vote('SKIP')}>↗</Button>
        <Button disabled={voting} onPress={() => vote('LIKE')}>♥</Button>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.ink },
  content: { padding: 14, gap: 12, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 12 },
  kicker: { color: '#aaa', fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  visual: { width: '100%', aspectRatio: 16 / 10, borderRadius: 22, overflow: 'hidden', borderWidth: 2, borderColor: '#fff', backgroundColor: '#000' },
  webview: { flex: 1, backgroundColor: '#000' },
  poster: { width: '100%', height: '100%', resizeMode: 'cover' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  info: { backgroundColor: '#F5F3ED', borderRadius: 22, borderWidth: 2, borderColor: '#111', padding: 18, gap: 8 },
  title: { fontSize: 36, fontWeight: '900', letterSpacing: -1.2, color: '#111' },
  meta: { fontSize: 12, color: '#666' },
  overview: { fontSize: 17, lineHeight: 25, color: '#57544E', marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, borderWidth: 1.5, borderColor: '#111', backgroundColor: '#fff' },
  chipText: { fontSize: 12, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 10 },
  done: { flex: 1, backgroundColor: '#111', padding: 24, justifyContent: 'center', gap: 12 },
  doneTitle: { fontSize: 40, fontWeight: '900', letterSpacing: -1.5, color: '#F5F3ED' },
  doneCopy: { fontSize: 17, color: '#9A968D', lineHeight: 24 },
  error: { color: '#8F1722', backgroundColor: '#FFE0E4', padding: 12, borderRadius: 12, textAlign: 'center' },
});