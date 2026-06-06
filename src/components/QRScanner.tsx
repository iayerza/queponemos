import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { Colors, Typography } from '../constants/colors';

interface Props {
  visible: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

export default function QRScanner({ visible, onClose, onScan }: Props) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (!visible) { setScanned(false); return; }
    Camera.requestCameraPermissionsAsync().then(({ status }) => {
      setHasPermission(status === 'granted');
    });
  }, [visible]);

  function handleBarcode({ data }: { data: string }) {
    if (scanned) return;
    setScanned(true);
    // Accept raw invite codes or deep-links: queponemos://join?code=XXXXXX
    const match = data.match(/code=([A-Z0-9]{6})/i) ?? data.match(/^([A-Z0-9]{6})$/i);
    const code = match ? match[1].toUpperCase() : data.toUpperCase();
    onScan(code);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        {hasPermission === false ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>Sin acceso a la cámara</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        ) : hasPermission === true ? (
          <>
            <CameraView
              style={styles.camera}
              facing="back"
              onBarcodeScanned={scanned ? undefined : handleBarcode}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            />
            <View style={styles.overlay}>
              <View style={styles.frame} />
              <Text style={styles.hint}>Apuntá la cámara al código QR</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.center}>
            <Text style={styles.errorText}>Iniciando cámara…</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  camera: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  errorText: { color: Colors.sub, fontSize: Typography.body },
  overlay: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  frame: {
    width: 220,
    height: 220,
    borderWidth: 2,
    borderColor: Colors.accent,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  hint: {
    color: '#fff',
    fontSize: Typography.body,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: 'hidden',
  },
  closeBtn: {
    backgroundColor: Colors.s1,
    borderRadius: 10,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  closeBtnText: { color: Colors.text, fontSize: Typography.body, fontWeight: '500' },
});
