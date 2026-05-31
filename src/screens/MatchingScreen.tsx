import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Colors, Typography } from '../constants/colors';
import AnimatedLogoMark from '../components/AnimatedLogoMark';
import { useMatching } from '../hooks/useMatching';
import type { RootStackParamList } from '../navigation/types';

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Matching'>;

export default function MatchingScreen() {
  const nav   = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { runMatch, error, isLeader } = useMatching();

  useEffect(() => {
    runMatch().then(matchId => {
      if (matchId) nav.replace('Results', { matchId });
    });
  }, []);

  return (
    <View style={styles.root}>
      {/* Logo animado grande sobre fondo rojo */}
      <AnimatedLogoMark size={80} />

      <Text style={styles.brand}>queponemos</Text>

      <Text style={styles.title}>
        {isLeader ? 'Analizando\nlos dos moods…' : 'Esperando\nel resultado…'}
      </Text>
      <Text style={styles.sub}>
        {isLeader
          ? 'Claude está reconciliando sus gustos'
          : 'Tu compañero está buscando el match'}
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.accent,   // fondo rojo
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  brand: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.h3,
    fontWeight: Typography.medium,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: -0.2,
    marginTop: 8,
  },
  title: {
    color: '#ffffff',
    fontSize: Typography.h1,
    fontWeight: Typography.medium,
    textAlign: 'center',
    lineHeight: 32,
  },
  sub: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: Typography.small,
    textAlign: 'center',
  },
  error: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: Typography.small,
    textAlign: 'center',
    paddingHorizontal: 40,
    marginTop: 8,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
    padding: 12,
  },
});
