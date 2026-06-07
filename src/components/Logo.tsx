import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, Defs, ClipPath } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography } from '../constants/colors';

// Gradiente diagonal del logo: azul profundo → azul medio
const GRAD_START = '#0F2EA8';
const GRAD_END   = '#2660EA';

// ─── LogoMark — diagrama de Venn con gradiente ────────────────────────────────
export function LogoMark({ size = 28 }: { size?: number }) {
  const box    = Math.round(size * 1.7);
  const radius = Math.round(size * 0.3);
  return (
    <LinearGradient
      colors={[GRAD_START, GRAD_END]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: box, height: box, borderRadius: radius, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
        <Defs>
          <ClipPath id="lm-venn">
            <Circle cx={18} cy={14} r={8.5} />
          </ClipPath>
        </Defs>
        <Circle cx={10} cy={14} r={8} fill="white" fillOpacity={0.28} />
        <Circle cx={18} cy={14} r={8} fill="white" fillOpacity={0.28} />
        <Circle cx={10} cy={14} r={8} clipPath="url(#lm-venn)" fill="white" fillOpacity={0.44} />
      </Svg>
    </LinearGradient>
  );
}

// ─── LogoWordmark — mark + texto ──────────────────────────────────────────────
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
