import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { Colors, Typography } from '../constants/colors';
import { useAuthStore } from '../store/useAuthStore';
import { loginWithEmailUser, getApp } from '../services/firebase';
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

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [name,     setName]     = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function handleAuth() {
    if (USE_MOCK) { setUser(MOCK_USER); return; }
    if (!email.trim() || !password.trim()) { setError('Completá email y contraseña'); return; }
    setLoading(true);
    setError(null);
    try {
      const auth = getAuth(getApp());
      let cred;
      if (isSignUp) {
        cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
      } else {
        cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      const profile = await loginWithEmailUser(cred.user);
      setUser(profile);
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential')
        setError('Email o contraseña incorrectos');
      else if (code === 'auth/email-already-in-use')
        setError('Ese email ya está registrado — iniciá sesión');
      else if (code === 'auth/weak-password')
        setError('La contraseña necesita al menos 6 caracteres');
      else
        setError('Error: ' + String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        bounces={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <LinearGradient colors={[Colors.s3, Colors.s2, Colors.bg]} style={StyleSheet.absoluteFill} />
          <Text style={styles.heroEmoji}>🎬</Text>
          <LinearGradient
            colors={['transparent', Colors.bg]}
            locations={[0.5, 1]}
            style={[StyleSheet.absoluteFill, styles.heroFade]}
          />
          <View style={[styles.heroText, { paddingTop: insets.top + 32 }]}>
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
          <Text style={styles.formTitle}>{isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}</Text>

          {isSignUp && (
            <TextInput
              style={styles.input}
              placeholder="Nombre"
              placeholderTextColor={Colors.faint}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={Colors.faint}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="Contraseña"
            placeholderTextColor={Colors.faint}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={handleAuth}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={Colors.text} />
              : <Text style={styles.primaryBtnText}>{isSignUp ? 'Crear cuenta' : 'Entrar'}</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.toggleBtn} onPress={() => { setIsSignUp(v => !v); setError(null); }}>
            <Text style={styles.toggleText}>
              {isSignUp ? '¿Ya tenés cuenta? Iniciá sesión' : '¿No tenés cuenta? Creá una'}
            </Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>características</Text>
            <View style={styles.dividerLine} />
          </View>

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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  content: { flexGrow: 1 },
  hero: { height: 300, overflow: 'hidden', justifyContent: 'flex-end' },
  heroEmoji: { position: 'absolute', fontSize: 160, opacity: 0.06, top: 10, alignSelf: 'center' },
  heroFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 160 },
  heroText: { paddingHorizontal: 28, paddingBottom: 20 },
  headline: {
    color: Colors.text,
    fontSize: Typography.hero,
    fontWeight: Typography.black,
    lineHeight: 40,
    marginBottom: 8,
  },
  subline: { color: Colors.sub, fontSize: Typography.body, lineHeight: 22 },
  body: { paddingHorizontal: 24, paddingTop: 16 },
  formTitle: { color: Colors.text, fontSize: Typography.h3, fontWeight: Typography.bold, marginBottom: 16 },
  input: {
    backgroundColor: Colors.s1,
    borderRadius: 10,
    padding: 14,
    color: Colors.text,
    fontSize: Typography.body,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  errorText: { color: Colors.danger, fontSize: Typography.small, marginBottom: 10 },
  primaryBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 14,
    minHeight: 54,
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: Colors.text, fontWeight: Typography.bold, fontSize: Typography.body },
  toggleBtn: { alignItems: 'center', paddingVertical: 8, marginBottom: 20 },
  toggleText: { color: Colors.accent, fontSize: Typography.small },
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { color: Colors.faint, fontSize: Typography.tiny, textTransform: 'uppercase', letterSpacing: 1 },
  features: { gap: 18 },
  feature: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  featureEmoji: { fontSize: 22, width: 34, textAlign: 'center', marginTop: 2 },
  featureText: { flex: 1 },
  featureTitle: { color: Colors.text, fontSize: Typography.body, fontWeight: Typography.semibold, marginBottom: 2 },
  featureDesc: { color: Colors.sub, fontSize: Typography.small },
});
