import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  fetchOnboardingPool, fetchDeepeningBatch, franchiseKey,
  GENRE_NAME_TO_ID, STRONG_GENRES, type NormalizedTitle,
} from './tmdb';

export type Rating   = 'loved' | 'liked' | 'seen_disliked' | 'not_seen';
export type AgeRange = 'young' | 'mid' | 'adult' | 'senior';

export interface AnchorInfo { idx: number; title: string; }

export interface OnboardingState {
  titles:          NormalizedTitle[];
  currentIndex:    number;
  ratings:         Record<number, Rating>;
  isLoading:       boolean;
  error:           string | null;
  rate:            (r: Rating) => void;
  canSkip:         boolean;
  isFinished:      boolean;
  genreStepDone:   boolean;
  confirmGenres:   (genres: string[]) => void;
  liveProfile:     Record<string, number>;
  anchorPositions: AnchorInfo[];
  // Expansión opcional 30 → 40 → 50 cuando quedan géneros con dudas
  target:          number;
  canExtend:       boolean;
  pendingDoubts:   string[];
  extend:          () => void;
  declineExtend:   () => void;
  // Fase 2: tanda de profundización cargada
  deepened:        boolean;
}

const BASE_TARGET = 30;
const EXTEND_STEP = 10;
const MAX_TARGET  = 50;
// Candidatos a traer de TMDB: el máximo mostrable + reserva para reemplazos
const POOL_SIZE   = MAX_TARGET + 10;
// Gatillo de profundización: carta fija, o antes si los top 2 ya están claros
const DEEPEN_AT_CARD     = 12;
const DEEPEN_EARLY_SEEN  = 4;

// Géneros a vigilar para dudas cuando el usuario salteó la selección
const DEFAULT_WATCH = ['Acción', 'Comedia', 'Drama', 'Thriller', 'Romance', 'Ciencia Ficción'];

const RATING_WEIGHTS: Record<Rating, number> = {
  loved: 2.0, liked: 1.0, seen_disliked: -0.8, not_seen: 0,
};

// ─── Features ─────────────────────────────────────────────────────────────────
// Cada título enseña más que su género: par de sabor, época y tono.
//   g:Thriller        género            (peso 1.0)
//   p:Crimen+Thriller par de sabor      (peso 0.6)
//   e:90s             época             (peso 0.3)
//   t:prestigio       tono por rating   (peso 0.3)

const FEATURE_WEIGHTS: Record<string, number> = { g: 1.0, p: 0.6, e: 0.3, t: 0.3 };
function featWeight(f: string): number { return FEATURE_WEIGHTS[f[0]] ?? 0; }

function eraBucket(year: number): string {
  if (year < 1980) return '70s-';
  if (year < 1990) return '80s';
  if (year < 2000) return '90s';
  if (year < 2010) return '00s';
  if (year < 2020) return '10s';
  return '20s';
}

export function featuresOf(t: NormalizedTitle): string[] {
  const fs: string[] = t.genres.map(g => `g:${g}`);
  const gs = [...t.genres].sort();
  for (let i = 0; i < gs.length; i++) {
    for (let j = i + 1; j < gs.length; j++) fs.push(`p:${gs[i]}+${gs[j]}`);
  }
  fs.push(`e:${eraBucket(t.year)}`);
  if (t.rating >= 7.8) fs.push('t:prestigio');
  else if (t.rating <= 7.0) fs.push('t:palomitera');
  return fs;
}

export function computeLocalProfile(
  ratings: Record<number, Rating>,
  pool: NormalizedTitle[],
  seeds: string[] = [],
): Record<string, number> {
  const weightSum:    Record<string, number> = {};
  const occurrences:  Record<string, number> = {};

  for (const g of seeds) {
    weightSum[`g:${g}`]   = (weightSum[`g:${g}`]   ?? 0) + 0.8;
    occurrences[`g:${g}`] = (occurrences[`g:${g}`] ?? 0) + 1;
  }
  for (const [idStr, r] of Object.entries(ratings)) {
    const title = pool.find(t => t.tmdbId === Number(idStr) || t.id === Number(idStr));
    if (!title) continue;
    const w = RATING_WEIGHTS[r];
    for (const f of featuresOf(title)) {
      weightSum[f]   = (weightSum[f]   ?? 0) + w;
      occurrences[f] = (occurrences[f] ?? 0) + 1;
    }
  }

  const mean: Record<string, number> = {};
  for (const f of Object.keys(weightSum)) {
    mean[f] = weightSum[f] / occurrences[f]; // conservar negativos
  }
  // Normalizar por el máximo positivo; los negativos quedan como penalización
  const maxPos = Math.max(...Object.values(mean).filter(v => v > 0), 0.001);
  return Object.fromEntries(Object.entries(mean).map(([f, v]) => [f, v / maxPos]));
}

