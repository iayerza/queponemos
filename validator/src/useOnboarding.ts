import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { fetchOnboardingPool, type NormalizedTitle } from './tmdb';

export type Rating   = 'loved' | 'liked' | 'seen_disliked' | 'not_seen';
export type AgeRange = 'young' | 'mid' | 'adult' | 'senior';

export interface AnchorInfo { idx: number; title: string; }

export interface OnboardingState {
  titles:          NormalizedTitle[];
  currentIndex:    number;
  ratings:         Record<number, Rating>;
  isLoading:       boolean;
  error:           string | null;
  rate:            (r: Rating) => void;
  canSkip:         boolean;
  isFinished:      boolean;
  genreStepDone:   boolean;
  confirmGenres:   (genres: string[]) => void;
  liveProfile:     Record<string, number>;
  anchorPositions: AnchorInfo[];
}

const RATING_WEIGHTS: Record<Rating, number> = {
  loved: 2.0, liked: 1.0, seen_disliked: -0.8, not_seen: 0,
};

export function computeLocalProfile(
  ratings: Record<number, Rating>,
  pool: NormalizedTitle[],
  seeds: string[] = [],
): Record<string, number> {
  const weightSum:    Record<string, number> = {};
  const occurrences:  Record<string, number> = {};

  for (const g of seeds) {
    weightSum[g]   = (weightSum[g]   ?? 0) + 0.8;
    occurrences[g] = (occurrences[g] ?? 0) + 1;
  }
  for (const [idStr, r] of Object.entries(ratings)) {
    const title = pool.find(t => t.tmdbId === Number(idStr) || t.id === Number(idStr));
    if (!title) continue;
    const w = RATING_WEIGHTS[r];
    for (const genre of title.genres) {
      weightSum[genre]   = (weightSum[genre]   ?? 0) + w;
      occurrences[genre] = (occurrences[genre] ?? 0) + 1;
    }
  }

  const mean: Record<string, number> = {};
  for (const g of Object.keys(weightSum)) {
    mean[g] = weightSum[g] / occurrences[g]; // conservar negativos
  }
  // Normalizar por el máximo positivo; los negativos quedan como penalización
  const maxPos = Math.max(...Object.values(mean).filter(v => v > 0), 0.001);
  return Object.fromEntries(Object.entries(mean).map(([g, v]) => [g, v / maxPos]));
}

function scoreTitle(t: NormalizedTitle, profile: Record<string, number>): number {
  return t.genres.reduce((s, g) => s + (profile[g] ?? 0), 0);
}

// Evidencia por género: cuántas cartas se respondieron y cuántas fueron vistas
export interface GenreEvidence {
  answered: Record<string, number>; // cartas respondidas que cubren el género
  seen:     Record<string, number>; // de esas, cuántas el usuario vio (loved/liked/disliked)
}

export function computeGenreEvidence(
  ratings: Record<number, Rating>,
  pool: NormalizedTitle[],
): GenreEvidence {
  const answered: Record<string, number> = {};
  const seen:     Record<string, number> = {};
  for (const [idStr, r] of Object.entries(ratings)) {
    const title = pool.find(t => t.tmdbId === Number(idStr) || t.id === Number(idStr));
    if (!title) continue;
    for (const g of title.genres) {
      answered[g] = (answered[g] ?? 0) + 1;
      if (r !== 'not_seen') seen[g] = (seen[g] ?? 0) + 1;
    }
  }
  return { answered, seen };
}

// Incertidumbre: cuánto aporta este título sobre géneros con poca evidencia
function infoScore(t: NormalizedTitle, answered: Record<string, number>): number {
  return t.genres.reduce((s, g) => s + 1 / (1 + (answered[g] ?? 0)), 0);
}

// Género frío: 2+ "no la vi" y ninguna vista → dejar de gastar cartas ahí
function coldGenres(ev: GenreEvidence): Set<string> {
  const cold = new Set<string>();
  for (const g of Object.keys(ev.answered)) {
    const notSeen = ev.answered[g] - (ev.seen[g] ?? 0);
    if (notSeen >= 2 && (ev.seen[g] ?? 0) === 0) cold.add(g);
  }
  return cold;
}

