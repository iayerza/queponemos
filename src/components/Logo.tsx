import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, Defs, ClipPath } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography } from '../constants/colors';

const GRAD_START = '#0F2EA8';
const GRAD_END   = '#2660EA';

// Two film reels overlapping in a Venn diagram.
// ViewBox 28×28 — left reel cx=9, right reel cx=19, both r=7.
// Each reel: outer body, thin rim, hub spindle (r=2), 3 windows at 120° intervals.
// Window positions at r=4 from reel center: top (0,−4), bottom-right (+3.46,+2), bottom-left (−3.46,+2).

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
          <ClipPath id="lm-clip-right">
            <Circle cx={19} cy={14} r={7} />
          </ClipPath>
        </Defs>

        {/* ── Left reel ───────────────────────────────── */}
        <Circle cx={9}  cy={14} r={7}   fill="white" fillOpacity={0.18} />
        <Circle cx={9}  cy={14} r={7}   stroke="white" strokeWidth={0.7} strokeOpacity={0.28} />
        <Circle cx={9}  cy={14} r={2}   fill="white" fillOpacity={0.55} />
        {/* windows */}
        <Circle cx={9}    cy={10}  r={1.2} fill="white" fillOpacity={0.44} />
        <Circle cx={12.46} cy={16} r={1.2} fill="white" fillOpacity={0.44} />
        <Circle cx={5.54}  cy={16} r={1.2} fill="white" fillOpacity={0.44} />

        {/* ── Right reel ──────────────────────────────── */}
        <Circle cx={19} cy={14} r={7}   fill="white" fillOpacity={0.18} />
        <Circle cx={19} cy={14} r={7}   stroke="white" strokeWidth={0.7} strokeOpacity={0.28} />
        <Circle cx={19} cy={14} r={2}   fill="white" fillOpacity={0.55} />
        {/* windows */}
        <Circle cx={19}    cy={10}  r={1.2} fill="white" fillOpacity={0.44} />
        <Circle cx={22.46} cy={16}  r={1.2} fill="white" fillOpacity={0.44} />
        <Circle cx={15.54} cy={16}  r={1.2} fill="white" fillOpacity={0.44} />

        {/* ── Intersection highlight ──────────────────── */}
        <Circle cx={9} cy={14} r={7} clipPath="url(#lm-clip-right)" fill="white" fillOpacity={0.26} />
      </Svg>
    </LinearGradient>
  );
}

// ─── LogoWordmark ─────────────────────────────────────────────────────────────
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
