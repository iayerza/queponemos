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

// Distribución 3-1-1: 3 anchors en bloque 0-9, 1 en 10-19, 1 en 20-29
function placeAnchors(anchors: NormalizedTitle[], disc: NormalizedTitle[]): NormalizedTitle[] {
  const sa = shuffle(anchors.slice(0, 5)).map(t => ({ ...t, isAnchor: true }));
  const sd = shuffle(disc.slice(0, 25)).map(t => ({ ...t, isAnchor: false }));
  const block1 = shuffle([...sa.slice(0, 3), ...sd.slice(0, 7)]);
  const block2 = shuffle([...sa.slice(3, 4), ...sd.slice(7, 16)]);
  const block3 = shuffle([...sa.slice(4, 5), ...sd.slice(16, 25)]);
  return [...block1, ...block2, ...block3];
}

interface DiscoverSlot {
  media: 'movie' | 'tv'; genre: number;
  yearFrom?: number; yearTo?: number;
  minRating?: number; minVotes?: number; pick: number;
  sortBy?: 'vote_average.desc' | 'popularity.desc'; language?: string;
}

const MG = { action:28, adventure:12, animation:16, comedy:35, crime:80, drama:18, horror:27, romance:10749, scifi:878, thriller:53 } as const;
const TG = { comedy:35, crime:80, drama:18, scifiFantasy:10765, mystery:9648 } as const;

async function fetchDiscoverSlot(slot: DiscoverSlot): Promise<NormalizedTitle[]> {
  const page = slot.sortBy === 'popularity.desc' ? 1 : Math.ceil(Math.random() * 3);
  const p: Record<string, string> = {
    with_genres: String(slot.genre),
    'vote_count.gte': String(slot.minVotes ?? 500),
    sort_by: slot.sortBy ?? 'vote_average.desc',
    with_original_language: slot.language ?? 'en|es',
    page: String(page),
  };
  if (slot.minRating) p['vote_average.gte'] = String(slot.minRating);
  if (slot.yearFrom) p[slot.media === 'movie' ? 'primary_release_date.gte' : 'first_air_date.gte'] = `${slot.yearFrom}-01-01`;
  if (slot.yearTo)   p[slot.media === 'movie' ? 'primary_release_date.lte' : 'first_air_date.lte'] = `${slot.yearTo}-12-31`;
  const qs = Object.entries(p).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  const data = await tmdbGet(`/discover/${slot.media}?${qs}`) as { results: Record<string, unknown>[] };
  return shuffle(
    data.results.map(r => parseDiscoverResult(r, slot.media)).filter(t => t.posterPath && t.year > 0)
  ).slice(0, slot.pick);
}

const ANCHOR_SLOTS: Record<string, DiscoverSlot[]> = {
  young: [
    { media:'movie', genre:MG.action,    yearFrom:2000, minVotes:500000, sortBy:'popularity.desc', language:'en', pick:1 },
    { media:'movie', genre:MG.scifi,     yearFrom:2000, minVotes:500000, sortBy:'popularity.desc', language:'en', pick:1 },
    { media:'movie', genre:MG.animation, yearFrom:2000, minVotes:500000, sortBy:'popularity.desc', language:'en', pick:1 },
    { media:'movie', genre:MG.thriller,  yearFrom:2000, minVotes:300000, sortBy:'popularity.desc', language:'en', pick:1 },
    { media:'movie', genre:MG.drama,     yearFrom:2000, minVotes:30000,  sortBy:'popularity.desc', language:'es', pick:1 },
  ],
  mid: [
    { media:'movie', genre:MG.action,    yearFrom:1995, minVotes:500000, sortBy:'popularity.desc', language:'en', pick:1 },
    { media:'movie', genre:MG.drama,     yearFrom:1995, minVotes:500000, sortBy:'popularity.desc', language:'en', pick:1 },
    { media:'movie', genre:MG.thriller,  yearFrom:1995, minVotes:500000, sortBy:'popularity.desc', language:'en', pick:1 },
    { media:'movie', genre:MG.scifi,     yearFrom:1995, minVotes:500000, sortBy:'popularity.desc', language:'en', pick:1 },
    { media:'movie', genre:MG.drama,                    minVotes:30000,  sortBy:'popularity.desc', language:'es', pick:1 },
  ],
  adult: [
    { media:'movie', genre:MG.action,    yearFrom:1990, minVotes:500000, sortBy:'popularity.desc', language:'en', pick:1 },
    { media:'movie', genre:MG.drama,     yearFrom:1990, minVotes:500000, sortBy:'popularity.desc', language:'en', pick:1 },
    { media:'movie', genre:MG.thriller,  yearFrom:1990, minVotes:500000, sortBy:'popularity.desc', language:'en', pick:1 },
    { media:'movie', genre:MG.romance,   yearFrom:1990, minVotes:300000, sortBy:'popularity.desc', language:'en', pick:1 },
    { media:'movie', genre:MG.drama,                    minVotes:30000,  sortBy:'popularity.desc', language:'es', pick:1 },
  ],
  senior: [
    { media:'movie', genre:MG.drama,     yearFrom:1970, minVotes:500000, sortBy:'popularity.desc', language:'en', pick:1 },
    { media:'movie', genre:MG.thriller,  yearFrom:1970, minVotes:500000, sortBy:'popularity.desc', language:'en', pick:1 },
    { media:'movie', genre:MG.crime,     yearFrom:1970, minVotes:500000, sortBy:'popularity.desc', language:'en', pick:1 },
    { media:'movie', genre:MG.romance,   yearFrom:1970, minVotes:200000, sortBy:'popularity.desc', language:'en', pick:1 },
    { media:'movie', genre:MG.drama,                    minVotes:30000,  sortBy:'popularity.desc', language:'es', pick:1 },
  ],
};

