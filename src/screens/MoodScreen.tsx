import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated, Alert,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import Svg, { Line } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Colors, Typography } from '../constants/colors';
import { useMatchStore } from '../store/useMatchStore';
import { useColors } from '../context/ThemeContext';
import { useAuthStore } from '../store/useAuthStore';
import { useGroupStore } from '../store/useGroupStore';
import { setSessionMood, onGroupChange, fetchMemberNames } from '../services/firebase';
import type { GroupDoc } from '../services/firebase';
import { sendMoodSelectedNotification, getGroupMemberTokens } from '../services/notifications';
import type { RootStackParamList } from '../navigation/types';
import type { MoodId } from '../services/claude';

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Mood'>;
type FeatherName = React.ComponentProps<typeof Feather>['name'];

const MOODS: { id: MoodId; icon: FeatherName; label: string; desc: string }[] = [
  { id: 'chill',   icon: 'wind',           label: 'Tranqui',     desc: 'Relajado, sin pensar mucho' },
  { id: 'intense', icon: 'zap',            label: 'Adrenalina',  desc: 'Tensión, al borde del asiento' },
  { id: 'laugh',   icon: 'smile',          label: 'Reírse',      desc: 'Comedia, algo liviano' },
  { id: 'think',   icon: 'book-open',      label: 'Reflexionar', desc: 'Algo que deje pensando' },
  { id: 'cry',     icon: 'cloud-rain',     label: 'Emocionarse', desc: 'Drama, sentimientos' },
  { id: 'scared',  icon: 'alert-triangle', label: 'Asustarse',   desc: 'Terror o suspenso' },
];

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'true';

// ─── Group mood orbit ────────────────────────────────────────────────────────
// Cada miembro es un nodo que orbita el núcleo central, conectado por una línea.
// Mientras elige: nodo tenue pulsante con su inicial. Cuando elige: se ilumina con
// el ícono de su mood y la línea al centro se enciende. Escala a cualquier N.
interface OrbitMember { uid: string; name: string; mood: MoodId | null; isMe: boolean }

