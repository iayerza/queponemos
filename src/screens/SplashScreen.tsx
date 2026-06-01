import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Colors, Typography } from '../constants/colors';
import AnimatedLogoMark from '../components/AnimatedLogoMark';

interface Props {
  onComplete: () => void;
}

// Secuencia según blueprint:
// t=0       → todo opacity 0
// t=0-600   → logomark fade-in
// t=900     → wordmark fade-in (400ms)
// t=1800    → tagline fade-in (300ms)
// t=2800    → onComplete → navegar según auth

export default function SplashScreen({ onComplete }: Props) {
  const markOpacity    = useRef(new Animated.Value(0)).current;
  const wordOpacity    = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      // logomark fade-in 0→600ms
      Animated.timing(markOpacity, {
        toValue: 1, duration: 600, useNativeDriver: true,
      }),
      // pausa hasta t=900
      Animated.delay(300),
      // wordmark fade-in
      Animated.timing(wordOpacity, {
        toValue: 1, duration: 400, useNativeDriver: true,
      }),
      // pausa hasta t=1800
      Animated.delay(500),
      // tagline fade-in
      Animated.timing(taglineOpacity, {
        toValue: 1, duration: 300, useNativeDriver: true,
      }),
      // pausa hasta t=2800
      Animated.delay(700),
    ]).start(() => onComplete());
  }, []);

  return (
    <View style={styles.root}>
      <Animated.View style={{ opacity: markOpacity }}>
        <AnimatedLogoMark size={40} />
      </Animated.View>

      <Animated.Text style={[styles.wordmark, { opacity: wordOpacity }]}>
        que<Text style={{ color: Colors.coral }}>ponemos</Text>
      </Animated.Text>

      <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
        La peli para hoy.
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  wordmark: {
    fontFamily: Typography.fontMedium,
    fontSize: 28,
    fontWeight: Typography.medium,
    color: Colors.text,
    letterSpacing: -0.5,
    marginTop: 4,
  },
  tagline: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.body,
    color: Colors.sub,
  },
});
