import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { MOCK_TITLES } from '../constants/mockTitles';
import { fetchOnboardingPool, type NormalizedTitle } from '../services/tmdb';
import { useAuthStore } from '../store/useAuthStore';
import type { Rating } from '../services/firebase';
import type { AgeRange, ToneId } from '../navigation/types';

export interface OnboardingState {
  titles: NormalizedTitle[];
  currentIndex: number;
  ratings: Record<number, Rating>;
  isLoading: boolean;
  error: string | null;
  rate: (rating: Rating) => void;
  canSkip: boolean;
  isFinished: boolean;
  genreStepDone: boolean;
  confirmGenres: (genres: string[]) => void;
  // Expansión opcional 30 → 40 → 50 cuando quedan géneros con dudas
  target: number;
  canExtend: boolean;
  pendingDoubts: string[];
  extend: () => void;
  declineExtend: () => void;
}

const NICHE_GENRES = new Set([
  'Animación', 'Documental', 'Docuserie', 'Infantil',
  'Noticias', 'Reality', 'Telenovela', 'Talk', 'Familia',
]);

const RATING_WEIGHTS: Record<Rating, number> = {
  loved: 2.0, liked: 1.0, seen_disliked: -0.8, not_seen: 0,
};

const hasTmdbKey = Boolean(process.env.EXPO_PUBLIC_TMDB_API_KEY);

const BASE_TARGET = 30;
const EXTEND_STEP = 10;
const MAX_TARGET  = 50;
// Candidatos a traer de TMDB: el máximo mostrable + reserva para reemplazos
const POOL_SIZE   = MAX_TARGET + 10;

// Géneros a vigilar para dudas cuando el usuario salteó la selección
const DEFAULT_WATCH = ['Acción', 'Comedia', 'Drama', 'Thriller', 'Romance', 'Ciencia Ficción'];

const MOCK_FALLBACK = (MOCK_TITLES as unknown as NormalizedTitle[]).filter(t => t.year > 0 && t.posterPath);

function buildMockPool(selectedGenres: string[]): NormalizedTitle[] {
  const valid = (MOCK_TITLES as unknown as NormalizedTitle[]).filter(t => t.year > 0 && t.posterPath);
  if (selectedGenres.length === 0) return valid.filter(t => !NICHE_GENRES.has(t.genres[0] ?? ''));
  const selected = new Set(selectedGenres);
  return valid.filter(t => t.genres.some(g => selected.has(g)) || Math.random() < 0.25);
}

function computeLocalProfile(
  ratings: Record<number, Rating>,
  pool: NormalizedTitle[],
  seeds: string[] = [],
): Record<string, number> {
  const weightSum: Record<string, number> = {};
  const occurrences: Record<string, number> = {};

  for (const g of seeds) {
    weightSum[g] = (weightSum[g] ?? 0) + 0.8;
    occurrences[g] = (occurrences[g] ?? 0) + 1;
  }
  for (const [idStr, r] of Object.entries(ratings)) {
    const title = pool.find(t => t.tmdbId === Number(idStr) || t.id === Number(idStr));
    if (!title) continue;
    const w = RATING_WEIGHTS[r];
    for (const genre of title.genres) {
      weightSum[genre]  = (weightSum[genre]  ?? 0) + w;
      occurrences[genre] = (occurrences[genre] ?? 0) + 1;
    }
  }

  const mean: Record<string, number> = {};
  for (const g of Object.keys(weightSum)) {
    mean[g] = weightSum[g] / occurrences[g]; // conservar negativos
  }
  // Normalizar por el máximo positivo; los negativos quedan como penalización
  const maxPos = Math.max(...Object.values(mean).filter(v => v > 0), 0.001);
  return Object.fromEntries(Object.entries(mean).map(([g, v]) => [g, v / maxPos]));
}

function scoreTitle(t: NormalizedTitle, profile: Record<string, number>): number {
  return t.genres.reduce((s, g) => s + (profile[g] ?? 0), 0);
}

// Evidencia por género: cuántas cartas se respondieron y cuántas fueron vistas
interface GenreEvidence {
  answered: Record<string, number>; // cartas respondidas que cubren el género
  seen:     Record<string, number>; // de esas, cuántas el usuario vio (loved/liked/disliked)
}

function computeGenreEvidence(
  ratings: Record<number, Rating>,
  pool: NormalizedTitle[],
): GenreEvidence {
  const answered: Record<string, number> = {};
  const seen:     Record<string, number> = {};
  for (const [idStr, r] of Object.entries(ratings)) {
    const title = pool.find(t => t.tmdbId === Number(idStr) || t.id === Number(idStr));
    if (!title) continue;
    for (const g of title.genres) {
      answered[g] = (answered[g] ?? 0) + 1;
      if (r !== 'not_seen') seen[g] = (seen[g] ?? 0) + 1;
    }
  }
  return { answered, seen };
}

// Incertidumbre: cuánto aporta este título sobre géneros con poca evidencia
function infoScore(t: NormalizedTitle, answered: Record<string, number>): number {
  return t.genres.reduce((s, g) => s + 1 / (1 + (answered[g] ?? 0)), 0);
}

