import { useState, useEffect, useCallback, useRef } from 'react';
import { MOCK_TITLES } from '../constants/mockTitles';
import { discoverByGenre, fetchAnchorTitles, type NormalizedTitle } from '../services/tmdb';
import { useAuthStore } from '../store/useAuthStore';
import type { Rating } from '../services/firebase';
import type { AgeRange } from '../navigation/types';

export interface OnboardingState {
  titles: NormalizedTitle[];
  currentIndex: number;
  ratings: Record<number, Rating>;
  isLoading: boolean;
  error: string | null;
  rate: (rating: Rating) => void;
  canSkip: boolean;
  isFinished: boolean;
  genreStepDone: boolean;
  confirmGenres: (genres: string[]) => void;
}

// ─── Genre probes por rango de edad ──────────────────────────────────────────

interface Probe { genreId: number; type: 'movie' | 'tv'; label: string }

// Genres excluded from explore bucket unless explicitly chosen by the user
const NICHE_GENRES = new Set([
  'Animación', 'Documental', 'Docuserie', 'Infantil',
  'Noticias', 'Reality', 'Telenovela', 'Talk', 'Familia',
]);

const ALL_PROBES: Record<AgeRange | 'default', Probe[]> = {
  young: [
    { genreId: 28,    type: 'movie', label: 'Acción'          },
    { genreId: 35,    type: 'movie', label: 'Comedia'         },
    { genreId: 10749, type: 'movie', label: 'Romance'         },
    { genreId: 27,    type: 'movie', label: 'Terror'          },
    { genreId: 878,   type: 'movie', label: 'Ciencia Ficción' },
    { genreId: 14,    type: 'movie', label: 'Fantasía'        },
    { genreId: 53,    type: 'movie', label: 'Thriller'        },
    { genreId: 16,    type: 'movie', label: 'Animación'       },
    { genreId: 35,    type: 'tv',    label: 'Comedia TV'      },
    { genreId: 10765, type: 'tv',    label: 'Sci-Fi TV'       },
    { genreId: 18,    type: 'tv',    label: 'Drama TV'        },
    { genreId: 10759, type: 'tv',    label: 'Acción TV'       },
  ],
  mid: [
    { genreId: 28,    type: 'movie', label: 'Acción'          },
    { genreId: 35,    type: 'movie', label: 'Comedia'         },
    { genreId: 10749, type: 'movie', label: 'Romance'         },
    { genreId: 27,    type: 'movie', label: 'Terror'          },
    { genreId: 878,   type: 'movie', label: 'Ciencia Ficción' },
    { genreId: 80,    type: 'movie', label: 'Crimen'          },
    { genreId: 53,    type: 'movie', label: 'Thriller'        },
    { genreId: 99,    type: 'movie', label: 'Documental'      },
    { genreId: 16,    type: 'movie', label: 'Animación'       },
    { genreId: 35,    type: 'tv',    label: 'Comedia TV'      },
    { genreId: 80,    type: 'tv',    label: 'Crimen TV'       },
    { genreId: 99,    type: 'tv',    label: 'Docuserie'       },
  ],
  adult: [
    { genreId: 28,    type: 'movie', label: 'Acción'          },
    { genreId: 53,    type: 'movie', label: 'Thriller'        },
    { genreId: 80,    type: 'movie', label: 'Crimen'          },
    { genreId: 18,    type: 'movie', label: 'Drama'           },
    { genreId: 35,    type: 'movie', label: 'Comedia'         },
    { genreId: 10749, type: 'movie', label: 'Romance'         },
    { genreId: 878,   type: 'movie', label: 'Ciencia Ficción' },
    { genreId: 27,    type: 'movie', label: 'Terror'          },
    { genreId: 36,    type: 'movie', label: 'Historia'        },
    { genreId: 12,    type: 'movie', label: 'Aventura'        },
    { genreId: 99,    type: 'movie', label: 'Documental'      },
    { genreId: 16,    type: 'movie', label: 'Animación'       },
    { genreId: 18,    type: 'tv',    label: 'Drama TV'        },
    { genreId: 80,    type: 'tv',    label: 'Crimen TV'       },
    { genreId: 99,    type: 'tv',    label: 'Docuserie'       },
  ],
  senior: [
    { genreId: 18,    type: 'movie', label: 'Drama'           },
    { genreId: 35,    type: 'movie', label: 'Comedia'         },
    { genreId: 10749, type: 'movie', label: 'Romance'         },
    { genreId: 36,    type: 'movie', label: 'Historia'        },
    { genreId: 53,    type: 'movie', label: 'Thriller'        },
    { genreId: 80,    type: 'movie', label: 'Crimen'          },
    { genreId: 12,    type: 'movie', label: 'Aventura'        },
    { genreId: 99,    type: 'movie', label: 'Documental'      },
    { genreId: 18,    type: 'tv',    label: 'Drama TV'        },
    { genreId: 35,    type: 'tv',    label: 'Comedia TV'      },
    { genreId: 80,    type: 'tv',    label: 'Crimen TV'       },
    { genreId: 99,    type: 'tv',    label: 'Docuserie'       },
  ],
  default: [
    { genreId: 28,    type: 'movie', label: 'Acción'          },
    { genreId: 35,    type: 'movie', label: 'Comedia'         },
    { genreId: 10749, type: 'movie', label: 'Romance'         },
    { genreId: 53,    type: 'movie', label: 'Thriller'        },
    { genreId: 80,    type: 'movie', label: 'Crimen'          },
    { genreId: 27,    type: 'movie', label: 'Terror'          },
    { genreId: 878,   type: 'movie', label: 'Ciencia Ficción' },
    { genreId: 18,    type: 'movie', label: 'Drama'           },
    { genreId: 99,    type: 'movie', label: 'Documental'      },
    { genreId: 16,    type: 'movie', label: 'Animación'       },
    { genreId: 35,    type: 'tv',    label: 'Comedia TV'      },
    { genreId: 99,    type: 'tv',    label: 'Docuserie'       },
  ],
};

