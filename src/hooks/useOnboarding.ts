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
  genreStepDone: boolean;
  confirmGenres: (genres: string[]) => void;
}

// ─── Genre probes por rango de edad ──────────────────────────────────────────

interface Probe { genreId: number; type: 'movie' | 'tv'; label: string }

// Genres we always exclude from the explore bucket (too niche / not streaming-mainstream)
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

// Age-aware minimum year — shows content from the user's formative cinema years.
const MIN_YEAR: Record<AgeRange | 'default', number> = {
  young:   new Date().getFullYear() - 10,
  mid:     new Date().getFullYear() - 18,
  adult:   new Date().getFullYear() - 30,  // ~1996: Matrix, Gladiator, Dark Knight, etc.
  senior:  new Date().getFullYear() - 45,  // ~1981: Raiders, Die Hard, etc.
  default: new Date().getFullYear() - 15,
};

const hasTmdbKey = Boolean(process.env.EXPO_PUBLIC_TMDB_API_KEY);

const RATING_WEIGHTS: Record<Rating, number> = {
  loved: 2.0, liked: 1.0, seen_disliked: -0.8, not_seen: 0,
};

// Build the active probe list from genre selection.
// Only fetches from genres the user selected + up to 2 "explore" probes.
// Niche genres (Animation, Documentary, etc.) are excluded from explore unless explicitly chosen.
function buildActiveProbes(all: Probe[], selectedGenres: string[]): Probe[] {
  const selected = new Set(selectedGenres);

  // A probe matches if its base label (without " TV" suffix) was selected
  const baseLabel = (p: Probe) => p.label.replace(' TV', '');
  const isSelected = (p: Probe) => selected.has(baseLabel(p));

  const primary = all.filter(isSelected);

  if (primary.length === 0) {
    // User skipped genre step — use a curated mainstream default (no niche)
    return all.filter(p => !NICHE_GENRES.has(baseLabel(p))).slice(0, 8);
  }

  // Add up to 2 explore probes from unselected, non-niche genres (variety)
  const explore = all
    .filter(p => !isSelected(p) && !NICHE_GENRES.has(baseLabel(p)))
    .slice(0, 2);

  return [...primary, ...explore];
}

