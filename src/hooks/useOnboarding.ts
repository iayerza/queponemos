import { useState, useEffect, useCallback, useRef } from 'react';
import { MOCK_TITLES } from '../constants/mockTitles';
import { discoverByGenre, type NormalizedTitle } from '../services/tmdb';
import { useAuthStore } from '../store/useAuthStore';
import type { Rating } from '../services/firebase';
import type { AgeRange } from '../navigation/types';
import { CATALOG_IDF } from '../utils/tasteProfile';

export interface OnboardingState {
  titles: NormalizedTitle[];
  currentIndex: number;
  ratings: Record<number, Rating>;
  isLoading: boolean;
  error: string | null;
  rate: (rating: Rating) => void;
  canSkip: boolean;
  isFinished: boolean;
}

// ─── Genre probes por rango de edad ──────────────────────────────────────────
// Cada probe define qué género explorar (TMDB genre ID + tipo).
// El onboarding empieza mostrando el #1 de cada probe, luego adapta.

interface Probe { genreId: number; type: 'movie' | 'tv'; label: string }

const PROBES: Record<AgeRange | 'default', Probe[]> = {
  young: [
    { genreId: 35,    type: 'movie', label: 'Comedia'         },
    { genreId: 10749, type: 'movie', label: 'Romance'         },
    { genreId: 28,    type: 'movie', label: 'Acción'          },
    { genreId: 27,    type: 'movie', label: 'Terror'          },
    { genreId: 878,   type: 'movie', label: 'Ciencia Ficción' },
    { genreId: 16,    type: 'movie', label: 'Animación'       },
    { genreId: 14,    type: 'movie', label: 'Fantasía'        },
    { genreId: 53,    type: 'movie', label: 'Thriller'        },
    { genreId: 35,    type: 'tv',    label: 'Comedia TV'      },
    { genreId: 10765, type: 'tv',    label: 'Sci-Fi TV'       },
    { genreId: 18,    type: 'tv',    label: 'Drama TV'        },
    { genreId: 10759, type: 'tv',    label: 'Acción TV'       },
  ],
  mid: [
    { genreId: 35,    type: 'movie', label: 'Comedia'         },
    { genreId: 10749, type: 'movie', label: 'Romance'         },
    { genreId: 28,    type: 'movie', label: 'Acción'          },
    { genreId: 27,    type: 'movie', label: 'Terror'          },
    { genreId: 878,   type: 'movie', label: 'Ciencia Ficción' },
    { genreId: 16,    type: 'movie', label: 'Animación'       },
    { genreId: 80,    type: 'movie', label: 'Crimen'          },
    { genreId: 99,    type: 'movie', label: 'Documental'      },
    { genreId: 53,    type: 'movie', label: 'Thriller'        },
    { genreId: 35,    type: 'tv',    label: 'Comedia TV'      },
    { genreId: 80,    type: 'tv',    label: 'Crimen TV'       },
    { genreId: 99,    type: 'tv',    label: 'Docuserie'       },
  ],
  adult: [
    { genreId: 35,    type: 'movie', label: 'Comedia'         },
    { genreId: 10749, type: 'movie', label: 'Romance'         },
    { genreId: 28,    type: 'movie', label: 'Acción'          },
    { genreId: 27,    type: 'movie', label: 'Terror'          },
    { genreId: 878,   type: 'movie', label: 'Ciencia Ficción' },
    { genreId: 80,    type: 'movie', label: 'Crimen'          },
    { genreId: 99,    type: 'movie', label: 'Documental'      },
    { genreId: 18,    type: 'movie', label: 'Drama'           },
    { genreId: 36,    type: 'movie', label: 'Historia'        },
    { genreId: 53,    type: 'movie', label: 'Thriller'        },
    { genreId: 99,    type: 'tv',    label: 'Docuserie'       },
    { genreId: 18,    type: 'tv',    label: 'Drama TV'        },
  ],
  senior: [
    { genreId: 35,    type: 'movie', label: 'Comedia'         },
    { genreId: 10749, type: 'movie', label: 'Romance'         },
    { genreId: 18,    type: 'movie', label: 'Drama'           },
    { genreId: 36,    type: 'movie', label: 'Historia'        },
    { genreId: 99,    type: 'movie', label: 'Documental'      },
    { genreId: 53,    type: 'movie', label: 'Thriller'        },
    { genreId: 80,    type: 'movie', label: 'Crimen'          },
    { genreId: 10751, type: 'movie', label: 'Familia'         },
    { genreId: 99,    type: 'tv',    label: 'Docuserie'       },
    { genreId: 18,    type: 'tv',    label: 'Drama TV'        },
    { genreId: 35,    type: 'tv',    label: 'Comedia TV'      },
    { genreId: 80,    type: 'tv',    label: 'Crimen TV'       },
  ],
  default: [
    { genreId: 35,    type: 'movie', label: 'Comedia'         },
    { genreId: 10749, type: 'movie', label: 'Romance'         },
    { genreId: 28,    type: 'movie', label: 'Acción'          },
    { genreId: 27,    type: 'movie', label: 'Terror'          },
    { genreId: 878,   type: 'movie', label: 'Ciencia Ficción' },
    { genreId: 16,    type: 'movie', label: 'Animación'       },
    { genreId: 80,    type: 'movie', label: 'Crimen'          },
    { genreId: 99,    type: 'movie', label: 'Documental'      },
    { genreId: 53,    type: 'movie', label: 'Thriller'        },
    { genreId: 18,    type: 'movie', label: 'Drama'           },
    { genreId: 35,    type: 'tv',    label: 'Comedia TV'      },
    { genreId: 99,    type: 'tv',    label: 'Docuserie'       },
  ],
};