// MIN_YEAR filters genre probes — keeps results era-appropriate for the user.
const MIN_YEAR: Record<AgeRange | 'default', number> = {
  young:   new Date().getFullYear() - 10,
  mid:     new Date().getFullYear() - 18,
  adult:   new Date().getFullYear() - 30,
  senior:  new Date().getFullYear() - 45,
  default: new Date().getFullYear() - 15,
};

// ANCHOR_MIN_YEAR is wider: allows classics the user saw in their youth.
// Adults (43yo) definitely watched Forrest Gump, Pulp Fiction, The Matrix.
const ANCHOR_MIN_YEAR: Record<AgeRange | 'default', number> = {
  young:   new Date().getFullYear() - 15,
  mid:     new Date().getFullYear() - 25,
  adult:   1990,
  senior:  1980,
  default: new Date().getFullYear() - 20,
};

const hasTmdbKey = Boolean(process.env.EXPO_PUBLIC_TMDB_API_KEY);

const RATING_WEIGHTS: Record<Rating, number> = {
  loved: 2.0, liked: 1.0, seen_disliked: -0.8, not_seen: 0,
};

// Build the active probe list from genre selection.
// Only fetches genres the user chose + up to 2 explore probes.
// Niche genres are excluded from explore unless explicitly selected.
function buildActiveProbes(all: Probe[], selectedGenres: string[]): Probe[] {
  const selected = new Set(selectedGenres);
  const baseLabel = (p: Probe) => p.label.replace(' TV', '');
  const isSelected = (p: Probe) => selected.has(baseLabel(p));

  const primary = all.filter(isSelected);

  if (primary.length === 0) {
    // Skipped genre step — use 8 mainstream probes, no niche
    return all.filter(p => !NICHE_GENRES.has(baseLabel(p))).slice(0, 8);
  }

  // Add up to 2 explore probes from unselected, non-niche genres
  const explore = all
    .filter(p => !isSelected(p) && !NICHE_GENRES.has(baseLabel(p)))
    .slice(0, 2);

  return [...primary, ...explore];
}

// Genre seeds give the profile an initial signal even before any title ratings.
function computeLocalProfile(
  ratings: Record<number, Rating>,
  pool: NormalizedTitle[],
  seeds: string[] = [],
): Record<string, number> {
  const raw: Record<string, number> = {};

  for (const g of seeds) raw[g] = (raw[g] ?? 0) + 0.8;

  for (const [idStr, r] of Object.entries(ratings)) {
    const title = pool.find(t => t.tmdbId === Number(idStr) || t.id === Number(idStr));
    if (!title) continue;
    const w = RATING_WEIGHTS[r];
    for (const genre of title.genres) {
      raw[genre] = (raw[genre] ?? 0) + w;
    }
  }

  const max = Math.max(...Object.values(raw).filter(v => v > 0), 0.001);
  return Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v > 0).map(([g, v]) => [g, v / max])
  );
}