function scoreTitle(t: NormalizedTitle, profile: Record<string, number>): number {
  return featuresOf(t).reduce((s, f) => s + (profile[f] ?? 0) * featWeight(f), 0);
}

// Evidencia por feature: cuántas cartas se respondieron y cuántas fueron vistas
export interface GenreEvidence {
  answered: Record<string, number>; // cartas respondidas que cubren la feature
  seen:     Record<string, number>; // de esas, cuántas el usuario vio (loved/liked/disliked)
}

export function computeGenreEvidence(
  ratings: Record<number, Rating>,
  pool: NormalizedTitle[],
): GenreEvidence {
  const answered: Record<string, number> = {};
  const seen:     Record<string, number> = {};
  for (const [idStr, r] of Object.entries(ratings)) {
    const title = pool.find(t => t.tmdbId === Number(idStr) || t.id === Number(idStr));
    if (!title) continue;
    for (const f of featuresOf(title)) {
      answered[f] = (answered[f] ?? 0) + 1;
      if (r !== 'not_seen') seen[f] = (seen[f] ?? 0) + 1;
    }
  }
  return { answered, seen };
}

// Incertidumbre: cuánto aporta este título sobre features con poca evidencia
function infoScore(t: NormalizedTitle, answered: Record<string, number>): number {
  return featuresOf(t).reduce((s, f) => s + featWeight(f) / (1 + (answered[f] ?? 0)), 0);
}

// Género frío: 2+ "no la vi" y ninguna vista → dejar de gastar cartas ahí
function coldGenres(ev: GenreEvidence): Set<string> {
  const cold = new Set<string>();
  for (const f of Object.keys(ev.answered)) {
    if (!f.startsWith('g:')) continue;
    const notSeen = ev.answered[f] - (ev.seen[f] ?? 0);
    if (notSeen >= 2 && (ev.seen[f] ?? 0) === 0) cold.add(f.slice(2));
  }
  return cold;
}

// Ordena candidatos: intercala match y sondeo dirigido; fríos y penalizados al
// final (con pool grande, quedar al final = quedar fuera de la cola visible).
// probeBias invierte la proporción (1 match : 2 sondeos) para rondas de expansión.
function sortAdaptive(
  remaining: NormalizedTitle[],
  profile: Record<string, number>,
  ev: GenreEvidence,
  probeBias = false,
): NormalizedTitle[] {
  const cold    = coldGenres(ev);
  const scored  = remaining.map(t => ({ t, score: scoreTitle(t, profile), info: infoScore(t, ev.answered) }));
  const penalty = scored.filter(s => s.score < 0).sort((a, b) => b.score - a.score).map(s => s.t);
  // Frío sin evidencia positiva: el usuario no conoce ese género, no insistir
  const demoted = scored.filter(s => s.score >= 0 && s.score <= 0.001 && s.t.genres.some(g => cold.has(g))).map(s => s.t);
  const demotedIds = new Set(demoted.map(t => t.tmdbId));
  const active  = scored.filter(s => s.score >= 0 && !demotedIds.has(s.t.tmdbId));

  const byMatch = [...active].sort((a, b) => b.score - a.score);
  const byInfo  = [...active].sort((a, b) => b.info - a.info);
  const nMatch  = probeBias ? 1 : 2;
  const nInfo   = probeBias ? 2 : 1;

  const used = new Set<number>();
  const result: NormalizedTitle[] = [];
  let m = 0, i = 0;
  while (result.length < active.length) {
    for (let k = 0; k < nMatch; k++) {
      while (m < byMatch.length && used.has(byMatch[m].t.tmdbId)) m++;
      if (m < byMatch.length) { used.add(byMatch[m].t.tmdbId); result.push(byMatch[m].t); }
    }
    for (let k = 0; k < nInfo; k++) {
      while (i < byInfo.length && used.has(byInfo[i].t.tmdbId)) i++;
      if (i < byInfo.length) { used.add(byInfo[i].t.tmdbId); result.push(byInfo[i].t); }
    }
    if (m >= byMatch.length && i >= byInfo.length) break;
  }
  return [...result, ...demoted, ...penalty];
}

