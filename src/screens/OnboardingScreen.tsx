import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Animated,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Colors, Typography } from '../constants/colors';
import { LogoWordmark } from '../components/Logo';
import TitlePoster from '../components/TitlePoster';
import RatingButtons from '../components/RatingButtons';
import { useOnboarding } from '../hooks/useOnboarding';
import { useAuthStore } from '../store/useAuthStore';
import { completeOnboarding, rateTitleAndUpdateProfile } from '../services/firebase';
import type { RootStackParamList } from '../navigation/types';

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'true';
const MIN_TO_SKIP = 12;
const TOTAL = 30;

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Onboarding'>;

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const nav   = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { user, updateRatings, markOnboardingDone, setAgeRange } = useAuthStore();
  const ageRange = route.params?.ageRange;
  const { titles, currentIndex, ratings, isLoading, error, rate, canSkip, isFinished } = useOnboarding(ageRange);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const fromProfile = route.params?.fromProfile === true;

  function handleFinish() {
    if (!user) return;
    if (ageRange) setAgeRange(ageRange);
    if (fromProfile) {
      if (!USE_MOCK) completeOnboarding(user.uid, ageRange).catch(() => {});
      nav.goBack();
    } else {
      markOnboardingDone();
      if (!USE_MOCK) completeOnboarding(user.uid, ageRange).catch(() => {});
    }
  }

  function handleRate(r: Parameters<typeof rate>[0]) {
    const title = titles[currentIndex];
    if (!title || !user) return;
    fadeAnim.setValue(0);
    updateRatings(title.tmdbId, r);
    if (!USE_MOCK) {
      rateTitleAndUpdateProfile(user.uid, title.tmdbId, r, title).catch(() => {});
    }
    rate(r);
    Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }

  useEffect(() => {
    if (isFinished) handleFinish();
  }, [isFinished]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.accent} size="large" />
        <Text style={styles.loadingText}>Preparando tus títulos…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>No se pudieron cargar los títulos</Text>
        <Text style={styles.errorSub}>Verificá tu conexión e intentá de nuevo</Text>
      </View>
    );
  }

  const current = titles[currentIndex];
  const progressPct = titles.length > 0 ? (currentIndex / titles.length) * 100 : 0;
  const milestonePct = (MIN_TO_SKIP / TOTAL) * 100;
  const remaining = MIN_TO_SKIP - currentIndex;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.header}>
        <LogoWordmark markSize={18} />
        <View style={styles.headerRight}>
          <Text style={styles.counter}>{currentIndex}<Text style={styles.counterTotal}>/{titles.length}</Text></Text>
          <TouchableOpacity onPress={handleFinish} hitSlop={12}>
            <Text style={styles.skipHeaderText}>Más tarde</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Progress bar con milestone */}
      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          <View style={[styles.milestoneMark, { left: `${milestonePct}%` }]} />
        </View>
        <Text style={styles.progressHint}>
          {remaining > 0
            ? `${remaining} más para poder continuar`
            : `${currentIndex} calificados — podés continuar`}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
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
        </Animated.View>

        {canSkip && (
          <TouchableOpacity style={styles.continueBtn} onPress={handleFinish} activeOpacity={0.85}>
            <Text style={styles.continueBtnText}>Continuar →</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  loadingText: { color: Colors.sub, fontSize: Typography.body },
  errorText: { color: Colors.danger, fontSize: Typography.h3, fontWeight: Typography.bold, textAlign: 'center' },
  errorSub: { color: Colors.sub, fontSize: Typography.small, textAlign: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  counter: { color: Colors.text, fontSize: Typography.h3, fontWeight: Typography.medium },
  counterTotal: { color: Colors.faint, fontWeight: Typography.regular },
  skipHeaderText: { color: Colors.faint, fontSize: Typography.body },

  progressWrap: { paddingHorizontal: 24, marginBottom: 16 },
  progressTrack: {
    height: 5,
    backgroundColor: Colors.s2,
    borderRadius: 3,
    overflow: 'visible',
    marginBottom: 8,
  },
  progressFill: {
    height: 5,
    backgroundColor: Colors.accent,
    borderRadius: 3,
  },
  milestoneMark: {
    position: 'absolute',
    top: -3,
    width: 2,
    height: 11,
    backgroundColor: Colors.border,
    borderRadius: 1,
    marginLeft: -1,
  },
  progressHint: {
    color: Colors.faint,
    fontSize: Typography.small,
  },

  scroll: { paddingHorizontal: 24, paddingTop: 4 },
  ratingSection: { marginTop: 20, gap: 12 },
  continueBtn: {
    marginTop: 28,
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueBtnText: { color: '#fff', fontSize: Typography.body, fontWeight: Typography.medium },
});