function scoreTitle(t: NormalizedTitle, profile: Record<string, number>): number {
  return t.genres.reduce((s, g) => s + (profile[g] ?? 0), 0);
}

function sortAdaptive(remaining: NormalizedTitle[], profile: Record<string, number>): NormalizedTitle[] {
  const scored = remaining.map(t => ({ t, score: scoreTitle(t, profile) }));
  const cut = Math.ceil(scored.length * 0.65);
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const exploit = sorted.slice(0, cut).map(s => s.t);
  const explore  = sorted.slice(cut).map(s => s.t).sort(() => Math.random() - 0.5);
  const result: NormalizedTitle[] = [];
  let e = 0, x = 0;
  while (result.length < remaining.length) {
    if (e < exploit.length) result.push(exploit[e++]);
    if (result.length < remaining.length && e < exploit.length) result.push(exploit[e++]);
    if (result.length < remaining.length && x < explore.length)  result.push(explore[x++]);
  }
  return result;
}

function buildMockPool(selectedGenres: string[]): NormalizedTitle[] {
  const valid = MOCK_TITLES.filter(t => t.year > 0 && t.posterPath) as NormalizedTitle[];
  if (selectedGenres.length === 0) return valid.filter(t => !NICHE_GENRES.has(t.genres[0] ?? ''));
  const selected = new Set(selectedGenres);
  return valid.filter(t => t.genres.some(g => selected.has(g)) || Math.random() < 0.25);
}

