import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Share, Clipboard } from 'react-native';
import BottomSheet from './BottomSheet';
import QRCode from './QRCode';
import { Colors, Typography } from '../constants/colors';
import { useAuthStore } from '../store/useAuthStore';
import type { GroupDoc } from '../services/firebase';

interface Props {
  visible: boolean;
  onClose: () => void;
  group: GroupDoc;
}

type TabId = 'link' | 'qr';

export default function InviteModal({ visible, onClose, group }: Props) {
  const [tab, setTab]       = useState<TabId>('link');
  const [copied, setCopied] = useState(false);
  const copiedTimer         = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { user }            = useAuthStore();

  useEffect(() => () => { if (copiedTimer.current) clearTimeout(copiedTimer.current); }, []);

  const inviteLink = `https://queponemos.web.app?code=${group.inviteCode}&from=${encodeURIComponent(user?.email ?? '')}`;

  async function handleShare() {
    const from = user?.displayName ?? user?.email ?? 'alguien';
    try {
      await Share.share({
        message: `${from} te invita a queponemos\n\nElegí qué ver juntos: ${inviteLink}\nCódigo: ${group.inviteCode}`,
      });
    } catch { /* usuario canceló o el SO no tiene apps disponibles */ }
  }

  function handleCopyLink() {
    Clipboard.setString(inviteLink);
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.container}>
        <Text style={styles.title}>Invitar al grupo</Text>

        <View style={styles.tabs}>
          {(['link', 'qr'] as TabId[]).map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, tab === t && styles.tabActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
                {t === 'link' ? 'Link' : 'Código QR'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'link' ? (
          <View style={styles.linkSection}>
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>CÓDIGO DE SALA</Text>
              <Text style={styles.codeValue}>{group.inviteCode}</Text>
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleShare} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Compartir invitación</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.outlineBtn} onPress={handleCopyLink} activeOpacity={0.85}>
              <Text style={styles.outlineBtnText}>{copied ? '✓ Link copiado' : 'Copiar link'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.qrSection}>
            <QRCode value={inviteLink} size={180} />
            <Text style={styles.qrText}>Escaneá este código para unirte al grupo</Text>
            <Text style={styles.codeDisplay}>{group.inviteCode}</Text>
          </View>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 24 },
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
  tabLabelActive: { color: Colors.text, fontWeight: Typography.medium },
  linkSection: { gap: 12 },
  codeBox: {
    backgroundColor: Colors.s2,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    marginBottom: 4,
  },
  codeLabel: {
    color: Colors.faint,
    fontSize: Typography.tiny,
    fontWeight: Typography.medium,
    letterSpacing: 1,
    marginBottom: 8,
  },
  codeValue: {
    color: Colors.accent,
    fontFamily: Typography.fontMedium,
    fontSize: Typography.hero,
    fontWeight: Typography.medium,
    letterSpacing: 6,
  },
  primaryBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: Colors.text, fontWeight: Typography.bold, fontSize: Typography.body },
  outlineBtn: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  outlineBtnText: { color: Colors.sub, fontSize: Typography.body },
  qrSection: { alignItems: 'center', paddingVertical: 10, gap: 16 },
  qrText: { color: Colors.sub, fontSize: Typography.small, textAlign: 'center' },
  codeDisplay: {
    color: Colors.accent,
    fontFamily: Typography.fontMedium,
    fontSize: Typography.h2,
    fontWeight: Typography.bold,
    letterSpacing: 4,
  },
});
