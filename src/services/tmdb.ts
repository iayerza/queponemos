const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG  = 'https://image.tmdb.org/t/p/w500';
const API_KEY   = process.env.EXPO_PUBLIC_TMDB_API_KEY ?? '';

// TMDB acepta tanto API key clásica (string corta) como Bearer token JWT (empieza con "eyJ")
function tmdbHeaders(): HeadersInit {
  if (API_KEY.startsWith('eyJ')) {
    return { Accept: 'application/json', Authorization: `Bearer ${API_KEY}` };
  }
  return { Accept: 'application/json' };
}

function tmdbUrl(path: string): string {
  const sep = path.includes('?') ? '&' : '?';
  if (API_KEY.startsWith('eyJ')) {
    return `${TMDB_BASE}${path}${sep}language=es-AR`;
  }
  return `${TMDB_BASE}${path}${sep}api_key=${API_KEY}&language=es-AR`;
}

export interface NormalizedTitle {
  id: number;
  tmdbId: number;
  type: 'movie' | 'tv';
  title: string;
  year: number;
  genres: string[];
  rating: number;
  posterPath: string | null;
  synopsis: string;
  runtime?: number;
}

const GENRE_MAP: Record<number, string> = {
  28: 'Acción', 12: 'Aventura', 16: 'Animación', 35: 'Comedia',
  80: 'Crimen', 99: 'Documental', 18: 'Drama', 10751: 'Familia',
  14: 'Fantasía', 36: 'Historia', 27: 'Terror', 10402: 'Música',
  9648: 'Misterio', 10749: 'Romance', 878: 'Ciencia Ficción',
  10770: 'Película de TV', 53: 'Thriller', 10752: 'Bélica',
  37: 'Western', 10759: 'Acción y Aventura', 10762: 'Infantil',
  10763: 'Noticias', 10764: 'Reality', 10765: 'Sci-Fi y Fantasía',
  10766: 'Telenovela', 10767: 'Talk', 10768: 'Guerra y Política',
};

export const GENRE_NAME_TO_ID: Record<string, number> = {
  'Acción': 28, 'Aventura': 12, 'Animación': 16, 'Comedia': 35,
  'Crimen': 80, 'Documental': 99, 'Drama': 18, 'Familia': 10751,
  'Fantasía': 14, 'Historia': 36, 'Terror': 27, 'Misterio': 9648,
  'Romance': 10749, 'Ciencia Ficción': 878, 'Thriller': 53, 'Bélica': 10752,
};

// Géneros que requieren selección explícita — excluidos si el usuario no los eligió
export const STRONG_GENRES = [27, 16, 99, 10751]; // Terror, Animación, Documental, Familia

// Ventanas temporales por franja etaria (null = hasta hoy)
const ERAS: Record<string, [number, number | null][]> = {
  young:  [[2005, 2014], [2015, null]],
  mid:    [[1995, 2007], [2008, 2016], [2017, null]],
  adult:  [[1988, 1999], [2000, 2012], [2013, null]],
  senior: [[1975, 1990], [1991, 2005], [2006, null]],
};

const FRANCHISE_KEYWORDS = '180547|229266|9715'; // MCU, DCEU, Star Wars

const TITLE_STOPWORDS = new Set([
  'the','a','an','la','el','los','las','un','una','de','of','and','y','en','in',
]);

