import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Colors, Typography } from '../constants/colors';
import { useColors } from '../context/ThemeContext';
import type { RootStackParamList, AgeRange } from '../navigation/types';

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'AgeSelect'>;

const AGE_OPTIONS: { range: AgeRange; label: string }[] = [
  { range: 'young',  label: 'Menos de 25' },
  { range: 'mid',    label: '25 a 35'     },
  { range: 'adult',  label: '36 a 50'     },
  { range: 'senior', label: 'Más de 50'   },
];

export default function AgeSelectScreen() {
  const insets = useSafeAreaInsets();
  const nav    = useNavigation<Nav>();
  const route  = useRoute<Route>();
  const themeColors = useColors();
  const [selected, setSelected] = useState<AgeRange | null>(null);
  const fromProfile = route.params?.fromProfile === true;

  function handleNext() {
    if (!selected) return;
    nav.navigate('ToneSelect', { ageRange: selected, fromProfile: fromProfile || undefined });
  }

  return (
    <View style={[styles.root, { backgroundColor: themeColors.bg }]}>
      <View style={[styles.content, { paddingTop: insets.top + 40 }]}>
        <Text style={styles.eyebrow}>TU PERFIL</Text>
        <Text style={styles.heading}>¿Qué edad tenés?</Text>
        <Text style={styles.sub}>Usamos esto para mostrarte títulos que te van a resultar conocidos.</Text>
        <View style={styles.options}>
          {AGE_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.range}
              style={[styles.optionCard, selected === opt.range && styles.optionCardActive]}
              onPress={() => setSelected(opt.range)}
              activeOpacity={0.8}
            >
              <Text style={[styles.optionLabel, selected === opt.range && styles.optionLabelActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={[styles.actions, { paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity
          style={[styles.nextBtn, !selected && styles.nextBtnDisabled]}
          onPress={handleNext}
          disabled={!selected}
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
  heading: { color: Colors.text, fontSize: Typography.h1, fontWeight: Typography.bold },
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
  optionLabel: { color: Colors.text, fontSize: Typography.h3, fontWeight: Typography.bold },
  optionLabelActive: { color: Colors.accent },
  actions: { paddingHorizontal: 24 },
  nextBtn: { backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { color: Colors.text, fontWeight: Typography.bold, fontSize: Typography.body },
});