const ONBOARDING_SLOTS: Record<string, DiscoverSlot[]> = {
  young: [
    { media:'movie', genre:MG.action,    yearTo:1989,               minRating:7.5, minVotes:3000,  pick:1 },
    { media:'movie', genre:MG.scifi,     yearTo:1989,               minRating:7.5, minVotes:3000,  pick:1 },
    { media:'movie', genre:MG.animation, yearTo:2010,               minRating:7.5, minVotes:2000,  pick:1 },
    { media:'movie', genre:MG.action,    yearFrom:1990, yearTo:2009, minRating:7.0, minVotes:2000,  pick:1 },
    { media:'movie', genre:MG.scifi,     yearFrom:1990, yearTo:2009, minRating:7.0, minVotes:2000,  pick:1 },
    { media:'movie', genre:MG.comedy,    yearFrom:1990, yearTo:2009, minRating:6.8, minVotes:1000,  pick:1 },
    { media:'movie', genre:MG.horror,    yearFrom:1990, yearTo:2009, minRating:6.8, minVotes:1000,  pick:1 },
    { media:'movie', genre:MG.thriller,  yearFrom:1990, yearTo:2009, minRating:7.0, minVotes:2000,  pick:1 },
    { media:'movie', genre:MG.action,    yearFrom:2010, yearTo:2019, minRating:7.0, minVotes:10000, pick:2 },
    { media:'movie', genre:MG.drama,     yearFrom:2010, yearTo:2019, minRating:7.5, minVotes:1000,  pick:1 },
    { media:'movie', genre:MG.horror,    yearFrom:2010, yearTo:2019, minRating:7.0, minVotes:1000,  pick:2 },
    { media:'movie', genre:MG.romance,   yearFrom:2010, yearTo:2019, minRating:7.0, minVotes:1000,  pick:1 },
    { media:'movie', genre:MG.animation, yearFrom:2010, yearTo:2019, minRating:7.0, minVotes:1000,  pick:1 },
    { media:'movie', genre:MG.action,    yearFrom:2020,              minRating:7.0, minVotes:500,   pick:2 },
    { media:'movie', genre:MG.drama,     yearFrom:2020,              minRating:7.0, minVotes:500,   pick:1 },
    { media:'movie', genre:MG.horror,    yearFrom:2020,              minRating:7.0, minVotes:500,   pick:1 },
    { media:'tv',    genre:TG.drama,                                 minRating:8.0, minVotes:500,   pick:3 },
    { media:'tv',    genre:TG.scifiFantasy,                          minRating:7.5, minVotes:300,   pick:3 },
    { media:'tv',    genre:TG.comedy,                                minRating:7.5, minVotes:300,   pick:2 },
    { media:'tv',    genre:TG.crime,                                 minRating:7.5, minVotes:300,   pick:2 },
    { media:'tv',    genre:TG.mystery,                               minRating:7.5, minVotes:300,   pick:1 },
  ],
  mid: [
    { media:'movie', genre:MG.drama,     yearTo:1989,               minRating:7.5, minVotes:3000,  pick:1 },
    { media:'movie', genre:MG.crime,     yearTo:1989,               minRating:7.5, minVotes:3000,  pick:1 },
    { media:'movie', genre:MG.thriller,  yearTo:1989,               minRating:7.5, minVotes:3000,  pick:1 },
    { media:'movie', genre:MG.drama,     yearFrom:1990, yearTo:2009, minRating:7.5, minVotes:2000,  pick:2 },
    { media:'movie', genre:MG.thriller,  yearFrom:1990, yearTo:2009, minRating:7.5, minVotes:2000,  pick:1 },
    { media:'movie', genre:MG.crime,     yearFrom:1990, yearTo:2009, minRating:7.5, minVotes:2000,  pick:1 },
    { media:'movie', genre:MG.comedy,    yearFrom:1990, yearTo:2009, minRating:7.0, minVotes:1000,  pick:1 },
    { media:'movie', genre:MG.romance,   yearFrom:1990, yearTo:2009, minRating:7.0, minVotes:2000,  pick:1 },
    { media:'movie', genre:MG.scifi,     yearFrom:1990, yearTo:2009, minRating:7.0, minVotes:1000,  pick:1 },
    { media:'movie', genre:MG.animation, yearFrom:1990, yearTo:2009, minRating:7.5, minVotes:2000,  pick:1 },
    { media:'movie', genre:MG.drama,     yearFrom:2010, yearTo:2019, minRating:7.5, minVotes:1000,  pick:2 },
    { media:'movie', genre:MG.thriller,  yearFrom:2010, yearTo:2019, minRating:7.0, minVotes:1000,  pick:2 },
    { media:'movie', genre:MG.action,    yearFrom:2010, yearTo:2019, minRating:7.0, minVotes:20000, pick:1 },
    { media:'movie', genre:MG.romance,   yearFrom:2010, yearTo:2019, minRating:7.0, minVotes:1000,  pick:1 },
    { media:'movie', genre:MG.drama,     yearFrom:2020,              minRating:7.5, minVotes:500,   pick:1 },
    { media:'movie', genre:MG.thriller,  yearFrom:2020,              minRating:7.0, minVotes:500,   pick:1 },
    { media:'movie', genre:MG.scifi,     yearFrom:2020,              minRating:7.0, minVotes:500,   pick:1 },
    { media:'tv',    genre:TG.drama,                                 minRating:8.0, minVotes:500,   pick:3 },
    { media:'tv',    genre:TG.crime,                                 minRating:8.0, minVotes:300,   pick:2 },
    { media:'tv',    genre:TG.comedy,                                minRating:7.5, minVotes:300,   pick:2 },
    { media:'tv',    genre:TG.scifiFantasy,                          minRating:7.5, minVotes:300,   pick:2 },
    { media:'tv',    genre:TG.mystery,                               minRating:7.5, minVotes:300,   pick:1 },
  ],
  adult: [
    { media:'movie', genre:MG.drama,     yearFrom:1990, yearTo:1999, minRating:7.5, minVotes:2000,  pick:1 },
    { media:'movie', genre:MG.thriller,  yearFrom:1990, yearTo:1999, minRating:7.5, minVotes:2000,  pick:1 },
    { media:'movie', genre:MG.comedy,    yearFrom:1990, yearTo:1999, minRating:7.0, minVotes:1000,  pick:1 },
    { media:'movie', genre:MG.romance,   yearFrom:1990, yearTo:1999, minRating:7.0, minVotes:2000,  pick:1 },
    { media:'movie', genre:MG.adventure, yearFrom:1990, yearTo:1999, minRating:7.0, minVotes:5000,  pick:1 },
    { media:'movie', genre:MG.drama,     yearFrom:2000, yearTo:2012, minRating:7.5, minVotes:2000,  pick:2 },
    { media:'movie', genre:MG.thriller,  yearFrom:2000, yearTo:2012, minRating:7.0, minVotes:1000,  pick:2 },
    { media:'movie', genre:MG.crime,     yearFrom:2000, yearTo:2012, minRating:7.5, minVotes:1000,  pick:1 },
    { media:'movie', genre:MG.comedy,    yearFrom:2000, yearTo:2012, minRating:7.0, minVotes:1000,  pick:1 },
    { media:'movie', genre:MG.action,    yearFrom:2000, yearTo:2012, minRating:7.5, minVotes:30000, pick:1 },
    { media:'movie', genre:MG.animation, yearFrom:2000, yearTo:2012, minRating:7.5, minVotes:5000,  pick:1 },
    { media:'movie', genre:MG.scifi,     yearFrom:2000, yearTo:2012, minRating:7.0, minVotes:1000,  pick:1 },
    { media:'movie', genre:MG.drama,     yearFrom:2013, yearTo:2021, minRating:7.5, minVotes:2000,  pick:2 },
    { media:'movie', genre:MG.thriller,  yearFrom:2013, yearTo:2021, minRating:7.0, minVotes:2000,  pick:2 },
    { media:'movie', genre:MG.comedy,    yearFrom:2013, yearTo:2021, minRating:7.0, minVotes:1000,  pick:1 },
    { media:'movie', genre:MG.romance,   yearFrom:2013, yearTo:2021, minRating:7.0, minVotes:1000,  pick:1 },
    { media:'movie', genre:MG.crime,     yearFrom:2013, yearTo:2021, minRating:7.5, minVotes:2000,  pick:1 },
    { media:'movie', genre:MG.drama,     yearFrom:2022,              minRating:7.0, minVotes:500,   pick:1 },
    { media:'movie', genre:MG.thriller,  yearFrom:2022,              minRating:7.0, minVotes:500,   pick:1 },
    { media:'tv',    genre:TG.drama,                                 minRating:8.0, minVotes:500,   pick:2 },
    { media:'tv',    genre:TG.crime,                                 minRating:8.0, minVotes:300,   pick:2 },
    { media:'tv',    genre:TG.comedy,                                minRating:7.5, minVotes:300,   pick:1 },
    { media:'tv',    genre:TG.scifiFantasy,                          minRating:7.5, minVotes:300,   pick:1 },
    { media:'tv',    genre:TG.mystery,                               minRating:7.5, minVotes:300,   pick:1 },
  ],
  senior: [
    { media:'movie', genre:MG.drama,     yearTo:1969,               minRating:7.5, minVotes:2000,  pick:1 },
    { media:'movie', genre:MG.crime,     yearTo:1969,               minRating:7.5, minVotes:2000,  pick:1 },
    { media:'movie', genre:MG.comedy,    yearTo:1969,               minRating:7.5, minVotes:1000,  pick:1 },
    { media:'movie', genre:MG.drama,     yearFrom:1970, yearTo:1989, minRating:7.5, minVotes:2000,  pick:3 },
    { media:'movie', genre:MG.thriller,  yearFrom:1970, yearTo:1989, minRating:7.5, minVotes:2000,  pick:2 },
    { media:'movie', genre:MG.crime,     yearFrom:1970, yearTo:1989, minRating:7.5, minVotes:2000,  pick:1 },
    { media:'movie', genre:MG.comedy,    yearFrom:1970, yearTo:1989, minRating:7.0, minVotes:1000,  pick:1 },
    { media:'movie', genre:MG.romance,   yearFrom:1970, yearTo:1989, minRating:7.0, minVotes:1000,  pick:1 },
    { media:'movie', genre:MG.drama,     yearFrom:1990, yearTo:2010, minRating:7.5, minVotes:2000,  pick:2 },
    { media:'movie', genre:MG.thriller,  yearFrom:1990, yearTo:2010, minRating:7.5, minVotes:2000,  pick:1 },
    { media:'movie', genre:MG.comedy,    yearFrom:1990, yearTo:2010, minRating:7.0, minVotes:1000,  pick:1 },
    { media:'movie', genre:MG.romance,   yearFrom:1990, yearTo:2010, minRating:7.0, minVotes:2000,  pick:1 },
    { media:'movie', genre:MG.crime,     yearFrom:1990, yearTo:2010, minRating:7.5, minVotes:2000,  pick:1 },
    { media:'movie', genre:MG.drama,     yearFrom:2010,              minRating:7.5, minVotes:1000,  pick:1 },
    { media:'movie', genre:MG.thriller,  yearFrom:2010,              minRating:7.5, minVotes:1000,  pick:1 },
    { media:'movie', genre:MG.comedy,    yearFrom:2010,              minRating:7.0, minVotes:1000,  pick:1 },
    { media:'tv',    genre:TG.drama,                                 minRating:8.0, minVotes:500,   pick:3 },
    { media:'tv',    genre:TG.crime,                                 minRating:8.0, minVotes:300,   pick:2 },
    { media:'tv',    genre:TG.comedy,                                minRating:7.5, minVotes:300,   pick:2 },
    { media:'tv',    genre:TG.mystery,                               minRating:7.5, minVotes:300,   pick:2 },
    { media:'tv',    genre:TG.drama,     yearFrom:1980, yearTo:2005, minRating:8.0, minVotes:200,   pick:1 },
  ],
};

export async function fetchOnboardingPool(ageRange = 'adult'): Promise<NormalizedTitle[]> {
  const anchorSlots = ANCHOR_SLOTS[ageRange] ?? ANCHOR_SLOTS.adult;
  const discSlots   = ONBOARDING_SLOTS[ageRange] ?? ONBOARDING_SLOTS.adult;

  const [anchorRes, discRes] = await Promise.all([
    Promise.allSettled(anchorSlots.map(fetchDiscoverSlot)),
    Promise.allSettled(discSlots.map(fetchDiscoverSlot)),
  ]);

  const seen    = new Set<number>();
  const anchors: NormalizedTitle[] = [];
  const disc:    NormalizedTitle[] = [];

  for (const r of anchorRes) {
    if (r.status === 'rejected') continue;
    for (const t of r.value) if (!seen.has(t.tmdbId)) { seen.add(t.tmdbId); anchors.push(t); }
  }
  for (const r of discRes) {
    if (r.status === 'rejected') continue;
    for (const t of r.value) if (!seen.has(t.tmdbId)) { seen.add(t.tmdbId); disc.push(t); }
  }

  return placeAnchors(anchors, disc);
}
