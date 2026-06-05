import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import BottomSheet from './BottomSheet';
import { Colors, Typography } from '../constants/colors';
import type { Rating } from '../services/firebase';

interface Props {
  visible: boolean;
  title: string;
  onClose: () => void;
  onRate: (rating: Rating) => void;
}

const OPTIONS: { rating: Rating; emoji: string; label: string }[] = [
  { rating: 'loved',         emoji: '👍👍', label: 'Me encantó' },
  { rating: 'liked',         emoji: '👍',   label: 'Me gustó' },
  { rating: 'seen_disliked', emoji: '👎',   label: 'No me gustó' },
];

export default function WatchedRatingSheet({ visible, title, onClose, onRate }: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.container}>
        <Text style={styles.heading}>¿Cómo estuvo?</Text>
        <Text style={styles.movieTitle} numberOfLines={2}>{title}</Text>
        <View style={styles.options}>
          {OPTIONS.map(o => (
            <TouchableOpacity
              key={o.rating}
              style={styles.optionBtn}
              onPress={() => onRate(o.rating)}
              activeOpacity={0.8}
            >
              <Text style={styles.emoji}>{o.emoji}</Text>
              <Text style={styles.label}>{o.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingBottom: 8 },
  heading: {
    color: Colors.text,
    fontSize: Typography.h2,
    fontWeight: Typography.bold,
    marginBottom: 6,
  },
  movieTitle: {
    color: Colors.sub,
    fontSize: Typography.body,
    marginBottom: 24,
  },
  options: { gap: 10 },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.s2,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emoji: { fontSize: 22 },
  label: { color: Colors.text, fontSize: Typography.body, fontWeight: Typography.medium },
});
