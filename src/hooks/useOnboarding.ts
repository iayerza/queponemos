import { useState, useEffect, useCallback } from 'react';
import { ONBOARDING_IDS } from '../constants/titles';
import { MOCK_TITLES } from '../constants/mockTitles';
import { fetchTitle, type NormalizedTitle } from '../services/tmdb';
import { useAuthStore } from '../store/useAuthStore';
import type { Rating } from '../services/firebase';

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

const hasTmdbKey = Boolean(process.env.EXPO_PUBLIC_TMDB_API_KEY);

export function useOnboarding(): OnboardingState {
  const [titles, setTitles]      = useState<NormalizedTitle[]>([]);
  const [currentIndex, setIndex] = useState(0);
  const [ratings, setRatings]    = useState<Record<number, Rating>>({});
  const [isLoading, setLoading]  = useState(true);
  const [error, setError]        = useState<string | null>(null);
  const { user }                 = useAuthStore();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    if (!hasTmdbKey) {
      if (!cancelled) { setTitles(MOCK_TITLES.filter(t => t.year > 0 && t.posterPath)); setLoading(false); }
      return () => { cancelled = true; };
    }

    const MOCK_MAP = new Map(MOCK_TITLES.map(t => [t.tmdbId, t]));

    Promise.allSettled(
      ONBOARDING_IDS.map(({ tmdbId, type }) => fetchTitle(tmdbId, type))
    ).then(results => {
      if (cancelled) return;
      const loaded = results.map((r, i) => {
        const mock = MOCK_MAP.get(ONBOARDING_IDS[i].tmdbId) ?? MOCK_TITLES[i];
        if (r.status === 'rejected') return mock;
        const title = r.value;
        if (!title.year) return mock;
        if (!title.posterPath && mock?.posterPath) return { ...title, posterPath: mock.posterPath };
        return title;
      });
      setTitles(loaded.filter(Boolean) as typeof MOCK_TITLES);
      setLoading(false);
    });

    if (user?.ratings) setRatings(user.ratings as Record<number, Rating>);

    return () => { cancelled = true; };
  }, []);

  const rate = useCallback((rating: Rating) => {
    const title = titles[currentIndex];
    if (!title) return;
    setRatings(prev => ({ ...prev, [title.tmdbId]: rating }));
    setTimeout(() => setIndex(i => i + 1), 300);
  }, [titles, currentIndex]);

  return {
    titles,
    currentIndex,
    ratings,
    isLoading,
    error,
    rate,
    canSkip: currentIndex >= 15,
    isFinished: titles.length > 0 && currentIndex >= titles.length,
  };
}
