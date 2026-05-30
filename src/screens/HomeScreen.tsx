import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Modal, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Typography } from '../constants/colors';
import { LogoWordmark } from '../components/Logo';
import GroupCard from '../components/GroupCard';
import { useAuthStore } from '../store/useAuthStore';
import { useGroupStore } from '../store/useGroupStore';
import type { RootStackParamList } from '../navigation/types';
import { createGroup, joinGroupByCode } from '../services/firebase';
import { PLATFORMS } from '../constants/platforms';
import type { PlatformId } from '../constants/platforms';
import { MOCK_GROUP } from '../utils/mock';

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'true';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const nav    = useNavigation<Nav>();
  const { user } = useAuthStore();
  const { groups, addGroup, setCurrentGroup } = useGroupStore();

  const [createModal, setCreateModal] = useState(false);
  const [joinModal,   setJoinModal]   = useState(false);
  const [groupName, setGroupName]     = useState('');
  const [joinCode,  setJoinCode]      = useState('');
  const [selPlatforms, setSelPlatforms] = useState<PlatformId[]>(['netflix']);
  const [working, setWorking] = useState(false);

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
        const { groupId } = await createGroup(user.uid, { name: groupName, platforms: selPlatforms, country: 'AR' });
        const group = { id: groupId, name: groupName, members: [user.uid], createdBy: user.uid, inviteCode: '', platforms: selPlatforms, country: 'AR' };
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
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header blueprint */}
      <View style={styles.header}>
        <LogoWordmark markSize={20} />
      </View>
      <Text style={styles.headline}>¿QuePonemos hoy?</Text>

      {/* Grupos */}
      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Tus grupos</Text>
          <Text style={styles.sectionAction}>nuevo +</Text>
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
            <Text style={styles.joinBtnText}>🔗 Unirme</Text>
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
                  <Text style={styles.platformEmoji}>{p.emoji}</Text>
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
              style={styles.hintTouchable}
              onPress={() => setJoinCode('SM7VK2')}
            >
              <Text style={styles.hintText}>💡 Demo: probá con SM7VK2</Text>
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
    gap: 6,
    backgroundColor: Colors.s2,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  platformChipSelected: { borderColor: Colors.accentBorder, backgroundColor: Colors.accentFaint },
  platformEmoji: { fontSize: 14 },
  platformName: { color: Colors.text, fontSize: Typography.small },
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
  hintTouchable: { marginTop: 10, marginBottom: 4 },
  hintText: { color: Colors.accent, fontSize: Typography.small },
});
