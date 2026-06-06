import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Image } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { getPosterUrl } from '../services/tmdb';
import { Colors, Typography } from '../constants/colors';
import type { NormalizedTitle } from '../services/tmdb';

const SCREEN_H = Dimensions.get('window').height;
const CARD_W   = Dimensions.get('window').width - 48; // 24px paddingHorizontal × 2
const POSTER_H = Math.min(Math.round(CARD_W * 1.5), Math.round(SCREEN_H * 0.40));

interface Props {
  title: NormalizedTitle;
}

export default function TitlePoster({ title }: Props) {
  const posterUrl = getPosterUrl(title.posterPath);
  const [imgError, setImgError] = useState(false);

  return (
    <View style={[styles.container, { height: POSTER_H }]}>
      {posterUrl && !imgError ? (
        <Image
          source={{ uri: posterUrl }}
          style={{ position: 'absolute', top: 0, left: 0, width: CARD_W, height: POSTER_H, borderRadius: 16 }}
          resizeMode="cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.fallback]}>
          <Feather name="film" size={64} color={Colors.faint} />
        </View>
      )}

      {/* Flat dark overlay for readability — no gradient (brand rule) */}
      <View style={[StyleSheet.absoluteFill, styles.overlay]} />

      <View style={styles.info}>
        <Text style={styles.titleText} numberOfLines={2}>{title.title}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{title.year} · {title.type === 'tv' ? 'Serie' : 'Película'} · </Text>
          <Feather name="star" size={11} color="rgba(255,255,255,0.75)" />
          <Text style={styles.meta}> {title.rating}</Text>
        </View>
        <View style={styles.tags}>
          {title.genres.slice(0, 3).map(g => (
            <View key={g} style={styles.tag}>
              <Text style={styles.tagText}>{g}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CARD_W,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.s2,
    justifyContent: 'flex-end',
  },
  fallback: { justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.s2 },
  overlay: { backgroundColor: 'rgba(0,0,0,0.30)' },
  info: { padding: 20, backgroundColor: 'rgba(0,0,0,0.60)' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  titleText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: Typography.medium,
    marginBottom: 6,
  },
  meta: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: Typography.small,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: { color: 'rgba(255,255,255,0.85)', fontSize: Typography.tiny },
});
