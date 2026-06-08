import { useState, useEffect, useCallback, useRef } from 'react';
import { SEED_BY_AGE, ONBOARDING_BY_AGE, ONBOARDING_IDS } from '../constants/titles';
import { MOCK_TITLES } from '../constants/mockTitles';
import { fetchTitle, type NormalizedTitle } from '../services/tmdb';
import { useAuthStore } from '../store/useAuthStore';
import type { Rating } from '../services/firebase';
import type { AgeRange } from '../navigation/types';
import { CATALOG_IDF } from '../utils/tasteProfile';

export interface OnboardingState {
  titles: NormalizedTitle[];
  currentIndex: number;
  ratings: Record<number, Rating>;
  isLoading: boolean;
  error: string | null;
  rate: (rating: Rating) => void;
  canSkip: boolean;
  isFinished: boolean;
}

const SEED_SIZE = 10;
const REORDER_EVERY = 5;
const hasTmdbKey = Boolean(process.env.EXPO_PUBLIC_TMDB_API_KEY);

const RATING_WEIGHTS: Record<Rating, number> = {
  loved: 2.0, liked: 1.0, seen_disliked: -0.8, not_seen: 0,
};

function computeLocalProfile(
  ratings: Record<number, Rating>,
  pool: NormalizedTitle[],
): Record<string, number> {
  const raw: Record<string, number> = {};
  for (const [idStr, r] of Object.entries(ratings)) {
    const title = pool.find(t => t.tmdbId === Number(idStr) || t.id === Number(idStr));
    if (!title) continue;
    const w = RATING_WEIGHTS[r];
    for (const genre of title.genres) {
      const idf = CATALOG_IDF[genre] ?? 1.0;
      raw[genre] = (raw[genre] ?? 0) + w * idf;
    }
  }
  const max = Math.max(...Object.values(raw).filter(v => v > 0), 0.001);
  return Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v > 0).map(([g, v]) => [g, v / max])
  );
}

function selectAdaptive(
  pool: NormalizedTitle[],
  shownIds: Set<number>,
  profile: Record<string, number>,
  count: number,
): NormalizedTitle[] {
  const candidates = pool.filter(t => !shownIds.has(t.tmdbId));
  if (candidates.length === 0) return [];

  const scored = candidates
    .map(t => ({ t, score: t.genres.reduce((s, g) => s + (profile[g] ?? 0), 0) }))
    .sort((a, b) => b.score - a.score);

  const cut = Math.ceil(scored.length * 0.65);
  const exploit = scored.slice(0, cut).map(s => s.t);
  const explore = scored.slice(cut).map(s => s.t).sort(() => Math.random() - 0.5);

  const result: NormalizedTitle[] = [];
  let e = 0, x = 0;
  while (result.length < count) {
    if (e < exploit.length) result.push(exploit[e++]);
    if (result.length < count && e < exploit.length) result.push(exploit[e++]);
    if (result.length < count && x < explore.length) result.push(explore[x++]);
  }
  return result.slice(0, count);
}

export function useOnboarding(ageRange?: AgeRange): OnboardingState {
  const [pool, setPool]           = useState<NormalizedTitle[]>([]);
  const [queue, setQueue]         = useState<NormalizedTitle[]>([]);
  const [currentIndex, setIndex]  = useState(0);
  const [ratings, setRatings]     = useState<Record<number, Rating>>({});
  const [isLoading, setLoading]   = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const { user }                  = useAuthStore();
  const ratingsRef                = useRef(ratings);
  ratingsRef.current              = ratings;

  const poolIds = ageRange ? ONBOARDING_BY_AGE[ageRange] : ONBOARDING_IDS;
  const seedIds = ageRange ? SEED_BY_AGE[ageRange] : SEED_BY_AGE.mid;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setIndex(0);
    setRatings({});

    if (!hasTmdbKey) {
      if (!cancelled) {
        const mockPool = MOCK_TITLES.filter(t => t.year > 0 && t.posterPath);
        const seedTmdbIds = new Set(seedIds.map(s => s.tmdbId));
        const seedTitles = seedIds
          .map(s => mockPool.find(t => t.tmdbId === s.tmdbId))
          .filter(Boolean) as NormalizedTitle[];
        const restTitles = mockPool.filter(t => !seedTmdbIds.has(t.tmdbId));
        const ordered = [...seedTitles, ...restTitles];
        setPool(ordered);
        setQueue(ordered);
        setLoading(false);
      }
      return () => { cancelled = true; };
    }

    const MOCK_MAP = new Map(MOCK_TITLES.map(t => [t.tmdbId, t]));

    Promise.allSettled(
      poolIds.map(({ tmdbId, type }) => fetchTitle(tmdbId, type))
    ).then(results => {
      if (cancelled) return;

      const loaded = results.map((r, i) => {
        const mock = MOCK_MAP.get(poolIds[i].tmdbId) ?? MOCK_TITLES[i];
        if (r.status === 'rejected') return mock;
        const title = r.value;
        if (!title.year) return mock;
        if (!title.posterPath && mock?.posterPath) return { ...title, posterPath: mock.posterPath };
        return title;
      }).filter(Boolean) as NormalizedTitle[];

      const seedTmdbIds = new Set(seedIds.map(s => s.tmdbId));
      const seedTitles = seedIds
        .map(s => loaded.find(t => t.tmdbId === s.tmdbId))
        .filter(Boolean) as NormalizedTitle[];
      const restTitles = loaded.filter(t => !seedTmdbIds.has(t.tmdbId));
      const ordered = [...seedTitles, ...restTitles];

      setPool(ordered);
      setQueue(ordered);
      setLoading(false);
    });

    if (user?.ratings) setRatings(user.ratings as Record<number, Rating>);

    return () => { cancelled = true; };
  }, [ageRange]);

  const rate = useCallback((rating: Rating) => {
    const currentRatings = ratingsRef.current;
    const title = queue[currentIndex];
    if (!title) return;

    const newRatings = { ...currentRatings, [title.tmdbId]: rating };
    setRatings(newRatings);

    const nextIndex = currentIndex + 1;

    // Reorder remaining queue after seed phase and every REORDER_EVERY ratings after
    const shouldReorder =
      nextIndex === SEED_SIZE ||
      (nextIndex > SEED_SIZE && (nextIndex - SEED_SIZE) % REORDER_EVERY === 0);

    if (shouldReorder && nextIndex < queue.length) {
      const shown = new Set(queue.slice(0, nextIndex).map(t => t.tmdbId));
      const profile = computeLocalProfile(newRatings, pool);
      const adaptive = selectAdaptive(pool, shown, profile, queue.length - nextIndex);
      setQueue(prev => [...prev.slice(0, nextIndex), ...adaptive]);
    }

    setTimeout(() => setIndex(nextIndex), 300);
  }, [queue, currentIndex, pool]);

  return {
    titles: queue,
    currentIndex,
    ratings,
    isLoading,
    error,
    rate,
    canSkip: currentIndex >= 12,
    isFinished: queue.length > 0 && currentIndex >= queue.length,
  };
}
