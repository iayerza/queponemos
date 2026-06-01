import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Colors, Typography } from '../constants/colors';
import { useMatchStore } from '../store/useMatchStore';
import { useColors } from '../context/ThemeContext';
import { useAuthStore } from '../store/useAuthStore';
import { useGroupStore } from '../store/useGroupStore';
import { setSessionMood, onGroupChange, clearGroupSession } from '../services/firebase';
import type { RootStackParamList } from '../navigation/types';
import type { MoodId } from '../services/claude';

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Mood'>;

const MOODS: { id: MoodId; emoji: string; label: string; desc: string }[] = [
  { id: 'chill',   emoji: '😌', label: 'Tranqui',     desc: 'Relajado, sin pensar mucho' },
  { id: 'intense', emoji: '🔥', label: 'Adrenalina',  desc: 'Tensión, al borde del asiento' },
  { id: 'laugh',   emoji: '😂', label: 'Reírse',      desc: 'Comedia, algo liviano' },
  { id: 'think',   emoji: '🧠', label: 'Reflexionar', desc: 'Algo que deje pensando' },
  { id: 'cry',     emoji: '😭', label: 'Emocionarse', desc: 'Drama, sentimientos' },
  { id: 'scared',  emoji: '😱', label: 'Asustarse',   desc: 'Terror o suspenso' },
];

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'true';

// ─── Pulsing dots animation ───────────────────────────────────────────────────
function PulsingDots() {
  const [count, setCount] = useState(1);
  useEffect(() => {
    const iv = setInterval(() => setCount(c => (c % 3) + 1), 500);
    return () => clearInterval(iv);
  }, []);
  return <Text style={dotStyles.dots}>{'.'.repeat(count)}</Text>;
}
const dotStyles = StyleSheet.create({
  dots: { color: Colors.accent, fontSize: 28, letterSpacing: 4, minWidth: 32 },
});

