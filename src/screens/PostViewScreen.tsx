import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image, TextInput,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Colors, Typography } from '../constants/colors';
import { getPosterUrl } from '../services/tmdb';
import { useMatchStore } from '../store/useMatchStore';
import type { RootStackParamList } from '../navigation/types';

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'PostView'>;

const STARS = [1, 2, 3, 4, 5];

export default function PostViewScreen() {
  const insets = useSafeAreaInsets();
  const nav    = useNavigation<Nav>();
  const route  = useRoute<Route>();
  const { title, year, posterPath, matchId, titleIdx } = route.params;

  const { updateTitleAction } = useMatchStore();

  const [rating, setRating]   = useState(0);
  const [comment, setComment] = useState('');
  const [saved, setSaved]     = useState(false);

  const posterUrl = getPosterUrl(posterPath);

  function handleSend() {
    // Guardar el estado watched (ya fue marcado antes, pero reforzamos)
    updateTitleAction(0, titleIdx, 'watched');
    setSaved(true);
    setTimeout(() => nav.navigate('App'), 800);
  }

  function handleSkip() {
    nav.navigate('App');
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>¿QUÉ TAL ESTUVO?</Text>
        <Text style={styles.heading}>Reacción post-visionado</Text>

        {/* Card del título */}
        <View style={styles.titleCard}>
          {posterUrl ? (
            <Image source={{ uri: posterUrl }} style={styles.poster} resizeMode="cover" />
          ) : (
            <View style={styles.posterPlaceholder}>
              <Feather name="film" size={22} color={Colors.faint} />
            </View>
          )}
          <View style={styles.titleInfo}>
            <Text style={styles.titleText} numberOfLines={2}>{title}</Text>
            <Text style={styles.yearText}>{year}</Text>
          </View>
        </View>

        {/* Estrellas */}
        <Text style={styles.label}>Tu puntuación</Text>
        <View style={styles.starsRow}>
          {STARS.map(s => (
            <TouchableOpacity key={s} onPress={() => setRating(s)} activeOpacity={0.7}>
              <FontAwesome
                name={s <= rating ? 'star' : 'star-o'}
                size={38}
                color={s <= rating ? Colors.accent : Colors.border}
              />
            </TouchableOpacity>
          ))}
        </View>
        {rating > 0 && (
          <Text style={styles.ratingLabel}>{RATING_LABELS[rating]}</Text>
        )}

        {/* Comentario */}
        <Text style={[styles.label, { marginTop: 24 }]}>Comentario (opcional)</Text>
        <TextInput
          style={styles.input}
          value={comment}
          onChangeText={t => setComment(t.slice(0, 280))}
          placeholder="¿Qué les pareció?"
          placeholderTextColor={Colors.faint}
          multiline
          numberOfLines={3}
          maxLength={280}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>{comment.length}/280</Text>

        {/* Acciones */}
        {saved ? (
          <View style={styles.savedBox}>
            <Feather name="check-circle" size={32} color={Colors.accent} />
          <Text style={styles.savedText}>Guardado</Text>
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.sendBtn, rating === 0 && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={rating === 0}
              activeOpacity={0.85}
            >
              <Text style={styles.sendBtnText}>Enviar reacción</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
              <Text style={styles.skipBtnText}>Saltear</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const RATING_LABELS: Record<number, string> = {
  1: 'No nos convenció',
  2: 'Regular',
  3: 'Estuvo bien',
  4: 'Muy buena',
  5: '¡Excelente!',
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24 },
  eyebrow: {
    color: Colors.sub,
    fontSize: Typography.tiny,
    fontWeight: Typography.semibold,
    letterSpacing: 2,
    marginBottom: 6,
  },
  heading: {
    color: Colors.text,
    fontSize: Typography.h2,
    fontWeight: Typography.bold,
    marginBottom: 24,
  },
  titleCard: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: Colors.s1,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 28,
    alignItems: 'center',
  },
  poster: { width: 60, height: 90, borderRadius: 6 },
  posterPlaceholder: {
    width: 60, height: 90, borderRadius: 6,
    backgroundColor: Colors.s2,
    alignItems: 'center', justifyContent: 'center',
  },
  titleInfo: { flex: 1 },
  titleText: { color: Colors.text, fontSize: Typography.h3, fontWeight: Typography.bold, marginBottom: 4 },
  yearText: { color: Colors.sub, fontSize: Typography.small },
  label: {
    color: Colors.sub,
    fontSize: Typography.tiny,
    fontWeight: Typography.semibold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  starsRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  ratingLabel: { color: Colors.accent, fontSize: Typography.small, fontWeight: Typography.medium, marginBottom: 4 },
  input: {
    backgroundColor: Colors.s1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 14,
    color: Colors.text,
    fontSize: Typography.body,
    minHeight: 80,
    lineHeight: 22,
  },
  charCount: { color: Colors.faint, fontSize: Typography.tiny, textAlign: 'right', marginTop: 4 },
  sendBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 10,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: Colors.bg, fontWeight: Typography.bold, fontSize: Typography.body },
  skipBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  skipBtnText: { color: Colors.sub, fontSize: Typography.body },
  savedBox: {
    marginTop: 24,
    alignItems: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  savedText: { color: Colors.accent, fontSize: Typography.body, fontWeight: Typography.medium },
});
