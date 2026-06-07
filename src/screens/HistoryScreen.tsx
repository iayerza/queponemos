import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Image, TouchableOpacity, Alert } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Typography } from '../constants/colors';
import { useColors } from '../context/ThemeContext';
import { useMatchStore } from '../store/useMatchStore';
import type { MatchEntry } from '../store/useMatchStore';
import { useAuthStore } from '../store/useAuthStore';
import type { RootStackParamList } from '../navigation/types';
import { getPosterUrl } from '../services/tmdb';
import {
  getPersonalWatchlist, removeFromPersonalWatchlist, removeFromPendingRatings,
  getPendingRatingsForUser, rateTitleAndUpdateProfile, updateTitleStatus,
  type PersonalWatchlistItem,
  type PendingRatingItem,
  type Rating,
} from '../services/firebase';
import WatchedRatingSheet from '../components/WatchedRatingSheet';
import { getPlatform } from '../constants/platforms';
import PlatformLogo from '../components/PlatformLogo';

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'true';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  watched:   { label: 'Vista',       color: Colors.accent },
  watchlist: { label: 'Para después', color: Colors.warning },
  chosen:    { label: 'Elegida',     color: Colors.accent },
  skipped:   { label: 'Pasada',      color: Colors.danger },
  pending:   { label: 'Sin acción',  color: Colors.sub },
};

