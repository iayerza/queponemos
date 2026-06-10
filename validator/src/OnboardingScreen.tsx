import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnboarding, computeLocalProfile, type Rating, type AgeRange, type OnboardingState } from './useOnboarding';
import { getPosterUrl } from './tmdb';

const C = { bg:'#0D0D0F', s1:'#1C1C20', s2:'#252528', border:'#2A2A2E', accent:'#C8302A', accentFaint:'rgba(200,48,42,0.15)', accentBorder:'rgba(200,48,42,0.4)', text:'#FFFFFF', sub:'#888888', faint:'#555555', success:'#1D9E75' };

const GENRE_OPTIONS = [
  'Acción','Aventura','Animación','Comedia','Crimen','Drama',
  'Terror','Misterio','Romance','Ciencia Ficción','Thriller','Bélica',
];

interface Props {
  ageRange: AgeRange;
  onFinish: (state: Pick<OnboardingState, 'ratings' | 'liveProfile' | 'titles' | 'anchorPositions'>) => void;
}

export default function OnboardingScreen({ ageRange, onFinish }: Props) {
  const insets = useSafeAreaInsets();
  const ob     = useOnboarding(ageRange);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

  useEffect(() => {
    if (ob.isFinished) {
      onFinish({ ratings: ob.ratings, liveProfile: ob.liveProfile, titles: ob.titles, anchorPositions: ob.anchorPositions });
    }
  }, [ob.isFinished]);

  function toggleGenre(g: string) {
    setSelectedGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  }

  // ── Genre step ──────────────────────────────────────────────────────────────
  if (!ob.genreStepDone) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <View style={s.topBar}>
          <Text style={s.tag}>PASO 1 DE 2 · {ageRange.toUpperCase()}</Text>
        </View>
        <ScrollView contentContainerStyle={[s.genreScroll, { paddingBottom: insets.bottom + 88 }]}>
          <Text style={s.bigTitle}>¿Qué géneros{'\n'}<Text style={{ color:C.accent }}>te gustan?</Text></Text>
          <View style={s.genreGrid}>
            {GENRE_OPTIONS.map(g => {
              const sel = selectedGenres.includes(g);
              return (
                <TouchableOpacity
                  key={g}
                  style={[s.genreChip, sel && s.genreChipSel]}
                  onPress={() => toggleGenre(g)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.genreChipText, sel && s.genreChipTextSel]}>{g}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
        <View style={[s.genreFooter, { paddingBottom: insets.bottom + 8 }]}>
          {selectedGenres.length === 0 ? (
            <TouchableOpacity onPress={() => ob.confirmGenres([])} style={s.skipBtn}>
              <Text style={s.skipText}>Saltar este paso</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.ctaBtn} onPress={() => ob.confirmGenres(selectedGenres)} activeOpacity={0.85}>
              <Text style={s.ctaBtnText}>Continuar con {selectedGenres.length} géneros →</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (ob.isLoading) {
    const key = process.env.EXPO_PUBLIC_TMDB_API_KEY ?? '';
    const keyStatus = key.length === 0
      ? '❌ EXPO_PUBLIC_TMDB_API_KEY no encontrada'
      : key === 'tu_api_key_de_tmdb'
        ? '❌ API key sin reemplazar en .env'
        : `✅ Key presente (${key.slice(0, 6)}…)`;
    return (
      <View style={s.center}>
        <ActivityIndicator color={C.accent} size="large" />
        <Text style={s.loadText}>Cargando pool de TMDB…</Text>
        <Text style={{ color: C.faint, fontSize: 11, marginTop: 8 }}>{keyStatus}</Text>
      </View>
    );
  }

  if (ob.error) {
    return (
      <View style={s.center}>
        <Text style={{ color:'#f55', fontSize:14, textAlign:'center' }}>{ob.error}</Text>
      </View>
    );
  }

  // ── Oferta de expansión: llegó al target pero quedan dudas ──────────────────
  if (ob.canExtend) {
    return (
      <View style={[s.center, { gap: 20 }]}>
        <Text style={{ color: C.text, fontSize: 22, fontWeight: '600', textAlign: 'center' }}>
          ¿Afinamos más{'\n'}tu perfil?
        </Text>
        <Text style={{ color: C.sub, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
          Calificaste {Object.keys(ob.ratings).length} títulos, pero todavía hay géneros con pocas respuestas:
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {ob.pendingDoubts.map(g => (
            <View key={g} style={s.genreChip}><Text style={s.genreChipText}>{g}</Text></View>
          ))}
        </View>
        <TouchableOpacity style={[s.ctaBtn, { alignSelf: 'stretch' }]} onPress={ob.extend} activeOpacity={0.85}>
          <Text style={s.ctaBtnText}>Calificar 10 más →</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={ob.declineExtend}>
          <Text style={s.skipText}>No, ver resultados</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Rating step ─────────────────────────────────────────────────────────────
  const title = ob.titles[ob.currentIndex];
  if (!title) {
    return (
      <View style={s.center}>
        <Text style={{ color:'#f88', fontSize:13, textAlign:'center', paddingHorizontal:24 }}>
          No hay títulos para mostrar.{'\n'}Revisá que EXPO_PUBLIC_TMDB_API_KEY esté correcta en .env y reiniciá Expo.
        </Text>
      </View>
    );
  }

  const poster    = getPosterUrl(title.posterPath);
  const topGenres = Object.entries(ob.liveProfile).sort(([,a],[,b]) => b-a).slice(0, 6);
  const anchorsSoFar = ob.anchorPositions.filter(a => a.idx < ob.currentIndex);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.topBar}>
        <Text style={s.tag}>
          {ob.currentIndex + 1}/{ob.titles.length}
          {title.isAnchor ? '  ·  ⚓ ANCHOR' : ''}
        </Text>
        {ob.canSkip && (
          <TouchableOpacity onPress={() => onFinish({ ratings:ob.ratings, liveProfile:ob.liveProfile, titles:ob.titles, anchorPositions:ob.anchorPositions })}>
            <Text style={s.skipText}>Ver resultados →</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 24 }]}>

        {/* Title card */}
        <View style={s.card}>
          {title.isAnchor && (
            <View style={s.anchorBadge}><Text style={s.anchorBadgeText}>⚓ ANCHOR</Text></View>
          )}
          {poster ? (
            <Image source={{ uri: poster }} style={s.poster} resizeMode="cover" />
          ) : (
            <View style={[s.poster, s.posterFallback]}>
              <Text style={{ color:C.faint, fontSize:12 }}>Sin póster</Text>
            </View>
          )}
          <View style={s.cardInfo}>
            <Text style={s.titleText} numberOfLines={2}>{title.title}</Text>
            <Text style={s.metaText}>
              {title.year}  ·  {title.type === 'movie' ? '🎬' : '📺'}  ·  ★ {title.rating}
            </Text>
            <View style={s.genreRow}>
              {title.genres.slice(0, 3).map(g => (
                <View key={g} style={s.genrePill}><Text style={s.genrePillText}>{g}</Text></View>
              ))}
            </View>
            {title.synopsis ? (
              <Text style={s.synopsis} numberOfLines={3}>{title.synopsis}</Text>
            ) : null}
          </View>
        </View>

        {/* Rating buttons */}
        <View style={s.ratingRow}>
          {(['loved','liked','seen_disliked','not_seen'] as Rating[]).map(r => {
            const labels: Record<Rating,string> = { loved:'❤️ Amada', liked:'👍 Vista', seen_disliked:'👎 No gustó', not_seen:'❓ No la vi' };
            const sel = ob.ratings[title.tmdbId] === r;
            return (
              <TouchableOpacity key={r} style={[s.rBtn, sel && s.rBtnSel]} onPress={() => ob.rate(r)} activeOpacity={0.8}>
                <Text style={[s.rBtnText, sel && s.rBtnTextSel]}>{labels[r]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Live profile */}
        {topGenres.length > 0 && (
          <View style={s.profileBox}>
            <Text style={s.profileTitle}>Perfil en tiempo real</Text>
            {topGenres.map(([g, v]) => (
              <View key={g} style={s.barRow}>
                <Text style={s.barLabel}>{g}</Text>
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width:`${Math.round(v * 100)}%` }]} />
                </View>
                <Text style={s.barVal}>{v.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Anchors so far */}
        {anchorsSoFar.length > 0 && (
          <View style={s.anchorBox}>
            <Text style={s.profileTitle}>⚓ Anchors aparecidos ({anchorsSoFar.length}/{ob.anchorPositions.length})</Text>
            {anchorsSoFar.map(a => (
              <Text key={a.idx} style={s.anchorItem}>#{a.idx + 1}  {a.title}</Text>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex:1, backgroundColor:C.bg },
  center:  { flex:1, backgroundColor:C.bg, justifyContent:'center', alignItems:'center', gap:12, padding:24 },
  loadText:{ color:C.sub, fontSize:14 },
  topBar:  { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:24, paddingVertical:10, borderBottomWidth:1, borderColor:C.border },
  tag:     { color:C.faint, fontSize:10, fontWeight:'500', letterSpacing:1.5 },
  skipText:{ color:C.faint, fontSize:13, textDecorationLine:'underline' },
  scroll:  { paddingHorizontal:16, paddingTop:16, gap:16 },

  // Genre step
  genreScroll:  { paddingHorizontal:24, paddingTop:24, gap:16 },
  bigTitle:     { color:C.text, fontSize:26, fontWeight:'600', lineHeight:34, marginBottom:8 },
  genreGrid:    { flexDirection:'row', flexWrap:'wrap', gap:8 },
  genreChip:    { paddingHorizontal:14, paddingVertical:10, borderRadius:20, backgroundColor:C.s1, borderWidth:1, borderColor:C.border },
  genreChipSel: { borderColor:C.accentBorder, backgroundColor:C.accentFaint },
  genreChipText:    { color:C.sub, fontSize:13, fontWeight:'500' },
  genreChipTextSel: { color:C.accent },
  genreFooter:  { position:'absolute', bottom:0, left:0, right:0, paddingHorizontal:24, paddingTop:12, backgroundColor:C.bg },
  skipBtn:      { alignSelf:'center', paddingVertical:8 },
  ctaBtn:       { backgroundColor:C.accent, borderRadius:12, paddingVertical:16, alignItems:'center' },
  ctaBtnText:   { color:'#fff', fontSize:14, fontWeight:'600' },

  // Card
  card:        { backgroundColor:C.s1, borderRadius:16, borderWidth:1, borderColor:C.border, overflow:'hidden' },
  anchorBadge: { position:'absolute', top:10, right:10, zIndex:10, backgroundColor:'rgba(0,0,0,0.7)', borderRadius:6, paddingHorizontal:8, paddingVertical:4, borderWidth:1, borderColor:C.accentBorder },
  anchorBadgeText: { color:C.accent, fontSize:10, fontWeight:'700' },
  poster:      { width:'100%', aspectRatio:2/3 },
  posterFallback: { backgroundColor:C.s2, justifyContent:'center', alignItems:'center' },
  cardInfo:    { padding:14, gap:6 },
  titleText:   { color:C.text, fontSize:17, fontWeight:'600', lineHeight:22 },
  metaText:    { color:C.sub, fontSize:12 },
  genreRow:    { flexDirection:'row', gap:6, flexWrap:'wrap' },
  genrePill:   { backgroundColor:C.s2, borderRadius:6, paddingHorizontal:8, paddingVertical:3 },
  genrePillText:{ color:C.faint, fontSize:11 },
  synopsis:    { color:C.sub, fontSize:13, lineHeight:18 },

  // Rating
  ratingRow: { flexDirection:'row', flexWrap:'wrap', gap:8 },
  rBtn:      { flex:1, minWidth:'40%', backgroundColor:C.s1, borderRadius:10, borderWidth:1, borderColor:C.border, paddingVertical:12, alignItems:'center' },
  rBtnSel:   { borderColor:C.accentBorder, backgroundColor:C.accentFaint },
  rBtnText:  { color:C.sub, fontSize:12, fontWeight:'500' },
  rBtnTextSel:{ color:C.accent },

  // Profile bars
  profileBox:   { backgroundColor:C.s1, borderRadius:12, borderWidth:1, borderColor:C.border, padding:14, gap:8 },
  profileTitle: { color:C.faint, fontSize:10, fontWeight:'600', letterSpacing:1.5, marginBottom:4 },
  barRow:       { flexDirection:'row', alignItems:'center', gap:8 },
  barLabel:     { color:C.sub, fontSize:11, width:90 },
  barTrack:     { flex:1, height:6, backgroundColor:C.s2, borderRadius:3 },
  barFill:      { height:6, backgroundColor:C.accent, borderRadius:3 },
  barVal:       { color:C.faint, fontSize:10, width:30, textAlign:'right' },

  // Anchors
  anchorBox:  { backgroundColor:C.s1, borderRadius:12, borderWidth:1, borderColor:C.border, padding:14, gap:6 },
  anchorItem: { color:C.sub, fontSize:12 },
});
