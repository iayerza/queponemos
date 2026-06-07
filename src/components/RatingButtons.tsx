import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Colors, Typography } from '../constants/colors';
import type { Rating } from '../services/firebase';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

const BUTTONS: { rating: Rating; icon: FeatherName; label: string }[] = [
  { rating: 'loved',         icon: 'heart',       label: 'Me encantó' },
  { rating: 'liked',         icon: 'thumbs-up',   label: 'Me gustó' },
  { rating: 'seen_disliked', icon: 'thumbs-down', label: 'No me gustó' },
  { rating: 'not_seen',      icon: 'eye-off',     label: 'No la vi' },
];

interface Props {
  selected: Rating | null;
  onSelect: (r: Rating) => void;
}

export default function RatingButtons({ selected, onSelect }: Props) {
  return (
    <View style={styles.grid}>
      {BUTTONS.map(b => {
        const isSelected = selected === b.rating;
        return (
          <TouchableOpacity
            key={b.rating}
            style={[styles.btn, isSelected && styles.selected]}
            onPress={() => onSelect(b.rating)}
            activeOpacity={0.75}
          >
            <Feather name={b.icon} size={20} color={isSelected ? Colors.accent : Colors.sub} style={{ marginBottom: 4 }} />
            <Text style={[styles.label, isSelected && styles.labelSelected]}>
              {b.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  btn: {
    width: '47.5%',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.s1,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selected: {
    borderColor: Colors.accentBorder,
    backgroundColor: Colors.accentFaint,
  },
  label: { fontSize: Typography.tiny, color: Colors.sub, textAlign: 'center' },
  labelSelected: { color: Colors.accent },
});
