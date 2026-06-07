import React, { useEffect } from 'react';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming, Easing,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

const GRAD_START = '#0F2EA8';
const GRAD_END   = '#2660EA';

interface Props {
  size?: number;
  pulse?: boolean;
}

export default function AnimatedLogoMark({ size = 56, pulse = true }: Props) {
  const box    = Math.round(size * 1.7);
  const radius = Math.round(size * 0.3);

  const cx  = size / 2;
  const cy  = size / 2;
  const r   = size * 0.2857;
  const off = size * 0.1429;

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

  return (
    <Animated.View style={{ width: box, height: box, borderRadius: radius, overflow: 'hidden' }}>
      {/* Gradiente de fondo */}
      <LinearGradient
        colors={[GRAD_START, GRAD_END]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Círculo izquierdo animado */}
      <Animated.View style={[{
        position: 'absolute', width: size, height: size,
        left: (box - size) / 2, top: (box - size) / 2,
        alignItems: 'center', justifyContent: 'center',
      }, leftStyle]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
          <Circle cx={cx - off} cy={cy} r={r} fill="white" fillOpacity={0.28} />
        </Svg>
      </Animated.View>

      {/* Círculo derecho animado (desfasado) */}
      <Animated.View style={[{
        position: 'absolute', width: size, height: size,
        left: (box - size) / 2, top: (box - size) / 2,
        alignItems: 'center', justifyContent: 'center',
      }, rightStyle]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
          <Circle cx={cx + off} cy={cy} r={r} fill="white" fillOpacity={0.28} />
        </Svg>
      </Animated.View>

      {/* Intersección — opacidad animada */}
      <Animated.View style={[{
        position: 'absolute', width: size, height: size,
        left: (box - size) / 2, top: (box - size) / 2,
        alignItems: 'center', justifyContent: 'center',
      }, intersectStyle]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
          <Ellipse cx={cx} cy={cy} rx={off} ry={r * 0.86} fill="white" />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}
