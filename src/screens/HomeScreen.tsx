import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, Alert, Image, Animated,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Ellipse } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Typography } from '../constants/colors';
import { useColors } from '../context/ThemeContext';
import { LogoMark } from '../components/Logo';
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
type Nav   = NativeStackNavigationProp<RootStackParamList>;
type TabId = 'inicio' | 'grupos' | 'valorar' | 'sesiones';

const TABS: { id: TabId; label: string }[] = [
  { id: 'inicio',   label: 'inicio' },
  { id: 'grupos',   label: 'grupos' },
  { id: 'valorar',  label: 'valorar' },
  { id: 'sesiones', label: 'sesiones' },
];

const POSTER_W   = 144;
const POSTER_H   = 216;
const LOGO_SIZE  = 36;
const LOGO_BOX   = Math.round(LOGO_SIZE * 1.7); // 61
const LOGO_MIN   = 0.65;
const COLLAPSE_Y = 70;
const IND_W      = 24; // tab indicator width

interface PosterItem { posterPath: string | null; title: string; platform: PlatformId; matchId?: string }

export default function HomeScreen() {
  const insets       = useSafeAreaInsets();
  const nav          = useNavigation<Nav>();
  const { user, setPlatforms }                                                        = useAuthStore();
  const { groups, addGroup, setCurrentGroup, pendingInviteCode, setPendingInviteCode } = useGroupStore();
  const { history, setCurrentMatch, setSoloMode }                                    = useMatchStore();
  const themeColors  = useColors();
  const firstName    = user?.displayName?.split(' ')[0] ?? '';
  const avatarLetter = firstName.charAt(0).toUpperCase() || '?';

  // ── State ────────────────────────────────────────────────────────────────
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

  // ── Header animation ─────────────────────────────────────────────────────
  const scrollRef    = useRef<ScrollView>(null);
  const scrollY      = useRef(new Animated.Value(0)).current;
  const indicatorTX  = useRef(new Animated.Value(0)).current;
  const isFirstMount = useRef(true);

  const [activeTab,    setActiveTab]    = useState<TabId>('inicio');
  const [headerHeight, setHeaderHeight] = useState(insets.top + 120);
  const [tabRowWidth,  setTabRowWidth]  = useState(375);

  const sectionYRef = useRef<Record<TabId, number>>({
    inicio: 0, grupos: 0, valorar: 0, sesiones: 0,
  });

  // Native-driver interpolations from scrollY
  const logoScale = useRef(scrollY.interpolate({
    inputRange: [0, COLLAPSE_Y],
    outputRange: [1, LOGO_MIN],
    extrapolate: 'clamp',
  })).current;

  // Anchor left edge: compensate for center-origin scale
  const logoTX = useRef(scrollY.interpolate({
    inputRange: [0, COLLAPSE_Y],
    outputRange: [0, -(LOGO_BOX * (1 - LOGO_MIN) / 2)],
    extrapolate: 'clamp',
  })).current;

  const wordmarkOpacity = useRef(scrollY.interpolate({
    inputRange: [0, 38],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  })).current;

  const wordmarkTY = useRef(scrollY.interpolate({
    inputRange: [0, 38],
    outputRange: [0, -10],
    extrapolate: 'clamp',
  })).current;

  // Tab indicator spring — animate on tab change
  const tabWidth = tabRowWidth / TABS.length;

  useEffect(() => {
    const idx = TABS.findIndex(t => t.id === activeTab);
    const targetX = idx * tabWidth + (tabWidth - IND_W) / 2;
    if (isFirstMount.current) {
      indicatorTX.setValue(targetX);
      isFirstMount.current = false;
    } else {
      Animated.spring(indicatorTX, {
        toValue: targetX,
        useNativeDriver: true,
        tension: 220,
        friction: 18,
        overshootClamping: true,
      }).start();
    }
  }, [activeTab, tabWidth]);

  // Active-tab tracking via stable ref — avoids re-creating the Animated.event
  const scrollCbRef = useRef<(e: any) => void>(() => {});
  scrollCbRef.current = (e: any) => {
    const y  = e.nativeEvent.contentOffset.y;
    const sy = sectionYRef.current;
    const th = headerHeight + 40;
    let next: TabId = 'inicio';
    if (sy.sesiones > 0 && y >= sy.sesiones - th) next = 'sesiones';
    else if (sy.valorar > 0 && y >= sy.valorar - th) next = 'valorar';
    else if (sy.grupos > 0 && y >= sy.grupos - th) next = 'grupos';
    setActiveTab(prev => (prev === next ? prev : next));
  };

  // Animated.event created once — listener reads from scrollCbRef
  const onScrollEvent = useRef(
    Animated.event(
      [{ nativeEvent: { contentOffset: { y: scrollY } } }],
      { useNativeDriver: true, listener: (e: any) => scrollCbRef.current(e) }
    )
  ).current;

  function scrollToSection(id: TabId) {
    const rawY = id === 'inicio' ? 0 : Math.max(0, sectionYRef.current[id] - headerHeight);
    scrollRef.current?.scrollTo({ y: rawY, animated: true });
    setActiveTab(id);
  }

  // ── Data ──────────────────────────────────────────────────────────────────
  const { recentMovies, recentSeries } = useMemo(() => {
    const movies: PosterItem[] = [];
    const series: PosterItem[] = [];
    const seenM = new Set<string>();
    const seenS = new Set<string>();
    for (const entry of history) {
      for (const rec of entry.recommendations ?? []) {
        if (!rec.posterPath) continue;
        if (rec.type === 'movie' && !seenM.has(rec.posterPath) && movies.length < 10) {
          seenM.add(rec.posterPath);
          movies.push({ posterPath: rec.posterPath, title: rec.title, platform: rec.platform, matchId: entry.matchId });
        } else if (rec.type === 'series' && !seenS.has(rec.posterPath) && series.length < 10) {
          seenS.add(rec.posterPath);
          series.push({ posterPath: rec.posterPath, title: rec.title, platform: rec.platform, matchId: entry.matchId });
        }
      }
    }
    return { recentMovies: movies, recentSeries: series };
  }, [history]);

  useFocusEffect(useCallback(() => {
    scrollY.setValue(0);
    setActiveTab('inicio');
    isFirstMount.current = true;
    if (!user?.uid || USE_MOCK) return;
    getPersonalWatchlist(user.uid).then(setWatchlist).catch(() => {});
    getPendingRatingsForUser(user.uid).then(items => setPendingCount(items.length)).catch(() => {});
  }, [user?.uid]));

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

  // ── Handlers ──────────────────────────────────────────────────────────────
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
              <Image source={{ uri: getPosterUrl(item.posterPath) ?? '' }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <View style={styles.posterPlaceholder}>
                <Feather name="film" size={18} color={Colors.faint} />
              </View>
            )}
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.88)']} style={styles.posterFade} />
            <Text style={styles.posterTitle} numberOfLines={2}>{item.title}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  }

  const hasHistory = recentMovies.length > 0 || recentSeries.length > 0 || watchlistItems.length > 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: themeColors.bg }]}>

      {/* ═══════════════════ STICKY HEADER ═══════════════════════════════ */}
      <View
        style={[styles.headerWrap, { paddingTop: insets.top }]}
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
      >
        {/* ── Brand row ── */}
        <View style={styles.brandRow}>
          {/* Logo + wordmark */}
          <View style={styles.brandLeft}>
            <Animated.View style={{
              transform: [{ translateX: logoTX }, { scale: logoScale }],
            }}>
              <TouchableOpacity onPress={() => scrollToSection('inicio')} activeOpacity={0.7}>
                <LogoMark size={LOGO_SIZE} />
              </TouchableOpacity>
            </Animated.View>
            <Animated.Text style={[styles.wordmark, {
              opacity: wordmarkOpacity,
              transform: [{ translateY: wordmarkTY }],
            }]}>
              queponemos
            </Animated.Text>
          </View>

          {/* Bell + avatar */}
          <View style={styles.brandRight}>
            <TouchableOpacity
              style={styles.bellWrap}
              onPress={() => (nav as any).navigate('History')}
              activeOpacity={0.7}
              hitSlop={8}
            >
              <Feather name="bell" size={22} color={Colors.text} />
              {pendingCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{pendingCount > 9 ? '9+' : String(pendingCount)}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.avatar}
              onPress={() => (nav as any).navigate('Profile')}
              activeOpacity={0.75}
            >
              <Text style={styles.avatarText}>{avatarLetter}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Tabs row ── */}
        <View
          style={styles.tabsRow}
          onLayout={(e) => setTabRowWidth(e.nativeEvent.layout.width)}
        >
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={styles.tab}
              onPress={() => scrollToSection(tab.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
          {/* Animated underline indicator */}
          <Animated.View
            style={[styles.tabIndicator, { transform: [{ translateX: indicatorTX }] }]}
          />
        </View>

        <View style={styles.headerBorder} />
      </View>

      {/* ═══════════════════ SCROLL CONTENT ══════════════════════════════ */}
      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={{ paddingTop: headerHeight, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
        onScroll={onScrollEvent}
        scrollEventThrottle={16}
      >

        {/* ── Hero / inicio ─────────────────────────────────────────── */}
        <View onLayout={(e) => { sectionYRef.current.inicio = e.nativeEvent.layout.y; }}>
          <TouchableOpacity onPress={handleSoloPress} activeOpacity={0.88} style={styles.heroWrap}>
            <LinearGradient
              colors={['#0D27A0', '#1B50D4', '#2A6AEC']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.heroGrad}
            >
              <View style={styles.heroVenn} pointerEvents="none">
                <Svg width={160} height={160} viewBox="0 0 28 28" fill="none">
                  <Circle cx={10} cy={14} r={8} fill="white" fillOpacity={0.07} />
                  <Circle cx={18} cy={14} r={8} fill="white" fillOpacity={0.07} />
                  <Ellipse cx={14} cy={14} rx={4} ry={6.8} fill="white" fillOpacity={0.06} />
                </Svg>
              </View>
              <Text style={styles.heroGreeting}>
                {firstName ? `Hola ${firstName},` : 'Hola,'}{'\n'}¿qué ponemos hoy?
              </Text>
              <Text style={styles.heroSub}>Elegí tu mood, IA te recomienda</Text>
              {(user?.platforms ?? []).length > 0 && (
                <View style={styles.heroPlatforms}>
                  {user!.platforms!.slice(0, 4).map(pid => (
                    <PlatformLogo key={pid} id={pid} size={14} />
                  ))}
                  {user!.platforms!.length > 4 && (
                    <Text style={styles.heroPlatformsMore}>+{user!.platforms!.length - 4}</Text>
                  )}
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ── Grupos ───────────────────────────────────────────────── */}
        <View
          onLayout={(e) => { sectionYRef.current.grupos = e.nativeEvent.layout.y; }}
          style={styles.section}
        >
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

        {/* ── Valorar ──────────────────────────────────────────────── */}
        <View
          onLayout={(e) => { sectionYRef.current.valorar = e.nativeEvent.layout.y; }}
          style={styles.section}
        >
          <Text style={styles.sectionEyebrow}>Tus gustos</Text>
          <Text style={styles.sectionTitle}>Valorar</Text>
          {pendingCount > 0 ? (
            <TouchableOpacity style={styles.valorarCard} onPress={() => (nav as any).navigate('History')} activeOpacity={0.8}>
              <Feather name="star" size={16} color={Colors.success} />
              <Text style={styles.valorarCardText}>
                {pendingCount === 1 ? '1 título espera tu valoración' : `${pendingCount} títulos esperan tu valoración`}
              </Text>
              <Feather name="chevron-right" size={16} color={Colors.faint} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.valorarCard} onPress={() => (nav as any).navigate('Profile')} activeOpacity={0.8}>
              <Feather name="film" size={16} color={Colors.sub} />
              <Text style={styles.valorarCardText}>Calificá títulos para mejorar las recomendaciones →</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Sesiones ─────────────────────────────────────────────── */}
        <View onLayout={(e) => { sectionYRef.current.sesiones = e.nativeEvent.layout.y; }}>
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
        </View>

      </ScrollView>

      {/* ═══════════════════ MODALS ══════════════════════════════════════ */}

      {/* Crear grupo */}
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
                  style={[styles.platformChip, selPlatforms.includes(p.id) && styles.platformChipSel]}
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

      {/* Unirse */}
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

      {/* Plataformas solo */}
      <Modal visible={soloPlatformModal} transparent animationType="slide" onRequestClose={() => setSoloPlatformModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>¿En qué plataformas estás?</Text>
            <Text style={styles.modalSubtitle}>Seleccioná las que tenés para que Claude te recomiende algo disponible</Text>
            <View style={styles.platformGrid}>
              {PLATFORMS.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.platformChip, soloPlatforms.includes(p.id) && styles.platformChipSel]}
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

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: Colors.bg },
  scrollView: { flex: 1 },

  // ── Sticky header ────────────────────────────────────────────────────────
  headerWrap: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    backgroundColor: Colors.bg,
  },

  // Brand row
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  wordmark: {
    fontFamily: Typography.fontMedium,
    fontSize: 17,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  brandRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  // Bell
  bellWrap: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute', top: 6, right: 5,
    width: 15, height: 15, borderRadius: 7.5,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  bellBadgeText: {
    color: '#fff', fontSize: 8,
    fontFamily: Typography.fontMedium,
    fontWeight: Typography.medium,
  },

  // Avatar
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.s2,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 4,
  },
  avatarText: {
    color: Colors.text, fontSize: 15,
    fontFamily: Typography.fontMedium,
    fontWeight: Typography.medium,
  },

  // Tabs row
  tabsRow: {
    flexDirection: 'row',
    position: 'relative',
    paddingTop: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabText: {
    fontFamily: Typography.fontMedium,
    fontSize: 13,
    color: Colors.faint,
    letterSpacing: -0.1,
  },
  tabTextActive: {
    color: Colors.text,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: IND_W,
    height: 2,
    borderRadius: 1,
    backgroundColor: Colors.accent,
  },

  headerBorder: { height: 1, backgroundColor: Colors.border, opacity: 0.5 },

  // ── Hero ────────────────────────────────────────────────────────────────
  heroWrap: { marginHorizontal: 24, marginTop: 8, borderRadius: 20, overflow: 'hidden', marginBottom: 28 },
  heroGrad: {
    borderRadius: 20, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 22,
    minHeight: 168, justifyContent: 'flex-end',
  },
  heroVenn:  { position: 'absolute', right: -20, top: -20 },
  heroGreeting: {
    color: '#fff', fontSize: 28, fontFamily: Typography.fontMedium,
    fontWeight: Typography.medium, letterSpacing: -0.5, lineHeight: 36, marginBottom: 10,
  },
  heroSub: { color: 'rgba(255,255,255,0.72)', fontSize: 22, fontFamily: Typography.fontRegular, marginBottom: 16 },
  heroPlatforms: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroPlatformsMore: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: Typography.medium },

  // ── Sections ────────────────────────────────────────────────────────────
  section:       { marginBottom: 28, paddingHorizontal: 24 },
  sectionEyebrow:{
    color: Colors.sub, fontSize: 16, fontFamily: Typography.fontMedium,
    fontWeight: Typography.medium, letterSpacing: 0.2, marginBottom: 4,
  },
  sectionTitle:  {
    color: Colors.text, fontSize: 22, fontFamily: Typography.fontMedium,
    fontWeight: Typography.medium, marginBottom: 14, letterSpacing: -0.3,
  },

  emptyGroups: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.s1, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, padding: 16, marginBottom: 14,
  },
  emptyGroupsText: { flex: 1, color: Colors.sub, fontSize: 16, lineHeight: 24 },

  historySeparator: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 24, marginBottom: 24,
  },
  historySeparatorLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  historySeparatorText: {
    color: Colors.sub, fontSize: 16, fontFamily: Typography.fontMedium, fontWeight: Typography.medium,
  },

  // Poster rows
  posterRowScroll:  { marginHorizontal: -24 },
  posterRowContent: { paddingHorizontal: 24, gap: 10 },
  posterCard: {
    width: POSTER_W, height: POSTER_H,
    borderRadius: 12, overflow: 'hidden', backgroundColor: Colors.s1,
  },
  posterPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  posterFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 90 },
  posterTitle: {
    position: 'absolute', bottom: 9, left: 9, right: 9,
    color: '#fff', fontSize: 14, fontFamily: Typography.fontMedium,
    fontWeight: Typography.medium, lineHeight: 18,
  },

  // Groups
  groupBtns:     { flexDirection: 'row', gap: 10, marginTop: 4 },
  createBtnWrap: { flex: 1 },
  createBtn:     { borderRadius: 12, paddingVertical: 16, alignItems: 'center', backgroundColor: '#1B50D4' },
  createBtnText: { color: '#fff', fontFamily: Typography.fontMedium, fontWeight: Typography.medium, fontSize: 18 },
  joinBtn:       { flex: 1, backgroundColor: Colors.s1, borderRadius: 12, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  joinBtnText:   { color: Colors.text, fontFamily: Typography.fontMedium, fontWeight: Typography.medium, fontSize: 18 },

  // Valorar card
  valorarCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.s1, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, padding: 14,
  },
  valorarCardText: { flex: 1, color: Colors.sub, fontSize: 15, lineHeight: 20 },

  // Modals
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal:         { backgroundColor: Colors.s1, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: Colors.border },
  modalTitle:    { color: Colors.text, fontSize: 22, fontFamily: Typography.fontMedium, fontWeight: Typography.medium, marginBottom: 20 },
  modalSubtitle: { color: Colors.sub, fontSize: 16, fontFamily: Typography.fontMedium, fontWeight: Typography.medium, marginBottom: 10, marginTop: 16 },
  input:         { backgroundColor: Colors.s2, borderRadius: 10, padding: 14, color: Colors.text, fontSize: 18, borderWidth: 1, borderColor: Colors.border },
  platformGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  platformChip:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.s2, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: Colors.border },
  platformChipSel: { borderColor: Colors.accentBorder, backgroundColor: Colors.accentFaint },
  platformName:  { color: Colors.text, fontSize: 18 },
  modalBtns:     { flexDirection: 'row', gap: 10 },
  cancelBtn:     { flex: 1, backgroundColor: Colors.s2, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { color: Colors.sub, fontFamily: Typography.fontMedium, fontWeight: Typography.medium, fontSize: 18 },
  confirmBtn:    { flex: 2, backgroundColor: Colors.accent, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  confirmBtnText:{ color: '#fff', fontFamily: Typography.fontMedium, fontWeight: Typography.medium, fontSize: 18 },
  btnDisabled:   { opacity: 0.4 },
  hintTouchable: { marginTop: 4, marginBottom: 4 },
  hintText:      { color: Colors.faint, fontSize: 16 },
  qrBtn:         { marginTop: 10, borderWidth: 1, borderColor: Colors.accent, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  qrBtnText:     { color: Colors.accent, fontSize: 18, fontWeight: '500' },
});
