import type { AgeRange } from '../navigation/types';

type TitleId = { tmdbId: number; type: 'movie' | 'tv' };

// <25 — acción, sci-fi, superhéroes, series del momento
const YOUNG: TitleId[] = [
  { tmdbId: 299534, type: 'movie' }, // Avengers: Endgame
  { tmdbId: 634649, type: 'movie' }, // Spider-Man: No Way Home  — ★ superhéroe
  { tmdbId: 155,    type: 'movie' }, // The Dark Knight
  { tmdbId: 19995,  type: 'movie' }, // Avatar
  { tmdbId: 27205,  type: 'movie' }, // Inception
  { tmdbId: 157336, type: 'movie' }, // Interstellar
  { tmdbId: 693134, type: 'movie' }, // Dune: Part Two
  { tmdbId: 329,    type: 'movie' }, // Jurassic Park
  { tmdbId: 22,     type: 'movie' }, // Pirates of the Caribbean — ★ aventura
  { tmdbId: 129,    type: 'movie' }, // El viaje de Chihiro     — ★ animación
  { tmdbId: 597,    type: 'movie' }, // Titanic
  { tmdbId: 13,     type: 'movie' }, // Forrest Gump
  { tmdbId: 872585, type: 'movie' }, // Oppenheimer
  { tmdbId: 176,    type: 'movie' }, // Saw                     — ★ terror
  { tmdbId: 419430, type: 'movie' }, // Get Out
  { tmdbId: 475557, type: 'movie' }, // Joker
  { tmdbId: 245891, type: 'movie' }, // John Wick               — ★ acción pura
  { tmdbId: 18785,  type: 'movie' }, // The Hangover            — ★ comedia
  { tmdbId: 1396,   type: 'tv'    }, // Breaking Bad
  { tmdbId: 1399,   type: 'tv'    }, // Game of Thrones
  { tmdbId: 71446,  type: 'tv'    }, // La Casa de Papel
  { tmdbId: 63351,  type: 'tv'    }, // Narcos
  { tmdbId: 93405,  type: 'tv'    }, // Squid Game
  { tmdbId: 66732,  type: 'tv'    }, // Stranger Things
  { tmdbId: 119051, type: 'tv'    }, // Wednesday
  { tmdbId: 1668,   type: 'tv'    }, // Friends
  { tmdbId: 2316,   type: 'tv'    }, // The Office
  { tmdbId: 91239,  type: 'tv'    }, // Bridgerton
  { tmdbId: 100757, type: 'tv'    }, // Outer Banks
  { tmdbId: 76669,  type: 'tv'    }, // Elite
];

// 25–35 — calidad cinematográfica, drama, thriller, prestige TV
const MID: TitleId[] = [
  { tmdbId: 27205,  type: 'movie' }, // Inception
  { tmdbId: 155,    type: 'movie' }, // The Dark Knight
  { tmdbId: 157336, type: 'movie' }, // Interstellar
  { tmdbId: 680,    type: 'movie' }, // Pulp Fiction
  { tmdbId: 550,    type: 'movie' }, // Fight Club
  { tmdbId: 769,    type: 'movie' }, // Goodfellas
  { tmdbId: 274,    type: 'movie' }, // The Silence of the Lambs
  { tmdbId: 807,    type: 'movie' }, // Se7en
  { tmdbId: 37799,  type: 'movie' }, // The Social Network
  { tmdbId: 210577, type: 'movie' }, // Gone Girl
  { tmdbId: 313369, type: 'movie' }, // La La Land
  { tmdbId: 496243, type: 'movie' }, // Parasite
  { tmdbId: 419430, type: 'movie' }, // Get Out
  { tmdbId: 475557, type: 'movie' }, // Joker
  { tmdbId: 13,     type: 'movie' }, // Forrest Gump
  { tmdbId: 597,    type: 'movie' }, // Titanic
  { tmdbId: 872585, type: 'movie' }, // Oppenheimer
  { tmdbId: 98,     type: 'movie' }, // Gladiator
  { tmdbId: 1396,   type: 'tv'    }, // Breaking Bad
  { tmdbId: 1398,   type: 'tv'    }, // The Sopranos
  { tmdbId: 1104,   type: 'tv'    }, // Mad Men
  { tmdbId: 46648,  type: 'tv'    }, // True Detective
  { tmdbId: 76331,  type: 'tv'    }, // Succession
  { tmdbId: 42009,  type: 'tv'    }, // Black Mirror
  { tmdbId: 1399,   type: 'tv'    }, // Game of Thrones
  { tmdbId: 71446,  type: 'tv'    }, // La Casa de Papel
  { tmdbId: 63351,  type: 'tv'    }, // Narcos
  { tmdbId: 93405,  type: 'tv'    }, // Squid Game
  { tmdbId: 67070,  type: 'tv'    }, // Fleabag
  { tmdbId: 66732,  type: 'tv'    }, // Stranger Things
];