const MIN_YEAR: Record<AgeRange | 'default', number> = {
  young: 2012, mid: 2005, adult: 1995, senior: 1975, default: 2005,
};

const hasTmdbKey = Boolean(process.env.EXPO_PUBLIC_TMDB_API_KEY);

const RATING_WEIGHTS: Record<Rating, number> = {
  loved: 2.0, liked: 1.0, seen_disliked: -0.8, not_seen: 0,
};

function computeLocalProfile(
  ratings: Record<number, Rating>,
  pool: NormalizedTitle[],
): Record<string, number> {
  const raw: Record<string, number> = {};
  for (const [idStr, r] of Object.entries(ratings)) {
    const title = pool.find(t => t.tmdbId === Number(idStr) || t.id === Number(idStr));
    if (!title) continue;
    const w = RATING_WEIGHTS[r];
    for (const genre of title.genres) {
      const idf = CATALOG_IDF[genre] ?? 1.0;
      raw[genre] = (raw[genre] ?? 0) + w * idf;
    }
  }
  const max = Math.max(...Object.values(raw).filter(v => v > 0), 0.001);
  return Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v > 0).map(([g, v]) => [g, v / max])
  );
}

function scoreForPool(t: NormalizedTitle, profile: Record<string, number>): number {
  return t.genres.reduce((s, g) => s + (profile[g] ?? 0), 0);
}

function sortAdaptive(
  remaining: NormalizedTitle[],
  profile: Record<string, number>,
): NormalizedTitle[] {
  const scored = remaining.map(t => ({ t, score: scoreForPool(t, profile) }));
  const cut = Math.ceil(scored.length * 0.65);
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const exploit = sorted.slice(0, cut).map(s => s.t);
  const explore = sorted.slice(cut).map(s => s.t).sort(() => Math.random() - 0.5);
  const result: NormalizedTitle[] = [];
  let e = 0, x = 0;
  while (result.length < remaining.length) {
    if (e < exploit.length) result.push(exploit[e++]);
    if (result.length < remaining.length && e < exploit.length) result.push(exploit[e++]);
    if (result.length < remaining.length && x < explore.length) result.push(explore[x++]);
  }
  return result;
}

// Fallback for mock mode: group MOCK_TITLES by primary genre, one per genre first
function buildMockPool(): { seed: NormalizedTitle[]; rest: NormalizedTitle[] } {
  const valid = MOCK_TITLES.filter(t => t.year > 0 && t.posterPath);
  const seenGenres = new Set<string>();
  const seed: NormalizedTitle[] = [];
  const rest: NormalizedTitle[] = [];
  for (const t of valid) {
    const primary = t.genres[0];
    if (primary && !seenGenres.has(`${primary}-${t.type}`)) {
      seenGenres.add(`${primary}-${t.type}`);
      seed.push(t);
    } else {
      rest.push(t);
    }
  }
  return { seed, rest };
}

