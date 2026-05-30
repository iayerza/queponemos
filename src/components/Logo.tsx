import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, Ellipse } from 'react-native-svg';
import { Colors, Typography } from '../constants/colors';

// ─── LogoMark — diagrama de Venn ─────────────────────────────────────────────
// Representa la intersección de dos perfiles de gusto.
export function LogoMark({ size = 28 }: { size?: number }) {
  const box = Math.round(size * 1.7);
  return (
    <View style={{
      width: box,
      height: box,
      backgroundColor: Colors.accent,
      borderRadius: Math.round(size * 0.3),
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
        <Circle cx="10" cy="14" r="8" fill="white" fillOpacity="0.2" />
        <Circle cx="18" cy="14" r="8" fill="white" fillOpacity="0.2" />
        <Ellipse cx="14" cy="14" rx="4" ry="8" fill="white" fillOpacity="0.5" />
        <Circle cx="14" cy="14" r="2.5" fill="white" />
      </Svg>
    </View>
  );
}

// ─── LogoWordmark — mark + texto ──────────────────────────────────────────────
// "que" en blanco + "ponemos" en coral. Siempre minúscula.
export function LogoWordmark({ markSize = 24 }: { markSize?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <LogoMark size={markSize} />
      <Text style={{
        fontSize: 15,
        fontFamily: Typography.fontMedium,
        color: Colors.text,
        letterSpacing: -0.2,
      }}>
        que<Text style={{ color: Colors.coral }}>ponemos</Text>
      </Text>
    </View>
  );
}
