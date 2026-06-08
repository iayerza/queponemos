import React, { useEffect } from 'react';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming, Easing,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

const GRAD_START = '#0F2EA8';
const GRAD_END   = '#2660EA';
const S3 = Math.sqrt(3) / 2; // cos/sin for 60°

interface Props {
  size?: number;
  pulse?: boolean;
}

export default function AnimatedLogoMark({ size = 56, pulse = true }: Props) {
  const box    = Math.round(size * 1.7);
  const radius = Math.round(size * 0.3);

  // All geometry derived from the static 28×28 design, scaled to `size`.
  // left cx=9/28, right cx=19/28, r=7/28, hub=2/28, wPos=4/28, wSz=1.2/28
  const cx   = size / 2;
  const cy   = size / 2;
  const r    = size * (7  / 28);
  const off  = size * (5  / 28); // distance from center to each reel cx (= (19-9)/2=5)
  const hubR = size * (2  / 28);
  const wPos = size * (4  / 28); // window orbit radius
  const wSz  = size * (1.2/ 28); // window dot radius

  const lx = cx - off; // left reel center x
  const rx = cx + off; // right reel center x

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
        {/* Body */}
        <Circle cx={reelCx} cy={cy} r={r}    fill="white" fillOpacity={0.20} />
        {/* Rim */}
        <Circle cx={reelCx} cy={cy} r={r}    stroke="white" strokeWidth={r * 0.05} strokeOpacity={0.28} />
        {/* Hub */}
        <Circle cx={reelCx} cy={cy} r={hubR} fill="white" fillOpacity={0.55} />
        {/* Window — top (270°) */}
        <Circle cx={reelCx}              cy={cy - wPos}       r={wSz} fill="white" fillOpacity={0.44} />
        {/* Window — bottom-right (30°) */}
        <Circle cx={reelCx + wPos * S3}  cy={cy + wPos * 0.5} r={wSz} fill="white" fillOpacity={0.44} />
        {/* Window — bottom-left (150°) */}
        <Circle cx={reelCx - wPos * S3}  cy={cy + wPos * 0.5} r={wSz} fill="white" fillOpacity={0.44} />
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
