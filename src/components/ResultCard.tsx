import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Typography } from '../constants/colors';
import { getPlatform } from '../constants/platforms';
import type { Recommendation } from '../services/claude';

interface Props {
  rec: Recommendation;
  onAction: (status: Recommendation['groupStatus']) => void;
}

const ACTIONS: { status: Recommendation['groupStatus']; emoji: string; label: string }[] = [
  { status: 'watched',   emoji: '✅', label: 'La vimos' },
  { status: 'watchlist', emoji: '📌', label: 'Para después' },
  { status: 'skipped',   emoji: '❌', label: 'Pasar' },
];

export default function ResultCard({ rec, onAction }: Props) {
  const platform = getPlatform(rec.platform);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={2}>{rec.title}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{rec.compatibilityScore}% match</Text>
        </View>
      </View>

      <Text style={styles.meta}>
        {rec.year}  ·  {rec.type === 'series' ? 'Serie' : 'Película'}  ·  ⭐ {rec.rating}
        {'  '}
        <Text style={{ color: platform.color }}>{platform.emoji}</Text>
        {'  '}{platform.name}
      </Text>

      <Text style={styles.synopsis} numberOfLines={3}>{rec.synopsis}</Text>

      <View style={styles.whyBox}>
        <Text style={styles.whyLabel}>¿Por qué a nosotros?</Text>
        <Text style={styles.whyText}>{rec.whyUs}</Text>
      </View>

      <View style={styles.actions}>
        {ACTIONS.map(a => (
          <TouchableOpacity
            key={a.status}
            style={[styles.actionBtn, rec.groupStatus === a.status && styles.actionActive]}
            onPress={() => onAction(a.status)}
            activeOpacity={0.75}
          >
            <Text style={styles.actionEmoji}>{a.emoji}</Text>
            <Text style={[styles.actionLabel, rec.groupStatus === a.status && styles.actionLabelActive]}>
              {a.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.s1,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  title: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.h3,
    fontWeight: Typography.bold,
    marginRight: 10,
  },
  badge: {
    borderWidth: 1,
    borderColor: Colors.accentBorder,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { color: Colors.accent, fontSize: Typography.tiny, fontWeight: Typography.semibold },
  meta: { color: Colors.sub, fontSize: Typography.small, marginBottom: 10 },
  synopsis: { color: Colors.sub, fontSize: Typography.body, lineHeight: 20, marginBottom: 12 },
  whyBox: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
    backgroundColor: Colors.accentFaint,
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
  },
  whyLabel: {
    color: Colors.accent,
    fontSize: Typography.tiny,
    fontWeight: Typography.semibold,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  whyText: { color: Colors.text, fontSize: Typography.small, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.s2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionActive: { borderColor: Colors.accentBorder, backgroundColor: Colors.accentFaint },
  actionEmoji: { fontSize: 16, marginBottom: 2 },
  actionLabel: { fontSize: Typography.tiny, color: Colors.sub },
  actionLabelActive: { color: Colors.accent },
});