// Arma la cola visible: cartas ya mostradas + los mejores `slots` candidatos.
// Los anchors no penalizados tienen lugar garantizado (son las cartas de
// reconocimiento); fríos y penalizados solo entran si no queda nada mejor.
function buildQueue(
  shown: NormalizedTitle[],
  candidates: NormalizedTitle[],
  profile: Record<string, number>,
  ev: GenreEvidence,
  slots: number,
  probeBias = false,
): NormalizedTitle[] {
  if (slots <= 0) return shown;
  const ordered = sortAdaptive(candidates, profile, ev, probeBias);
  const anchorIds = new Set(
    candidates.filter(t => t.isAnchor && scoreTitle(t, profile) >= 0).map(t => t.tmdbId),
  );
  const take: NormalizedTitle[] = [];
  let nonAnchorBudget = Math.max(0, slots - anchorIds.size);
  for (const t of ordered) {
    if (take.length >= slots) break;
    if (anchorIds.has(t.tmdbId)) take.push(t);
    else if (nonAnchorBudget > 0) { take.push(t); nonAnchorBudget--; }
  }
  return [...shown, ...take];
}

// Vistas positivas (loved/liked) por género — para el gatillo temprano de fase 2
function positiveSeenByGenre(
  ratings: Record<number, Rating>,
  pool: NormalizedTitle[],
): Record<string, number> {
  const pos: Record<string, number> = {};
  for (const [idStr, r] of Object.entries(ratings)) {
    if (r !== 'loved' && r !== 'liked') continue;
    const title = pool.find(t => t.tmdbId === Number(idStr) || t.id === Number(idStr));
    if (!title) continue;
    for (const g of title.genres) pos[g] = (pos[g] ?? 0) + 1;
  }
  return pos;
}

