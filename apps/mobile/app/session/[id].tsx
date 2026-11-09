import { useEffect, useRef, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Button, Loading } from '../../src/components/Ui';
import { request, youtubeEmbed, type Match, type Movie, type Place, type Room, type SearchMode, type Session, type SessionMatch } from '../../src/lib/api';
import { getSavedLocation, resolveMobileAssetUrl } from '../../src/lib/config';
import { useAuth } from '../../src/store/AuthContext';

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<SearchMode>('movies');
  const [movies, setMovies] = useState<Movie[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [voting, setVoting] = useState(false);
  const [finished, setFinished] = useState(false);
  const matched = useRef(false);

  async function load(targetMode?: SearchMode) {
    setLoading(true);
    setError('');
    try {
      let resolvedMode = targetMode ?? mode;
      if (!targetMode) {
        const currentSession = await request<Session>(`/sessions/${id}`, {}, token);
        const room = await request<Room>(`/rooms/${currentSession.room_id}`, {}, token);
        resolvedMode = room.task ?? 'movies';
        setMode(resolvedMode);
      }
      if (resolvedMode === 'movies') {
        const items = await request<Movie[]>(`/sessions/${id}/movies?limit=8&exploration_ratio=0.25`, {}, token);
        setMovies(items);
        setPlaces([]);
      } else {
        const loc = getSavedLocation();
        const cat = resolvedMode === 'restaurants' ? 'RESTAURANT' : 'ENTERTAINMENT';
        const items = await request<Place[]>(
          `/sessions/${id}/places?category=${cat}&lat=${loc.latitude}&lon=${loc.longitude}&radius=5000&limit=20`,
          {},
          token
        );
        setPlaces(items);
        setMovies([]);
      }
      setIndex(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить подборку');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

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
          const resolved = await request<SessionMatch | null>(`/sessions/${id}/match`, {}, token);
          if (!active || !resolved) return;
          matched.current = true;
          clearInterval(timer);
          router.replace(`/match/${id}`);
        }
      } catch {
        // Ignore transient network errors during polling
      }
    }, 4000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [id, token]);

  const movie = movies[index];
  const place = places[index];
  const item = mode === 'movies' ? movie : place;
  const totalCount = mode === 'movies' ? movies.length : places.length;
  const embed = movie ? youtubeEmbed(movie.trailer_url) : null;

  async function vote(value: 'LIKE' | 'DISLIKE' | 'SKIP') {
    if (!item || voting) return;
    setVoting(true);
    setError('');
    try {
      if (mode === 'movies' && movie) {
        const result = await request<{ matched: boolean; match: Match | null }>(`/sessions/${id}/votes`, {
          method: 'POST',
          body: JSON.stringify({ movie_id: movie.id, value }),
        }, token);
        if (result.matched) {
          matched.current = true;
          router.replace(`/match/${id}?movieId=${movie.id}`);
          return;
        }
      } else if (place) {
        const result = await request<{ matched: boolean }>(`/sessions/${id}/votes`, {
          method: 'POST',
          body: JSON.stringify({
            place_id: place.id,
            category: mode === 'restaurants' ? 'RESTAURANT' : 'ENTERTAINMENT',
            value,
          }),
        }, token);
        if (result.matched) {
          matched.current = true;
          router.replace(`/match/${id}`);
          return;
        }
      }
      if (index + 1 < totalCount) setIndex(index + 1);
      else await load(mode);
    } catch (e) {
      if (index + 1 < totalCount) {
        setIndex(index + 1);
      } else {
        setError(e instanceof Error ? e.message : 'Не удалось сохранить выбор');
      }
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

  if (!item || loading) {
    const message = error || (totalCount === 0 ? 'Подборка закончилась.' : '');
    if (loading && !error) return <Loading />;
    return (
      <ScrollView contentContainerStyle={styles.center}>
        <Text style={styles.error}>{message}</Text>
        <Button onPress={() => void load(mode)}>Обновить</Button>
        <Button variant="secondary" onPress={() => router.replace('/home')}>На главную</Button>
      </ScrollView>
    );
  }

  const placePhoto = place ? resolveMobileAssetUrl(place.image_url) : null;
  const placeTags = place ? (place.tags.length > 0 ? place.tags : (place.cuisine ?? '').split(';').map((s) => s.trim()).filter(Boolean).slice(0, 4)) : [];

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 16 }]}>
      <View style={styles.topBar}>
        <Text style={styles.kicker}>
          {mode === 'movies' ? 'NOW PLAYING' : mode === 'restaurants' ? 'RESTAURANTS' : 'ENTERTAINMENT'} · {index + 1}/{totalCount}
        </Text>
        <Pressable onPress={() => router.replace('/home')}>
          <Text style={styles.leaveLink}>завершить</Text>
        </Pressable>
      </View>

      <View style={styles.trailerSection}>
        {mode === 'movies' && movie ? (
          embed ? (
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
            <View style={styles.trailerFallback}><Text style={styles.trailerFallbackText}>{movie.title}</Text></View>
          )
        ) : place ? (
          placePhoto ? (
            <Image source={{ uri: placePhoto }} style={styles.trailerImage} />
          ) : (
            <View style={[styles.trailerFallback, { backgroundColor: '#1F1D18' }]}>
              <Text style={styles.placeEmoji}>{place.category === 'RESTAURANT' ? '🍽' : '🎭'}</Text>
              <Text style={styles.trailerFallbackText}>{place.city ?? getSavedLocation().city}</Text>
            </View>
          )
        ) : null}
      </View>

      <ScrollView style={styles.detailsScroll} contentContainerStyle={styles.detailsContent}>
        {mode === 'movies' && movie ? (
          <View style={styles.details}>
            <Text style={styles.title}>{movie.title}</Text>
            <View style={styles.tagRow}>{movie.genres.slice(0, 4).map((g) => <Text key={g.id} style={styles.tag}>{g.name}</Text>)}</View>
            <Text style={styles.rating}>
              {movie.release_date?.slice(0, 4) ?? '—'} · {movie.vote_average?.toFixed(1) ?? '—'} / 10
            </Text>
            {movie.overview ? <Text style={styles.overview}>{movie.overview}</Text> : null}
          </View>
        ) : place ? (
          <View style={styles.details}>
            <Text style={styles.title}>{place.name}</Text>
            {placeTags.length > 0 && (
              <View style={styles.tagRow}>{placeTags.slice(0, 4).map((t) => <Text key={t} style={styles.tag}>{t}</Text>)}</View>
            )}
            <Text style={styles.rating}>
              {[place.rating ? `★ ${place.rating.toFixed(1)}` : null, place.price_level, place.city ?? getSavedLocation().city].filter(Boolean).join(' · ')}
            </Text>
            <Text style={styles.overview}>{place.address || 'Адрес на карте OpenStreetMap'}</Text>
            {place.opening_hours ? <Text style={styles.metaLine}>Часы работы: {place.opening_hours}</Text> : null}
            {place.phone ? <Text style={styles.metaLine}>Телефон: {place.phone}</Text> : null}
            <Pressable
              style={styles.mapBtn}
              onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.latitude},${place.longitude}`)}`)}
            >
              <Text style={styles.mapBtnText}>Открыть на карте ↗</Text>
            </Pressable>
          </View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable style={styles.voteButton} disabled={voting} onPress={() => void vote('DISLIKE')}>
          <Text style={[styles.voteIcon, styles.voteIconRed]}>✕</Text>
          <Text style={styles.voteLabel}>Не нравится</Text>
        </Pressable>
        <Pressable style={styles.voteButton} disabled={voting} onPress={() => void vote('SKIP')}>
          <Text style={[styles.voteIcon, styles.voteIconGray]}>↗</Text>
          <Text style={styles.voteLabel}>Пропустить</Text>
        </Pressable>
        <Pressable style={styles.voteButton} disabled={voting} onPress={() => void vote('LIKE')}>
          <Text style={[styles.voteIcon, styles.voteIconGreen]}>♥</Text>
          <Text style={styles.voteLabel}>Нравится</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0E0E0E' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 10 },
  leaveLink: { color: '#B9B5AC', fontSize: 14, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 12 },
  trailerSection: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  trailer: { flex: 1, backgroundColor: '#000' },
  trailerImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  trailerFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#222', padding: 16, gap: 8 },
  placeEmoji: { fontSize: 48 },
  trailerFallbackText: { color: '#ECE9E1', fontSize: 16, letterSpacing: 1, fontWeight: '800', textAlign: 'center' },
  kicker: { color: '#EFBD43', fontSize: 11, letterSpacing: 2, fontWeight: '800' },
  detailsScroll: { flex: 1 },
  detailsContent: { padding: 20, paddingBottom: 32, gap: 8 },
  details: { gap: 8 },
  title: { fontSize: 30, fontWeight: '900', letterSpacing: -0.8, color: '#F5F3ED' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  tag: { fontSize: 12, fontWeight: '800', color: '#0E0E0E', backgroundColor: '#EFBD43', borderWidth: 1.5, borderColor: '#0E0E0E', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, overflow: 'hidden' },
  rating: { fontSize: 14, color: '#EFBD43', fontWeight: '800' },
  overview: { fontSize: 16, lineHeight: 24, color: '#B9B5AC', marginTop: 4 },
  metaLine: { fontSize: 14, color: '#9A968D', fontWeight: '600' },
  mapBtn: { alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: '#262B33' },
  mapBtnText: { color: '#EFBD43', fontWeight: '800', fontSize: 14 },
  actionBar: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#2A2A2A', backgroundColor: '#161616' },
  voteButton: { alignItems: 'center', gap: 6, minWidth: 92, paddingVertical: 8 },
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
