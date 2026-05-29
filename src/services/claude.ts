import type { PlatformId } from '../constants/platforms';
import type { UserProfile } from './firebase';

export type MoodId = 'chill' | 'intense' | 'laugh' | 'think' | 'cry' | 'scared';

export interface Recommendation {
  tmdbId?: number;
  title: string;
  year: number;
  type: 'movie' | 'series';
  posterPath: string | null;
  genres: string[];
  synopsis: string;
  rating: number;
  platform: PlatformId;
  compatibilityScore: number;
  whyUs: string;
  groupStatus: 'pending' | 'watched' | 'watchlist' | 'skipped';
}

export interface MatchingInput {
  users: UserProfile[];
  moods: Record<string, MoodId>;
  platforms: PlatformId[];
}

export interface MatchingOutput {
  recommendations: Recommendation[];
  groupInsight: string;
}

const MOOD_LABELS: Record<MoodId, string> = {
  chill:   'Tranqui — relajado, sin pensar mucho',
  intense: 'Adrenalina — tensión, al borde del asiento',
  laugh:   'Reírse — comedia, algo liviano',
  think:   'Reflexionar — algo que deje pensando',
  cry:     'Emocionarse — drama, sentimientos',
  scared:  'Asustarse — terror o suspenso',
};

function buildPrompt(input: MatchingInput): string {
  const userBlocks = input.users.map(u => {
    const loved = Object.entries(u.ratings ?? {})
      .filter(([, r]) => r === 'loved')
      .map(([id]) => `ID:${id}`)
      .join(', ') || 'ninguno aún';
    const disliked = Object.entries(u.ratings ?? {})
      .filter(([, r]) => r === 'seen_disliked')
      .map(([id]) => `ID:${id}`)
      .join(', ') || 'ninguno';
    const mood = MOOD_LABELS[input.moods[u.uid] ?? 'chill'];
    const genres = Object.entries(u.tasteProfile?.genres ?? {})
      .filter(([, s]) => s > 0.5)
      .map(([g]) => g)
      .join(', ') || 'variado';
    return `- ${u.displayName}: géneros favoritos [${genres}], le encantó [${loved}], no le gustó [${disliked}], mood esta noche: ${mood}`;
  }).join('\n');

  return `Sos el motor de recomendación de StreamMatch. Analizá los perfiles de estos usuarios y recomendá 3 títulos perfectos para ver juntos esta noche.

PERFILES:
${userBlocks}

PLATAFORMAS DISPONIBLES: ${input.platforms.join(', ')}

Respondé SOLO con JSON válido sin texto extra, sin markdown, sin bloques de código:
{
  "recommendations": [{
    "title": "string",
    "year": 2024,
    "type": "movie",
    "genres": ["Drama"],
    "rating": 8.2,
    "synopsis": "string",
    "platform": "netflix",
    "compatibilityScore": 92,
    "whyUs": "string — 2-3 oraciones mencionando a los usuarios por nombre"
  }],
  "groupInsight": "string — observación sobre el grupo"
}`;
}

export async function runMatching(input: MatchingInput): Promise<MatchingOutput> {
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('EXPO_PUBLIC_ANTHROPIC_API_KEY no configurada');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: buildPrompt(input) }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API ${res.status}: ${err}`);
  }

  const data = await res.json() as { content: { text: string }[] };
  const raw = data.content[0]?.text ?? '{}';

  let parsed: { recommendations: Omit<Recommendation, 'posterPath' | 'groupStatus'>[]; groupInsight: string };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Claude devolvió JSON inválido');
  }

  const recommendations: Recommendation[] = (parsed.recommendations ?? []).map(r => ({
    ...r,
    posterPath: null,
    groupStatus: 'pending' as const,
    platform: (r.platform ?? input.platforms[0]) as PlatformId,
  }));

  return { recommendations, groupInsight: parsed.groupInsight ?? '' };
}

// Mock para desarrollo sin API key
export function mockMatching(input: MatchingInput): MatchingOutput {
  const names = input.users.map(u => u.displayName).join(' y ');
  return {
    recommendations: [
      {
        title: 'The Bear',
        year: 2022,
        type: 'series',
        genres: ['Drama', 'Comedia'],
        rating: 8.6,
        synopsis: 'Un chef de alta cocina regresa a su ciudad natal para hacerse cargo del restaurante familiar de sándwiches.',
        platform: input.platforms[0] ?? 'netflix',
        compatibilityScore: 94,
        whyUs: `Perfecta para ${names}: combina tensión intensa con momentos emotivos que a todos van a enganchar desde el primer episodio.`,
        posterPath: null,
        groupStatus: 'pending',
      },
      {
        title: 'Severance',
        year: 2022,
        type: 'series',
        genres: ['Thriller', 'Ciencia Ficción'],
        rating: 8.7,
        synopsis: 'Empleados de una corporación se someten a un procedimiento que separa quirúrgicamente sus recuerdos laborales de los personales.',
        platform: input.platforms[1] ?? input.platforms[0] ?? 'netflix',
        compatibilityScore: 89,
        whyUs: `Para ${names}: si quieren algo que los deje pensando varios días, esta es la elección perfecta. Imposible no terminarla de una vez.`,
        posterPath: null,
        groupStatus: 'pending',
      },
      {
        title: 'Everything Everywhere All at Once',
        year: 2022,
        type: 'movie',
        genres: ['Acción', 'Comedia', 'Drama'],
        rating: 8.0,
        synopsis: 'Una mujer inmigrante chino-americana es arrastrada a una aventura alucinante donde solo ella puede salvar el mundo.',
        platform: input.platforms[0] ?? 'netflix',
        compatibilityScore: 85,
        whyUs: `${names} van a pasar por todas las emociones posibles en dos horas: risa, lágrimas, adrenalina y mucho corazón.`,
        posterPath: null,
        groupStatus: 'pending',
      },
    ],
    groupInsight: `${names} tienen gustos complementarios: combinan el amor por el drama intenso con apertura a la comedia. Esta noche promete mucha conversación post-créditos.`,
  };
}
