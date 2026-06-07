import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Modal, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Typography } from '../constants/colors';
import { useColors } from '../context/ThemeContext';
import { LogoWordmark } from '../components/Logo';
import { useAuthStore } from '../store/useAuthStore';
import { logout, deleteUserData, reAuthenticateUser, updateUserPlatforms } from '../services/firebase';
import { clearPushToken } from '../services/notifications';
import { useGroupStore } from '../store/useGroupStore';
import { useMatchStore } from '../store/useMatchStore';
import type { RootStackParamList } from '../navigation/types';
import { useTheme, type ThemePreference } from '../context/ThemeContext';
import { PLATFORMS } from '../constants/platforms';
import type { PlatformId } from '../constants/platforms';
import PlatformLogo from '../components/PlatformLogo';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'true';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const { user, setUser, setPlatforms } = useAuthStore();
  const { preference, setPreference } = useTheme();
  const themeColors = useColors();

  const [selPlatforms, setSelPlatforms] = useState<PlatformId[]>(user?.platforms ?? []);
  const [savingPlatforms, setSavingPlatforms] = useState(false);
  const [reAuthModal, setReAuthModal]   = useState(false);
  const [reAuthPwd,   setReAuthPwd]     = useState('');
  const [deleting,    setDeleting]      = useState(false);

  const THEME_OPTIONS: { key: ThemePreference; label: string }[] = [
    { key: 'dark',   label: 'Oscuro' },
    { key: 'light',  label: 'Claro' },
    { key: 'system', label: 'Sistema' },
  ];

  const topGenres = Object.entries(user?.tasteProfile?.genres ?? {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([g, score]) => ({ genre: g, score }));

  const ratingCount = Object.keys(user?.ratings ?? {}).length;
  const lovedCount  = Object.values(user?.ratings ?? {}).filter(r => r === 'loved').length;
  const seenCount   = Object.values(user?.ratings ?? {}).filter(r => r === 'seen_disliked').length;

  async function handleLogout() {
    Alert.alert('Cerrar sesión', '¿Querés cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir', style: 'destructive',
        onPress: async () => {
          if (!USE_MOCK && user) {
            try { await clearPushToken(user.uid); } catch { /* silenciar */ }
            try { await logout(); } catch { /* silenciar */ }
          }
          useGroupStore.getState().reset();
          useMatchStore.getState().reset();
          setUser(null);
        },
      },
    ]);
  }

  async function handleDeleteAccount() {
    Alert.alert(
      'Eliminar cuenta',
      'Se eliminarán todos tus datos permanentemente. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            if (USE_MOCK) {
              useGroupStore.getState().reset();
              useMatchStore.getState().reset();
              setUser(null); return;
            }
            setDeleting(true);
            try {
              if (user) await deleteUserData(user.uid);
              useGroupStore.getState().reset();
              useMatchStore.getState().reset();
              setUser(null);
            } catch (e) {
              const code = (e as { code?: string })?.code;
              if (code === 'auth/requires-recent-login') {
                setReAuthPwd('');
                setReAuthModal(true);
              } else {
                Alert.alert('Error', 'No se pudo eliminar la cuenta. Reintentá en unos minutos.');
              }
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }

  async function handleReAuthAndDelete() {
    if (!user?.email || !reAuthPwd.trim()) return;
    setDeleting(true);
    try {
      await reAuthenticateUser(user.email, reAuthPwd);
      await deleteUserData(user.uid);
      setReAuthModal(false);
      setUser(null);
    } catch {
      Alert.alert('Error', 'Contraseña incorrecta. Verificá e intentá de nuevo.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleSavePlatforms() {
    if (!user) return;
    setSavingPlatforms(true);
    try {
      if (!USE_MOCK) await updateUserPlatforms(user.uid, selPlatforms);
      setPlatforms(selPlatforms);
    } catch {
      Alert.alert('Error', 'No se pudieron guardar las plataformas.');
    } finally {
      setSavingPlatforms(false);
    }
  }

  function togglePlatform(id: PlatformId) {
    setSelPlatforms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  }

  const initial = user?.displayName?.[0]?.toUpperCase() ?? '?';

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: themeColors.bg }]}
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

      {/* Géneros ocultos */}
      {(user?.tasteProfile?.implicitGenres ?? []).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>También te gusta (sin darte cuenta)</Text>
          <Text style={styles.sectionSub}>Géneros que el sistema detectó pero no elegiste conscientemente</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            {user!.tasteProfile.implicitGenres.map(g => (
              <View key={g} style={styles.implicitChip}>
                <Text style={styles.implicitChipText}>{g}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

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

      {/* Plataformas */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tus plataformas</Text>
        <Text style={styles.sectionSub}>Usadas en el modo solo</Text>
        <View style={styles.platformGrid}>
          {PLATFORMS.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[styles.platformChip, selPlatforms.includes(p.id) && styles.platformChipSelected]}
              onPress={() => togglePlatform(p.id)}
              activeOpacity={0.8}
            >
              <PlatformLogo id={p.id} size={24} />
              <Text style={[styles.platformName, selPlatforms.includes(p.id) && styles.platformNameSelected]}>{p.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {JSON.stringify(selPlatforms) !== JSON.stringify(user?.platforms ?? []) && (
          <TouchableOpacity
            style={[styles.savePlatformsBtn, savingPlatforms && styles.btnDisabled]}
            onPress={handleSavePlatforms}
            disabled={savingPlatforms}
            activeOpacity={0.85}
          >
            <Text style={styles.savePlatformsBtnText}>{savingPlatforms ? 'Guardando…' : 'Guardar plataformas'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tema */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tema</Text>
        <Text style={styles.sectionSub}>Apariencia de la app</Text>
        <View style={styles.themeRow}>
          {THEME_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.themeBtn, preference === opt.key && styles.themeBtnActive]}
              onPress={() => setPreference(opt.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.themeBtnText, preference === opt.key && styles.themeBtnTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {ratingCount < 30 && (
        <TouchableOpacity style={styles.onboardingBtn} onPress={() => nav.navigate('Onboarding', { fromProfile: true })} activeOpacity={0.85}>
          <Text style={styles.onboardingBtnText}>
            {ratingCount === 0 ? 'Completar onboarding' : `Completar calificaciones (${ratingCount}/30)`}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.deleteBtn, deleting && { opacity: 0.5 }]} onPress={handleDeleteAccount} disabled={deleting} activeOpacity={0.8}>
        <Text style={styles.deleteBtnText}>{deleting ? 'Eliminando…' : 'Eliminar cuenta'}</Text>
      </TouchableOpacity>

      <Modal visible={reAuthModal} transparent animationType="fade" onRequestClose={() => setReAuthModal(false)}>
        <View style={styles.reAuthOverlay}>
          <View style={styles.reAuthBox}>
            <Text style={styles.reAuthTitle}>Confirmá tu identidad</Text>
            <Text style={styles.reAuthSub}>Ingresá tu contraseña para eliminar la cuenta</Text>
            <TextInput
              style={styles.reAuthInput}
              placeholder="Contraseña"
              placeholderTextColor={Colors.faint}
              value={reAuthPwd}
              onChangeText={setReAuthPwd}
              secureTextEntry
              autoFocus
            />
            <View style={styles.reAuthBtns}>
              <TouchableOpacity style={styles.reAuthCancel} onPress={() => setReAuthModal(false)}>
                <Text style={styles.reAuthCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.reAuthConfirm, (!reAuthPwd.trim() || deleting) && { opacity: 0.4 }]}
                onPress={handleReAuthAndDelete}
                disabled={!reAuthPwd.trim() || deleting}
              >
                {deleting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.reAuthConfirmText}>Eliminar</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: 24 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 24, marginBottom: 24 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: Typography.h1, fontWeight: Typography.medium },
  displayName: { color: Colors.text, fontSize: Typography.h3, fontWeight: Typography.medium },
  email: { color: Colors.sub, fontSize: Typography.small, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  statBox: { flex: 1, backgroundColor: Colors.s1, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  statNum: { color: Colors.accent, fontSize: Typography.h1, fontWeight: Typography.medium },
  statLabel: { color: Colors.sub, fontSize: Typography.tiny, marginTop: 2, textAlign: 'center' },
  section: { marginBottom: 28 },
  sectionTitle: { color: Colors.text, fontSize: Typography.h3, fontWeight: Typography.medium, marginBottom: 2 },
  sectionSub: { color: Colors.faint, fontSize: Typography.tiny, marginBottom: 14 },
  implicitChip: { backgroundColor: Colors.accentFaint, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: Colors.accentBorder },
  implicitChipText: { color: Colors.accent, fontSize: Typography.small },
  genreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  genreName: { color: Colors.sub, fontSize: Typography.small, width: 110 },
  barTrack: { flex: 1, height: 4, backgroundColor: Colors.s2, borderRadius: 2 },
  barFill: { height: 4, backgroundColor: Colors.accent, borderRadius: 2 },
  genreScore: { color: Colors.accent, fontSize: Typography.tiny, width: 36, textAlign: 'right' },
  emptyNote: { color: Colors.faint, fontSize: Typography.small },
  profileRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  profileLabel: { color: Colors.sub, fontSize: Typography.small },
  profileValue: { color: Colors.text, fontSize: Typography.small, fontWeight: Typography.medium },
  onboardingBtn: { backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  onboardingBtnText: { color: '#fff', fontSize: Typography.body, fontWeight: Typography.medium },
  logoutBtn: { borderRadius: 12, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, marginTop: 4, marginBottom: 10 },
  logoutText: { color: Colors.sub, fontSize: Typography.body },
  deleteBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.danger, marginBottom: 8 },
  deleteBtnText: { color: Colors.danger, fontSize: Typography.small },
  platformGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  platformChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.s2,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  platformChipSelected: { borderColor: Colors.accentBorder, backgroundColor: Colors.accentFaint },
  platformName: { color: Colors.sub, fontSize: Typography.body },
  platformNameSelected: { color: Colors.accent, fontWeight: Typography.medium },
  savePlatformsBtn: { backgroundColor: Colors.accent, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  savePlatformsBtnText: { color: '#fff', fontSize: Typography.body, fontWeight: Typography.medium },
  btnDisabled: { opacity: 0.4 },
  reAuthOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  reAuthBox: { backgroundColor: Colors.s1, borderRadius: 16, padding: 24, width: '100%', borderWidth: 1, borderColor: Colors.border },
  reAuthTitle: { color: Colors.text, fontSize: Typography.h3, fontWeight: Typography.bold, marginBottom: 6 },
  reAuthSub: { color: Colors.sub, fontSize: Typography.small, marginBottom: 20, lineHeight: 18 },
  reAuthInput: { backgroundColor: Colors.s2, borderRadius: 10, padding: 14, color: Colors.text, fontSize: Typography.body, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  reAuthBtns: { flexDirection: 'row', gap: 10 },
  reAuthCancel: { flex: 1, borderRadius: 10, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  reAuthCancelText: { color: Colors.sub, fontSize: Typography.body },
  reAuthConfirm: { flex: 1, backgroundColor: Colors.danger, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  reAuthConfirmText: { color: '#fff', fontSize: Typography.body, fontWeight: Typography.medium },
  themeRow: { flexDirection: 'row', gap: 8 },
  themeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.s1 },
  themeBtnActive: { borderColor: Colors.accentBorder, backgroundColor: Colors.accentFaint },
  themeBtnText: { color: Colors.sub, fontSize: Typography.small },
  themeBtnTextActive: { color: Colors.accent, fontWeight: Typography.medium },
});
