import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { generateRecommendations, type ValidatorRec } from './claude';
import type { OnboardingState, AnchorInfo } from './useOnboarding';
import type { NormalizedTitle } from './tmdb';

const C = { bg:'#0D0D0F', s1:'#1C1C20', s2:'#252528', border:'#2A2A2E', accent:'#C8302A', accentFaint:'rgba(200,48,42,0.15)', accentBorder:'rgba(200,48,42,0.4)', text:'#FFFFFF', sub:'#888888', faint:'#555555', success:'#1D9E75' };

interface Props {
  ratings:         Record<number, string>;
  liveProfile:     Record<string, number>;
  titles:          NormalizedTitle[];
  anchorPositions: AnchorInfo[];
  onRepeat:        () => void;
}

export default function ResultsScreen({ ratings, liveProfile, titles, anchorPositions, onRepeat }: Props) {
  const insets = useSafeAreaInsets();
  const [mood, setMood]       = useState('');
  const [loading, setLoading] = useState(false);
  const [recs, setRecs]       = useState<ValidatorRec[] | null>(null);
  const [rawJson, setRawJson] = useState('');
  const [ms, setMs]           = useState(0);
  const [err, setErr]         = useState('');
  const [showRaw, setShowRaw] = useState(false);

  const sortedProfile = Object.entries(liveProfile).sort(([,a],[,b]) => b-a);
  const ratedCount    = Object.keys(ratings).length;

  async function callClaude() {
    if (!mood.trim()) return;
    setLoading(true);
    setErr('');
    setRecs(null);
    try {
      const result = await generateRecommendations(liveProfile, mood);
      setRecs(result.recs);
      setRawJson(result.rawJson);
      setMs(result.ms);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      style={{ flex:1, backgroundColor:C.bg }}
      contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 }]}
    >
      <Text style={s.tag}>RESULTADOS</Text>
      <Text style={s.title}>Perfil construido</Text>
      <Text style={s.sub}>{ratedCount} títulos calificados de {titles.length}</Text>

      {/* Full profile */}
      <View style={s.box}>
        <Text style={s.boxTitle}>GÉNEROS (ordenados por preferencia)</Text>
        {sortedProfile.length === 0 ? (
          <Text style={s.empty}>No hay datos — calificá al menos un título.</Text>
        ) : sortedProfile.map(([g, v]) => (
          <View key={g} style={s.barRow}>
            <Text style={s.barLabel}>{g}</Text>
            <View style={s.barTrack}>
              <View style={[s.barFill, { width:`${Math.round(v * 100)}%` }]} />
            </View>
            <Text style={s.barVal}>{v.toFixed(3)}</Text>
          </View>
        ))}
      </View>

      {/* Anchors */}
      <View style={s.box}>
        <Text style={s.boxTitle}>ANCHORS ({anchorPositions.length}/5)</Text>
        {anchorPositions.length === 0 ? (
          <Text style={s.empty}>Ningún anchor apareció aún.</Text>
        ) : anchorPositions.map(a => (
          <Text key={a.idx} style={s.anchorRow}>
            <Text style={{ color:C.accent }}>#{a.idx + 1}</Text>  {a.title}
          </Text>
        ))}
      </View>

      {/* Claude call */}
      <View style={s.box}>
        <Text style={s.boxTitle}>GENERAR RECOMENDACIÓN CON CLAUDE</Text>
        <TextInput
          style={s.input}
          placeholder="¿Cómo te sentís hoy? (ej: cansado, necesito reír)"
          placeholderTextColor={C.faint}
          value={mood}
          onChangeText={setMood}
          multiline
        />
        <TouchableOpacity
          style={[s.btn, (!mood.trim() || loading) && s.btnDisabled]}
          onPress={callClaude}
          disabled={!mood.trim() || loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.btnText}>Generar →</Text>
          }
        </TouchableOpacity>
        {err ? <Text style={s.errText}>{err}</Text> : null}
      </View>

      {/* Recommendations */}
      {recs && (
        <View style={s.box}>
          <Text style={s.boxTitle}>RECOMENDACIONES  ·  {ms}ms</Text>
          {recs.map((r, i) => (
            <View key={i} style={s.recCard}>
              <View style={s.recHeader}>
                <Text style={s.recTitle}>{r.title}</Text>
                <Text style={s.recMeta}>{r.year}  ·  {r.type === 'movie' ? '🎬' : '📺'}  ·  {r.platform}</Text>
              </View>
              <Text style={s.recReason}>{r.reason}</Text>
            </View>
          ))}
          <TouchableOpacity onPress={() => setShowRaw(v => !v)} style={s.rawToggle}>
            <Text style={s.rawToggleText}>{showRaw ? 'Ocultar JSON' : 'Ver JSON crudo'}</Text>
          </TouchableOpacity>
          {showRaw && <Text style={s.rawJson}>{rawJson}</Text>}
        </View>
      )}

      {/* Repeat */}
      <TouchableOpacity style={s.repeatBtn} onPress={onRepeat} activeOpacity={0.85}>
        <Text style={s.repeatText}>↩  Repetir con otro perfil</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content:    { paddingHorizontal:16, gap:16 },
  tag:        { color:C.faint, fontSize:10, fontWeight:'500', letterSpacing:2 },
  title:      { color:C.text, fontSize:24, fontWeight:'600' },
  sub:        { color:C.sub, fontSize:13 },
  box:        { backgroundColor:C.s1, borderRadius:14, borderWidth:1, borderColor:C.border, padding:14, gap:8 },
  boxTitle:   { color:C.faint, fontSize:9, fontWeight:'600', letterSpacing:2, marginBottom:4 },
  empty:      { color:C.faint, fontSize:13 },
  barRow:     { flexDirection:'row', alignItems:'center', gap:8 },
  barLabel:   { color:C.sub, fontSize:11, width:100 },
  barTrack:   { flex:1, height:5, backgroundColor:C.s2, borderRadius:3 },
  barFill:    { height:5, backgroundColor:C.accent, borderRadius:3 },
  barVal:     { color:C.faint, fontSize:10, width:36, textAlign:'right' },
  anchorRow:  { color:C.sub, fontSize:13, lineHeight:20 },
  input:      { backgroundColor:C.s2, borderRadius:10, padding:12, borderWidth:1, borderColor:C.border, color:C.text, fontSize:14, minHeight:52 },
  btn:        { backgroundColor:C.accent, borderRadius:10, paddingVertical:14, alignItems:'center' },
  btnDisabled:{ opacity:0.4 },
  btnText:    { color:'#fff', fontSize:14, fontWeight:'600' },
  errText:    { color:'#f55', fontSize:12 },
  recCard:    { backgroundColor:C.s2, borderRadius:10, padding:12, gap:6, borderWidth:1, borderColor:C.border },
  recHeader:  { gap:2 },
  recTitle:   { color:C.text, fontSize:15, fontWeight:'600' },
  recMeta:    { color:C.sub, fontSize:12 },
  recReason:  { color:C.sub, fontSize:13, lineHeight:18 },
  rawToggle:  { alignSelf:'flex-start', paddingVertical:4 },
  rawToggleText:{ color:C.faint, fontSize:12, textDecorationLine:'underline' },
  rawJson:    { color:C.faint, fontSize:10, lineHeight:16, fontFamily:'monospace' },
  repeatBtn:  { backgroundColor:C.s1, borderRadius:12, borderWidth:1, borderColor:C.border, paddingVertical:14, alignItems:'center' },
  repeatText: { color:C.sub, fontSize:14 },
});
