import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, Defs, ClipPath, Path } from 'react-native-svg';
import { Colors, Typography } from '../constants/colors';

const LOGO_BG = '#C8302A';

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
    <View style={{ width: box, height: box, borderRadius: radius, backgroundColor: LOGO_BG, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
        <Defs>
          <ClipPath id="lm-clip-right">
            <Circle cx={19} cy={14} r={7} />
          </ClipPath>
        </Defs>

        {/* Left reel: body with 5 punched holes */}
        <Path d={reelPath(9, 14)} fill="white" fillOpacity={0.25} fillRule="evenodd" />
        <Circle cx={9} cy={14} r={7}   stroke="white" strokeWidth={0.7} strokeOpacity={0.30} />
        <Circle cx={9} cy={14} r={2.2} fill="white" fillOpacity={0.65} />

        {/* Right reel: body with 5 punched holes */}
        <Path d={reelPath(19, 14)} fill="white" fillOpacity={0.25} fillRule="evenodd" />
        <Circle cx={19} cy={14} r={7}   stroke="white" strokeWidth={0.7} strokeOpacity={0.30} />
        <Circle cx={19} cy={14} r={2.2} fill="white" fillOpacity={0.65} />

        {/* Intersection highlight (Venn lens) */}
        <Circle cx={9} cy={14} r={7} clipPath="url(#lm-clip-right)" fill="white" fillOpacity={0.28} />
      </Svg>
    </View>
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
