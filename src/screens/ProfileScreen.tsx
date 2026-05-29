import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography } from '../constants/colors';
import { useAuthStore } from '../store/useAuthStore';
import { logout } from '../services/firebase';

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'true';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, setUser } = useAuthStore();

  async function handleLogout() {
    if (USE_MOCK) { setUser(null); return; }
    try { await logout(); setUser(null); }
    catch (e) { Alert.alert('Error', String(e)); }
  }

  const genres = Object.entries(user?.tasteProfile?.genres ?? {})
    .filter(([, s]) => s > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);

  const ratingCount = Object.keys(user?.ratings ?? {}).length;
  const lovedCount  = Object.values(user?.ratings ?? {}).filter(r => r === 'loved').length;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 40 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <View style={styles.hero}>
        <LinearGradient colors={[Colors.accent, Colors.s3]} style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.displayName ?? 'U')[0].toUpperCase()}
          </Text>
        </LinearGradient>
        <View>
          <Text style={styles.name}>{user?.displayName ?? 'Usuario'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>
      </View>

      {/* Géneros */}
      {genres.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Géneros favoritos</Text>
          {genres.map(([genre, score]) => (
            <View key={genre} style={styles.genreRow}>
              <Text style={styles.genreName}>{genre}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${Math.max(score * 100, 5)}%` }]} />
              </View>
              <Text style={styles.genreScore}>{Math.round(score * 100)}%</Text>
            </View>
          ))}
        </View>
      )}

      {/* Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Estadísticas</Text>
        <View style={styles.statsCard}>
          {[
            { label: 'Títulos calificados', value: String(ratingCount) },
            { label: 'Títulos que te encantaron', value: String(lovedCount) },
            { label: 'Series vs Películas',
              value: user?.tasteProfile?.seriesVsMovies != null
                ? `${Math.round(user.tasteProfile.seriesVsMovies * 100)}% series`
                : '—' },
            { label: 'Géneros identificados', value: String(genres.length) },
          ].map(({ label, value }) => (
            <View key={label} style={styles.statRow}>
              <Text style={styles.statLabel}>{label}</Text>
              <Text style={styles.statValue}>{value}</Text>
            </View>
          ))}
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: 24 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 32 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: Colors.text, fontSize: 24, fontWeight: Typography.black },
  name: { color: Colors.text, fontSize: Typography.h1, fontWeight: Typography.black },
  email: { color: Colors.sub, fontSize: Typography.small, marginTop: 2 },
  section: { marginBottom: 28 },
  sectionTitle: { color: Colors.text, fontSize: Typography.h3, fontWeight: Typography.bold, marginBottom: 16 },
  genreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  genreName: { color: Colors.sub, fontSize: Typography.small, width: 100 },
  barTrack: { flex: 1, height: 4, backgroundColor: Colors.s2, borderRadius: 2, overflow: 'hidden' },
  barFill: { height: 4, backgroundColor: Colors.accent, borderRadius: 2 },
  genreScore: { color: Colors.faint, fontSize: Typography.tiny, width: 36, textAlign: 'right' },
  statsCard: {
    backgroundColor: Colors.s1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  statLabel: { color: Colors.sub, fontSize: Typography.small },
  statValue: { color: Colors.text, fontWeight: Typography.bold, fontSize: Typography.small },
  logoutBtn: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(224,80,80,0.4)',
    backgroundColor: 'rgba(224,80,80,0.1)',
  },
  logoutText: { color: Colors.danger, fontWeight: Typography.semibold, fontSize: Typography.body },
});
