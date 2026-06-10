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
  originalTitle?: string;
  year: number;
  genres: string[];
  rating: number;
  posterPath: string | null;
  synopsis: string;
  runtime?: number;
  keywords?: string[]; // populated lazily via fetchKeywords()
  isAnchor?: boolean;  // set by placeAnchors — calibration titles that bypass genre filter
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
  const originalTitle = type === 'movie'
    ? (data.original_title as string ?? title)
    : (data.original_name as string ?? title);
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
    originalTitle,
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

function parseDiscoverResult(r: Record<string, unknown>, type: 'movie' | 'tv'): NormalizedTitle {
  const title = type === 'movie' ? (r.title as string) : (r.name as string);
  const originalTitle = type === 'movie'
    ? (r.original_title as string ?? title)
    : (r.original_name as string ?? title);
  const dateStr = type === 'movie'
    ? (r.release_date as string)
    : (r.first_air_date as string);
  return {
    id: r.id as number,
    tmdbId: r.id as number,
    type,
    title,
    originalTitle,
    year: dateStr ? parseInt(dateStr.slice(0, 4), 10) : 0,
    genres: ((r.genre_ids as number[]) ?? []).map(id => GENRE_MAP[id] ?? 'Otro'),
    rating: parseFloat(((r.vote_average as number) ?? 0).toFixed(1)),
    posterPath: (r.poster_path as string | null) ?? null,
    synopsis: (r.overview as string) ?? '',
  };
}

function isoDateDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export async function discoverByGenre(
  type: 'movie' | 'tv',
  genreId: number,
  minYear: number,
  page = 1,
): Promise<NormalizedTitle[]> {
  const dateField = type === 'movie' ? 'primary_release_date.gte' : 'first_air_date.gte';
  const minVotes  = type === 'movie' ? 500 : 100;
  let path = `/discover/${type}?with_genres=${genreId}&sort_by=vote_count.desc`
    + `&vote_count.gte=${minVotes}&${dateField}=${minYear}-01-01&page=${page}`;
  if (type === 'movie') path += `&primary_release_date.lte=${isoDateDaysAgo(90)}`;
  const data = await tmdbGet(path) as { results: Record<string, unknown>[] };
  return (data.results ?? []).slice(0, 5).map(r => parseDiscoverResult(r, type));
}

// Fetch the most universally recognized movies for the user's era — no genre filter.
// These anchor the cold start: vote_count.desc across all genres gives The Dark Knight,
// Inception, Pulp Fiction, The Matrix, Forrest Gump, etc. — movies everyone has seen.
export async function fetchAnchorTitles(minYear: number): Promise<NormalizedTitle[]> {
  const path = `/discover/movie?sort_by=vote_count.desc&vote_count.gte=300000`
    + `&primary_release_date.gte=${minYear}-01-01`
    + `&primary_release_date.lte=${isoDateDaysAgo(90)}`;
  const data = await tmdbGet(path) as { results: Record<string, unknown>[] };
  return (data.results ?? []).slice(0, 12).map(r => parseDiscoverResult(r, 'movie'));
}

// ─── Onboarding pool — dynamic, diverse by era × genre ──────────────────────