export function useOnboarding(ageRange?: AgeRange, skipGenreStep = false): OnboardingState {
  const [pool, setPool]          = useState<NormalizedTitle[]>([]);
  const [queue, setQueue]        = useState<NormalizedTitle[]>([]);
  const [currentIndex, setIndex] = useState(0);
  const [ratings, setRatings]    = useState<Record<number, Rating>>({});
  // isLoading starts true only when skipGenreStep (fetch begins on mount)
  const [isLoading, setLoading]  = useState(skipGenreStep);
  const [error, setError]        = useState<string | null>(null);
  const [genreStepDone, setGenreStepDone] = useState(skipGenreStep);
  const { user }                 = useAuthStore();

  const ratingsRef    = useRef(ratings);
  ratingsRef.current  = ratings;
  const poolRef       = useRef(pool);
  poolRef.current     = pool;
  const genreSeedsRef = useRef<string[]>([]);
  const activeProbesRef = useRef<Probe[]>(
    skipGenreStep ? buildActiveProbes(ALL_PROBES[ageRange ?? 'default'], []) : []
  );
  const expandedProbes = useRef(new Set<string>());

  const minYear       = MIN_YEAR[ageRange ?? 'default'];
  const anchorMinYear = ANCHOR_MIN_YEAR[ageRange ?? 'default'];

  // Fetch titles — deferred until genre step is confirmed (or on mount if skipGenreStep)
  useEffect(() => {
    if (!genreStepDone) return;

    let cancelled = false;
    setLoading(true);
    setIndex(0);
    setRatings({});
    expandedProbes.current.clear();

    const activeProbes = activeProbesRef.current;

    if (!hasTmdbKey) {
      const mockPool = buildMockPool(genreSeedsRef.current);
      const seeds = genreSeedsRef.current;
      setPool(mockPool);
      if (seeds.length > 0) {
        const profile = computeLocalProfile({}, mockPool, seeds);
        setQueue(sortAdaptive(mockPool, profile));
      } else {
        setQueue(mockPool);
      }
      setLoading(false);
      return () => { cancelled = true; };
    }

    // Fetch universal anchors (no genre filter, highest vote_count) + genre probes in parallel.
    // Anchors go first: they are the movies everyone has seen, so they get rated immediately
    // and bootstrap the taste profile before genre-specific titles appear.
    Promise.allSettled([
      fetchAnchorTitles(anchorMinYear),
      ...activeProbes.map(p => discoverByGenre(p.type, p.genreId, minYear)),
    ]).then(results => {
      if (cancelled) return;

      const seenIds = new Set<number>();
      const anchors: NormalizedTitle[] = [];
      const seedTitles: NormalizedTitle[] = [];
      const restTitles: NormalizedTitle[] = [];

      // First result is anchors
      const [anchorResult, ...probeResults] = results;
      if (anchorResult.status === 'fulfilled') {
        for (const t of anchorResult.value) {
          if (!seenIds.has(t.tmdbId)) { seenIds.add(t.tmdbId); anchors.push(t); }
        }
      }

      probeResults.forEach(r => {
        if (r.status === 'rejected' || r.value.length === 0) return;
        const [first, ...others] = r.value;
        if (!seenIds.has(first.tmdbId)) { seenIds.add(first.tmdbId); seedTitles.push(first); }
        others.forEach(t => {
          if (!seenIds.has(t.tmdbId)) { seenIds.add(t.tmdbId); restTitles.push(t); }
        });
      });

      // Anchors first, then genre probes seeds (diverse interleave), then rest
      const ordered = [...anchors, ...seedTitles, ...restTitles];
      setPool(ordered);

      const seeds = genreSeedsRef.current;
      if (seeds.length > 0) {
        const profile = computeLocalProfile({}, ordered, seeds);
        // Keep anchors pinned at front; only reorder genre-specific tail
        const anchorCount = anchors.length;
        const reordered = [
          ...ordered.slice(0, anchorCount),
          ...sortAdaptive(ordered.slice(anchorCount), profile),
        ];
        setQueue(reordered);
      } else {
        setQueue(ordered);
      }
      setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });

    if (user?.ratings) setRatings(user.ratings as Record<number, Rating>);

    return () => { cancelled = true; };
  }, [genreStepDone, ageRange]);

  async function expandPoolForRatedGenres(
    newRatings: Record<number, Rating>,
    currentPool: NormalizedTitle[],
  ) {
    if (!hasTmdbKey) return;
    const profile = computeLocalProfile(newRatings, currentPool, genreSeedsRef.current);
    const topGenres = new Set(Object.entries(profile).filter(([, s]) => s > 0.6).map(([g]) => g));
    if (topGenres.size === 0) return;

    const activeProbes = activeProbesRef.current;
    const probesToExpand = activeProbes.filter(p => {
      const key = `${p.type}-${p.genreId}`;
      if (expandedProbes.current.has(key)) return false;
      return topGenres.has(p.label.replace(' TV', ''));
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
      r.value.forEach(t => { if (!seenIds.has(t.tmdbId)) { seenIds.add(t.tmdbId); newTitles.push(t); } });
    });

    if (newTitles.length === 0) return;

    setPool(prev => { const u = [...prev, ...newTitles]; poolRef.current = u; return u; });
    setQueue(prev => {
      const shown = prev.slice(0, currentIndex + 1);
      const remaining = prev.slice(currentIndex + 1);
      const p = computeLocalProfile(newRatings, [...prev, ...newTitles], genreSeedsRef.current);
      return [...shown, ...sortAdaptive([...remaining, ...newTitles], p)];
    });
  }

  const confirmGenres = useCallback((genres: string[]) => {
    genreSeedsRef.current = genres;
    activeProbesRef.current = buildActiveProbes(ALL_PROBES[ageRange ?? 'default'], genres);
    setGenreStepDone(true);
  }, [ageRange]);

  const rate = useCallback((rating: Rating) => {
    const currentRatings = ratingsRef.current;
    const title = queue[currentIndex];
    if (!title) return;

    const newRatings = { ...currentRatings, [title.tmdbId]: rating };
    setRatings(newRatings);

    const nextIndex = currentIndex + 1;
    const SEED_SIZE = activeProbesRef.current.length;
    const shouldReorder =
      nextIndex === SEED_SIZE ||
      (nextIndex > SEED_SIZE && (nextIndex - SEED_SIZE) % 4 === 0);

    if (shouldReorder && nextIndex < queue.length) {
      const shown = queue.slice(0, nextIndex);
      const remaining = queue.slice(nextIndex);
      const profile = computeLocalProfile(newRatings, poolRef.current, genreSeedsRef.current);
      setQueue([...shown, ...sortAdaptive(remaining, profile)]);
      expandPoolForRatedGenres(newRatings, poolRef.current);
    }

    setTimeout(() => setIndex(nextIndex), 300);
  }, [queue, currentIndex, minYear]);

  return {
    titles: queue,
    currentIndex,
    ratings,
    isLoading,
    error,
    rate,
    canSkip: currentIndex >= 8,
    isFinished: queue.length > 0 && currentIndex >= queue.length,
    genreStepDone,
    confirmGenres,
  };
}
