import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import WebView from 'react-native-webview';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography } from '../constants/colors';

interface Props {
  visible: boolean;
  youtubeKey: string;
  title: string;
  onClose: () => void;
}

export default function TrailerModal({ visible, youtubeKey, title, onClose }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Feather name="x" size={22} color={Colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.videoWrapper}>
          <WebView
            source={{ uri: `https://www.youtube.com/embed/${youtubeKey}?autoplay=1&playsinline=1&rel=0` }}
            style={styles.webview}
            allowsFullscreenVideo
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
          />
        </View>

        <TouchableOpacity style={styles.closeRow} onPress={onClose} activeOpacity={0.8}>
          <Text style={styles.closeRowText}>Cerrar</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  title: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.h3,
    fontWeight: Typography.medium,
  },
  closeBtn: { padding: 4 },
  videoWrapper: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  webview: { flex: 1 },
  closeRow: {
    paddingVertical: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 'auto',
  },
  closeRowText: { color: Colors.sub, fontSize: Typography.body },
});