// Distribuye anchors de forma estratificada: 3 en 0-9, 1 en 10-19, 1 en 20-29
function placeAnchors(anchors: NormalizedTitle[], disc: NormalizedTitle[]): NormalizedTitle[] {
  const sa = shuffle(anchors.slice(0, 5)).map(t => ({ ...t, isAnchor: true }));
  const sd = shuffle(disc.slice(0, 25)).map(t => ({ ...t, isAnchor: false }));
  const block1 = shuffle([...sa.slice(0, 3), ...sd.slice(0,  7)]);  // 10 cards
  const block2 = shuffle([...sa.slice(3, 4), ...sd.slice(7,  16)]); // 10 cards
  const block3 = shuffle([...sa.slice(4, 5), ...sd.slice(16, 25)]); // 10 cards
  return [...block1, ...block2, ...block3];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface DiscoverSlot {
  media: 'movie' | 'tv';
  genre: number;
  yearFrom?: number;
  yearTo?: number;
  minRating?: number;
  minVotes?: number;
  pick: number;
  sortBy?: 'vote_average.desc' | 'popularity.desc';
  language?: string;
}

const MG = { action: 28, adventure: 12, animation: 16, comedy: 35, crime: 80, drama: 18, horror: 27, romance: 10749, scifi: 878, thriller: 53 } as const;
const TG = { comedy: 35, crime: 80, drama: 18, scifiFantasy: 10765, mystery: 9648 } as const;

const ONBOARDING_SLOTS: Record<string, DiscoverSlot[]> = {
  // <25 — acción, sci-fi, animación, horror, series del momento
  young: [
    // Clásicos pre-1990 (3)
    { media: 'movie', genre: MG.action,     yearTo: 1989, minRating: 7.5, minVotes: 3000, pick: 1 },
    { media: 'movie', genre: MG.scifi,      yearTo: 1989, minRating: 7.5, minVotes: 3000, pick: 1 },
    { media: 'movie', genre: MG.animation,  yearTo: 2010, minRating: 7.5, minVotes: 2000, pick: 1 },
    // 1990–2009 (5)
    { media: 'movie', genre: MG.action,     yearFrom: 1990, yearTo: 2009, minRating: 7.0, minVotes: 2000, pick: 1 },
    { media: 'movie', genre: MG.scifi,      yearFrom: 1990, yearTo: 2009, minRating: 7.0, minVotes: 2000, pick: 1 },
    { media: 'movie', genre: MG.comedy,     yearFrom: 1990, yearTo: 2009, minRating: 6.8, minVotes: 1000, pick: 1 },
    { media: 'movie', genre: MG.horror,     yearFrom: 1990, yearTo: 2009, minRating: 6.8, minVotes: 1000, pick: 1 },
    { media: 'movie', genre: MG.thriller,   yearFrom: 1990, yearTo: 2009, minRating: 7.0, minVotes: 2000, pick: 1 },
    // 2010–2019 (7)
    { media: 'movie', genre: MG.action,     yearFrom: 2010, yearTo: 2019, minRating: 7.0, minVotes: 10000, pick: 2 },
    { media: 'movie', genre: MG.drama,      yearFrom: 2010, yearTo: 2019, minRating: 7.5, minVotes: 1000,  pick: 1 },
    { media: 'movie', genre: MG.horror,     yearFrom: 2010, yearTo: 2019, minRating: 7.0, minVotes: 1000,  pick: 2 },
    { media: 'movie', genre: MG.romance,    yearFrom: 2010, yearTo: 2019, minRating: 7.0, minVotes: 1000,  pick: 1 },
    { media: 'movie', genre: MG.animation,  yearFrom: 2010, yearTo: 2019, minRating: 7.0, minVotes: 1000,  pick: 1 },
    // 2020+ (4)
    { media: 'movie', genre: MG.action,     yearFrom: 2020, minRating: 7.0, minVotes: 500, pick: 2 },
    { media: 'movie', genre: MG.drama,      yearFrom: 2020, minRating: 7.0, minVotes: 500, pick: 1 },
    { media: 'movie', genre: MG.horror,     yearFrom: 2020, minRating: 7.0, minVotes: 500, pick: 1 },
    // Series (11)
    { media: 'tv', genre: TG.drama,         minRating: 8.0, minVotes: 500, pick: 3 },
    { media: 'tv', genre: TG.scifiFantasy,  minRating: 7.5, minVotes: 300, pick: 3 },
    { media: 'tv', genre: TG.comedy,        minRating: 7.5, minVotes: 300, pick: 2 },
    { media: 'tv', genre: TG.crime,         minRating: 7.5, minVotes: 300, pick: 2 },
    { media: 'tv', genre: TG.mystery,       minRating: 7.5, minVotes: 300, pick: 1 },
  ], // 3+5+7+4+11 = 30

  // 25–35 — calidad cinematográfica, drama, thriller, prestige TV
  mid: [
    // Pre-1990 (3)
    { media: 'movie', genre: MG.drama,     yearTo: 1989, minRating: 7.5, minVotes: 3000, pick: 1 },
    { media: 'movie', genre: MG.crime,     yearTo: 1989, minRating: 7.5, minVotes: 3000, pick: 1 },
    { media: 'movie', genre: MG.thriller,  yearTo: 1989, minRating: 7.5, minVotes: 3000, pick: 1 },
    // 1990–2009 (8)
    { media: 'movie', genre: MG.drama,     yearFrom: 1990, yearTo: 2009, minRating: 7.5, minVotes: 2000, pick: 2 },
    { media: 'movie', genre: MG.thriller,  yearFrom: 1990, yearTo: 2009, minRating: 7.5, minVotes: 2000, pick: 1 },
    { media: 'movie', genre: MG.crime,     yearFrom: 1990, yearTo: 2009, minRating: 7.5, minVotes: 2000, pick: 1 },
    { media: 'movie', genre: MG.comedy,    yearFrom: 1990, yearTo: 2009, minRating: 7.0, minVotes: 1000, pick: 1 },
    { media: 'movie', genre: MG.romance,   yearFrom: 1990, yearTo: 2009, minRating: 7.0, minVotes: 2000, pick: 1 },
    { media: 'movie', genre: MG.scifi,     yearFrom: 1990, yearTo: 2009, minRating: 7.0, minVotes: 1000, pick: 1 },
    { media: 'movie', genre: MG.animation, yearFrom: 1990, yearTo: 2009, minRating: 7.5, minVotes: 2000, pick: 1 },
    // 2010–2019 (6)
    { media: 'movie', genre: MG.drama,     yearFrom: 2010, yearTo: 2019, minRating: 7.5, minVotes: 1000,  pick: 2 },
    { media: 'movie', genre: MG.thriller,  yearFrom: 2010, yearTo: 2019, minRating: 7.0, minVotes: 1000,  pick: 2 },
    { media: 'movie', genre: MG.action,    yearFrom: 2010, yearTo: 2019, minRating: 7.0, minVotes: 20000, pick: 1 },
    { media: 'movie', genre: MG.romance,   yearFrom: 2010, yearTo: 2019, minRating: 7.0, minVotes: 1000,  pick: 1 },
    // 2020+ (3)
    { media: 'movie', genre: MG.drama,     yearFrom: 2020, minRating: 7.5, minVotes: 500, pick: 1 },
    { media: 'movie', genre: MG.thriller,  yearFrom: 2020, minRating: 7.0, minVotes: 500, pick: 1 },
    { media: 'movie', genre: MG.scifi,     yearFrom: 2020, minRating: 7.0, minVotes: 500, pick: 1 },
    // Series (10)
    { media: 'tv', genre: TG.drama,        minRating: 8.0, minVotes: 500, pick: 3 },
    { media: 'tv', genre: TG.crime,        minRating: 8.0, minVotes: 300, pick: 2 },
    { media: 'tv', genre: TG.comedy,       minRating: 7.5, minVotes: 300, pick: 2 },
    { media: 'tv', genre: TG.scifiFantasy, minRating: 7.5, minVotes: 300, pick: 2 },
    { media: 'tv', genre: TG.mystery,      minRating: 7.5, minVotes: 300, pick: 1 },
  ], // 3+8+6+3+10 = 30

  // 36–50 — nacidos ~1976-1990
  adult: [
    // 1990–1999 (5)
    { media: 'movie', genre: MG.drama,     yearFrom: 1990, yearTo: 1999, minRating: 7.5, minVotes: 2000, pick: 1 },
    { media: 'movie', genre: MG.thriller,  yearFrom: 1990, yearTo: 1999, minRating: 7.5, minVotes: 2000, pick: 1 },
    { media: 'movie', genre: MG.comedy,    yearFrom: 1990, yearTo: 1999, minRating: 7.0, minVotes: 1000, pick: 1 },
    { media: 'movie', genre: MG.romance,   yearFrom: 1990, yearTo: 1999, minRating: 7.0, minVotes: 2000, pick: 1 },
    { media: 'movie', genre: MG.adventure, yearFrom: 1990, yearTo: 1999, minRating: 7.0, minVotes: 5000, pick: 1 },
    // 2000–2012 (9)
    { media: 'movie', genre: MG.drama,     yearFrom: 2000, yearTo: 2012, minRating: 7.5, minVotes: 2000,  pick: 2 },
    { media: 'movie', genre: MG.thriller,  yearFrom: 2000, yearTo: 2012, minRating: 7.0, minVotes: 1000,  pick: 2 },
    { media: 'movie', genre: MG.crime,     yearFrom: 2000, yearTo: 2012, minRating: 7.5, minVotes: 1000,  pick: 1 },
    { media: 'movie', genre: MG.comedy,    yearFrom: 2000, yearTo: 2012, minRating: 7.0, minVotes: 1000,  pick: 1 },
    { media: 'movie', genre: MG.action,    yearFrom: 2000, yearTo: 2012, minRating: 7.5, minVotes: 30000, pick: 1 },
    { media: 'movie', genre: MG.animation, yearFrom: 2000, yearTo: 2012, minRating: 7.5, minVotes: 5000,  pick: 1 },
    { media: 'movie', genre: MG.scifi,     yearFrom: 2000, yearTo: 2012, minRating: 7.0, minVotes: 1000,  pick: 1 },
    // 2013–2021 (7)
    { media: 'movie', genre: MG.drama,     yearFrom: 2013, yearTo: 2021, minRating: 7.5, minVotes: 2000, pick: 2 },
    { media: 'movie', genre: MG.thriller,  yearFrom: 2013, yearTo: 2021, minRating: 7.0, minVotes: 2000, pick: 2 },
    { media: 'movie', genre: MG.comedy,    yearFrom: 2013, yearTo: 2021, minRating: 7.0, minVotes: 1000, pick: 1 },
    { media: 'movie', genre: MG.romance,   yearFrom: 2013, yearTo: 2021, minRating: 7.0, minVotes: 1000, pick: 1 },
    { media: 'movie', genre: MG.crime,     yearFrom: 2013, yearTo: 2021, minRating: 7.5, minVotes: 2000, pick: 1 },
    // 2022+ (2)
    { media: 'movie', genre: MG.drama,     yearFrom: 2022, minRating: 7.0, minVotes: 500, pick: 1 },
    { media: 'movie', genre: MG.thriller,  yearFrom: 2022, minRating: 7.0, minVotes: 500, pick: 1 },
    // Series (7)
    { media: 'tv', genre: TG.drama,        minRating: 8.0, minVotes: 500, pick: 2 },
    { media: 'tv', genre: TG.crime,        minRating: 8.0, minVotes: 300, pick: 2 },
    { media: 'tv', genre: TG.comedy,       minRating: 7.5, minVotes: 300, pick: 1 },
    { media: 'tv', genre: TG.scifiFantasy, minRating: 7.5, minVotes: 300, pick: 1 },
    { media: 'tv', genre: TG.mystery,      minRating: 7.5, minVotes: 300, pick: 1 },
  ], // 5+9+7+2+7 = 30

  // 50+ — clásicos, period drama, cine de autor
  senior: [
    // Pre-1970 (3)
    { media: 'movie', genre: MG.drama,    yearTo: 1969, minRating: 7.5, minVotes: 2000, pick: 1 },
    { media: 'movie', genre: MG.crime,    yearTo: 1969, minRating: 7.5, minVotes: 2000, pick: 1 },
    { media: 'movie', genre: MG.comedy,   yearTo: 1969, minRating: 7.5, minVotes: 1000, pick: 1 },
    // 1970–1989 (8)
    { media: 'movie', genre: MG.drama,    yearFrom: 1970, yearTo: 1989, minRating: 7.5, minVotes: 2000, pick: 3 },
    { media: 'movie', genre: MG.thriller, yearFrom: 1970, yearTo: 1989, minRating: 7.5, minVotes: 2000, pick: 2 },
    { media: 'movie', genre: MG.crime,    yearFrom: 1970, yearTo: 1989, minRating: 7.5, minVotes: 2000, pick: 1 },
    { media: 'movie', genre: MG.comedy,   yearFrom: 1970, yearTo: 1989, minRating: 7.0, minVotes: 1000, pick: 1 },
    { media: 'movie', genre: MG.romance,  yearFrom: 1970, yearTo: 1989, minRating: 7.0, minVotes: 1000, pick: 1 },
    // 1990–2010 (6)
    { media: 'movie', genre: MG.drama,    yearFrom: 1990, yearTo: 2010, minRating: 7.5, minVotes: 2000, pick: 2 },
    { media: 'movie', genre: MG.thriller, yearFrom: 1990, yearTo: 2010, minRating: 7.5, minVotes: 2000, pick: 1 },
    { media: 'movie', genre: MG.comedy,   yearFrom: 1990, yearTo: 2010, minRating: 7.0, minVotes: 1000, pick: 1 },
    { media: 'movie', genre: MG.romance,  yearFrom: 1990, yearTo: 2010, minRating: 7.0, minVotes: 2000, pick: 1 },
    { media: 'movie', genre: MG.crime,    yearFrom: 1990, yearTo: 2010, minRating: 7.5, minVotes: 2000, pick: 1 },
    // 2010+ (3)
    { media: 'movie', genre: MG.drama,    yearFrom: 2010, minRating: 7.5, minVotes: 1000, pick: 1 },
    { media: 'movie', genre: MG.thriller, yearFrom: 2010, minRating: 7.5, minVotes: 1000, pick: 1 },
    { media: 'movie', genre: MG.comedy,   yearFrom: 2010, minRating: 7.0, minVotes: 1000, pick: 1 },
    // Series (10)
    { media: 'tv', genre: TG.drama,       minRating: 8.0, minVotes: 500, pick: 3 },
    { media: 'tv', genre: TG.crime,       minRating: 8.0, minVotes: 300, pick: 2 },
    { media: 'tv', genre: TG.comedy,      minRating: 7.5, minVotes: 300, pick: 2 },
    { media: 'tv', genre: TG.mystery,     minRating: 7.5, minVotes: 300, pick: 2 },
    { media: 'tv', genre: TG.drama,       yearFrom: 1980, yearTo: 2005, minRating: 8.0, minVotes: 200, pick: 1 },
  ], // 3+8+6+3+10 = 30
};

async function fetchDiscoverSlot(slot: DiscoverSlot): Promise<NormalizedTitle[]> {
  const page = Math.ceil(Math.random() * 3);
  const p: Record<string, string> = {
    with_genres:            String(slot.genre),
    'vote_count.gte':       String(slot.minVotes ?? 500),
    sort_by:                slot.sortBy ?? 'vote_average.desc',
    with_original_language: slot.language ?? 'en|es',
    page:                   String(page),
  };
  if (slot.minRating) p['vote_average.gte'] = String(slot.minRating);
  if (slot.yearFrom)  p[slot.media === 'movie' ? 'primary_release_date.gte' : 'first_air_date.gte'] = `${slot.yearFrom}-01-01`;
  if (slot.yearTo)    p[slot.media === 'movie' ? 'primary_release_date.lte' : 'first_air_date.lte'] = `${slot.yearTo}-12-31`;

  const qs   = Object.entries(p).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  const data = await tmdbGet(`/discover/${slot.media}?${qs}`) as { results: Record<string, unknown>[] };

  return shuffle(
    data.results.map(r => parseDiscoverResult(r, slot.media)).filter(t => t.posterPath && t.year > 0)
  ).slice(0, slot.pick);
}

// ─── Anchor slots — títulos ultra-conocidos, mostrados primero ───────────────
// sort_by=popularity.desc garantiza reconocibilidad regional
// en: vote_count ≥ 500k (Hollywood global)  es: vote_count ≥ 30k (cine hispanohablante)

const ANCHOR_SLOTS: Record<string, DiscoverSlot[]> = {
  young: [
    { media: 'movie', genre: MG.action,    yearFrom: 2000, minVotes: 500000, sortBy: 'popularity.desc', language: 'en', pick: 1 },
    { media: 'movie', genre: MG.scifi,     yearFrom: 2000, minVotes: 500000, sortBy: 'popularity.desc', language: 'en', pick: 1 },
    { media: 'movie', genre: MG.animation, yearFrom: 2000, minVotes: 500000, sortBy: 'popularity.desc', language: 'en', pick: 1 },
    { media: 'movie', genre: MG.thriller,  yearFrom: 2000, minVotes: 300000, sortBy: 'popularity.desc', language: 'en', pick: 1 },
    { media: 'movie', genre: MG.drama,     yearFrom: 2000, minVotes: 30000,  sortBy: 'popularity.desc', language: 'es', pick: 1 },
  ],
  mid: [
    { media: 'movie', genre: MG.action,    yearFrom: 1995, minVotes: 500000, sortBy: 'popularity.desc', language: 'en', pick: 1 },
    { media: 'movie', genre: MG.drama,     yearFrom: 1995, minVotes: 500000, sortBy: 'popularity.desc', language: 'en', pick: 1 },
    { media: 'movie', genre: MG.thriller,  yearFrom: 1995, minVotes: 500000, sortBy: 'popularity.desc', language: 'en', pick: 1 },
    { media: 'movie', genre: MG.scifi,     yearFrom: 1995, minVotes: 500000, sortBy: 'popularity.desc', language: 'en', pick: 1 },
    { media: 'movie', genre: MG.drama,                     minVotes: 30000,  sortBy: 'popularity.desc', language: 'es', pick: 1 },
  ],
  adult: [
    { media: 'movie', genre: MG.action,    yearFrom: 1990, minVotes: 500000, sortBy: 'popularity.desc', language: 'en', pick: 1 },
    { media: 'movie', genre: MG.drama,     yearFrom: 1990, minVotes: 500000, sortBy: 'popularity.desc', language: 'en', pick: 1 },
    { media: 'movie', genre: MG.thriller,  yearFrom: 1990, minVotes: 500000, sortBy: 'popularity.desc', language: 'en', pick: 1 },
    { media: 'movie', genre: MG.romance,   yearFrom: 1990, minVotes: 300000, sortBy: 'popularity.desc', language: 'en', pick: 1 },
    { media: 'movie', genre: MG.drama,                     minVotes: 30000,  sortBy: 'popularity.desc', language: 'es', pick: 1 },
  ],
  senior: [
    { media: 'movie', genre: MG.drama,     yearFrom: 1970, minVotes: 500000, sortBy: 'popularity.desc', language: 'en', pick: 1 },
    { media: 'movie', genre: MG.thriller,  yearFrom: 1970, minVotes: 500000, sortBy: 'popularity.desc', language: 'en', pick: 1 },
    { media: 'movie', genre: MG.crime,     yearFrom: 1970, minVotes: 500000, sortBy: 'popularity.desc', language: 'en', pick: 1 },
    { media: 'movie', genre: MG.romance,   yearFrom: 1970, minVotes: 200000, sortBy: 'popularity.desc', language: 'en', pick: 1 },
    { media: 'movie', genre: MG.drama,                     minVotes: 30000,  sortBy: 'popularity.desc', language: 'es', pick: 1 },
  ],
};

// ─── Tone slots — 25 discriminadores por tono (sin filtro de era) ────────────

const TONE_SLOTS: Record<string, DiscoverSlot[]> = {
  // Thriller, policial, suspenso
  tension: [
    { media: 'movie', genre: MG.thriller,  minRating: 7.5, minVotes: 5000,  pick: 3 },
    { media: 'movie', genre: MG.crime,     minRating: 7.5, minVotes: 5000,  pick: 3 },
    { media: 'movie', genre: MG.drama,     minRating: 7.8, minVotes: 5000,  pick: 2 },
    { media: 'movie', genre: MG.thriller,  minRating: 7.0, minVotes: 20000, pick: 2 },
    { media: 'movie', genre: MG.action,    minRating: 7.5, minVotes: 20000, pick: 2 },
    { media: 'movie', genre: MG.scifi,     minRating: 7.5, minVotes: 5000,  pick: 1 },
    { media: 'movie', genre: MG.horror,    minRating: 7.5, minVotes: 3000,  pick: 2 },
    { media: 'tv',    genre: TG.crime,     minRating: 8.0, minVotes: 500,   pick: 3 },
    { media: 'tv',    genre: TG.drama,     minRating: 8.0, minVotes: 500,   pick: 3 },
    { media: 'tv',    genre: TG.mystery,   minRating: 7.5, minVotes: 300,   pick: 2 },
    { media: 'tv',    genre: TG.scifiFantasy, minRating: 7.5, minVotes: 300, pick: 2 },
  ], // 3+3+2+2+2+1+2 + 3+3+2+2 = 25

  // Comedia, romance, aventura
  light: [
    { media: 'movie', genre: MG.comedy,    minRating: 7.0, minVotes: 5000,  pick: 4 },
    { media: 'movie', genre: MG.romance,   minRating: 6.5, minVotes: 5000,  pick: 4 },
    { media: 'movie', genre: MG.animation, minRating: 7.5, minVotes: 5000,  pick: 3 },
    { media: 'movie', genre: MG.adventure, minRating: 7.0, minVotes: 10000, pick: 2 },
    { media: 'movie', genre: MG.comedy,    minRating: 6.5, minVotes: 2000,  pick: 2 },
    { media: 'tv',    genre: TG.comedy,    minRating: 7.5, minVotes: 300,   pick: 4 },
    { media: 'tv',    genre: TG.drama,     minRating: 7.5, minVotes: 300,   pick: 4 },
    { media: 'tv',    genre: TG.mystery,   minRating: 7.5, minVotes: 200,   pick: 2 },
  ], // 4+4+3+2+2 + 4+4+2 = 25

  // Drama, sci-fi, misterio
  think: [
    { media: 'movie', genre: MG.drama,     minRating: 7.8, minVotes: 5000,  pick: 4 },
    { media: 'movie', genre: MG.scifi,     minRating: 7.5, minVotes: 3000,  pick: 3 },
    { media: 'movie', genre: MG.thriller,  minRating: 7.8, minVotes: 5000,  pick: 3 },
    { media: 'movie', genre: MG.crime,     minRating: 7.8, minVotes: 5000,  pick: 2 },
    { media: 'movie', genre: MG.animation, minRating: 8.0, minVotes: 5000,  pick: 1 },
    { media: 'movie', genre: MG.horror,    minRating: 7.5, minVotes: 3000,  pick: 2 },
    { media: 'tv',    genre: TG.drama,     minRating: 8.0, minVotes: 500,   pick: 4 },
    { media: 'tv',    genre: TG.crime,     minRating: 8.0, minVotes: 300,   pick: 3 },
    { media: 'tv',    genre: TG.scifiFantasy, minRating: 8.0, minVotes: 300, pick: 2 },
    { media: 'tv',    genre: TG.mystery,   minRating: 7.5, minVotes: 200,   pick: 1 },
  ], // 4+3+3+2+1+2 + 4+3+2+1 = 25

  // Terror, acción intensa
  fear: [
    { media: 'movie', genre: MG.horror,    minRating: 7.0, minVotes: 3000,  pick: 5 },
    { media: 'movie', genre: MG.thriller,  minRating: 7.0, minVotes: 5000,  pick: 3 },
    { media: 'movie', genre: MG.action,    minRating: 7.0, minVotes: 10000, pick: 3 },
    { media: 'movie', genre: MG.scifi,     minRating: 7.0, minVotes: 5000,  pick: 2 },
    { media: 'movie', genre: MG.crime,     minRating: 7.0, minVotes: 5000,  pick: 2 },
    { media: 'tv',    genre: TG.crime,     minRating: 7.5, minVotes: 300,   pick: 3 },
    { media: 'tv',    genre: TG.scifiFantasy, minRating: 7.5, minVotes: 300, pick: 4 },
    { media: 'tv',    genre: TG.mystery,   minRating: 7.5, minVotes: 300,   pick: 3 },
  ], // 5+3+3+2+2 + 3+4+3 = 25
};

// ─── Recognition pool — armado desde los géneros elegidos ────────────────────
// sort_by=vote_count.desc ≈ "cuánta gente la vio": maximiza el reconocimiento.
// Por cada género elegido: 1 anchor mega-conocido + relleno del mismo género.
// Más 4 blockbusters transversales (2 pelis + 2 series) para identificación.

export const GENRE_NAME_TO_ID: Record<string, number> = {
  'Acción': 28, 'Aventura': 12, 'Animación': 16, 'Comedia': 35,
  'Crimen': 80, 'Documental': 99, 'Drama': 18, 'Familia': 10751,
  'Fantasía': 14, 'Historia': 36, 'Terror': 27, 'Misterio': 9648,
  'Romance': 10749, 'Ciencia Ficción': 878, 'Thriller': 53, 'Bélica': 10752,
};

const AGE_YEAR_FROM: Record<string, number> = { young: 2005, mid: 1995, adult: 1988, senior: 1975 };

async function fetchTopVoted(opts: {
  media: 'movie' | 'tv'; genre?: number; yearFrom?: number; minVotes: number; pages?: number;
}): Promise<NormalizedTitle[]> {
  const pages = opts.pages ?? 1;
  const reqs = Array.from({ length: pages }, (_, i) => {
    const p: Record<string, string> = {
      'vote_count.gte': String(opts.minVotes),
      sort_by: 'vote_count.desc',
      with_original_language: 'en|es',
      page: String(i + 1),
    };
    if (opts.genre)    p.with_genres = String(opts.genre);
    if (opts.yearFrom) p[opts.media === 'movie' ? 'primary_release_date.gte' : 'first_air_date.gte'] = `${opts.yearFrom}-01-01`;
    const qs = Object.entries(p).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return tmdbGet(`/discover/${opts.media}?${qs}`) as Promise<{ results: Record<string, unknown>[] }>;
  });
  const results = await Promise.all(reqs);
  return results
    .flatMap(d => d.results.map(r => parseDiscoverResult(r, opts.media)))
    .filter(t => t.posterPath && t.year > 0);
}

async function fetchRecognitionPool(ageRange: string, genreIds: number[]): Promise<NormalizedTitle[]> {
  const yearFrom = AGE_YEAR_FROM[ageRange] ?? 1988;
  const TARGET = 30;
  // Con pocos géneros necesitamos más profundidad por género
  const pages = genreIds.length <= 3 ? 2 : 1;

  const [genreRes, movieBlocks, tvBlocks] = await Promise.all([
    Promise.allSettled(genreIds.map(g => fetchTopVoted({ media: 'movie', genre: g, yearFrom, minVotes: 1500, pages }))),
    fetchTopVoted({ media: 'movie', yearFrom, minVotes: 15000 }).catch(() => [] as NormalizedTitle[]),
    fetchTopVoted({ media: 'tv', minVotes: 5000 }).catch(() => [] as NormalizedTitle[]),
  ]);

  const seen = new Set<number>();
  const pool: NormalizedTitle[] = [];
  const push = (t: NormalizedTitle, isAnchor: boolean): boolean => {
    if (seen.has(t.tmdbId)) return false;
    seen.add(t.tmdbId);
    pool.push({ ...t, isAnchor });
    return true;
  };

  // 4 blockbusters transversales: no perfilan, pero generan "el algoritmo me conoce"
  for (const t of movieBlocks.slice(0, 2)) push(t, true);
  for (const t of tvBlocks.slice(0, 2))    push(t, true);

  // Round-robin entre géneros: ronda 0 = el anchor de cada género
  const lists = genreRes.map(r => (r.status === 'fulfilled' ? r.value : []));
  const idx   = lists.map(() => 0);
  let round = 0;
  while (pool.length < TARGET) {
    let added = false;
    for (let g = 0; g < lists.length && pool.length < TARGET; g++) {
      while (idx[g] < lists[g].length) {
        const t = lists[g][idx[g]++];
        if (push(t, round === 0)) { added = true; break; }
      }
    }
    if (!added) break;
    round++;
  }

  // Si los géneros no alcanzan, completar con más blockbusters
  for (const t of [...movieBlocks.slice(2), ...tvBlocks.slice(2)]) {
    if (pool.length >= TARGET) break;
    push(t, false);
  }

  return shuffle(pool);
}

export async function fetchOnboardingPool(
  ageRange?: string,
  tone?: string,
  selectedGenres: string[] = [],
): Promise<NormalizedTitle[]> {
  const genreIds = selectedGenres
    .map(g => GENRE_NAME_TO_ID[g])
    .filter((id): id is number => id !== undefined);
  if (genreIds.length > 0 && !tone) return fetchRecognitionPool(ageRange ?? 'adult', genreIds);

  const anchorSlots = ANCHOR_SLOTS[ageRange ?? 'mid'] ?? ANCHOR_SLOTS.mid;
  const discSlots   = tone
    ? (TONE_SLOTS[tone] ?? TONE_SLOTS.tension)
    : (ONBOARDING_SLOTS[ageRange ?? 'mid'] ?? ONBOARDING_SLOTS.mid);

  const [anchorRes, discRes] = await Promise.all([
    Promise.allSettled(anchorSlots.map(fetchDiscoverSlot)),
    Promise.allSettled(discSlots.map(fetchDiscoverSlot)),
  ]);

  const seen = new Set<number>();
  const anchors: NormalizedTitle[] = [];
  const disc:    NormalizedTitle[] = [];

  for (const r of anchorRes) {
    if (r.status === 'rejected') continue;
    for (const t of r.value) {
      if (!seen.has(t.tmdbId)) { seen.add(t.tmdbId); anchors.push(t); }
    }
  }
  for (const r of discRes) {
    if (r.status === 'rejected') continue;
    for (const t of r.value) {
      if (!seen.has(t.tmdbId)) { seen.add(t.tmdbId); disc.push(t); }
    }
  }

  return placeAnchors(anchors, disc);
}

// ─── Search ──────────────────────────────────────────────────────────────────

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
      const originalTitle = type === 'movie'
        ? (r.original_title as string ?? title)
        : (r.original_name as string ?? title);
      const dateStr = type === 'movie'
        ? (r.release_date as string)
        : (r.first_air_date as string);
      return {
        id: r.id as number,
        tmdbId: r.id as number,
        type,
        title,
        originalTitle,
        year: dateStr ? parseInt(dateStr.slice(0, 4), 10) : 0,
        genres: ((r.genre_ids as number[]) ?? []).map(id => GENRE_MAP[id] ?? 'Otro'),
        rating: parseFloat(((r.vote_average as number) ?? 0).toFixed(1)),
        posterPath: (r.poster_path as string | null) ?? null,
        synopsis: (r.overview as string) ?? '',
      };
    });
}

