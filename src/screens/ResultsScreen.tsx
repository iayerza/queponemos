import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Typography } from '../constants/colors';
import { useColors } from '../context/ThemeContext';
import ResultCard from '../components/ResultCard';
import { useMatchStore } from '../store/useMatchStore';
import { useGroupStore } from '../store/useGroupStore';
import { useAuthStore } from '../store/useAuthStore';
import WatchedRatingSheet from '../components/WatchedRatingSheet';
import { updateTitleStatus, addToPersonalWatchlist, addToPendingRatings, rateTitleAndUpdateProfile, updateUserHistoryRecommendations } from '../services/firebase';
import type { Rating } from '../services/firebase';
import type { RootStackParamList } from '../navigation/types';
import type { Recommendation } from '../services/claude';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'true';

export default function ResultsScreen() {
  const insets = useSafeAreaInsets();
  const nav    = useNavigation<Nav>();
  const { currentMatch, currentMatchId, updateTitleAction, isSolo } = useMatchStore();
  const { currentGroup } = useGroupStore();
  const { user, updateRatings } = useAuthStore();
  const themeColors = useColors();
  const fadeAnimsRef = useRef<Animated.Value[]>([]);
  function getFadeAnim(i: number): Animated.Value {
    if (!fadeAnimsRef.current[i]) fadeAnimsRef.current[i] = new Animated.Value(1);
    return fadeAnimsRef.current[i];
  }

  const [ratingTarget, setRatingTarget] = useState<{ rec: Recommendation; idx: number } | null>(null);

  function celebrateAndGoHome() {
    Alert.alert(
      '¡Encontraste queponemos! 🍿',
      'Acordate de puntuar el título después de verlo.',
      [{ text: '¡Vamos!', onPress: () => nav.navigate('App') }],
    );
  }

  async function handleAction(idx: number, status: Recommendation['groupStatus']) {
    const anim = getFadeAnim(idx);
    if (anim) {
      Animated.timing(anim, { toValue: 0.3, duration: 200, useNativeDriver: true }).start();
    }
    updateTitleAction(0, idx, status);
    // Persist updated statuses to Firestore so HistoryScreen survives app restarts
    if (!USE_MOCK && currentMatchId && user) {
      const updatedRecs = useMatchStore.getState().currentMatch?.recommendations;
      if (updatedRecs) {
        updateUserHistoryRecommendations(user.uid, currentMatchId, updatedRecs).catch(() => {});
      }
    }
    if (!USE_MOCK && currentMatchId) {
      const rec = currentMatch?.recommendations[idx];
      if (rec) {
        if (status === 'watchlist' && user) {
          // Always add to personal watchlist regardless of solo/group mode
          try {
            await addToPersonalWatchlist(user.uid, {
              tmdbId: rec.tmdbId ?? 0,
              title: rec.title,
              year: rec.year,
              type: rec.type,
              posterPath: rec.posterPath,
              genres: rec.genres,
              platform: rec.platform,
              synopsis: rec.synopsis,
              rating: rec.rating,
              addedAt: Date.now(),
            });
          } catch { /* silenciar */ }
          // Also update match doc for group mode
          if (!isSolo && rec.tmdbId) {
            try { await updateTitleStatus(currentMatchId, rec.tmdbId, 'watchlist'); }
            catch { /* silenciar */ }
          }
        } else if (status === 'chosen' && user && rec.tmdbId) {
          try {
            const groupName = isSolo ? 'Solo' : (currentGroup?.name ?? 'Grupo');
            await addToPendingRatings(user.uid, currentMatchId, groupName, rec);
          } catch { /* silenciar */ }
          celebrateAndGoHome();
        } else if (rec.tmdbId) {
          try { await updateTitleStatus(currentMatchId, rec.tmdbId, status as import('../services/firebase').TitleStatus); }
          catch { /* silenciar */ }
        }
      }
    }
  }

  function handleLaVi(idx: number) {
    setRatingTarget({ rec: currentMatch!.recommendations[idx], idx });
  }

  async function handleRate(rating: Rating) {
    if (!ratingTarget || !user) return;
    const { rec, idx } = ratingTarget;
    setRatingTarget(null);
    handleAction(idx, 'watched');
    if (rec.tmdbId) updateRatings(rec.tmdbId, rating);
    if (!USE_MOCK && rec.tmdbId) {
      try {
        await rateTitleAndUpdateProfile(user.uid, rec.tmdbId, rating, {
          id: rec.tmdbId, tmdbId: rec.tmdbId, title: rec.title, year: rec.year,
          type: rec.type === 'series' ? 'tv' : 'movie',
          genres: rec.genres, rating: rec.rating, posterPath: rec.posterPath, synopsis: rec.synopsis,
        });
      } catch { /* silenciar */ }
    }
  }

  if (!currentMatch) {
    return (
      <View style={[styles.empty, { backgroundColor: themeColors.bg }]}>
        <Text style={styles.emptyText}>No hay resultados</Text>
        <TouchableOpacity onPress={() => nav.goBack()}>
          <Text style={styles.backLink}>← Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: themeColors.bg }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.eyebrow}>TU MATCH</Text>
      <Text style={styles.title}>Esta noche</Text>
      <Text style={styles.sub}>
        {isSolo ? 'Solo' : (currentGroup?.name ?? 'Tu grupo')} · {currentMatch.recommendations.length} recomendaciones
      </Text>

      {currentMatch.groupInsight ? (
        <View style={styles.insight}>
          <Text style={styles.insightLabel}>INSIGHT DEL GRUPO</Text>
          <Text style={styles.insightText}>{currentMatch.groupInsight}</Text>
        </View>
      ) : null}

      {(currentMatch.recommendations ?? []).map((rec, i) => (
        <Animated.View key={`${rec.title}-${i}`} style={{ opacity: getFadeAnim(i) }}>
          <ResultCard
            rec={rec}
            onAction={status => handleAction(i, status)}
            onLaVi={() => handleLaVi(i)}
          />
        </Animated.View>
      ))}

      <TouchableOpacity
        style={styles.newSearchBtn}
        onPress={() => isSolo ? nav.push('Mood', { solo: true }) : currentGroup ? nav.push('Mood', { groupId: currentGroup.id }) : nav.navigate('App')}
        activeOpacity={0.85}
      >
        <Text style={styles.newSearchBtnText}>Nueva búsqueda</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => !isSolo && currentGroup ? nav.navigate('Group', { groupId: currentGroup.id }) : nav.navigate('App')}
        activeOpacity={0.8}
      >
        <Text style={styles.backBtnText}>{isSolo ? 'Volver al inicio' : 'Volver al grupo'}</Text>
      </TouchableOpacity>

      <WatchedRatingSheet
        visible={ratingTarget !== null}
        title={ratingTarget?.rec.title ?? ''}
        onClose={() => setRatingTarget(null)}
        onRate={handleRate}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: 24 },
  empty: { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center', gap: 16 },
  emptyText: { color: Colors.sub, fontSize: Typography.body },
  backLink: { color: Colors.accent, fontSize: Typography.body },
  eyebrow: {
    color: Colors.sub,
    fontSize: Typography.tiny,
    fontWeight: Typography.semibold,
    letterSpacing: 2,
    marginBottom: 6,
  },
  title: { color: Colors.text, fontSize: Typography.hero, fontWeight: Typography.black, marginBottom: 4 },
  sub: { color: Colors.sub, fontSize: Typography.small, marginBottom: 20 },
  insight: {
    backgroundColor: Colors.s2,
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  insightLabel: {
    color: Colors.faint,
    fontSize: Typography.tiny,
    fontWeight: Typography.semibold,
    letterSpacing: 1,
    marginBottom: 6,
  },
  insightText: { color: Colors.sub, fontSize: Typography.small, fontStyle: 'italic', lineHeight: 20 },
  newSearchBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  newSearchBtnText: { color: Colors.text, fontWeight: Typography.medium, fontSize: Typography.body },
  backBtn: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
  },
  backBtnText: { color: Colors.sub, fontWeight: Typography.regular, fontSize: Typography.body },
});
