import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Clipboard, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Colors, Typography } from '../constants/colors';
import MemberChip from '../components/MemberChip';
import InviteModal from '../components/InviteModal';
import { useGroupStore } from '../store/useGroupStore';
import { useAuthStore } from '../store/useAuthStore';
import { getPlatform } from '../constants/platforms';
import type { RootStackParamList } from '../navigation/types';
import { MOCK_GROUP, MOCK_USERS } from '../utils/mock';

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Group'>;

export default function GroupScreen() {
  const insets = useSafeAreaInsets();
  const nav    = useNavigation<Nav>();
  const route  = useRoute<Route>();
  const { user } = useAuthStore();
  const { groups, setCurrentGroup, addMemberToGroup, pendingInvites } = useGroupStore();

  const group = groups.find(g => g.id === route.params.groupId) ?? MOCK_GROUP;
  const [inviteVisible, setInviteVisible] = useState(false);

  function getMemberName(uid: string) {
    if (uid === user?.uid) return user.displayName;
    return MOCK_USERS[uid]?.displayName ?? uid;
  }

  function handleCopy() {
    Clipboard.setString(group.inviteCode);
    Alert.alert('Copiado', 'Código copiado al portapapeles');
  }

  function handleFindMatch() {
    setCurrentGroup(group);
    nav.navigate('Mood', { groupId: group.id });
  }

  function handleSimulateAccept() {
    addMemberToGroup(group.id, 'user-sofia');
    nav.navigate('Mood', { groupId: group.id });
  }

  const groupInvites = pendingInvites.filter(i => i.groupId === group.id);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity style={styles.back} onPress={() => nav.goBack()}>
        <Text style={styles.backText}>← VOLVER</Text>
      </TouchableOpacity>

      <Text style={styles.eyebrow}>GRUPO</Text>
      <Text style={styles.title}>{group.name}</Text>

      {/* Miembros */}
      <View style={styles.members}>
        {group.members.map(uid => (
          <MemberChip key={uid} name={getMemberName(uid)} />
        ))}
      </View>

      {/* Código de invitación */}
      <View style={styles.codeBox}>
        <Text style={styles.codeLabel}>CÓDIGO DE INVITACIÓN</Text>
        <View style={styles.codeRow}>
          <Text style={styles.codeValue}>{group.inviteCode}</Text>
          <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
            <Text style={styles.copyBtnText}>Copiar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Acciones */}
      <TouchableOpacity style={styles.primaryBtn} onPress={handleFindMatch} activeOpacity={0.85}>
        <Text style={styles.primaryBtnText}>🎬 Encontrar algo para esta noche</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.outlineBtn} onPress={() => setInviteVisible(true)} activeOpacity={0.85}>
        <Text style={styles.outlineBtnText}>+ Invitar al grupo</Text>
      </TouchableOpacity>

      {/* Invitaciones */}
      {groupInvites.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invitaciones enviadas</Text>
          {groupInvites.map(invite => (
            <View key={invite.email} style={styles.inviteRow}>
              <Text style={styles.inviteEmail}>{invite.email}</Text>
              <View style={[
                styles.inviteBadge,
                invite.status === 'accepted' && styles.inviteBadgeAccepted,
              ]}>
                <Text style={[
                  styles.inviteBadgeText,
                  invite.status === 'accepted' && styles.inviteBadgeTextAccepted,
                ]}>
                  {invite.status === 'accepted' ? 'Aceptó' : 'Pendiente'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Plataformas */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Plataformas</Text>
        <View style={styles.platforms}>
          {group.platforms.map(id => {
            const p = getPlatform(id);
            return (
              <View key={id} style={[styles.platformChip, { borderColor: `${p.color}66` }]}>
                <Text style={styles.platformEmoji}>{p.emoji}</Text>
                <Text style={[styles.platformName, { color: p.color }]}>{p.name}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <InviteModal
        visible={inviteVisible}
        onClose={() => setInviteVisible(false)}
        group={group}
        onSimulateAccept={handleSimulateAccept}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: 24 },
  back: { marginBottom: 20 },
  backText: { color: Colors.sub, fontSize: Typography.tiny, fontWeight: Typography.semibold, letterSpacing: 1 },
  eyebrow: { color: Colors.sub, fontSize: Typography.tiny, letterSpacing: 2, marginBottom: 6 },
  title: { color: Colors.text, fontSize: Typography.hero, fontWeight: Typography.black, marginBottom: 20 },
  members: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 24 },
  codeBox: {
    backgroundColor: Colors.s1,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  codeLabel: {
    color: Colors.faint,
    fontSize: Typography.tiny,
    fontWeight: Typography.semibold,
    letterSpacing: 1,
    marginBottom: 8,
  },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  codeValue: { color: Colors.accent, fontFamily: 'monospace', fontSize: 22, fontWeight: Typography.bold, letterSpacing: 4 },
  copyBtn: {
    backgroundColor: Colors.s2,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  copyBtnText: { color: Colors.sub, fontSize: Typography.small },
  primaryBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: { color: Colors.text, fontWeight: Typography.bold, fontSize: Typography.body },
  outlineBtn: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border2,
    marginBottom: 28,
  },
  outlineBtnText: { color: Colors.text, fontWeight: Typography.semibold, fontSize: Typography.body },
  section: { marginBottom: 24 },
  sectionTitle: { color: Colors.text, fontSize: Typography.h3, fontWeight: Typography.bold, marginBottom: 12 },
  inviteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  inviteEmail: { color: Colors.sub, fontSize: Typography.small },
  inviteBadge: {
    backgroundColor: Colors.s2,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  inviteBadgeAccepted: { backgroundColor: 'rgba(48,192,96,0.15)' },
  inviteBadgeText: { color: Colors.faint, fontSize: Typography.tiny },
  inviteBadgeTextAccepted: { color: Colors.success },
  platforms: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  platformChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.s1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  platformEmoji: { fontSize: 14 },
  platformName: { fontSize: Typography.small, fontWeight: Typography.medium },
});
