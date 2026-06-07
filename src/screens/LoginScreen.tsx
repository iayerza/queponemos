import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth';
import { Colors, Typography } from '../constants/colors';
import { LogoMark } from '../components/Logo';
import { useAuthStore } from '../store/useAuthStore';
import { loginWithEmailUser, getApp, sendPasswordReset, registerUsername, getEmailByUsername } from '../services/firebase';
import { MOCK_USER } from '../utils/mock';

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'true';

// Rectángulos abstractos que simulan pósters en perspectiva
function PosterBg() {
  const rects = [
    { top: 30,  left: -20, w: 90,  h: 130, rot: '-8deg',  op: 0.6 },
    { top: 60,  left: 50,  w: 100, h: 145, rot: '3deg',   op: 0.5 },
    { top: 10,  left: 130, w: 85,  h: 120, rot: '-5deg',  op: 0.55 },
    { top: 80,  left: 210, w: 95,  h: 135, rot: '6deg',   op: 0.45 },
    { top: 20,  left: 290, w: 80,  h: 115, rot: '-4deg',  op: 0.5 },
    { top: 100, left: 360, w: 90,  h: 130, rot: '7deg',   op: 0.4 },
  ];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {rects.map((r, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: r.top, left: r.left,
            width: r.w, height: r.h,
            backgroundColor: Colors.s1,
            borderRadius: 10,
            opacity: r.op,
            transform: [{ rotate: r.rot }],
            borderWidth: 0.5,
            borderColor: Colors.border,
          }}
        />
      ))}
    </View>
  );
}

