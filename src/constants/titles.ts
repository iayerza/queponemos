// 30 títulos de onboarding — géneros balanceados con extremos marcados
// ~19 películas · ~11 series — mezcla de clásicos, 2000-2022 y estrenos recientes

export const ONBOARDING_IDS: { tmdbId: number; type: 'movie' | 'tv' }[] = [
  // Clásicos (pre-2000)
  { tmdbId: 278,    type: 'movie' }, // The Shawshank Redemption (1994)  — IMDB #1
  { tmdbId: 238,    type: 'movie' }, // The Godfather (1972)             — IMDB #2
  { tmdbId: 13,     type: 'movie' }, // Forrest Gump (1994)
  { tmdbId: 105,    type: 'movie' }, // Back to the Future (1985)
  { tmdbId: 329,    type: 'movie' }, // Jurassic Park (1993)
  { tmdbId: 680,    type: 'movie' }, // Pulp Fiction (1994)

  // Aventura / Fantasía / Acción (2000–2015)
  { tmdbId: 120,    type: 'movie' }, // The Lord of the Rings: FotR (2001) — IMDB top 10
  { tmdbId: 22,     type: 'movie' }, // Pirates of the Caribbean (2003)  — ★ aventura extremo
  { tmdbId: 155,    type: 'movie' }, // The Dark Knight (2008)
  { tmdbId: 27205,  type: 'movie' }, // Inception (2010)
  { tmdbId: 24428,  type: 'movie' }, // The Avengers (2012)              — ★ cómics/superhéroe
  { tmdbId: 245891, type: 'movie' }, // John Wick (2014)                 — ★ acción pura
  { tmdbId: 129,    type: 'movie' }, // El viaje de Chihiro (2001)       — ★ animación extremo

  // Comedia
  { tmdbId: 18785,  type: 'movie' }, // The Hangover (2009)              — ★ comedia extremo
  { tmdbId: 2316,   type: 'tv'    }, // The Office (2005)
  { tmdbId: 61662,  type: 'tv'    }, // Schitt's Creek (2015)
  { tmdbId: 67070,  type: 'tv'    }, // Fleabag (2016)

  // Terror / Thriller
  { tmdbId: 176,    type: 'movie' }, // Saw (2004)                       — ★ terror extremo
  { tmdbId: 419430, type: 'movie' }, // Get Out (2017)
  { tmdbId: 93405,  type: 'tv'    }, // Squid Game (2021)

  // Drama / Crimen
  { tmdbId: 1396,   type: 'tv'    }, // Breaking Bad (2008)              — IMDB #1 TV
  { tmdbId: 496243, type: 'movie' }, // Parasite (2019)

  // Ciencia Ficción / Misterio
  { tmdbId: 66732,  type: 'tv'    }, // Stranger Things (2016)
  { tmdbId: 95396,  type: 'tv'    }, // Severance (2022)

  // Feel-good / Workplace
  { tmdbId: 97546,  type: 'tv'    }, // Ted Lasso (2020)
  { tmdbId: 136315, type: 'tv'    }, // The Bear (2022)
  { tmdbId: 1399,   type: 'tv'    }, // Game of Thrones (2011)

  // Estrenos (2023–2026)
  { tmdbId: 872585, type: 'movie' }, // Oppenheimer (2023)
  { tmdbId: 693134, type: 'movie' }, // Dune: Part Two (2024)
  { tmdbId: 126308, type: 'tv'    }, // Shōgun (2024)
];
