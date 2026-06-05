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
  onLaVi: () => void;
}

export default function ResultCard({ rec, onAction, onLaVi }: Props) {
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

      {/* Primary CTA */}
      <TouchableOpacity
        style={[styles.chooseBtn, rec.groupStatus === 'chosen' && styles.chooseBtnActive]}
        onPress={() => onAction('chosen')}
        activeOpacity={0.85}
      >
        <Feather
          name={rec.groupStatus === 'chosen' ? 'check-circle' : 'play-circle'}
          size={16}
          color={rec.groupStatus === 'chosen' ? Colors.accent : Colors.text}
          style={{ marginRight: 8 }}
        />
        <Text style={[styles.chooseBtnText, rec.groupStatus === 'chosen' && styles.chooseBtnTextActive]}>
          {rec.groupStatus === 'chosen' ? 'Elegida para ver ✓' : 'Elegir para ver esta noche'}
        </Text>
      </TouchableOpacity>

      {/* Secondary actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, rec.groupStatus === 'watched' && styles.actionActive]}
          onPress={onLaVi}
          activeOpacity={0.75}
        >
          <Feather name="check-circle" size={16} color={rec.groupStatus === 'watched' ? Colors.accent : Colors.sub} style={{ marginBottom: 4 }} />
          <Text style={[styles.actionLabel, rec.groupStatus === 'watched' && styles.actionLabelActive]}>
            {rec.groupStatus === 'watched' ? 'Vista ✓' : 'La vi'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, rec.groupStatus === 'watchlist' && styles.actionActive]}
          onPress={() => onAction('watchlist')}
          activeOpacity={0.75}
        >
          <Feather name="bookmark" size={16} color={rec.groupStatus === 'watchlist' ? Colors.accent : Colors.sub} style={{ marginBottom: 4 }} />
          <Text style={[styles.actionLabel, rec.groupStatus === 'watchlist' && styles.actionLabelActive]}>
            {rec.groupStatus === 'watchlist' ? 'Guardada ✓' : 'Para después'}
          </Text>
        </TouchableOpacity>
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
  chooseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    marginBottom: 8,
  },
  chooseBtnActive: {
    backgroundColor: Colors.accentFaint,
    borderWidth: 1,
    borderColor: Colors.accentBorder,
  },
  chooseBtnText: {
    color: Colors.text,
    fontSize: Typography.body,
    fontWeight: Typography.medium,
  },
  chooseBtnTextActive: { color: Colors.accent },
});
