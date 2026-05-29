import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { getPosterUrl } from '../services/tmdb';
import { Colors, Typography } from '../constants/colors';
import type { NormalizedTitle } from '../services/tmdb';

const { width } = Dimensions.get('window');
const POSTER_H = Math.min(width * 1.5, 360);

interface Props {
  title: NormalizedTitle;
}

export default function TitlePoster({ title }: Props) {
  const posterUrl = getPosterUrl(title.posterPath);

  return (
    <View style={[styles.container, { height: POSTER_H }]}>
      {posterUrl ? (
        <Image
          source={{ uri: posterUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={300}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.fallback]}>
          <Text style={styles.fallbackEmoji}>🎬</Text>
        </View>
      )}

      <LinearGradient
        colors={['transparent', 'rgba(8,12,20,0.85)', Colors.bg]}
        locations={[0.4, 0.75, 1]}
        style={[StyleSheet.absoluteFill, styles.gradient]}
      />

      <View style={styles.info}>
        <Text style={styles.titleText} numberOfLines={2}>{title.title}</Text>
        <Text style={styles.meta}>
          {title.year} · {title.type === 'tv' ? 'Serie' : 'Película'} · ⭐ {title.rating}
        </Text>
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
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.s2,
  },
  fallback: { justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.s2 },
  fallbackEmoji: { fontSize: 64 },
  gradient: { justifyContent: 'flex-end' },
  info: { padding: 16 },
  titleText: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: Typography.bold,
    marginBottom: 4,
  },
  meta: { color: Colors.sub, fontSize: Typography.small, marginBottom: 8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagText: { color: Colors.sub, fontSize: Typography.tiny },
});