// 36–50 — grandes clásicos modernos, drama maduro, prestige TV
const ADULT: TitleId[] = [
  { tmdbId: 238,    type: 'movie' }, // The Godfather
  { tmdbId: 769,    type: 'movie' }, // Goodfellas
  { tmdbId: 278,    type: 'movie' }, // The Shawshank Redemption
  { tmdbId: 424,    type: 'movie' }, // Schindler's List
  { tmdbId: 550,    type: 'movie' }, // Fight Club
  { tmdbId: 274,    type: 'movie' }, // The Silence of the Lambs
  { tmdbId: 807,    type: 'movie' }, // Se7en
  { tmdbId: 14,     type: 'movie' }, // American Beauty
  { tmdbId: 603,    type: 'movie' }, // The Matrix
  { tmdbId: 98,     type: 'movie' }, // Gladiator
  { tmdbId: 489,    type: 'movie' }, // Good Will Hunting
  { tmdbId: 13,     type: 'movie' }, // Forrest Gump
  { tmdbId: 597,    type: 'movie' }, // Titanic
  { tmdbId: 680,    type: 'movie' }, // Pulp Fiction
  { tmdbId: 497,    type: 'movie' }, // The Green Mile
  { tmdbId: 857,    type: 'movie' }, // Saving Private Ryan
  { tmdbId: 475557, type: 'movie' }, // Joker
  { tmdbId: 872585, type: 'movie' }, // Oppenheimer
  { tmdbId: 1398,   type: 'tv'    }, // The Sopranos
  { tmdbId: 1438,   type: 'tv'    }, // The Wire
  { tmdbId: 1396,   type: 'tv'    }, // Breaking Bad
  { tmdbId: 1104,   type: 'tv'    }, // Mad Men
  { tmdbId: 76331,  type: 'tv'    }, // Succession
  { tmdbId: 46648,  type: 'tv'    }, // True Detective
  { tmdbId: 1405,   type: 'tv'    }, // Dexter
  { tmdbId: 4613,   type: 'tv'    }, // Band of Brothers
  { tmdbId: 1399,   type: 'tv'    }, // Game of Thrones
  { tmdbId: 63351,  type: 'tv'    }, // Narcos
  { tmdbId: 71446,  type: 'tv'    }, // La Casa de Papel
  { tmdbId: 65494,  type: 'tv'    }, // The Crown
];

// 50+ — grandes clásicos, period drama, cine de autor
const SENIOR: TitleId[] = [
  { tmdbId: 238,    type: 'movie' }, // The Godfather
  { tmdbId: 240,    type: 'movie' }, // The Godfather Part II
  { tmdbId: 278,    type: 'movie' }, // The Shawshank Redemption
  { tmdbId: 424,    type: 'movie' }, // Schindler's List
  { tmdbId: 13,     type: 'movie' }, // Forrest Gump
  { tmdbId: 597,    type: 'movie' }, // Titanic
  { tmdbId: 98,     type: 'movie' }, // Gladiator
  { tmdbId: 857,    type: 'movie' }, // Saving Private Ryan
  { tmdbId: 489,    type: 'movie' }, // Good Will Hunting
  { tmdbId: 497,    type: 'movie' }, // The Green Mile
  { tmdbId: 769,    type: 'movie' }, // Goodfellas
  { tmdbId: 694,    type: 'movie' }, // The Shining
  { tmdbId: 105,    type: 'movie' }, // Back to the Future
  { tmdbId: 329,    type: 'movie' }, // Jurassic Park
  { tmdbId: 510,    type: 'movie' }, // One Flew Over the Cuckoo's Nest
  { tmdbId: 274,    type: 'movie' }, // The Silence of the Lambs
  { tmdbId: 872585, type: 'movie' }, // Oppenheimer
  { tmdbId: 603,    type: 'movie' }, // The Matrix
  { tmdbId: 65494,  type: 'tv'    }, // The Crown
  { tmdbId: 60625,  type: 'tv'    }, // Downton Abbey
  { tmdbId: 4613,   type: 'tv'    }, // Band of Brothers
  { tmdbId: 1398,   type: 'tv'    }, // The Sopranos
  { tmdbId: 1438,   type: 'tv'    }, // The Wire
  { tmdbId: 1396,   type: 'tv'    }, // Breaking Bad
  { tmdbId: 1668,   type: 'tv'    }, // Friends
  { tmdbId: 2316,   type: 'tv'    }, // The Office
  { tmdbId: 1104,   type: 'tv'    }, // Mad Men
  { tmdbId: 63351,  type: 'tv'    }, // Narcos
  { tmdbId: 1400,   type: 'tv'    }, // Seinfeld
  { tmdbId: 1399,   type: 'tv'    }, // Game of Thrones
];

export const ONBOARDING_BY_AGE: Record<AgeRange, TitleId[]> = {
  young:  YOUNG,
  mid:    MID,
  adult:  ADULT,
  senior: SENIOR,
};

// Default (backwards compat, used when no age range)
export const ONBOARDING_IDS = MID;
