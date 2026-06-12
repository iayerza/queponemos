import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  ScrollView, Animated, FlatList,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Colors, Typography } from '../constants/colors';
import { useColors } from '../context/ThemeContext';
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

type GenreOption = { name: string; icon: keyof typeof Feather.glyphMap };

const GENRE_OPTIONS: GenreOption[] = [
  { name: 'Acción',          icon: 'zap'            },
  { name: 'Comedia',         icon: 'smile'           },
  { name: 'Drama',           icon: 'heart'           },
  { name: 'Thriller',        icon: 'eye'             },
  { name: 'Ciencia Ficción', icon: 'cpu'             },
  { name: 'Romance',         icon: 'gift'            },
  { name: 'Crimen',          icon: 'shield'          },
  { name: 'Aventura',        icon: 'compass'         },
  { name: 'Terror',          icon: 'alert-triangle'  },
  { name: 'Animación',       icon: 'film'            },
  { name: 'Documental',      icon: 'camera'          },
  { name: 'Historia',        icon: 'book-open'       },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const nav    = useNavigation<Nav>();
  const route  = useRoute<Route>();
  const { user, updateRatings, markOnboardingDone, setAgeRange } = useAuthStore();
  const themeColors = useColors();
  const ageRange    = route.params?.ageRange;
  const tone        = route.params?.tone;
  const fromProfile = route.params?.fromProfile === true;

  const {
    titles, currentIndex, ratings, isLoading, error,
    rate, canSkip, isFinished,
    genreStepDone, confirmGenres,
    canExtend, pendingDoubts, extend, declineExtend, target,
  } = useOnboarding(ageRange, tone, fromProfile);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

  useEffect(() => {
    if (user?.onboardingDone && !fromProfile) {
      nav.reset({ index: 0, routes: [{ name: 'App' }] });
    }
  }, [user?.onboardingDone]);

  function handleFinish() {
    if (!user) return;
    if (ageRange) setAgeRange(ageRange);
    if (!USE_MOCK) completeOnboarding(user.uid, ageRange).catch(() => {});
    if (fromProfile) nav.navigate('App');
    else markOnboardingDone();
  }

  function handleRate(r: Parameters<typeof rate>[0]) {
    const title = titles[currentIndex];
    if (!title || !user) return;
    fadeAnim.setValue(0);
    updateRatings(title.tmdbId, r);
    if (!USE_MOCK) rateTitleAndUpdateProfile(user.uid, title.tmdbId, r, title).catch(() => {});
    rate(r);
    Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }

  useEffect(() => { if (isFinished) handleFinish(); }, [isFinished]);

  function toggleGenre(name: string) {
    setSelectedGenres(prev => prev.includes(name) ? prev.filter(g => g !== name) : [...prev, name]);
  }

  // ── Paso 1: selector de géneros ──────────────────────────────────────────────
  if (!genreStepDone) {
    const canConfirm = selectedGenres.length > 0;
    return (
      <View style={[styles.root, { paddingTop: insets.top, backgroundColor: themeColors.bg }]}>
        <View style={styles.header}>
          <LogoWordmark markSize={18} />
          <TouchableOpacity onPress={handleFinish} hitSlop={12}>
            <Text style={styles.skipHeaderText}>Más tarde</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          contentContainerStyle={[styles.genreScroll, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.genreEyebrow}>TUS GÉNEROS</Text>
          <Text style={styles.genreHeading}>¿Qué te gusta ver?</Text>
          <Text style={styles.genreSub}>
            Elegí uno o más géneros. Usamos esto para mostrarte títulos que te resulten conocidos.
          </Text>
          <View style={styles.genreGrid}>
            {GENRE_OPTIONS.map(opt => {
              const active = selectedGenres.includes(opt.name);
              return (
                <TouchableOpacity
                  key={opt.name}
                  style={[styles.genreChip, active && styles.genreChipActive]}
                  onPress={() => toggleGenre(opt.name)}
                  activeOpacity={0.8}
                >
                  <Feather name={opt.icon} size={14} color={active ? Colors.accent : Colors.faint} />
                  <Text style={[styles.genreChipText, active && styles.genreChipTextActive]}>
                    {opt.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
        <View style={[styles.continueBtnWrap, { paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity
            style={[styles.continueBtn, !canConfirm && styles.continueBtnDisabled]}
            onPress={() => canConfirm && confirmGenres(selectedGenres)}
            activeOpacity={0.85}
          >
            <Text style={styles.continueBtnText}>
              {canConfirm ? 'Empezar →' : 'Seleccioná al menos uno'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Cargando ─────────────────────────────────────────────────────────────────
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

  const current      = titles[currentIndex];
  const progressPct  = titles.length > 0 ? (currentIndex / titles.length) * 100 : 0;
  const milestonePct = (MIN_TO_SKIP / TOTAL) * 100;
  const remaining    = MIN_TO_SKIP - currentIndex;

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: themeColors.bg }]}>
      <View style={styles.header}>
        <LogoWordmark markSize={18} />
        <View style={styles.headerRight}>
          <Text style={styles.counter}>
            {currentIndex}<Text style={styles.counterTotal}>/{target}</Text>
          </Text>
          <TouchableOpacity onPress={handleFinish} hitSlop={12}>
            <Text style={styles.skipHeaderText}>Más tarde</Text>
          </TouchableOpacity>
        </View>
      </View>

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
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: (canSkip && !canExtend) ? 88 + insets.bottom : insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {canExtend && (
          <View style={styles.extendBox}>
            <Text style={styles.extendTitle}>¿Querés calificar más?</Text>
            <Text style={styles.extendSub}>
              Algunos géneros necesitan más datos para recomendarte mejor:
            </Text>
            <FlatList
              data={pendingDoubts}
              keyExtractor={g => g}
              horizontal
              scrollEnabled={false}
              contentContainerStyle={styles.doubtChips}
              renderItem={({ item }) => (
                <View style={styles.doubtChip}><Text style={styles.doubtChipText}>{item}</Text></View>
              )}
            />
            <View style={styles.extendActions}>
              <TouchableOpacity style={styles.extendBtn} onPress={extend} activeOpacity={0.85}>
                <Text style={styles.extendBtnText}>Calificar 10 más</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.extendSkipBtn} onPress={declineExtend} activeOpacity={0.8}>
                <Text style={styles.extendSkipText}>No, ya estoy</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

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
      </ScrollView>

      {canSkip && !canExtend && (
        <View style={[styles.continueBtnWrap, { paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity style={styles.continueBtn} onPress={handleFinish} activeOpacity={0.85}>
            <Text style={styles.continueBtnText}>Continuar →</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  loadingText: { color: Colors.sub, fontSize: Typography.body },
  errorText: { color: Colors.danger, fontSize: Typography.h3, fontWeight: Typography.bold, textAlign: 'center' },
  errorSub: { color: Colors.sub, fontSize: Typography.small, textAlign: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 12 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  counter: { color: Colors.text, fontSize: Typography.h3, fontWeight: Typography.medium },
  counterTotal: { color: Colors.faint, fontWeight: Typography.regular },
  skipHeaderText: { color: Colors.faint, fontSize: Typography.body },

  progressWrap: { paddingHorizontal: 24, marginBottom: 16 },
  progressTrack: { height: 5, backgroundColor: Colors.s2, borderRadius: 3, overflow: 'visible', marginBottom: 8 },
  progressFill: { height: 5, backgroundColor: Colors.accent, borderRadius: 3 },
  milestoneMark: { position: 'absolute', top: -3, width: 2, height: 11, backgroundColor: Colors.border, borderRadius: 1, marginLeft: -1 },
  progressHint: { color: Colors.faint, fontSize: Typography.small },

  scroll: { paddingHorizontal: 24, paddingTop: 4 },
  ratingSection: { marginTop: 16, gap: 10 },
  continueBtnWrap: { paddingHorizontal: 24, paddingTop: 12, backgroundColor: Colors.bg },
  continueBtn: { backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  continueBtnDisabled: { opacity: 0.4 },
  continueBtnText: { color: '#fff', fontSize: Typography.body, fontWeight: Typography.medium },

  // Selector de géneros
  genreScroll: { paddingHorizontal: 24, paddingTop: 8 },
  genreEyebrow: { color: Colors.faint, fontSize: Typography.tiny, fontWeight: Typography.medium, letterSpacing: 2, marginTop: 8 },
  genreHeading: { color: Colors.text, fontSize: Typography.h1, fontWeight: Typography.bold, marginTop: 8, marginBottom: 4 },
  genreSub: { color: Colors.sub, fontSize: Typography.small, lineHeight: 20, marginBottom: 20 },
  genreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  genreChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.s1, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 10 },
  genreChipActive: { borderColor: Colors.accentBorder, backgroundColor: Colors.accentFaint },
  genreChipText: { color: Colors.sub, fontSize: Typography.small },
  genreChipTextActive: { color: Colors.accent },

  // Extensión
  extendBox: { backgroundColor: Colors.s1, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 16, marginBottom: 20 },
  extendTitle: { color: Colors.text, fontSize: Typography.h3, fontWeight: Typography.bold, marginBottom: 4 },
  extendSub: { color: Colors.sub, fontSize: Typography.small, marginBottom: 10, lineHeight: 18 },
  doubtChips: { gap: 6 },
  doubtChip: { backgroundColor: Colors.accentFaint, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: Colors.accentBorder },
  doubtChipText: { color: Colors.accent, fontSize: Typography.tiny },
  extendActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  extendBtn: { flex: 1, backgroundColor: Colors.accent, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  extendBtnText: { color: '#fff', fontSize: Typography.small, fontWeight: Typography.medium },
  extendSkipBtn: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  extendSkipText: { color: Colors.sub, fontSize: Typography.small },
});
