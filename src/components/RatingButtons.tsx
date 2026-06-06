import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Colors, Typography } from '../constants/colors';
import type { Rating } from '../services/firebase';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

// 'double' = doble pulgar (Me encantó); el resto usa un ícono Feather normal
const ROW1: { rating: Rating; icon: FeatherName | 'double'; label: string }[] = [
  { rating: 'loved', icon: 'double',    label: 'Me encantó' },
  { rating: 'liked', icon: 'thumbs-up', label: 'Me gustó'   },
];

const ROW2: { rating: Rating; icon: FeatherName | 'double'; label: string }[] = [
  { rating: 'seen_disliked', icon: 'thumbs-down', label: 'No me gustó' },
  { rating: 'not_seen',      icon: 'eye',          label: 'No la vi'   },
];

function RatingIcon({ icon, color }: { icon: FeatherName | 'double'; color: string }) {
  if (icon === 'double') {
    return (
      <View style={styles.doubleThumb}>
        <Feather name="thumbs-up" size={22} color={color} />
        <Feather name="thumbs-up" size={22} color={color} style={styles.doubleThumbBack} />
      </View>
    );
  }
  return <Feather name={icon} size={22} color={color} style={{ marginBottom: 4 }} />;
}

interface Props {
  selected: Rating | null;
  onSelect: (r: Rating) => void;
}

function RatingRow({ buttons, selected, onSelect }: { buttons: typeof ROW1; selected: Rating | null; onSelect: (r: Rating) => void }) {
  return (
    <View style={styles.row}>
      {buttons.map(b => {
        const isSelected = selected === b.rating;
        return (
          <TouchableOpacity
            key={b.rating}
            style={[styles.btn, isSelected && styles.selected]}
            onPress={() => onSelect(b.rating)}
            activeOpacity={0.75}
          >
            <RatingIcon icon={b.icon} color={isSelected ? Colors.accent : Colors.sub} />
            <Text style={[styles.label, isSelected && styles.labelSelected]}>
              {b.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function RatingButtons({ selected, onSelect }: Props) {
  return (
    <View style={styles.grid}>
      <RatingRow buttons={ROW1} selected={selected} onSelect={onSelect} />
      <RatingRow buttons={ROW2} selected={selected} onSelect={onSelect} />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 10, paddingHorizontal: 4 },
  row: { flexDirection: 'row', gap: 10 },
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
  label: { fontSize: Typography.tiny, color: Colors.sub, textAlign: 'center' },
  labelSelected: { color: Colors.accent },
  doubleThumb: { flexDirection: 'row', marginBottom: 4, height: 22 },
  doubleThumbBack: { marginLeft: -8 },
});
