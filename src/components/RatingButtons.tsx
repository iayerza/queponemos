import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Typography } from '../constants/colors';
import type { Rating } from '../services/firebase';

const BUTTONS: { rating: Rating; emoji: string; label: string }[] = [
  { rating: 'loved',         emoji: '❤️', label: 'Me encantó' },
  { rating: 'seen_disliked', emoji: '😕', label: 'No me gustó' },
  { rating: 'not_seen',      emoji: '👀', label: 'No la vi' },
];

interface Props {
  selected: Rating | null;
  onSelect: (r: Rating) => void;
}

export default function RatingButtons({ selected, onSelect }: Props) {
  return (
    <View style={styles.row}>
      {BUTTONS.map(b => (
        <TouchableOpacity
          key={b.rating}
          style={[styles.btn, selected === b.rating && styles.selected]}
          onPress={() => onSelect(b.rating)}
          activeOpacity={0.75}
        >
          <Text style={styles.emoji}>{b.emoji}</Text>
          <Text style={[styles.label, selected === b.rating && styles.labelSelected]}>
            {b.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, paddingHorizontal: 4 },
  btn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.s1,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selected: {
    borderColor: Colors.accentBorder,
    backgroundColor: Colors.accentFaint,
  },
  emoji: { fontSize: 22, marginBottom: 4 },
  label: { fontSize: Typography.tiny, color: Colors.sub, textAlign: 'center' },
  labelSelected: { color: Colors.accent },
});
