import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { MOCK_TITLES } from '../constants/mockTitles';
import {
  fetchOnboardingPool, fetchDeepeningBatch,
  featuresOf, eraBucket, GENRE_NAME_TO_ID, STRONG_GENRES,
  type NormalizedTitle,
} from '../services/tmdb';
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

const CONFIG = {
  COLD_THRESHOLD:    2,    // dislikes/skips consecutivos para congelar género
  COLD_COOLDOWN:     15,   // cartas hasta que el género se descongela
  FATIGUE_WINDOW:    12,   // últimos N géneros en historial (≈ 4 cartas)
  FATIGUE_PENALTY:   0.2,  // penalización por cada aparición reciente del género
};

const hasTmdbKey = Boolean(process.env.EXPO_PUBLIC_TMDB_API_KEY);

const BASE_TARGET  = 30;
const EXTEND_STEP  = 10;
const MAX_TARGET   = 50;
const POOL_SIZE    = MAX_TARGET + 10; // 60 candidatos
const DEEPEN_AT    = 12; // profundizar a partir de la carta 12

// Géneros a vigilar para dudas cuando el usuario salteó la selección
const DEFAULT_WATCH = ['Acción', 'Comedia', 'Drama', 'Thriller', 'Romance', 'Ciencia Ficción'];

const MOCK_FALLBACK = (MOCK_TITLES as unknown as NormalizedTitle[]).filter(t => t.year > 0 && t.posterPath);

function buildMockPool(selectedGenres: string[]): NormalizedTitle[] {
  const valid = (MOCK_TITLES as unknown as NormalizedTitle[]).filter(t => t.year > 0 && t.posterPath);
  if (selectedGenres.length === 0) return valid.filter(t => !NICHE_GENRES.has(t.genres[0] ?? ''));
  const selected = new Set(selectedGenres);
  return valid.filter(t => t.genres.some(g => selected.has(g)) || Math.random() < 0.25);
}

// ─── Feature-based profile ────────────────────────────────────────────────────
// Genera un perfil con claves multi-dimensionales (g:/p:/e:/t:) que permiten
// distinguir thriller de crimen vs thriller de romance, épocas, tono prestige/palomitero.

function computeLocalProfile(
  ratings: Record<number, Rating>,
  pool: NormalizedTitle[],
  seeds: string[] = [],
): Record<string, number> {
  const weights: Record<string, number> = {};

  // Semillas de género del selector: pre-cargamos señal antes de las respuestas
  for (const g of seeds) {
    weights[`g:${g}`] = (weights[`g:${g}`] ?? 0) + 0.8;
  }

  for (const [idStr, r] of Object.entries(ratings)) {
    const title = pool.find(t => t.tmdbId === Number(idStr) || t.id === Number(idStr));
    if (!title) continue;
    const w = RATING_WEIGHTS[r];
    if (w === 0) continue;
    for (const f of featuresOf(title)) {
      weights[f] = (weights[f] ?? 0) + w;
    }
  }

  // Normalizar por el máximo positivo; los negativos quedan como penalización
  const maxPos = Math.max(...Object.values(weights).filter(v => v > 0), 0.001);
  return Object.fromEntries(Object.entries(weights).map(([k, v]) => [k, v / maxPos]));
}

// ERA FIX: exclude e:* features so rated 80s/90s films don't boost other same-era films
function scoreTitle(t: NormalizedTitle, profile: Record<string, number>): number {
  return featuresOf(t)
    .filter(f => !f.startsWith('e:'))
    .reduce((s, f) => s + (profile[f] ?? 0), 0);
}

// Evidencia por género: cuántas cartas se respondieron y cuántas fueron vistas
interface GenreEvidence {
  answered:     Record<string, number>;
  seen:         Record<string, number>;
  answeredEras: Record<string, number>; // ERA FIX: track era coverage
}

function computeGenreEvidence(
  ratings: Record<number, Rating>,
  pool: NormalizedTitle[],
): GenreEvidence {
  const answered:     Record<string, number> = {};
  const seen:         Record<string, number> = {};
  const answeredEras: Record<string, number> = {};
  for (const [idStr, r] of Object.entries(ratings)) {
    const title = pool.find(t => t.tmdbId === Number(idStr) || t.id === Number(idStr));
    if (!title) continue;
    for (const g of title.genres) {
      answered[g] = (answered[g] ?? 0) + 1;
      if (r !== 'not_seen') seen[g] = (seen[g] ?? 0) + 1;
    }
    if (title.year) {
      const era = eraBucket(title.year);
      answeredEras[era] = (answeredEras[era] ?? 0) + 1;
    }
  }
  return { answered, seen, answeredEras };
}

