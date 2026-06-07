import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, Alert, Image, Dimensions,
  LayoutAnimation, Platform, UIManager,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Typography } from '../constants/colors';
import { useColors } from '../context/ThemeContext';
import { LogoWordmark } from '../components/Logo';
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
const SCREEN_H = Dimensions.get('window').height;

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const POSTER_SM = { w: 70, h: 105 };
const POSTER_LG = { w: 100, h: 150 };

type PosterRowId = 'movies' | 'series' | 'watchlist';
interface PosterItem { posterPath: string | null; title: string; platform: PlatformId }

export default function HomeScreen() {
  const insets  = useSafeAreaInsets();
  const nav     = useNavigation<Nav>();
  const { user, setPlatforms }                                              = useAuthStore();
  const { groups, addGroup, setCurrentGroup, pendingInviteCode, setPendingInviteCode } = useGroupStore();
  const { history }                                                         = useMatchStore();
  const themeColors = useColors();
  const firstName   = user?.displayName?.split(' ')[0] ?? '';

  const [createModal, setCreateModal]           = useState(false);
  const [joinModal,   setJoinModal]             = useState(false);
  const [groupName,   setGroupName]             = useState('');
  const [joinCode,    setJoinCode]              = useState('');
  const [selPlatforms, setSelPlatforms]         = useState<PlatformId[]>(['netflix']);
  const [working,     setWorking]               = useState(false);
  const [scannerVisible, setScannerVisible]     = useState(false);
  const [soloPlatformModal, setSoloPlatformModal] = useState(false);
  const [soloPlatforms, setSoloPlatforms]       = useState<PlatformId[]>([]);
  const [watchlist,   setWatchlist]             = useState<PersonalWatchlistItem[]>([]);
  const [pendingCount, setPendingCount]         = useState(0);
  const [notifDismissed, setNotifDismissed]     = useState(false);
  const [activePosterRow, setActivePosterRow]   = useState<PosterRowId>('movies');
  const sectionTops = useRef<Partial<Record<PosterRowId, number>>>({});

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
          recentMovies.push({ posterPath: rec.posterPath, title: rec.title, platform: rec.platform });
        } else if (rec.type === 'series' && !seenS.has(rec.posterPath) && recentSeries.length < 10) {
          seenS.add(rec.posterPath);
          recentSeries.push({ posterPath: rec.posterPath, title: rec.title, platform: rec.platform });
        }
      }
    }
    return { recentMovies, recentSeries };
  }, [history]);

  useFocusEffect(
    useCallback(() => {
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

  function handleScroll(e: { nativeEvent: { contentOffset: { y: number } } }) {
    const y      = e.nativeEvent.contentOffset.y;
    const focusY = y + SCREEN_H * 0.35;
    const rows: PosterRowId[] = ['movies', 'series', 'watchlist'];
    let best: PosterRowId = activePosterRow;
    let bestDist = Infinity;
    for (const row of rows) {
      const top = sectionTops.current[row];
      if (top === undefined) continue;
      const dist = Math.abs(top - focusY);
      if (dist < bestDist) { bestDist = dist; best = row; }
    }
    if (best !== activePosterRow) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setActivePosterRow(best);
    }
  }

  const watchlistItems: PosterItem[] = watchlist.map(item => ({
    posterPath: item.posterPath, title: item.title, platform: item.platform,
  }));

  function renderPosterRow(items: PosterItem[], rowId: PosterRowId) {
    const isActive = activePosterRow === rowId;
    const pw = isActive ? POSTER_LG.w : POSTER_SM.w;
    const ph = isActive ? POSTER_LG.h : POSTER_SM.h;
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.posterRowScroll}
        contentContainerStyle={styles.posterRowContent}
        nestedScrollEnabled
      >
        {items.map((item, i) => (
          <View key={i} style={[styles.posterCard, { width: pw, height: ph }]}>
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
            <View style={styles.posterPlatformBadge}>
              <PlatformLogo id={item.platform} size={13} />
            </View>
          </View>
        ))}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: themeColors.bg }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >

        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={styles.header}>
          <LogoWordmark markSize={20} />
          {firstName ? <Text style={styles.greeting}>Hola, {firstName}</Text> : null}
        </View>

        {/* ── Hero ───────────────────────────────────────────────── */}
        <TouchableOpacity onPress={handleSoloPress} activeOpacity={0.88} style={styles.heroWrap}>
          <LinearGradient
            colors={['#0D27A0', '#1B50D4', '#2A6AEC']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.heroGrad}
          >
            <View style={styles.heroVenn} pointerEvents="none">
              <Svg width={190} height={190} viewBox="0 0 28 28" fill="none">
                <Circle cx={10} cy={14} r={8} fill="white" fillOpacity={0.07} />
                <Circle cx={18} cy={14} r={8} fill="white" fillOpacity={0.07} />
              </Svg>
            </View>
            <View style={styles.heroTop}>
              <View style={styles.heroPlayBtn}>
                <Feather name="play" size={26} color="#fff" />
              </View>
              <View style={styles.heroText}>
                <Text style={styles.heroTitle}>¿Qué ves hoy?</Text>
                <Text style={styles.heroSub}>Tus plataformas · tu mood</Text>
              </View>
              <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.45)" />
            </View>
            <Text style={styles.heroTagline}>LA PELI PARA HOY</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* ── Notificación ───────────────────────────────────────── */}
        {pendingCount > 0 && !notifDismissed && (
          <View style={styles.notif}>
            <View style={styles.notifIco}>
              <Feather name="star" size={14} color={Colors.success} />
            </View>
            <TouchableOpacity
              style={styles.notifBody}
              onPress={() => (nav as any).navigate('History')}
              activeOpacity={0.75}
            >
              <Text style={styles.notifTitle}>{pendingCount} títulos esperan tu valoración</Text>
              <Text style={styles.notifSub}>Calificá lo que viste para mejorar las recomendaciones →</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setNotifDismissed(true)} hitSlop={12} style={styles.notifClose}>
              <Feather name="x" size={14} color={Colors.faint} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Pelis recientes ────────────────────────────────────── */}
        {recentMovies.length > 0 && (
          <View style={styles.section} onLayout={e => { sectionTops.current.movies = e.nativeEvent.layout.y; }}>
            <Text style={styles.sectionTitle}>Pelis recientes</Text>
            {renderPosterRow(recentMovies, 'movies')}
          </View>
        )}

        {/* ── Series recientes ───────────────────────────────────── */}
        {recentSeries.length > 0 && (
          <View style={styles.section} onLayout={e => { sectionTops.current.series = e.nativeEvent.layout.y; }}>
            <Text style={styles.sectionTitle}>Series recientes</Text>
            {renderPosterRow(recentSeries, 'series')}
          </View>
        )}

        {/* ── Para después ───────────────────────────────────────── */}
        {watchlistItems.length > 0 && (
          <View style={styles.section} onLayout={e => { sectionTops.current.watchlist = e.nativeEvent.layout.y; }}>
            <Text style={styles.sectionTitle}>Para después</Text>
            {renderPosterRow(watchlistItems, 'watchlist')}
          </View>
        )}

        {/* ── Grupos ─────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tus grupos</Text>
          {groups.length === 0 && <Text style={styles.emptyText}>Todavía no tenés grupos. ¡Creá uno!</Text>}
          {groups.map(g => (
            <GroupCard key={g.id} group={g} onPress={() => handleGroupPress(g.id)} />
          ))}
          <View style={styles.groupBtns}>
            <TouchableOpacity style={styles.createBtn} onPress={() => setCreateModal(true)} activeOpacity={0.8}>
              <Text style={styles.createBtnText}>+ Crear grupo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.joinBtn} onPress={() => setJoinModal(true)} activeOpacity={0.8}>
              <Text style={styles.joinBtnText}>Unirme</Text>
            </TouchableOpacity>
          </View>
        </View>

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
  root: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, marginBottom: 18,
  },
  greeting: { fontFamily: Typography.fontRegular, fontSize: Typography.small, color: Colors.sub },

  // Hero
  heroWrap:    { marginHorizontal: 24, borderRadius: 20, overflow: 'hidden', marginBottom: 20 },
  heroGrad:    { borderRadius: 20, paddingHorizontal: 22, paddingTop: 22, paddingBottom: 18, minHeight: 148, justifyContent: 'space-between' },
  heroVenn:    { position: 'absolute', right: -30, top: -30 },
  heroTop:     { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroPlayBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroText:    { flex: 1 },
  heroTitle:   { color: '#fff', fontSize: Typography.h2, fontWeight: Typography.medium, letterSpacing: -0.3 },
  heroSub:     { color: 'rgba(255,255,255,0.65)', fontSize: Typography.small, marginTop: 4 },
  heroTagline: { color: 'rgba(255,255,255,0.35)', fontSize: Typography.tiny, fontWeight: Typography.medium, letterSpacing: 2, marginTop: 18 },

  // Notification bar
  notif: {
    marginHorizontal: 24, marginBottom: 20,
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
  notifTitle: { color: Colors.success, fontSize: Typography.small, fontWeight: Typography.medium },
  notifSub:   { color: Colors.sub, fontSize: Typography.tiny, marginTop: 2 },
  notifClose: { padding: 4 },

  // Sections
  section: { marginBottom: 28, paddingHorizontal: 24 },
  sectionTitle: {
    color: Colors.faint, fontSize: Typography.tiny, fontWeight: Typography.medium,
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12,
  },
  emptyText: { color: Colors.faint, fontSize: Typography.small, marginBottom: 16 },

  // Poster rows
  posterRowScroll:   { marginHorizontal: -24 },
  posterRowContent:  { paddingHorizontal: 24, gap: 10, alignItems: 'flex-end' },
  posterCard:        { borderRadius: 10, overflow: 'hidden', backgroundColor: Colors.s1 },
  posterPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  posterPlatformBadge: {
    position: 'absolute', bottom: 5, left: 5,
    backgroundColor: 'rgba(0,0,0,0.68)', borderRadius: 5, padding: 3,
  },

  // Groups
  groupBtns:    { flexDirection: 'row', gap: 10, marginTop: 4 },
  createBtn:    { flex: 1, backgroundColor: Colors.accent, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  createBtnText:{ color: '#fff', fontWeight: Typography.medium, fontSize: Typography.body },
  joinBtn:      { flex: 1, backgroundColor: Colors.s1, borderRadius: 10, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  joinBtnText:  { color: Colors.text, fontWeight: Typography.medium, fontSize: Typography.body },

  // Modals
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal:         { backgroundColor: Colors.s1, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: Colors.border },
  modalTitle:    { color: Colors.text, fontSize: Typography.h2, fontWeight: Typography.medium, marginBottom: 20 },
  modalSubtitle: { color: Colors.sub, fontSize: Typography.small, fontWeight: Typography.medium, marginBottom: 10, marginTop: 16 },
  input:         { backgroundColor: Colors.s2, borderRadius: 10, padding: 14, color: Colors.text, fontSize: Typography.body, borderWidth: 1, borderColor: Colors.border },
  platformGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  platformChip:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.s2, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: Colors.border },
  platformChipSelected: { borderColor: Colors.accentBorder, backgroundColor: Colors.accentFaint },
  platformName:  { color: Colors.text, fontSize: Typography.body },
  modalBtns:     { flexDirection: 'row', gap: 10 },
  cancelBtn:     { flex: 1, backgroundColor: Colors.s2, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { color: Colors.sub, fontWeight: Typography.medium },
  confirmBtn:    { flex: 2, backgroundColor: Colors.accent, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  confirmBtnText:{ color: '#fff', fontWeight: Typography.medium },
  btnDisabled:   { opacity: 0.4 },
  hintTouchable: { marginTop: 4, marginBottom: 4 },
  hintText:      { color: Colors.faint, fontSize: Typography.small },
  qrBtn:         { marginTop: 10, borderWidth: 1, borderColor: Colors.accent, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  qrBtnText:     { color: Colors.accent, fontSize: Typography.body, fontWeight: '500' },
});