export default function LoginScreen() {
  const insets   = useSafeAreaInsets();
  const { setUser } = useAuthStore();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [name,     setName]     = useState('');
  const [isSignUp,      setIsSignUp]      = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [showPassword,  setShowPassword]  = useState(false);

  async function handleAuth() {
    if (USE_MOCK) { setUser(MOCK_USER); return; }
    if (!email.trim() || !password.trim()) { setError('Completá email y contraseña'); return; }
    setLoading(true);
    setError(null);
    try {
      const auth = getAuth(getApp());
      let cred;
      if (isSignUp) {
        if (!name.trim()) { setError('Ingresá un nombre de usuario'); setLoading(false); return; }
        cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(cred.user, { displayName: name.trim() });
        try { await registerUsername(name.trim(), email.trim(), cred.user.uid); } catch { /* non-blocking */ }
        // Send verification email silently
        try { await sendEmailVerification(cred.user); } catch { /* non-blocking */ }
      } else {
        // Aceptar email o nombre de usuario
        let loginEmail = email.trim();
        if (!loginEmail.includes('@')) {
          const found = await getEmailByUsername(loginEmail);
          if (!found) { setError('Usuario no encontrado'); setLoading(false); return; }
          loginEmail = found;
        }
        cred = await signInWithEmailAndPassword(auth, loginEmail, password);
      }
      const profile = await loginWithEmailUser(cred.user);
      setUser(profile);
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      const msg  = (e as { message?: string })?.message ?? '';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential')
        setError('Email o contraseña incorrectos');
      else if (code === 'auth/email-already-in-use')
        setError('Ese email ya está registrado — iniciá sesión');
      else if (code === 'auth/weak-password')
        setError('La contraseña necesita al menos 6 caracteres');
      else if (code === 'auth/invalid-email')
        setError('El formato del email no es válido');
      else if (code === 'auth/network-request-failed')
        setError('Sin conexión — verificá tu internet');
      else if (code === 'auth/too-many-requests')
        setError('Demasiados intentos — esperá unos minutos');
      else if (code === 'auth/operation-not-allowed')
        setError('Login con email no habilitado — configurar en Firebase console');
      else
        setError(`Error: ${code ?? msg}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) { setError('Ingresá tu email o usuario primero'); return; }
    setLoading(true);
    try {
      let resetEmail = email.trim();
      if (!resetEmail.includes('@')) {
        const found = await getEmailByUsername(resetEmail);
        if (!found) { setError('Usuario no encontrado'); setLoading(false); return; }
        resetEmail = found;
      }
      await sendPasswordReset(resetEmail);
      Alert.alert('Email enviado', `Revisá tu casilla para restablecer la contraseña.`);
    } catch {
      setError('No se pudo enviar el email. Verificá la dirección.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Área visual superior — altura fija ── */}
      <View style={[styles.visual, { paddingTop: insets.top + 16 }]}>
        <PosterBg />
        {/* Gradiente simulado con View */}
        <View style={styles.visualFade} />
        <View style={styles.visualContent}>
          <LogoMark size={28} />
          <Text style={styles.headline}>La peli{'\n'}para hoy.</Text>
          <Text style={styles.sub}>
            Encontrá lo que quieren ver juntos{'\n'}en 30 segundos.
          </Text>
        </View>
      </View>

      {/* ── Card inferior (40%) ── */}
      <ScrollView
        style={styles.card}
        contentContainerStyle={[styles.cardContent, { paddingBottom: insets.bottom + 24 }]}
        bounces={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.formTitle}>
          {isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}
        </Text>

        {isSignUp && (
          <TextInput
            style={styles.input}
            placeholder="Usuario (ej: juanperez)"
            placeholderTextColor={Colors.faint}
            value={name}
            onChangeText={t => setName(t.replace(/\s/g, ''))}
            autoCapitalize="none"
            autoCorrect={false}
          />
        )}

        <TextInput
          style={styles.input}
          placeholder={isSignUp ? 'Email' : 'Email o usuario'}
          placeholderTextColor={Colors.faint}
          value={email}
          onChangeText={setEmail}
          keyboardType={isSignUp || email.includes('@') ? 'email-address' : 'default'}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.passwordContainer}>
          <TextInput
            style={[styles.input, { paddingRight: 46, marginBottom: 0 }]}
            placeholder="Contraseña"
            placeholderTextColor={Colors.faint}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setShowPassword(v => !v)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color={Colors.faint} />
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
          onPress={handleAuth}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.primaryBtnText}>
                {isSignUp ? 'Crear cuenta' : 'Entrar'}
              </Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toggleBtn}
          onPress={() => { setIsSignUp(v => !v); setError(null); }}
        >
          <Text style={styles.toggleText}>
            {isSignUp
              ? '¿Ya tenés cuenta? Iniciá sesión'
              : '¿No tenés cuenta? Creá una'}
          </Text>
        </TouchableOpacity>

        {!isSignUp && (
          <TouchableOpacity style={styles.forgotBtn} onPress={handleForgotPassword}>
            <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.legal}>
          Al continuar, aceptás los Términos y la Política de privacidad.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const Radius_md = 12;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  // Visual area — altura fija para que el card no se vaya de pantalla
  visual: {
    height: 260,
    backgroundColor: Colors.bg,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  visualFade: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 160,
    backgroundColor: Colors.bg,
    opacity: 0.85,
  },
  visualContent: {
    padding: 28,
    gap: 12,
    zIndex: 1,
  },
  headline: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.h1,
    fontWeight: Typography.medium,
    color: Colors.text,
    lineHeight: 30,
  },
  sub: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.body,
    color: Colors.sub,
    lineHeight: 20,
  },

  // Card — flex:1 para ocupar todo el espacio restante
  card: {
    flex: 1,
    backgroundColor: Colors.s1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  cardContent: { padding: 28 },
  formTitle: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.h3,
    fontWeight: Typography.medium,
    color: Colors.text,
    marginBottom: 16,
  },
  input: {
    backgroundColor: Colors.s2,
    borderRadius: Radius_md,
    padding: 14,
    color: Colors.text,
    fontFamily: Typography.fontRegular,
    fontSize: Typography.body,
    borderWidth: 0.5,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  errorText: {
    color: Colors.danger,
    fontFamily: Typography.fontRegular,
    fontSize: Typography.small,
    marginBottom: 10,
  },
  primaryBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius_md,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  primaryBtnText: {
    fontFamily: Typography.fontMedium,
    color: Colors.text,
    fontWeight: Typography.medium,
    fontSize: Typography.body,
  },
  toggleBtn: { alignItems: 'center', paddingVertical: 8, marginBottom: 8 },
  toggleText: {
    fontFamily: Typography.fontRegular,
    color: Colors.accent,
    fontSize: Typography.small,
  },
  passwordContainer: { position: 'relative', marginBottom: 10 },
  eyeBtn: { position: 'absolute', right: 14, top: 14 },
  forgotBtn: { alignItems: 'center', paddingVertical: 6, marginBottom: 16 },
  forgotText: { fontFamily: Typography.fontRegular, color: Colors.faint, fontSize: Typography.small, textDecorationLine: 'underline' },
  legal: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.tiny,
    color: Colors.faint,
    textAlign: 'center',
    lineHeight: 16,
  },
});