// Genre seeds act as a soft baseline so the profile has signal even with 0 title ratings.
function computeLocalProfile(
  ratings: Record<number, Rating>,
  pool: NormalizedTitle[],
  seeds: string[] = [],
): Record<string, number> {
  const raw: Record<string, number> = {};

  for (const g of seeds) {
    const idf = CATALOG_IDF[g] ?? 1.0;
    raw[g] = (raw[g] ?? 0) + 0.8 * idf;
  }
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

function buildMockPool(selectedGenres: string[]): { seed: NormalizedTitle[]; rest: NormalizedTitle[] } {
  const valid = MOCK_TITLES.filter(t => {
    if (!t.year || !t.posterPath) return false;
    if (selectedGenres.length === 0) return !NICHE_GENRES.has(t.genres[0] ?? '');
    // Include titles from selected genres + some explore
    return t.genres.some(g => selectedGenres.includes(g)) || Math.random() < 0.3;
  });
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

export function useOnboarding(ageRange?: AgeRange, skipGenreStep = false): OnboardingState {
  const [pool, setPool]          = useState<NormalizedTitle[]>([]);
  const [queue, setQueue]        = useState<NormalizedTitle[]>([]);
  const [currentIndex, setIndex] = useState(0);
  const [ratings, setRatings]    = useState<Record<number, Rating>>({});
  // isLoading starts true only when skipGenreStep=true (fetch starts on mount)
  const [isLoading, setLoading]  = useState(skipGenreStep);
  const [error, setError]        = useState<string | null>(null);
  const [genreStepDone, setGenreStepDone] = useState(skipGenreStep);
  const { user }                 = useAuthStore();
  const ratingsRef               = useRef(ratings);
  ratingsRef.current             = ratings;
  const poolRef                  = useRef(pool);
  poolRef.current                = pool;
  const genreSeedsRef            = useRef<string[]>([]);
  // Active probes computed when genres are confirmed
  const activeProbesRef          = useRef<Probe[]>(
    skipGenreStep ? buildActiveProbes(ALL_PROBES[ageRange ?? 'default'], []) : []
  );
  const expandedProbes           = useRef(new Set<string>());

  const minYear = MIN_YEAR[ageRange ?? 'default'];

  // Fetch titles — triggered once genre step is done (or on mount if skipGenreStep)
  useEffect(() => {
    if (!genreStepDone) return;

    let cancelled = false;
    setLoading(true);
    setIndex(0);
    setRatings({});
    expandedProbes.current.clear();

    const activeProbes = activeProbesRef.current;

    if (!hasTmdbKey) {
      if (!cancelled) {
        const { seed, rest } = buildMockPool(genreSeedsRef.current);
        const ordered = [...seed, ...rest];
        setPool(ordered);
        const profile = computeLocalProfile({}, ordered, genreSeedsRef.current);
        setQueue(genreSeedsRef.current.length > 0 ? sortAdaptive(ordered, profile) : ordered);
        setLoading(false);
      }
      return () => { cancelled = true; };
    }

    Promise.allSettled(
      activeProbes.map(p => discoverByGenre(p.type, p.genreId, minYear))
    ).then(results => {
      if (cancelled) return;

      const seenIds = new Set<number>();
      const seedTitles: NormalizedTitle[] = [];
      const restTitles: NormalizedTitle[] = [];

      results.forEach(r => {
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
      // Sort by genre seeds from the start
      const seeds = genreSeedsRef.current;
      if (seeds.length > 0) {
        const profile = computeLocalProfile({}, ordered, seeds);
        setQueue(sortAdaptive(ordered, profile));
      } else {
        setQueue(ordered);
      }
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });

    if (user?.ratings) setRatings(user.ratings as Record<number, Rating>);

    return () => { cancelled = true; };
  }, [genreStepDone, ageRange]);

  // Expand pool for highly-rated genres (fetch page 2 from those probes)
  async function expandPoolForRatedGenres(
    newRatings: Record<number, Rating>,
    currentPool: NormalizedTitle[],
  ) {
    if (!hasTmdbKey) return;
    const profile = computeLocalProfile(newRatings, currentPool, genreSeedsRef.current);
    const topGenres = new Set(
      Object.entries(profile).filter(([, s]) => s > 0.6).map(([g]) => g)
    );
    if (topGenres.size === 0) return;

    const activeProbes = activeProbesRef.current;
    const probesToExpand = activeProbes.filter(p => {
      const key = `${p.type}-${p.genreId}`;
      if (expandedProbes.current.has(key)) return false;
      const base = p.label.replace(' TV', '');
      return topGenres.has(base);
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
      const p = computeLocalProfile(newRatings, [...prev, ...newTitles], genreSeedsRef.current);
      return [...shown, ...sortAdaptive([...remaining, ...newTitles], p)];
    });
  }

  // Called when the user confirms their genre preferences.
  // Computes the filtered probe list and triggers the title fetch.
  const confirmGenres = useCallback((genres: string[]) => {
    genreSeedsRef.current = genres;
    activeProbesRef.current = buildActiveProbes(ALL_PROBES[ageRange ?? 'default'], genres);
    setGenreStepDone(true); // triggers the fetch useEffect
  }, [ageRange]);

  const rate = useCallback((rating: Rating) => {
    const currentRatings = ratingsRef.current;
    const title = queue[currentIndex];
    if (!title) return;

    const newRatings = { ...currentRatings, [title.tmdbId]: rating };
    setRatings(newRatings);

    const nextIndex = currentIndex + 1;
    const SEED_SIZE = activeProbesRef.current.length;
    const REORDER_EVERY = 4;

    const shouldReorder =
      nextIndex === SEED_SIZE ||
      (nextIndex > SEED_SIZE && (nextIndex - SEED_SIZE) % REORDER_EVERY === 0);

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