// ─── Mood card (shown in waiting view) ───────────────────────────────────────
function MoodCard({
  label, emoji, moodLabel, waiting,
}: {
  label: string; emoji: string; moodLabel: string; waiting?: boolean;
}) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!waiting) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.55, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [waiting]);

  return (
    <View style={[cardStyles.card, waiting && cardStyles.cardWaiting]}>
      <Text style={cardStyles.who}>{label}</Text>
      <Animated.Text style={[cardStyles.emoji, waiting && { opacity: pulse }]}>
        {emoji}
      </Animated.Text>
      <Text style={[cardStyles.mood, waiting && cardStyles.moodWaiting]}>{moodLabel}</Text>
    </View>
  );
}
const cardStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.s1,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.accentBorder,
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 12,
  },
  cardWaiting: { borderColor: Colors.border, backgroundColor: Colors.s2 },
  who:   { color: Colors.sub, fontSize: Typography.tiny, letterSpacing: 1, marginBottom: 12 },
  emoji: { fontSize: 40, marginBottom: 10 },
  mood:  { color: Colors.accent, fontWeight: Typography.bold, fontSize: Typography.small, textAlign: 'center' },
  moodWaiting: { color: Colors.sub },
});

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function MoodScreen() {
  const insets = useSafeAreaInsets();
  const nav    = useNavigation<Nav>();
  const route  = useRoute<Route>();
  const { user }         = useAuthStore();
  const { currentGroup } = useGroupStore();
  const { setMood, setSoloMode } = useMatchStore();
  const themeColors = useColors();

  const isSoloRoute = route.params.solo === true;
  const groupId = route.params.groupId ?? `solo-${user?.uid ?? 'anon'}`;
  const members = isSoloRoute ? (user ? [user.uid] : []) : (currentGroup?.members ?? []);
  const partnerUid = isSoloRoute ? null : (members.find(uid => uid !== user?.uid) ?? null);
  const isSolo = isSoloRoute || members.length <= 1;

  const [myMood,       setMyMood]       = useState<MoodId | null>(null);
  const [sessionMoods, setSessionMoods] = useState<Record<string, MoodId>>({});
  const [navigating,   setNavigating]   = useState(false);
  const [showSkip,     setShowSkip]     = useState(false);
  const [showContinue, setShowContinue] = useState(false);

  const myStoredMood  = user ? (sessionMoods[user.uid] ?? null) : null;
  const partnerMood   = partnerUid ? (sessionMoods[partnerUid] ?? null) : null;
  const allReady      = isSolo ? !!myStoredMood : !!(myStoredMood && partnerMood);

  const myMoodData      = (myMood ?? myStoredMood) ? MOODS.find(m => m.id === (myMood ?? myStoredMood)) : null;
  const partnerMoodData = partnerMood ? MOODS.find(m => m.id === partnerMood) : null;

  // Clear previous session moods when entering this screen
  useEffect(() => {
    const { clearMoods } = useMatchStore.getState();
    clearMoods();
    setSoloMode(isSoloRoute);
    // Clear local session state immediately to avoid stale moods
    setSessionMoods({});
    if (!USE_MOCK && !isSoloRoute && user && currentGroup?.createdBy === user.uid) {
      clearGroupSession(groupId).catch(() => {});
    }
  }, []);

  // Listen to Firestore session moods (solo mode skips this)
  useEffect(() => {
    if (USE_MOCK || isSoloRoute) return;
    const unsub = onGroupChange(groupId, g => {
      const moods = g.currentSession?.moods ?? {};
      setSessionMoods(moods);
    });
    return unsub;
  }, [groupId, isSoloRoute]);

  // Show skip button after 30s of waiting for partner
  useEffect(() => {
    if (!myMood || isSolo) return;
    const timer = setTimeout(() => setShowSkip(true), 30_000);
    return () => clearTimeout(timer);
  }, [myMood, isSolo]);

  // Show manual continue button after 8s if allReady but navigation hasn't fired
  useEffect(() => {
    if (!allReady || navigating || isSoloRoute) return;
    const timer = setTimeout(() => setShowContinue(true), 8_000);
    return () => clearTimeout(timer);
  }, [allReady, navigating, isSoloRoute]);

  // When both moods ready → sync to MatchStore and navigate
  useEffect(() => {
    if (!allReady || navigating || !myMood) return;
    setNavigating(true);
    // Push all session moods into MatchStore so useMatching can read them
    Object.entries(sessionMoods).forEach(([uid, mood]) => setMood(uid, mood));
    setTimeout(() => {
      nav.navigate('Matching', { groupId });
    }, 1400);
  }, [allReady, navigating, myMood, sessionMoods]);

  async function handleSelect(id: MoodId) {
    if (myMood || !user) return;
    setMyMood(id);
    setMood(user.uid, id);

    if (USE_MOCK) {
      setSessionMoods({ [user.uid]: id });
      if (partnerUid) {
        const mockMoods: MoodId[] = ['chill', 'laugh', 'intense', 'think', 'scared', 'cry'];
        const partnerMock = mockMoods[Math.floor(Math.random() * mockMoods.length)];
        setTimeout(() => {
          setSessionMoods({ [user.uid]: id, [partnerUid]: partnerMock });
        }, 2200);
      }
      return;
    }
    if (isSoloRoute) {
      setSessionMoods({ [user.uid]: id });
    } else {
      try {
        await setSessionMood(groupId, user.uid, id);
      } catch (e) {
        console.error('setSessionMood failed:', e);
      }
    }
  }

  // ── Waiting view (after mood picked) ───────────────────────────────────────
  if (myMood) {
    if (isSoloRoute) {
      return (
        <View style={[styles.root, { paddingTop: insets.top + 20, backgroundColor: themeColors.bg, alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={styles.waitTitle}>✨ Perfecto</Text>
          <Text style={styles.waitSub}>Claude está buscando algo para vos…</Text>
          <View style={[styles.readyBadge, { marginTop: 0, alignSelf: 'stretch' }]}>
            <Text style={styles.readyText}>{myMoodData?.emoji}  {myMoodData?.label}</Text>
            <Text style={styles.readySub}>Modo solo · tus plataformas</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.root, { paddingTop: insets.top + 20, backgroundColor: themeColors.bg }]}>
        <Text style={styles.waitTitle}>
          {allReady ? '¡Listos! ✨' : '¿Cómo está\ntu compañero?'}
        </Text>
        <Text style={styles.waitSub}>
          {allReady
            ? 'Claude está analizando los dos moods…'
            : 'Esperá que elija su mood esta noche'}
        </Text>

        <View style={styles.cards}>
          <MoodCard
            label="VOS"
            emoji={myMoodData?.emoji ?? ''}
            moodLabel={myMoodData?.label ?? ''}
          />

          <View style={styles.vsCol}>
            {allReady ? (
              <Text style={styles.vsReady}>✨</Text>
            ) : (
              <PulsingDots />
            )}
          </View>

          <MoodCard
            label="EL GRUPO"
            emoji={partnerMoodData?.emoji ?? '⏳'}
            moodLabel={partnerMoodData?.label ?? 'Eligiendo…'}
            waiting={!partnerMood}
          />
        </View>

        {showSkip && !allReady && (
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => nav.navigate('Matching', { groupId })}
          >
            <Text style={styles.skipText}>Omitir y continuar solo</Text>
          </TouchableOpacity>
        )}

        {allReady && (
          <View style={styles.readyBadge}>
            <Text style={styles.readyText}>
              {myMoodData?.emoji} {myMoodData?.label}  ×  {partnerMoodData?.emoji} {partnerMoodData?.label}
            </Text>
            <Text style={styles.readySub}>Claude va a encontrar algo perfecto para los dos</Text>
          </View>
        )}

        {showContinue && allReady && !navigating && (
          <TouchableOpacity
            style={styles.continueBtn}
            onPress={() => {
              setNavigating(true);
              Object.entries(sessionMoods).forEach(([uid, mood]) => setMood(uid, mood));
              nav.navigate('Matching', { groupId });
            }}
          >
            <Text style={styles.continueBtnText}>Continuar al análisis →</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // ── Picking view ────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: themeColors.bg }]}>
      <TouchableOpacity style={styles.back} onPress={() => nav.goBack()}>
        <Text style={styles.backText}>← VOLVER</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>
          {'¿Cómo estás\n'}
          <Text style={{ color: Colors.accent }}>esta noche?</Text>
        </Text>
        <Text style={styles.sub}>
          {isSoloRoute
            ? 'Claude va a encontrar algo perfecto para vos en tus plataformas.'
            : 'Tu compañero también va a elegir. Claude va a encontrar algo que les funcione a los dos.'}
        </Text>

        <View style={styles.grid}>
          {MOODS.map(m => (
            <TouchableOpacity
              key={m.id}
              style={styles.moodBtn}
              onPress={() => handleSelect(m.id)}
              activeOpacity={0.8}
            >
              <Text style={styles.moodEmoji}>{m.emoji}</Text>
              <Text style={styles.moodLabel}>{m.label}</Text>
              <Text style={styles.moodDesc}>{m.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  // Picking
  back:     { paddingHorizontal: 24, paddingVertical: 12 },
  backText: { color: Colors.sub, fontSize: Typography.tiny, fontWeight: Typography.semibold, letterSpacing: 1 },
  scroll:   { paddingHorizontal: 24, paddingBottom: 40 },
  title: {
    color: Colors.text,
    fontSize: Typography.hero,
    fontWeight: Typography.black,
    lineHeight: 40,
    marginBottom: 10,
    marginTop: 4,
  },
  sub: { color: Colors.sub, fontSize: Typography.body, marginBottom: 28, lineHeight: 22 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  moodBtn: {
    width: '47%',
    backgroundColor: Colors.s1,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  moodEmoji: { fontSize: 28, marginBottom: 8 },
  moodLabel: { color: Colors.text, fontWeight: Typography.bold, fontSize: Typography.body, marginBottom: 4 },
  moodDesc:  { color: Colors.sub, fontSize: Typography.tiny, lineHeight: 16 },

  // Waiting
  waitTitle: {
    color: Colors.text,
    fontSize: Typography.h1,
    fontWeight: Typography.black,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  waitSub: {
    color: Colors.sub,
    fontSize: Typography.body,
    textAlign: 'center',
    paddingHorizontal: 32,
    marginBottom: 40,
    lineHeight: 22,
  },
  cards: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 0,
    alignItems: 'center',
  },
  vsCol: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsReady: { fontSize: 24 },
  readyBadge: {
    marginTop: 36,
    marginHorizontal: 24,
    backgroundColor: Colors.accentFaint,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.accentBorder,
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  readyText: {
    color: Colors.accent,
    fontSize: Typography.body,
    fontWeight: Typography.bold,
    marginBottom: 6,
  },
  readySub: { color: Colors.sub, fontSize: Typography.small, textAlign: 'center', lineHeight: 18 },
  skipBtn: { marginTop: 24, alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 20 },
  skipText: { color: Colors.faint, fontSize: Typography.small, textDecorationLine: 'underline' },
  continueBtn: { marginTop: 20, marginHorizontal: 24, backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  continueBtnText: { color: '#fff', fontWeight: Typography.medium, fontSize: Typography.body },
});
