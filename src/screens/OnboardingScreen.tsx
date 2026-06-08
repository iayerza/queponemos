import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Animated,
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
import { completeOnboarding, rateTitleAndUpdateProfile, saveInitialGenrePreferences } from '../services/firebase';
import type { RootStackParamList } from '../navigation/types';

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'true';
const MIN_TO_SKIP = 8;
const TOTAL = 20;

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Onboarding'>;

type FeatherName = React.ComponentProps<typeof Feather>['name'];

const GENRE_OPTIONS: { label: string; icon: FeatherName }[] = [
  { label: 'Acción',          icon: 'zap'            },
  { label: 'Aventura',        icon: 'compass'        },
  { label: 'Animación',       icon: 'play-circle'    },
  { label: 'Comedia',         icon: 'smile'          },
  { label: 'Crimen',          icon: 'shield'         },
  { label: 'Documental',      icon: 'video'          },
  { label: 'Drama',           icon: 'book-open'      },
  { label: 'Familia',         icon: 'users'          },
  { label: 'Fantasía',        icon: 'star'           },
  { label: 'Historia',        icon: 'clock'          },
  { label: 'Terror',          icon: 'alert-triangle' },
  { label: 'Misterio',        icon: 'search'         },
  { label: 'Romance',         icon: 'heart'          },
  { label: 'Ciencia Ficción', icon: 'cpu'            },
  { label: 'Thriller',        icon: 'eye'            },
  { label: 'Bélica',          icon: 'target'         },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const nav   = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { user, updateRatings, markOnboardingDone, setAgeRange } = useAuthStore();
  const themeColors = useColors();
  const ageRange = route.params?.ageRange;
  const fromProfile = route.params?.fromProfile === true;

  // Genre step state (local — not stored in hook until confirmed)
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

  const {
    titles, currentIndex, ratings, isLoading, error,
    rate, canSkip, isFinished, genreStepDone, confirmGenres,
  } = useOnboarding(ageRange, fromProfile);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (user?.onboardingDone && !fromProfile) {
      nav.reset({ index: 0, routes: [{ name: 'App' }] });
    }
  }, [user?.onboardingDone]);

  function handleFinish() {
    if (!user) return;
    if (ageRange) setAgeRange(ageRange);
    if (!USE_MOCK) completeOnboarding(user.uid, ageRange).catch(() => {});
    if (fromProfile) {
      nav.navigate('App');
    } else {
      markOnboardingDone();
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

  function toggleGenre(genre: string) {
    setSelectedGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  }

  function handleConfirmGenres() {
    confirmGenres(selectedGenres);
    if (!USE_MOCK && user && selectedGenres.length > 0) {
      saveInitialGenrePreferences(user.uid, selectedGenres).catch(() => {});
    }
  }

  useEffect(() => {
    if (isFinished) handleFinish();
  }, [isFinished]);

  // ── Genre selection step ─────────────────────────────────────────────────────
  if (!genreStepDone) {
    return (
      <View style={[styles.root, { paddingTop: insets.top, backgroundColor: themeColors.bg }]}>
        <View style={styles.header}>
          <LogoWordmark markSize={18} />
          <Text style={styles.stepLabel}>Paso 1 de 2</Text>
        </View>

        <ScrollView contentContainerStyle={[styles.genreScroll, { paddingBottom: insets.bottom + 80 }]} showsVerticalScrollIndicator={false}>
          <Text style={styles.genreTitle}>
            {'¿Qué géneros\n'}
            <Text style={{ color: Colors.accent }}>te gustan?</Text>
          </Text>
          <Text style={styles.genreSub}>
            Elegí uno o más. Queponemos los usa para mostrarte títulos más relevantes para vos.
          </Text>

          <View style={styles.genreGrid}>
            {GENRE_OPTIONS.map(g => {
              const selected = selectedGenres.includes(g.label);
              return (
                <TouchableOpacity
                  key={g.label}
                  style={[styles.genreChip, selected && styles.genreChipSelected]}
                  onPress={() => toggleGenre(g.label)}
                  activeOpacity={0.75}
                >
                  <Feather
                    name={g.icon}
                    size={18}
                    color={selected ? Colors.accent : Colors.sub}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={[styles.genreChipLabel, selected && styles.genreChipLabelSelected]}>
                    {g.label}
                  </Text>
                  {selected && (
                    <Feather name="check" size={14} color={Colors.accent} style={{ marginLeft: 'auto' }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <View style={[styles.genreFooter, { paddingBottom: insets.bottom + 8 }]}>
          {selectedGenres.length === 0 && (
            <TouchableOpacity onPress={() => confirmGenres([])} style={styles.skipGenreBtn}>
              <Text style={styles.skipGenreText}>Saltear este paso</Text>
            </TouchableOpacity>
          )}
          {selectedGenres.length > 0 && (
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirmGenres} activeOpacity={0.85}>
              <Text style={styles.confirmBtnText}>
                Continuar con {selectedGenres.length} {selectedGenres.length === 1 ? 'género' : 'géneros'} →
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // ── Loading state ────────────────────────────────────────────────────────────
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

  // ── Title rating step ────────────────────────────────────────────────────────
  const current = titles[currentIndex];
  const progressPct = titles.length > 0 ? (currentIndex / titles.length) * 100 : 0;
  const milestonePct = (MIN_TO_SKIP / TOTAL) * 100;
  const remaining = MIN_TO_SKIP - currentIndex;

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: themeColors.bg }]}>

      <View style={styles.header}>
        <LogoWordmark markSize={18} />
        <View style={styles.headerRight}>
          <Text style={styles.counter}>{currentIndex}<Text style={styles.counterTotal}>/{titles.length}</Text></Text>
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
        contentContainerStyle={[styles.scroll, { paddingBottom: canSkip ? 88 + insets.bottom : insets.bottom + 24 }]}
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
      </ScrollView>

      {canSkip && (
        <View style={[styles.continueBtnWrap, { paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity style={styles.confirmBtn} onPress={handleFinish} activeOpacity={0.85}>
            <Text style={styles.confirmBtnText}>Continuar →</Text>
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

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  stepLabel: { color: Colors.faint, fontSize: Typography.small },
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
  progressFill: { height: 5, backgroundColor: Colors.accent, borderRadius: 3 },
  milestoneMark: {
    position: 'absolute',
    top: -3,
    width: 2,
    height: 11,
    backgroundColor: Colors.border,
    borderRadius: 1,
    marginLeft: -1,
  },
  progressHint: { color: Colors.faint, fontSize: Typography.small },

  scroll: { paddingHorizontal: 24, paddingTop: 4 },
  ratingSection: { marginTop: 16, gap: 10 },
  continueBtnWrap: { paddingHorizontal: 24, paddingTop: 12, backgroundColor: Colors.bg },

  // Genre step
  genreScroll: { paddingHorizontal: 24, paddingTop: 8 },
  genreTitle: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: Typography.medium,
    lineHeight: 38,
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  genreSub: {
    color: Colors.sub,
    fontSize: Typography.body,
    lineHeight: 22,
    marginBottom: 24,
  },
  genreGrid: { gap: 10 },
  genreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.s1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  genreChipSelected: {
    borderColor: Colors.accentBorder,
    backgroundColor: Colors.accentFaint,
  },
  genreChipLabel: {
    color: Colors.sub,
    fontSize: Typography.body,
    fontWeight: Typography.medium,
  },
  genreChipLabelSelected: { color: Colors.accent },
  genreFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: Colors.bg,
  },
  skipGenreBtn: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 20 },
  skipGenreText: { color: Colors.faint, fontSize: Typography.small, textDecorationLine: 'underline' },
  confirmBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmBtnText: { color: '#fff', fontSize: Typography.body, fontWeight: Typography.medium },
});
