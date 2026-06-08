import { MOCK_TITLES } from '../constants/mockTitles';
import type { NormalizedTitle } from '../services/tmdb';
import type { Rating } from '../services/firebase';

export interface TasteProfile {
  genres: Record<string, number>;
  genreRawScores?: Record<string, number>;
  intensity: number;
  seriesVsMovies: number;
  implicitGenres: string[];
}

// Precompute IDF from the catalog: genres appearing in many titles get lower weight.
// Drama appears in ~75% of titles → low IDF. Romance in ~15% → high IDF.
const _count: Record<string, number> = {};
for (const t of MOCK_TITLES) for (const g of t.genres) _count[g] = (_count[g] ?? 0) + 1;
const _N = MOCK_TITLES.length;
export const CATALOG_IDF: Record<string, number> = Object.fromEntries(
  Object.entries(_count).map(([g, n]) => [g, Math.log((_N + 1) / (n + 1))])
);
const DEFAULT_IDF = Math.log((_N + 1) / 2);

const WEIGHTS: Record<Rating, number> = {
  loved:         2.0,
  liked:         1.0,
  seen_disliked: -0.8,
  not_seen:       0,
};

export function recalculateTasteProfile(
  deltaRatings: Record<number, Rating>,
  deltaTitles: NormalizedTitle[],
  prevProfile: TasteProfile,
): TasteProfile {
  // Accumulate IDF-weighted scores on top of stored raw scores
  const rawScores: Record<string, number> = { ...(prevProfile.genreRawScores ?? {}) };

  let lovedSeries = 0, lovedMovies = 0, lovedRatingsSum = 0, lovedCount = 0;

  for (const [idStr, rating] of Object.entries(deltaRatings)) {
    const title = deltaTitles.find(
      t => t.tmdbId === Number(idStr) || t.id === Number(idStr)
    );
    if (!title) continue;
    const w = WEIGHTS[rating];
    for (const genre of title.genres) {
      const idf = CATALOG_IDF[genre] ?? DEFAULT_IDF;
      rawScores[genre] = (rawScores[genre] ?? 0) + w * idf;
    }
    if (rating === 'loved') {
      if (title.type === 'tv') lovedSeries++;
      else lovedMovies++;
      lovedRatingsSum += title.rating;
      lovedCount++;
    }
  }

  // Normalize positive raw scores to 0–1 range for display
  const positive = Object.fromEntries(Object.entries(rawScores).filter(([, s]) => s > 0));
  const maxRaw = Math.max(...Object.values(positive), 0.001);
  const genres = Object.fromEntries(
    Object.entries(positive).map(([g, s]) => [g, parseFloat((s / maxRaw).toFixed(3))])
  );

  const implicitGenres = Object.entries(genres)
    .filter(([, s]) => s > 0.65)
    .map(([g]) => g);

  const total = lovedSeries + lovedMovies;
  return {
    genres,
    genreRawScores: rawScores,
    intensity: lovedCount > 0
      ? parseFloat((lovedRatingsSum / lovedCount / 10).toFixed(3))
      : prevProfile.intensity,
    seriesVsMovies: total > 0 ? lovedSeries / total : prevProfile.seriesVsMovies,
    implicitGenres,
  };
}

// Migration helper: rebuild raw scores from MOCK_TITLES for users without genreRawScores
export function rebuildProfileFromCatalog(
  allRatings: Record<number, Rating>,
  prevProfile: TasteProfile,
): TasteProfile {
  const emptyBase: TasteProfile = {
    genres: {},
    genreRawScores: {},
    intensity: prevProfile.intensity,
    seriesVsMovies: prevProfile.seriesVsMovies,
    implicitGenres: [],
  };
  return recalculateTasteProfile(allRatings, MOCK_TITLES as NormalizedTitle[], emptyBase);
}
