import { useState, useEffect, useCallback, useRef } from 'react';
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
}

const NICHE_GENRES = new Set([
  'Animación', 'Documental', 'Docuserie', 'Infantil',
  'Noticias', 'Reality', 'Telenovela', 'Talk', 'Familia',
]);

const RATING_WEIGHTS: Record<Rating, number> = {
  loved: 2.0, liked: 1.0, seen_disliked: -0.8, not_seen: 0,
};

const hasTmdbKey = Boolean(process.env.EXPO_PUBLIC_TMDB_API_KEY);
const MAX_ONBOARDING_TITLES = 30;

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

function sortAdaptive(remaining: NormalizedTitle[], profile: Record<string, number>): NormalizedTitle[] {
  const scored  = remaining.map(t => ({ t, score: scoreTitle(t, profile) }));
  // Penalizados (score < 0) van al final; nunca entran al explore
  const active  = scored.filter(s => s.score >= 0);
  const penalty = scored.filter(s => s.score < 0).sort((a, b) => b.score - a.score).map(s => s.t);

  const cut     = Math.ceil(active.length * 0.65);
  const sorted  = [...active].sort((a, b) => b.score - a.score);
  const exploit = sorted.slice(0, cut).map(s => s.t);
  const explore = sorted.slice(cut).map(s => s.t).sort(() => Math.random() - 0.5);

  const result: NormalizedTitle[] = [];
  let e = 0, x = 0;
  while (e < exploit.length || x < explore.length) {
    if (e < exploit.length) result.push(exploit[e++]);
    if (e < exploit.length) result.push(exploit[e++]);
    if (x < explore.length) result.push(explore[x++]);
  }
  return [...result, ...penalty]; // penalizados siempre al final
}

export function useOnboarding(ageRange?: AgeRange, tone?: ToneId, skipGenreStep = false): OnboardingState {
  const [pool, setPool]          = useState<NormalizedTitle[]>([]);
  const [queue, setQueue]        = useState<NormalizedTitle[]>([]);
  const [currentIndex, setIndex] = useState(0);
  const [ratings, setRatings]    = useState<Record<number, Rating>>({});
  const [isLoading, setLoading]  = useState(skipGenreStep);
  const [error, setError]        = useState<string | null>(null);
  const [genreStepDone, setGenreStepDone] = useState(skipGenreStep);
  const { user }                 = useAuthStore();

  const ratingsRef    = useRef(ratings);
  ratingsRef.current  = ratings;
  const poolRef       = useRef(pool);
  poolRef.current     = pool;
  const genreSeedsRef = useRef<string[]>([]);

  // Fetch titles once genre step is done (or on mount when skipGenreStep=true)
  useEffect(() => {
    if (!genreStepDone) return;

    let cancelled = false;
    setLoading(true);
    setIndex(0);
    setRatings({});

    if (!hasTmdbKey) {
      const mockPool = buildMockPool(genreSeedsRef.current).slice(0, MAX_ONBOARDING_TITLES);
      setPool(mockPool);
      poolRef.current = mockPool;
      if (genreSeedsRef.current.length > 0) {
        const profile = computeLocalProfile({}, mockPool, genreSeedsRef.current);
        setQueue(sortAdaptive(mockPool, profile));
      } else {
        setQueue(mockPool);
      }
      setLoading(false);
      return () => { cancelled = true; };
    }

    fetchOnboardingPool(ageRange, tone, genreSeedsRef.current)
      .then(fetched => {
        if (cancelled) return;
        let ordered = fetched.length >= 10 ? fetched : MOCK_FALLBACK;
        if (genreSeedsRef.current.length > 0) {
          const selectedSet = new Set(genreSeedsRef.current);
          // Anchors always pass — they're calibration points regardless of genre
          const genreFiltered = ordered.filter(t => t.isAnchor || t.genres.some(g => selectedSet.has(g)));
          if (genreFiltered.length >= 15) ordered = genreFiltered;
        }
        setPool(ordered);
        poolRef.current = ordered;
        if (genreSeedsRef.current.length > 0) {
          const profile = computeLocalProfile({}, ordered, genreSeedsRef.current);
          setQueue(sortAdaptive(ordered, profile));
        } else {
          setQueue(ordered);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setPool(MOCK_FALLBACK);
          setQueue(MOCK_FALLBACK);
          poolRef.current = MOCK_FALLBACK;
          setLoading(false);
        }
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
    const SEED_SIZE = 5;
    const shouldReorder =
      nextIndex === SEED_SIZE ||
      (nextIndex > SEED_SIZE && (nextIndex - SEED_SIZE) % 4 === 0);

    if (shouldReorder && nextIndex < queue.length) {
      const shown     = queue.slice(0, nextIndex);
      const remaining = queue.slice(nextIndex);
      const profile   = computeLocalProfile(newRatings, poolRef.current, genreSeedsRef.current);
      setQueue([...shown, ...sortAdaptive(remaining, profile)]);
    }

    setTimeout(() => setIndex(nextIndex), 300);
  }, [queue, currentIndex]);

  return {
    titles: queue,
    currentIndex,
    ratings,
    isLoading,
    error,
    rate,
    canSkip: currentIndex >= 12,
    isFinished: queue.length > 0 && currentIndex >= queue.length,
    genreStepDone,
    confirmGenres,
  };
}
