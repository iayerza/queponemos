const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG  = 'https://image.tmdb.org/t/p/w500';
const API_KEY   = process.env.EXPO_PUBLIC_TMDB_API_KEY ?? '';

function tmdbHeaders(): HeadersInit {
  if (API_KEY.startsWith('eyJ')) return { Accept: 'application/json', Authorization: `Bearer ${API_KEY}` };
  return { Accept: 'application/json' };
}
function tmdbUrl(path: string): string {
  const sep = path.includes('?') ? '&' : '?';
  if (API_KEY.startsWith('eyJ')) return `${TMDB_BASE}${path}${sep}language=es-AR`;
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
  isAnchor: boolean; // marcado en fetchOnboardingPool
}

export function getPosterUrl(p: string | null): string | null {
  return p ? `${TMDB_IMG}${p}` : null;
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
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(tmdbUrl(path), { headers: tmdbHeaders(), signal: ctrl.signal });
    if (!res.ok) throw new Error(`TMDB ${res.status}: ${path}`);
    return res.json();
  } finally { clearTimeout(t); }
}

function parseDiscoverResult(r: Record<string, unknown>, type: 'movie' | 'tv'): NormalizedTitle {
  const title = type === 'movie' ? (r.title as string) : (r.name as string);
  const originalTitle = type === 'movie'
    ? (r.original_title as string ?? title)
    : (r.original_name as string ?? title);
  const dateStr = type === 'movie' ? (r.release_date as string) : (r.first_air_date as string);
  return {
    id: r.id as number, tmdbId: r.id as number, type, title, originalTitle,
    year: dateStr ? parseInt(dateStr.slice(0, 4), 10) : 0,
    genres: ((r.genre_ids as number[]) ?? []).map(id => GENRE_MAP[id] ?? 'Otro'),
    rating: parseFloat(((r.vote_average as number) ?? 0).toFixed(1)),
    posterPath: (r.poster_path as string | null) ?? null,
    synopsis: (r.overview as string) ?? '',
    isAnchor: false,
  };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Recognition pool ─────────────────────────────────────────────────────────
// Pool armado desde los géneros elegidos, optimizado para reconocimiento:
// sort_by=vote_count.desc ≈ "cuánta gente la vio".
//
// 30 títulos, solo películas:
//   2  blockbusters globales (inglés, top votadas all-time)       → identificación
//   3  argentinas (1 top-AR general + 2 top-AR de tus géneros)    → reconocimiento local
//   25 de tus géneros (inglés, round-robin; ronda 0 = anchor)     → perfilado

export const GENRE_NAME_TO_ID: Record<string, number> = {
  'Acción': 28, 'Aventura': 12, 'Animación': 16, 'Comedia': 35,
  'Crimen': 80, 'Documental': 99, 'Drama': 18, 'Familia': 10751,
  'Fantasía': 14, 'Historia': 36, 'Terror': 27, 'Misterio': 9648,
  'Romance': 10749, 'Ciencia Ficción': 878, 'Thriller': 53, 'Bélica': 10752,
};

const AGE_YEAR_FROM: Record<string, number> = { young: 2005, mid: 1995, adult: 1988, senior: 1975 };

// Set amplio para cuando el usuario saltea la selección de géneros
const DEFAULT_GENRE_IDS = [28, 35, 18, 53, 10749, 878]; // acción, comedia, drama, thriller, romance, sci-fi

async function fetchTopVoted(opts: {
  genres?: number[];        // OR entre géneros (pipe)
  yearFrom?: number;
  minVotes: number;
  pages?: number;
  language?: string;        // with_original_language
  originCountry?: string;   // with_origin_country (ej: 'AR')
}): Promise<NormalizedTitle[]> {
  const pages = opts.pages ?? 1;
  const reqs = Array.from({ length: pages }, (_, i) => {
    const p: Record<string, string> = {
      'vote_count.gte': String(opts.minVotes),
      sort_by: 'vote_count.desc',
      page: String(i + 1),
    };
    if (opts.genres?.length)  p.with_genres = opts.genres.join('|');
    if (opts.language)        p.with_original_language = opts.language;
    if (opts.originCountry)   p.with_origin_country = opts.originCountry;
    if (opts.yearFrom)        p['primary_release_date.gte'] = `${opts.yearFrom}-01-01`;
    const qs = Object.entries(p).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return tmdbGet(`/discover/movie?${qs}`) as Promise<{ results: Record<string, unknown>[] }>;
  });
  const results = await Promise.all(reqs);
  return results
    .flatMap(d => d.results.map(r => parseDiscoverResult(r, 'movie')))
    .filter(t => t.posterPath && t.year > 0);
}

export async function fetchOnboardingPool(ageRange = 'adult', selectedGenres: string[] = []): Promise<NormalizedTitle[]> {
  const genreIds = selectedGenres
    .map(g => GENRE_NAME_TO_ID[g])
    .filter((id): id is number => id !== undefined);
  const ids = genreIds.length > 0 ? genreIds : DEFAULT_GENRE_IDS;

  const yearFrom = AGE_YEAR_FROM[ageRange] ?? 1988;
  const TARGET = 30;
  // Con pocos géneros necesitamos más profundidad por género
  const pages = ids.length <= 3 ? 2 : 1;

  const [genreRes, blockbusters, localTop, localGenre] = await Promise.all([
    Promise.allSettled(ids.map(g => fetchTopVoted({ genres: [g], yearFrom, minVotes: 1500, pages, language: 'en' }))),
    fetchTopVoted({ yearFrom, minVotes: 15000, language: 'en' }).catch(() => [] as NormalizedTitle[]),
    fetchTopVoted({ originCountry: 'AR', yearFrom, minVotes: 300 }).catch(() => [] as NormalizedTitle[]),
    fetchTopVoted({ originCountry: 'AR', genres: ids, yearFrom, minVotes: 100 }).catch(() => [] as NormalizedTitle[]),
  ]);

  const seen = new Set<number>();
  const pool: NormalizedTitle[] = [];
  const push = (t: NormalizedTitle, isAnchor: boolean): boolean => {
    if (seen.has(t.tmdbId)) return false;
    seen.add(t.tmdbId);
    pool.push({ ...t, isAnchor });
    return true;
  };

  // 2 blockbusters globales: no perfilan, generan "el algoritmo me conoce"
  for (const t of blockbusters.slice(0, 2)) push(t, true);

  // 3 argentinas: 1 top general + 2 top dentro de tus géneros
  for (const t of localTop.slice(0, 1)) push(t, true);
  let arAdded = 0;
  for (const t of localGenre) {
    if (arAdded >= 2) break;
    if (push(t, true)) arAdded++;
  }

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
  for (const t of blockbusters.slice(2)) {
    if (pool.length >= TARGET) break;
    push(t, false);
  }

  return shuffle(pool);
}
