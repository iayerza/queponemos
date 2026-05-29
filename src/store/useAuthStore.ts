import { create } from 'zustand';
import type { UserProfile, Rating } from '../services/firebase';

interface AuthStore {
  user: UserProfile | null;
  isLoading: boolean;
  setUser: (user: UserProfile | null) => void;
  setLoading: (v: boolean) => void;
  updateRatings: (titleId: number, rating: Rating) => void;
  markOnboardingDone: () => void;
}

export const useAuthStore = create<AuthStore>(set => ({
  user: null,
  isLoading: true,
  setUser: user => set({ user, isLoading: false }),
  setLoading: isLoading => set({ isLoading }),
  updateRatings: (titleId, rating) =>
    set(s => s.user
      ? { user: { ...s.user, ratings: { ...s.user.ratings, [titleId]: rating } } }
      : s
    ),
  markOnboardingDone: () =>
    set(s => s.user ? { user: { ...s.user, onboardingDone: true } } : s),
}));
