import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, Defs, ClipPath, Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography } from '../constants/colors';

const GRAD_START = '#0F2EA8';
const GRAD_END   = '#2660EA';

// Two film reels overlapping in a Venn diagram.
// ViewBox 28×28 — left reel cx=9, right reel cx=19, both r=7.
// Each reel has 5 evenly-spaced punched holes (evenodd fill-rule) at orbit r=4,
// a thick hub (r=2.2) and a rim stroke.
// Hole positions (dx, dy) relative to reel center, 72° apart starting at top:
//   k=0: ( 0,    -4    )  270°
//   k=1: (+3.804,-1.236)  342°
//   k=2: (+2.351,+3.236)   54°
//   k=3: (-2.351,+3.236)  126°
//   k=4: (-3.804,-1.236)  198°

function circlePath(cx: number, cy: number, r: number): string {
  return `M ${cx} ${cy} m ${-r} 0 a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
}

const HOLE_OFFSETS: [number, number][] = [
  [0,      -4     ],
  [3.804,  -1.236 ],
  [2.351,   3.236 ],
  [-2.351,  3.236 ],
  [-3.804, -1.236 ],
];

function reelPath(cx: number, cy: number): string {
  const body  = circlePath(cx, cy, 7);
  const holes = HOLE_OFFSETS
    .map(([dx, dy]) => circlePath(cx + dx, cy + dy, 1.4))
    .join(' ');
  return `${body} ${holes}`;
}

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

        {/* ── Left reel: body with 5 punched holes ────── */}
        <Path d={reelPath(9, 14)} fill="white" fillOpacity={0.25} fillRule="evenodd" />
        <Circle cx={9} cy={14} r={7}   stroke="white" strokeWidth={0.7} strokeOpacity={0.30} />
        <Circle cx={9} cy={14} r={2.2} fill="white" fillOpacity={0.65} />

        {/* ── Right reel: body with 5 punched holes ───── */}
        <Path d={reelPath(19, 14)} fill="white" fillOpacity={0.25} fillRule="evenodd" />
        <Circle cx={19} cy={14} r={7}   stroke="white" strokeWidth={0.7} strokeOpacity={0.30} />
        <Circle cx={19} cy={14} r={2.2} fill="white" fillOpacity={0.65} />

        {/* ── Intersection highlight (Venn lens) ──────── */}
        <Circle cx={9} cy={14} r={7} clipPath="url(#lm-clip-right)" fill="white" fillOpacity={0.28} />
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
