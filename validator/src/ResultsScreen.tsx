import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { generateRecommendations, type ValidatorRec } from './claude';
import type { AnchorInfo } from './useOnboarding';
import type { NormalizedTitle } from './tmdb';

const C = {
  bg:'#0D0D0F', s1:'#1C1C20', s2:'#252528', border:'#2A2A2E',
  accent:'#C8302A', accentFaint:'rgba(200,48,42,0.15)', accentBorder:'rgba(200,48,42,0.4)',
  text:'#FFFFFF', sub:'#888888', faint:'#555555', success:'#1D9E75',
};

// ── Types ────────────────────────────────────────────────────────────────────

type Step = 'profile' | 'mood' | 'tone' | 'result';

const MOODS = [
  { id:'energized',    emoji:'⚡', label:'Con energía y ganas de algo bueno' },
  { id:'relaxed',      emoji:'😌', label:'Tranquilo, quiero relajarme' },
  { id:'nostalgic',    emoji:'🌅', label:'Melancólico o nostálgico' },
  { id:'stressed',     emoji:'😤', label:'Estresado, necesito escapar' },
  { id:'curious',      emoji:'🤔', label:'Con ganas de algo que me haga pensar' },
  { id:'tired',        emoji:'😴', label:'Cansado, algo fácil' },
];

