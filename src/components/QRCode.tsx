import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import QRCodeLib from 'react-native-qrcode-svg';
import { Colors } from '../constants/colors';

interface Props {
  value: string;
  size?: number;
}

export default function QRCode({ value, size = 200 }: Props) {
  return (
    <View style={[styles.container, { width: size + 24, height: size + 24 }]}>
      <QRCodeLib
        value={value}
        size={size}
        color={Colors.text}
        backgroundColor={Colors.s2}
        logo={undefined}
        logoSize={30}
        logoBorderRadius={6}
        logoBackgroundColor={Colors.accent}
      />
      <Text style={styles.label}>SM</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.s2,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  label: {
    position: 'absolute',
    color: Colors.accent,
    fontSize: 10,
    fontWeight: '900',
    backgroundColor: Colors.s2,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
});
