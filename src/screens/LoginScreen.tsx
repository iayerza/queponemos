import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography } from '../constants/colors';
import { useAuthStore } from '../store/useAuthStore';
import { MOCK_USER } from '../utils/mock';

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'true';

const FEATURES = [
  { emoji: '🤖', title: 'IA que analiza gustos reales', desc: 'No géneros genéricos, títulos reales' },
  { emoji: '👥', title: 'Grupos de hasta 5 personas',   desc: 'La IA encuentra el terreno común' },
  { emoji: '📺', title: 'Solo lo disponible hoy',       desc: 'Filtra por plataformas y país' },
];

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { setUser } = useAuthStore();
  const [loading] = useState(false);

  function handleGoogleSignIn() {
    if (USE_MOCK) { setUser(MOCK_USER); return; }
    Alert.alert('Firebase requerido', 'Configurá EXPO_PUBLIC_FIREBASE_* en .env para usar Google Sign-In real.');
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
          style={styles.googleBtn}
          onPress={handleGoogleSignIn}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={styles.googleIcon}>G</Text>
          <Text style={styles.googleLabel}>Continuar con Google</Text>
        </TouchableOpacity>

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
    marginBottom: 32,
    gap: 10,
  },
  googleIcon: { fontSize: 18, fontWeight: '900', color: '#4285F4' },
  googleLabel: { fontSize: Typography.body, fontWeight: Typography.semibold, color: '#111' },
  features: { gap: 20 },
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
