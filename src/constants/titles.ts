import type { AgeRange } from '../navigation/types';

type TitleId = { tmdbId: number; type: 'movie' | 'tv' };

// ─── Semillas: 10 títulos curados para cubrir géneros distintos ───────────────
// Orden intencional: Comedia, Romance, Acción, Terror, Sci-Fi,
// Animación/Fantasía, Thriller, Crimen, Drama, comodín
const SEED_YOUNG: TitleId[] = [
  { tmdbId: 10625,  type: 'movie' }, // Mean Girls          — Comedia pura
  { tmdbId: 9587,   type: 'movie' }, // 10 Things           — Romance/Comedia
  { tmdbId: 76341,  type: 'movie' }, // Mad Max Fury Road   — Acción pura
  { tmdbId: 524434, type: 'movie' }, // A Quiet Place       — Terror puro
  { tmdbId: 634649, type: 'movie' }, // Spider-Man NWH      — Sci-Fi/Acción
  { tmdbId: 129,    type: 'movie' }, // Chihiro             — Animación
  { tmdbId: 120,    type: 'movie' }, // LOTR Fellowship     — Fantasía
  { tmdbId: 71446,  type: 'tv'    }, // La Casa de Papel    — Crimen/Acción
  { tmdbId: 475557, type: 'movie' }, // Joker               — Thriller
  { tmdbId: 93405,  type: 'tv'    }, // Squid Game          — Drama/Thriller
];

const SEED_MID: TitleId[] = [
  { tmdbId: 546554, type: 'movie' }, // Knives Out          — Comedia/Misterio
  { tmdbId: 19913,  type: 'movie' }, // 500 Days of Summer  — Romance
  { tmdbId: 76341,  type: 'movie' }, // Mad Max Fury Road   — Acción pura
  { tmdbId: 493922, type: 'movie' }, // Hereditary          — Terror puro
  { tmdbId: 27205,  type: 'movie' }, // Inception           — Sci-Fi/Thriller
  { tmdbId: 129,    type: 'movie' }, // Chihiro             — Animación
  { tmdbId: 120,    type: 'movie' }, // LOTR Fellowship     — Fantasía
  { tmdbId: 680,    type: 'movie' }, // Pulp Fiction        — Crimen
  { tmdbId: 210577, type: 'movie' }, // Gone Girl           — Thriller
  { tmdbId: 496243, type: 'movie' }, // Parasite            — Drama/Comedia
];

const SEED_ADULT: TitleId[] = [
  { tmdbId: 137,    type: 'movie' }, // Groundhog Day       — Comedia/Romance
  { tmdbId: 1185,   type: 'movie' }, // Notting Hill        — Romance
  { tmdbId: 562,    type: 'movie' }, // Die Hard            — Acción pura
  { tmdbId: 138843, type: 'movie' }, // The Conjuring       — Terror
  { tmdbId: 603,    type: 'movie' }, // The Matrix          — Sci-Fi
  { tmdbId: 129,    type: 'movie' }, // Chihiro             — Animación
  { tmdbId: 120,    type: 'movie' }, // LOTR Fellowship     — Fantasía
  { tmdbId: 238,    type: 'movie' }, // The Godfather       — Crimen
  { tmdbId: 807,    type: 'movie' }, // Se7en               — Thriller/Crimen
  { tmdbId: 278,    type: 'movie' }, // Shawshank           — Drama
];

const SEED_SENIOR: TitleId[] = [
  { tmdbId: 9593,   type: 'movie' }, // When Harry Met Sally — Comedia
  { tmdbId: 1185,   type: 'movie' }, // Notting Hill         — Romance
  { tmdbId: 562,    type: 'movie' }, // Die Hard             — Acción
  { tmdbId: 694,    type: 'movie' }, // The Shining          — Terror
  { tmdbId: 603,    type: 'movie' }, // The Matrix           — Sci-Fi
  { tmdbId: 2493,   type: 'movie' }, // The Princess Bride   — Fantasía/Comedia
  { tmdbId: 238,    type: 'movie' }, // The Godfather        — Crimen
  { tmdbId: 274,    type: 'movie' }, // Silence of the Lambs — Thriller
  { tmdbId: 857,    type: 'movie' }, // Saving Private Ryan  — Bélica
  { tmdbId: 278,    type: 'movie' }, // Shawshank            — Drama
];

export const SEED_BY_AGE: Record<AgeRange, TitleId[]> = {
  young:  SEED_YOUNG,
  mid:    SEED_MID,
  adult:  SEED_ADULT,
  senior: SEED_SENIOR,
};

// ─── Pools: todos los títulos disponibles por rango de edad ──────────────────

