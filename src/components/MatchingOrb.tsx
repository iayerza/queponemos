import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence,
  withTiming, Easing,
} from 'react-native-reanimated';
import { Colors } from '../constants/colors';

export default function MatchingOrb() {
  const scale = useSharedValue(1);
  const glow  = useSharedValue(0.4);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
        withTiming(1,    { duration: 1000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.4, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, []);

  const orbStyle  = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[styles.glowRing, glowStyle]} />
      <Animated.View style={[styles.orb, orbStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  glowRing: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 60,
    backgroundColor: Colors.accentFaint,
    shadowColor: Colors.accent,
    shadowRadius: 30,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 0 },
  },
  orb: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowRadius: 20,
    shadowOpacity: 0.8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
});
