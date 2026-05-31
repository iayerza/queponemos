// Títulos de onboarding — 20 títulos balanceados por género
// Objetivo: cubrir el espacio de gustos sin sesgar hacia ningún género
//
// Distribución:
//   Drama:             Parasite, Succession, Oppenheimer, Shōgun, Slow Horses
//   Comedia / Comedia dramática: The Bear, Fleabag, The Rehearsal, The Holdovers
//   Romance / Drama romántico: Past Lives, Marriage Story, La La Land
//   Thriller / Crimen:  Pulp Fiction, Knives Out, White Lotus
//   Sci-Fi (solo 2):   Severance, Everything Everywhere
//   Terror:            Hereditary
//   Fantasía / Drama:  Poor Things

export const ONBOARDING_IDS: { tmdbId: number; type: 'movie' | 'tv' }[] = [
  // Drama
  { tmdbId: 496243, type: 'movie' }, // Parasite
  { tmdbId: 73586,  type: 'tv'    }, // Succession
  { tmdbId: 872585, type: 'movie' }, // Oppenheimer
  { tmdbId: 126308, type: 'tv'    }, // Shōgun
  { tmdbId: 84773,  type: 'tv'    }, // Slow Horses

  // Comedia / drama ligero
  { tmdbId: 136315, type: 'tv'    }, // The Bear
  { tmdbId: 66788,  type: 'tv'    }, // Fleabag
  { tmdbId: 130392, type: 'tv'    }, // The Rehearsal
  { tmdbId: 753342, type: 'movie' }, // The Holdovers

  // Romance / drama romántico
  { tmdbId: 951491, type: 'movie' }, // Past Lives
  { tmdbId: 492188, type: 'movie' }, // Marriage Story
  { tmdbId: 313369, type: 'movie' }, // La La Land

  // Thriller / crimen
  { tmdbId: 680,    type: 'movie' }, // Pulp Fiction
  { tmdbId: 546554, type: 'movie' }, // Knives Out
  { tmdbId: 119051, type: 'tv'    }, // The White Lotus

  // Sci-Fi (solo 2)
  { tmdbId: 95396,  type: 'tv'    }, // Severance
  { tmdbId: 545611, type: 'movie' }, // Everything Everywhere All at Once

  // Terror
  { tmdbId: 482571, type: 'movie' }, // Hereditary

  // Fantasía / drama
  { tmdbId: 792307, type: 'movie' }, // Poor Things

  // Acción / aventura
  { tmdbId: 361743, type: 'movie' }, // Top Gun: Maverick
];
