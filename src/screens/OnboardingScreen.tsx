import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  runOnJS, interpolate, Extrapolation,
} from 'react-native-reanimated';
import { Colors, Typography } from '../constants/colors';
import TitlePoster from '../components/TitlePoster';
import { useOnboarding } from '../hooks/useOnboarding';
import { useAuthStore } from '../store/useAuthStore';
import { completeOnboarding, rateTitleAndUpdateProfile } from '../services/firebase';
import type { Rating } from '../services/firebase';

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'true';
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const SWIPE_THRESHOLD = SCREEN_W * 0.3;
const DOWN_THRESHOLD  = 80;

const HINTS = [
  { dir: '→', label: 'Me encantó',   color: '#30c060' },
  { dir: '←', label: 'No me gustó',  color: '#e04040' },
  { dir: '↓', label: 'No la vi',     color: Colors.sub },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { user, updateRatings, markOnboardingDone } = useAuthStore();
  const { titles, currentIndex, ratings, isLoading, error, rate, canSkip, isFinished } = useOnboarding();

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const cardOpacity = useSharedValue(1);

  async function handleFinish() {
    if (!user) return;
    if (!USE_MOCK) {
      try { await completeOnboarding(user.uid); } catch { /* silenciar */ }
    }
    markOnboardingDone();
  }

  async function handleRate(r: Rating) {
    const title = titles[currentIndex];
    if (!title || !user) return;
    updateRatings(title.tmdbId, r);
    if (!USE_MOCK) {
      try { await rateTitleAndUpdateProfile(user.uid, title.tmdbId, r, title); } catch { /* silenciar */ }
    }
    rate(r);
  }

  function animateOut(direction: 'right' | 'left' | 'down', r: Rating) {
    'worklet';
    const toX = direction === 'right' ? SCREEN_W * 1.5 : direction === 'left' ? -SCREEN_W * 1.5 : 0;
    const toY = direction === 'down' ? SCREEN_H : 0;
    translateX.value = withTiming(toX, { duration: 250 });
    translateY.value = withTiming(toY, { duration: 250 });
    cardOpacity.value = withTiming(0, { duration: 200 }, () => {
      translateX.value = 0;
      translateY.value = 0;
      cardOpacity.value = 1;
      runOnJS(handleRate)(r);
    });
  }

  useEffect(() => {
    if (isFinished) handleFinish();
  }, [isFinished]);

  const gesture = Gesture.Pan()
    .onUpdate(e => {
      translateX.value = e.translationX;
      translateY.value = e.translationY > 0 ? e.translationY : e.translationY * 0.15;
    })
    .onEnd(e => {
      if (e.translationX > SWIPE_THRESHOLD) {
        animateOut('right', 'loved');
      } else if (e.translationX < -SWIPE_THRESHOLD) {
        animateOut('left', 'seen_disliked');
      } else if (e.translationY > DOWN_THRESHOLD) {
        animateOut('down', 'not_seen');
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(translateX.value, [-SCREEN_W, SCREEN_W], [-18, 18], Extrapolation.CLAMP);
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
      ],
      opacity: cardOpacity.value,
    };
  });

  const likeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD * 0.5], [0, 1], Extrapolation.CLAMP),
  }));
  const nopeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD * 0.5, 0], [1, 0], Extrapolation.CLAMP),
  }));
  const notSeenOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, DOWN_THRESHOLD * 0.5], [0, 1], Extrapolation.CLAMP),
  }));

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
      </View>
    );
  }

  const current = titles[currentIndex];
  const progress = titles.length > 0 ? currentIndex / titles.length : 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.logo}>StreamMatch</Text>
        <Text style={styles.counter}>{currentIndex + 1} / {titles.length}</Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <View style={styles.cardArea}>
        {current && (
          <GestureDetector gesture={gesture}>
            <Animated.View style={[styles.cardWrapper, cardStyle]}>
              {/* Overlay badges */}
              <Animated.View style={[styles.badge, styles.badgeLike, likeOpacity]}>
                <Text style={styles.badgeLikeText}>ME ENCANTÓ</Text>
              </Animated.View>
              <Animated.View style={[styles.badge, styles.badgeNope, nopeOpacity]}>
                <Text style={styles.badgeNopeText}>NO ME GUSTÓ</Text>
              </Animated.View>
              <Animated.View style={[styles.badge, styles.badgeNotSeen, notSeenOpacity]}>
                <Text style={styles.badgeNotSeenText}>NO LA VI</Text>
              </Animated.View>

              <TitlePoster title={current} />
            </Animated.View>
          </GestureDetector>
        )}
      </View>

      {/* Hints */}
      <View style={styles.hints}>
        {HINTS.map(h => (
          <View key={h.dir} style={styles.hint}>
            <Text style={[styles.hintDir, { color: h.color }]}>{h.dir}</Text>
            <Text style={styles.hintLabel}>{h.label}</Text>
          </View>
        ))}
      </View>

      {canSkip && (
        <View style={[styles.skipRow, { paddingBottom: insets.bottom + 8 }]}>
          <Text style={styles.skipText} onPress={handleFinish}>
            Saltar — ya tenés suficiente contexto →
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: Colors.sub, fontSize: Typography.body },
  errorText: { color: Colors.danger, fontSize: Typography.h3, fontWeight: Typography.bold },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  logo: { color: Colors.text, fontSize: Typography.h3, fontWeight: Typography.black },
  counter: { color: Colors.sub, fontSize: Typography.small },
  progressTrack: { height: 2, backgroundColor: Colors.border },
  progressFill: { height: 2, backgroundColor: Colors.accent },
  cardArea: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    justifyContent: 'flex-start',
  },
  cardWrapper: { width: '100%' },
  badge: {
    position: 'absolute',
    zIndex: 10,
    borderWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeLike: {
    top: 24,
    left: 20,
    borderColor: '#30c060',
    transform: [{ rotate: '-15deg' }],
  },
  badgeLikeText: { color: '#30c060', fontSize: 18, fontWeight: '800', letterSpacing: 1 },
  badgeNope: {
    top: 24,
    right: 20,
    borderColor: '#e04040',
    transform: [{ rotate: '15deg' }],
  },
  badgeNopeText: { color: '#e04040', fontSize: 18, fontWeight: '800', letterSpacing: 1 },
  badgeNotSeen: {
    bottom: 60,
    alignSelf: 'center',
    left: '30%',
    borderColor: Colors.sub,
  },
  badgeNotSeenText: { color: Colors.sub, fontSize: 18, fontWeight: '800', letterSpacing: 1 },
  hints: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 28,
    paddingVertical: 16,
  },
  hint: { alignItems: 'center', gap: 4 },
  hintDir: { fontSize: 20 },
  hintLabel: { color: Colors.faint, fontSize: Typography.tiny },
  skipRow: { alignItems: 'center', paddingTop: 4 },
  skipText: { color: Colors.sub, fontSize: Typography.small, padding: 8 },
});
