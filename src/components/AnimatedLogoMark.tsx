import React, { useEffect, useRef } from 'react';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming, withDelay, Easing,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

const HOLE_DX = [0, 3.804, 2.351, -2.351, -3.804];
const HOLE_DY = [-4, -1.236, 3.236, 3.236, -1.236];

function circlePath(cx: number, cy: number, r: number): string {
  return `M ${cx} ${cy} m ${-r} 0 a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
}

function reelBodyPath(rcx: number, rcy: number, R: number, orbR: number, holeR: number): string {
  const s    = orbR / 4;
  const body = circlePath(rcx, rcy, R);
  const holes = HOLE_DX
    .map((dx, i) => circlePath(rcx + dx * s, rcy + HOLE_DY[i] * s, holeR))
    .join(' ');
  return `${body} ${holes}`;
}

interface Props {
  size?: number;
  pulse?: boolean;
  mode?: 'pulse' | 'splash';
}

export default function AnimatedLogoMark({ size = 56, pulse = true, mode = 'pulse' }: Props) {
  const cx    = size / 2;
  const cy    = size / 2;
  const r     = size * (8   / 28);
  const off   = size * (4.5 / 28);
  const hubR  = size * (2.5 / 28);
  const orbR  = size * (4.5 / 28);
  const holeR = size * (1.6 / 28);

  const lx = cx - off;
  const rx = cx + off;

  const scaleLeft      = useSharedValue(1);
  const scaleRight     = useSharedValue(1);
  const intersectAlpha = useSharedValue(mode === 'splash' ? 0 : 0.44);
  const spinLeft       = useSharedValue(mode === 'splash' ?  720 : 0);
  const spinRight      = useSharedValue(mode === 'splash' ? -720 : 0);
  const leftOpacity    = useSharedValue(mode === 'splash' ? 0 : 1);
  const rightOpacity   = useSharedValue(mode === 'splash' ? 0 : 1);
  const spinCount      = useRef(0);

  useEffect(() => {
    if (mode === 'splash') {
      const easing = Easing.bezier(0.05, 0, 0.06, 1);
      // Left reel: fade in + spin CW from 720°→0°
      leftOpacity.value  = withTiming(1, { duration: 500 });
      spinLeft.value     = withTiming(0, { duration: 2200, easing });
      // Right reel: 120ms delay, fade in + spin CCW from -720°→0°
      rightOpacity.value = withDelay(120, withTiming(1, { duration: 500 }));
      spinRight.value    = withDelay(120, withTiming(0, { duration: 2200, easing }));
      // Venn lens appears after reels settle
      intersectAlpha.value = withDelay(2250, withTiming(0.44, { duration: 350 }));
      return;
    }

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

    // occasional spin every 5s — each reel spins from its own center
    const interval = setInterval(() => {
      spinCount.current += 1;
      const target = spinCount.current * 360;
      spinLeft.value  = withTiming(target, { duration: 900, easing: Easing.inOut(Easing.cubic) });
      spinRight.value = withDelay(200, withTiming(target, { duration: 900, easing: Easing.inOut(Easing.cubic) }));
    }, 5000);

    return () => clearInterval(interval);
  }, [mode, pulse]);

  // Pivot trick: to rotate around a point Q from element center, use
  // [translateX(Q.x), rotate, translateX(-Q.x)].
  // Left reel center in element coords: Q = (lx - size/2, 0) = (-off, 0)
  const leftStyle = useAnimatedStyle(() => ({
    opacity: leftOpacity.value,
    transform: [
      { translateX: -off },
      { rotate: `${spinLeft.value}deg` },
      { translateX: off },
      { scale: scaleLeft.value },
    ],
  }));

  // Right reel center in element coords: Q = (rx - size/2, 0) = (+off, 0)
  const rightStyle = useAnimatedStyle(() => ({
    opacity: rightOpacity.value,
    transform: [
      { translateX: off },
      { rotate: `${spinRight.value}deg` },
      { translateX: -off },
      { scale: scaleRight.value },
    ],
  }));

  const intersectStyle = useAnimatedStyle(() => ({ opacity: intersectAlpha.value }));

  const reelLayer = (animStyle: ReturnType<typeof useAnimatedStyle>, reelCx: number) => (
    <Animated.View style={[{ position: 'absolute', width: size, height: size, top: 0, left: 0 }, animStyle]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
        <Path
          d={reelBodyPath(reelCx, cy, r, orbR, holeR)}
          fill="white" fillOpacity={0.22} fillRule="evenodd"
        />
        <Circle cx={reelCx} cy={cy} r={r}    stroke="white" strokeWidth={r * 0.055} strokeOpacity={0.40} />
        <Circle cx={reelCx} cy={cy} r={hubR} fill="white" fillOpacity={0.85} />
      </Svg>
    </Animated.View>
  );

  return (
    <Animated.View style={{ width: size, height: size }}>
      {reelLayer(leftStyle, lx)}
      {reelLayer(rightStyle, rx)}

      <Animated.View style={[{ position: 'absolute', width: size, height: size, top: 0, left: 0 }, intersectStyle]}>
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
