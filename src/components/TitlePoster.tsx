import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { getPosterUrl } from '../services/tmdb';
import { Colors, Typography } from '../constants/colors';
import type { NormalizedTitle } from '../services/tmdb';

const { width } = Dimensions.get('window');
const POSTER_H = Math.min(width * 1.5, 420);

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
          contentPosition={{ top: '0%' }}
          transition={300}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.fallback]}>
          <Text style={styles.fallbackEmoji}>🎬</Text>
        </View>
      )}

      {/* Strong gradient so white text always reads over any poster color */}
      <LinearGradient
        colors={['transparent', 'rgba(8,12,20,0.5)', 'rgba(8,12,20,0.92)', Colors.bg]}
        locations={[0.3, 0.55, 0.8, 1]}
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
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.s2,
  },
  fallback: { justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.s2 },
  fallbackEmoji: { fontSize: 64 },
  gradient: { justifyContent: 'flex-end' },
  info: { padding: 20 },
  titleText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  meta: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: Typography.small,
    marginBottom: 10,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
