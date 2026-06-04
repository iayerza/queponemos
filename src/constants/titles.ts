// 30 títulos de onboarding — todos en IMDB Top 250 o top global
// 18 series · 12 películas — géneros balanceados con extremos marcados

export const ONBOARDING_IDS: { tmdbId: number; type: 'movie' | 'tv' }[] = [
  // Drama
  { tmdbId: 278,    type: 'movie' }, // The Shawshank Redemption  — IMDB #1
  { tmdbId: 4613,   type: 'tv'    }, // Band of Brothers          — IMDB #2 TV
  { tmdbId: 87108,  type: 'tv'    }, // Chernobyl                 — IMDB #3 TV
  { tmdbId: 76331,  type: 'tv'    }, // Succession
  { tmdbId: 126308, type: 'tv'    }, // Shōgun
  { tmdbId: 872585, type: 'movie' }, // Oppenheimer

  // Crimen / Thriller
  { tmdbId: 1396,   type: 'tv'    }, // Breaking Bad              — IMDB #1 TV
  { tmdbId: 1398,   type: 'tv'    }, // The Sopranos
  { tmdbId: 680,    type: 'movie' }, // Pulp Fiction              — IMDB #8
  { tmdbId: 496243, type: 'movie' }, // Parasite
  { tmdbId: 93405,  type: 'tv'    }, // Squid Game
  { tmdbId: 60059,  type: 'tv'    }, // Better Call Saul

  // Comedia
  { tmdbId: 2316,   type: 'tv'    }, // The Office (US)           — ★ extremo
  { tmdbId: 61662,  type: 'tv'    }, // Schitt's Creek            — ★ extremo feel-good
  { tmdbId: 97546,  type: 'tv'    }, // Ted Lasso
  { tmdbId: 67070,  type: 'tv'    }, // Fleabag
  { tmdbId: 840430, type: 'movie' }, // The Holdovers

  // Romance
  { tmdbId: 639,    type: 'movie' }, // When Harry Met Sally      — ★ extremo rom-com
  { tmdbId: 492188, type: 'movie' }, // Marriage Story
  { tmdbId: 89905,  type: 'tv'    }, // Normal People

  // Fantasía / Aventura
  { tmdbId: 1399,   type: 'tv'    }, // Game of Thrones
  { tmdbId: 129,    type: 'movie' }, // Spirited Away             — ★ extremo animación
  { tmdbId: 155,    type: 'movie' }, // The Dark Knight

  // Terror
  { tmdbId: 419430, type: 'movie' }, // Get Out                   — ★ extremo terror
  { tmdbId: 482571, type: 'movie' }, // Hereditary

  // Acción
  { tmdbId: 76341,  type: 'movie' }, // Mad Max: Fury Road        — ★ extremo acción

  // Sci-Fi
  { tmdbId: 95396,  type: 'tv'    }, // Severance
  { tmdbId: 545611, type: 'movie' }, // Everything Everywhere

  // Misterio / Drama
  { tmdbId: 111803, type: 'tv'    }, // The White Lotus
  { tmdbId: 666277, type: 'movie' }, // Past Lives
];
