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
  const url = tmdbUrl(path);
  try {
    const res = await fetch(url, { headers: tmdbHeaders(), mode: 'cors' });
    if (!res.ok) throw new Error(`TMDB ${res.status}: ${path}`);
    return res.json();
  } catch (e) {
    console.error('[tmdb] fetch failed:', url.slice(0, 80), e);
    throw e;
  }
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

// Épocas por edad: cada género se muestrea estratificado por época para que
// un solo ranking (dominado por franquicias recientes) no capture todo el pool
const ERAS: Record<string, [number, number | null][]> = {
  young:  [[2003, 2012], [2013, null]],
  mid:    [[1993, 2007], [2008, 2016], [2017, null]],
  adult:  [[1982, 1999], [2000, 2012], [2013, null]],
  senior: [[1975, 1990], [1991, 2005], [2006, null]],
};

// Keywords TMDB excluidas del relleno por género: universos de superhéroes
// saturan el top por votos sin aportar información de gusto
// 180547 = Marvel Cinematic Universe, 229266 = DC Extended Universe, 9715 = superhero
const FRANCHISE_KEYWORDS = '180547|229266|9715';

// Set amplio para cuando el usuario saltea la selección de géneros
const DEFAULT_GENRE_IDS = [28, 35, 18, 53, 10749, 878]; // acción, comedia, drama, thriller, romance, sci-fi

// Géneros de identidad fuerte: si el usuario no los eligió, se excluyen de
// todas las queries (un thriller-terror ES terror para quien odia el terror)
export const STRONG_GENRES = [27, 16, 99, 10751]; // terror, animación, documental, familia

async function fetchTopVoted(opts: {
  genres?: number[];        // géneros (por defecto OR via pipe)
  genresJoin?: '|' | ',';   // ',' = AND, para pares de sabor
  withoutGenres?: number[]; // géneros excluidos
  yearFrom?: number;
  yearTo?: number;
  minVotes: number;
  minRating?: number;       // vote_average.gte (tono prestigio)
  maxRating?: number;       // vote_average.lte (tono palomitero)
  language?: string;        // with_original_language
  originCountry?: string;   // with_origin_country (ej: 'AR')
  withoutKeywords?: string; // keywords excluidas (pipe)
}): Promise<NormalizedTitle[]> {
  const p: Record<string, string> = {
    'vote_count.gte': String(opts.minVotes),
    sort_by: 'vote_count.desc',
    page: '1',
  };
  if (opts.genres?.length)        p.with_genres = opts.genres.join(opts.genresJoin ?? '|');
  if (opts.withoutGenres?.length) p.without_genres = opts.withoutGenres.join(',');
  if (opts.minRating)        p['vote_average.gte'] = String(opts.minRating);
  if (opts.maxRating)        p['vote_average.lte'] = String(opts.maxRating);
  if (opts.language)         p.with_original_language = opts.language;
  if (opts.originCountry)    p.with_origin_country = opts.originCountry;
  if (opts.withoutKeywords)  p.without_keywords = opts.withoutKeywords;
  if (opts.yearFrom)         p['primary_release_date.gte'] = `${opts.yearFrom}-01-01`;
  if (opts.yearTo)           p['primary_release_date.lte'] = `${opts.yearTo}-12-31`;
  const qs = Object.entries(p).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  const data = await tmdbGet(`/discover/movie?${qs}`) as { results: Record<string, unknown>[] };
  return data.results
    .map(r => parseDiscoverResult(r, 'movie'))
    .filter(t => t.posterPath && t.year > 0);
}

// Primera palabra significativa del título original: dos películas que la
// comparten son casi siempre la misma saga (Avengers, Spider-Man, Harry...)
const TITLE_STOPWORDS = new Set(['the', 'and', 'los', 'las', 'del', 'una', 'uno']);
export function franchiseKey(t: NormalizedTitle): string {
  const words = (t.originalTitle ?? t.title)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !TITLE_STOPWORDS.has(w));
  return words[0] ?? t.title.toLowerCase();
}

