import { create } from 'zustand';
import type { UserProfile, Rating } from '../services/firebase';
import type { PlatformId } from '../constants/platforms';

interface AuthStore {
  user: UserProfile | null;
  isLoading: boolean;
  // tmdbId → title name; populated at rating time for richer Claude prompts
  ratedTitleNames: Record<number, string>;
  setUser: (user: UserProfile | null) => void;
  setLoading: (v: boolean) => void;
  updateRatings: (titleId: number, rating: Rating, titleName?: string) => void;
  markOnboardingDone: () => void;
  setPlatforms: (platforms: PlatformId[]) => void;
  setAgeRange: (range: UserProfile['ageRange']) => void;
}

export const useAuthStore = create<AuthStore>(set => ({
  user: null,
  isLoading: true,
  ratedTitleNames: {},
  setUser: user => set({ user, isLoading: false }),
  setLoading: isLoading => set({ isLoading }),
  updateRatings: (titleId, rating, titleName) =>
    set(s => ({
      user: s.user
        ? { ...s.user, ratings: { ...s.user.ratings, [titleId]: rating } }
        : null,
      ratedTitleNames: titleName
        ? { ...s.ratedTitleNames, [titleId]: titleName }
        : s.ratedTitleNames,
    })),
  markOnboardingDone: () =>
    set(s => s.user ? { user: { ...s.user, onboardingDone: true } } : s),
  setPlatforms: platforms =>
    set(s => s.user ? { user: { ...s.user, platforms } } : s),
  setAgeRange: range =>
    set(s => s.user ? { user: { ...s.user, ageRange: range } } : s),
}));
