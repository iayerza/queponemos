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
  collectionId?: number; // TMDB collection ID — deduplicar sagas/secuelas
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
    collectionId: (r.belongs_to_collection as { id: number } | null)?.id,
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
  // <25 — nacidos 2001+, no conocen el cine pre-2000
  young: [
    // 2000–2009 (4)
    { media: 'movie', genre: MG.action,     yearFrom: 2000, yearTo: 2009, minRating: 7.0, minVotes: 50000, pick: 1 },
    { media: 'movie', genre: MG.animation,  yearFrom: 2000, yearTo: 2009, minRating: 7.5, minVotes: 10000, pick: 1 },
    { media: 'movie', genre: MG.scifi,      yearFrom: 2000, yearTo: 2009, minRating: 7.0, minVotes: 20000, pick: 1 },
    { media: 'movie', genre: MG.comedy,     yearFrom: 2000, yearTo: 2009, minRating: 7.0, minVotes: 10000, pick: 1 },
    // 2010–2019 (9)
    { media: 'movie', genre: MG.action,     yearFrom: 2010, yearTo: 2019, minRating: 7.0, minVotes: 10000, pick: 2 },
    { media: 'movie', genre: MG.drama,      yearFrom: 2010, yearTo: 2019, minRating: 7.5, minVotes: 1000,  pick: 1 },
    { media: 'movie', genre: MG.horror,     yearFrom: 2010, yearTo: 2019, minRating: 7.0, minVotes: 1000,  pick: 2 },
    { media: 'movie', genre: MG.romance,    yearFrom: 2010, yearTo: 2019, minRating: 7.0, minVotes: 1000,  pick: 1 },
    { media: 'movie', genre: MG.animation,  yearFrom: 2010, yearTo: 2019, minRating: 7.5, minVotes: 1000,  pick: 1 },
    { media: 'movie', genre: MG.scifi,      yearFrom: 2010, yearTo: 2019, minRating: 7.0, minVotes: 5000,  pick: 1 },
    { media: 'movie', genre: MG.thriller,   yearFrom: 2010, yearTo: 2019, minRating: 7.0, minVotes: 5000,  pick: 1 },
    // 2020+ (6)
    { media: 'movie', genre: MG.action,     yearFrom: 2020, minRating: 7.0, minVotes: 500, pick: 2 },
    { media: 'movie', genre: MG.drama,      yearFrom: 2020, minRating: 7.0, minVotes: 500, pick: 1 },
    { media: 'movie', genre: MG.horror,     yearFrom: 2020, minRating: 7.0, minVotes: 500, pick: 1 },
    { media: 'movie', genre: MG.scifi,      yearFrom: 2020, minRating: 7.0, minVotes: 500, pick: 1 },
    { media: 'movie', genre: MG.comedy,     yearFrom: 2020, minRating: 7.0, minVotes: 500, pick: 1 },
    // Series (11)
    { media: 'tv', genre: TG.drama,         minRating: 8.0, minVotes: 500, pick: 3 },
    { media: 'tv', genre: TG.scifiFantasy,  minRating: 7.5, minVotes: 300, pick: 3 },
    { media: 'tv', genre: TG.comedy,        minRating: 7.5, minVotes: 300, pick: 2 },
    { media: 'tv', genre: TG.crime,         minRating: 7.5, minVotes: 300, pick: 2 },
    { media: 'tv', genre: TG.mystery,       minRating: 7.5, minVotes: 300, pick: 1 },
  ], // 4+9+6+11 = 30

  // 25–35 — nacidos ~1991-2001, conocen los 90s de chicos
  mid: [
    // 2000–2009 (9)
    { media: 'movie', genre: MG.drama,     yearFrom: 2000, yearTo: 2009, minRating: 7.5, minVotes: 2000, pick: 2 },
    { media: 'movie', genre: MG.thriller,  yearFrom: 2000, yearTo: 2009, minRating: 7.5, minVotes: 2000, pick: 2 },
    { media: 'movie', genre: MG.crime,     yearFrom: 2000, yearTo: 2009, minRating: 7.5, minVotes: 2000, pick: 1 },
    { media: 'movie', genre: MG.comedy,    yearFrom: 2000, yearTo: 2009, minRating: 7.0, minVotes: 1000, pick: 1 },
    { media: 'movie', genre: MG.romance,   yearFrom: 2000, yearTo: 2009, minRating: 7.0, minVotes: 2000, pick: 1 },
    { media: 'movie', genre: MG.scifi,     yearFrom: 2000, yearTo: 2009, minRating: 7.0, minVotes: 1000, pick: 1 },
    { media: 'movie', genre: MG.animation, yearFrom: 2000, yearTo: 2009, minRating: 7.5, minVotes: 2000, pick: 1 },
    // 2010–2019 (6)
    { media: 'movie', genre: MG.drama,     yearFrom: 2010, yearTo: 2019, minRating: 7.5, minVotes: 1000,  pick: 2 },
    { media: 'movie', genre: MG.thriller,  yearFrom: 2010, yearTo: 2019, minRating: 7.0, minVotes: 1000,  pick: 2 },
    { media: 'movie', genre: MG.action,    yearFrom: 2010, yearTo: 2019, minRating: 7.0, minVotes: 20000, pick: 1 },
    { media: 'movie', genre: MG.romance,   yearFrom: 2010, yearTo: 2019, minRating: 7.0, minVotes: 1000,  pick: 1 },
    // 2020+ (5)
    { media: 'movie', genre: MG.drama,     yearFrom: 2020, minRating: 7.5, minVotes: 500, pick: 2 },
    { media: 'movie', genre: MG.thriller,  yearFrom: 2020, minRating: 7.0, minVotes: 500, pick: 2 },
    { media: 'movie', genre: MG.scifi,     yearFrom: 2020, minRating: 7.0, minVotes: 500, pick: 1 },
    // Series (10)
    { media: 'tv', genre: TG.drama,        minRating: 8.0, minVotes: 500, pick: 3 },
    { media: 'tv', genre: TG.crime,        minRating: 8.0, minVotes: 300, pick: 2 },
    { media: 'tv', genre: TG.comedy,       minRating: 7.5, minVotes: 300, pick: 2 },
    { media: 'tv', genre: TG.scifiFantasy, minRating: 7.5, minVotes: 300, pick: 2 },
    { media: 'tv', genre: TG.mystery,      minRating: 7.5, minVotes: 300, pick: 1 },
  ], // 9+6+5+10 = 30

  // 36–50 — nacidos ~1976-1990, crecieron con los 80s/90s
  adult: [
    // 2000–2012 (10)
    { media: 'movie', genre: MG.drama,     yearFrom: 2000, yearTo: 2012, minRating: 7.5, minVotes: 2000,  pick: 3 },
    { media: 'movie', genre: MG.thriller,  yearFrom: 2000, yearTo: 2012, minRating: 7.0, minVotes: 1000,  pick: 3 },
    { media: 'movie', genre: MG.crime,     yearFrom: 2000, yearTo: 2012, minRating: 7.5, minVotes: 1000,  pick: 1 },
    { media: 'movie', genre: MG.comedy,    yearFrom: 2000, yearTo: 2012, minRating: 7.0, minVotes: 1000,  pick: 1 },
    { media: 'movie', genre: MG.action,    yearFrom: 2000, yearTo: 2012, minRating: 7.5, minVotes: 30000, pick: 1 },
    { media: 'movie', genre: MG.animation, yearFrom: 2000, yearTo: 2012, minRating: 7.5, minVotes: 5000,  pick: 1 },
    // 2013–2021 (6)
    { media: 'movie', genre: MG.drama,     yearFrom: 2013, yearTo: 2021, minRating: 7.5, minVotes: 2000, pick: 2 },
    { media: 'movie', genre: MG.thriller,  yearFrom: 2013, yearTo: 2021, minRating: 7.0, minVotes: 2000, pick: 2 },
    { media: 'movie', genre: MG.romance,   yearFrom: 2013, yearTo: 2021, minRating: 7.0, minVotes: 1000, pick: 1 },
    { media: 'movie', genre: MG.action,    yearFrom: 2013, yearTo: 2021, minRating: 7.0, minVotes: 2000, pick: 1 },
    // 2022+ (4)
    { media: 'movie', genre: MG.drama,     yearFrom: 2022, minRating: 7.0, minVotes: 500, pick: 2 },
    { media: 'movie', genre: MG.thriller,  yearFrom: 2022, minRating: 7.0, minVotes: 500, pick: 2 },
    // Series (10)
    { media: 'tv', genre: TG.drama,        minRating: 8.0, minVotes: 500, pick: 3 },
    { media: 'tv', genre: TG.crime,        minRating: 8.0, minVotes: 300, pick: 2 },
    { media: 'tv', genre: TG.comedy,       minRating: 7.5, minVotes: 300, pick: 2 },
    { media: 'tv', genre: TG.scifiFantasy, minRating: 7.5, minVotes: 300, pick: 2 },
    { media: 'tv', genre: TG.mystery,      minRating: 7.5, minVotes: 300, pick: 1 },
  ], // 10+6+4+10 = 30

  // 50+ — vieron todo: clásicos, 80s/90s, 2000s y cine de hoy
  senior: [
    // 2000–2009 (10)
    { media: 'movie', genre: MG.drama,    yearFrom: 2000, yearTo: 2009, minRating: 7.5, minVotes: 2000, pick: 3 },
    { media: 'movie', genre: MG.thriller, yearFrom: 2000, yearTo: 2009, minRating: 7.5, minVotes: 2000, pick: 2 },
    { media: 'movie', genre: MG.crime,    yearFrom: 2000, yearTo: 2009, minRating: 7.5, minVotes: 2000, pick: 2 },
    { media: 'movie', genre: MG.comedy,   yearFrom: 2000, yearTo: 2009, minRating: 7.0, minVotes: 1000, pick: 2 },
    { media: 'movie', genre: MG.romance,  yearFrom: 2000, yearTo: 2009, minRating: 7.0, minVotes: 2000, pick: 1 },
    // 2010+ (10)
    { media: 'movie', genre: MG.drama,    yearFrom: 2010, minRating: 7.5, minVotes: 1000, pick: 4 },
    { media: 'movie', genre: MG.thriller, yearFrom: 2010, minRating: 7.5, minVotes: 1000, pick: 3 },
    { media: 'movie', genre: MG.comedy,   yearFrom: 2010, minRating: 7.0, minVotes: 1000, pick: 2 },
    { media: 'movie', genre: MG.crime,    yearFrom: 2010, minRating: 7.5, minVotes: 1000, pick: 1 },
    // Series (10)
    { media: 'tv', genre: TG.drama,       minRating: 8.0, minVotes: 500, pick: 3 },
    { media: 'tv', genre: TG.crime,       minRating: 8.0, minVotes: 300, pick: 2 },
    { media: 'tv', genre: TG.comedy,      minRating: 7.5, minVotes: 300, pick: 2 },
    { media: 'tv', genre: TG.mystery,     minRating: 7.5, minVotes: 300, pick: 2 },
    { media: 'tv', genre: TG.drama,       yearFrom: 2000, yearTo: 2010, minRating: 8.0, minVotes: 200, pick: 1 },
  ], // 10+10+10 = 30
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
    { media: 'movie', genre: MG.action,    yearFrom: 2005, minVotes: 500000, sortBy: 'popularity.desc', language: 'en', pick: 1 },
    { media: 'movie', genre: MG.scifi,     yearFrom: 2005, minVotes: 500000, sortBy: 'popularity.desc', language: 'en', pick: 1 },
    { media: 'movie', genre: MG.animation, yearFrom: 2005, minVotes: 500000, sortBy: 'popularity.desc', language: 'en', pick: 1 },
    { media: 'movie', genre: MG.thriller,  yearFrom: 2005, minVotes: 300000, sortBy: 'popularity.desc', language: 'en', pick: 1 },
    { media: 'movie', genre: MG.drama,     yearFrom: 2005, minVotes: 30000,  sortBy: 'popularity.desc', language: 'es', pick: 1 },
  ],
  mid: [
    { media: 'movie', genre: MG.action,    yearFrom: 2000, minVotes: 500000, sortBy: 'popularity.desc', language: 'en', pick: 1 },
    { media: 'movie', genre: MG.drama,     yearFrom: 2000, minVotes: 500000, sortBy: 'popularity.desc', language: 'en', pick: 1 },
    { media: 'movie', genre: MG.thriller,  yearFrom: 2000, minVotes: 500000, sortBy: 'popularity.desc', language: 'en', pick: 1 },
    { media: 'movie', genre: MG.scifi,     yearFrom: 2000, minVotes: 500000, sortBy: 'popularity.desc', language: 'en', pick: 1 },
    { media: 'movie', genre: MG.drama,                     minVotes: 30000,  sortBy: 'popularity.desc', language: 'es', pick: 1 },
  ],
  adult: [
    { media: 'movie', genre: MG.action,    yearFrom: 2000, minVotes: 500000, sortBy: 'popularity.desc', language: 'en', pick: 1 },
    { media: 'movie', genre: MG.drama,     yearFrom: 2000, minVotes: 500000, sortBy: 'popularity.desc', language: 'en', pick: 1 },
    { media: 'movie', genre: MG.thriller,  yearFrom: 2000, minVotes: 500000, sortBy: 'popularity.desc', language: 'en', pick: 1 },
    { media: 'movie', genre: MG.romance,   yearFrom: 2000, minVotes: 300000, sortBy: 'popularity.desc', language: 'en', pick: 1 },
    { media: 'movie', genre: MG.drama,     yearFrom: 2000, minVotes: 30000,  sortBy: 'popularity.desc', language: 'es', pick: 1 },
  ],
  senior: [
    { media: 'movie', genre: MG.drama,     yearFrom: 2000, minVotes: 500000, sortBy: 'popularity.desc', language: 'en', pick: 1 },
    { media: 'movie', genre: MG.thriller,  yearFrom: 2000, minVotes: 500000, sortBy: 'popularity.desc', language: 'en', pick: 1 },
    { media: 'movie', genre: MG.crime,     yearFrom: 2000, minVotes: 500000, sortBy: 'popularity.desc', language: 'en', pick: 1 },
    { media: 'movie', genre: MG.romance,   yearFrom: 2000, minVotes: 200000, sortBy: 'popularity.desc', language: 'en', pick: 1 },
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

// ─── Recognition pool ─────────────────────────────────────────────────────────
// Pool armado desde los géneros elegidos, optimizado para reconocimiento:
// sort_by=vote_count.desc ≈ "cuánta gente la vio".
//
// 30 títulos, solo películas:
//   2  blockbusters globales (inglés, top votadas all-time)       → identificación
//   3  argentinas (1 top-AR general + 2 top-AR de sus géneros)    → reconocimiento local
//   25 de sus géneros (inglés, round-robin; ronda 0 = anchor)     → perfilado

export const GENRE_NAME_TO_ID: Record<string, number> = {
  'Acción': 28, 'Aventura': 12, 'Animación': 16, 'Comedia': 35,
  'Crimen': 80, 'Documental': 99, 'Drama': 18, 'Familia': 10751,
  'Fantasía': 14, 'Historia': 36, 'Terror': 27, 'Misterio': 9648,
  'Romance': 10749, 'Ciencia Ficción': 878, 'Thriller': 53, 'Bélica': 10752,
};

// Épocas por edad: cada género se muestrea estratificado por época para que
// un solo ranking (dominado por franquicias recientes) no capture todo el pool
const ERAS: Record<string, [number, number | null][]> = {
  young:  [[2000, 2012], [2013, null]],
  mid:    [[2000, 2012], [2013, null]],
  adult:  [[2000, 2012], [2013, null]],
  senior: [[2000, 2012], [2013, null]],
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

// Era bucket: agrupa el año en un período cultural reconocible
export function eraBucket(year: number): string {
  if (year < 1980) return 'clásico';
  if (year < 1990) return '80s';
  if (year < 2000) return '90s';
  if (year < 2010) return '00s';
  if (year < 2020) return '10s';
  return '20s';
}

// Feature extraction: genera tokens multi-dimensionales para el perfil de gusto.
// g:Genre (peso 1.0), p:A+B pares de géneros (0.6), e:era (0.3), t:tono (0.3)
export function featuresOf(t: NormalizedTitle): string[] {
  const feats: string[] = [];
  for (const g of t.genres) feats.push(`g:${g}`);
  const sg = [...t.genres].sort();
  for (let i = 0; i < sg.length; i++) {
    for (let j = i + 1; j < sg.length; j++) feats.push(`p:${sg[i]}+${sg[j]}`);
  }
  if (t.year) feats.push(`e:${eraBucket(t.year)}`);
  if (t.rating >= 7.8) feats.push('t:prestigio');
  if (t.rating > 0 && t.rating <= 7.0) feats.push('t:palomitera');
  return feats;
}

async function fetchTopVoted(opts: {
  genres?: number[];        // OR entre géneros (pipe)
  withoutGenres?: number[]; // géneros excluidos
  yearFrom?: number;
  yearTo?: number;
  minVotes: number;
  maxVotes?: number;        // techo de votos → culto/nicho
  minRating?: number;       // vote_average.gte → prestigio
  maxRating?: number;       // vote_average.lte → palomitera/guilty pleasure
  language?: string;        // with_original_language
  originCountry?: string;   // with_origin_country (ej: 'AR')
  withoutKeywords?: string; // keywords excluidas (pipe)
  sortBy?: 'vote_count.desc' | 'vote_average.desc' | 'popularity.desc';
}): Promise<NormalizedTitle[]> {
  const p: Record<string, string> = {
    'vote_count.gte': String(opts.minVotes),
    sort_by: opts.sortBy ?? 'vote_count.desc',
    page: '1',
  };
  if (opts.maxVotes)  p['vote_count.lte']   = String(opts.maxVotes);
  if (opts.minRating) p['vote_average.gte'] = String(opts.minRating);
  if (opts.maxRating) p['vote_average.lte'] = String(opts.maxRating);
  if (opts.genres?.length)        p.with_genres = opts.genres.join('|');
  if (opts.withoutGenres?.length) p.without_genres = opts.withoutGenres.join(',');
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
function franchiseKey(t: NormalizedTitle): string {
  const words = (t.originalTitle ?? t.title)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !TITLE_STOPWORDS.has(w));
  return words[0] ?? t.title.toLowerCase();
}

// Estreno reciente garantizado en TODOS los rangos de edad — el de 70 también
// quiere ver lo nuevo. La era es pista de reconocimiento, no jaula de gusto.
const RECENT_CUTOFF = 2022;

async function fetchRecognitionPool(
  ageRange: string,
  genreIds: number[],
  poolSize: number,
): Promise<NormalizedTitle[]> {
  const eras     = ERAS[ageRange] ?? ERAS.adult;
  const nE       = eras.length;
  const yearFrom = eras[0][0];
  const TARGET   = poolSize;
  // Excluir géneros fuertes no elegidos de TODAS las queries
  const withoutGenres = STRONG_GENRES.filter(g => !genreIds.includes(g));
  const userGenres = genreIds.length > 0 ? genreIds : DEFAULT_GENRE_IDS;

  // Reconocimiento por género × época (vote_count.desc = "cuánta gente la vio")
  const genreEraReqs = genreIds.flatMap(g =>
    eras.map(([from, to]) =>
      fetchTopVoted({
        genres: [g], withoutGenres, yearFrom: from, yearTo: to ?? undefined,
        minVotes: from < 2000 ? 1500 : 3000,
        language: 'en', withoutKeywords: FRANCHISE_KEYWORDS,
      }).catch(() => [] as NormalizedTitle[])
    )
  );

  const [
    genreEraLists, blockbusters, recentReleases,
    guiltyPleasures, cultClassics, localTop, localGenre, wildcardList,
  ] = await Promise.all([
    Promise.all(genreEraReqs),
    // Blockbusters globales de su era — efecto "el algoritmo me conoce"
    fetchTopVoted({ withoutGenres, yearFrom, minVotes: 15000, language: 'en' })
      .catch(() => [] as NormalizedTitle[]),
    // Estrenos recientes (2022+) — SIEMPRE, sin importar la edad
    fetchTopVoted({ withoutGenres, genres: userGenres, yearFrom: RECENT_CUTOFF, minVotes: 800,
      language: 'en', withoutKeywords: FRANCHISE_KEYWORDS })
      .catch(() => [] as NormalizedTitle[]),
    // Palomitera: muy vista pero rating bajo → separa al exigente del que goza el blockbuster
    fetchTopVoted({ withoutGenres, genres: userGenres, yearFrom, minVotes: 20000, maxRating: 6.6,
      language: 'en' })
      .catch(() => [] as NormalizedTitle[]),
    // Culto/prestigio: rating alto, votos medios → separa al cinéfilo del mainstream
    fetchTopVoted({ withoutGenres, genres: userGenres, yearFrom, minVotes: 2000, maxVotes: 25000,
      minRating: 7.8, sortBy: 'vote_average.desc', withoutKeywords: FRANCHISE_KEYWORDS })
      .catch(() => [] as NormalizedTitle[]),
    // Cine argentino — reconocimiento local
    fetchTopVoted({ withoutGenres, originCountry: 'AR', yearFrom, minVotes: 300 })
      .catch(() => [] as NormalizedTitle[]),
    fetchTopVoted({ withoutGenres, originCountry: 'AR', genres: genreIds, yearFrom, minVotes: 100 })
      .catch(() => [] as NormalizedTitle[]),
    fetchWildcards(withoutGenres).catch(() => [] as NormalizedTitle[]),
  ]);

  const seenIds = new Set<number>();
  const seenFranchise = new Set<string>();
  const pool: NormalizedTitle[] = [];

  const seenCollections = new Set<number>();

  const push = (t: NormalizedTitle, isAnchor: boolean): boolean => {
    if (seenIds.has(t.tmdbId)) return false;
    const fk = franchiseKey(t);
    if (seenFranchise.has(fk)) return false;
    if (t.collectionId && seenCollections.has(t.collectionId)) return false;
    seenIds.add(t.tmdbId);
    seenFranchise.add(fk);
    if (t.collectionId) seenCollections.add(t.collectionId);
    pool.push({ ...t, isAnchor });
    return true;
  };

  // Elige al azar entre los topK más votados (reconocibles igual, varía entre corridas)
  const pickRandom = (list: NormalizedTitle[], isAnchor: boolean, topK = 6): boolean => {
    for (const t of shuffle(list.slice(0, topK))) if (push(t, isAnchor)) return true;
    for (const t of list.slice(topK)) if (push(t, isAnchor)) return true;
    return false;
  };

  // ── Anchors de reconocimiento (se muestran sí o sí) ──
  pickRandom(blockbusters, true);
  pickRandom(blockbusters, true);
  pickRandom(localTop,  true, 3);   // 1 argentina general
  pickRandom(localGenre, true, 3);  // 1 argentina de sus géneros

  // ── Sondas de eje garantizadas (anchor): si no se muestran, el eje no se mide ──
  pickRandom(recentReleases, true, 8);                      // 1 estreno reciente garantizado

  // ── Sondas de discriminación (no-anchor: el motor adaptativo decide mostrarlas) ──
  pickRandom(recentReleases,  false, 8);
  pickRandom(guiltyPleasures, false, 10);  // alimenta el feature t:palomitera
  pickRandom(guiltyPleasures, false, 10);
  pickRandom(cultClassics,    false, 8);   // alimenta el feature t:prestigio
  pickRandom(cultClassics,    false, 8);

  // ── Wildcards: 4 al azar entre las top-200 más votadas (en|es) ──
  let wildcardCount = 0;
  for (const t of shuffle(wildcardList)) {
    if (wildcardCount >= 4) break;
    if (push(t, false)) wildcardCount++;
  }

  // ── Actor-pair: 2 películas del mismo actor para calibrar "factor actoral" ──
  const anchorForActor = shuffle([...blockbusters, ...recentReleases])[0];
  if (anchorForActor) {
    try {
      const actorMovies = await fetchActorPair(anchorForActor.tmdbId, userGenres, withoutGenres);
      let actorPicked = 0;
      for (const t of actorMovies) {
        if (actorPicked >= 2) break;
        if (push(t, false)) actorPicked++;
      }
    } catch { /* ignorar */ }
  }

  // Géneros × épocas: round-robin alternando época para cada género;
  // primera pasada por género = anchor de ese género
  let round = 0;
  while (pool.length < TARGET) {
    let added = false;
    for (let g = 0; g < genreIds.length && pool.length < TARGET; g++) {
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

export async function fetchOnboardingPool(
  ageRange?: string,
  tone?: string,
  selectedGenres: string[] = [],
  poolSize = 60, // lo define el caller: máximo de cartas + reserva para reemplazos
): Promise<NormalizedTitle[]> {
  // Onboarding (sin tone): siempre recognition pool; sin géneros usa el set default
  if (!tone) {
    const genreIds = selectedGenres
      .map(g => GENRE_NAME_TO_ID[g])
      .filter((id): id is number => id !== undefined);
    return fetchRecognitionPool(ageRange ?? 'adult', genreIds.length > 0 ? genreIds : DEFAULT_GENRE_IDS, poolSize);
  }

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

// 4 películas al azar entre las top-200 más votadas (en|es, desde 2000)
async function fetchWildcards(withoutGenres: number[]): Promise<NormalizedTitle[]> {
  const page = Math.floor(Math.random() * 10) + 1; // páginas 1-10 = top 200
  const p: Record<string, string> = {
    'vote_count.gte': '80000',
    sort_by: 'vote_count.desc',
    with_original_language: 'en|es',
    'primary_release_date.gte': '2000-01-01',
    without_keywords: FRANCHISE_KEYWORDS,
    page: String(page),
  };
  if (withoutGenres.length) p.without_genres = withoutGenres.join(',');
  const qs = Object.entries(p).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  const data = await tmdbGet(`/discover/movie?${qs}`) as { results: Record<string, unknown>[] };
  return shuffle(
    data.results.map(r => parseDiscoverResult(r, 'movie')).filter(t => t.posterPath && t.year >= 2000)
  );
}

// Trae 1-2 películas de un actor popular de la lista, para calibrar el "factor actoral"
async function fetchActorPair(
  candidateMovieId: number,
  userGenres: number[],
  withoutGenres: number[],
): Promise<NormalizedTitle[]> {
  const credits = await tmdbGet(`/movie/${candidateMovieId}/credits`) as {
    cast: { id: number; order: number }[];
  };
  const actorId = credits.cast.find(c => c.order < 3)?.id;
  if (!actorId) return [];
  const p: Record<string, string> = {
    with_cast: String(actorId),
    'vote_count.gte': '5000',
    sort_by: 'vote_count.desc',
    'primary_release_date.gte': '2000-01-01',
    without_keywords: FRANCHISE_KEYWORDS,
    page: '1',
  };
  if (userGenres.length)    p.with_genres    = userGenres.join('|');
  if (withoutGenres.length) p.without_genres = withoutGenres.join(',');
  const qs = Object.entries(p).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  const data = await tmdbGet(`/discover/movie?${qs}`) as { results: Record<string, unknown>[] };
  return data.results
    .map(r => parseDiscoverResult(r, 'movie'))
    .filter(t => t.posterPath && t.year >= 2000)
    .slice(0, 5);
}

// ─── Deepening batch ─────────────────────────────────────────────────────────
// Triggered at card ~12 when top genres are confirmed; fetches sub-genre specific
// titles via AND joins, prestige tier, and palomitero tier. Merged into the pool
// so future cards probe confirmed taste more deeply (Phase 2).

export async function fetchDeepeningBatch(
  topGenreIds: number[],
  companionIds: number[],
  ageRange = 'adult',
  excludeGenreIds: number[] = [],
  maxSize = 40,
): Promise<NormalizedTitle[]> {
  if (topGenreIds.length === 0) return [];

  const seenKeys = new Set<string>();
  const seenIds  = new Set<number>();
  const batch: NormalizedTitle[] = [];

  function collect(titles: NormalizedTitle[]) {
    for (const t of titles) {
      if (seenIds.has(t.tmdbId)) continue;
      const fk = franchiseKey(t);
      if (seenKeys.has(fk)) continue;
      seenIds.add(t.tmdbId);
      seenKeys.add(fk);
      batch.push(t);
    }
  }

  const strongExclude = STRONG_GENRES.filter(
    id => !topGenreIds.includes(id) && !companionIds.includes(id) && !excludeGenreIds.includes(id),
  );

  const eras = ERAS[ageRange] ?? ERAS.adult;
  const yearFrom = eras[0][0];

  // Main genre × companion AND joins (specific sub-genres)
  for (const mainId of topGenreIds.slice(0, 3)) {
    for (const compId of companionIds.slice(0, 2)) {
      try {
        const res = await fetchTopVoted({
          genres: [mainId, compId],
          withoutGenres: strongExclude,
          withoutKeywords: FRANCHISE_KEYWORDS,
          yearFrom,
          minVotes: 1000,
        });
        collect(res.slice(0, 6));
      } catch { /* ignore */ }
    }
  }

  // Prestige tier (critic-approved, high rating)
  try {
    const res = await fetchTopVoted({
      genres: topGenreIds,
      withoutGenres: strongExclude,
      yearFrom,
      minVotes: 5000,
    });
    collect(res.filter(t => t.rating >= 7.8).slice(0, 10));
  } catch { /* ignore */ }

  // Palomitero tier (crowd-pleasing, accessible)
  try {
    const res = await fetchTopVoted({
      genres: topGenreIds,
      withoutGenres: strongExclude,
      withoutKeywords: FRANCHISE_KEYWORDS,
      yearFrom,
      minVotes: 10000,
    });
    collect(res.filter(t => t.rating > 0 && t.rating <= 7.2).slice(0, 10));
  } catch { /* ignore */ }

  return batch.slice(0, maxSize);
}
