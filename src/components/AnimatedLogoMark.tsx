import React, { useEffect } from 'react';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming, Easing,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

const GRAD_START = '#0F2EA8';
const GRAD_END   = '#2660EA';

// 5 hole offsets at orbit=4, 72° apart starting from top (270°)
const HOLE_DX = [0, 3.804, 2.351, -2.351, -3.804];
const HOLE_DY = [-4, -1.236, 3.236, 3.236, -1.236];

function circlePath(cx: number, cy: number, r: number): string {
  return `M ${cx} ${cy} m ${-r} 0 a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
}

function reelBodyPath(rcx: number, rcy: number, R: number, orbR: number, holeR: number): string {
  const s     = orbR / 4; // scale relative to base orbit=4
  const body  = circlePath(rcx, rcy, R);
  const holes = HOLE_DX
    .map((dx, i) => circlePath(rcx + dx * s, rcy + HOLE_DY[i] * s, holeR))
    .join(' ');
  return `${body} ${holes}`;
}

interface Props {
  size?: number;
  pulse?: boolean;
}

export default function AnimatedLogoMark({ size = 56, pulse = true }: Props) {
  const box    = Math.round(size * 1.7);
  const radius = Math.round(size * 0.3);

  const cx    = size / 2;
  const cy    = size / 2;
  const r     = size * (7   / 28);
  const off   = size * (5   / 28);
  const hubR  = size * (2.2 / 28);
  const orbR  = size * (4   / 28);
  const holeR = size * (1.4 / 28);

  const lx = cx - off;
  const rx = cx + off;

  const scaleLeft      = useSharedValue(1);
  const scaleRight     = useSharedValue(1);
  const intersectAlpha = useSharedValue(0.44);

  useEffect(() => {
    if (!pulse) return;

    scaleLeft.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.96, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
      ), -1, false,
    );
    scaleRight.value = withRepeat(
      withSequence(
        withTiming(0.96, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
        withTiming(1.04, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
      ), -1, false,
    );
    intersectAlpha.value = withRepeat(
      withSequence(
        withTiming(0.72, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.35, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
      ), -1, false,
    );
  }, [pulse]);

  const leftStyle      = useAnimatedStyle(() => ({ transform: [{ scale: scaleLeft.value }] }));
  const rightStyle     = useAnimatedStyle(() => ({ transform: [{ scale: scaleRight.value }] }));
  const intersectStyle = useAnimatedStyle(() => ({ opacity: intersectAlpha.value }));

  const reelLayer = (animStyle: ReturnType<typeof useAnimatedStyle>, reelCx: number) => (
    <Animated.View style={[{
      position: 'absolute', width: size, height: size,
      left: (box - size) / 2, top: (box - size) / 2,
    }, animStyle]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
        {/* Reel body with 5 punched holes */}
        <Path
          d={reelBodyPath(reelCx, cy, r, orbR, holeR)}
          fill="white"
          fillOpacity={0.25}
          fillRule="evenodd"
        />
        {/* Rim */}
        <Circle cx={reelCx} cy={cy} r={r}    stroke="white" strokeWidth={r * 0.05} strokeOpacity={0.30} />
        {/* Hub */}
        <Circle cx={reelCx} cy={cy} r={hubR} fill="white" fillOpacity={0.65} />
      </Svg>
    </Animated.View>
  );

  return (
    <Animated.View style={{ width: box, height: box, borderRadius: radius, overflow: 'hidden' }}>
      <LinearGradient
        colors={[GRAD_START, GRAD_END]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {reelLayer(leftStyle, lx)}
      {reelLayer(rightStyle, rx)}

      {/* Intersection — lens shape, opacity pulsing */}
      <Animated.View style={[{
        position: 'absolute', width: size, height: size,
        left: (box - size) / 2, top: (box - size) / 2,
      }, intersectStyle]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
          <Ellipse
            cx={cx} cy={cy}
            rx={r - off}
            ry={Math.sqrt(r * r - off * off)}
            fill="white"
          />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}
