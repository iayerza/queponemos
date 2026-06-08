import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Colors, Typography } from '../constants/colors';
import AnimatedLogoMark from '../components/AnimatedLogoMark';

interface Props {
  onComplete: () => void;
}

// t=0      reels spin in (handled by AnimatedLogoMark mode="splash", ~2.3s)
// t=2300   wordmark fade-in (400ms)
// t=2900   tagline fade-in (300ms)
// t=3900   onComplete

export default function SplashScreen({ onComplete }: Props) {
  const wordOpacity    = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(2300),
      Animated.timing(wordOpacity,    { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.delay(200),
      Animated.timing(taglineOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(700),
    ]).start(() => onComplete());
  }, []);

  return (
    <View style={styles.root}>
      <AnimatedLogoMark size={80} mode="splash" />

      <Animated.Text style={[styles.wordmark, { opacity: wordOpacity }]}>
        que<Text style={{ color: '#2660EA' }}>ponemos</Text>
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
    marginTop: 8,
  },
  tagline: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.body,
    color: Colors.sub,
  },
});
