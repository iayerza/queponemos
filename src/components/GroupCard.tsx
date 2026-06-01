import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Colors, Typography } from '../constants/colors';
import type { GroupDoc } from '../services/firebase';
import { getPlatform } from '../constants/platforms';

interface Props {
  group: GroupDoc;
  onPress: () => void;
}

export default function GroupCard({ group, onPress }: Props) {
  const platformNames = group.platforms.map(p => getPlatform(p).name).join(', ');

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.avatar}>
        <Feather name="users" size={18} color={Colors.sub} />
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{group.name}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {group.members.length} personas · {platformNames}
        </Text>
      </View>
      <Feather name="chevron-right" size={20} color={Colors.sub} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.s1,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.s2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  info: { flex: 1 },
  name: { color: Colors.text, fontWeight: Typography.bold, fontSize: Typography.body, marginBottom: 2 },
  meta: { color: Colors.sub, fontSize: Typography.small },
});
