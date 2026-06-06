import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Colors, Typography } from '../constants/colors';
import type { Rating } from '../services/firebase';

type FeatherName = React.ComponentProps<typeof Feather>['name'];
type IconType = FeatherName | 'double';

const BUTTONS: { rating: Rating; icon: IconType; label: string }[] = [
  { rating: 'loved',         icon: 'double',       label: 'Me encantó' },
  { rating: 'liked',         icon: 'thumbs-up',    label: 'Me gustó' },
  { rating: 'seen_disliked', icon: 'thumbs-down',  label: 'No me gustó' },
  { rating: 'not_seen',      icon: 'eye-off',      label: 'No la vi' },
];

function RatingIcon({ icon, color, size }: { icon: IconType; color: string; size: number }) {
  if (icon === 'double') {
    return (
      <View style={{ width: size + 8, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Feather name="thumbs-up" size={size - 4} color={color} style={{ position: 'absolute', left: 0, top: 2 }} />
        <Feather name="thumbs-up" size={size}     color={color} style={{ position: 'absolute', right: 0 }} />
      </View>
    );
  }
  return <Feather name={icon} size={size} color={color} />;
}

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
            <View style={styles.iconWrap}>
              <RatingIcon icon={b.icon} size={22} color={isSelected ? Colors.accent : Colors.sub} />
            </View>
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 4,
  },
  btn: {
    width: '47%',
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
  iconWrap: { marginBottom: 6, height: 26, justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: Typography.small, color: Colors.sub, textAlign: 'center' },
  labelSelected: { color: Colors.accent },
});
