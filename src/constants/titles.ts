// 30 títulos de onboarding — top 100 más vistas en LATAM
// 18 películas · 12 series — géneros balanceados con extremos marcados

export const ONBOARDING_IDS: { tmdbId: number; type: 'movie' | 'tv' }[] = [
  // Blockbusters / Superhéroes
  { tmdbId: 299534, type: 'movie' }, // Avengers: Endgame (2019)
  { tmdbId: 634649, type: 'movie' }, // Spider-Man: No Way Home (2021)   — ★ cómics
  { tmdbId: 155,    type: 'movie' }, // The Dark Knight (2008)

  // Ciencia Ficción
  { tmdbId: 19995,  type: 'movie' }, // Avatar (2009)
  { tmdbId: 27205,  type: 'movie' }, // Inception (2010)
  { tmdbId: 157336, type: 'movie' }, // Interstellar (2014)
  { tmdbId: 693134, type: 'movie' }, // Dune: Part Two (2024)

  // Aventura / Fantasía
  { tmdbId: 329,    type: 'movie' }, // Jurassic Park (1993)
  { tmdbId: 22,     type: 'movie' }, // Pirates of the Caribbean (2003)  — ★ aventura
  { tmdbId: 129,    type: 'movie' }, // El viaje de Chihiro (2001)       — ★ animación

  // Drama / Romance
  { tmdbId: 597,    type: 'movie' }, // Titanic (1997)
  { tmdbId: 13,     type: 'movie' }, // Forrest Gump (1994)
  { tmdbId: 872585, type: 'movie' }, // Oppenheimer (2023)

  // Terror / Thriller
  { tmdbId: 176,    type: 'movie' }, // Saw (2004)                       — ★ terror extremo
  { tmdbId: 419430, type: 'movie' }, // Get Out (2017)
  { tmdbId: 475557, type: 'movie' }, // Joker (2019)

  // Acción / Comedia
  { tmdbId: 245891, type: 'movie' }, // John Wick (2014)                 — ★ acción pura
  { tmdbId: 18785,  type: 'movie' }, // The Hangover (2009)              — ★ comedia extremo

  // Series — Crimen / Drama
  { tmdbId: 1396,   type: 'tv'    }, // Breaking Bad (2008)              — IMDB #1 TV
  { tmdbId: 1399,   type: 'tv'    }, // Game of Thrones (2011)
  { tmdbId: 71446,  type: 'tv'    }, // La Casa de Papel (2017)          — ★ LATAM esencial
  { tmdbId: 63351,  type: 'tv'    }, // Narcos (2015)                    — ★ LATAM esencial

  // Series — Suspenso / Sci-Fi
  { tmdbId: 93405,  type: 'tv'    }, // Squid Game (2021)
  { tmdbId: 66732,  type: 'tv'    }, // Stranger Things (2016)
  { tmdbId: 119051, type: 'tv'    }, // Wednesday (2022)

  // Series — Comedia / Feel-good
  { tmdbId: 1668,   type: 'tv'    }, // Friends (1994)
  { tmdbId: 2316,   type: 'tv'    }, // The Office (2005)

  // Series — Romance / Drama joven
  { tmdbId: 91239,  type: 'tv'    }, // Bridgerton (2020)
  { tmdbId: 100757, type: 'tv'    }, // Outer Banks (2020)
  { tmdbId: 76669,  type: 'tv'    }, // Elite (2018)                     — ★ España/LATAM
];
