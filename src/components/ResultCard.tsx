import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ActivityIndicator } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Colors, Typography } from '../constants/colors';
import { getPlatform } from '../constants/platforms';
import { getPosterUrl, fetchTrailerKey } from '../services/tmdb';
import PlatformLogo from './PlatformLogo';
import { openTrailer } from './TrailerModal';
import type { Recommendation } from '../services/claude';

interface Props {
  rec: Recommendation;
  onAction: (status: Recommendation['groupStatus']) => void;
  onLaVi: () => void;
}

function formatRuntime(min: number, type: 'movie' | 'series'): string {
  if (type === 'series') return `~${min}m/ep`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function scoreLabel(score: number): string {
  if (score >= 92) return 'Match perfecto';
  if (score >= 83) return 'Match excelente';
  if (score >= 71) return 'Muy buena';
  return 'Buena opción';
}

export default function ResultCard({ rec, onAction, onLaVi }: Props) {
  const locked = rec.groupStatus !== 'pending';
  const [whyOpen, setWhyOpen] = useState(false);
  const [synopsisOpen, setSynopsisOpen] = useState(false);
  const [trailerLoading, setTrailerLoading] = useState(false);
  const [noTrailer, setNoTrailer] = useState(false);

  async function handleTrailer() {
    if (!rec.tmdbId) return;
    setTrailerLoading(true);
    setNoTrailer(false);
    try {
      const mediaType = rec.type === 'series' ? 'tv' : 'movie';
      const key = await fetchTrailerKey(rec.tmdbId, mediaType);
      if (key) {
        await openTrailer(key);
      } else {
        setNoTrailer(true);
        setTimeout(() => setNoTrailer(false), 2500);
      }
    } catch {
      setNoTrailer(true);
      setTimeout(() => setNoTrailer(false), 2500);
    } finally {
      setTrailerLoading(false);
    }
  }
  const platform  = getPlatform(rec.platform);
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
          <Text style={styles.title} numberOfLines={2}>{rec.title}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>{rec.year}  ·  {rec.type === 'series' ? 'Serie' : 'Película'}  ·  </Text>
            <Feather name="star" size={11} color={Colors.sub} />
            <Text style={styles.meta}>  {rec.rating}</Text>
            {rec.runtime ? <Text style={styles.meta}>  ·  {formatRuntime(rec.runtime, rec.type)}</Text> : null}
          </View>
          <View style={styles.platformRow}>
            <PlatformLogo id={platform.id} size={16} />
            <Text style={styles.metaPlatform}>  {platform.name}</Text>
          </View>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeScore}>{rec.compatibilityScore}%</Text>
            </View>
            <Text style={styles.badgeLabel}>{scoreLabel(rec.compatibilityScore)}</Text>
          </View>
        </View>
      </View>

      {/* Genre chips */}
      {rec.genres.length > 0 && (
        <View style={styles.genreRow}>
          {rec.genres.slice(0, 4).map(g => (
            <View key={g} style={styles.genreChip}>
              <Text style={styles.genreChipText}>{g}</Text>
            </View>
          ))}
        </View>
      )}

      {rec.tmdbId && (
        <TouchableOpacity style={styles.trailerBtn} onPress={handleTrailer} activeOpacity={0.75} disabled={trailerLoading}>
          {trailerLoading
            ? <ActivityIndicator size="small" color={Colors.accent} />
            : <Feather name="play" size={12} color={noTrailer ? Colors.faint : Colors.accent} />
          }
          <Text style={[styles.trailerText, noTrailer && { color: Colors.faint }]}>
            {noTrailer ? 'Tráiler no disponible' : 'Ver tráiler'}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={() => setSynopsisOpen(o => !o)} activeOpacity={0.8}>
        <Text style={styles.synopsis} numberOfLines={synopsisOpen ? undefined : 3}>{rec.synopsis}</Text>
        {!synopsisOpen && <Text style={styles.readMore}>Ver más</Text>}
      </TouchableOpacity>

      {/* Collapsible why */}
      <TouchableOpacity style={styles.whyHeader} onPress={() => setWhyOpen(o => !o)} activeOpacity={0.7}>
        <Text style={styles.whyLabel}>¿Por qué a nosotros?</Text>
        <Feather name={whyOpen ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.accent} />
      </TouchableOpacity>
      {whyOpen && (
        <View style={styles.whyBox}>
          <Text style={styles.whyText}>{rec.whyUs}</Text>
        </View>
      )}

      {/* Primary CTA */}
      <TouchableOpacity
        style={[styles.chooseBtn, rec.groupStatus === 'chosen' && styles.chooseBtnActive]}
        onPress={() => onAction('chosen')}
        disabled={locked}
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
          disabled={locked}
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
          disabled={locked}
          activeOpacity={0.75}
        >
          <Feather name="bookmark" size={16} color={rec.groupStatus === 'watchlist' ? Colors.accent : Colors.sub} style={{ marginBottom: 4 }} />
          <Text style={[styles.actionLabel, rec.groupStatus === 'watchlist' && styles.actionLabelActive]}>
            {rec.groupStatus === 'watchlist' ? 'Guardada ✓' : 'Para después'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, rec.groupStatus === 'skipped' && styles.actionSkipped]}
          onPress={() => onAction('skipped')}
          disabled={locked}
          activeOpacity={0.75}
        >
          <Feather name="x" size={16} color={rec.groupStatus === 'skipped' ? Colors.danger : Colors.sub} style={{ marginBottom: 4 }} />
          <Text style={[styles.actionLabel, rec.groupStatus === 'skipped' && styles.actionLabelSkipped]}>
            {rec.groupStatus === 'skipped' ? 'Pasada' : 'Pasar'}
          </Text>
        </TouchableOpacity>
      </View>
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
  topRow: { flexDirection: 'row', gap: 14, marginBottom: 10 },
  poster: { width: 80, height: 120, borderRadius: 6 },
  posterPlaceholder: {
    width: 80, height: 120, borderRadius: 6,
    backgroundColor: Colors.s2,
    alignItems: 'center', justifyContent: 'center',
  },
  topInfo: { flex: 1, justifyContent: 'space-between' },
  title: {
    color: Colors.text,
    fontSize: Typography.h3,
    fontWeight: Typography.bold,
    lineHeight: 22,
    marginBottom: 4,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  meta: { color: Colors.sub, fontSize: Typography.small },
  platformRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  metaPlatform: { color: Colors.sub, fontSize: Typography.small },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    borderWidth: 1,
    borderColor: Colors.accentBorder,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeScore: { color: Colors.accent, fontSize: Typography.tiny, fontWeight: Typography.semibold },
  badgeLabel: { color: Colors.accent, fontSize: Typography.tiny },
  genreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  genreChip: {
    backgroundColor: Colors.s2,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  genreChipText: { color: Colors.sub, fontSize: Typography.tiny },
  synopsis: { color: Colors.sub, fontSize: Typography.body, lineHeight: 20, marginBottom: 4 },
  readMore: { color: Colors.accent, fontSize: Typography.small, marginBottom: 10 },
  trailerBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10, alignSelf: 'flex-start' },
  trailerText: { color: Colors.accent, fontSize: Typography.small, fontWeight: Typography.medium },
  whyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  whyLabel: {
    color: Colors.accent,
    fontSize: Typography.small,
    fontWeight: Typography.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  whyBox: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
    backgroundColor: Colors.accentFaint,
    borderRadius: 6,
    padding: 12,
    marginTop: -4,
    marginBottom: 12,
  },
  whyText: { color: Colors.text, fontSize: Typography.small, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
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
  actionSkipped: { borderColor: Colors.danger, backgroundColor: 'rgba(200,48,42,0.08)' },
  actionLabel: { fontSize: Typography.tiny, color: Colors.sub },
  actionLabelActive: { color: Colors.accent },
  actionLabelSkipped: { color: Colors.danger },
});
