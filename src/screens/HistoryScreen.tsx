import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography } from '../constants/colors';
import { useMatchStore } from '../store/useMatchStore';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  watched:   { label: 'Vista',     color: Colors.accent },
  watchlist: { label: 'Pendiente', color: Colors.warning },
  skipped:   { label: 'Pasada',    color: Colors.danger },
  pending:   { label: 'Pendiente', color: Colors.sub },
};

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { history } = useMatchStore();

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Historial</Text>
      <Text style={styles.sub}>Todos tus matches anteriores</Text>

      {history.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📋</Text>
          <Text style={styles.emptyTitle}>Todavía sin matches</Text>
          <Text style={styles.emptyDesc}>
            Cuando hagas tu primer match grupal, va a aparecer acá.
          </Text>
        </View>
      ) : (
        history.map(entry => (
          <View key={entry.matchId} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardDate}>
                {new Date(entry.createdAt).toLocaleDateString('es-AR', {
                  day: 'numeric', month: 'long',
                })}
              </Text>
              <Text style={styles.cardGroup}>{entry.groupName}</Text>
            </View>
            {entry.recommendations.map(r => {
              const st = STATUS_LABELS[r.groupStatus] ?? STATUS_LABELS.pending;
              return (
                <View key={r.title} style={styles.recRow}>
                  <Text style={styles.recTitle} numberOfLines={1}>{r.title}</Text>
                  <View style={[styles.badge, { backgroundColor: `${st.color}22`, borderColor: `${st.color}66` }]}>
                    <Text style={[styles.badgeText, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: 24 },
  title: { color: Colors.text, fontSize: Typography.hero, fontWeight: Typography.black, marginBottom: 4 },
  sub: { color: Colors.sub, fontSize: Typography.small, marginBottom: 28 },
  empty: { marginTop: 80, alignItems: 'center', gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { color: Colors.text, fontSize: Typography.h3, fontWeight: Typography.bold },
  emptyDesc: { color: Colors.sub, fontSize: Typography.small, textAlign: 'center', lineHeight: 20 },
  card: {
    backgroundColor: Colors.s1,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 10,
  },
  cardDate: { color: Colors.text, fontWeight: Typography.bold, fontSize: Typography.body },
  cardGroup: { color: Colors.sub, fontSize: Typography.small },
  recRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  recTitle: { color: Colors.text, fontSize: Typography.small, flex: 1, marginRight: 10 },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  badgeText: { fontSize: Typography.tiny, fontWeight: Typography.semibold },
});
