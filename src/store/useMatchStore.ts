import { create } from 'zustand';
import type { MatchingOutput, MoodId, Recommendation } from '../services/claude';

export interface MatchEntry {
  matchId: string;
  groupId: string;
  groupName: string;
  createdAt: number;
  recommendations: Recommendation[];
  moods: Record<string, MoodId[]>;
}

interface MatchStore {
  currentMatch: MatchingOutput | null;
  currentMatchId: string | null;
  history: MatchEntry[];
  moods: Record<string, MoodId[]>;
  isSolo: boolean;
  setMood: (uid: string, moods: MoodId[]) => void;
  setCurrentMatch: (match: MatchingOutput, matchId: string) => void;
  addToHistory: (entry: MatchEntry) => void;
  setHistory: (entries: MatchEntry[]) => void;
  updateTitleAction: (matchIdx: number, titleIdx: number, status: Recommendation['groupStatus']) => void;
  clearMoods: () => void;
  setSoloMode: (v: boolean) => void;
  reset: () => void;
}

export const useMatchStore = create<MatchStore>(set => ({
  currentMatch: null,
  currentMatchId: null,
  history: [],
  moods: {},
  isSolo: false,
  setMood: (uid, moods) => set(s => ({ moods: { ...s.moods, [uid]: moods } })),
  setCurrentMatch: (match, matchId) => set({ currentMatch: match, currentMatchId: matchId }),
  addToHistory: entry => set(s => ({ history: [entry, ...s.history.filter(e => e.matchId !== entry.matchId)] })),
  setHistory: entries => set({ history: entries }),
  updateTitleAction: (matchIdx, titleIdx, status) =>
    set(s => {
      if (!s.currentMatch) return s;
      const recs = [...s.currentMatch.recommendations];
      recs[titleIdx] = { ...recs[titleIdx], groupStatus: status };
      const updatedMatch = { ...s.currentMatch, recommendations: recs };
      // También actualizar en el historial para que "Mis listas" lo refleje
      const matchId = s.currentMatchId;
      const history = s.history.map(e =>
        e.matchId === matchId
          ? { ...e, recommendations: recs }
          : e
      );
      return { currentMatch: updatedMatch, history };
    }),
  clearMoods: () => set({ moods: {} }),
  setSoloMode: v => set({ isSolo: v }),
  reset: () => set({ currentMatch: null, currentMatchId: null, history: [], moods: {}, isSolo: false }),
}));
