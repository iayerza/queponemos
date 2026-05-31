import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography } from '../constants/colors';
import { LogoWordmark } from '../components/Logo';
import { useAuthStore } from '../store/useAuthStore';
import { logout } from '../services/firebase';

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'true';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, setUser } = useAuthStore();

  const topGenres = Object.entries(user?.tasteProfile?.genres ?? {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([g, score]) => ({ genre: g, score }));

  const ratingCount = Object.keys(user?.ratings ?? {}).length;
  const lovedCount  = Object.values(user?.ratings ?? {}).filter(r => r === 'loved').length;
  const seenCount   = Object.values(user?.ratings ?? {}).filter(r => r === 'seen_disliked').length;

  async function handleLogout() {
    Alert.alert('Cerrar sesión', '¿Seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir', style: 'destructive',
        onPress: async () => {
          if (!USE_MOCK) { try { await logout(); } catch { /* silenciar */ } }
          setUser(null);
        },
      },
    ]);
  }

  const initial = user?.displayName?.[0]?.toUpperCase() ?? '?';

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      <LogoWordmark markSize={20} />

      <View style={styles.avatarRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.displayName}>{user?.displayName ?? '—'}</Text>
          <Text style={styles.email}>{user?.email ?? ''}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        {[
          { num: ratingCount, label: 'calificados' },
          { num: lovedCount,  label: 'amados' },
          { num: seenCount,   label: 'no gustaron' },
        ].map(s => (
          <View key={s.label} style={styles.statBox}>
            <Text style={styles.statNum}>{s.num}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Géneros top */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tus géneros</Text>
        <Text style={styles.sectionSub}>Inferidos de tus calificaciones</Text>
        {topGenres.length > 0 ? topGenres.map(({ genre, score }) => (
          <View key={genre} style={styles.genreRow}>
            <Text style={styles.genreName}>{genre}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${Math.round(score * 100)}%` }]} />
            </View>
            <Text style={styles.genreScore}>{Math.round(score * 100)}%</Text>
          </View>
        )) : (
          <Text style={styles.emptyNote}>Completá el onboarding para ver tus géneros</Text>
        )}
      </View>

      {/* Perfil inferido */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tu perfil</Text>
        {[
          {
            label: 'Intensidad preferida',
            value: (user?.tasteProfile?.intensity ?? 0.5) > 0.65 ? 'Alta' :
                   (user?.tasteProfile?.intensity ?? 0.5) < 0.35 ? 'Suave' : 'Moderada',
          },
          {
            label: 'Series vs películas',
            value: (user?.tasteProfile?.seriesVsMovies ?? 0.5) > 0.6 ? 'Series' :
                   (user?.tasteProfile?.seriesVsMovies ?? 0.5) < 0.4 ? 'Películas' : 'Mitad y mitad',
          },
          {
            label: 'Títulos calificados',
            value: `${ratingCount}/30${ratingCount < 12 ? ' — completá el onboarding' : ' ✓'}`,
            accent: ratingCount >= 12,
          },
        ].map(row => (
          <View key={row.label} style={styles.profileRow}>
            <Text style={styles.profileLabel}>{row.label}</Text>
            <Text style={[styles.profileValue, row.accent === true && { color: Colors.success }]}>
              {row.value}
            </Text>
          </View>
        ))}
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
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 24, marginBottom: 24 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 26, fontWeight: Typography.medium },
  displayName: { color: Colors.text, fontSize: Typography.h3, fontWeight: Typography.medium },
  email: { color: Colors.sub, fontSize: Typography.small, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  statBox: { flex: 1, backgroundColor: Colors.s1, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  statNum: { color: Colors.accent, fontSize: Typography.h1, fontWeight: Typography.medium },
  statLabel: { color: Colors.sub, fontSize: Typography.tiny, marginTop: 2, textAlign: 'center' },
  section: { marginBottom: 28 },
  sectionTitle: { color: Colors.text, fontSize: Typography.h3, fontWeight: Typography.medium, marginBottom: 2 },
  sectionSub: { color: Colors.faint, fontSize: Typography.tiny, marginBottom: 14 },
  genreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  genreName: { color: Colors.sub, fontSize: Typography.small, width: 110 },
  barTrack: { flex: 1, height: 4, backgroundColor: Colors.s2, borderRadius: 2 },
  barFill: { height: 4, backgroundColor: Colors.accent, borderRadius: 2 },
  genreScore: { color: Colors.accent, fontSize: Typography.tiny, width: 36, textAlign: 'right' },
  emptyNote: { color: Colors.faint, fontSize: Typography.small },
  profileRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  profileLabel: { color: Colors.sub, fontSize: Typography.small },
  profileValue: { color: Colors.text, fontSize: Typography.small, fontWeight: Typography.medium },
  logoutBtn: { borderRadius: 12, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, marginTop: 12 },
  logoutText: { color: Colors.sub, fontSize: Typography.body },
});
