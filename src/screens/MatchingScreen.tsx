import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Colors, Typography } from '../constants/colors';
import MatchingOrb from '../components/MatchingOrb';
import { useMatching } from '../hooks/useMatching';
import type { RootStackParamList } from '../navigation/types';

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Matching'>;

export default function MatchingScreen() {
  const nav   = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { runMatch, error } = useMatching();

  useEffect(() => {
    runMatch().then(matchId => {
      if (matchId) nav.replace('Results', { matchId });
    });
  }, []);

  return (
    <View style={styles.root}>
      <MatchingOrb />
      <Text style={styles.label}>STREAMMATCH</Text>
      <Text style={styles.title}>
        {'Analizando\nperfiles…'}
      </Text>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  label: {
    color: Colors.accent,
    fontSize: Typography.tiny,
    fontWeight: Typography.semibold,
    letterSpacing: 3,
  },
  title: {
    color: Colors.text,
    fontSize: Typography.h1,
    fontWeight: Typography.bold,
    textAlign: 'center',
    lineHeight: 32,
  },
  error: {
    color: Colors.danger,
    fontSize: Typography.small,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