// ERA FIX: infoScore adds era diversity bonus so under-represented eras (2000s+) get probed more
function infoScore(
  t: NormalizedTitle,
  answered: Record<string, number>,
  answeredEras: Record<string, number>,
): number {
  const genreInfo = t.genres.reduce((s, g) => s + 1 / (1 + (answered[g] ?? 0)), 0);
  const era = t.year ? eraBucket(t.year) : null;
  const eraBonus = era ? 0.5 / (1 + (answeredEras[era] ?? 0)) : 0;
  return genreInfo + eraBonus;
}

// Género frío: 2+ "no la vi" y ninguna vista, O congelado por consecutivos negativos
function coldGenres(ev: GenreEvidence, activeCooldown: Record<string, number> = {}): Set<string> {
  const cold = new Set<string>();
  for (const g of Object.keys(ev.answered)) {
    const notSeen = ev.answered[g] - (ev.seen[g] ?? 0);
    if (notSeen >= 2 && (ev.seen[g] ?? 0) === 0) cold.add(g);
  }
  for (const g of Object.keys(activeCooldown)) cold.add(g);
  return cold;
}

// Ordena candidatos: intercala match y sondeo dirigido; fríos y penalizados al final.
// recentHistory: últimos N géneros vistos (≈ últimas 4 cartas) para penalizar fatiga.
function sortAdaptive(
  remaining: NormalizedTitle[],
  profile: Record<string, number>,
  ev: GenreEvidence,
  probeBias = false,
  activeCooldown: Record<string, number> = {},
  recentHistory: string[] = [],
): NormalizedTitle[] {
  const cold = coldGenres(ev, activeCooldown);

  const scored = remaining.map(t => {
    const fatigue = t.genres.reduce(
      (acc, g) => acc + recentHistory.filter(h => h === g).length * CONFIG.FATIGUE_PENALTY,
      0,
    );
    return {
      t,
      score: scoreTitle(t, profile) - fatigue,
      info:  infoScore(t, ev.answered, ev.answeredEras) - fatigue * 0.5,
    };
  });

  const penalty = scored.filter(s => s.score < 0).sort((a, b) => b.score - a.score).map(s => s.t);
  const demoted = scored.filter(s => s.score >= 0 && s.score <= 0.001 && s.t.genres.some(g => cold.has(g))).map(s => s.t);
  const demotedIds = new Set(demoted.map(t => t.tmdbId));
  const active  = scored.filter(s => s.score >= 0 && !demotedIds.has(s.t.tmdbId));

  const byMatch = [...active].sort((a, b) => b.score - a.score);
  const byInfo  = [...active].sort((a, b) => b.info  - a.info);
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

// Arma la cola visible: anchors garantizados + mejores candidatos hasta `slots`.
function buildQueue(
  shown: NormalizedTitle[],
  candidates: NormalizedTitle[],
  profile: Record<string, number>,
  ev: GenreEvidence,
  slots: number,
  probeBias = false,
  activeCooldown: Record<string, number> = {},
  recentHistory: string[] = [],
): NormalizedTitle[] {
  if (slots <= 0) return shown;
  const ordered = sortAdaptive(candidates, profile, ev, probeBias, activeCooldown, recentHistory);
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
  // Cooldown activo: género → cartas restantes hasta descongelar
  const [coldCooldown, setColdCooldown]     = useState<Record<string, number>>({});
  // Historial reciente de géneros vistos (últimas FATIGUE_WINDOW apariciones ≈ 4 cartas)
  const [recentHistory, setRecentHistory]   = useState<string[]>([]);
  const { user }                 = useAuthStore();

  const ratingsRef       = useRef(ratings);
  ratingsRef.current     = ratings;
  const poolRef          = useRef(pool);
  poolRef.current        = pool;
  const queueRef         = useRef(queue);
  queueRef.current       = queue;
  const targetRef        = useRef(target);
  targetRef.current      = target;
  const coldCooldownRef  = useRef(coldCooldown);
  coldCooldownRef.current = coldCooldown;
  const recentHistoryRef = useRef(recentHistory);
  recentHistoryRef.current = recentHistory;
  // Consecutivos negativos por género (dislike + skip), reseteados al recibir positivo
  const consecutiveNegsRef = useRef<Record<string, number>>({});
  const genreSeedsRef    = useRef<string[]>([]);
  const deepenedRef      = useRef(false);
  const indexRef         = useRef(0);
  indexRef.current       = currentIndex;

  // Fetch titles once genre step is done (or on mount when skipGenreStep=true)
  useEffect(() => {
    if (!genreStepDone) return;

    let cancelled = false;
    setLoading(true);
    setIndex(0);
    setRatings({});
    setTarget(BASE_TARGET);
    setExtendDeclined(false);
    deepenedRef.current = false;

    const initQueue = (fetched: NormalizedTitle[]) => {
      setPool(fetched);
      poolRef.current = fetched;
      const profile = computeLocalProfile({}, fetched, genreSeedsRef.current);
      setQueue(buildQueue([], fetched, profile, { answered: {}, seen: {}, answeredEras: {} }, BASE_TARGET));
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

  // Deepening: fetch sub-genre specific titles once top genres are confirmed.
  // Triggered at card DEEPEN_AT or earlier when clear signal exists.
  const maybeDeepen = useCallback(async (newRatings: Record<number, Rating>, answeredCount: number) => {
    if (deepenedRef.current || !hasTmdbKey) return;

    // Early trigger: 2+ genres with 4+ positive ratings at card 6+
    const earlyTrigger = answeredCount >= 6 && (() => {
      const genrePos: Record<string, number> = {};
      for (const [idStr, r] of Object.entries(newRatings)) {
        if (r !== 'loved' && r !== 'liked') continue;
        const t = poolRef.current.find(t => t.tmdbId === Number(idStr) || t.id === Number(idStr));
        if (!t) continue;
        for (const g of t.genres) genrePos[g] = (genrePos[g] ?? 0) + 1;
      }
      return Object.values(genrePos).filter(v => v >= 4).length >= 2;
    })();

    if (answeredCount < DEEPEN_AT && !earlyTrigger) return;

    deepenedRef.current = true;

    try {
      // Extract top genres from feature profile
      const profile = computeLocalProfile(newRatings, poolRef.current, genreSeedsRef.current);
      const genreScores: Record<string, number> = {};
      for (const [f, w] of Object.entries(profile)) {
        if (f.startsWith('g:')) genreScores[f.slice(2)] = w;
      }
      const sortedGenres = Object.entries(genreScores)
        .filter(([, w]) => w > 0)
        .sort((a, b) => b[1] - a[1]);

      const topIds = sortedGenres.slice(0, 3)
        .map(([g]) => GENRE_NAME_TO_ID[g])
        .filter((id): id is number => id !== undefined);

      const compIds = sortedGenres.slice(3, 6)
        .map(([g]) => GENRE_NAME_TO_ID[g])
        .filter((id): id is number => id !== undefined);

      if (topIds.length === 0) return;

      const excludeIds = STRONG_GENRES.filter(id => !topIds.includes(id) && !compIds.includes(id));
      const batch = await fetchDeepeningBatch(topIds, compIds, ageRange ?? 'adult', excludeIds, 40);

      const existingIds = new Set(poolRef.current.map(t => t.tmdbId));
      const fresh = batch.filter(t => !existingIds.has(t.tmdbId));

      if (fresh.length > 0) {
        const expanded = [...poolRef.current, ...fresh];
        setPool(expanded);
        poolRef.current = expanded;

        // Rebuild queue tail with expanded pool
        const currentQueue = queueRef.current;
        const shown      = currentQueue.slice(0, indexRef.current);
        const shownIds   = new Set(shown.map(t => t.tmdbId));
        const candidates = expanded.filter(t => !shownIds.has(t.tmdbId));
        const newProfile = computeLocalProfile(newRatings, expanded, genreSeedsRef.current);
        const ev         = computeGenreEvidence(newRatings, expanded);
        setQueue(buildQueue(shown, candidates, newProfile, ev, targetRef.current - shown.length, false, coldCooldownRef.current, recentHistoryRef.current));
      }
    } catch { /* silent — deepening is best-effort */ }
  }, [ageRange]);

  const rate = useCallback((rating: Rating) => {
    const currentRatings = ratingsRef.current;
    const title = queueRef.current[indexRef.current];
    if (!title) return;

    const newRatings = { ...currentRatings, [title.tmdbId]: rating };
    setRatings(newRatings);

    // ── Fatiga: acumular géneros de esta carta al historial reciente ──────────
    const newHistory = [...recentHistoryRef.current, ...title.genres]
      .slice(-CONFIG.FATIGUE_WINDOW);
    setRecentHistory(newHistory);

    // ── Cold-cooldown: actualizar consecutivos negativos por género ───────────
    const updatedCooldown = { ...coldCooldownRef.current };
    const consNegs        = { ...consecutiveNegsRef.current };

    if (rating === 'loved' || rating === 'liked') {
      // Positivo: resetear negativos y descongelar el género
      for (const g of title.genres) {
        consNegs[g] = 0;
        delete updatedCooldown[g];
      }
    } else if (rating === 'seen_disliked') {
      for (const g of title.genres) {
        consNegs[g] = (consNegs[g] ?? 0) + 1;
        if (consNegs[g] >= CONFIG.COLD_THRESHOLD && !updatedCooldown[g]) {
          updatedCooldown[g] = CONFIG.COLD_COOLDOWN;
        }
      }
    } else if (rating === 'not_seen') {
      // Skip es señal más débil: acumula 0.5 hacia el congelamiento
      for (const g of title.genres) {
        const newVal = (consNegs[g] ?? 0) + 0.5;
        consNegs[g] = newVal;
        if (newVal >= CONFIG.COLD_THRESHOLD + 1 && !updatedCooldown[g]) {
          updatedCooldown[g] = CONFIG.COLD_COOLDOWN;
        }
      }
    }

    // Decrementar cooldowns y descongelar cuando llegan a 0
    for (const g of Object.keys(updatedCooldown)) {
      updatedCooldown[g] -= 1;
      if (updatedCooldown[g] <= 0) {
        delete updatedCooldown[g];
        consNegs[g] = 0;
      }
    }

    consecutiveNegsRef.current = consNegs;
    setColdCooldown(updatedCooldown);

    // ── Reordenar cola ────────────────────────────────────────────────────────
    const nextIndex = indexRef.current + 1;
    const SEED_SIZE = 3;
    if (nextIndex >= SEED_SIZE && nextIndex < targetRef.current) {
      const shown      = queueRef.current.slice(0, nextIndex);
      const shownIds   = new Set(shown.map(t => t.tmdbId));
      const candidates = poolRef.current.filter(t => !shownIds.has(t.tmdbId));
      const profile    = computeLocalProfile(newRatings, poolRef.current, genreSeedsRef.current);
      const ev         = computeGenreEvidence(newRatings, poolRef.current);
      setQueue(buildQueue(shown, candidates, profile, ev, targetRef.current - nextIndex, false, updatedCooldown, newHistory));
    }

    setTimeout(() => setIndex(nextIndex), 300);
    maybeDeepen(newRatings, nextIndex);
  }, [maybeDeepen]);

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
      !cold.has(g) && (ev.seen[g] ?? 0) < 2 && (liveProfile[`g:${g}`] ?? 0) >= 0,
    );
  }, [ratings, pool, liveProfile]);

  const reachedEnd = queue.length > 0 && currentIndex >= queue.length;
  const hasReserve = pool.length > Object.keys(ratings).length;
  const canExtend  = reachedEnd && !extendDeclined && target < MAX_TARGET
    && pendingDoubts.length > 0 && hasReserve;

  const extend = useCallback(() => {
    const newTarget = Math.min(targetRef.current + EXTEND_STEP, MAX_TARGET);
    setTarget(newTarget);
    const shown      = queueRef.current;
    const shownIds   = new Set(shown.map(t => t.tmdbId));
    const candidates = poolRef.current.filter(t => !shownIds.has(t.tmdbId));
    const profile    = computeLocalProfile(ratingsRef.current, poolRef.current, genreSeedsRef.current);
    const ev         = computeGenreEvidence(ratingsRef.current, poolRef.current);
    setQueue(buildQueue(shown, candidates, profile, ev, newTarget - shown.length, true, coldCooldownRef.current, recentHistoryRef.current));
  }, []);

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
