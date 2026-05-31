import React, { useEffect } from 'react';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming, Easing,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse } from 'react-native-svg';
import { Colors } from '../constants/colors';

interface Props {
  size?: number;   // tamaño del SVG interno
  pulse?: boolean; // activar animación (default true)
}

// LogoMark animado: los dos círculos del Venn se expanden y contraen.
// Usado en MatchingScreen y SplashScreen.
export default function AnimatedLogoMark({ size = 56, pulse = true }: Props) {
  const box = Math.round(size * 1.7);
  const radius = Math.round(size * 0.3);

  const scaleLeft  = useSharedValue(1);
  const scaleRight = useSharedValue(1);
  const glow       = useSharedValue(0.8);

  useEffect(() => {
    if (!pulse) return;

    // Círculo izquierdo late ligeramente desfasado del derecho
    scaleLeft.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.90, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      ), -1, false,
    );
    scaleRight.value = withRepeat(
      withSequence(
        withTiming(0.90, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        withTiming(1.15, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      ), -1, false,
    );
    glow.value = withRepeat(
      withSequence(
        withTiming(1,   { duration: 900 }),
        withTiming(0.6, { duration: 900 }),
      ), -1, false,
    );
  }, [pulse]);

  const leftStyle  = useAnimatedStyle(() => ({
    transform: [{ scale: scaleLeft.value }],
  }));
  const rightStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleRight.value }],
  }));
  const boxStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
  }));

  // SVG se parte: los círculos izquierdo/derecho se animan,
  // la intersección (elipse + punto central) queda fija.
  const cx  = size / 2;
  const cy  = size / 2;
  const r   = size * 0.285;  // ~8 para size=28
  const off = size * 0.143;  // ~4 para size=28

  return (
    <Animated.View style={[{
      width: box, height: box,
      backgroundColor: Colors.accent,
      borderRadius: radius,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    }, pulse && boxStyle]}>
      {/* Svg base — intersección fija */}
      <Svg
        width={size} height={size}
        viewBox={`0 0 ${size} ${size}`}
        fill="none"
        style={{ position: 'absolute' }}
      >
        <Ellipse
          cx={cx} cy={cy}
          rx={size * 0.143} ry={r}
          fill="white" fillOpacity="0.55"
        />
        <Circle cx={cx} cy={cy} r={size * 0.09} fill="white" />
      </Svg>

      {/* Círculo izquierdo animado */}
      <Animated.View style={[{
        position: 'absolute',
        width: size, height: size,
        alignItems: 'center', justifyContent: 'center',
      }, leftStyle]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
          <Circle cx={cx - off} cy={cy} r={r} fill="white" fillOpacity="0.2" />
        </Svg>
      </Animated.View>

      {/* Círculo derecho animado (desfasado) */}
      <Animated.View style={[{
        position: 'absolute',
        width: size, height: size,
        alignItems: 'center', justifyContent: 'center',
      }, rightStyle]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
          <Circle cx={cx + off} cy={cy} r={r} fill="white" fillOpacity="0.2" />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}
