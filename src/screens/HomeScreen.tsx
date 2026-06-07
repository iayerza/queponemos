import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, Alert, Image,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
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
import { createGroup, joinGroupByCode, updateUserPlatforms } from '../services/firebase';
import QRScanner from '../components/QRScanner';
import { PLATFORMS } from '../constants/platforms';
import type { PlatformId } from '../constants/platforms';
import { MOCK_GROUP } from '../utils/mock';

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'true';
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const nav    = useNavigation<Nav>();
  const { user, setPlatforms } = useAuthStore();
  const { groups, addGroup, setCurrentGroup, pendingInviteCode, setPendingInviteCode } = useGroupStore();
  const { history } = useMatchStore();
  const themeColors = useColors();

  const firstName = user?.displayName?.split(' ')[0] ?? '';

  const [createModal, setCreateModal]       = useState(false);
  const [joinModal,   setJoinModal]         = useState(false);
  const [groupName, setGroupName]           = useState('');
  const [joinCode,  setJoinCode]            = useState('');
  const [selPlatforms, setSelPlatforms]     = useState<PlatformId[]>(['netflix']);
  const [working, setWorking]               = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [soloPlatformModal, setSoloPlatformModal] = useState(false);
  const [soloPlatforms, setSoloPlatforms]   = useState<PlatformId[]>([]);

  // Posters únicos de las últimas sesiones (máx 12)
  const recentPosters = useMemo(() => {
    const seen = new Set<string>();
    const out: { posterPath: string; title: string }[] = [];
    for (const entry of history) {
      for (const rec of entry.recommendations ?? []) {
        if (rec.posterPath && !seen.has(rec.posterPath) && out.length < 12) {
          seen.add(rec.posterPath);
          out.push({ posterPath: rec.posterPath, title: rec.title });
        }
      }
    }
    return out;
  }, [history]);

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
                addGroup(group);
                setCurrentGroup(group);
                nav.navigate('Group', { groupId });
              }
            } catch {
              Alert.alert('Error', 'Código inválido o el grupo ya no existe.');
            }
          },
        },
      ],
    );
  }, [pendingInviteCode, user]);

  const topGenres = Object.entries(user?.tasteProfile?.genres ?? {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([g]) => g);

  function handleGroupPress(groupId: string) {
    const group = groups.find(g => g.id === groupId) ?? MOCK_GROUP;
    setCurrentGroup(group);
    nav.navigate('Group', { groupId });
  }

  function togglePlatform(id: PlatformId) {
    setSelPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  }

  async function handleCreate() {
    if (!groupName.trim() || !user) return;
    setWorking(true);
    try {
      if (USE_MOCK) {
        const fakeGroup = { ...MOCK_GROUP, id: `g-${Date.now()}`, name: groupName, members: [user.uid], platforms: selPlatforms };
        addGroup(fakeGroup);
        setCurrentGroup(fakeGroup);
        setCreateModal(false);
        setGroupName('');
        nav.navigate('Group', { groupId: fakeGroup.id });
      } else {
        const { groupId, inviteCode } = await createGroup(user.uid, { name: groupName, platforms: selPlatforms, country: 'AR' });
        const group = { id: groupId, name: groupName, members: [user.uid], createdBy: user.uid, inviteCode, platforms: selPlatforms, country: 'AR' };
        addGroup(group);
        setCurrentGroup(group);
        setCreateModal(false);
        setGroupName('');
        nav.navigate('Group', { groupId });
      }
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setWorking(false);
    }
  }

  function handleSoloPress() {
    const hasPlatforms = (user?.platforms ?? []).length > 0;
    if (hasPlatforms) {
      nav.navigate('Mood', { solo: true });
    } else {
      setSoloPlatforms(['netflix']);
      setSoloPlatformModal(true);
    }
  }

  async function handleSoloPlatformSave() {
    if (!user || soloPlatforms.length === 0) return;
    try {
      if (!USE_MOCK) await updateUserPlatforms(user.uid, soloPlatforms);
      setPlatforms(soloPlatforms);
    } catch { /* silenciar */ }
    setSoloPlatformModal(false);
    nav.navigate('Mood', { solo: true });
  }

  async function handleScannedCode(code: string) {
    setScannerVisible(false);
    setJoinCode(code);
    setJoinModal(true);
  }

  async function handleJoin() {
    if (!joinCode.trim() || !user) return;
    setWorking(true);
    try {
      if (USE_MOCK) {
        addGroup({ ...MOCK_GROUP, inviteCode: joinCode.toUpperCase() });
        setCurrentGroup(MOCK_GROUP);
        setJoinModal(false);
        setJoinCode('');
        nav.navigate('Group', { groupId: MOCK_GROUP.id });
      } else {
        const { groupId, group } = await joinGroupByCode(user.uid, joinCode);
        addGroup(group);
        setCurrentGroup(group);
        setJoinModal(false);
        setJoinCode('');
        nav.navigate('Group', { groupId });
      }
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setWorking(false);
    }
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: themeColors.bg }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <LogoWordmark markSize={20} />
        {firstName ? <Text style={styles.greeting}>Hola, {firstName}</Text> : null}
      </View>

      {/* ── Hero: modo solo ──────────────────────────────────────── */}
      <TouchableOpacity onPress={handleSoloPress} activeOpacity={0.88} style={styles.heroWrap}>
        <LinearGradient
          colors={['#0D27A0', '#1B50D4', '#2A6AEC']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroGrad}
        >
          {/* Venn decorativo en fondo */}
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
              <Text style={styles.heroSub}>Modo solo · tus plataformas · tu mood</Text>
            </View>
            <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.45)" />
          </View>

          <Text style={styles.heroTagline}>LA PELI PARA HOY</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* ── Recientes ────────────────────────────────────────────── */}
      {recentPosters.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recientes</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.posterRow}
            contentContainerStyle={{ paddingHorizontal: 24, gap: 10 }}
          >
            {recentPosters.map((item, i) => (
              <View key={i} style={styles.miniPoster}>
                <Image
                  source={{ uri: getPosterUrl(item.posterPath) ?? '' }}
                  style={styles.miniPosterImg}
                  resizeMode="cover"
                />
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Grupos ───────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tus grupos</Text>

        {groups.length === 0 && (
          <Text style={styles.emptyText}>Todavía no tenés grupos. ¡Creá uno!</Text>
        )}

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

      {/* ── Perfil ───────────────────────────────────────────────── */}
      {topGenres.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tu perfil</Text>
          <View style={styles.genreTags}>
            {topGenres.map((g, i) => (
              <View key={g} style={[styles.genreTag, i === 0 && styles.genreTagAccent]}>
                <Text style={[styles.genreTagText, i === 0 && styles.genreTagTextAccent]}>{g}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.ratingCount}>
            {Object.keys(user?.ratings ?? {}).length} títulos calificados
          </Text>
        </View>
      )}

      {/* ── Modal Crear ──────────────────────────────────────────── */}
      <Modal visible={createModal} transparent animationType="slide" onRequestClose={() => setCreateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Crear grupo</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre del grupo"
              placeholderTextColor={Colors.faint}
              value={groupName}
              onChangeText={setGroupName}
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
                onPress={handleCreate}
                disabled={!groupName.trim() || working}
              >
                <Text style={styles.confirmBtnText}>{working ? 'Creando…' : 'Crear'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal Unirse ─────────────────────────────────────────── */}
      <Modal visible={joinModal} transparent animationType="slide" onRequestClose={() => setJoinModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Unirme a un grupo</Text>
            <TextInput
              style={styles.input}
              placeholder="Código de invitación (ej: SM7VK2)"
              placeholderTextColor={Colors.faint}
              value={joinCode}
              onChangeText={t => setJoinCode(t.toUpperCase())}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={styles.qrBtn}
              onPress={() => { setJoinModal(false); setScannerVisible(true); }}
            >
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
                onPress={handleJoin}
                disabled={!joinCode.trim() || working}
              >
                <Text style={styles.confirmBtnText}>{working ? 'Buscando…' : 'Unirme'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal plataformas solo ───────────────────────────────── */}
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
                onPress={handleSoloPlatformSave}
                disabled={soloPlatforms.length === 0}
              >
                <Text style={styles.confirmBtnText}>Continuar →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <QRScanner
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScan={handleScannedCode}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: 0 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 18,
  },
  greeting: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.small,
    color: Colors.sub,
  },

  // ── Hero ─────────────────────────────────────────────────────────
  heroWrap: {
    marginHorizontal: 24,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 28,
  },
  heroGrad: {
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    minHeight: 148,
    justifyContent: 'space-between',
  },
  heroVenn: {
    position: 'absolute',
    right: -30,
    top: -30,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroPlayBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { flex: 1 },
  heroTitle: {
    color: '#fff',
    fontSize: Typography.h2,
    fontWeight: Typography.medium,
    letterSpacing: -0.3,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: Typography.small,
    marginTop: 4,
  },
  heroTagline: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: Typography.tiny,
    fontWeight: Typography.medium,
    letterSpacing: 2,
    marginTop: 18,
  },

  // ── Recientes ────────────────────────────────────────────────────
  posterRow: { marginHorizontal: -24 },
  miniPoster: {
    width: 82,
    height: 122,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: Colors.s1,
  },
  miniPosterImg: { width: '100%', height: '100%' },

  // ── Secciones ────────────────────────────────────────────────────
  section: { marginBottom: 28, paddingHorizontal: 24 },
  sectionTitle: {
    fontFamily: Typography.fontMedium,
    color: Colors.faint,
    fontSize: Typography.tiny,
    fontWeight: Typography.medium,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 14,
  },
  emptyText: { color: Colors.faint, fontSize: Typography.small, marginBottom: 16 },

  groupBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  createBtn: {
    flex: 1,
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  createBtnText: { color: '#fff', fontWeight: Typography.medium, fontSize: Typography.body },
  joinBtn: {
    flex: 1,
    backgroundColor: Colors.s1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  joinBtnText: { color: Colors.text, fontWeight: Typography.medium, fontSize: Typography.body },

  genreTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  genreTag: {
    backgroundColor: Colors.s2,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  genreTagAccent: { backgroundColor: Colors.accentFaint, borderColor: Colors.accentBorder },
  genreTagText: { color: Colors.sub, fontSize: Typography.small },
  genreTagTextAccent: { color: Colors.accent, fontWeight: Typography.medium },
  ratingCount: { color: Colors.faint, fontSize: Typography.small },

  // ── Modales ──────────────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: Colors.s1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalTitle: { color: Colors.text, fontSize: Typography.h2, fontWeight: Typography.medium, marginBottom: 20 },
  modalSubtitle: { color: Colors.sub, fontSize: Typography.small, fontWeight: Typography.medium, marginBottom: 10, marginTop: 16 },
  input: {
    backgroundColor: Colors.s2,
    borderRadius: 10,
    padding: 14,
    color: Colors.text,
    fontSize: Typography.body,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  platformGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  platformChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.s2,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  platformChipSelected: { borderColor: Colors.accentBorder, backgroundColor: Colors.accentFaint },
  platformName: { color: Colors.text, fontSize: Typography.body },
  modalBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, backgroundColor: Colors.s2, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { color: Colors.sub, fontWeight: Typography.medium },
  confirmBtn: { flex: 2, backgroundColor: Colors.accent, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontWeight: Typography.medium },
  btnDisabled: { opacity: 0.4 },
  hintTouchable: { marginTop: 4, marginBottom: 4 },
  hintText: { color: Colors.faint, fontSize: Typography.small },
  qrBtn: { marginTop: 10, borderWidth: 1, borderColor: Colors.accent, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  qrBtnText: { color: Colors.accent, fontSize: Typography.body, fontWeight: '500' },
});
