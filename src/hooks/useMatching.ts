import { useState, useCallback } from 'react';
import { runMatching, mockMatching, type MatchingOutput } from '../services/claude';
import {
  saveMatch, setSessionMatchId, pollForMatchId, getMatchById,
  getUserProfile, addMatchToUserHistory, incrementGroupTurn, getGroupById,
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

  // Líder = quien inició la búsqueda (currentSession.leaderUid). Para la UI
  // usamos el valor del store; en runMatch lo re-confirmamos fresco de Firestore.
  // Fallback al creador para sesiones viejas sin leaderUid.
  const sessionLeader = currentGroup?.currentSession?.leaderUid;
  const isLeader = isSolo || !currentGroup ||
    (sessionLeader ? user?.uid === sessionLeader : user?.uid === currentGroup.createdBy);

  const runMatch = useCallback(async (): Promise<string | null> => {
    if (!user) return null;
    if (!isSolo && !currentGroup) return null;
    setError(null);

    // Re-confirmar el líder con el estado fresco de Firestore (el store puede
    // estar desactualizado). Esto decide quién llama a Claude y quién espera.
    let amLeader = isSolo || USE_MOCK;
    if (!isSolo && currentGroup) {
      if (USE_MOCK) {
        amLeader = true;
      } else {
        const fresh = await getGroupById(currentGroup.id);
        const leaderUid = fresh?.currentSession?.leaderUid;
        amLeader = leaderUid ? user.uid === leaderUid : user.uid === currentGroup.createdBy;
      }
    }

    try {
      // ── Follower path: wait for leader to produce a matchId ────────────────
      if (!amLeader && !USE_MOCK && currentGroup) {
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
          // allSettled: que el historial de un compañero falle (permisos/red)
          // NO debe tirar abajo el match ya creado del líder.
          await Promise.allSettled(
            members.filter(uid => uid !== user.uid).map(uid => addMatchToUserHistory(uid, historyEntry))
          );
        }
      }

      return matchId;

    } catch (e) {
      setError(String(e));
      return null;
    }
  }, [user, currentGroup, moods, isSolo]);

  return { runMatch, error, isLeader };
}