function GroupMoodOrbit({
  members, allReady, total, readyCount,
}: {
  members: OrbitMember[]; allReady: boolean; total: number; readyCount: number;
}) {
  const SIZE = 300;
  const C = SIZE / 2;
  const R = 104;
  const NODE = 56;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.5, duration: 850, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,   duration: 850, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const positions = members.map((m, i) => {
    const angle = (-90 + (360 / Math.max(members.length, 1)) * i) * (Math.PI / 180);
    return { m, x: C + R * Math.cos(angle), y: C + R * Math.sin(angle) };
  });

  return (
    <View style={{ width: SIZE, height: SIZE, alignSelf: 'center' }}>
      <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
        {positions.map(({ m, x, y }) => (
          <Line
            key={m.uid}
            x1={C} y1={C} x2={x} y2={y}
            stroke={m.mood ? Colors.accent : Colors.border}
            strokeWidth={m.mood ? 2 : 1}
          />
        ))}
      </Svg>

      {/* Núcleo central */}
      <View style={orbitStyles.core}>
        {allReady ? (
          <Feather name="star" size={30} color={Colors.accent} />
        ) : (
          <>
            <Text style={orbitStyles.coreCount}>{readyCount}/{total}</Text>
            <Text style={orbitStyles.coreLabel}>listos</Text>
          </>
        )}
      </View>

      {/* Nodos de miembros */}
      {positions.map(({ m, x, y }) => {
        const moodData = m.mood ? MOODS.find(mm => mm.id === m.mood) : null;
        const waiting = !m.mood;
        const initial = (m.name || (m.isMe ? 'Vos' : 'M')).charAt(0).toUpperCase();
        return (
          <Animated.View
            key={m.uid}
            style={[
              orbitStyles.node,
              { left: x - NODE / 2, top: y - NODE / 2, width: NODE },
              waiting && { opacity: pulse },
            ]}
          >
            <View style={[orbitStyles.nodeCircle, { width: NODE, height: NODE, borderRadius: NODE / 2 }, !!m.mood && orbitStyles.nodeCircleReady]}>
              {moodData
                ? <Feather name={moodData.icon} size={24} color={Colors.accent} />
                : <Text style={orbitStyles.nodeInitial}>{initial}</Text>}
            </View>
            <Text numberOfLines={1} style={[orbitStyles.nodeName, m.isMe && orbitStyles.nodeNameMe]}>
              {m.isMe ? 'Vos' : (m.name || 'Miembro')}
            </Text>
          </Animated.View>
        );
      })}
    </View>
  );
}
const orbitStyles = StyleSheet.create({
  core: {
    position: 'absolute',
    left: 150 - 42, top: 150 - 42,
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: Colors.accentFaint,
    borderWidth: 1.5, borderColor: Colors.accentBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  coreCount: { color: Colors.accent, fontSize: Typography.h1, fontWeight: Typography.bold },
  coreLabel: { color: Colors.sub, fontSize: Typography.tiny, marginTop: -2 },
  node: { position: 'absolute', alignItems: 'center' },
  nodeCircle: {
    backgroundColor: Colors.s2,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  nodeCircleReady: { backgroundColor: Colors.accentFaint, borderColor: Colors.accentBorder },
  nodeInitial: { color: Colors.sub, fontSize: Typography.h3, fontWeight: Typography.bold },
  nodeName: { color: Colors.sub, fontSize: Typography.tiny, marginTop: 6, maxWidth: 72, textAlign: 'center' },
  nodeNameMe: { color: Colors.text },
});

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function MoodScreen() {
  const insets = useSafeAreaInsets();
  const nav    = useNavigation<Nav>();
  const route  = useRoute<Route>();
  const { user }         = useAuthStore();
  const { groups, currentGroup, setCurrentGroup } = useGroupStore();
  const { setMood, setSoloMode } = useMatchStore();
  const themeColors = useColors();

  const isSoloRoute = route.params?.solo === true;
  const groupId = route.params?.groupId ?? `solo-${user?.uid ?? 'anon'}`;
  // Cuando Person B llega via notificación, currentGroup puede ser null.
  // Buscamos el grupo por groupId en el store para no caer en modo solo accidentalmente.
  const group = isSoloRoute ? null : (groups.find(g => g.id === groupId) ?? currentGroup ?? null);

  const [myMood,       setMyMood]       = useState<MoodId | null>(null);
  const [sessionMoods, setSessionMoods] = useState<Record<string, MoodId>>({});
  const [liveGroup,    setLiveGroup]    = useState<GroupDoc | null>(null);
  const [memberNames,  setMemberNames]  = useState<Record<string, string>>({});
  const [navigating,   setNavigating]   = useState(false);
  const [showSkip,     setShowSkip]     = useState(false);
  const [showContinue, setShowContinue] = useState(false);

  // Members come from the live Firestore snapshot first (always fresh, even for a guest
  // who arrived via notification before the store loaded), then the store as fallback.
  const members = isSoloRoute ? (user ? [user.uid] : []) : (liveGroup?.members ?? group?.members ?? []);
  const otherMembers = members.filter(uid => uid !== user?.uid);
  const isSolo = isSoloRoute || members.length <= 1;

  // Merge my locally-picked mood immediately so my own node lights up without waiting
  // for the Firestore listener round-trip.
  const effectiveMoods = (myMood && user)
    ? { ...sessionMoods, [user.uid]: myMood }
    : sessionMoods;

  const myStoredMood = user ? (effectiveMoods[user.uid] ?? null) : null;
  // Partner mood (for the 2-person header copy) — scan moods directly.
  const partnerMood  = !isSoloRoute
    ? (Object.entries(effectiveMoods).find(([uid]) => uid !== user?.uid)?.[1] ?? null)
    : null;
  // allReady: solo mode needs only my pick; group mode needs every known member to have
  // picked. members.length > 1 guards against an empty/not-yet-loaded member list.
  const readyCount = members.filter(uid => !!effectiveMoods[uid]).length;
  const allReady = isSoloRoute
    ? !!myMood
    : (!!myMood && members.length > 1 && members.every(uid => !!effectiveMoods[uid]));

  // Orbit nodes: me first (top), then the rest in order.
  const orbitMembers: OrbitMember[] = user
    ? [user.uid, ...otherMembers].map(uid => ({
        uid,
        name: memberNames[uid] ?? '',
        mood: effectiveMoods[uid] ?? null,
        isMe: uid === user.uid,
      }))
    : [];

  const myMoodData      = (myMood ?? myStoredMood) ? MOODS.find(m => m.id === (myMood ?? myStoredMood)) : null;
  const partnerMoodData = partnerMood ? MOODS.find(m => m.id === partnerMood) : null;

  // Limpiar estado local al entrar a esta pantalla
  // (clearGroupSession se llama desde GroupScreen antes de navegar — no acá)
  useEffect(() => {
    const { clearMoods } = useMatchStore.getState();
    clearMoods();
    setSoloMode(isSoloRoute);
    setSessionMoods({});
    // Si llegamos via notificación y currentGroup no está seteado, lo seteamos ahora
    if (!isSoloRoute && group && group.id !== currentGroup?.id) {
      setCurrentGroup(group);
    }
  }, []);

  // Listen to Firestore session moods (solo mode skips this)
  useEffect(() => {
    if (USE_MOCK || isSoloRoute) return;
    const unsub = onGroupChange(groupId, g => {
      if (!g) {
        Alert.alert('Grupo eliminado', 'El creador eliminó este grupo.');
        nav.navigate('App');
        return;
      }
      setLiveGroup(g);
      const moods = g.currentSession?.moods ?? {};
      setSessionMoods(moods);
    });
    return unsub;
  }, [groupId, isSoloRoute]);

  // Fetch member display names for the orbit nodes
  useEffect(() => {
    if (USE_MOCK || isSoloRoute || members.length === 0) return;
    fetchMemberNames(members).then(setMemberNames).catch(() => {});
  }, [members.join(',')]);

  // Show skip button after 30s of waiting for partner
  useEffect(() => {
    if (!myMood || isSoloRoute) return;
    const timer = setTimeout(() => setShowSkip(true), 30_000);
    return () => clearTimeout(timer);
  }, [myMood, isSoloRoute]);

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
    Object.entries(sessionMoods).forEach(([uid, mood]) => setMood(uid, mood));
    setTimeout(() => {
      nav.navigate('Matching', isSoloRoute ? { groupId, solo: true } : { groupId });
    }, 1400);
  }, [allReady, navigating, myMood, sessionMoods]);

  async function handleSelect(id: MoodId) {
    if (myMood || !user) return;
    setMyMood(id);
    setMood(user.uid, id);

    if (USE_MOCK) {
      // Simulate every other member picking a random mood after a short delay.
      const base = { [user.uid]: id };
      setSessionMoods(base);
      if (otherMembers.length > 0) {
        const mockMoods: MoodId[] = ['chill', 'laugh', 'intense', 'think', 'scared', 'cry'];
        setTimeout(() => {
          const filled = { ...base };
          otherMembers.forEach(uid => {
            filled[uid] = mockMoods[Math.floor(Math.random() * mockMoods.length)];
          });
          setSessionMoods(filled);
        }, 2200);
      }
      return;
    }
    if (isSoloRoute) {
      setSessionMoods({ [user.uid]: id });
    } else {
      try {
        await setSessionMood(groupId, user.uid, id);
        const tokens = await getGroupMemberTokens(members, user.uid);
        if (tokens.length > 0) {
          sendMoodSelectedNotification(tokens[0], user.displayName ?? 'Tu compañero', groupId).catch(() => {});
        }
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
          <Text style={styles.waitTitle}>Perfecto</Text>
          <Text style={styles.waitSub}>Queponemos está buscando algo para vos…</Text>
          <View style={[styles.readyBadge, { marginTop: 0, alignSelf: 'stretch' }]}>
            <Text style={styles.readyText}>{myMoodData?.label}</Text>
            <Text style={styles.readySub}>Modo solo · tus plataformas</Text>
          </View>
        </View>
      );
    }

    const waitingCount = members.length - readyCount;
    const headerTitle = allReady
      ? '¡Listos!'
      : (otherMembers.length === 1 ? '¿Cómo está\ntu compañero?' : 'Esperando\nal grupo');
    const headerSub = allReady
      ? `Queponemos está analizando los ${members.length} moods…`
      : (otherMembers.length === 1
          ? 'Esperá que elija su mood esta noche'
          : `Faltan ${waitingCount} por elegir su mood`);

    return (
      <View style={[styles.root, { paddingTop: insets.top + 20, backgroundColor: themeColors.bg }]}>
        <Text style={styles.waitTitle}>{headerTitle}</Text>
        <Text style={styles.waitSub}>{headerSub}</Text>

        <GroupMoodOrbit
          members={orbitMembers}
          allReady={allReady}
          total={members.length}
          readyCount={readyCount}
        />

        {showSkip && !allReady && (
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => nav.navigate('Matching', isSoloRoute ? { groupId, solo: true } : { groupId })}
          >
            <Text style={styles.skipText}>Omitir y continuar solo</Text>
          </TouchableOpacity>
        )}

        {allReady && (
          <View style={styles.readyBadge}>
            <Text style={styles.readyText}>
              {otherMembers.length === 1
                ? `${myMoodData?.label}  ×  ${partnerMoodData?.label}`
                : `${members.length} moods listos`}
            </Text>
            <Text style={styles.readySub}>
              {otherMembers.length === 1
                ? 'Queponemos va a encontrar algo perfecto para los dos'
                : 'Queponemos va a encontrar algo para todo el grupo'}
            </Text>
          </View>
        )}

        {showContinue && allReady && !navigating && (
          <TouchableOpacity
            style={styles.continueBtn}
            onPress={() => {
              setNavigating(true);
              Object.entries(sessionMoods).forEach(([uid, mood]) => setMood(uid, mood));
              nav.navigate('Matching', isSoloRoute ? { groupId, solo: true } : { groupId });
            }}
          >
            <Text style={styles.continueBtnText}>Continuar al análisis</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // ── Picking view ────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: themeColors.bg }]}>
      <TouchableOpacity style={styles.back} onPress={() => nav.goBack()}>
        <Feather name="arrow-left" size={18} color={Colors.sub} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>
          {'¿Cómo estás\n'}
          <Text style={{ color: Colors.accent }}>esta noche?</Text>
        </Text>
        <Text style={styles.sub}>
          {isSoloRoute
            ? 'Queponemos va a encontrar algo perfecto para vos en tus plataformas.'
            : 'Tu compañero también va a elegir. Queponemos va a encontrar algo que les funcione a los dos.'}
        </Text>

        <View style={styles.grid}>
          {MOODS.map(m => (
            <TouchableOpacity
              key={m.id}
              style={styles.moodBtn}
              onPress={() => handleSelect(m.id)}
              activeOpacity={0.8}
            >
              <Feather name={m.icon} size={28} color={Colors.sub} style={styles.moodIcon} />
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
  back: { paddingHorizontal: 24, paddingVertical: 12, alignSelf: 'flex-start' },
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
  moodIcon: { marginBottom: 8 },
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
