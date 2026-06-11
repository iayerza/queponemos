import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Colors, Typography } from '../constants/colors';
import { useColors } from '../context/ThemeContext';
import type { RootStackParamList, ToneId, FormatPref } from '../navigation/types';

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'ToneSelect'>;

const TONE_OPTIONS: { id: ToneId; label: string; sub: string }[] = [
  { id: 'tension', label: 'Que me enganche y me tense',  sub: 'Thriller, policial, suspenso' },
  { id: 'light',   label: 'Reírme o desenchufar',        sub: 'Comedia, romance, aventura' },
  { id: 'think',   label: 'Pensar y reflexionar',        sub: 'Drama, sci-fi, misterio' },
  { id: 'fear',    label: 'Susto y adrenalina',          sub: 'Terror, acción intensa' },
];

const FORMAT_OPTIONS: { id: FormatPref; label: string }[] = [
  { id: 'movie',  label: 'Películas' },
  { id: 'series', label: 'Series'    },
  { id: 'both',   label: 'Los dos'   },
];

export default function ToneSelectScreen() {
  const insets = useSafeAreaInsets();
  const nav    = useNavigation<Nav>();
  const route  = useRoute<Route>();
  const themeColors = useColors();
  const { ageRange, fromProfile } = route.params;

  const [tone,   setTone]   = useState<ToneId | null>(null);
  const [format, setFormat] = useState<FormatPref | null>(null);

  function handleNext() {
    if (!tone || !format) return;
    nav.navigate('Onboarding', {
      ageRange,
      tone,
      format,
      fromProfile: fromProfile || undefined,
    });
  }

  return (
    <View style={[styles.root, { backgroundColor: themeColors.bg }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>TU PERFIL</Text>
        <Text style={styles.heading}>¿Qué te copa más ver?</Text>

        <View style={styles.section}>
          {TONE_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.id}
              style={[styles.card, tone === opt.id && styles.cardActive]}
              onPress={() => setTone(opt.id)}
              activeOpacity={0.8}
            >
              <Text style={[styles.cardLabel, tone === opt.id && styles.cardLabelActive]}>
                {opt.label}
              </Text>
              <Text style={styles.cardSub}>{opt.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.heading, styles.headingSecond]}>¿Películas o series?</Text>

        <View style={styles.formatRow}>
          {FORMAT_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.id}
              style={[styles.formatChip, format === opt.id && styles.formatChipActive]}
              onPress={() => setFormat(opt.id)}
              activeOpacity={0.8}
            >
              <Text style={[styles.formatLabel, format === opt.id && styles.formatLabelActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity
          style={[styles.nextBtn, (!tone || !format) && styles.nextBtnDisabled]}
          onPress={handleNext}
          disabled={!tone || !format}
          activeOpacity={0.85}
        >
          <Text style={styles.nextBtnText}>Siguiente</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:            { flex: 1 },
  content:         { paddingHorizontal: 24, gap: 16, paddingBottom: 24 },
  eyebrow:         { color: Colors.faint, fontSize: Typography.tiny, fontWeight: Typography.medium, letterSpacing: 2 },
  heading:         { color: Colors.text, fontSize: Typography.h1, fontWeight: Typography.bold },
  headingSecond:   { marginTop: 8, fontSize: Typography.h2 },
  section:         { gap: 10 },
  card: {
    backgroundColor: Colors.s1,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardActive:      { borderColor: Colors.accentBorder, backgroundColor: Colors.accentFaint },
  cardLabel:       { color: Colors.text, fontSize: Typography.h3, fontWeight: Typography.bold, marginBottom: 2 },
  cardLabelActive: { color: Colors.accent },
  cardSub:         { color: Colors.sub, fontSize: Typography.small },
  formatRow:       { flexDirection: 'row', gap: 10 },
  formatChip: {
    flex: 1,
    backgroundColor: Colors.s1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  formatChipActive:  { borderColor: Colors.accentBorder, backgroundColor: Colors.accentFaint },
  formatLabel:       { color: Colors.text, fontSize: Typography.body, fontWeight: Typography.bold },
  formatLabelActive: { color: Colors.accent },
  actions:           { paddingHorizontal: 24 },
  nextBtn:           { backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  nextBtnDisabled:   { opacity: 0.4 },
  nextBtnText:       { color: Colors.text, fontWeight: Typography.bold, fontSize: Typography.body },
});
