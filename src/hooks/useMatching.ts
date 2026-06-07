import { useState, useCallback, useRef, useEffect } from 'react';
import { runMatching, mockMatching, type MatchingOutput } from '../services/claude';
import {
  saveMatchAndBroadcast, pollForMatchId, getMatchById,
  getUserProfile, addMatchToUserHistory, getGroupById, incrementGroupTurn,
} from '../services/firebase';
import { useAuthStore }  from '../store/useAuthStore';
import { useGroupStore } from '../store/useGroupStore';
import { useMatchStore } from '../store/useMatchStore';
import type { MoodId }   from '../services/claude';
import type { UserProfile } from '../services/firebase';

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'true';

export function useMatching() {
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { user }                                      = useAuthStore();
  const { currentGroup }                              = useGroupStore();
  const { moods, setCurrentMatch, isSolo, history }   = useMatchStore();

  // Cancel any in-progress poll when the component unmounts.
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // Build tmdbId → "Title (year)" map from local history for better Claude prompts.
  const titleMap: Record<number, string> = {};
  for (const entry of history) {
    for (const rec of entry.recommendations) {
      if (rec.tmdbId) titleMap[rec.tmdbId] = `${rec.title} (${rec.year})`;
    }
  }

  // Dynamic leader: whoever called startGroupSession sets leaderUid.
  // Fallback to createdBy for sessions started before this field existed.
  const leaderUid = currentGroup?.currentSession?.leaderUid ?? currentGroup?.createdBy;
  const isLeader = isSolo || !currentGroup || user?.uid === leaderUid;

  const runMatch = useCallback(async (): Promise<string | null> => {
    if (!user) return null;
    if (!isSolo && !currentGroup) return null;
    setError(null);

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    try {
      // ── Follower path: wait for leader to produce a matchId ────────────────
      if (!isLeader && !USE_MOCK && currentGroup) {
        // Re-read fresh group to confirm leader (may have changed since mount)
        const freshGroup = await getGroupById(currentGroup.id);
        const freshLeaderUid = freshGroup?.currentSession?.leaderUid ?? freshGroup?.createdBy;
        if (user.uid === freshLeaderUid) {
          // We are actually the leader now — fall through to leader path
        } else {
          const matchId = await pollForMatchId(currentGroup.id, signal);
          if (!matchId) throw new Error('El tiempo de espera agotó. Intentá de nuevo.');

          const match = await getMatchById(matchId);
          if (!match) throw new Error('No se encontró el resultado.');

          setCurrentMatch(
            { recommendations: match.recommendations, groupInsight: match.groupInsight ?? '' },
            matchId,
          );

          // Each follower writes only their own history entry
          const followerEntry = {
            matchId,
            groupId: currentGroup.id,
            groupName: currentGroup.name,
            createdAt: Date.now(),
            recommendations: match.recommendations,
            moods: moods as Record<string, MoodId>,
          };
          const { addToHistory } = useMatchStore.getState();
          addToHistory(followerEntry);
          addMatchToUserHistory(user.uid, followerEntry).catch(() => {});

          return matchId;
        }
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
          titleMap:  Object.keys(titleMap).length > 0 ? titleMap : undefined,
        });
      }

      let matchId = `local-${Date.now()}`;

      if (!USE_MOCK) {
        if (isSolo) {
          matchId = `solo-${Date.now()}`;
        } else if (currentGroup) {
          matchId = await saveMatchAndBroadcast(
            currentGroup.id,
            members,
            output.recommendations,
            moods as Record<string, MoodId>,
            output.groupInsight,
          );
          // Advance the rotating leader turn after the match is committed.
          incrementGroupTurn(currentGroup.id).catch(() => {});
        }
      }

      setCurrentMatch(output, matchId);

      // Leader writes only their own history entry
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
        addMatchToUserHistory(user.uid, historyEntry).catch(() => {});
      }

      return matchId;

    } catch (e) {
      console.error('[useMatching] runMatch error:', e);
      setError(String(e));
      return null;
    }
  }, [user, currentGroup, moods, isLeader, isSolo]);

  return { runMatch, error, isLeader };
}
