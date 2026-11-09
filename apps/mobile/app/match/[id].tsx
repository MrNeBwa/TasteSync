import { useEffect, useState } from 'react';
import { Image, Linking, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, COLORS, Loading } from '../../src/components/Ui';
import { request, type Match, type Movie, type Place, type SessionMatch } from '../../src/lib/api';
import { resolveMobileAssetUrl } from '../../src/lib/config';
import { useAuth } from '../../src/store/AuthContext';

export default function MatchScreen() {
  const { id, movieId, matchId } = useLocalSearchParams<{ id: string; movieId?: string; matchId?: string }>();
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [error, setError] = useState('');
  const [posterFailed, setPosterFailed] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const resolved = await request<SessionMatch | null>(`/sessions/${id}/match`, {}, token);
        if (!active) return;
        if (resolved?.kind === 'place' && resolved.place) {
          setPlace(resolved.place);
          return;
        }
        if (resolved?.kind === 'movie' && resolved.movie) {
          setMovie(resolved.movie);
          return;
        }
      } catch {
        // Fall through to legacy movie match lookup
      }

      let targetId: string | undefined = movieId;
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
        setError(e instanceof Error ? e.message : 'Не удалось загрузить совпадение');
      }
    })();
    return () => {
      active = false;
    };
  }, [id, movieId, matchId, token]);

  async function shareMatch() {
    try {
      if (place) {
        const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.latitude},${place.longitude}`)}`;
        await Share.share({
          message: `Мы выбрали место в Movie Match: ${place.name}${place.address ? ` (${place.address})` : ''} — ${mapUrl}`,
        });
      } else if (movie) {
        await Share.share({
          message: `Мы выбрали фильм в Movie Match: ${movie.title}${movie.trailer_url ? ` — ${movie.trailer_url}` : ''}`,
        });
      }
    } catch {
      // Ignore share cancellation
    }
  }

  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text><Button onPress={() => router.replace('/home')}>На главную</Button></View>;
  if (!movie && !place) return <Loading />;

  const placePhoto = place ? resolveMobileAssetUrl(place.image_url) : null;
  const placeTags = place ? (place.tags.length > 0 ? place.tags : (place.cuisine ?? '').split(';').map((s) => s.trim()).filter(Boolean).slice(0, 4)) : [];

  return (
    <View style={styles.screen}>
      {movie?.backdrop_url ? <Image source={{ uri: movie.backdrop_url }} style={styles.bg} /> : null}
      <View style={styles.overlay} />
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 24 }]}>
        <View style={styles.card}>
          <Text style={styles.kicker}>EVERYONE AGREED</Text>
          <Text style={styles.title}>{place ? 'Место выбрано!' : 'Ваш фильм найден.'}</Text>
          {movie ? (
            <>
              {movie.poster_url && !posterFailed ? (
                <Image source={{ uri: movie.poster_url }} style={styles.poster} resizeMode="cover" onError={() => setPosterFailed(true)} />
              ) : (
                <View style={[styles.poster, styles.posterFallback]}><Text style={styles.posterFallbackText}>{movie.title}</Text></View>
              )}
              <Text style={styles.movieTitle}>{movie.title}</Text>
              <View style={styles.tagRow}>{movie.genres.slice(0, 4).map((g) => <Text key={g.id} style={styles.tag}>{g.name}</Text>)}</View>
              <Text style={styles.copy}>{movie.overview ?? 'Похоже, на сегодня решение принято.'}</Text>
              {movie.trailer_url ? (
                <Button variant="secondary" onPress={() => void Linking.openURL(movie.trailer_url!)}>Открыть трейлер ↗</Button>
              ) : null}
            </>
          ) : place ? (
            <>
              {placePhoto && !posterFailed ? (
                <Image source={{ uri: placePhoto }} style={styles.placeBanner} resizeMode="cover" onError={() => setPosterFailed(true)} />
              ) : (
                <View style={[styles.placeBanner, styles.posterFallback]}>
                  <Text style={styles.posterFallbackText}>{place.name}</Text>
                </View>
              )}
              <Text style={styles.movieTitle}>{place.name}</Text>
              {placeTags.length > 0 && <View style={styles.tagRow}>{placeTags.map((t) => <Text key={t} style={styles.tag}>{t}</Text>)}</View>}
              <Text style={styles.copy}>{place.address || 'Адрес на карте OpenStreetMap'}</Text>
              {place.opening_hours ? <Text style={styles.copy}>Часы работы: {place.opening_hours}</Text> : null}
              <Button
                variant="secondary"
                onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.latitude},${place.longitude}`)}`)}
              >
                Открыть на карте ↗
              </Button>
            </>
          ) : null}
          <Button variant="secondary" onPress={() => void shareMatch()}>Поделиться выбором</Button>
          <Button onPress={() => router.replace('/home')}>Вернуться на главную</Button>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 12 },
  bg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(17,17,17,.75)' },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 18, paddingBottom: 32 },
  card: { backgroundColor: '#F5F3ED', borderWidth: 2, borderColor: '#111', borderRadius: 28, padding: 20, gap: 12 },
  kicker: { fontSize: 11, letterSpacing: 2, color: '#777', fontWeight: '800' },
  title: { fontSize: 38, fontWeight: '900', letterSpacing: -1.5, color: '#111' },
  poster: { width: '100%', aspectRatio: 2 / 3, borderRadius: 18 },
  placeBanner: { width: '100%', aspectRatio: 16 / 10, borderRadius: 18 },
  posterFallback: { backgroundColor: COLORS.pink, alignItems: 'center', justifyContent: 'center' },
  posterFallbackText: { fontSize: 30, fontWeight: '900', color: '#fff', padding: 16, textAlign: 'center' },
  movieTitle: { fontSize: 28, fontWeight: '900', color: '#111' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { fontSize: 12, fontWeight: '800', color: '#F5F3ED', backgroundColor: '#111', borderWidth: 1.5, borderColor: '#111', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, overflow: 'hidden' },
  copy: { fontSize: 16, color: '#5D5A52', lineHeight: 23 },
  error: { color: '#8F1722', backgroundColor: '#FFE0E4', padding: 12, borderRadius: 12, textAlign: 'center' },
});
