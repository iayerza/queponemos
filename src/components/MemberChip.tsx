import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography } from '../constants/colors';

interface Props {
  name: string;
  isOnline?: boolean;
}

export default function MemberChip({ name, isOnline = true }: Props) {
  return (
    <View style={styles.chip}>
      <View style={[styles.dot, { backgroundColor: isOnline ? Colors.success : Colors.faint }]} />
      <Text style={styles.name}>{name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.s2,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
    marginBottom: 8,
  },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  name: { color: Colors.text, fontSize: Typography.small, fontWeight: Typography.medium },
});