type Tab = 'history' | 'watchlist' | 'pending';
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const { history, setCurrentMatch, setSoloMode } = useMatchStore();
  const { user, updateRatings } = useAuthStore();
  const themeColors = useColors();

  function handleViewMatch(entry: MatchEntry) {
    const isSolo = entry.groupId.startsWith('solo-');
    setSoloMode(isSolo);
    setCurrentMatch({ recommendations: entry.recommendations, groupInsight: '' }, entry.matchId);
    nav.navigate('Results', { matchId: entry.matchId });
  }

  const [activeTab, setActiveTab] = useState<Tab>('history');
  const [watchlist, setWatchlist] = useState<PersonalWatchlistItem[]>([]);
  const [loadingWatchlist, setLoadingWatchlist] = useState(false);
  const [pendingItems, setPendingItems] = useState<PendingRatingItem[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [ratingPending, setRatingPending] = useState<PendingRatingItem | null>(null);
  const [ratingWatchlist, setRatingWatchlist] = useState<PersonalWatchlistItem | null>(null);

  const loadWatchlist = useCallback(async () => {
    if (!user || USE_MOCK) return;
    setLoadingWatchlist(true);
    try {
      const items = await getPersonalWatchlist(user.uid);
      setWatchlist(items);
    } catch { /* silenciar */ }
    finally { setLoadingWatchlist(false); }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'watchlist') loadWatchlist();
  }, [activeTab, loadWatchlist]);

  const loadPending = useCallback(async () => {
    if (!user || USE_MOCK) return;
    setLoadingPending(true);
    try {
      const items = await getPendingRatingsForUser(user.uid);
      setPendingItems(items);
    } catch { /* silenciar */ }
    finally { setLoadingPending(false); }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'pending') loadPending();
  }, [activeTab, loadPending]);

  async function handleRatePending(rating: Rating) {
    if (!ratingPending || !user) return;
    const { matchId, rec } = ratingPending;
    setRatingPending(null);
    setPendingItems(prev => prev.filter(i => !(i.matchId === matchId && i.rec.tmdbId === rec.tmdbId)));
    if (rec.tmdbId) updateRatings(rec.tmdbId, rating);
    if (!USE_MOCK && rec.tmdbId) {
      try {
        await Promise.all([
          rateTitleAndUpdateProfile(user.uid, rec.tmdbId, rating, {
            id: rec.tmdbId, tmdbId: rec.tmdbId, title: rec.title, year: rec.year,
            type: rec.type === 'series' ? 'tv' : 'movie',
            genres: rec.genres, rating: rec.rating, posterPath: rec.posterPath, synopsis: rec.synopsis,
          }),
          updateTitleStatus(matchId, rec.tmdbId, 'watched'),
          removeFromPendingRatings(user.uid, matchId, rec.tmdbId),
        ]);
      } catch { /* silenciar */ }
    }
  }

  async function handleRemove(tmdbId: number) {
    if (!user) return;
    Alert.alert('Quitar de "Para después"', '¿Eliminás este título de tu lista?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar', style: 'destructive',
        onPress: async () => {
          setWatchlist(prev => prev.filter(i => i.tmdbId !== tmdbId));
          if (!USE_MOCK) {
            try { await removeFromPersonalWatchlist(user.uid, tmdbId); }
            catch { /* silenciar */ }
          }
        },
      },
    ]);
  }

  async function handleRateWatchlist(rating: Rating) {
    if (!ratingWatchlist || !user) return;
    const item = ratingWatchlist;
    setRatingWatchlist(null);
    setWatchlist(prev => prev.filter(i => i.tmdbId !== item.tmdbId));
    if (item.tmdbId) updateRatings(item.tmdbId, rating);
    if (!USE_MOCK && item.tmdbId) {
      try {
        await Promise.all([
          rateTitleAndUpdateProfile(user.uid, item.tmdbId, rating, {
            id: item.tmdbId, tmdbId: item.tmdbId, title: item.title, year: item.year,
            type: item.type === 'series' ? 'tv' : 'movie',
            genres: item.genres, rating: item.rating, posterPath: item.posterPath, synopsis: item.synopsis,
          }),
          removeFromPersonalWatchlist(user.uid, item.tmdbId),
        ]);
      } catch { /* silenciar */ }
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: themeColors.bg }]}>
      {/* Tab bar */}
      <View style={[styles.tabBar, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.screenTitle}>Mis listas</Text>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'history' && styles.tabActive]}
            onPress={() => setActiveTab('history')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>Historial</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'watchlist' && styles.tabActive]}
            onPress={() => setActiveTab('watchlist')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'watchlist' && styles.tabTextActive]}>Para después</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'pending' && styles.tabActive]}
            onPress={() => setActiveTab('pending')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>Por puntuar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* History tab */}
      {activeTab === 'history' && (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {history.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="list" size={48} color={Colors.faint} />
              <Text style={styles.emptyTitle}>Todavía sin matches</Text>
              <Text style={styles.emptyDesc}>
                Cuando hagas tu primer match, va a aparecer acá.
              </Text>
            </View>
          ) : (
            history.map(entry => (
              <TouchableOpacity key={entry.matchId} style={styles.card} onPress={() => handleViewMatch(entry)} activeOpacity={0.75}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardDate}>
                      {new Date(entry.createdAt).toLocaleDateString('es-AR', {
                        day: 'numeric', month: 'long',
                      })}
                    </Text>
                    <Text style={styles.cardGroup}>{entry.groupName}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={Colors.faint} />
                </View>
                {entry.recommendations.map(r => {
                  const st = STATUS_LABELS[r.groupStatus] ?? STATUS_LABELS.pending;
                  const posterUrl = getPosterUrl(r.posterPath ?? null);
                  return (
                    <View key={r.tmdbId ?? r.title} style={styles.recRow}>
                      {posterUrl ? (
                        <Image source={{ uri: posterUrl }} style={styles.recPoster} />
                      ) : (
                        <View style={styles.recPosterPlaceholder}>
                          <Feather name={r.type === 'series' ? 'tv' : 'film'} size={14} color={Colors.faint} />
                        </View>
                      )}
                      <View style={styles.recInfo}>
                        <Text style={styles.recTitle} numberOfLines={1}>{r.title}</Text>
                        <Text style={styles.recMeta}>{r.year} · {r.type === 'series' ? 'Serie' : 'Película'}</Text>
                      </View>
                      <View style={[styles.badge, { backgroundColor: `${st.color}22`, borderColor: `${st.color}66` }]}>
                        <Text style={[styles.badgeText, { color: st.color }]}>{st.label}</Text>
                      </View>
                    </View>
                  );
                })}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {/* Para después tab */}
      {activeTab === 'watchlist' && (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {loadingWatchlist ? (
            <Text style={styles.loadingText}>Cargando…</Text>
          ) : watchlist.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="clock" size={48} color={Colors.faint} />
              <Text style={styles.emptyTitle}>Tu lista está vacía</Text>
              <Text style={styles.emptyDesc}>
                Cuando marques algo como "Para después" en el modo solo, va a aparecer acá.
              </Text>
            </View>
          ) : (
            watchlist.map(item => {
              const posterUrl = getPosterUrl(item.posterPath ?? null);
              const platform = getPlatform(item.platform);
              return (
                <View key={item.tmdbId} style={styles.watchlistCard}>
                  {posterUrl ? (
                    <Image source={{ uri: posterUrl }} style={styles.watchlistPoster} />
                  ) : (
                    <View style={[styles.watchlistPoster, styles.watchlistPosterPlaceholder]}>
                      <Feather name={item.type === 'series' ? 'tv' : 'film'} size={26} color={Colors.faint} />
                    </View>
                  )}
                  <View style={styles.watchlistInfo}>
                    <Text style={styles.watchlistTitle} numberOfLines={2}>{item.title}</Text>
                    <Text style={styles.watchlistMeta}>{item.year} · {item.type === 'series' ? 'Serie' : 'Película'}</Text>
                    <View style={styles.platformRow}>
                      <PlatformLogo id={item.platform} size={16} />
                      <Text style={styles.platformName}>{platform.name}</Text>
                    </View>
                    <Text style={styles.watchlistSynopsis} numberOfLines={2}>{item.synopsis}</Text>
                  </View>
                  <View style={styles.watchlistActions}>
                    <TouchableOpacity
                      style={styles.rateBtn}
                      onPress={() => setRatingWatchlist(item)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.rateBtnText}>La vi</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => handleRemove(item.tmdbId)}
                      hitSlop={12}
                    >
                      <Text style={styles.removeText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Pendiente de valorar tab */}
      {activeTab === 'pending' && (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {loadingPending ? (
            <Text style={styles.loadingText}>Cargando…</Text>
          ) : pendingItems.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="star" size={48} color={Colors.faint} />
              <Text style={styles.emptyTitle}>Sin títulos pendientes</Text>
              <Text style={styles.emptyDesc}>
                Cuando el grupo elija una película para ver, va a aparecer acá para puntuar.
              </Text>
            </View>
          ) : (
            pendingItems.map((item, idx) => {
              const posterUrl = getPosterUrl(item.rec.posterPath ?? null);
              return (
                <View key={`${item.matchId}-${item.rec.tmdbId ?? idx}`} style={styles.watchlistCard}>
                  {posterUrl ? (
                    <Image source={{ uri: posterUrl }} style={styles.watchlistPoster} />
                  ) : (
                    <View style={[styles.watchlistPoster, styles.watchlistPosterPlaceholder]}>
                      <Feather name={item.rec.type === 'series' ? 'tv' : 'film'} size={26} color={Colors.faint} />
                    </View>
                  )}
                  <View style={styles.watchlistInfo}>
                    <Text style={styles.watchlistTitle} numberOfLines={2}>{item.rec.title}</Text>
                    <Text style={styles.watchlistMeta}>{item.rec.year} · {item.rec.type === 'series' ? 'Serie' : 'Película'}</Text>
                    <Text style={[styles.watchlistMeta, { marginTop: 2 }]}>{item.groupName}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.rateBtn}
                    onPress={() => setRatingPending(item)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.rateBtnText}>Puntuar</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      <WatchedRatingSheet
        visible={ratingPending !== null}
        title={ratingPending?.rec.title ?? ''}
        onClose={() => setRatingPending(null)}
        onRate={handleRatePending}
      />
      <WatchedRatingSheet
        visible={ratingWatchlist !== null}
        title={ratingWatchlist?.title ?? ''}
        onClose={() => setRatingWatchlist(null)}
        onRate={handleRateWatchlist}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  tabBar: {
    paddingHorizontal: 24,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  screenTitle: { color: Colors.text, fontSize: Typography.hero, fontWeight: Typography.black, marginBottom: 14 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.s1,
  },
  tabActive: { borderColor: Colors.accentBorder, backgroundColor: Colors.accentFaint },
  tabText: { color: Colors.sub, fontSize: Typography.small, fontWeight: Typography.medium },
  tabTextActive: { color: Colors.accent, fontWeight: Typography.bold },
  content: { paddingHorizontal: 24, paddingTop: 20 },
  loadingText: { color: Colors.faint, textAlign: 'center', marginTop: 40 },
  empty: { marginTop: 60, alignItems: 'center', gap: 12 },
  emptyIcon: { marginBottom: 4 },
  emptyTitle: { color: Colors.text, fontSize: Typography.h3, fontWeight: Typography.bold },
  emptyDesc: { color: Colors.sub, fontSize: Typography.small, textAlign: 'center', lineHeight: 20 },
  card: {
    backgroundColor: Colors.s1,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 10,
    gap: 8,
  },
  cardDate: { color: Colors.text, fontWeight: Typography.bold, fontSize: Typography.body },
  cardGroup: { color: Colors.sub, fontSize: Typography.small, marginTop: 2 },
  recRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  recPoster: { width: 36, height: 52, borderRadius: 4 },
  recPosterPlaceholder: { width: 36, height: 52, borderRadius: 4, backgroundColor: Colors.s2, alignItems: 'center', justifyContent: 'center' },
  recInfo: { flex: 1, gap: 2 },
  recTitle: { color: Colors.text, fontSize: Typography.small },
  recMeta: { color: Colors.faint, fontSize: Typography.tiny },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  badgeText: { fontSize: Typography.tiny, fontWeight: Typography.semibold },
  watchlistCard: {
    backgroundColor: Colors.s1,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  watchlistPoster: { width: 72, height: 104, borderRadius: 8 },
  watchlistPosterPlaceholder: { backgroundColor: Colors.s2, alignItems: 'center', justifyContent: 'center' },
  watchlistInfo: { flex: 1, gap: 4 },
  watchlistTitle: { color: Colors.text, fontSize: Typography.body, fontWeight: Typography.bold, lineHeight: 20 },
  watchlistMeta: { color: Colors.faint, fontSize: Typography.tiny },
  platformRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  platformName: { color: Colors.sub, fontSize: Typography.tiny },
  watchlistSynopsis: { color: Colors.sub, fontSize: Typography.tiny, lineHeight: 16, marginTop: 4 },
  watchlistActions: { alignItems: 'center', gap: 8, justifyContent: 'center' },
  removeBtn: { padding: 4, alignItems: 'center' },
  removeText: { color: Colors.faint, fontSize: Typography.body },
  rateBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: 'center',
  },
  rateBtnText: { color: Colors.text, fontSize: Typography.tiny, fontWeight: Typography.medium },
});
