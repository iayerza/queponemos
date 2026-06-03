import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Feather from '@expo/vector-icons/Feather';
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
  const [imgError, setImgError] = useState(false);

  return (
    <View style={[styles.container, { height: POSTER_H }]}>
      {posterUrl && !imgError ? (
        <Image
          source={{ uri: posterUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.fallback]}>
          <Feather name="film" size={64} color={Colors.faint} />
        </View>
      )}

      {/* Gradient siempre oscuro — nunca usa Colors.bg para no quedar blanco en light mode */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.9)', 'rgba(0,0,0,0.97)']}
        locations={[0.2, 0.5, 0.75, 1]}
        style={StyleSheet.absoluteFill}
      />

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
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.s2,
    justifyContent: 'flex-end',
  },
  fallback: { justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.s2 },
  info: { padding: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  titleText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: Typography.medium,
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  meta: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: Typography.small,
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
