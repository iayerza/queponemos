import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Colors, Typography } from '../constants/colors';
import { getPlatform } from '../constants/platforms';
import { getPosterUrl } from '../services/tmdb';
import PlatformLogo from './PlatformLogo';
import type { Recommendation } from '../services/claude';

interface Props {
  rec: Recommendation;
  onAction: (status: Recommendation['groupStatus']) => void;
}

type FeatherName = React.ComponentProps<typeof Feather>['name'];

const ACTIONS: { status: Recommendation['groupStatus']; icon: FeatherName; label: string }[] = [
  { status: 'watched',   icon: 'check-circle', label: 'La vimos' },
  { status: 'watchlist', icon: 'bookmark',      label: 'Para después' },
];

export default function ResultCard({ rec, onAction }: Props) {
  const platform = getPlatform(rec.platform);
  const posterUrl = getPosterUrl(rec.posterPath);

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        {posterUrl ? (
          <Image source={{ uri: posterUrl }} style={styles.poster} resizeMode="cover" />
        ) : (
          <View style={styles.posterPlaceholder}>
            <Feather name={rec.type === 'series' ? 'tv' : 'film'} size={26} color={Colors.faint} />
          </View>
        )}
        <View style={styles.topInfo}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={2}>{rec.title}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{rec.compatibilityScore}%</Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>{rec.year}  ·  {rec.type === 'series' ? 'Serie' : 'Película'}  ·  </Text>
            <Feather name="star" size={11} color={Colors.sub} />
            <Text style={styles.meta}>  {rec.rating}</Text>
          </View>
          <View style={styles.platformRow}>
            <PlatformLogo id={platform.id} size={18} />
            <Text style={styles.metaPlatform}>  {platform.name}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.synopsis} numberOfLines={3}>{rec.synopsis}</Text>

      <View style={styles.whyBox}>
        <Text style={styles.whyLabel}>¿Por qué a nosotros?</Text>
        <Text style={styles.whyText}>{rec.whyUs}</Text>
      </View>

      <View style={styles.actions}>
        {ACTIONS.map(a => {
          const isActive = rec.groupStatus === a.status;
          return (
            <TouchableOpacity
              key={a.status}
              style={[styles.actionBtn, isActive && styles.actionActive]}
              onPress={() => onAction(a.status)}
              activeOpacity={0.75}
            >
              <Feather name={a.icon} size={16} color={isActive ? Colors.accent : Colors.sub} style={{ marginBottom: 4 }} />
              <Text style={[styles.actionLabel, isActive && styles.actionLabelActive]}>
                {a.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity
        style={[styles.vetoBtn, rec.groupStatus === 'skipped' && styles.vetoBtnActive]}
        onPress={() => onAction('skipped')}
        activeOpacity={0.75}
      >
        <Feather name="slash" size={13} color={rec.groupStatus === 'skipped' ? Colors.danger : Colors.faint} />
        <Text style={[styles.vetoText, rec.groupStatus === 'skipped' && { color: Colors.danger }]}>
          {rec.groupStatus === 'skipped' ? 'Vetada' : 'Vetar (anónimo)'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.s1,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  topRow: { flexDirection: 'row', gap: 14, marginBottom: 12 },
  poster: { width: 80, height: 120, borderRadius: 6 },
  posterPlaceholder: {
    width: 80, height: 120, borderRadius: 6,
    backgroundColor: Colors.s2,
    alignItems: 'center', justifyContent: 'center',
  },
  topInfo: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  title: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.h3,
    fontWeight: Typography.bold,
    marginRight: 8,
    lineHeight: 22,
  },
  badge: {
    borderWidth: 1,
    borderColor: Colors.accentBorder,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { color: Colors.accent, fontSize: Typography.tiny, fontWeight: Typography.semibold },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  meta: { color: Colors.sub, fontSize: Typography.small },
  platformRow: { flexDirection: 'row', alignItems: 'center' },
  metaPlatform: { color: Colors.sub, fontSize: Typography.small },
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
  actions: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  vetoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  vetoBtnActive: { borderColor: Colors.danger, backgroundColor: 'rgba(200,48,42,0.08)' },
  vetoText: { color: Colors.faint, fontSize: Typography.tiny },
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
  actionLabel: { fontSize: Typography.tiny, color: Colors.sub },
  actionLabelActive: { color: Colors.accent },
});
