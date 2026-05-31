// Títulos de onboarding — 20 títulos balanceados por género
// 12 series · 8 películas
//
// Distribución:
//   Drama:             Parasite, Succession, Oppenheimer, Shōgun, Slow Horses, Chernobyl
//   Comedia / drama:   The Bear, Fleabag, The Rehearsal, The Holdovers, Ted Lasso
//   Romance:           Past Lives, Marriage Story, Normal People
//   Thriller / crimen: Breaking Bad, White Lotus, Hereditary
//   Sci-Fi (solo 2):   Severance, Everything Everywhere
//   Fantasía / drama:  Poor Things

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

  // Terror
  { tmdbId: 482571, type: 'movie' }, // Hereditary

  // Sci-Fi (solo 2)
  { tmdbId: 95396,  type: 'tv'    }, // Severance
  { tmdbId: 545611, type: 'movie' }, // Everything Everywhere All at Once

  // Fantasía / drama
  { tmdbId: 792307, type: 'movie' }, // Poor Things
];