export function useOnboarding(ageRange?: AgeRange): OnboardingState {
  const [pool, setPool]          = useState<NormalizedTitle[]>([]);
  const [queue, setQueue]        = useState<NormalizedTitle[]>([]);
  const [currentIndex, setIndex] = useState(0);
  const [ratings, setRatings]    = useState<Record<number, Rating>>({});
  const [isLoading, setLoading]  = useState(true);
  const [error, setError]        = useState<string | null>(null);
  const { user }                 = useAuthStore();
  const ratingsRef               = useRef(ratings);
  ratingsRef.current             = ratings;
  const poolRef                  = useRef(pool);
  poolRef.current                = pool;
  // Track which probes have been expanded to avoid duplicate fetches
  const expandedProbes           = useRef(new Set<string>());

  const probeList  = PROBES[ageRange ?? 'default'];
  const minYear    = MIN_YEAR[ageRange ?? 'default'];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setIndex(0);
    setRatings({});
    expandedProbes.current.clear();

    if (!hasTmdbKey) {
      if (!cancelled) {
        const { seed, rest } = buildMockPool();
        const ordered = [...seed, ...rest];
        setPool(ordered);
        setQueue(ordered);
        setLoading(false);
      }
      return () => { cancelled = true; };
    }

    // Fetch top 3 titles per probe in parallel
    Promise.allSettled(
      probeList.map(p => discoverByGenre(p.type, p.genreId, minYear))
    ).then(results => {
      if (cancelled) return;

      const seenIds = new Set<number>();
      const seedTitles: NormalizedTitle[] = [];
      const restTitles: NormalizedTitle[] = [];

      results.forEach((r, i) => {
        if (r.status === 'rejected' || r.value.length === 0) return;
        const [first, ...others] = r.value;
        if (!seenIds.has(first.tmdbId)) {
          seenIds.add(first.tmdbId);
          seedTitles.push(first);
        }
        others.forEach(t => {
          if (!seenIds.has(t.tmdbId)) {
            seenIds.add(t.tmdbId);
            restTitles.push(t);
          }
        });
      });

      const ordered = [...seedTitles, ...restTitles];
      setPool(ordered);
      setQueue(ordered);
      setLoading(false);
    });

    if (user?.ratings) setRatings(user.ratings as Record<number, Rating>);

    return () => { cancelled = true; };
  }, [ageRange]);

  // Expand pool for highly-rated genres (fetch page 2 from those probes)
  async function expandPoolForRatedGenres(
    newRatings: Record<number, Rating>,
    currentPool: NormalizedTitle[],
  ) {
    if (!hasTmdbKey) return;
    const profile = computeLocalProfile(newRatings, currentPool);
    const topGenres = new Set(
      Object.entries(profile).filter(([, s]) => s > 0.6).map(([g]) => g)
    );
    if (topGenres.size === 0) return;

    const probesToExpand = probeList.filter(p => {
      const key = `${p.type}-${p.genreId}`;
      if (expandedProbes.current.has(key)) return false;
      // Check if this probe's label genre overlaps with top genres
      const probeGenreLabel = p.label.replace(' TV', '');
      return topGenres.has(probeGenreLabel);
    });

    if (probesToExpand.length === 0) return;
    probesToExpand.forEach(p => expandedProbes.current.add(`${p.type}-${p.genreId}`));

    const results = await Promise.allSettled(
      probesToExpand.map(p => discoverByGenre(p.type, p.genreId, minYear, 2))
    );

    const seenIds = new Set(currentPool.map(t => t.tmdbId));
    const newTitles: NormalizedTitle[] = [];
    results.forEach(r => {
      if (r.status === 'rejected') return;
      r.value.forEach(t => {
        if (!seenIds.has(t.tmdbId)) {
          seenIds.add(t.tmdbId);
          newTitles.push(t);
        }
      });
    });

    if (newTitles.length === 0) return;

    setPool(prev => {
      const updated = [...prev, ...newTitles];
      poolRef.current = updated;
      return updated;
    });
    setQueue(prev => {
      const shownCount = currentIndex + 1;
      const shown = prev.slice(0, shownCount);
      const remaining = prev.slice(shownCount);
      const p = computeLocalProfile(newRatings, [...prev, ...newTitles]);
      return [...shown, ...sortAdaptive([...remaining, ...newTitles], p)];
    });
  }

  const rate = useCallback((rating: Rating) => {
    const currentRatings = ratingsRef.current;
    const title = queue[currentIndex];
    if (!title) return;

    const newRatings = { ...currentRatings, [title.tmdbId]: rating };
    setRatings(newRatings);

    const nextIndex = currentIndex + 1;
    const SEED_SIZE = probeList.length;
    const REORDER_EVERY = 5;

    const shouldReorder =
      nextIndex === SEED_SIZE ||
      (nextIndex > SEED_SIZE && (nextIndex - SEED_SIZE) % REORDER_EVERY === 0);

    if (shouldReorder && nextIndex < queue.length) {
      const shown = queue.slice(0, nextIndex);
      const remaining = queue.slice(nextIndex);
      const profile = computeLocalProfile(newRatings, poolRef.current);
      setQueue([...shown, ...sortAdaptive(remaining, profile)]);
      // Async: expand pool with more titles from top genres
      expandPoolForRatedGenres(newRatings, poolRef.current);
    }

    setTimeout(() => setIndex(nextIndex), 300);
  }, [queue, currentIndex, probeList.length, minYear]);

  return {
    titles: queue,
    currentIndex,
    ratings,
    isLoading,
    error,
    rate,
    canSkip: currentIndex >= 12,
    isFinished: queue.length > 0 && currentIndex >= queue.length,
  };
}