// Intercala 2 cartas de mejor match : 1 carta de sondeo dirigido (la que más
// reduce incertidumbre). Al final: géneros fríos, y últimos los penalizados.
function sortAdaptive(
  remaining: NormalizedTitle[],
  profile: Record<string, number>,
  ev: GenreEvidence,
): NormalizedTitle[] {
  const cold    = coldGenres(ev);
  const scored  = remaining.map(t => ({ t, score: scoreTitle(t, profile), info: infoScore(t, ev.answered) }));
  const penalty = scored.filter(s => s.score < 0).sort((a, b) => b.score - a.score).map(s => s.t);
  // Frío sin evidencia positiva: el usuario no conoce ese género, no insistir
  const demoted = scored.filter(s => s.score >= 0 && s.score <= 0.001 && s.t.genres.some(g => cold.has(g))).map(s => s.t);
  const demotedIds = new Set(demoted.map(t => t.tmdbId));
  const active  = scored.filter(s => s.score >= 0 && !demotedIds.has(s.t.tmdbId));

  const byMatch = [...active].sort((a, b) => b.score - a.score);
  const byInfo  = [...active].sort((a, b) => b.info - a.info);

  const used = new Set<number>();
  const result: NormalizedTitle[] = [];
  let m = 0, i = 0;
  while (result.length < active.length) {
    for (let k = 0; k < 2; k++) {
      while (m < byMatch.length && used.has(byMatch[m].t.tmdbId)) m++;
      if (m < byMatch.length) { used.add(byMatch[m].t.tmdbId); result.push(byMatch[m].t); }
    }
    while (i < byInfo.length && used.has(byInfo[i].t.tmdbId)) i++;
    if (i < byInfo.length) { used.add(byInfo[i].t.tmdbId); result.push(byInfo[i].t); }
    if (m >= byMatch.length && i >= byInfo.length) break;
  }
  return [...result, ...demoted, ...penalty];
}

export function useOnboarding(ageRange: AgeRange): OnboardingState {
  const [pool, setPool]       = useState<NormalizedTitle[]>([]);
  const [queue, setQueue]     = useState<NormalizedTitle[]>([]);
  const [currentIndex, setIdx] = useState(0);
  const [ratings, setRatings] = useState<Record<number, Rating>>({});
  const [isLoading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [genreStepDone, setGenreStepDone] = useState(false);

  const ratingsRef    = useRef(ratings);
  ratingsRef.current  = ratings;
  const poolRef       = useRef(pool);
  poolRef.current     = pool;
  const genreSeedsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!genreStepDone) return;
    let cancelled = false;
    setLoading(true);
    setIdx(0);
    setRatings({});

    fetchOnboardingPool(ageRange, genreSeedsRef.current)
      .then(fetched => {
        if (cancelled) return;
        if (fetched.length === 0) {
          setError('TMDB devolvió 0 títulos. Revisá la API key y la conexión de red.');
          setLoading(false);
          return;
        }
        if (genreSeedsRef.current.length > 0) {
          const selectedSet = new Set(genreSeedsRef.current);
          // Anchors always pass — they're calibration points regardless of genre
          const genreFiltered = fetched.filter(t => t.isAnchor || t.genres.some(g => selectedSet.has(g)));
          if (genreFiltered.length >= 15) fetched = genreFiltered;
        }
        setPool(fetched);
        poolRef.current = fetched;
        if (genreSeedsRef.current.length > 0) {
          const profile = computeLocalProfile({}, fetched, genreSeedsRef.current);
          setQueue(sortAdaptive(fetched, profile, { answered: {}, seen: {} }));
        } else {
          setQueue(fetched);
        }
        setLoading(false);
      })
      .catch(e => {
        if (!cancelled) { setError(String(e)); setLoading(false); }
      });

    return () => { cancelled = true; };
  }, [genreStepDone, ageRange]);

  const confirmGenres = useCallback((genres: string[]) => {
    genreSeedsRef.current = genres;
    setLoading(true);
    setGenreStepDone(true);
  }, []);

  const rate = useCallback((rating: Rating) => {
    const title = queue[currentIndex];
    if (!title) return;
    const newRatings = { ...ratingsRef.current, [title.tmdbId]: rating };
    setRatings(newRatings);

    const next = currentIndex + 1;
    const SEED = 3;
    // Reordenar después de cada carta a partir de la 3: máxima reactividad
    if (next >= SEED && next < queue.length) {
      const shown     = queue.slice(0, next);
      const remaining = queue.slice(next);
      const profile   = computeLocalProfile(newRatings, poolRef.current, genreSeedsRef.current);
      const ev        = computeGenreEvidence(newRatings, poolRef.current);
      setQueue([...shown, ...sortAdaptive(remaining, profile, ev)]);
    }
    setTimeout(() => setIdx(next), 250);
  }, [queue, currentIndex]);

  const liveProfile = useMemo(() =>
    computeLocalProfile(ratings, pool, genreSeedsRef.current),
    [ratings, pool],
  );

  const anchorPositions = useMemo<AnchorInfo[]>(() =>
    queue
      .map((t, idx) => t.isAnchor ? { idx, title: t.title } : null)
      .filter((x): x is AnchorInfo => x !== null),
    [queue],
  );

  return {
    titles: queue, currentIndex, ratings, isLoading, error,
    rate, canSkip: currentIndex >= 12,
    isFinished: queue.length > 0 && currentIndex >= queue.length,
    genreStepDone, confirmGenres, liveProfile, anchorPositions,
  };
}