export async function fetchOnboardingPool(
  ageRange = 'adult',
  selectedGenres: string[] = [],
  poolSize = 60, // lo define el caller: máximo de cartas + reserva para reemplazos
): Promise<NormalizedTitle[]> {
  const genreIds = selectedGenres
    .map(g => GENRE_NAME_TO_ID[g])
    .filter((id): id is number => id !== undefined);
  const ids = genreIds.length > 0 ? genreIds : DEFAULT_GENRE_IDS;

  const eras = ERAS[ageRange] ?? ERAS.adult;
  const nE = eras.length;
  const yearFrom = eras[0][0];
  const TARGET = poolSize;
  // Excluir géneros fuertes no elegidos de TODAS las queries
  const withoutGenres = STRONG_GENRES.filter(g => !ids.includes(g));

  // Una request por género × época, en paralelo con blockbusters y cine AR
  const genreEraReqs = ids.flatMap(g =>
    eras.map(([from, to]) =>
      fetchTopVoted({
        genres: [g], withoutGenres, yearFrom: from, yearTo: to ?? undefined,
        minVotes: from < 2000 ? 1500 : 3000,
        language: 'en', withoutKeywords: FRANCHISE_KEYWORDS,
      }).catch(() => [] as NormalizedTitle[])
    )
  );

  const [genreEraLists, blockbusters, localTop, localGenre] = await Promise.all([
    Promise.all(genreEraReqs),
    fetchTopVoted({ withoutGenres, yearFrom, minVotes: 15000, language: 'en' }).catch(() => [] as NormalizedTitle[]),
    fetchTopVoted({ withoutGenres, originCountry: 'AR', yearFrom, minVotes: 300 }).catch(() => [] as NormalizedTitle[]),
    fetchTopVoted({ withoutGenres, originCountry: 'AR', genres: ids, yearFrom, minVotes: 100 }).catch(() => [] as NormalizedTitle[]),
  ]);

  const seenIds = new Set<number>();
  const seenFranchise = new Set<string>();
  const pool: NormalizedTitle[] = [];

  const push = (t: NormalizedTitle, isAnchor: boolean): boolean => {
    if (seenIds.has(t.tmdbId)) return false;
    const fk = franchiseKey(t);
    if (seenFranchise.has(fk)) return false; // máx 1 por franquicia
    seenIds.add(t.tmdbId);
    seenFranchise.add(fk);
    pool.push({ ...t, isAnchor });
    return true;
  };

  // Elige al azar entre los topK más votados (reconocibles igual, varía entre corridas)
  const pickRandom = (list: NormalizedTitle[], isAnchor: boolean, topK = 6): boolean => {
    for (const t of shuffle(list.slice(0, topK))) if (push(t, isAnchor)) return true;
    for (const t of list.slice(topK)) if (push(t, isAnchor)) return true;
    return false;
  };

  // 2 blockbusters globales: no perfilan, generan "el algoritmo me conoce"
  pickRandom(blockbusters, true);
  pickRandom(blockbusters, true);

  // 3 argentinas: 1 top general + 2 top dentro de los géneros elegidos
  pickRandom(localTop, true, 3);
  pickRandom(localGenre, true);
  pickRandom(localGenre, true);

  // Géneros × épocas: round-robin alternando época para cada género;
  // primera pasada por género = anchor de ese género
  let round = 0;
  while (pool.length < TARGET) {
    let added = false;
    for (let g = 0; g < ids.length && pool.length < TARGET; g++) {
      const era = (g + round) % nE;
      if (pickRandom(genreEraLists[g * nE + era], round === 0)) { added = true; continue; }
      for (let e2 = 0; e2 < nE; e2++) {
        if (e2 !== era && pickRandom(genreEraLists[g * nE + e2], round === 0)) { added = true; break; }
      }
    }
    if (!added) break;
    round++;
  }

  // Si los géneros no alcanzan, completar con más blockbusters
  while (pool.length < TARGET && pickRandom(blockbusters, false, 20)) { /* noop */ }

  return shuffle(pool);
}

// ─── Deepening batch — fase 2 ─────────────────────────────────────────────────
// Cuando los géneros ganadores están claros (~carta 12), se trae en background
// una tanda de candidatos para distinguir SUB-gustos dentro de esos géneros:
//   pares de sabor (thriller+crimen vs thriller+sci-fi vs thriller+drama)
//   tono (prestigio: rating ≥7.8 / palomitero: rating ≤7.0 con muchos votos)
// Las épocas ya quedaron cubiertas por el pool de fase 1.

export async function fetchDeepeningBatch(
  topGenreIds: number[],      // 1-2 géneros ganadores
  companionIds: number[],     // con qué géneros formar pares
  ageRange = 'adult',
  excludeGenreIds: number[] = [], // géneros fuertes no elegidos
  maxSize = 40,
): Promise<NormalizedTitle[]> {
  const yearFrom = (ERAS[ageRange] ?? ERAS.adult)[0][0];
  const base = {
    withoutGenres: excludeGenreIds,
    yearFrom,
    language: 'en',
    withoutKeywords: FRANCHISE_KEYWORDS,
  };

  const reqs: Promise<NormalizedTitle[]>[] = [];
  for (const g of topGenreIds) {
    for (const c of companionIds) {
      if (c === g) continue;
      reqs.push(fetchTopVoted({ ...base, genres: [g, c], genresJoin: ',', minVotes: 1000 }).catch(() => []));
    }
    reqs.push(fetchTopVoted({ ...base, genres: [g], minRating: 7.8, minVotes: 2000 }).catch(() => []));
    reqs.push(fetchTopVoted({ ...base, genres: [g], maxRating: 7.0, minVotes: 3000 }).catch(() => []));
  }

  const lists = await Promise.all(reqs);

  // Round-robin entre listas para que ningún eje domine la tanda
  const seen = new Set<number>();
  const out: NormalizedTitle[] = [];
  for (let idx = 0; out.length < maxSize; idx++) {
    let added = false;
    for (const list of lists) {
      if (out.length >= maxSize) break;
      const t = list[idx];
      if (t && !seen.has(t.tmdbId)) {
        seen.add(t.tmdbId);
        out.push({ ...t, isAnchor: false });
        added = true;
      }
    }
    if (!added) break;
  }
  return out;
}
