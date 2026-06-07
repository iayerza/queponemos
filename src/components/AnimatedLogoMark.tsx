import React, { useEffect } from 'react';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming, Easing,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse } from 'react-native-svg';
import { Colors } from '../constants/colors';

interface Props {
  size?: number;
  pulse?: boolean;
}

// AnimatedLogoMark: los dos óvalos del Venn respiran suave y desfasados.
// Más sutil que la versión anterior — 0.96→1.04 en lugar de 0.90→1.15.
export default function AnimatedLogoMark({ size = 56, pulse = true }: Props) {
  const box    = Math.round(size * 1.7);
  const radius = Math.round(size * 0.3);

  // Proporción SVG interna equivalente a viewBox 28×28
  const cx  = size / 2;
  const cy  = size / 2;
  const r   = size * 0.2857;   // ≈ 8 para size=28, ≈ 16 para size=56
  const off = size * 0.1429;   // ≈ 4 para size=28, ≈ 8 para size=56

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
        withTiming(0.70, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.35, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
      ), -1, false,
    );
  }, [pulse]);

  const leftStyle  = useAnimatedStyle(() => ({ transform: [{ scale: scaleLeft.value }] }));
  const rightStyle = useAnimatedStyle(() => ({ transform: [{ scale: scaleRight.value }] }));

  // La intersección es una ellipse fija cuya opacidad respira.
  // Aproximación al lens real: rx≈off, ry≈r*0.86
  const intersectStyle = useAnimatedStyle(() => ({ opacity: intersectAlpha.value }));

  return (
    <Animated.View style={{
      width: box, height: box,
      backgroundColor: Colors.accent,
      borderRadius: radius,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    }}>
      {/* Círculo izquierdo animado */}
      <Animated.View style={[{
        position: 'absolute', width: size, height: size,
        alignItems: 'center', justifyContent: 'center',
      }, leftStyle]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
          <Circle cx={cx - off} cy={cy} r={r} fill="white" fillOpacity={0.28} />
        </Svg>
      </Animated.View>

      {/* Círculo derecho animado (desfasado) */}
      <Animated.View style={[{
        position: 'absolute', width: size, height: size,
        alignItems: 'center', justifyContent: 'center',
      }, rightStyle]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
          <Circle cx={cx + off} cy={cy} r={r} fill="white" fillOpacity={0.28} />
        </Svg>
      </Animated.View>

      {/* Intersección fija — opacidad animada */}
      <Animated.View style={[{
        position: 'absolute', width: size, height: size,
        alignItems: 'center', justifyContent: 'center',
      }, intersectStyle]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
          <Ellipse cx={cx} cy={cy} rx={off} ry={r * 0.86} fill="white" />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}
