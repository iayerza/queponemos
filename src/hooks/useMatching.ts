import { useState, useCallback } from 'react';
import { runMatching, mockMatching, type MatchingOutput } from '../services/claude';
import {
  saveMatch, setSessionMatchId, pollForMatchId, getMatchById,
  getUserProfile, addMatchToUserHistory, incrementGroupTurn,
} from '../services/firebase';
import { useAuthStore }  from '../store/useAuthStore';
import { useGroupStore } from '../store/useGroupStore';
import { useMatchStore } from '../store/useMatchStore';
import type { MoodId }   from '../services/claude';
import type { UserProfile } from '../services/firebase';

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'true';

export function useMatching() {
  const [error, setError] = useState<string | null>(null);

  const { user }                          = useAuthStore();
  const { currentGroup }                  = useGroupStore();
  const { moods, setCurrentMatch, isSolo } = useMatchStore();

  // The group creator is always the "leader" who calls Claude.
  const isLeader = isSolo || !currentGroup || user?.uid === currentGroup.createdBy;

  const runMatch = useCallback(async (): Promise<string | null> => {
    if (!user) return null;
    if (!isSolo && !currentGroup) return null;
    setError(null);

    try {
      // ── Follower path: wait for leader to produce a matchId ────────────────
      if (!isLeader && !USE_MOCK && currentGroup) {
        const matchId = await pollForMatchId(currentGroup.id);
        if (!matchId) throw new Error('El tiempo de espera agotó. Intentá de nuevo.');

        const match = await getMatchById(matchId);
        if (!match) throw new Error('No se encontró el resultado.');

        setCurrentMatch(
          { recommendations: match.recommendations, groupInsight: match.groupInsight ?? '' },
          matchId,
        );
        return matchId;
      }

      // ── Leader / Solo path: call Claude, save, broadcast matchId ──────────
      const platforms = isSolo
        ? (user.platforms ?? ['netflix'])
        : (currentGroup?.platforms ?? ['netflix']);

      const members = isSolo
        ? [user.uid]
        : (currentGroup?.members ?? [user.uid]);

      const memberProfiles: UserProfile[] = await Promise.all(
        members.map(async uid => {
          if (uid === user.uid) return user;
          if (USE_MOCK) {
            const { MOCK_USERS } = await import('../utils/mock');
            return MOCK_USERS[uid] ?? { uid, email: '', displayName: 'Compañero', photoURL: null, ratings: {}, tasteProfile: { genres: {}, intensity: 0.5, seriesVsMovies: 0.5, implicitGenres: [] }, onboardingDone: true, platforms: [] };
          }
          const profile = await getUserProfile(uid);
          return profile ?? { uid, email: '', displayName: 'Compañero', photoURL: null, ratings: {}, tasteProfile: { genres: {}, intensity: 0.5, seriesVsMovies: 0.5, implicitGenres: [] }, onboardingDone: true, platforms: [] };
        })
      );

      let output: MatchingOutput;

      if (USE_MOCK || !process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY) {
        await new Promise(r => setTimeout(r, 2500));
        const mockOut = mockMatching({
          users:     memberProfiles,
          moods:     moods as Record<string, MoodId>,
          platforms,
        });
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
          platforms,
        });
      }

      let matchId = `local-${Date.now()}`;

      if (!USE_MOCK) {
        if (isSolo) {
          matchId = `solo-${Date.now()}`;
        } else if (currentGroup) {
          matchId = await saveMatch(
            currentGroup.id,
            members,
            output.recommendations,
            moods as Record<string, MoodId>,
            output.groupInsight,
          );
          await setSessionMatchId(currentGroup.id, matchId);
          // El turno rota una vez por noche cerrada, y solo lo hace el líder.
          incrementGroupTurn(currentGroup.id).catch(() => {});
        }
      }

      setCurrentMatch(output, matchId);

      const historyEntry = {
        matchId,
        groupId: isSolo ? `solo-${user.uid}` : (currentGroup?.id ?? 'solo'),
        groupName: isSolo ? 'Solo' : (currentGroup?.name ?? 'Solo'),
        createdAt: Date.now(),
        recommendations: output.recommendations,
        moods: moods as Record<string, MoodId>,
      };

      const { addToHistory } = useMatchStore.getState();
      addToHistory(historyEntry);

      if (!USE_MOCK) {
        await addMatchToUserHistory(user.uid, historyEntry);
        if (!isSolo && currentGroup) {
          await Promise.all(
            members.filter(uid => uid !== user.uid).map(uid => addMatchToUserHistory(uid, historyEntry))
          );
        }
      }

      return matchId;

    } catch (e) {
      setError(String(e));
      return null;
    }
  }, [user, currentGroup, moods, isLeader, isSolo]);

  return { runMatch, error, isLeader };
}
