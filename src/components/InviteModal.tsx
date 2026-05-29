import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import BottomSheet from './BottomSheet';
import QRCode from './QRCode';
import { Colors, Typography } from '../constants/colors';
import { useGroupStore } from '../store/useGroupStore';
import { useAuthStore } from '../store/useAuthStore';
import type { GroupDoc } from '../services/firebase';

interface Props {
  visible: boolean;
  onClose: () => void;
  group: GroupDoc;
  onSimulateAccept: () => void;
}

type TabId = 'email' | 'qr';

export default function InviteModal({ visible, onClose, group, onSimulateAccept }: Props) {
  const [tab, setTab]       = useState<TabId>('email');
  const [email, setEmail]   = useState('');
  const [sent, setSent]     = useState(false);
  const { addPendingInvite } = useGroupStore();
  const { user }             = useAuthStore();

  const qrValue = `streammatch.app/join?code=${group.inviteCode}&from=${user?.email ?? ''}`;

  function handleSend() {
    if (!email.trim()) return;
    addPendingInvite({ email: email.trim(), groupId: group.id, status: 'pending' });
    setSent(true);
  }

  function handleSimulate() {
    onSimulateAccept();
    setSent(false);
    setEmail('');
    onClose();
  }

  return (
    <BottomSheet visible={visible} onClose={() => { setSent(false); onClose(); }}>
      <View style={styles.container}>
        <Text style={styles.title}>Invitar al grupo</Text>

        <View style={styles.tabs}>
          {(['email', 'qr'] as TabId[]).map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, tab === t && styles.tabActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
                {t === 'email' ? '✉️  Email' : '⬛  Código QR'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'email' ? (
          sent ? (
            <View style={styles.sentBox}>
              <Text style={styles.sentTitle}>✅ Invitación enviada a</Text>
              <Text style={styles.sentEmail}>{email}</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleSimulate}>
                <Text style={styles.primaryBtnText}>Simular que aceptó → Ver match</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <TextInput
                style={styles.input}
                placeholder="Email del invitado"
                placeholderTextColor={Colors.faint}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.hint}
                onPress={() => setEmail('sofiamagnasco@gmail.com')}
              >
                <Text style={styles.hintText}>
                  💡 Demo: probá con sofiamagnasco@gmail.com
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, !email.trim() && styles.primaryBtnDisabled]}
                onPress={handleSend}
                disabled={!email.trim()}
              >
                <Text style={styles.primaryBtnText}>Enviar invitación</Text>
              </TouchableOpacity>
            </View>
          )
        ) : (
          <View style={styles.qrSection}>
            <QRCode value={qrValue} size={180} />
            <Text style={styles.qrText}>
              Escaneá este código para unirte al grupo
            </Text>
            <Text style={styles.codeDisplay}>{group.inviteCode}</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleSimulate}>
              <Text style={styles.primaryBtnText}>📷 Simular escaneo → Ver match</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20 },
  title: {
    color: Colors.text,
    fontSize: Typography.h2,
    fontWeight: Typography.bold,
    marginBottom: 20,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.s2,
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 7,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: Colors.s3 },
  tabLabel: { color: Colors.sub, fontSize: Typography.small },
  tabLabelActive: { color: Colors.text, fontWeight: Typography.semibold },
  input: {
    backgroundColor: Colors.s2,
    borderRadius: 10,
    padding: 14,
    color: Colors.text,
    fontSize: Typography.body,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  hint: { marginBottom: 16 },
  hintText: { color: Colors.accent, fontSize: Typography.small },
  primaryBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { color: Colors.text, fontWeight: Typography.bold, fontSize: Typography.body },
  sentBox: { alignItems: 'center', paddingVertical: 10 },
  sentTitle: { color: Colors.sub, fontSize: Typography.body, marginBottom: 6 },
  sentEmail: { color: Colors.text, fontWeight: Typography.bold, fontSize: Typography.h3, marginBottom: 20 },
  qrSection: { alignItems: 'center', paddingVertical: 10, gap: 16 },
  qrText: { color: Colors.sub, fontSize: Typography.small, textAlign: 'center' },
  codeDisplay: {
    color: Colors.accent,
    fontFamily: 'monospace',
    fontSize: Typography.h2,
    fontWeight: Typography.bold,
    letterSpacing: 4,
  },
});
