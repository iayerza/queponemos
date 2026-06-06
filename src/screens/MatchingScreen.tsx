import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Colors, Typography } from '../constants/colors';
import AnimatedLogoMark from '../components/AnimatedLogoMark';
import { useMatching } from '../hooks/useMatching';
import { useMatchStore } from '../store/useMatchStore';
import { useGroupStore } from '../store/useGroupStore';
import type { RootStackParamList } from '../navigation/types';

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Matching'>;

function friendlyError(raw: string): string {
  if (raw.includes('401') || raw.includes('authentication') || raw.includes('x-api-key'))
    return 'Error de autenticación. Verificá tu EXPO_PUBLIC_ANTHROPIC_API_KEY e intentá de nuevo.';
  if (raw.includes('429') || raw.includes('rate'))
    return 'Demasiadas solicitudes. Esperá un momento y volvé a intentar.';
  if (raw.includes('timeout') || raw.includes('tardó'))
    return 'Claude tardó demasiado en responder. Volvé a intentar.';
  if (raw.includes('Sin conexión') || raw.includes('network') || raw.includes('fetch') || raw.includes('Network'))
    return 'Sin conexión. Verificá tu internet y volvé a intentar.';
  if (raw.includes('se cortó') || raw.includes('max_tokens'))
    return 'La respuesta se cortó. Volvé a intentar.';
  if (raw.includes('no devolvió') || raw.includes('JSON'))
    return 'Hubo un problema generando las recomendaciones. Volvé a intentar.';
  if (raw.includes('500') || raw.includes('529') || raw.includes('overloaded'))
    return 'El servicio está ocupado. Volvé a intentar en un momento.';
  return 'Algo salió mal. Volvé a intentar.';
}

export default function MatchingScreen() {
  const nav   = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { runMatch, error, isLeader } = useMatching();
  const { isSolo } = useMatchStore();
  const { currentGroup } = useGroupStore();
  const ranRef = useRef(false);

  useEffect(() => {
    // Guard: correr el matching una sola vez (evita doble match/historial/turno
    // por remontaje o StrictMode).
    if (ranRef.current) return;
    ranRef.current = true;
    runMatch().then(matchId => {
      if (matchId) nav.replace('Results', { matchId });
    });
  }, []);

  function exitToSafety() {
    if (!isSolo && currentGroup) nav.navigate('Group', { groupId: currentGroup.id });
    else nav.navigate('App');
  }

  return (
    <View style={styles.root}>
      <AnimatedLogoMark size={80} />

      <Text style={styles.brand}>queponemos</Text>

      <Text style={styles.title}>
        {isSolo
          ? 'Buscando\nalgo para vos…'
          : isLeader
            ? 'Analizando\nlos moods…'
            : 'Esperando\nel resultado…'}
      </Text>
      <Text style={styles.sub}>
        {isSolo
          ? 'Queponemos está eligiendo según tu perfil'
          : isLeader
            ? 'Queponemos está reconciliando sus gustos'
            : 'Tu compañero está buscando el match'}
      </Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {!isSolo && !isLeader
              ? 'Esperá a que quien inició la búsqueda reintente.'
              : friendlyError(error)}
          </Text>
          <View style={styles.errorActions}>
            {(isSolo || isLeader) && (
              <TouchableOpacity
                onPress={() => nav.replace('Mood', route.params)}
                style={styles.retryBtn}
              >
                <Text style={styles.retryText}>Volver a intentar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={exitToSafety} style={styles.exitBtn}>
              <Text style={styles.retryText}>{isSolo ? 'Volver al inicio' : 'Volver al grupo'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  brand: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.h3,
    fontWeight: Typography.medium,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: -0.2,
    marginTop: 8,
  },
  title: {
    color: '#ffffff',
    fontSize: Typography.h1,
    fontWeight: Typography.medium,
    textAlign: 'center',
    lineHeight: 32,
  },
  sub: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: Typography.small,
    textAlign: 'center',
  },
  errorBox: {
    marginTop: 8,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 12,
    padding: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: Typography.small,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: Typography.tiny,
    textAlign: 'center',
    lineHeight: 16,
  },
  errorActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' },
  retryBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  exitBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  retryText: {
    color: '#fff',
    fontSize: Typography.small,
    fontWeight: Typography.medium,
  },
});
