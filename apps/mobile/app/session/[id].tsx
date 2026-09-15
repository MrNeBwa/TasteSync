import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Button, COLORS, Loading } from '../../src/components/Ui';
import { request, youtubeEmbed, type Match, type Movie, type Session } from '../../src/lib/api';
import { useAuth } from '../../src/store/AuthContext';

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
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
    <View style={[styles.screen, { paddingTop: insets.top + 40 }]}>
      <View style={styles.trailerSection}>
        {embed ? (
          <WebView
            source={{ uri: embed, headers: { Referer: 'https://com.moviematch.app' } }}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            allowsFullscreenVideo
            javaScriptEnabled
            domStorageEnabled
            style={styles.trailer}
          />
        ) : movie.backdrop_url || movie.poster_url ? (
          <Image source={{ uri: movie.backdrop_url || movie.poster_url! }} style={styles.trailerImage} />
        ) : (
          <View style={styles.trailerFallback}><Text style={styles.trailerFallbackText}>ТРЕЙЛЕР НЕДОСТУПЕН</Text></View>
        )}
        <View style={styles.kickerPill}><Text style={styles.kicker}>NOW PLAYING · {index + 1}/{movies.length}</Text></View>
      </View>

      <ScrollView style={styles.detailsScroll} contentContainerStyle={styles.detailsContent}>
        <View style={styles.details}>
          <Text style={styles.title}>{movie.title}</Text>
          <View style={styles.tagRow}>{movie.genres.slice(0, 4).map(g => <Text key={g.id} style={styles.tag}>{g.name}</Text>)}</View>
          <Text style={styles.rating}>
            {movie.release_date?.slice(0, 4) ?? '—'} · {movie.vote_average?.toFixed(1) ?? '—'} / 10
          </Text>
          {movie.overview ? <Text style={styles.overview}>{movie.overview}</Text> : null}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.actionBar}>
        <Pressable style={styles.voteButton} disabled={voting} onPress={() => vote('DISLIKE')}>
          <Text style={[styles.voteIcon, styles.voteIconRed]}>✕</Text>
          <Text style={styles.voteLabel}>Не нравится</Text>
        </Pressable>
        <Pressable style={styles.voteButton} disabled={voting} onPress={() => vote('SKIP')}>
          <Text style={[styles.voteIcon, styles.voteIconGray]}>↗</Text>
          <Text style={styles.voteLabel}>Пропустить</Text>
        </Pressable>
        <Pressable style={styles.voteButton} disabled={voting} onPress={() => vote('LIKE')}>
          <Text style={[styles.voteIcon, styles.voteIconGreen]}>♥</Text>
          <Text style={styles.voteLabel}>Нравится</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0E0E0E' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 12 },
  trailerSection: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  trailer: { flex: 1, backgroundColor: '#000' },
  trailerImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  trailerFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#222' },
  trailerFallbackText: { color: '#777', fontSize: 13, letterSpacing: 2, fontWeight: '800' },
  kickerPill: { position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(14,14,14,.72)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  kicker: { color: '#EFBD43', fontSize: 11, letterSpacing: 2, fontWeight: '800' },
  detailsScroll: { flex: 1 },
  detailsContent: { padding: 20, paddingBottom: 32, gap: 8 },
  details: { gap: 6 },
  title: { fontSize: 30, fontWeight: '900', letterSpacing: -0.8, color: '#F5F3ED' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  tag: { fontSize: 12, fontWeight: '800', color: '#0E0E0E', backgroundColor: '#EFBD43', borderWidth: 1.5, borderColor: '#0E0E0E', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, overflow: 'hidden' },
  rating: { fontSize: 14, color: '#EFBD43', fontWeight: '800' },
  overview: { fontSize: 16, lineHeight: 24, color: '#B9B5AC', marginTop: 8 },
  actionBar: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#2A2A2A', backgroundColor: '#161616' },
  voteButton: { alignItems: 'center', gap: 6, minWidth: 92, paddingVertical: 10 },
  voteIcon: { fontSize: 34, fontWeight: '900' },
  voteLabel: { fontSize: 11, fontWeight: '800', color: '#9A968D' },
  voteIconRed: { color: '#FF6B7A' },
  voteIconGray: { color: '#B9B5AC' },
  voteIconGreen: { color: '#7FE28A' },
  done: { flex: 1, backgroundColor: '#111', padding: 24, justifyContent: 'center', gap: 12 },
  doneTitle: { fontSize: 40, fontWeight: '900', letterSpacing: -1.5, color: '#F5F3ED' },
  doneCopy: { fontSize: 17, color: '#9A968D', lineHeight: 24 },
  error: { color: '#8F1722', backgroundColor: '#FFE0E4', padding: 12, borderRadius: 12, textAlign: 'center' },
});