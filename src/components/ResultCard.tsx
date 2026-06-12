import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
  const [expanded, setExpanded] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [trailerLoading, setTrailerLoading] = useState(false);
  const [noTrailer, setNoTrailer] = useState(false);

  async function handleTrailer() {
    if (!rec.tmdbId) return;
    setTrailerLoading(true);
    setNoTrailer(false);
    try {
      const key = await fetchTrailerKey(rec.tmdbId, rec.type === 'series' ? 'tv' : 'movie');
      if (key) { await openTrailer(key); }
      else { setNoTrailer(true); setTimeout(() => setNoTrailer(false), 2500); }
    } catch {
      setNoTrailer(true);
      setTimeout(() => setNoTrailer(false), 2500);
    } finally { setTrailerLoading(false); }
  }

  const platform  = getPlatform(rec.platform);
  const posterUrl = getPosterUrl(rec.posterPath);

  return (
    <View style={styles.card}>
      {/* ── Fila principal: póster + info ──────────────────── */}
      <View style={styles.mainRow}>

        {/* Póster */}
        <View style={styles.posterWrap}>
          {posterUrl ? (
            <Image source={{ uri: posterUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <View style={styles.posterPlaceholder}>
              <Feather name={rec.type === 'series' ? 'tv' : 'film'} size={28} color={Colors.faint} />
            </View>
          )}
          {posterUrl && (
            <LinearGradient
              colors={['transparent', Colors.s1]}
              start={{ x: 0.45, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          )}
          <View style={styles.matchBadge}>
            <Text style={styles.matchScore}>{rec.compatibilityScore}%</Text>
          </View>
        </View>

        {/* Columna de info */}
        <View style={styles.infoCol}>
          {/* Plataforma */}
          <View style={styles.platformRow}>
            <PlatformLogo id={platform.id} size={13} />
            <Text style={styles.platformName}>{platform.name}</Text>
          </View>

          {/* Título */}
          <Text style={styles.title} numberOfLines={3}>{rec.title}</Text>

          {/* Meta */}
          <Text style={styles.meta}>
            {rec.year}  ·  {rec.type === 'series' ? 'Serie' : 'Película'}
            {rec.runtime ? `  ·  ${formatRuntime(rec.runtime, rec.type)}` : ''}
          </Text>

          {/* Rating + score */}
          <View style={styles.ratingRow}>
            <Feather name="star" size={10} color={Colors.warning} />
            <Text style={styles.ratingText}> {rec.rating}</Text>
            <Text style={styles.dot}>  ·  </Text>
            <Text style={styles.scoreLabel}>{scoreLabel(rec.compatibilityScore)}</Text>
          </View>

          <View style={{ flex: 1, minHeight: 10 }} />

          {/* CTA principal */}
          <TouchableOpacity
            style={[styles.chooseBtn, rec.groupStatus === 'chosen' && styles.chooseBtnDone]}
            onPress={() => onAction('chosen')}
            disabled={locked}
            activeOpacity={0.85}
          >
            <Text style={[styles.chooseBtnText, rec.groupStatus === 'chosen' && styles.chooseBtnTextDone]}>
              {rec.groupStatus === 'chosen' ? 'Elegida ✓' : '▶  Elegir para ver'}
            </Text>
          </TouchableOpacity>

          {/* Acciones secundarias */}
          <View style={styles.secRow}>
            <TouchableOpacity
              style={[styles.secBtn, rec.groupStatus === 'watched' && styles.secBtnActive]}
              onPress={onLaVi} disabled={locked} activeOpacity={0.75}
            >
              <Text style={[styles.secBtnText, rec.groupStatus === 'watched' && styles.secBtnTextActive]}>
                {rec.groupStatus === 'watched' ? '✓ Vista' : 'La vi'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secBtn, rec.groupStatus === 'watchlist' && styles.secBtnActive]}
              onPress={() => onAction('watchlist')} disabled={locked} activeOpacity={0.75}
            >
              <Text style={[styles.secBtnText, rec.groupStatus === 'watchlist' && styles.secBtnTextActive]}>
                {rec.groupStatus === 'watchlist' ? 'Guardada ✓' : 'Para después'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secBtn, rec.groupStatus === 'skipped' && styles.secBtnSkip]}
              onPress={() => onAction('skipped')} disabled={locked} activeOpacity={0.75}
            >
              <Text style={[styles.secBtnText, rec.groupStatus === 'skipped' && styles.secBtnTextSkip]}>
                Pasar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Toggle expandir ─────────────────────────────────── */}
      <TouchableOpacity style={styles.expandToggle} onPress={() => setExpanded(v => !v)} activeOpacity={0.7}>
        <Text style={styles.expandText}>{expanded ? 'Menos info  ▴' : 'Más info  ▾'}</Text>
      </TouchableOpacity>

      {/* ── Contenido expandido ─────────────────────────────── */}
      {expanded && (
        <View style={styles.expanded}>
          {rec.genres.length > 0 && (
            <View style={styles.genreRow}>
              {rec.genres.slice(0, 4).map(g => (
                <View key={g} style={styles.genreChip}>
                  <Text style={styles.genreChipText}>{g}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.synopsis}>{rec.synopsis}</Text>

          {rec.tmdbId && (
            <TouchableOpacity style={styles.trailerBtn} onPress={handleTrailer} activeOpacity={0.75} disabled={trailerLoading}>
              {trailerLoading
                ? <ActivityIndicator size="small" color={Colors.accent} />
                : <Feather name="play" size={12} color={noTrailer ? Colors.faint : Colors.accent} />}
              <Text style={[styles.trailerText, noTrailer && { color: Colors.faint }]}>
                {noTrailer ? 'Tráiler no disponible' : 'Ver tráiler'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.whyHeader} onPress={() => setWhyOpen(v => !v)} activeOpacity={0.7}>
            <Text style={styles.whyLabel}>¿Por qué a nosotros?</Text>
            <Feather name={whyOpen ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.accent} />
          </TouchableOpacity>
          {whyOpen && (
            <View style={styles.whyBox}>
              <Text style={styles.whyText}>{rec.whyUs}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.s1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
    overflow: 'hidden',
  },

  // ── Fila principal ────────────────────────────────────────
  mainRow: {
    flexDirection: 'row',
    minHeight: 210,
  },

  // Póster
  posterWrap: {
    width: 128,
    position: 'relative',
    backgroundColor: Colors.s2,
  },
  posterPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: Colors.accent,
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  matchScore: {
    color: '#fff',
    fontSize: Typography.small,
    fontFamily: Typography.fontMedium,
    fontWeight: Typography.medium,
  },

  // Columna info
  infoCol: {
    flex: 1,
    paddingTop: 14,
    paddingBottom: 12,
    paddingLeft: 6,
    paddingRight: 14,
  },
  platformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  platformName: {
    color: Colors.faint,
    fontSize: Typography.tiny,
    fontFamily: Typography.fontMedium,
    fontWeight: Typography.medium,
    letterSpacing: 0.2,
  },
  title: {
    color: Colors.text,
    fontSize: 19,
    fontFamily: Typography.fontMedium,
    fontWeight: Typography.medium,
    lineHeight: 25,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  meta: {
    color: Colors.sub,
    fontSize: Typography.small,
    marginBottom: 5,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  ratingText: { color: Colors.sub, fontSize: Typography.small },
  dot:        { color: Colors.faint, fontSize: Typography.small },
  scoreLabel: { color: Colors.accent, fontSize: Typography.tiny, fontWeight: Typography.medium },

  // CTA principal
  chooseBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 9,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 7,
  },
  chooseBtnDone: {
    backgroundColor: Colors.accentFaint,
    borderWidth: 1,
    borderColor: Colors.accentBorder,
  },
  chooseBtnText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: Typography.fontMedium,
    fontWeight: Typography.medium,
  },
  chooseBtnTextDone: { color: Colors.accent },

  // Acciones secundarias
  secRow: { flexDirection: 'row', gap: 5 },
  secBtn: {
    flex: 1,
    backgroundColor: Colors.s2,
    borderRadius: 7,
    paddingVertical: 7,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secBtnActive: { borderColor: Colors.accentBorder, backgroundColor: Colors.accentFaint },
  secBtnSkip:   { borderColor: Colors.danger, backgroundColor: 'rgba(200,48,42,0.08)' },
  secBtnText: {
    color: Colors.sub,
    fontSize: 10,
    fontFamily: Typography.fontMedium,
    fontWeight: Typography.medium,
  },
  secBtnTextActive: { color: Colors.accent },
  secBtnTextSkip:   { color: Colors.danger },

  // ── Toggle ──────────────────────────────────────────────
  expandToggle: {
    paddingVertical: 9,
    borderTopWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  expandText: {
    color: Colors.faint,
    fontSize: Typography.tiny,
    fontFamily: Typography.fontMedium,
    fontWeight: Typography.medium,
    letterSpacing: 0.3,
  },

  // ── Expandido ──────────────────────────────────────────
  expanded: { borderTopWidth: 0 },
  genreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 14,
    paddingTop: 14,
    marginBottom: 12,
  },
  genreChip: {
    backgroundColor: Colors.s2,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  genreChipText: { color: Colors.sub, fontSize: Typography.tiny },
  synopsis: {
    color: Colors.sub,
    fontSize: Typography.body,
    lineHeight: 21,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  trailerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  trailerText: { color: Colors.accent, fontSize: Typography.small, fontWeight: Typography.medium },
  whyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  whyLabel: {
    color: Colors.accent,
    fontSize: Typography.small,
    fontWeight: Typography.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  whyBox: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
    backgroundColor: Colors.accentFaint,
    marginHorizontal: 14,
    marginBottom: 14,
    borderRadius: 6,
    padding: 12,
  },
  whyText: { color: Colors.text, fontSize: Typography.small, lineHeight: 18 },
});