// Keywords genéricas que no aportan señal de gusto (filtradas del perfil)
const KW_BLOCKLIST = new Set([
  'independent film', 'woman director', 'based on novel', 'based on true story',
  'based on real events', 'sequel', 'prequel', 'remake', 'duringcreditsstinger',
  'aftercreditsstinger', 'superhero', 'dc comics', 'marvel comics',
]);

// Fetch keywords for a title. Returns an array of normalized keyword strings.
// Lightweight call (~200B response). Designed to run in background post-rating.
export async function fetchKeywords(tmdbId: number, type: 'movie' | 'tv'): Promise<string[]> {
  const path = type === 'movie'
    ? `/movie/${tmdbId}/keywords`
    : `/tv/${tmdbId}/keywords`;
  const data = await tmdbGet(path) as {
    keywords?: { name: string }[];
    results?:  { name: string }[];
  };
  const raw = data.keywords ?? data.results ?? [];
  return raw
    .map(k => k.name.toLowerCase().trim())
    .filter(k => k.length > 2 && !KW_BLOCKLIST.has(k))
    .slice(0, 15);
}

// Fetch top-voted light-genre movies for anchor diversity補完.
// Used when anchors lack Comedy/Romance coverage.
export async function fetchLightAnchorTitles(minYear: number, count: number): Promise<NormalizedTitle[]> {
  const path = `/discover/movie?sort_by=vote_count.desc&vote_count.gte=100000`
    + `&with_genres=35|10749`   // Comedy OR Romance
    + `&primary_release_date.gte=${minYear}-01-01`
    + `&primary_release_date.lte=${isoDateDaysAgo(90)}`;
  const data = await tmdbGet(path) as { results: Record<string, unknown>[] };
  return (data.results ?? []).slice(0, count).map(r => parseDiscoverResult(r, 'movie'));
}
