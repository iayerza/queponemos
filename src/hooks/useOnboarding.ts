import { useState, useCallback } from 'react';
import { MOCK_TITLES } from '../constants/mockTitles';
import {
  fetchOnboardingPool, fetchDeepeningBatch,
  featuresOf, eraBucket, GENRE_NAME_TO_ID, STRONG_GENRES,
  type NormalizedTitle,
} from '../services/tmdb';
import { useAuthStore } from '../store/useAuthStore';
import type { Rating } from '../services/firebase';
import type { AgeRange } from '../navigation/types';

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'true';
const hasTmdbKey = Boolean(process.env.EXPO_PUBLIC_TMDB_API_KEY);

const MIN_TO_SKIP    = 12;
const INITIAL_TARGET = 30;
const EXT1_TARGET    = 40;
const EXT2_TARGET    = 50;

const RATING_WEIGHTS: Record<Rating, number> = {
  loved:         1.0,
  liked:         0.6,
  seen_disliked: -0.3,
  not_seen:       0,
};

interface GenreEvidence {
  answered:     Record<string, number>;
  seen:         Record<string, number>;
  answeredEras: Record<string, number>;
}

function computeGenreEvidence(
  ratings: Record<number, Rating>,
  pool: NormalizedTitle[],
): GenreEvidence {
  const answered: Record<string, number> = {};
  const seen:     Record<string, number> = {};
  const answeredEras: Record<string, number> = {};
  const poolById = new Map(pool.map(t => [t.tmdbId, t]));
  for (const [idStr, r] of Object.entries(ratings)) {
    const title = poolById.get(Number(idStr));
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

function computeLocalProfile(
  ratings: Record<number, Rating>,
  pool: NormalizedTitle[],
  seedGenres: string[] = [],
): Record<string, number> {
  const weights: Record<string, number> = {};
  for (const g of seedGenres) {
    weights[`g:${g}`] = (weights[`g:${g}`] ?? 0) + 0.8;
  }
  const poolById = new Map(pool.map(t => [t.tmdbId, t]));
  for (const [idStr, r] of Object.entries(ratings)) {
    const title = poolById.get(Number(idStr));
    if (!title) continue;
    const w = RATING_WEIGHTS[r];
    if (w === 0) continue;
    for (const f of featuresOf(title)) {
      weights[f] = (weights[f] ?? 0) + w;
    }
  }
  const maxPos = Math.max(...Object.values(weights).filter(v => v > 0), 0.001);
  return Object.fromEntries(Object.entries(weights).map(([k, v]) => [k, v / maxPos]));
}

// ERA FIX: exclude era features from match score — era diversity is handled by infoScore
function scoreTitle(t: NormalizedTitle, profile: Record<string, number>): number {
  return featuresOf(t)
    .filter(f => !f.startsWith('e:'))
    .reduce((s, f) => s + (profile[f] ?? 0), 0);
}

// ERA FIX: era diversity bonus — eras with less coverage get higher probe priority
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

function isColdGenre(genre: string, ev: GenreEvidence): boolean {
  return (ev.answered[genre] ?? 0) >= 2 && (ev.seen[genre] ?? 0) === 0;
}

function sortAdaptive(
  candidates: NormalizedTitle[],
  profile: Record<string, number>,
  ev: GenreEvidence,
): NormalizedTitle[] {
  const scored = candidates.map(t => ({
    t,
    score: scoreTitle(t, profile),
    info:  infoScore(t, ev.answered, ev.answeredEras),
    cold:  t.genres.some(g => isColdGenre(g, ev)),
  }));

  const hot  = scored.filter(s => !s.cold);
  const cold = scored.filter(s => s.cold);

  const byMatch = [...hot].sort((a, b) => b.score - a.score);
  const byInfo  = [...hot].sort((a, b) => b.info  - a.info);
  const coldSorted = [...cold].sort((a, b) => b.info - a.info);

  const result: NormalizedTitle[] = [];
  const used = new Set<number>();
  let mi = 0, ii = 0;

  // Interleave: 2 match-ranked + 1 info-ranked
  while (mi < byMatch.length || ii < byInfo.length) {
    for (let k = 0; k < 2 && mi < byMatch.length; ) {
      const item = byMatch[mi++];
      if (!used.has(item.t.tmdbId)) { result.push(item.t); used.add(item.t.tmdbId); k++; }
    }
    while (ii < byInfo.length) {
      const item = byInfo[ii++];
      if (!used.has(item.t.tmdbId)) { result.push(item.t); used.add(item.t.tmdbId); break; }
    }
  }

  for (const s of coldSorted) result.push(s.t);
  return result;
}

function buildQueueFrom(
  allTitles: NormalizedTitle[],
  currentRatings: Record<number, Rating>,
  seedGenres: string[],
  shown: NormalizedTitle[],
): NormalizedTitle[] {
  const ratedIds = new Set(Object.keys(currentRatings).map(Number));
  const shownIds = new Set(shown.map(t => t.tmdbId));
  const remaining = allTitles.filter(t => !ratedIds.has(t.tmdbId) && !shownIds.has(t.tmdbId));
  if (remaining.length === 0) return shown;
  const profile = computeLocalProfile(currentRatings, allTitles, seedGenres);
  const ev      = computeGenreEvidence(currentRatings, allTitles);
  return [...shown, ...sortAdaptive(remaining, profile, ev)];
}

function computePendingDoubts(
  selectedGenres: string[],
  ratings: Record<number, Rating>,
  pool: NormalizedTitle[],
): string[] {
  const ev = computeGenreEvidence(ratings, pool);
  return selectedGenres.filter(g => (ev.answered[g] ?? 0) < 2 || (ev.seen[g] ?? 0) < 1);
}

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
  target: number;
  canExtend: boolean;
  pendingDoubts: string[];
  extend: () => void;
  declineExtend: () => void;
}

export function useOnboarding(ageRange?: AgeRange): OnboardingState {
  const [pool, setPool]               = useState<NormalizedTitle[]>([]);
  const [queue, setQueue]             = useState<NormalizedTitle[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [ratings, setRatings]         = useState<Record<number, Rating>>({});
  const [isLoading, setLoading]       = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [genreStepDone, setGenreStepDone] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [target, setTarget]           = useState(INITIAL_TARGET);
  const [extendDeclined, setExtendDeclined] = useState(false);
  const [deepeningDone, setDeepeningDone]   = useState(false);
  const { user } = useAuthStore();

  const confirmGenres = useCallback(async (genres: string[]) => {
    setSelectedGenres(genres);
    setGenreStepDone(true);
    setLoading(true);
    setError(null);

    try {
      let fetched: NormalizedTitle[];

      if (USE_MOCK || !hasTmdbKey) {
        fetched = MOCK_TITLES.filter(t => t.year > 0 && t.posterPath);
      } else {
        const genreIds = genres
          .map(g => GENRE_NAME_TO_ID[g])
          .filter((id): id is number => id !== undefined);
        fetched = await fetchOnboardingPool(ageRange ?? 'adult', genreIds);
        if (fetched.length < 10) {
          fetched = MOCK_TITLES.filter(t => t.year > 0 && t.posterPath);
        }
      }

      const initialRatings = (user?.ratings ?? {}) as Record<number, Rating>;
      setPool(fetched);
      setRatings(initialRatings);
      const initialQueue = buildQueueFrom(fetched, initialRatings, genres, []);
      setQueue(initialQueue);
    } catch {
      setError('No se pudieron cargar los títulos');
    } finally {
      setLoading(false);
    }
  }, [ageRange, user]);

  const rate = useCallback((rating: Rating) => {
    const title = queue[currentIndex];
    if (!title) return;

    const newRatings = { ...ratings, [title.tmdbId]: rating };
    setRatings(newRatings);

    const nextIdx = currentIndex + 1;
    setCurrentIndex(nextIdx);

    const shown = queue.slice(0, nextIdx);
    const newQueue = buildQueueFrom(pool, newRatings, selectedGenres, shown);
    setQueue(newQueue);

    // Deepening at card 12 (or early at card 6 when 2 genres have 4+ positives)
    if (!deepeningDone && !USE_MOCK && hasTmdbKey) {
      const earlyTrigger = checkEarlyDeepen(newRatings, pool);
      if (nextIdx >= 12 || earlyTrigger) {
        setDeepeningDone(true);
        runDeepening(newRatings, shown, pool, newQueue, nextIdx);
      }
    }
  }, [queue, currentIndex, ratings, pool, selectedGenres, deepeningDone]);

  function checkEarlyDeepen(r: Record<number, Rating>, p: NormalizedTitle[]): boolean {
    const ev = computeGenreEvidence(r, p);
    return Object.values(ev.seen).filter(n => n >= 4).length >= 2;
  }

  async function runDeepening(
    currentRatings: Record<number, Rating>,
    shown: NormalizedTitle[],
    currentPool: NormalizedTitle[],
    currentQueue: NormalizedTitle[],
    currentIdx: number,
  ) {
    try {
      const ev = computeGenreEvidence(currentRatings, currentPool);
      const topGenres = Object.entries(ev.seen)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([g]) => GENRE_NAME_TO_ID[g])
        .filter((id): id is number => id !== undefined);

      if (topGenres.length === 0) return;

      const excludeStrong = STRONG_GENRES.filter(id => !topGenres.includes(id));
      const batch = await fetchDeepeningBatch(topGenres, [], ageRange ?? 'adult', excludeStrong);

      const existingIds = new Set(currentPool.map(t => t.tmdbId));
      const newTitles = batch.filter(t => !existingIds.has(t.tmdbId));
      if (newTitles.length === 0) return;

      const enrichedPool = [...currentPool, ...newTitles];
      setPool(enrichedPool);

      const enrichedQueue = buildQueueFrom(enrichedPool, currentRatings, selectedGenres, shown);
      setQueue(enrichedQueue);
    } catch {
      // Deepening is additive — silent failure is acceptable
    }
  }

  const extend = useCallback(() => {
    setTarget(t => t === INITIAL_TARGET ? EXT1_TARGET : EXT2_TARGET);
    setExtendDeclined(false);
  }, []);

  const declineExtend = useCallback(() => {
    setExtendDeclined(true);
  }, []);

  const doubts  = computePendingDoubts(selectedGenres, ratings, pool);
  const atTarget = genreStepDone && queue.length > 0 && currentIndex >= target;
  const canExtend = atTarget && doubts.length > 0 && target < EXT2_TARGET && !extendDeclined;
  const isFinished = atTarget && !canExtend;

  return {
    titles: queue,
    currentIndex,
    ratings,
    isLoading,
    error,
    rate,
    canSkip: currentIndex >= MIN_TO_SKIP,
    isFinished,
    genreStepDone,
    confirmGenres,
    target,
    canExtend,
    pendingDoubts: doubts,
    extend,
    declineExtend,
  };
}
