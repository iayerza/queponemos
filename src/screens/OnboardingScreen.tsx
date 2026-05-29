import React, { useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography } from '../constants/colors';
import TitlePoster from '../components/TitlePoster';
import RatingButtons from '../components/RatingButtons';
import { useOnboarding } from '../hooks/useOnboarding';
import { useAuthStore } from '../store/useAuthStore';
import { completeOnboarding, rateTitleAndUpdateProfile } from '../services/firebase';

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'true';

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { user, updateRatings, markOnboardingDone } = useAuthStore();
  const { titles, currentIndex, ratings, isLoading, error, rate, canSkip, isFinished } = useOnboarding();

  async function handleFinish() {
    if (!user) return;
    if (!USE_MOCK) {
      try { await completeOnboarding(user.uid); } catch { /* silenciar */ }
    }
    markOnboardingDone();
  }

  async function handleRate(r: Parameters<typeof rate>[0]) {
    const title = titles[currentIndex];
    if (!title || !user) return;
    updateRatings(title.tmdbId, r);
    if (!USE_MOCK) {
      try {
        await rateTitleAndUpdateProfile(user.uid, title.tmdbId, r, title);
      } catch { /* silenciar */ }
    }
    rate(r);
  }

  useEffect(() => {
    if (isFinished) handleFinish();
  }, [isFinished]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.accent} size="large" />
        <Text style={styles.loadingText}>Cargando títulos…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Error cargando títulos</Text>
        <Text style={styles.errorSub}>{error}</Text>
      </View>
    );
  }

  const current = titles[currentIndex];
  const progress = titles.length > 0 ? currentIndex / titles.length : 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>StreamMatch</Text>
        <Text style={styles.counter}>{currentIndex + 1} / {titles.length}</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {current && (
          <>
            <TitlePoster title={current} />
            <View style={styles.ratingSection}>
              <RatingButtons
                selected={ratings[current.tmdbId] ?? null}
                onSelect={handleRate}
              />
            </View>
          </>
        )}

        {canSkip && (
          <TouchableOpacity style={styles.skipBtn} onPress={handleFinish}>
            <Text style={styles.skipText}>
              Saltar — ya tenés suficiente contexto →
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: Colors.sub, fontSize: Typography.body },
  errorText: { color: Colors.danger, fontSize: Typography.h3, fontWeight: Typography.bold },
  errorSub: { color: Colors.sub, fontSize: Typography.small },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  logo: { color: Colors.text, fontSize: Typography.h3, fontWeight: Typography.black },
  counter: { color: Colors.sub, fontSize: Typography.small },
  progressTrack: { height: 2, backgroundColor: Colors.border, marginHorizontal: 0 },
  progressFill: { height: 2, backgroundColor: Colors.accent },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  ratingSection: { marginTop: 20 },
  skipBtn: { marginTop: 24, alignItems: 'center', padding: 12 },
  skipText: { color: Colors.sub, fontSize: Typography.small },
});