export function useOnboarding(ageRange: AgeRange): OnboardingState {
  const [pool, setPool]       = useState<NormalizedTitle[]>([]);
  const [queue, setQueue]     = useState<NormalizedTitle[]>([]);
  const [currentIndex, setIdx] = useState(0);
  const [ratings, setRatings] = useState<Record<number, Rating>>({});
  const [isLoading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [genreStepDone, setGenreStepDone] = useState(false);
  const [target, setTarget]   = useState(BASE_TARGET);
  const [extendDeclined, setExtendDeclined] = useState(false);
  const [deepened, setDeepened] = useState(false);

  const ratingsRef    = useRef(ratings);
  ratingsRef.current  = ratings;
  const poolRef       = useRef(pool);
  poolRef.current     = pool;
  const targetRef     = useRef(target);
  targetRef.current   = target;
  const genreSeedsRef = useRef<string[]>([]);
  const deepenFiredRef = useRef(false);

  useEffect(() => {
    if (!genreStepDone) return;
    let cancelled = false;
    setLoading(true);
    setIdx(0);
    setRatings({});
    setTarget(BASE_TARGET);
    setExtendDeclined(false);
    setDeepened(false);
    deepenFiredRef.current = false;

    fetchOnboardingPool(ageRange, genreSeedsRef.current, POOL_SIZE)
      .then(fetched => {
        if (cancelled) return;
        if (fetched.length === 0) {
          setError('TMDB devolvió 0 títulos. Revisá la API key y la conexión de red.');
          setLoading(false);
          return;
        }
        setPool(fetched);
        poolRef.current = fetched;
        const profile = computeLocalProfile({}, fetched, genreSeedsRef.current);
        setQueue(buildQueue([], fetched, profile, { answered: {}, seen: {} }, BASE_TARGET));
        setLoading(false);
      })
      .catch(e => {
        if (!cancelled) { setError(String(e)); setLoading(false); }
      });

    return () => { cancelled = true; };
  }, [genreStepDone, ageRange]);

  const confirmGenres = useCallback((genres: string[]) => {
    genreSeedsRef.current = genres;
    setLoading(true);
    setGenreStepDone(true);
  }, []);

  // Fase 2: con los géneros ganadores claros, traer en background candidatos
  // de sub-gusto (pares de sabor + tono). El motor de reemplazo los integra solo.
  const maybeDeepen = useCallback((newRatings: Record<number, Rating>, answeredCount: number) => {
    if (deepenFiredRef.current) return;

    const profile = computeLocalProfile(newRatings, poolRef.current, genreSeedsRef.current);
    const topGenres = Object.entries(profile)
      .filter(([f, v]) => f.startsWith('g:') && v > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([f]) => f.slice(2));
    if (topGenres.length === 0) return;

    const pos = positiveSeenByGenre(newRatings, poolRef.current);
    const earlyTrigger = topGenres.length === 2 && topGenres.every(g => (pos[g] ?? 0) >= DEEPEN_EARLY_SEEN);
    if (answeredCount < DEEPEN_AT_CARD && !earlyTrigger) return;

    deepenFiredRef.current = true;
    const topIds = topGenres
      .map(g => GENRE_NAME_TO_ID[g])
      .filter((id): id is number => id !== undefined);
    const selNames = genreSeedsRef.current.length > 0 ? genreSeedsRef.current : DEFAULT_WATCH;
    const selIds   = selNames.map(g => GENRE_NAME_TO_ID[g]).filter((id): id is number => id !== undefined);
    const companions = selIds.filter(id => !topIds.includes(id)).slice(0, 4);
    const exclude    = STRONG_GENRES.filter(id => !selIds.includes(id));

    fetchDeepeningBatch(topIds, companions, ageRange, exclude)
      .then(batch => {
        const ids = new Set(poolRef.current.map(t => t.tmdbId));
        const fks = new Set(poolRef.current.map(franchiseKey));
        const fresh = batch.filter(t => !ids.has(t.tmdbId) && !fks.has(franchiseKey(t)));
        if (fresh.length === 0) return;
        const merged = [...poolRef.current, ...fresh];
        poolRef.current = merged;
        setPool(merged);
        setDeepened(true);
      })
      .catch(() => { /* sin profundización; la fase 1 sigue funcionando */ });
  }, [ageRange]);

  const rate = useCallback((rating: Rating) => {
    const title = queue[currentIndex];
    if (!title) return;
    const newRatings = { ...ratingsRef.current, [title.tmdbId]: rating };
    setRatings(newRatings);

    const next = currentIndex + 1;
    const SEED = 3;
    // Reconstruir la cola desde TODOS los candidatos no respondidos:
    // fríos/penalizados salen, entran reemplazos frescos
    if (next >= SEED && next < targetRef.current) {
      const shown    = queue.slice(0, next);
      const shownIds = new Set(shown.map(t => t.tmdbId));
      const candidates = poolRef.current.filter(t => !shownIds.has(t.tmdbId));
      const profile  = computeLocalProfile(newRatings, poolRef.current, genreSeedsRef.current);
      const ev       = computeGenreEvidence(newRatings, poolRef.current);
      setQueue(buildQueue(shown, candidates, profile, ev, targetRef.current - next));
    }
    maybeDeepen(newRatings, next);
    setTimeout(() => setIdx(next), 250);
  }, [queue, currentIndex, maybeDeepen]);

  const liveProfile = useMemo(() =>
    computeLocalProfile(ratings, pool, genreSeedsRef.current),
    [ratings, pool],
  );

  // Géneros vigilados con menos de 2 vistas, ni fríos ni rechazados
  const pendingDoubts = useMemo(() => {
    const ev = computeGenreEvidence(ratings, pool);
    const cold = coldGenres(ev);
    const watch = genreSeedsRef.current.length > 0 ? genreSeedsRef.current : DEFAULT_WATCH;
    return watch.filter(g =>
      !cold.has(g) && (ev.seen[`g:${g}`] ?? 0) < 2 && (liveProfile[`g:${g}`] ?? 0) >= 0,
    );
  }, [ratings, pool, liveProfile]);

  const anchorPositions = useMemo<AnchorInfo[]>(() =>
    queue
      .map((t, idx) => t.isAnchor ? { idx, title: t.title } : null)
      .filter((x): x is AnchorInfo => x !== null),
    [queue],
  );

  const reachedEnd = queue.length > 0 && currentIndex >= queue.length;
  const hasReserve = pool.length > Object.keys(ratings).length;
  const canExtend  = reachedEnd && !extendDeclined && target < MAX_TARGET
    && pendingDoubts.length > 0 && hasReserve;

  const extend = useCallback(() => {
    const newTarget = Math.min(targetRef.current + EXTEND_STEP, MAX_TARGET);
    setTarget(newTarget);
    const shown    = queue;
    const shownIds = new Set(shown.map(t => t.tmdbId));
    const candidates = poolRef.current.filter(t => !shownIds.has(t.tmdbId));
    const profile  = computeLocalProfile(ratingsRef.current, poolRef.current, genreSeedsRef.current);
    const ev       = computeGenreEvidence(ratingsRef.current, poolRef.current);
    // probeBias: las cartas extra van mayormente a despejar dudas
    setQueue(buildQueue(shown, candidates, profile, ev, newTarget - shown.length, true));
  }, [queue]);

  const declineExtend = useCallback(() => setExtendDeclined(true), []);

  return {
    titles: queue, currentIndex, ratings, isLoading, error,
    rate, canSkip: currentIndex >= 12,
    isFinished: reachedEnd && !canExtend,
    genreStepDone, confirmGenres, liveProfile, anchorPositions,
    target, canExtend, pendingDoubts, extend, declineExtend,
    deepened,
  };
}
