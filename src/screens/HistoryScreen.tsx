import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Image, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography } from '../constants/colors';
import { useColors } from '../context/ThemeContext';
import { useMatchStore } from '../store/useMatchStore';
import { useAuthStore } from '../store/useAuthStore';
import { getPosterUrl } from '../services/tmdb';
import {
  getPersonalWatchlist, removeFromPersonalWatchlist,
  type PersonalWatchlistItem,
} from '../services/firebase';
import { getPlatform } from '../constants/platforms';

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'true';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  watched:   { label: 'Vista',     color: Colors.accent },
  watchlist: { label: 'Pendiente', color: Colors.warning },
  skipped:   { label: 'Pasada',    color: Colors.danger },
  pending:   { label: 'Pendiente', color: Colors.sub },
};

type Tab = 'history' | 'watchlist';

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { history } = useMatchStore();
  const { user } = useAuthStore();
  const themeColors = useColors();

  const [activeTab, setActiveTab] = useState<Tab>('history');
  const [watchlist, setWatchlist] = useState<PersonalWatchlistItem[]>([]);
  const [loadingWatchlist, setLoadingWatchlist] = useState(false);

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
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.emptyTitle}>Todavía sin matches</Text>
              <Text style={styles.emptyDesc}>
                Cuando hagas tu primer match, va a aparecer acá.
              </Text>
            </View>
          ) : (
            history.map(entry => (
              <View key={entry.matchId} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardDate}>
                    {new Date(entry.createdAt).toLocaleDateString('es-AR', {
                      day: 'numeric', month: 'long',
                    })}
                  </Text>
                  <Text style={styles.cardGroup}>{entry.groupName}</Text>
                </View>
                {entry.recommendations.map(r => {
                  const st = STATUS_LABELS[r.groupStatus] ?? STATUS_LABELS.pending;
                  const posterUrl = getPosterUrl(r.posterPath ?? null);
                  return (
                    <View key={r.title} style={styles.recRow}>
                      {posterUrl ? (
                        <Image source={{ uri: posterUrl }} style={styles.recPoster} />
                      ) : (
                        <View style={styles.recPosterPlaceholder}>
                          <Text style={styles.recPosterEmoji}>{r.type === 'series' ? '📺' : '🎬'}</Text>
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
              </View>
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
              <Text style={styles.emptyEmoji}>🕐</Text>
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
                      <Text style={{ fontSize: 28 }}>{item.type === 'series' ? '📺' : '🎬'}</Text>
                    </View>
                  )}
                  <View style={styles.watchlistInfo}>
                    <Text style={styles.watchlistTitle} numberOfLines={2}>{item.title}</Text>
                    <Text style={styles.watchlistMeta}>{item.year} · {item.type === 'series' ? 'Serie' : 'Película'}</Text>
                    <View style={styles.platformRow}>
                      <Text style={styles.platformEmoji}>{platform.emoji}</Text>
                      <Text style={styles.platformName}>{platform.name}</Text>
                    </View>
                    <Text style={styles.watchlistSynopsis} numberOfLines={2}>{item.synopsis}</Text>
                  </View>
                  <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemove(item.tmdbId)} hitSlop={8}>
                    <Text style={styles.removeText}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
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
  emptyEmoji: { fontSize: 48 },
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 10,
  },
  cardDate: { color: Colors.text, fontWeight: Typography.bold, fontSize: Typography.body },
  cardGroup: { color: Colors.sub, fontSize: Typography.small },
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
  recPosterEmoji: { fontSize: 16 },
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
  platformEmoji: { fontSize: 12 },
  platformName: { color: Colors.sub, fontSize: Typography.tiny },
  watchlistSynopsis: { color: Colors.sub, fontSize: Typography.tiny, lineHeight: 16, marginTop: 4 },
  removeBtn: { padding: 4 },
  removeText: { color: Colors.faint, fontSize: 14 },
});
