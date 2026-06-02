import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Clipboard, Alert, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Colors, Typography } from '../constants/colors';
import Feather from '@expo/vector-icons/Feather';
import MemberChip from '../components/MemberChip';
import InviteModal from '../components/InviteModal';
import { useGroupStore } from '../store/useGroupStore';
import { useAuthStore } from '../store/useAuthStore';
import { PLATFORMS, getPlatform, type PlatformId } from '../constants/platforms';
import PlatformLogo from '../components/PlatformLogo';
import { updateGroupPlatforms, deleteGroup, fetchMemberNames, onGroupChange, clearGroupSession } from '../services/firebase';
import { sendGroupVoteNotification, getGroupMemberTokens } from '../services/notifications';
import type { RootStackParamList } from '../navigation/types';
import { MOCK_GROUP, MOCK_USERS } from '../utils/mock';

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Group'>;

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'true';

export default function GroupScreen() {
  const insets = useSafeAreaInsets();
  const nav    = useNavigation<Nav>();
  const route  = useRoute<Route>();
  const { user } = useAuthStore();
  const { groups, setCurrentGroup, addMemberToGroup, pendingInvites, updateGroup, removeGroup } = useGroupStore();

  const baseGroup = groups.find(g => g.id === route.params.groupId) ?? MOCK_GROUP;
  const [liveGroup, setLiveGroup] = useState(baseGroup);
  const group = liveGroup;
  const [inviteVisible,    setInviteVisible]    = useState(false);
  const [platformsVisible, setPlatformsVisible] = useState(false);
  const [editPlatforms,    setEditPlatforms]    = useState<PlatformId[]>(group.platforms);
  const [savingPlatforms,  setSavingPlatforms]  = useState(false);
  const [deleting,         setDeleting]         = useState(false);
  const [memberNames,      setMemberNames]       = useState<Record<string, string>>({});
  const isDeletingRef = useRef(false);

  // Real-time group listener
  useEffect(() => {
    if (USE_MOCK) return;
    const unsub = onGroupChange(route.params.groupId, updated => {
      if (!updated) {
        if (!isDeletingRef.current) {
          removeGroup(route.params.groupId);
          Alert.alert('Grupo eliminado', 'El creador eliminó este grupo.');
          nav.navigate('App');
        }
        return;
      }
      setLiveGroup(updated);
      updateGroup(updated.id, updated);
    });
    return unsub;
  }, [route.params.groupId]);

  // Cargar nombres reales de Firestore
  useEffect(() => {
    if (USE_MOCK) return;
    const unknownUids = group.members.filter(uid => uid !== user?.uid);
    if (unknownUids.length === 0) return;
    fetchMemberNames(unknownUids).then(setMemberNames).catch(() => {});
  }, [group.members]);

  function getMemberName(uid: string) {
    if (uid === user?.uid) return user?.displayName ?? 'Vos';
    if (USE_MOCK) return MOCK_USERS[uid]?.displayName ?? uid;
    return memberNames[uid] ?? '…';
  }

  function handleCopy() {
    Clipboard.setString(group.inviteCode);
    Alert.alert('Copiado', 'Código copiado al portapapeles');
  }

  async function handleFindMatch() {
    setCurrentGroup(group);
    // Limpiar sesión anterior ANTES de navegar para que ningún miembro
    // escriba su mood sobre datos stale — evita la race condition con clearGroupSession en MoodScreen
    if (!USE_MOCK) clearGroupSession(group.id).catch(() => {});
    nav.navigate('Mood', { groupId: group.id });
    if (!USE_MOCK && user) {
      try {
        const tokens = await getGroupMemberTokens(group.members, user.uid);
        if (tokens.length > 0) await sendGroupVoteNotification(tokens, group.name);
      } catch { /* non-blocking */ }
    }
  }

  function handleSimulateAccept() {
    addMemberToGroup(group.id, 'user-sofia');
    nav.navigate('Mood', { groupId: group.id });
  }

  function togglePlatform(id: PlatformId) {
    setEditPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  }

  async function savePlatforms() {
    if (editPlatforms.length === 0) {
      Alert.alert('Seleccioná al menos una plataforma');
      return;
    }
    setSavingPlatforms(true);
    try {
      if (!USE_MOCK) await updateGroupPlatforms(group.id, editPlatforms);
      updateGroup(group.id, { platforms: editPlatforms });
      setPlatformsVisible(false);
    } catch {
      Alert.alert('Error', 'No se pudieron guardar los cambios');
    } finally {
      setSavingPlatforms(false);
    }
  }

  function handleDeleteGroup() {
    Alert.alert(
      'Eliminar grupo',
      `¿Seguro que querés eliminar "${group.name}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            isDeletingRef.current = true;
            try {
              if (!USE_MOCK) await deleteGroup(group.id);
              removeGroup(group.id);
              nav.navigate('App');
            } catch {
              isDeletingRef.current = false;
              Alert.alert('Error', 'No se pudo eliminar el grupo');
              setDeleting(false);
            }
          },
        },
      ],
    );
  }

  const groupInvites = pendingInvites.filter(i => i.groupId === group.id);
  const isOwner = group.createdBy === user?.uid;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity style={styles.back} onPress={() => nav.goBack()}>
        <Feather name="arrow-left" size={18} color={Colors.sub} />
      </TouchableOpacity>

      <Text style={styles.eyebrow}>GRUPO</Text>
      <Text style={styles.title}>{group.name}</Text>

      <View style={styles.members}>
        {group.members.map(uid => (
          <MemberChip key={uid} name={getMemberName(uid)} />
        ))}
      </View>

      <View style={styles.codeBox}>
        <Text style={styles.codeLabel}>CÓDIGO DE INVITACIÓN</Text>
        <View style={styles.codeRow}>
          <Text style={styles.codeValue}>{group.inviteCode || '——'}</Text>
          <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
            <Text style={styles.copyBtnText}>Copiar</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.primaryBtn} onPress={handleFindMatch} activeOpacity={0.85}>
        <Text style={styles.primaryBtnText}>Encontrar algo para esta noche</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.outlineBtn} onPress={() => setInviteVisible(true)} activeOpacity={0.85}>
        <Text style={styles.outlineBtnText}>+ Invitar al grupo</Text>
      </TouchableOpacity>

      {groupInvites.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invitaciones enviadas</Text>
          {groupInvites.map(invite => (
            <View key={invite.email} style={styles.inviteRow}>
              <Text style={styles.inviteEmail}>{invite.email}</Text>
              <View style={[styles.inviteBadge, invite.status === 'accepted' && styles.inviteBadgeAccepted]}>
                <Text style={[styles.inviteBadgeText, invite.status === 'accepted' && styles.inviteBadgeTextAccepted]}>
                  {invite.status === 'accepted' ? 'Aceptó' : 'Pendiente'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Plataformas */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Plataformas</Text>
          <TouchableOpacity onPress={() => { setEditPlatforms(group.platforms); setPlatformsVisible(true); }}>
            <Text style={styles.editLink}>Editar</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.platforms}>
          {group.platforms.map(id => {
            const p = getPlatform(id);
            return (
              <View key={id} style={[styles.platformChip, { borderColor: `${p.color}66` }]}>
                <PlatformLogo id={id} size={24} />
                <Text style={[styles.platformName, { color: p.color }]}>{p.name}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Eliminar grupo — solo para el creador */}
      {isOwner && (
        <TouchableOpacity
          style={[styles.deleteBtn, deleting && { opacity: 0.5 }]}
          onPress={handleDeleteGroup}
          disabled={deleting}
          activeOpacity={0.8}
        >
          <Text style={styles.deleteBtnText}>
            {deleting ? 'Eliminando…' : 'Eliminar grupo'}
          </Text>
        </TouchableOpacity>
      )}

      <InviteModal
        visible={inviteVisible}
        onClose={() => setInviteVisible(false)}
        group={group}
        onSimulateAccept={handleSimulateAccept}
      />

      {/* Modal editar plataformas */}
      <Modal visible={platformsVisible} transparent animationType="slide" onRequestClose={() => setPlatformsVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.modalTitle}>Plataformas disponibles</Text>
            <Text style={styles.modalSub}>Seleccioná las que tiene el grupo</Text>

            <View style={styles.platformGrid}>
              {PLATFORMS.map(p => {
                const selected = editPlatforms.includes(p.id);
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.platformOption, { borderColor: selected ? p.color : Colors.border }, selected && { backgroundColor: `${p.color}18` }]}
                    onPress={() => togglePlatform(p.id)}
                    activeOpacity={0.75}
                  >
                    <PlatformLogo id={p.id} size={28} />
                    <Text style={[styles.platformOptionName, selected && { color: p.color }]}>{p.name}</Text>
                    {selected && <Text style={[styles.checkmark, { color: p.color }]}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={[styles.primaryBtn, savingPlatforms && { opacity: 0.6 }]} onPress={savePlatforms} disabled={savingPlatforms} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>{savingPlatforms ? 'Guardando…' : 'Guardar cambios'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setPlatformsVisible(false)}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: 24 },
  back: { marginBottom: 20, alignSelf: 'flex-start', padding: 4 },
  eyebrow: { color: Colors.sub, fontSize: Typography.tiny, letterSpacing: 2, marginBottom: 6 },
  title: { color: Colors.text, fontSize: Typography.hero, fontWeight: Typography.black, marginBottom: 20 },
  members: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 24 },
  codeBox: { backgroundColor: Colors.s1, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  codeLabel: { color: Colors.faint, fontSize: Typography.tiny, fontWeight: Typography.semibold, letterSpacing: 1, marginBottom: 8 },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  codeValue: { color: Colors.accent, fontFamily: 'monospace', fontSize: 22, fontWeight: Typography.bold, letterSpacing: 4 },
  copyBtn: { backgroundColor: Colors.s2, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.border },
  copyBtnText: { color: Colors.sub, fontSize: Typography.small },
  primaryBtn: { backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 18, alignItems: 'center', marginBottom: 12 },
  primaryBtnText: { color: Colors.text, fontWeight: Typography.bold, fontSize: Typography.body },
  outlineBtn: { borderRadius: 12, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: Colors.border2, marginBottom: 28 },
  outlineBtnText: { color: Colors.text, fontWeight: Typography.semibold, fontSize: Typography.body },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { color: Colors.text, fontSize: Typography.h3, fontWeight: Typography.bold },
  editLink: { color: Colors.accent, fontSize: Typography.small },
  inviteRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  inviteEmail: { color: Colors.sub, fontSize: Typography.small },
  inviteBadge: { backgroundColor: Colors.s2, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  inviteBadgeAccepted: { backgroundColor: 'rgba(48,192,96,0.15)' },
  inviteBadgeText: { color: Colors.faint, fontSize: Typography.tiny },
  inviteBadgeTextAccepted: { color: Colors.success },
  platforms: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  platformChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.s1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1 },
  platformName: { fontSize: Typography.body, fontWeight: Typography.medium },
  deleteBtn: { marginTop: 8, borderRadius: 12, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: Colors.danger },
  deleteBtnText: { color: Colors.danger, fontSize: Typography.body, fontWeight: Typography.medium },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.s1, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle: { color: Colors.text, fontSize: Typography.h3, fontWeight: Typography.black, marginBottom: 4 },
  modalSub: { color: Colors.sub, fontSize: Typography.small, marginBottom: 24 },
  platformGrid: { gap: 10, marginBottom: 24 },
  platformOption: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 14 },
  platformOptionEmoji: { fontSize: 28 },
  platformOptionName: { flex: 1, color: Colors.sub, fontSize: Typography.body, fontWeight: Typography.medium },
  checkmark: { fontSize: 16, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelBtnText: { color: Colors.sub, fontSize: Typography.body },
});
