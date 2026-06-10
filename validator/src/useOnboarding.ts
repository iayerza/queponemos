import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { fetchOnboardingPool, type NormalizedTitle } from './tmdb';

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
}

const RATING_WEIGHTS: Record<Rating, number> = {
  loved: 2.0, liked: 1.0, seen_disliked: -0.8, not_seen: 0,
};

export function computeLocalProfile(
  ratings: Record<number, Rating>,
  pool: NormalizedTitle[],
  seeds: string[] = [],
): Record<string, number> {
  const weightSum:    Record<string, number> = {};
  const occurrences:  Record<string, number> = {};

  for (const g of seeds) {
    weightSum[g]   = (weightSum[g]   ?? 0) + 0.8;
    occurrences[g] = (occurrences[g] ?? 0) + 1;
  }
  for (const [idStr, r] of Object.entries(ratings)) {
    const title = pool.find(t => t.tmdbId === Number(idStr) || t.id === Number(idStr));
    if (!title) continue;
    const w = RATING_WEIGHTS[r];
    for (const genre of title.genres) {
      weightSum[genre]   = (weightSum[genre]   ?? 0) + w;
      occurrences[genre] = (occurrences[genre] ?? 0) + 1;
    }
  }

  const mean: Record<string, number> = {};
  for (const g of Object.keys(weightSum)) {
    const avg = weightSum[g] / occurrences[g];
    if (avg > 0) mean[g] = avg;
  }
  const max = Math.max(...Object.values(mean), 0.001);
  return Object.fromEntries(Object.entries(mean).map(([g, v]) => [g, v / max]));
}

function scoreTitle(t: NormalizedTitle, profile: Record<string, number>): number {
  return t.genres.reduce((s, g) => s + (profile[g] ?? 0), 0);
}

function sortAdaptive(remaining: NormalizedTitle[], profile: Record<string, number>): NormalizedTitle[] {
  const scored = remaining.map(t => ({ t, score: scoreTitle(t, profile) }));
  const cut    = Math.ceil(scored.length * 0.65);
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const exploit = sorted.slice(0, cut).map(s => s.t);
  const explore  = sorted.slice(cut).map(s => s.t).sort(() => Math.random() - 0.5);
  const result: NormalizedTitle[] = [];
  let e = 0, x = 0;
  while (result.length < remaining.length) {
    if (e < exploit.length)                                result.push(exploit[e++]);
    if (result.length < remaining.length && e < exploit.length) result.push(exploit[e++]);
    if (result.length < remaining.length && x < explore.length) result.push(explore[x++]);
  }
  return result;
}

export function useOnboarding(ageRange: AgeRange): OnboardingState {
  const [pool, setPool]       = useState<NormalizedTitle[]>([]);
  const [queue, setQueue]     = useState<NormalizedTitle[]>([]);
  const [currentIndex, setIdx] = useState(0);
  const [ratings, setRatings] = useState<Record<number, Rating>>({});
  const [isLoading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [genreStepDone, setGenreStepDone] = useState(false);

  const ratingsRef    = useRef(ratings);
  ratingsRef.current  = ratings;
  const poolRef       = useRef(pool);
  poolRef.current     = pool;
  const genreSeedsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!genreStepDone) return;
    let cancelled = false;
    setLoading(true);
    setIdx(0);
    setRatings({});

    fetchOnboardingPool(ageRange)
      .then(fetched => {
        if (cancelled) return;
        if (fetched.length === 0) {
          setError('TMDB devolvió 0 títulos. Revisá la API key y la conexión de red.');
          setLoading(false);
          return;
        }
        setPool(fetched);
        poolRef.current = fetched;
        if (genreSeedsRef.current.length > 0) {
          const profile = computeLocalProfile({}, fetched, genreSeedsRef.current);
          setQueue(sortAdaptive(fetched, profile));
        } else {
          setQueue(fetched);
        }
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

  const rate = useCallback((rating: Rating) => {
    const title = queue[currentIndex];
    if (!title) return;
    const newRatings = { ...ratingsRef.current, [title.tmdbId]: rating };
    setRatings(newRatings);

    const next = currentIndex + 1;
    const SEED = 5;
    const shouldReorder = next === SEED || (next > SEED && (next - SEED) % 4 === 0);
    if (shouldReorder && next < queue.length) {
      const shown     = queue.slice(0, next);
      const remaining = queue.slice(next);
      const profile   = computeLocalProfile(newRatings, poolRef.current, genreSeedsRef.current);
      setQueue([...shown, ...sortAdaptive(remaining, profile)]);
    }
    setTimeout(() => setIdx(next), 250);
  }, [queue, currentIndex]);

  const liveProfile = useMemo(() =>
    computeLocalProfile(ratings, pool, genreSeedsRef.current),
    [ratings, pool],
  );

  const anchorPositions = useMemo<AnchorInfo[]>(() =>
    queue
      .map((t, idx) => t.isAnchor ? { idx, title: t.title } : null)
      .filter((x): x is AnchorInfo => x !== null),
    [queue],
  );

  return {
    titles: queue, currentIndex, ratings, isLoading, error,
    rate, canSkip: currentIndex >= 10,
    isFinished: queue.length > 0 && currentIndex >= queue.length,
    genreStepDone, confirmGenres, liveProfile, anchorPositions,
  };
}