const TONES = [
  { id:'tension', emoji:'🎯', label:'Enganchar al borde del sillón' },
  { id:'light',   emoji:'😂', label:'Reírme y desenchufar'           },
  { id:'think',   emoji:'💭', label:'Pensar y reflexionar'            },
  { id:'fear',    emoji:'😱', label:'Sustos y adrenalina'             },
];

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  ratings:         Record<number, string>;
  liveProfile:     Record<string, number>;
  titles:          NormalizedTitle[];
  anchorPositions: AnchorInfo[];
  onRepeat:        () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ResultsScreen({ ratings, liveProfile, titles, anchorPositions, onRepeat }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep]       = useState<Step>('profile');
  const [mood, setMood]       = useState('');
  const [tone, setTone]       = useState('');
  const [loading, setLoading] = useState(false);
  const [recs, setRecs]       = useState<ValidatorRec[] | null>(null);
  const [rawJson, setRawJson] = useState('');
  const [ms, setMs]           = useState(0);
  const [err, setErr]         = useState('');
  const [showRaw, setShowRaw] = useState(false);

  const byPrefix = (p: string) => Object.entries(liveProfile)
    .filter(([f]) => f.startsWith(p))
    .map(([f, v]) => [f.slice(p.length), v] as const)
    .sort(([, a], [, b]) => b - a);
  const profGenres = byPrefix('g:');
  const profPairs  = byPrefix('p:').filter(([, v]) => v > 0.1).slice(0, 5);
  const profEras   = byPrefix('e:').filter(([, v]) => v > 0.1).slice(0, 3);
  const profTones  = byPrefix('t:').filter(([, v]) => v > 0.1);
  const ratedCount = Object.keys(ratings).length;

  async function callClaude() {
    setLoading(true);
    setErr('');
    try {
      const moodLabel = MOODS.find(m => m.id === mood)?.label ?? mood;
      const toneLabel = TONES.find(t => t.id === tone)?.label ?? tone;
      const result = await generateRecommendations(liveProfile, `${moodLabel} / ${toneLabel}`);
      setRecs(result.recs);
      setRawJson(result.rawJson);
      setMs(result.ms);
      setStep('result');
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }

  // ── Step: perfil ──────────────────────────────────────────────────────────
  if (step === 'profile') {
    return (
      <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 }]}>
        <Text style={s.tag}>PERFIL CONSTRUIDO</Text>
        <Text style={s.title}>Tu perfil de gustos</Text>
        <Text style={s.sub}>{ratedCount} títulos calificados de {titles.length}</Text>

        <View style={s.box}>
          <Text style={s.boxTitle}>GÉNEROS</Text>
          {profGenres.length === 0
            ? <Text style={s.empty}>Calificá al menos un título.</Text>
            : profGenres.map(([g, v]) => (
              <View key={g} style={s.barRow}>
                <Text style={s.barLabel}>{g}</Text>
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width:`${Math.round(Math.max(0, v) * 100)}%` }]} />
                </View>
                <Text style={s.barVal}>{v.toFixed(2)}</Text>
              </View>
            ))
          }
        </View>

        {profPairs.length > 0 && (
          <View style={s.box}>
            <Text style={s.boxTitle}>SABORES (PARES DE GÉNERO)</Text>
            {profPairs.map(([p, v]) => (
              <View key={p} style={s.barRow}>
                <Text style={s.barLabel} numberOfLines={1}>{p.replace('+', ' + ')}</Text>
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width:`${Math.round(Math.max(0, v) * 100)}%` }]} />
                </View>
                <Text style={s.barVal}>{v.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        )}

        {(profEras.length > 0 || profTones.length > 0) && (
          <View style={s.box}>
            <Text style={s.boxTitle}>ÉPOCA Y TONO</Text>
            {profEras.length > 0 && (
              <Text style={s.anchorRow}>Épocas: {profEras.map(([e, v]) => `${e} (${v.toFixed(2)})`).join('  ·  ')}</Text>
            )}
            {profTones.length > 0 && (
              <Text style={s.anchorRow}>Tono: {profTones.map(([t, v]) => `${t} (${v.toFixed(2)})`).join('  ·  ')}</Text>
            )}
          </View>
        )}

        <View style={s.box}>
          <Text style={s.boxTitle}>⚓ ANCHORS ({anchorPositions.length})</Text>
          {anchorPositions.length === 0
            ? <Text style={s.empty}>Ningún anchor apareció.</Text>
            : anchorPositions.map(a => (
              <Text key={a.idx} style={s.anchorRow}>
                <Text style={{ color:C.accent }}>#{a.idx + 1}</Text>{'  '}{a.title}
              </Text>
            ))
          }
        </View>

        <TouchableOpacity style={s.btn} onPress={() => setStep('mood')} activeOpacity={0.85}>
          <Text style={s.btnText}>Buscar match →</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.repeatBtn} onPress={onRepeat} activeOpacity={0.85}>
          <Text style={s.repeatText}>↩  Repetir con otro perfil</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── Step: mood ────────────────────────────────────────────────────────────
  if (step === 'mood') {
    return (
      <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 }]}>
        <TouchableOpacity onPress={() => setStep('profile')} style={s.back}>
          <Text style={s.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={s.tag}>PASO 1 DE 2</Text>
        <Text style={s.title}>¿Cómo estás hoy?</Text>

        <View style={s.moodGrid}>
          {MOODS.map(m => (
            <TouchableOpacity
              key={m.id}
              style={[s.moodCard, mood === m.id && s.moodCardActive]}
              onPress={() => setMood(m.id)}
              activeOpacity={0.8}
            >
              <Text style={s.moodEmoji}>{m.emoji}</Text>
              <Text style={[s.moodLabel, mood === m.id && s.moodLabelActive]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[s.btn, !mood && s.btnDisabled]}
          onPress={() => setStep('tone')}
          disabled={!mood}
          activeOpacity={0.85}
        >
          <Text style={s.btnText}>Siguiente →</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── Step: tone ────────────────────────────────────────────────────────────
  if (step === 'tone') {
    return (
      <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 }]}>
        <TouchableOpacity onPress={() => setStep('mood')} style={s.back}>
          <Text style={s.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={s.tag}>PASO 2 DE 2</Text>
        <Text style={s.title}>Hoy tengo ganas de…</Text>

        <View style={s.toneGrid}>
          {TONES.map(t => (
            <TouchableOpacity
              key={t.id}
              style={[s.toneCard, tone === t.id && s.toneCardActive]}
              onPress={() => setTone(t.id)}
              activeOpacity={0.8}
            >
              <Text style={s.toneEmoji}>{t.emoji}</Text>
              <Text style={[s.toneLabel, tone === t.id && s.toneLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {err ? <Text style={s.errText}>{err}</Text> : null}

        <TouchableOpacity
          style={[s.btn, (!tone || loading) && s.btnDisabled]}
          onPress={callClaude}
          disabled={!tone || loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.btnText}>Generar recomendación →</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── Step: resultado ───────────────────────────────────────────────────────
  return (
    <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 }]}>
      <Text style={s.tag}>RECOMENDACIONES · {ms}ms</Text>
      <Text style={s.title}>Tu match de hoy</Text>
      <Text style={s.sub}>
        {MOODS.find(m => m.id === mood)?.emoji} {MOODS.find(m => m.id === mood)?.label}{'  ·  '}
        {TONES.find(t => t.id === tone)?.emoji} {TONES.find(t => t.id === tone)?.label}
      </Text>

      {recs?.map((r, i) => (
        <View key={i} style={s.recCard}>
          <Text style={s.recTitle}>{r.title} <Text style={s.recMeta}>({r.year})</Text></Text>
          <Text style={s.recMeta}>{r.type === 'movie' ? '🎬 Película' : '📺 Serie'}  ·  {r.platform}</Text>
          <Text style={s.recReason}>{r.reason}</Text>
        </View>
      ))}

      <TouchableOpacity onPress={() => setShowRaw(v => !v)} style={s.rawToggle}>
        <Text style={s.rawToggleText}>{showRaw ? 'Ocultar JSON' : 'Ver JSON crudo'}</Text>
      </TouchableOpacity>
      {showRaw && <Text style={s.rawJson}>{rawJson}</Text>}

      <TouchableOpacity style={s.btn} onPress={() => { setStep('mood'); setRecs(null); }} activeOpacity={0.85}>
        <Text style={s.btnText}>Cambiar mood →</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.repeatBtn} onPress={onRepeat} activeOpacity={0.85}>
        <Text style={s.repeatText}>↩  Repetir con otro perfil</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:    { flex:1, backgroundColor:C.bg },
  content: { paddingHorizontal:16, gap:16 },
  tag:     { color:C.faint, fontSize:10, fontWeight:'500', letterSpacing:2 },
  title:   { color:C.text, fontSize:24, fontWeight:'600' },
  sub:     { color:C.sub, fontSize:13, lineHeight:20 },
  back:    { paddingVertical:4 },
  backText:{ color:C.faint, fontSize:13 },

  // Profile
  box:      { backgroundColor:C.s1, borderRadius:14, borderWidth:1, borderColor:C.border, padding:14, gap:8 },
  boxTitle: { color:C.faint, fontSize:9, fontWeight:'600', letterSpacing:2, marginBottom:4 },
  empty:    { color:C.faint, fontSize:13 },
  barRow:   { flexDirection:'row', alignItems:'center', gap:8 },
  barLabel: { color:C.sub, fontSize:11, width:100 },
  barTrack: { flex:1, height:5, backgroundColor:C.s2, borderRadius:3 },
  barFill:  { height:5, backgroundColor:C.accent, borderRadius:3 },
  barVal:   { color:C.faint, fontSize:10, width:36, textAlign:'right' },
  anchorRow:{ color:C.sub, fontSize:13, lineHeight:20 },

  // Mood grid
  moodGrid: { gap:10 },
  moodCard: { backgroundColor:C.s1, borderRadius:14, borderWidth:1, borderColor:C.border, padding:16, flexDirection:'row', alignItems:'center', gap:14 },
  moodCardActive: { borderColor:C.accentBorder, backgroundColor:C.accentFaint },
  moodEmoji: { fontSize:24 },
  moodLabel: { color:C.sub, fontSize:14, fontWeight:'500', flex:1 },
  moodLabelActive: { color:C.text },

  // Tone grid
  toneGrid: { gap:10 },
  toneCard: { backgroundColor:C.s1, borderRadius:14, borderWidth:1, borderColor:C.border, padding:20, alignItems:'center', gap:10 },
  toneCardActive: { borderColor:C.accentBorder, backgroundColor:C.accentFaint },
  toneEmoji: { fontSize:32 },
  toneLabel: { color:C.sub, fontSize:15, fontWeight:'500', textAlign:'center' },
  toneLabelActive: { color:C.text },

  // Buttons
  btn:        { backgroundColor:C.accent, borderRadius:12, paddingVertical:16, alignItems:'center' },
  btnDisabled:{ opacity:0.4 },
  btnText:    { color:'#fff', fontSize:14, fontWeight:'600' },
  repeatBtn:  { backgroundColor:C.s1, borderRadius:12, borderWidth:1, borderColor:C.border, paddingVertical:14, alignItems:'center' },
  repeatText: { color:C.sub, fontSize:14 },

  // Results
  recCard:   { backgroundColor:C.s1, borderRadius:14, borderWidth:1, borderColor:C.border, padding:16, gap:6 },
  recTitle:  { color:C.text, fontSize:16, fontWeight:'600' },
  recMeta:   { color:C.sub, fontSize:12 },
  recReason: { color:C.sub, fontSize:13, lineHeight:19 },
  errText:   { color:'#f88', fontSize:12 },
  rawToggle: { alignSelf:'flex-start' },
  rawToggleText: { color:C.faint, fontSize:12, textDecorationLine:'underline' },
  rawJson:   { color:C.faint, fontSize:10, lineHeight:15 },
});
