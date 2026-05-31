import { useState, useCallback } from 'react';
import { runMatching, mockMatching, type MatchingOutput } from '../services/claude';
import {
  saveMatch, setSessionMatchId, pollForMatchId, getMatchById,
} from '../services/firebase';
import { useAuthStore }  from '../store/useAuthStore';
import { useGroupStore } from '../store/useGroupStore';
import { useMatchStore } from '../store/useMatchStore';
import { MOCK_USERS }    from '../utils/mock';
import type { MoodId }   from '../services/claude';

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'true';

export function useMatching() {
  const [error, setError] = useState<string | null>(null);

  const { user }                   = useAuthStore();
  const { currentGroup }           = useGroupStore();
  const { moods, setCurrentMatch } = useMatchStore();

  // The group creator is always the "leader" who calls Claude.
  const isLeader = !currentGroup || user?.uid === currentGroup.createdBy;

  const runMatch = useCallback(async (): Promise<string | null> => {
    if (!user || !currentGroup) return null;
    setError(null);

    try {
      // ── Follower path: wait for leader to produce a matchId ────────────────
      if (!isLeader && !USE_MOCK) {
        const matchId = await pollForMatchId(currentGroup.id);
        if (!matchId) throw new Error('El tiempo de espera agotó. Intentá de nuevo.');

        const match = await getMatchById(matchId);
        if (!match) throw new Error('No se encontró el resultado.');

        setCurrentMatch(
          { recommendations: match.recommendations, groupInsight: '' },
          matchId,
        );
        return matchId;
      }

      // ── Leader path: call Claude, save, broadcast matchId ─────────────────
      const memberProfiles = currentGroup.members.map(uid => {
        if (uid === user.uid) return user;
        return MOCK_USERS[uid] ?? {
          uid,
          email: '',
          displayName: uid,
          photoURL: null,
          ratings: {},
          tasteProfile: { genres: {}, intensity: 0.5, seriesVsMovies: 0.5, implicitGenres: [] },
          onboardingDone: true,
        };
      });

      let output: MatchingOutput;

      if (USE_MOCK || !process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY) {
        await new Promise(r => setTimeout(r, 2500));
        const mockOut = mockMatching({
          users:     memberProfiles,
          moods:     moods as Record<string, MoodId>,
          platforms: currentGroup.platforms,
        });
        // Enriquecer mock con pósters TMDB si hay API key
        if (process.env.EXPO_PUBLIC_TMDB_API_KEY) {
          const { fetchTitle } = await import('../services/tmdb');
          const enriched = await Promise.all(
            mockOut.recommendations.map(async rec => {
              if (!rec.tmdbId) return rec;
              try {
                const t = await fetchTitle(rec.tmdbId, rec.type === 'series' ? 'tv' : 'movie');
                return { ...rec, posterPath: t.posterPath };
              } catch { return rec; }
            })
          );
          output = { ...mockOut, recommendations: enriched };
        } else {
          output = mockOut;
        }
      } else {
        output = await runMatching({
          users:     memberProfiles,
          moods:     moods as Record<string, MoodId>,
          platforms: currentGroup.platforms,
        });
      }

      let matchId = `local-${Date.now()}`;

      if (!USE_MOCK) {
        matchId = await saveMatch(
          currentGroup.id,
          currentGroup.members,
          output.recommendations,
          moods as Record<string, MoodId>,
        );
        // Signal the follower that results are ready
        await setSessionMatchId(currentGroup.id, matchId);
      }

      setCurrentMatch(output, matchId);

      // Guardar en historial
      const { addToHistory } = useMatchStore.getState();
      addToHistory({
        matchId,
        groupId: currentGroup.id,
        groupName: currentGroup.name,
        createdAt: Date.now(),
        recommendations: output.recommendations,
        moods: moods as Record<string, MoodId>,
      });

      return matchId;

    } catch (e) {
      setError(String(e));
      return null;
    }
  }, [user, currentGroup, moods, isLeader]);

  return { runMatch, error, isLeader };
}