const YOUNG: TitleId[] = [
  { tmdbId: 299534, type: 'movie' }, // Avengers: Endgame
  { tmdbId: 634649, type: 'movie' }, // Spider-Man: No Way Home
  { tmdbId: 155,    type: 'movie' }, // The Dark Knight
  { tmdbId: 19995,  type: 'movie' }, // Avatar
  { tmdbId: 27205,  type: 'movie' }, // Inception
  { tmdbId: 157336, type: 'movie' }, // Interstellar
  { tmdbId: 693134, type: 'movie' }, // Dune: Part Two
  { tmdbId: 329,    type: 'movie' }, // Jurassic Park
  { tmdbId: 22,     type: 'movie' }, // Pirates of the Caribbean
  { tmdbId: 129,    type: 'movie' }, // El viaje de Chihiro
  { tmdbId: 361743, type: 'movie' }, // Top Gun: Maverick
  { tmdbId: 346698, type: 'movie' }, // Barbie
  { tmdbId: 872585, type: 'movie' }, // Oppenheimer
  { tmdbId: 176,    type: 'movie' }, // Saw
  { tmdbId: 419430, type: 'movie' }, // Get Out
  { tmdbId: 475557, type: 'movie' }, // Joker
  { tmdbId: 245891, type: 'movie' }, // John Wick
  { tmdbId: 18785,  type: 'movie' }, // The Hangover
  { tmdbId: 10625,  type: 'movie' }, // Mean Girls
  { tmdbId: 9587,   type: 'movie' }, // 10 Things I Hate About You
  { tmdbId: 76341,  type: 'movie' }, // Mad Max: Fury Road
  { tmdbId: 524434, type: 'movie' }, // A Quiet Place
  { tmdbId: 545611, type: 'movie' }, // Everything Everywhere
  { tmdbId: 493922, type: 'movie' }, // Hereditary
  { tmdbId: 346364, type: 'movie' }, // IT
  { tmdbId: 8363,   type: 'movie' }, // Superbad
  { tmdbId: 57215,  type: 'movie' }, // Bridesmaids
  { tmdbId: 467558, type: 'movie' }, // Crazy Rich Asians
  { tmdbId: 19913,  type: 'movie' }, // (500) Days of Summer
  { tmdbId: 546554, type: 'movie' }, // Knives Out
  { tmdbId: 120,    type: 'movie' }, // LOTR Fellowship
  { tmdbId: 671,    type: 'movie' }, // Harry Potter 1
  { tmdbId: 372058, type: 'movie' }, // Your Name
  { tmdbId: 897353, type: 'movie' }, // Past Lives
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
  { tmdbId: 89342,  type: 'tv'    }, // Normal People
];

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
  { tmdbId: 1185,   type: 'movie' }, // Notting Hill
  { tmdbId: 19913,  type: 'movie' }, // (500) Days of Summer
  { tmdbId: 157820, type: 'movie' }, // About Time
  { tmdbId: 116711, type: 'movie' }, // Silver Linings Playbook
  { tmdbId: 546554, type: 'movie' }, // Knives Out
  { tmdbId: 76341,  type: 'movie' }, // Mad Max: Fury Road
  { tmdbId: 562,    type: 'movie' }, // Die Hard
  { tmdbId: 353081, type: 'movie' }, // Mission Impossible Fallout
  { tmdbId: 545611, type: 'movie' }, // Everything Everywhere
  { tmdbId: 524434, type: 'movie' }, // A Quiet Place
  { tmdbId: 493922, type: 'movie' }, // Hereditary
  { tmdbId: 138843, type: 'movie' }, // The Conjuring
  { tmdbId: 120,    type: 'movie' }, // LOTR Fellowship
  { tmdbId: 671,    type: 'movie' }, // Harry Potter 1
  { tmdbId: 2493,   type: 'movie' }, // The Princess Bride
  { tmdbId: 372058, type: 'movie' }, // Your Name
  { tmdbId: 897353, type: 'movie' }, // Past Lives
  { tmdbId: 57215,  type: 'movie' }, // Bridesmaids
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
  { tmdbId: 89342,  type: 'tv'    }, // Normal People
];

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
  { tmdbId: 137,    type: 'movie' }, // Groundhog Day
  { tmdbId: 1185,   type: 'movie' }, // Notting Hill
  { tmdbId: 9593,   type: 'movie' }, // When Harry Met Sally
  { tmdbId: 508,    type: 'movie' }, // Love Actually
  { tmdbId: 157820, type: 'movie' }, // About Time
  { tmdbId: 116711, type: 'movie' }, // Silver Linings Playbook
  { tmdbId: 546554, type: 'movie' }, // Knives Out
  { tmdbId: 562,    type: 'movie' }, // Die Hard
  { tmdbId: 353081, type: 'movie' }, // Mission Impossible Fallout
  { tmdbId: 524434, type: 'movie' }, // A Quiet Place
  { tmdbId: 138843, type: 'movie' }, // The Conjuring
  { tmdbId: 120,    type: 'movie' }, // LOTR Fellowship
  { tmdbId: 671,    type: 'movie' }, // Harry Potter 1
  { tmdbId: 2493,   type: 'movie' }, // The Princess Bride
  { tmdbId: 372058, type: 'movie' }, // Your Name
  { tmdbId: 897353, type: 'movie' }, // Past Lives
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
  { tmdbId: 89342,  type: 'tv'    }, // Normal People
];

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
  { tmdbId: 9593,   type: 'movie' }, // When Harry Met Sally
  { tmdbId: 1185,   type: 'movie' }, // Notting Hill
  { tmdbId: 137,    type: 'movie' }, // Groundhog Day
  { tmdbId: 508,    type: 'movie' }, // Love Actually
  { tmdbId: 562,    type: 'movie' }, // Die Hard
  { tmdbId: 2493,   type: 'movie' }, // The Princess Bride
  { tmdbId: 120,    type: 'movie' }, // LOTR Fellowship
  { tmdbId: 671,    type: 'movie' }, // Harry Potter 1
  { tmdbId: 157820, type: 'movie' }, // About Time
  { tmdbId: 897353, type: 'movie' }, // Past Lives
  { tmdbId: 546554, type: 'movie' }, // Knives Out
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
  { tmdbId: 89342,  type: 'tv'    }, // Normal People
];

export const ONBOARDING_BY_AGE: Record<AgeRange, TitleId[]> = {
  young:  YOUNG,
  mid:    MID,
  adult:  ADULT,
  senior: SENIOR,
};

export const ONBOARDING_IDS = MID;
