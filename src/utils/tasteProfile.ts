import { MOCK_TITLES } from '../constants/mockTitles';
import type { NormalizedTitle } from '../services/tmdb';
import type { Rating } from '../services/firebase';

export interface TasteProfile {
  genres: Record<string, number>;
  genreRawScores?: Record<string, number>;
  intensity: number;
  seriesVsMovies: number;
  implicitGenres: string[];
  // eraPreference: 0 = clásicos (1980s), 1 = contemporáneo (2020s)
  eraPreference?: number;
  // toneScore: -1 = muy oscuro/tenso (Terror, Thriller, Crimen), +1 = ligero/optimista (Comedia, Romance)
  toneScore?: number;
  // keyword frequency weights (normalized, accumulated post-rating via updateTasteKeywords)
  keywordWeights?: Record<string, number>;
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

const LIGHT_GENRES = new Set(['Comedia', 'Romance', 'Animación', 'Familia', 'Aventura', 'Fantasía']);
const DARK_GENRES  = new Set(['Terror', 'Thriller', 'Crimen', 'Misterio', 'Bélica']);
const ERA_MIN = 1980;
const ERA_MAX = new Date().getFullYear();

export function recalculateTasteProfile(
  deltaRatings: Record<number, Rating>,
  deltaTitles: NormalizedTitle[],
  prevProfile: TasteProfile,
): TasteProfile {
  // Accumulate IDF-weighted scores on top of stored raw scores
  const rawScores: Record<string, number> = { ...(prevProfile.genreRawScores ?? {}) };

  let lovedSeries = 0, lovedMovies = 0, lovedRatingsSum = 0, lovedCount = 0;
  let eraSum = 0, eraWeight = 0;
  let lightSum = 0, darkSum = 0;

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
    if (rating === 'loved' || rating === 'liked') {
      const titleW = rating === 'loved' ? 2 : 1;
      // Era signal: normalized 0-1 from ERA_MIN to ERA_MAX
      if (title.year && title.year >= ERA_MIN) {
        eraSum    += ((title.year - ERA_MIN) / (ERA_MAX - ERA_MIN)) * titleW;
        eraWeight += titleW;
      }
      // Tone signal: positive = light, negative = dark
      for (const g of title.genres) {
        if (LIGHT_GENRES.has(g)) lightSum += titleW;
        if (DARK_GENRES.has(g))  darkSum  += titleW;
      }
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
  const toneTotal = lightSum + darkSum;
  return {
    genres,
    genreRawScores: rawScores,
    intensity: lovedCount > 0
      ? parseFloat((lovedRatingsSum / lovedCount / 10).toFixed(3))
      : prevProfile.intensity,
    seriesVsMovies: total > 0 ? lovedSeries / total : prevProfile.seriesVsMovies,
    implicitGenres,
    eraPreference: eraWeight > 0
      ? parseFloat((eraSum / eraWeight).toFixed(3))
      : prevProfile.eraPreference,
    toneScore: toneTotal > 0
      ? parseFloat(((lightSum - darkSum) / toneTotal).toFixed(3))
      : prevProfile.toneScore,
  };
}

const KW_WEIGHTS: Record<Rating, number> = { loved: 2.0, liked: 1.0, seen_disliked: -0.5, not_seen: 0 };
const MAX_KEYWORDS = 20;

// Merge keywords from a just-rated title into the existing keyword weights.
// Returns the updated profile. Designed to be called in background after fetchKeywords().
export function mergeKeywords(
  keywords: string[],
  rating: Rating,
  prevProfile: TasteProfile,
): TasteProfile {
  if (keywords.length === 0 || KW_WEIGHTS[rating] === 0) return prevProfile;
  const w   = KW_WEIGHTS[rating];
  const kw  = { ...(prevProfile.keywordWeights ?? {}) };
  for (const k of keywords) kw[k] = (kw[k] ?? 0) + w;
  // Keep only top MAX_KEYWORDS by weight (positive only)
  const top = Object.fromEntries(
    Object.entries(kw)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_KEYWORDS)
  );
  return { ...prevProfile, keywordWeights: top };
}

// Top N keyword labels sorted by weight
export function topKeywordLabels(profile: TasteProfile, n = 8): string[] {
  return Object.entries(profile.keywordWeights ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
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