// Género frío: 2+ "no la vi" y ninguna vista → dejar de gastar cartas ahí
function coldGenres(ev: GenreEvidence): Set<string> {
  const cold = new Set<string>();
  for (const g of Object.keys(ev.answered)) {
    const notSeen = ev.answered[g] - (ev.seen[g] ?? 0);
    if (notSeen >= 2 && (ev.seen[g] ?? 0) === 0) cold.add(g);
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

export function useOnboarding(ageRange?: AgeRange, tone?: ToneId, skipGenreStep = false): OnboardingState {
  const [pool, setPool]          = useState<NormalizedTitle[]>([]);
  const [queue, setQueue]        = useState<NormalizedTitle[]>([]);
  const [currentIndex, setIndex] = useState(0);
  const [ratings, setRatings]    = useState<Record<number, Rating>>({});
  const [isLoading, setLoading]  = useState(skipGenreStep);
  const [error, setError]        = useState<string | null>(null);
  const [genreStepDone, setGenreStepDone] = useState(skipGenreStep);
  const [target, setTarget]      = useState(BASE_TARGET);
  const [extendDeclined, setExtendDeclined] = useState(false);
  const { user }                 = useAuthStore();

  const ratingsRef    = useRef(ratings);
  ratingsRef.current  = ratings;
  const poolRef       = useRef(pool);
  poolRef.current     = pool;
  const targetRef     = useRef(target);
  targetRef.current   = target;
  const genreSeedsRef = useRef<string[]>([]);

  // Fetch titles once genre step is done (or on mount when skipGenreStep=true)
  useEffect(() => {
    if (!genreStepDone) return;

    let cancelled = false;
    setLoading(true);
    setIndex(0);
    setRatings({});
    setTarget(BASE_TARGET);
    setExtendDeclined(false);

    const initQueue = (fetched: NormalizedTitle[]) => {
      setPool(fetched);
      poolRef.current = fetched;
      const profile = computeLocalProfile({}, fetched, genreSeedsRef.current);
      setQueue(buildQueue([], fetched, profile, { answered: {}, seen: {} }, BASE_TARGET));
      setLoading(false);
    };

    if (!hasTmdbKey) {
      initQueue(buildMockPool(genreSeedsRef.current));
      return () => { cancelled = true; };
    }

    fetchOnboardingPool(ageRange, tone, genreSeedsRef.current, POOL_SIZE)
      .then(fetched => {
        if (cancelled) return;
        initQueue(fetched.length >= 10 ? fetched : MOCK_FALLBACK);
      })
      .catch(() => {
        if (!cancelled) initQueue(MOCK_FALLBACK);
      });

    if (user?.ratings) setRatings(user.ratings as Record<number, Rating>);
    return () => { cancelled = true; };
  }, [genreStepDone, ageRange, tone]);

  const confirmGenres = useCallback((genres: string[]) => {
    genreSeedsRef.current = genres;
    setGenreStepDone(true);
  }, []);

  const rate = useCallback((rating: Rating) => {
    const currentRatings = ratingsRef.current;
    const title = queue[currentIndex];
    if (!title) return;

    const newRatings = { ...currentRatings, [title.tmdbId]: rating };
    setRatings(newRatings);

    const nextIndex = currentIndex + 1;
    const SEED_SIZE = 3;
    // Reconstruir la cola desde TODOS los candidatos no respondidos:
    // fríos/penalizados salen, entran reemplazos frescos de la reserva
    if (nextIndex >= SEED_SIZE && nextIndex < targetRef.current) {
      const shown      = queue.slice(0, nextIndex);
      const shownIds   = new Set(shown.map(t => t.tmdbId));
      const candidates = poolRef.current.filter(t => !shownIds.has(t.tmdbId));
      const profile    = computeLocalProfile(newRatings, poolRef.current, genreSeedsRef.current);
      const ev         = computeGenreEvidence(newRatings, poolRef.current);
      setQueue(buildQueue(shown, candidates, profile, ev, targetRef.current - nextIndex));
    }

    setTimeout(() => setIndex(nextIndex), 300);
  }, [queue, currentIndex]);

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
      !cold.has(g) && (ev.seen[g] ?? 0) < 2 && (liveProfile[g] ?? 0) >= 0,
    );
  }, [ratings, pool, liveProfile]);

  const reachedEnd = queue.length > 0 && currentIndex >= queue.length;
  const hasReserve = pool.length > Object.keys(ratings).length;
  const canExtend  = reachedEnd && !extendDeclined && target < MAX_TARGET
    && pendingDoubts.length > 0 && hasReserve;

  const extend = useCallback(() => {
    const newTarget = Math.min(targetRef.current + EXTEND_STEP, MAX_TARGET);
    setTarget(newTarget);
    const shown      = queue;
    const shownIds   = new Set(shown.map(t => t.tmdbId));
    const candidates = poolRef.current.filter(t => !shownIds.has(t.tmdbId));
    const profile    = computeLocalProfile(ratingsRef.current, poolRef.current, genreSeedsRef.current);
    const ev         = computeGenreEvidence(ratingsRef.current, poolRef.current);
    // probeBias: las cartas extra van mayormente a despejar dudas
    setQueue(buildQueue(shown, candidates, profile, ev, newTarget - shown.length, true));
  }, [queue]);

  const declineExtend = useCallback(() => setExtendDeclined(true), []);

  return {
    titles: queue,
    currentIndex,
    ratings,
    isLoading,
    error,
    rate,
    canSkip: currentIndex >= 12,
    isFinished: reachedEnd && !canExtend,
    genreStepDone,
    confirmGenres,
    target,
    canExtend,
    pendingDoubts,
    extend,
    declineExtend,
  };
}
