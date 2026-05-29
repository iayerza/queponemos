import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { GoogleAuthProvider, signInWithCredential, getAuth } from 'firebase/auth';
import { Colors, Typography } from '../constants/colors';
import { useAuthStore } from '../store/useAuthStore';
import { getUserProfile, loginWithGoogleCredential } from '../services/firebase';
import { MOCK_USER } from '../utils/mock';

WebBrowser.maybeCompleteAuthSession();

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'true';
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';

const FEATURES = [
  { emoji: '🤖', title: 'IA que analiza gustos reales', desc: 'No géneros genéricos, títulos reales' },
  { emoji: '👥', title: 'Grupos de hasta 5 personas',   desc: 'La IA encuentra el terreno común' },
  { emoji: '📺', title: 'Solo lo disponible hoy',       desc: 'Filtra por plataformas y país' },
];

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { setUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: GOOGLE_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type !== 'success') return;
    const { id_token } = response.params;
    setLoading(true);
    setError(null);
    loginWithGoogleCredential(id_token)
      .then(profile => setUser(profile))
      .catch(e => setError('Error al iniciar sesión. Intentá de nuevo.'))
      .finally(() => setLoading(false));
  }, [response]);

  async function handlePress() {
    if (USE_MOCK) { setUser(MOCK_USER); return; }
    if (!GOOGLE_CLIENT_ID) {
      setError('Falta EXPO_PUBLIC_GOOGLE_CLIENT_ID en .env');
      return;
    }
    setError(null);
    await promptAsync();
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      bounces={false}
    >
      <View style={styles.hero}>
        <LinearGradient colors={[Colors.s3, Colors.s2, Colors.bg]} style={StyleSheet.absoluteFill} />
        <Text style={styles.heroEmoji}>🎬</Text>
        <LinearGradient
          colors={['transparent', Colors.bg]}
          locations={[0.5, 1]}
          style={[StyleSheet.absoluteFill, styles.heroFade]}
        />
        <View style={[styles.heroText, { paddingTop: insets.top + 40 }]}>
          <Text style={styles.headline}>
            {'Elegí qué\nver '}
            <Text style={{ color: Colors.accent }}>juntos.</Text>
          </Text>
          <Text style={styles.subline}>
            Recomendaciones de IA que tienen en cuenta los gustos reales de todos.
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <TouchableOpacity
          style={[styles.googleBtn, (loading || !request && !USE_MOCK) && styles.btnDisabled]}
          onPress={handlePress}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#111" />
            : <>
                <Text style={styles.googleIcon}>G</Text>
                <Text style={styles.googleLabel}>Continuar con Google</Text>
              </>
          }
        </TouchableOpacity>

        {error && (
          <Text style={styles.errorText}>{error}</Text>
        )}

        <View style={styles.features}>
          {FEATURES.map(f => (
            <View key={f.title} style={styles.feature}>
              <Text style={styles.featureEmoji}>{f.emoji}</Text>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  content: { flexGrow: 1 },
  hero: { height: 360, overflow: 'hidden', justifyContent: 'flex-end' },
  heroEmoji: { position: 'absolute', fontSize: 180, opacity: 0.06, top: 20, alignSelf: 'center' },
  heroFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 180 },
  heroText: { paddingHorizontal: 28, paddingBottom: 24 },
  headline: {
    color: Colors.text,
    fontSize: Typography.hero,
    fontWeight: Typography.black,
    lineHeight: 40,
    marginBottom: 12,
  },
  subline: { color: Colors.sub, fontSize: Typography.body, lineHeight: 22 },
  body: { paddingHorizontal: 24, paddingTop: 8 },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 12,
    gap: 10,
    minHeight: 54,
  },
  btnDisabled: { opacity: 0.6 },
  googleIcon: { fontSize: 18, fontWeight: '900', color: '#4285F4' },
  googleLabel: { fontSize: Typography.body, fontWeight: Typography.semibold, color: '#111' },
  errorText: {
    color: Colors.danger,
    fontSize: Typography.small,
    textAlign: 'center',
    marginBottom: 16,
  },
  features: { gap: 20, marginTop: 8 },
  feature: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  featureEmoji: { fontSize: 24, width: 36, textAlign: 'center', marginTop: 2 },
  featureText: { flex: 1 },
  featureTitle: {
    color: Colors.text,
    fontSize: Typography.body,
    fontWeight: Typography.semibold,
    marginBottom: 2,
  },
  featureDesc: { color: Colors.sub, fontSize: Typography.small },
});
