// Títulos de onboarding — 25 títulos
// Todos en IMDB Top 250 o entre los más vistos globalmente.
// 15 series · 10 películas — géneros balanceados.
//
// Fuente de ranking: IMDB Top 250 Movies, IMDB Top 250 TV Shows (via TMDB list 8647022)

export const ONBOARDING_IDS: { tmdbId: number; type: 'movie' | 'tv' }[] = [

  // ── DRAMA ───────────────────────────────────────────────────────────────────
  { tmdbId: 278,    type: 'movie' }, // The Shawshank Redemption  — IMDB #1 all-time
  { tmdbId: 4253,   type: 'tv'    }, // Band of Brothers          — IMDB #2 TV
  { tmdbId: 87108,  type: 'tv'    }, // Chernobyl                 — IMDB #3 TV
  { tmdbId: 73586,  type: 'tv'    }, // Succession
  { tmdbId: 126308, type: 'tv'    }, // Shōgun

  // ── CRIMEN / THRILLER ───────────────────────────────────────────────────────
  { tmdbId: 1396,   type: 'tv'    }, // Breaking Bad              — IMDB #1 TV
  { tmdbId: 1398,   type: 'tv'    }, // The Sopranos              — IMDB top 10 TV
  { tmdbId: 680,    type: 'movie' }, // Pulp Fiction              — IMDB #8 movie
  { tmdbId: 496243, type: 'movie' }, // Parasite                  — IMDB top 30
  { tmdbId: 93405,  type: 'tv'    }, // Squid Game                — más visto globalmente

  // ── COMEDIA ─────────────────────────────────────────────────────────────────
  { tmdbId: 2316,   type: 'tv'    }, // The Office (US)           — IMDB top 30 TV ★ extremo
  { tmdbId: 64216,  type: 'tv'    }, // Schitt's Creek            — ★ extremo feel-good
  { tmdbId: 97546,  type: 'tv'    }, // Ted Lasso
  { tmdbId: 66788,  type: 'tv'    }, // Fleabag

  // ── ROMANCE ─────────────────────────────────────────────────────────────────
  { tmdbId: 639,    type: 'movie' }, // When Harry Met Sally      — ★ extremo rom-com clásica
  { tmdbId: 492188, type: 'movie' }, // Marriage Story
  { tmdbId: 103596, type: 'tv'    }, // Normal People

  // ── FANTASÍA / AVENTURA ─────────────────────────────────────────────────────
  { tmdbId: 1399,   type: 'tv'    }, // Game of Thrones           — IMDB top 10 TV
  { tmdbId: 129,    type: 'movie' }, // Spirited Away             — IMDB top 30 ★ extremo animación
  { tmdbId: 155,    type: 'movie' }, // The Dark Knight           — IMDB #3

  // ── ACCIÓN PURA ─────────────────────────────────────────────────────────────
  { tmdbId: 76341,  type: 'movie' }, // Mad Max: Fury Road        — ★ extremo acción

  // ── TERROR ──────────────────────────────────────────────────────────────────
  { tmdbId: 419430, type: 'movie' }, // Get Out                   — ★ extremo terror moderno

  // ── SCI-FI ──────────────────────────────────────────────────────────────────
  { tmdbId: 95396,  type: 'tv'    }, // Severance
  { tmdbId: 545611, type: 'movie' }, // Everything Everywhere All at Once

  // ── MISTERIO / DRAMA ────────────────────────────────────────────────────────
  { tmdbId: 119051, type: 'tv'    }, // The White Lotus
];
