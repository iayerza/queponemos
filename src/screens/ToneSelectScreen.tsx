import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Colors, Typography } from '../constants/colors';
import { useColors } from '../context/ThemeContext';
import type { RootStackParamList, ToneId } from '../navigation/types';

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'ToneSelect'>;

const TONE_OPTIONS: { id: ToneId; label: string; sub: string }[] = [
  { id: 'prestige', label: 'Cine de autor',    sub: 'Premios, crítica, historias profundas' },
  { id: 'fun',      label: 'Entretenimiento',  sub: 'Blockbusters, acción, comedias' },
  { id: 'mix',      label: 'De todo',          sub: 'Sin filtros, sorprendeme' },
];

export default function ToneSelectScreen() {
  const insets = useSafeAreaInsets();
  const nav    = useNavigation<Nav>();
  const route  = useRoute<Route>();
  const themeColors = useColors();
  const [selected, setSelected] = useState<ToneId | null>(null);
  const { ageRange, fromProfile } = route.params;

  function handleNext() {
    nav.navigate('Onboarding', {
      ageRange,
      toneId: selected ?? 'mix',
      fromProfile: fromProfile || undefined,
    });
  }

  return (
    <View style={[styles.root, { backgroundColor: themeColors.bg }]}>
      <View style={[styles.content, { paddingTop: insets.top + 40 }]}>
        <Text style={styles.eyebrow}>TU ESTILO</Text>
        <Text style={styles.heading}>¿Qué tipo de cine{'\n'}preferís?</Text>
        <Text style={styles.sub}>Usamos esto para calibrar las primeras sugerencias.</Text>
        <View style={styles.options}>
          {TONE_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.id}
              style={[styles.optionCard, selected === opt.id && styles.optionCardActive]}
              onPress={() => setSelected(opt.id)}
              activeOpacity={0.8}
            >
              <Text style={[styles.optionLabel, selected === opt.id && styles.optionLabelActive]}>
                {opt.label}
              </Text>
              <Text style={styles.optionSub}>{opt.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={[styles.actions, { paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity
          style={styles.nextBtn}
          onPress={handleNext}
          activeOpacity={0.85}
        >
          <Text style={styles.nextBtnText}>Siguiente</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, gap: 16 },
  eyebrow: { color: Colors.faint, fontSize: Typography.tiny, fontWeight: Typography.medium, letterSpacing: 2 },
  heading: { color: Colors.text, fontSize: Typography.h1, fontWeight: Typography.bold, lineHeight: 30 },
  sub: { color: Colors.sub, fontSize: Typography.small, lineHeight: 20 },
  options: { gap: 10, marginTop: 8 },
  optionCard: {
    backgroundColor: Colors.s1,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  optionCardActive: { borderColor: Colors.accentBorder, backgroundColor: Colors.accentFaint },
  optionLabel: { color: Colors.text, fontSize: Typography.h3, fontWeight: Typography.bold, marginBottom: 2 },
  optionLabelActive: { color: Colors.accent },
  optionSub: { color: Colors.sub, fontSize: Typography.small },
  actions: { paddingHorizontal: 24 },
  nextBtn: { backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  nextBtnText: { color: Colors.text, fontWeight: Typography.bold, fontSize: Typography.body },
});
