import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, Alert, Image, Animated, Easing,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Ellipse } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Typography } from '../constants/colors';
import { useColors } from '../context/ThemeContext';
import { LogoMark, LogoWordmark } from '../components/Logo';
import GroupCard from '../components/GroupCard';
import PlatformLogo from '../components/PlatformLogo';
import { useAuthStore } from '../store/useAuthStore';
import { useGroupStore } from '../store/useGroupStore';
import { useMatchStore } from '../store/useMatchStore';
import { getPosterUrl } from '../services/tmdb';
import type { RootStackParamList } from '../navigation/types';
import {
  createGroup, joinGroupByCode, updateUserPlatforms,
  getPersonalWatchlist, getPendingRatingsForUser,
  type PersonalWatchlistItem,
} from '../services/firebase';
import QRScanner from '../components/QRScanner';
import { PLATFORMS } from '../constants/platforms';
import type { PlatformId } from '../constants/platforms';
import { MOCK_GROUP } from '../utils/mock';

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'true';
type Nav = NativeStackNavigationProp<RootStackParamList>;

const POSTER_W = 144;
const POSTER_H = 216;

interface PosterItem { posterPath: string | null; title: string; platform: PlatformId; matchId?: string }

export default function HomeScreen() {
  const insets  = useSafeAreaInsets();
  const nav     = useNavigation<Nav>();
  const { user, setPlatforms }                                                        = useAuthStore();
  const { groups, addGroup, setCurrentGroup, pendingInviteCode, setPendingInviteCode } = useGroupStore();
  const { history, setCurrentMatch, setSoloMode }                                    = useMatchStore();
  const themeColors = useColors();
  const firstName    = user?.displayName?.split(' ')[0] ?? '';
  const avatarLetter = firstName.charAt(0).toUpperCase() || '?';

  const [createModal,       setCreateModal]       = useState(false);
  const [joinModal,         setJoinModal]         = useState(false);
  const [groupName,         setGroupName]         = useState('');
  const [joinCode,          setJoinCode]          = useState('');
  const [selPlatforms,      setSelPlatforms]      = useState<PlatformId[]>(['netflix']);
  const [working,           setWorking]           = useState(false);
  const [scannerVisible,    setScannerVisible]    = useState(false);
  const [soloPlatformModal, setSoloPlatformModal] = useState(false);
  const [soloPlatforms,     setSoloPlatforms]     = useState<PlatformId[]>([]);
  const [watchlist,         setWatchlist]         = useState<PersonalWatchlistItem[]>([]);
  const [pendingCount,      setPendingCount]      = useState(0);
  const [notifDismissed,    setNotifDismissed]    = useState(false);

  // ── Animated sliding header ──────────────────────────────────────────────
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const lastScrollYRef   = useRef(0);
  const headerVisRef     = useRef(true);
  const [headerHeight, setHeaderHeight] = useState(insets.top + 68);

  const handleScroll = useCallback((e: { nativeEvent: { contentOffset: { y: number } } }) => {
    const y  = e.nativeEvent.contentOffset.y;
    const dy = y - lastScrollYRef.current;
    lastScrollYRef.current = Math.max(0, y);

    if (dy > 6 && y > headerHeight && headerVisRef.current) {
      headerVisRef.current = false;
      Animated.timing(headerTranslateY, {
        toValue: -headerHeight,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    } else if (dy < -6 && !headerVisRef.current) {
      headerVisRef.current = true;
      Animated.timing(headerTranslateY, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
  }, [headerHeight, headerTranslateY]);

  const { recentMovies, recentSeries } = useMemo(() => {
    const recentMovies: PosterItem[] = [];
    const recentSeries: PosterItem[] = [];
    const seenM = new Set<string>();
    const seenS = new Set<string>();
    for (const entry of history) {
      for (const rec of entry.recommendations ?? []) {
        if (!rec.posterPath) continue;
        if (rec.type === 'movie' && !seenM.has(rec.posterPath) && recentMovies.length < 10) {
          seenM.add(rec.posterPath);
          recentMovies.push({ posterPath: rec.posterPath, title: rec.title, platform: rec.platform, matchId: entry.matchId });
        } else if (rec.type === 'series' && !seenS.has(rec.posterPath) && recentSeries.length < 10) {
          seenS.add(rec.posterPath);
          recentSeries.push({ posterPath: rec.posterPath, title: rec.title, platform: rec.platform, matchId: entry.matchId });
        }
      }
    }
    return { recentMovies, recentSeries };
  }, [history]);

  useFocusEffect(
    useCallback(() => {
      // Reset header to visible when screen comes into focus
      headerTranslateY.setValue(0);
      headerVisRef.current = true;
      lastScrollYRef.current = 0;
      if (!user?.uid || USE_MOCK) return;
      getPersonalWatchlist(user.uid).then(setWatchlist).catch(() => {});
      getPendingRatingsForUser(user.uid).then(items => setPendingCount(items.length)).catch(() => {});
    }, [user?.uid]),
  );

  useEffect(() => {
    if (!pendingInviteCode || !user) return;
    const code = pendingInviteCode;
    setPendingInviteCode(null);
    Alert.alert(
      'Invitación recibida',
      `Código de grupo: ${code}\n¿Querés unirte?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Unirme',
          onPress: async () => {
            try {
              if (USE_MOCK) {
                addGroup({ ...MOCK_GROUP, inviteCode: code });
                setCurrentGroup(MOCK_GROUP);
                nav.navigate('Group', { groupId: MOCK_GROUP.id });
              } else {
                const { groupId, group } = await joinGroupByCode(user.uid, code);
                addGroup(group); setCurrentGroup(group);
                nav.navigate('Group', { groupId });
              }
            } catch { Alert.alert('Error', 'Código inválido o el grupo ya no existe.'); }
          },
        },
      ],
    );
  }, [pendingInviteCode, user]);

  function handleGroupPress(groupId: string) {
    const group = groups.find(g => g.id === groupId) ?? MOCK_GROUP;
    setCurrentGroup(group);
    nav.navigate('Group', { groupId });
  }

  function togglePlatform(id: PlatformId) {
    setSelPlatforms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  }

  async function handleCreate() {
    if (!groupName.trim() || !user) return;
    setWorking(true);
    try {
      if (USE_MOCK) {
        const fg = { ...MOCK_GROUP, id: `g-${Date.now()}`, name: groupName, members: [user.uid], platforms: selPlatforms };
        addGroup(fg); setCurrentGroup(fg); setCreateModal(false); setGroupName('');
        nav.navigate('Group', { groupId: fg.id });
      } else {
        const { groupId, inviteCode } = await createGroup(user.uid, { name: groupName, platforms: selPlatforms, country: 'AR' });
        const group = { id: groupId, name: groupName, members: [user.uid], createdBy: user.uid, inviteCode, platforms: selPlatforms, country: 'AR' };
        addGroup(group); setCurrentGroup(group); setCreateModal(false); setGroupName('');
        nav.navigate('Group', { groupId });
      }
    } catch (e) { Alert.alert('Error', String(e)); }
    finally { setWorking(false); }
  }

  function handleSoloPress() {
    const hasPlatforms = (user?.platforms ?? []).length > 0;
    if (hasPlatforms) { nav.navigate('Mood', { solo: true }); }
    else { setSoloPlatforms(['netflix']); setSoloPlatformModal(true); }
  }

  async function handleSoloPlatformSave() {
    if (!user || soloPlatforms.length === 0) return;
    try { if (!USE_MOCK) await updateUserPlatforms(user.uid, soloPlatforms); setPlatforms(soloPlatforms); }
    catch { /* silenciar */ }
    setSoloPlatformModal(false);
    nav.navigate('Mood', { solo: true });
  }

  async function handleScannedCode(code: string) {
    setScannerVisible(false); setJoinCode(code); setJoinModal(true);
  }

  async function handleJoin() {
    if (!joinCode.trim() || !user) return;
    setWorking(true);
    try {
      if (USE_MOCK) {
        addGroup({ ...MOCK_GROUP, inviteCode: joinCode.toUpperCase() });
        setCurrentGroup(MOCK_GROUP); setJoinModal(false); setJoinCode('');
        nav.navigate('Group', { groupId: MOCK_GROUP.id });
      } else {
        const { groupId, group } = await joinGroupByCode(user.uid, joinCode);
        addGroup(group); setCurrentGroup(group); setJoinModal(false); setJoinCode('');
        nav.navigate('Group', { groupId });
      }
    } catch (e) { Alert.alert('Error', String(e)); }
    finally { setWorking(false); }
  }

  const watchlistItems: PosterItem[] = watchlist.map(item => ({
    posterPath: item.posterPath, title: item.title, platform: item.platform, matchId: item.matchId,
  }));

  function handlePosterPress(item: PosterItem) {
    if (!item.matchId) return;
    const entry = history.find(e => e.matchId === item.matchId);
    if (!entry) return;
    const solo = entry.groupId.startsWith('solo-');
    setSoloMode(solo);
    setCurrentMatch({ recommendations: entry.recommendations, groupInsight: '' }, entry.matchId);
    nav.navigate('Results', { matchId: entry.matchId });
  }

  function renderPosterRow(items: PosterItem[]) {
    return (
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={styles.posterRowScroll}
        contentContainerStyle={styles.posterRowContent}
        nestedScrollEnabled
      >
        {items.map((item, i) => (
          <TouchableOpacity
            key={i}
            style={styles.posterCard}
            onPress={() => handlePosterPress(item)}
            activeOpacity={item.matchId ? 0.78 : 1}
          >
            {item.posterPath ? (
              <Image
                source={{ uri: getPosterUrl(item.posterPath) ?? '' }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.posterPlaceholder}>
                <Feather name="film" size={18} color={Colors.faint} />
              </View>
            )}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.88)']}
              style={styles.posterFade}
            />
            <Text style={styles.posterTitle} numberOfLines={2}>{item.title}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  }

  const hasHistory = recentMovies.length > 0 || recentSeries.length > 0 || watchlistItems.length > 0;

  return (
    <View style={[styles.root, { backgroundColor: themeColors.bg }]}>

      {/* ── Floating header — slides up on scroll down, down on scroll up ── */}
      <Animated.View
        style={[styles.headerFloat, { transform: [{ translateY: headerTranslateY }] }]}
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
      >
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <LogoWordmark markSize={24} />
          <TouchableOpacity style={styles.avatar} onPress={() => (nav as any).navigate('Profile')} activeOpacity={0.75}>
            <Text style={styles.avatarText}>{avatarLetter}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingTop: headerHeight, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >

        {/* ── Notificación pendientes ─────────────────────────────── */}
        {pendingCount > 0 && !notifDismissed && (
          <View style={styles.notif}>
            <View style={styles.notifIco}>
              <Feather name="star" size={14} color={Colors.success} />
            </View>
            <TouchableOpacity style={styles.notifBody} onPress={() => (nav as any).navigate('History')} activeOpacity={0.75}>
              <Text style={styles.notifTitle}>
                {pendingCount === 1 ? '1 título espera tu valoración' : `${pendingCount} títulos esperan tu valoración`} →
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setNotifDismissed(true)} hitSlop={12} style={styles.notifClose}>
              <Feather name="x" size={14} color={Colors.faint} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Hero: ¿Qué ven hoy? ────────────────────────────────── */}
        <TouchableOpacity onPress={handleSoloPress} activeOpacity={0.88} style={styles.heroWrap}>
          <LinearGradient
            colors={['#0D27A0', '#1B50D4', '#2A6AEC']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.heroGrad}
          >
            {/* Venn decorativo */}
            <View style={styles.heroVenn} pointerEvents="none">
              <Svg width={160} height={160} viewBox="0 0 28 28" fill="none">
                <Circle cx={10} cy={14} r={8}  fill="white" fillOpacity={0.07} />
                <Circle cx={18} cy={14} r={8}  fill="white" fillOpacity={0.07} />
                <Ellipse cx={14} cy={14} rx={4} ry={6.8} fill="white" fillOpacity={0.06} />
              </Svg>
            </View>

            <Text style={styles.heroGreeting}>
              {firstName ? `Hola ${firstName},` : 'Hola,'}{'\n'}¿qué ponemos hoy?
            </Text>
            <Text style={styles.heroSub}>Elegí tu mood, IA te recomienda</Text>

            {(user?.platforms ?? []).length > 0 && (
              <View style={styles.heroPlatforms}>
                {(user!.platforms!).slice(0, 4).map(pid => (
                  <PlatformLogo key={pid} id={pid} size={14} />
                ))}
                {(user!.platforms!).length > 4 && (
                  <Text style={styles.heroPlatformsMore}>+{(user!.platforms!).length - 4}</Text>
                )}
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* ── Tus grupos ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>¿Con quién ponemos algo?</Text>
          <Text style={styles.sectionTitle}>Tus grupos</Text>

          {groups.length === 0 && (
            <View style={styles.emptyGroups}>
              <Svg width={40} height={40} viewBox="0 0 28 28" fill="none">
                <Circle cx={10} cy={14} r={8} fill={Colors.accentFaint} stroke={Colors.accentBorder} strokeWidth={1} />
                <Circle cx={18} cy={14} r={8} fill={Colors.accentFaint} stroke={Colors.accentBorder} strokeWidth={1} />
              </Svg>
              <Text style={styles.emptyGroupsText}>Invitá a alguien para encontrar la peli perfecta para los dos</Text>
            </View>
          )}

          {groups.map(g => (
            <GroupCard key={g.id} group={g} onPress={() => handleGroupPress(g.id)} />
          ))}

          <View style={styles.groupBtns}>
            <TouchableOpacity style={[styles.createBtnWrap, styles.createBtn]} onPress={() => setCreateModal(true)} activeOpacity={0.8}>
              <Text style={styles.createBtnText}>+ Crear grupo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.joinBtn} onPress={() => setJoinModal(true)} activeOpacity={0.8}>
              <Text style={styles.joinBtnText}>Unirme</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Historial de sesiones ───────────────────────────────── */}
        {hasHistory && (
          <View style={styles.historySeparator}>
            <View style={styles.historySeparatorLine} />
            <Text style={styles.historySeparatorText}>Lo que recomendamos antes</Text>
            <View style={styles.historySeparatorLine} />
          </View>
        )}

        {recentMovies.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionEyebrow}>Sesiones anteriores</Text>
            <Text style={styles.sectionTitle}>Pelis</Text>
            {renderPosterRow(recentMovies)}
          </View>
        )}

        {recentSeries.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionEyebrow}>Sesiones anteriores</Text>
            <Text style={styles.sectionTitle}>Series</Text>
            {renderPosterRow(recentSeries)}
          </View>
        )}

        {watchlistItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionEyebrow}>Guardadas</Text>
            <Text style={styles.sectionTitle}>Para después</Text>
            {renderPosterRow(watchlistItems)}
          </View>
        )}

      </ScrollView>

      {/* ── Modal Crear grupo ──────────────────────────────────────── */}
      <Modal visible={createModal} transparent animationType="slide" onRequestClose={() => setCreateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Crear grupo</Text>
            <TextInput
              style={styles.input} placeholder="Nombre del grupo"
              placeholderTextColor={Colors.faint} value={groupName} onChangeText={setGroupName}
            />
            <Text style={styles.modalSubtitle}>Plataformas</Text>
            <View style={styles.platformGrid}>
              {PLATFORMS.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.platformChip, selPlatforms.includes(p.id) && styles.platformChipSelected]}
                  onPress={() => togglePlatform(p.id)}
                >
                  <PlatformLogo id={p.id} size={24} />
                  <Text style={styles.platformName}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateModal(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, (!groupName.trim() || working) && styles.btnDisabled]}
                onPress={handleCreate} disabled={!groupName.trim() || working}
              >
                <Text style={styles.confirmBtnText}>{working ? 'Creando…' : 'Crear'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal Unirse ──────────────────────────────────────────── */}
      <Modal visible={joinModal} transparent animationType="slide" onRequestClose={() => setJoinModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Unirme a un grupo</Text>
            <TextInput
              style={styles.input} placeholder="Código de invitación (ej: SM7VK2)"
              placeholderTextColor={Colors.faint} value={joinCode}
              onChangeText={t => setJoinCode(t.toUpperCase())} autoCapitalize="characters"
            />
            <TouchableOpacity style={styles.qrBtn} onPress={() => { setJoinModal(false); setScannerVisible(true); }}>
              <Text style={styles.qrBtnText}>Escanear QR</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.hintTouchable} onPress={() => setJoinCode('SM7VK2')}>
              <Text style={styles.hintText}>Demo: probá con SM7VK2</Text>
            </TouchableOpacity>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setJoinModal(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, (!joinCode.trim() || working) && styles.btnDisabled]}
                onPress={handleJoin} disabled={!joinCode.trim() || working}
              >
                <Text style={styles.confirmBtnText}>{working ? 'Buscando…' : 'Unirme'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal plataformas solo ────────────────────────────────── */}
      <Modal visible={soloPlatformModal} transparent animationType="slide" onRequestClose={() => setSoloPlatformModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>¿En qué plataformas estás?</Text>
            <Text style={styles.modalSubtitle}>Seleccioná las que tenés para que Claude te recomiende algo disponible</Text>
            <View style={styles.platformGrid}>
              {PLATFORMS.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.platformChip, soloPlatforms.includes(p.id) && styles.platformChipSelected]}
                  onPress={() => setSoloPlatforms(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}
                >
                  <PlatformLogo id={p.id} size={24} />
                  <Text style={styles.platformName}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setSoloPlatformModal(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, soloPlatforms.length === 0 && styles.btnDisabled]}
                onPress={handleSoloPlatformSave} disabled={soloPlatforms.length === 0}
              >
                <Text style={styles.confirmBtnText}>Continuar →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <QRScanner visible={scannerVisible} onClose={() => setScannerVisible(false)} onScan={handleScannedCode} />
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: Colors.bg },
  scrollView:  { flex: 1 },
  headerFloat: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingBottom: 16,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.s2, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: {
    color: Colors.text, fontSize: 18,
    fontWeight: Typography.medium, fontFamily: Typography.fontMedium,
  },

  // Notif bar
  notif: {
    marginHorizontal: 24, marginBottom: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(29,158,117,0.12)',
    borderWidth: 1, borderColor: 'rgba(29,158,117,0.28)',
    borderRadius: 12, padding: 12,
  },
  notifIco: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(29,158,117,0.20)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  notifBody:  { flex: 1 },
  notifTitle: { color: Colors.success, fontSize: 16, fontWeight: Typography.medium },
  notifClose: { padding: 4 },

  // Hero
  heroWrap: { marginHorizontal: 24, borderRadius: 20, overflow: 'hidden', marginBottom: 28 },
  heroGrad: {
    borderRadius: 20, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 22,
    minHeight: 168, justifyContent: 'flex-end',
  },
  heroVenn:  { position: 'absolute', right: -20, top: -20 },
  heroGreeting: {
    color: '#fff', fontSize: 28, fontWeight: Typography.medium,
    fontFamily: Typography.fontMedium, letterSpacing: -0.5, lineHeight: 36, marginBottom: 10,
  },
  heroSub:   { color: 'rgba(255,255,255,0.72)', fontSize: 22, fontFamily: Typography.fontRegular, marginBottom: 16 },
  heroPlatforms: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  heroPlatformsMore: {
    color: 'rgba(255,255,255,0.5)', fontSize: 14,
    fontWeight: Typography.medium,
  },

  // Sections
  section:       { marginBottom: 28, paddingHorizontal: 24 },
  sectionEyebrow:{
    color: Colors.sub, fontSize: 16, fontWeight: Typography.medium,
    letterSpacing: 0.2, marginBottom: 4,
  },
  sectionTitle:  { color: Colors.text, fontSize: 22, fontWeight: Typography.medium, marginBottom: 14, letterSpacing: -0.3 },

  // Empty groups
  emptyGroups: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.s1, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    padding: 16, marginBottom: 14,
  },
  emptyGroupsText: { flex: 1, color: Colors.sub, fontSize: 16, lineHeight: 24 },

  // History separator
  historySeparator: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 24, marginBottom: 24,
  },
  historySeparatorLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  historySeparatorText: {
    color: Colors.sub, fontSize: 16,
    fontWeight: Typography.medium,
  },

  // Poster rows
  posterRowScroll:  { marginHorizontal: -24 },
  posterRowContent: { paddingHorizontal: 24, gap: 10 },
  posterCard: {
    width: POSTER_W, height: POSTER_H,
    borderRadius: 12, overflow: 'hidden',
    backgroundColor: Colors.s1,
  },
  posterPlaceholder:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  posterFade: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 90,
  },
  posterPlatformBadge:  {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 6, padding: 4,
  },
  posterTitle: {
    position: 'absolute', bottom: 9, left: 9, right: 9,
    color: '#fff', fontSize: 14, fontFamily: Typography.fontMedium,
    fontWeight: Typography.medium, lineHeight: 18,
  },

  // Groups
  groupBtns:     { flexDirection: 'row', gap: 10, marginTop: 4 },
  createBtnWrap: { flex: 1 },
  createBtn:     { borderRadius: 12, paddingVertical: 16, alignItems: 'center', backgroundColor: '#1B50D4' },
  createBtnText: { color: '#fff', fontWeight: Typography.medium, fontFamily: Typography.fontMedium, fontSize: 18 },
  joinBtn:       { flex: 1, backgroundColor: Colors.s1, borderRadius: 12, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  joinBtnText:   { color: Colors.text, fontWeight: Typography.medium, fontFamily: Typography.fontMedium, fontSize: 18 },

  // Modals
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal:         { backgroundColor: Colors.s1, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: Colors.border },
  modalTitle:    { color: Colors.text, fontSize: 22, fontWeight: Typography.medium, marginBottom: 20 },
  modalSubtitle: { color: Colors.sub, fontSize: 16, fontWeight: Typography.medium, marginBottom: 10, marginTop: 16 },
  input:         { backgroundColor: Colors.s2, borderRadius: 10, padding: 14, color: Colors.text, fontSize: 18, borderWidth: 1, borderColor: Colors.border },
  platformGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  platformChip:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.s2, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: Colors.border },
  platformChipSelected: { borderColor: Colors.accentBorder, backgroundColor: Colors.accentFaint },
  platformName:  { color: Colors.text, fontSize: 18 },
  modalBtns:     { flexDirection: 'row', gap: 10 },
  cancelBtn:     { flex: 1, backgroundColor: Colors.s2, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { color: Colors.sub, fontWeight: Typography.medium, fontSize: 18 },
  confirmBtn:    { flex: 2, backgroundColor: Colors.accent, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  confirmBtnText:{ color: '#fff', fontWeight: Typography.medium, fontSize: 18 },
  btnDisabled:   { opacity: 0.4 },
  hintTouchable: { marginTop: 4, marginBottom: 4 },
  hintText:      { color: Colors.faint, fontSize: 16 },
  qrBtn:         { marginTop: 10, borderWidth: 1, borderColor: Colors.accent, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  qrBtnText:     { color: Colors.accent, fontSize: 18, fontWeight: '500' },
});
