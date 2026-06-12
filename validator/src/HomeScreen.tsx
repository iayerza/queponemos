import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AgeRange } from './useOnboarding';

const C = { bg:'#0D0D0F', s1:'#1C1C20', border:'#2A2A2E', accent:'#C8302A', accentFaint:'rgba(200,48,42,0.15)', accentBorder:'rgba(200,48,42,0.4)', text:'#FFFFFF', sub:'#888888', faint:'#555555' };

const AGE_OPTIONS: { range: AgeRange; label: string; hint: string }[] = [
  { range:'young',  label:'Menos de 25', hint:'2000s+' },
  { range:'mid',    label:'25 a 35',     hint:'90s–hoy' },
  { range:'adult',  label:'36 a 50',     hint:'80s–hoy' },
  { range:'senior', label:'Más de 50',   hint:'70s–hoy' },
];

interface Props { onStart: (age: AgeRange) => void; }

export default function HomeScreen({ onStart }: Props) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<AgeRange | null>(null);

  return (
    <ScrollView style={[s.root, { paddingTop: insets.top + 32 }]} contentContainerStyle={s.content}>
      <Text style={s.tag}>QP VALIDATOR</Text>
      <Text style={s.title}>Validador del{'\n'}algoritmo de onboarding</Text>
      <Text style={s.sub}>
        Corré el flujo completo, observá el perfil de gustos construyéndose en tiempo real
        y generá una recomendación con Claude al final.
      </Text>

      <Text style={s.sectionLabel}>RANGO DE EDAD</Text>
      <View style={s.options}>
        {AGE_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.range}
            style={[s.card, selected === opt.range && s.cardActive]}
            onPress={() => setSelected(opt.range)}
            activeOpacity={0.8}
          >
            <Text style={[s.cardLabel, selected === opt.range && s.cardLabelActive]}>{opt.label}</Text>
            <Text style={s.cardHint}>{opt.hint}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[s.btn, !selected && s.btnDisabled]}
        onPress={() => selected && onStart(selected)}
        disabled={!selected}
        activeOpacity={0.85}
      >
        <Text style={s.btnText}>Iniciar →</Text>
      </TouchableOpacity>

      <View style={[s.note, { marginBottom: insets.bottom + 24 }]}>
        <Text style={s.noteText}>⚙  Necesitás EXPO_PUBLIC_TMDB_API_KEY y EXPO_PUBLIC_ANTHROPIC_API_KEY en .env</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:         { flex:1, backgroundColor:C.bg },
  content:      { paddingHorizontal:24, paddingBottom:40 },
  tag:          { color:C.faint, fontSize:10, fontWeight:'500', letterSpacing:2, marginBottom:12 },
  title:        { color:C.text, fontSize:28, fontWeight:'600', lineHeight:36, marginBottom:12 },
  sub:          { color:C.sub, fontSize:14, lineHeight:22, marginBottom:32 },
  sectionLabel: { color:C.faint, fontSize:10, fontWeight:'500', letterSpacing:1.5, marginBottom:10 },
  options:      { gap:10, marginBottom:32 },
  card:         { backgroundColor:C.s1, borderRadius:12, borderWidth:1, borderColor:C.border, padding:16, flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  cardActive:   { borderColor:C.accentBorder, backgroundColor:C.accentFaint },
  cardLabel:    { color:C.text, fontSize:16, fontWeight:'500' },
  cardLabelActive: { color:C.accent },
  cardHint:     { color:C.faint, fontSize:12 },
  btn:          { backgroundColor:C.accent, borderRadius:12, paddingVertical:16, alignItems:'center' },
  btnDisabled:  { opacity:0.4 },
  btnText:      { color:'#fff', fontSize:14, fontWeight:'600' },
  note:         { marginTop:24, backgroundColor:C.s1, borderRadius:10, padding:14, borderWidth:1, borderColor:C.border },
  noteText:     { color:C.faint, fontSize:12, lineHeight:18 },
});