async function tmdbGet(path: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(tmdbUrl(path), { headers: tmdbHeaders(), signal: controller.signal });
    if (!res.ok) throw new Error(`TMDB ${res.status}: ${path}`);
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchTitle(
  tmdbId: number,
  type: 'movie' | 'tv'
): Promise<NormalizedTitle> {
  const data = await tmdbGet(`/${type}/${tmdbId}`) as Record<string, unknown>;
  const title = type === 'movie'
    ? (data.title as string)
    : (data.name as string);
  const dateStr = type === 'movie'
    ? (data.release_date as string)
    : (data.first_air_date as string);
  const year = dateStr ? parseInt(dateStr.slice(0, 4), 10) : 0;
  const genreIds = (data.genres as { id: number }[]).map(g => g.id);
  const rawRuntime = type === 'movie'
    ? (data.runtime as number | undefined)
    : ((data.episode_run_time as number[] | undefined)?.[0]);

  return {
    id: tmdbId,
    tmdbId,
    type,
    title,
    year,
    genres: genreIds.map(id => GENRE_MAP[id] ?? 'Otro'),
    rating: parseFloat(((data.vote_average as number) ?? 0).toFixed(1)),
    posterPath: (data.poster_path as string | null) ?? null,
    synopsis: (data.overview as string) ?? '',
    runtime: rawRuntime && rawRuntime > 0 ? rawRuntime : undefined,
  };
}

export function getPosterUrl(posterPath: string | null): string | null {
  return posterPath ? `${TMDB_IMG}${posterPath}` : null;
}

// ─── Feature extraction ───────────────────────────────────────────────────────

export function eraBucket(year: number): string {
  if (year < 1980) return 'clásico';
  if (year < 1990) return '80s';
  if (year < 2000) return '90s';
  if (year < 2010) return '00s';
  if (year < 2020) return '10s';
  return '20s';
}

export function featuresOf(t: NormalizedTitle): string[] {
  const feats: string[] = [];
  for (const g of t.genres) feats.push(`g:${g}`);
  const sg = [...t.genres].sort();
  for (let i = 0; i < sg.length; i++)
    for (let j = i + 1; j < sg.length; j++) feats.push(`p:${sg[i]}+${sg[j]}`);
  if (t.year) feats.push(`e:${eraBucket(t.year)}`);
  if (t.rating >= 7.8) feats.push('t:prestigio');
  if (t.rating > 0 && t.rating <= 7.0) feats.push('t:palomitera');
  return feats;
}

function franchiseKey(t: NormalizedTitle): string {
  const base = t.title.toLowerCase();
  const first = base.split(/\s+/).find(w => !TITLE_STOPWORDS.has(w)) ?? base;
  return first.replace(/[^a-z0-9]/g, '');
}

// ─── Onboarding pool building ─────────────────────────────────────────────────

function parseDiscoverResult(r: Record<string, unknown>): NormalizedTitle {
  const isTV = 'name' in r;
  const type: 'movie' | 'tv' = isTV ? 'tv' : 'movie';
  const title = isTV ? (r.name as string ?? '') : (r.title as string ?? '');
  const dateStr = isTV ? (r.first_air_date as string ?? '') : (r.release_date as string ?? '');
  return {
    id: r.id as number,
    tmdbId: r.id as number,
    type,
    title,
    year: dateStr ? parseInt(dateStr.slice(0, 4), 10) : 0,
    genres: ((r.genre_ids as number[]) ?? []).map(id => GENRE_MAP[id] ?? 'Otro'),
    rating: parseFloat(((r.vote_average as number) ?? 0).toFixed(1)),
    posterPath: (r.poster_path as string | null) ?? null,
    synopsis: (r.overview as string) ?? '',
  };
}

async function discoverMedia(
  mediaType: 'movie' | 'tv',
  genreId: number,
  from: number,
  to: number | null,
  excludeGenreIds: number[] = [],
): Promise<NormalizedTitle[]> {
  const year = new Date().getFullYear();
  const dateMax = to ? `${to}-12-31` : `${year}-12-31`;
  const dateField = mediaType === 'movie' ? 'primary_release_date' : 'first_air_date';
  const parts = [
    `with_genres=${genreId}`,
    `sort_by=vote_count.desc`,
    `vote_count.gte=100`,
    `${dateField}.gte=${from}-01-01`,
    `${dateField}.lte=${dateMax}`,
  ];
  if (excludeGenreIds.length > 0) parts.push(`without_genres=${excludeGenreIds.join(',')}`);
  if (mediaType === 'movie') parts.push(`without_keywords=${FRANCHISE_KEYWORDS}`);
  const data = await tmdbGet(`/discover/${mediaType}?${parts.join('&')}`) as {
    results: Record<string, unknown>[];
  };
  return (data.results ?? []).map(r => parseDiscoverResult(r));
}

export async function fetchOnboardingPool(
  ageRange: string,
  selectedGenreIds: number[],
): Promise<NormalizedTitle[]> {
  const eras = ERAS[ageRange] ?? ERAS.adult;
  const excludeStrong = STRONG_GENRES.filter(id => !selectedGenreIds.includes(id));

  // Fallback genres when user hasn't selected specific ones
  const genres = selectedGenreIds.length > 0
    ? selectedGenreIds.slice(0, 5)
    : [28, 35, 18, 53, 878]; // Acción, Comedia, Drama, Thriller, Sci-Fi

  const tasks: Promise<NormalizedTitle[]>[] = [];

  for (const [from, to] of eras) {
    // Genre-specific slots (movies)
    for (const gid of genres) {
      tasks.push(
        discoverMedia('movie', gid, from, to, excludeStrong)
          .then(r => r.slice(0, 6))
          .catch(() => []),
      );
    }
    // Popular Drama for every era (anchor for drama-adjacent taste)
    tasks.push(
      discoverMedia('movie', 18, from, to, excludeStrong)
        .then(r => r.slice(0, 4))
        .catch(() => []),
    );
    // TV shows per era (Drama + Thriller)
    tasks.push(
      discoverMedia('tv', 18, from, to, excludeStrong)
        .then(r => r.slice(0, 3))
        .catch(() => []),
    );
  }

  const all = (await Promise.all(tasks)).flat();

  // Dedup: prefer higher-rated version when franchise key collides
  const byKey = new Map<string, NormalizedTitle>();
  for (const t of all) {
    if (!t.year || !t.posterPath) continue;
    const key = franchiseKey(t);
    const existing = byKey.get(key);
    if (!existing || t.rating > existing.rating) byKey.set(key, t);
  }

  return Array.from(byKey.values());
}

export async function fetchDeepeningBatch(
  topGenreIds: number[],
  _companionIds: number[],
  ageRange = 'adult',
  excludeGenreIds: number[] = [],
  maxSize = 40,
): Promise<NormalizedTitle[]> {
  const eras = ERAS[ageRange] ?? ERAS.adult;
  const tasks: Promise<NormalizedTitle[]>[] = [];

  for (const [from, to] of eras) {
    for (const gid of topGenreIds.slice(0, 2)) {
      // Prestige tier (critically acclaimed)
      tasks.push(
        discoverMedia('movie', gid, from, to, excludeGenreIds)
          .then(r => r.filter(t => t.rating >= 7.8).slice(0, 5))
          .catch(() => []),
      );
      // Palomitero tier (popular but not prestige)
      tasks.push(
        discoverMedia('movie', gid, from, to, excludeGenreIds)
          .then(r => r.filter(t => t.rating > 0 && t.rating <= 7.2).slice(0, 4))
          .catch(() => []),
      );
    }
  }

  const all = (await Promise.all(tasks)).flat();
  const seen = new Set<number>();
  const deduped: NormalizedTitle[] = [];
  for (const t of all) {
    if (t.posterPath && !seen.has(t.tmdbId)) {
      seen.add(t.tmdbId);
      deduped.push(t);
    }
  }
  return deduped.slice(0, maxSize);
}

// ─── Watch provider logos ────────────────────────────────────────────────────

const PLATFORM_PROVIDER_IDS: Record<string, number> = {
  netflix: 8,
  prime:   9,
  disney:  337,
  apple:   350,
  hbo:     1899,
};

let _logoUrls: Record<string, string> | null = null;
let _fetching: Promise<Record<string, string>> | null = null;

export function fetchProviderLogoUrls(): Promise<Record<string, string>> {
  if (_logoUrls) return Promise.resolve(_logoUrls);
  if (!_fetching) {
    _fetching = (tmdbGet('/watch/providers/movie?watch_region=US') as Promise<{
      results: Array<{ provider_id: number; logo_path: string }>;
    }>)
      .then(data => {
        const map: Record<string, string> = {};
        for (const [platformId, providerId] of Object.entries(PLATFORM_PROVIDER_IDS)) {
          const p = data.results.find(r => r.provider_id === providerId);
          if (p?.logo_path) map[platformId] = `https://image.tmdb.org/t/p/w92${p.logo_path}`;
        }
        _logoUrls = map;
        return map;
      })
      .catch(() => ({}));
  }
  return _fetching;
}

export async function fetchTrailerKey(tmdbId: number, type: 'movie' | 'tv'): Promise<string | null> {
  const data = await tmdbGet(`/${type}/${tmdbId}/videos`) as {
    results: { site: string; type: string; key: string; official: boolean }[];
  };
  const pick =
    data.results.find(v => v.site === 'YouTube' && v.type === 'Trailer' && v.official) ??
    data.results.find(v => v.site === 'YouTube' && v.type === 'Trailer') ??
    data.results.find(v => v.site === 'YouTube' && v.type === 'Teaser');
  return pick?.key ?? null;
}

export async function searchTitles(query: string): Promise<NormalizedTitle[]> {
  const data = await tmdbGet(`/search/multi?query=${encodeURIComponent(query)}`) as {
    results: Record<string, unknown>[];
  };
  return data.results
    .filter(r => r.media_type === 'movie' || r.media_type === 'tv')
    .slice(0, 10)
    .map(r => {
      const type = r.media_type as 'movie' | 'tv';
      const title = type === 'movie' ? (r.title as string) : (r.name as string);
      const dateStr = type === 'movie'
        ? (r.release_date as string)
        : (r.first_air_date as string);
      return {
        id: r.id as number,
        tmdbId: r.id as number,
        type,
        title,
        year: dateStr ? parseInt(dateStr.slice(0, 4), 10) : 0,
        genres: ((r.genre_ids as number[]) ?? []).map(id => GENRE_MAP[id] ?? 'Otro'),
        rating: parseFloat(((r.vote_average as number) ?? 0).toFixed(1)),
        posterPath: (r.poster_path as string | null) ?? null,
        synopsis: (r.overview as string) ?? '',
      };
    });
}
