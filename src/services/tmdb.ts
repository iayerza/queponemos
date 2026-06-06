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
  runtime?: number; // minutos: película = duración; serie = duración por episodio
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
  const res = await fetch(tmdbUrl(path), { headers: tmdbHeaders() });
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${path}`);
  return res.json();
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
  const runtime = type === 'movie'
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
    runtime: runtime && runtime > 0 ? runtime : undefined,
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
