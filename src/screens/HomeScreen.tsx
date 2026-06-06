import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Modal, Alert,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
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
  const { user } = useAuthStore();
  const { groups, addGroup, setCurrentGroup, pendingInviteCode, setPendingInviteCode } = useGroupStore();
  const themeColors = useColors();

  const { setPlatforms } = useAuthStore();

  const firstName = user?.displayName?.split(' ')[0] ?? '';

  const [createModal, setCreateModal] = useState(false);
  const [joinModal,   setJoinModal]   = useState(false);
  const [groupName, setGroupName]     = useState('');
  const [joinCode,  setJoinCode]      = useState('');
  const [selPlatforms, setSelPlatforms] = useState<PlatformId[]>(['netflix']);
  const [working, setWorking] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [soloPlatformModal, setSoloPlatformModal] = useState(false);
  const [soloPlatforms, setSoloPlatforms] = useState<PlatformId[]>([]);

  // Process deep link invite code
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
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header blueprint */}
      <View style={styles.header}>
        <LogoWordmark markSize={20} />
      </View>
      {firstName ? <Text style={styles.greeting}>Hola, {firstName}</Text> : null}
      <Text style={styles.headline}>¿queponemos hoy?</Text>

      {/* Solo card */}
      <TouchableOpacity style={styles.soloCard} onPress={handleSoloPress} activeOpacity={0.85}>
        <View style={styles.soloCardInner}>
          <View style={styles.soloCardIcon}>
            <Feather name="play-circle" size={22} color={Colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.soloCardTitle}>¿Qué ves hoy?</Text>
            <Text style={styles.soloCardSub}>Modo solo · tus plataformas · tu mood</Text>
          </View>
          <Feather name="chevron-right" size={20} color={Colors.sub} />
        </View>
      </TouchableOpacity>

      {/* Grupos */}
      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Tus grupos</Text>
        </View>

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

      {/* Perfil */}
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

      {/* Modal Crear */}
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

      {/* Modal Unirse */}
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
            <TouchableOpacity
              style={styles.hintTouchable}
              onPress={() => setJoinCode('SM7VK2')}
            >
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

      {/* Modal plataformas solo */}
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
  content: { paddingHorizontal: 24 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 4,
    marginBottom: 4,
  },
  greeting: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.body,
    color: Colors.sub,
    marginBottom: 2,
  },
  headline: {
    fontFamily: Typography.fontMedium,
    fontSize: 26,
    fontWeight: Typography.medium,
    color: Colors.text,
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  section: { marginBottom: 32 },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: Typography.fontMedium,
    color: Colors.faint,
    fontSize: Typography.tiny,
    fontWeight: Typography.medium,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionAction: {
    fontFamily: Typography.fontMedium,
    color: Colors.accent,
    fontSize: Typography.small,
    fontWeight: Typography.medium,
  },
  soloCard: {
    backgroundColor: Colors.accentFaint,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.accentBorder,
    padding: 18,
    marginBottom: 28,
  },
  soloCardInner: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  soloCardIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.accentFaint, alignItems: 'center', justifyContent: 'center' },
  soloCardTitle: { color: Colors.accent, fontSize: Typography.h3, fontWeight: Typography.bold },
  soloCardSub: { color: Colors.sub, fontSize: Typography.small, marginTop: 2 },
  emptyText: { color: Colors.faint, fontSize: Typography.small, marginBottom: 16 },
  groupBtns: { flexDirection: 'row', gap: 10 },
  createBtn: {
    flex: 1,
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  createBtnText: { color: Colors.text, fontWeight: Typography.bold, fontSize: Typography.body },
  joinBtn: {
    flex: 1,
    backgroundColor: Colors.s1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  joinBtnText: { color: Colors.text, fontWeight: Typography.semibold, fontSize: Typography.body },

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
  genreTagTextAccent: { color: Colors.accent, fontWeight: Typography.semibold },
  ratingCount: { color: Colors.faint, fontSize: Typography.small },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: Colors.s1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalTitle: {
    color: Colors.text,
    fontSize: Typography.h2,
    fontWeight: Typography.bold,
    marginBottom: 20,
  },
  modalSubtitle: {
    color: Colors.sub,
    fontSize: Typography.small,
    fontWeight: Typography.semibold,
    marginBottom: 10,
    marginTop: 16,
  },
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
  cancelBtn: {
    flex: 1,
    backgroundColor: Colors.s2,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: { color: Colors.sub, fontWeight: Typography.semibold },
  confirmBtn: {
    flex: 2,
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBtnText: { color: Colors.text, fontWeight: Typography.bold },
  btnDisabled: { opacity: 0.4 },
  hintTouchable: { marginTop: 4, marginBottom: 4 },
  hintText: { color: Colors.faint, fontSize: Typography.small },
  qrBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  qrBtnText: { color: Colors.accent, fontSize: Typography.body, fontWeight: '500' },
});
