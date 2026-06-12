import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, Defs, ClipPath, Path } from 'react-native-svg';
import { Colors, Typography } from '../constants/colors';

// ViewBox 28×28. Left reel cx=8.5, right cx=19.5, both r=7.5.
// 5 holes per reel at orbit r=4, 72° apart from top, holeR=1.5.

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
  const body  = circlePath(cx, cy, 7.5);
  const holes = HOLE_OFFSETS
    .map(([dx, dy]) => circlePath(cx + dx, cy + dy, 1.5))
    .join(' ');
  return `${body} ${holes}`;
}

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <Defs>
        <ClipPath id="lm-clip-right">
          <Circle cx={19.5} cy={14} r={7.5} />
        </ClipPath>
      </Defs>

      {/* Left reel */}
      <Path d={reelPath(8.5, 14)} fill="white" fillOpacity={0.22} fillRule="evenodd" />
      <Circle cx={8.5} cy={14} r={7.5} stroke="white" strokeWidth={0.75} strokeOpacity={0.40} />
      <Circle cx={8.5} cy={14} r={2.5} fill="white" fillOpacity={0.85} />

      {/* Right reel */}
      <Path d={reelPath(19.5, 14)} fill="white" fillOpacity={0.22} fillRule="evenodd" />
      <Circle cx={19.5} cy={14} r={7.5} stroke="white" strokeWidth={0.75} strokeOpacity={0.40} />
      <Circle cx={19.5} cy={14} r={2.5} fill="white" fillOpacity={0.85} />

      {/* Venn intersection */}
      <Circle cx={8.5} cy={14} r={7.5} clipPath="url(#lm-clip-right)" fill="white" fillOpacity={0.32} />
    </Svg>
  );
}

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
        que<Text style={{ color: '#2660EA' }}>ponemos</Text>
      </Text>
    </View>
  );
}
