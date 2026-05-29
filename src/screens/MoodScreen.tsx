import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Colors, Typography } from '../constants/colors';
import { useMatchStore } from '../store/useMatchStore';
import { useAuthStore } from '../store/useAuthStore';
import type { RootStackParamList } from '../navigation/types';
import type { MoodId } from '../services/claude';

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Mood'>;

const MOODS: { id: MoodId; emoji: string; label: string; desc: string }[] = [
  { id: 'chill',   emoji: '😌', label: 'Tranqui',     desc: 'Relajado, sin pensar mucho' },
  { id: 'intense', emoji: '🔥', label: 'Adrenalina',  desc: 'Tensión, al borde del asiento' },
  { id: 'laugh',   emoji: '😂', label: 'Reírse',      desc: 'Comedia, algo liviano' },
  { id: 'think',   emoji: '🧠', label: 'Reflexionar', desc: 'Algo que deje pensando' },
  { id: 'cry',     emoji: '😭', label: 'Emocionarse', desc: 'Drama, sentimientos' },
  { id: 'scared',  emoji: '😱', label: 'Asustarse',   desc: 'Terror o suspenso' },
];

export default function MoodScreen() {
  const insets = useSafeAreaInsets();
  const nav    = useNavigation<Nav>();
  const route  = useRoute<Route>();
  const { user } = useAuthStore();
  const { setMood } = useMatchStore();
  const [selected, setSelected] = useState<MoodId | null>(null);

  function handleSelect(id: MoodId) {
    setSelected(id);
    if (user) setMood(user.uid, id);
  }

  function handleSearch() {
    if (!selected) return;
    nav.navigate('Matching', { groupId: route.params.groupId });
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <TouchableOpacity style={styles.back} onPress={() => nav.goBack()}>
        <Text style={styles.backText}>← VOLVER</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>
          {'¿Cómo estás\n'}
          <Text style={{ color: Colors.accent }}>esta noche?</Text>
        </Text>
        <Text style={styles.sub}>
          Tu estado de ánimo ayuda a encontrar el mejor match para el grupo.
        </Text>

        <View style={styles.grid}>
          {MOODS.map(m => (
            <TouchableOpacity
              key={m.id}
              style={[styles.moodBtn, selected === m.id && styles.moodBtnSelected]}
              onPress={() => handleSelect(m.id)}
              activeOpacity={0.8}
            >
              <Text style={styles.moodEmoji}>{m.emoji}</Text>
              <Text style={[styles.moodLabel, selected === m.id && styles.moodLabelSelected]}>
                {m.label}
              </Text>
              <Text style={styles.moodDesc}>{m.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.searchBtn, !selected && styles.searchBtnDisabled]}
          onPress={handleSearch}
          disabled={!selected}
          activeOpacity={0.85}
        >
          <Text style={styles.searchBtnText}>Buscar match</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  back: { paddingHorizontal: 24, paddingVertical: 12 },
  backText: { color: Colors.sub, fontSize: Typography.tiny, fontWeight: Typography.semibold, letterSpacing: 1 },
  scroll: { paddingHorizontal: 24, paddingBottom: 40 },
  title: {
    color: Colors.text,
    fontSize: Typography.hero,
    fontWeight: Typography.black,
    lineHeight: 40,
    marginBottom: 10,
    marginTop: 4,
  },
  sub: { color: Colors.sub, fontSize: Typography.body, marginBottom: 28, lineHeight: 22 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  moodBtn: {
    width: '47%',
    backgroundColor: Colors.s1,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  moodBtnSelected: { borderColor: Colors.accentBorder, backgroundColor: Colors.accentFaint },
  moodEmoji: { fontSize: 28, marginBottom: 8 },
  moodLabel: { color: Colors.text, fontWeight: Typography.bold, fontSize: Typography.body, marginBottom: 4 },
  moodLabelSelected: { color: Colors.accent },
  moodDesc: { color: Colors.sub, fontSize: Typography.tiny, lineHeight: 16 },
  searchBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
  },
  searchBtnDisabled: { opacity: 0.4 },
  searchBtnText: { color: Colors.text, fontWeight: Typography.bold, fontSize: Typography.body },
});
