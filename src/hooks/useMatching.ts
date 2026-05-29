import { useState, useCallback } from 'react';
import { runMatching, mockMatching, type MatchingOutput } from '../services/claude';
import { saveMatch } from '../services/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { useGroupStore } from '../store/useGroupStore';
import { useMatchStore } from '../store/useMatchStore';
import { MOCK_USERS } from '../utils/mock';
import type { MoodId } from '../services/claude';

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'true';

export function useMatching() {
  const [isLoading, setLoading] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const { user }                      = useAuthStore();
  const { currentGroup }              = useGroupStore();
  const { moods, setCurrentMatch }    = useMatchStore();

  const runMatch = useCallback(async (): Promise<string | null> => {
    if (!user || !currentGroup) return null;
    setLoading(true);
    setError(null);

    try {
      const memberProfiles = currentGroup.members.map(uid => {
        if (uid === user.uid) return user;
        return MOCK_USERS[uid] ?? { uid, email: '', displayName: uid, photoURL: null, ratings: {}, tasteProfile: { genres: {}, intensity: 0.5, seriesVsMovies: 0.5, implicitGenres: [] }, onboardingDone: true };
      });

      let output: MatchingOutput;

      if (USE_MOCK || !process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY) {
        await new Promise(r => setTimeout(r, 2500));
        output = mockMatching({ users: memberProfiles, moods: moods as Record<string, MoodId>, platforms: currentGroup.platforms });
      } else {
        output = await runMatching({ users: memberProfiles, moods: moods as Record<string, MoodId>, platforms: currentGroup.platforms });
      }

      let matchId = `local-${Date.now()}`;

      if (!USE_MOCK) {
        matchId = await saveMatch(
          currentGroup.id,
          currentGroup.members,
          output.recommendations,
          moods as Record<string, MoodId>,
        );
      }

      setCurrentMatch(output, matchId);
      return matchId;
    } catch (e) {
      setError(String(e));
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, currentGroup, moods]);

  return { runMatch, isLoading, error };
}
