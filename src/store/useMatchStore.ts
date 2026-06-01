import { create } from 'zustand';
import type { MatchingOutput, MoodId, Recommendation } from '../services/claude';

export interface MatchEntry {
  matchId: string;
  groupId: string;
  groupName: string;
  createdAt: number;
  recommendations: Recommendation[];
  moods: Record<string, MoodId>;
}

interface MatchStore {
  currentMatch: MatchingOutput | null;
  currentMatchId: string | null;
  history: MatchEntry[];
  moods: Record<string, MoodId>;
  setMood: (uid: string, mood: MoodId) => void;
  setCurrentMatch: (match: MatchingOutput, matchId: string) => void;
  addToHistory: (entry: MatchEntry) => void;
  setHistory: (entries: MatchEntry[]) => void;
  updateTitleAction: (matchIdx: number, titleIdx: number, status: Recommendation['groupStatus']) => void;
  clearMoods: () => void;
}

export const useMatchStore = create<MatchStore>(set => ({
  currentMatch: null,
  currentMatchId: null,
  history: [],
  moods: {},
  setMood: (uid, mood) => set(s => ({ moods: { ...s.moods, [uid]: mood } })),
  setCurrentMatch: (match, matchId) => set({ currentMatch: match, currentMatchId: matchId }),
  addToHistory: entry => set(s => ({ history: [entry, ...s.history.filter(e => e.matchId !== entry.matchId)] })),
  setHistory: entries => set({ history: entries }),
  updateTitleAction: (matchIdx, titleIdx, status) =>
    set(s => {
      if (!s.currentMatch) return s;
      const recs = [...s.currentMatch.recommendations];
      recs[titleIdx] = { ...recs[titleIdx], groupStatus: status };
      return { currentMatch: { ...s.currentMatch, recommendations: recs } };
    }),
  clearMoods: () => set({ moods: {} }),
}));
