import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Typography } from '../constants/colors';
import { useColors } from '../context/ThemeContext';
import { LogoWordmark } from '../components/Logo';
import { useAuthStore } from '../store/useAuthStore';
import { completeOnboarding } from '../services/firebase';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'true';

export default function OnboardingIntroScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const themeColors = useColors();
  const { user, markOnboardingDone } = useAuthStore();

  async function handleSkip() {
    if (!USE_MOCK && user) {
      try { await completeOnboarding(user.uid); } catch { /* silenciar */ }
    }
    markOnboardingDone();
  }

  return (
    <View style={[styles.root, { backgroundColor: themeColors.bg }]}>
      <View style={[styles.content, { paddingTop: insets.top + 40 }]}>
        <LogoWordmark markSize={28} />
        <Text style={styles.eyebrow}>ANTES DE ARRANCAR</Text>
        <Text style={styles.heading}>Sugerimos mejor{'\n'}si nos contás un poco{'\n'}sobre vos</Text>
        <Text style={styles.sub}>
          Tomá 2 minutos para calificar algunas películas y series. Cuanto más calificás, mejor te entendemos.
        </Text>
      </View>
      <View style={[styles.actions, { paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => nav.navigate('AgeSelect', {})} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>Dale</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} activeOpacity={0.8}>
          <Text style={styles.skipBtnText}>Omitir</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, gap: 20 },
  eyebrow: {
    color: Colors.faint,
    fontSize: Typography.tiny,
    fontWeight: Typography.medium,
    letterSpacing: 2,
    marginTop: 40,
  },
  heading: {
    color: Colors.text,
    fontSize: Typography.hero,
    fontWeight: Typography.bold,
    lineHeight: 38,
  },
  sub: {
    color: Colors.sub,
    fontSize: Typography.body,
    lineHeight: 22,
  },
  actions: { paddingHorizontal: 24, gap: 10 },
  primaryBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: Colors.text, fontWeight: Typography.bold, fontSize: Typography.body },
  skipBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  skipBtnText: { color: Colors.sub, fontSize: Typography.body },
});
