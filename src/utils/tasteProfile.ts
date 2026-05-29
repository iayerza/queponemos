import type { NormalizedTitle } from '../services/tmdb';
import type { Rating } from '../services/firebase';

export interface TasteProfile {
  genres: Record<string, number>;
  intensity: number;
  seriesVsMovies: number;
  implicitGenres: string[];
}

const WEIGHTS: Record<Rating, number> = {
  loved:         1.0,
  seen_disliked: -0.3,
  not_seen:       0,
};

export function recalculateTasteProfile(
  allRatings: Record<number, Rating>,
  allTitles: NormalizedTitle[],
  prevProfile: TasteProfile,
): TasteProfile {
  const genreScore: Record<string, number> = { ...prevProfile.genres };

  let lovedSeries = 0;
  let lovedMovies = 0;
  let lovedRatingsSum = 0;
  let lovedCount = 0;

  for (const [idStr, rating] of Object.entries(allRatings)) {
    const title = allTitles.find(t => t.id === Number(idStr));
    if (!title) continue;
    const w = WEIGHTS[rating];
    for (const genre of title.genres) {
      genreScore[genre] = (genreScore[genre] ?? 0) + w * 0.2;
    }
    if (rating === 'loved') {
      if (title.type === 'tv') lovedSeries++;
      else lovedMovies++;
      lovedRatingsSum += title.rating;
      lovedCount++;
    }
  }

  const maxScore = Math.max(...Object.values(genreScore).map(Math.abs), 0.01);
  const normalized = Object.fromEntries(
    Object.entries(genreScore).map(([g, s]) => [g, parseFloat((s / maxScore).toFixed(3))])
  );

  const implicitGenres = Object.entries(normalized)
    .filter(([, s]) => s > 0.7)
    .map(([g]) => g);

  const total = lovedSeries + lovedMovies;
  const seriesVsMovies = total > 0 ? lovedSeries / total : prevProfile.seriesVsMovies;
  const intensity = lovedCount > 0
    ? parseFloat((lovedRatingsSum / lovedCount / 10).toFixed(3))
    : prevProfile.intensity;

  return {
    genres: normalized,
    intensity,
    seriesVsMovies,
    implicitGenres,
  };
}
