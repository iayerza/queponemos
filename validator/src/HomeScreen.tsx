import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const C = { bg:'#0D0D0F', s1:'#1C1C20', border:'#2A2A2E', accent:'#C8302A', text:'#FFFFFF', sub:'#888888', faint:'#555555' };

interface Props { onStart: () => void; }

export default function HomeScreen({ onStart }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView style={[s.root, { paddingTop: insets.top + 32 }]} contentContainerStyle={s.content}>
      <Text style={s.tag}>QP VALIDATOR</Text>
      <Text style={s.title}>Validador del{'\n'}algoritmo de onboarding</Text>
      <Text style={s.sub}>
        Corré el flujo completo, observá el perfil de gustos construyéndose en tiempo real
        y generá una recomendación con Claude al final.
      </Text>

      <TouchableOpacity style={s.btn} onPress={onStart} activeOpacity={0.85}>
        <Text style={s.btnText}>Iniciar →</Text>
      </TouchableOpacity>

      <View style={[s.note, { marginBottom: insets.bottom + 24 }]}>
        <Text style={s.noteText}>⚙  Necesitás EXPO_PUBLIC_TMDB_API_KEY y EXPO_PUBLIC_ANTHROPIC_API_KEY en .env</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:    { flex:1, backgroundColor:C.bg },
  content: { paddingHorizontal:24, paddingBottom:40 },
  tag:     { color:C.faint, fontSize:10, fontWeight:'500', letterSpacing:2, marginBottom:12 },
  title:   { color:C.text, fontSize:28, fontWeight:'600', lineHeight:36, marginBottom:12 },
  sub:     { color:C.sub, fontSize:14, lineHeight:22, marginBottom:32 },
  btn:     { backgroundColor:C.accent, borderRadius:12, paddingVertical:16, alignItems:'center' },
  btnText: { color:'#fff', fontSize:14, fontWeight:'600' },
  note:    { marginTop:24, backgroundColor:C.s1, borderRadius:10, padding:14, borderWidth:1, borderColor:C.border },
  noteText:{ color:C.faint, fontSize:12, lineHeight:18 },
});
