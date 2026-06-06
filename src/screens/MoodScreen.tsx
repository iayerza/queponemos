import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated, Alert,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Colors, Typography } from '../constants/colors';
import { useMatchStore } from '../store/useMatchStore';
import { useColors } from '../context/ThemeContext';
import { useAuthStore } from '../store/useAuthStore';
import { useGroupStore } from '../store/useGroupStore';
import { setSessionMood, onGroupChange } from '../services/firebase';
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

// ─── Member row (waiting view) ───────────────────────────────────────────────
function MemberRow({ name, moodData, isMe }: {
  name: string;
  moodData: typeof MOODS[number] | null | undefined;
  isMe: boolean;
}) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (moodData) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [!!moodData]);

  const initial = (name[0] ?? '?').toUpperCase();
  return (
    <View style={rowStyles.row}>
      <View style={[rowStyles.avatar, !!moodData && rowStyles.avatarReady]}>
        <Text style={rowStyles.avatarText}>{initial}</Text>
      </View>
      <View style={rowStyles.info}>
        <Text style={rowStyles.name}>{isMe ? 'Vos' : name}</Text>
        {moodData ? (
          <View style={rowStyles.moodPill}>
            <Feather name={moodData.icon} size={12} color={Colors.accent} />
            <Text style={rowStyles.moodLabel}>{moodData.label}</Text>
          </View>
        ) : (
          <Animated.Text style={[rowStyles.waiting, { opacity: pulse }]}>Eligiendo…</Animated.Text>
        )}
      </View>
      {moodData && <Feather name="check-circle" size={18} color={Colors.accent} />}
    </View>
  );
}
const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: Colors.s1,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 14,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.s2,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarReady: { borderColor: Colors.accentBorder, backgroundColor: Colors.accentFaint },
  avatarText: { color: Colors.sub, fontSize: Typography.small, fontWeight: Typography.bold },
  info: { flex: 1, gap: 3 },
  name: { color: Colors.text, fontSize: Typography.body, fontWeight: Typography.medium },
  moodPill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  moodLabel: { color: Colors.accent, fontSize: Typography.small },
  waiting: { color: Colors.faint, fontSize: Typography.small },
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

  const isSoloRoute = route.params.solo === true;
  const groupId = route.params.groupId ?? `solo-${user?.uid ?? 'anon'}`;
  // Cuando Person B llega via notificación, currentGroup puede ser null.
  // Buscamos el grupo por groupId en el store para no caer en modo solo accidentalmente.
  const group = isSoloRoute ? null : (groups.find(g => g.id === groupId) ?? currentGroup ?? null);
  const members = isSoloRoute ? (user ? [user.uid] : []) : (group?.members ?? []);
  const partnerUid = isSoloRoute ? null : (members.find(uid => uid !== user?.uid) ?? null);
  const isSolo = isSoloRoute || members.length <= 1;

  const [myMood,       setMyMood]       = useState<MoodId | null>(null);
  const [sessionMoods, setSessionMoods] = useState<Record<string, MoodId>>({});
  const [navigating,   setNavigating]   = useState(false);
  const [showSkip,     setShowSkip]     = useState(false);
  const [showContinue, setShowContinue] = useState(false);

  const partnerMood = partnerUid ? (sessionMoods[partnerUid] ?? null) : null;
  // allReady requires myMood (local pick this session) to avoid stale Firestore data
  // from a previous session triggering navigation before the user picks.
  const allReady    = isSolo ? !!myMood : !!(myMood && partnerMood);

  // Merge local pick immediately so the UI reflects our choice before the Firestore round-trip
  const effectiveMoods: Record<string, MoodId> = {
    ...sessionMoods,
    ...(myMood && user ? { [user.uid]: myMood } : {}),
  };
  const myMoodData = myMood ? MOODS.find(m => m.id === myMood) : null;

  // Resetear estado local + (re)suscribir a Firestore CADA vez que la pantalla
  // gana foco — no solo al montar.
  //
  // Con native-stack, navigate('Mood') cuando la pantalla ya está en el stack
  // hace pop a la instancia existente SIN remontarla, así que un useEffect([])
  // no vuelve a correr: quedarían myMood/sessionMoods de la sesión anterior y
  // handleSelect haría early-return (if (myMood) return), por lo que el mood
  // del usuario NUNCA se subiría a Firestore. Esto rompía el sync entre dos
  // usuarios al hacer una nueva búsqueda o usar el botón atrás de Android.
  //
  // Re-suscribir en el focus también garantiza que onSnapshot vuelva a emitir
  // el estado actual de Firestore (un listener persistente no re-emite en un
  // pop-to-existing).
  useFocusEffect(
    useCallback(() => {
      const { clearMoods } = useMatchStore.getState();
      clearMoods();
      setSoloMode(isSoloRoute);
      setMyMood(null);
      setSessionMoods({});
      setNavigating(false);
      setShowSkip(false);
      setShowContinue(false);
      // Si llegamos via notificación y currentGroup no está seteado, lo seteamos ahora
      if (!isSoloRoute && group && group.id !== currentGroup?.id) {
        setCurrentGroup(group);
      }

      if (USE_MOCK || isSoloRoute) return;

      const unsub = onGroupChange(groupId, g => {
        if (!g) {
          Alert.alert('Grupo eliminado', 'El creador eliminó este grupo.');
          nav.navigate('App');
          return;
        }
        setSessionMoods(g.currentSession?.moods ?? {});
      });
      return unsub;
    }, [groupId, isSoloRoute, group?.id])
  );

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

  // When all moods ready → sync to MatchStore and navigate
  useEffect(() => {
    if (!allReady || navigating || !myMood) return;
    setNavigating(true);
    Object.entries(effectiveMoods).forEach(([uid, mood]) => setMood(uid, mood));
    setTimeout(() => {
      nav.navigate('Matching', isSoloRoute ? { groupId, solo: true } : { groupId });
    }, 1400);
  }, [allReady, navigating, myMood]);

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

    const memberCount = members.length;
    return (
      <View style={[styles.root, { paddingTop: insets.top + 20, backgroundColor: themeColors.bg }]}>
        <Text style={styles.waitTitle}>
          {allReady ? '¡Listos!' : 'Esperando al grupo'}
        </Text>
        <Text style={styles.waitSub}>
          {allReady
            ? 'Queponemos está analizando los moods…'
            : 'Esperá que todos elijan su mood esta noche'}
        </Text>

        <View style={styles.memberList}>
          {members.map((uid, idx) => {
            const isMe = uid === user?.uid;
            const moodId = effectiveMoods[uid];
            const moodData = moodId ? MOODS.find(m => m.id === moodId) : null;
            const name = isMe
              ? (user?.displayName ?? 'Vos')
              : memberCount === 2
                ? 'Tu compañero'
                : `Miembro ${idx + 1}`;
            return (
              <MemberRow
                key={uid}
                name={name}
                moodData={moodData}
                isMe={isMe}
              />
            );
          })}
        </View>

        {allReady && (
          <View style={styles.readyBadge}>
            <Text style={styles.readyText}>
              {members.map(uid => MOODS.find(m => m.id === effectiveMoods[uid])?.label).filter(Boolean).join(' × ')}
            </Text>
            <Text style={styles.readySub}>
              {memberCount === 2
                ? 'Queponemos va a encontrar algo perfecto para los dos'
                : `Queponemos va a encontrar algo perfecto para los ${memberCount}`}
            </Text>
          </View>
        )}

        {showSkip && !allReady && (
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => nav.navigate('Matching', isSoloRoute ? { groupId, solo: true } : { groupId })}
          >
            <Text style={styles.skipText}>Omitir y continuar sin esperar</Text>
          </TouchableOpacity>
        )}

        {showContinue && allReady && !navigating && (
          <TouchableOpacity
            style={styles.continueBtn}
            onPress={() => {
              setNavigating(true);
              Object.entries(effectiveMoods).forEach(([uid, mood]) => setMood(uid, mood));
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
            : members.length === 2
              ? 'Tu compañero también va a elegir. Queponemos va a encontrar algo que les funcione a los dos.'
              : 'Cada miembro va a elegir su mood. Queponemos va a encontrar algo que les funcione a todos.'}
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
  memberList: {
    marginHorizontal: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
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
