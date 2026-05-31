// Títulos de onboarding — 25 títulos balanceados por género
// 15 series · 10 películas
//
// Los extremos están marcados con ★ — títulos muy claramente posicionados
// en un género para capturar señales de gusto limpias.

export const ONBOARDING_IDS: { tmdbId: number; type: 'movie' | 'tv' }[] = [
  // Drama
  { tmdbId: 496243, type: 'movie' }, // Parasite
  { tmdbId: 73586,  type: 'tv'    }, // Succession
  { tmdbId: 872585, type: 'movie' }, // Oppenheimer
  { tmdbId: 126308, type: 'tv'    }, // Shōgun
  { tmdbId: 84773,  type: 'tv'    }, // Slow Horses
  { tmdbId: 87108,  type: 'tv'    }, // Chernobyl

  // Comedia / drama ligero
  { tmdbId: 136315, type: 'tv'    }, // The Bear
  { tmdbId: 66788,  type: 'tv'    }, // Fleabag
  { tmdbId: 130392, type: 'tv'    }, // The Rehearsal
  { tmdbId: 753342, type: 'movie' }, // The Holdovers
  { tmdbId: 97546,  type: 'tv'    }, // Ted Lasso

  // Romance / drama romántico
  { tmdbId: 951491, type: 'movie' }, // Past Lives
  { tmdbId: 492188, type: 'movie' }, // Marriage Story
  { tmdbId: 103596, type: 'tv'    }, // Normal People

  // Thriller / crimen
  { tmdbId: 1396,   type: 'tv'    }, // Breaking Bad
  { tmdbId: 119051, type: 'tv'    }, // The White Lotus

  // Sci-Fi
  { tmdbId: 95396,  type: 'tv'    }, // Severance
  { tmdbId: 545611, type: 'movie' }, // Everything Everywhere All at Once

  // Fantasía / drama
  { tmdbId: 792307, type: 'movie' }, // Poor Things

  // ★ Extremo — terror puro
  { tmdbId: 419430, type: 'movie' }, // Get Out

  // ★ Extremo — comedia pura / feel-good
  { tmdbId: 64216,  type: 'tv'    }, // Schitt's Creek

  // ★ Extremo — acción pura
  { tmdbId: 76341,  type: 'movie' }, // Mad Max: Fury Road

  // ★ Extremo — romance clásico / rom-com
  { tmdbId: 639,    type: 'movie' }, // When Harry Met Sally

  // ★ Extremo — crimen oscuro / psicológico
  { tmdbId: 67744,  type: 'tv'    }, // Mindhunter

  // ★ Extremo — terror
  { tmdbId: 482571, type: 'movie' }, // Hereditary
];
