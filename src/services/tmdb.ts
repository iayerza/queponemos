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
