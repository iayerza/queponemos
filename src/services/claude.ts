import type { PlatformId } from '../constants/platforms';
import type { UserProfile } from './firebase';
import { fetchTitle, searchTitles } from './tmdb';

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
  groupStatus: 'pending' | 'watched' | 'watchlist' | 'skipped' | 'chosen';
}

export interface MatchingInput {
  users: UserProfile[];
  moods: Record<string, MoodId>;
  platforms: PlatformId[];
  titleMap?: Record<number, string>; // tmdbId → "Título (año)" para usar en el prompt
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

const AGE_RANGE_LABELS: Record<string, string> = {
  young:  'menos de 25 años',
  mid:    '25 a 35 años',
  adult:  '36 a 50 años',
  senior: 'más de 50 años',
};

function titleLabel(id: number, titleMap?: Record<number, string>): string {
  return titleMap?.[id] ?? `tmdbId:${id}`;
}

function buildPrompt(input: MatchingInput): string {
  const userBlocks = input.users.map(u => {
    const entries = Object.entries(u.ratings ?? {});
    const loved = entries
      .filter(([, r]) => r === 'loved')
      .map(([id]) => titleLabel(Number(id), input.titleMap))
      .join(', ') || 'ninguno aún';
    const disliked = entries
      .filter(([, r]) => r === 'seen_disliked')
      .map(([id]) => titleLabel(Number(id), input.titleMap))
      .join(', ') || 'ninguno';
    const alreadySeen = entries
      .filter(([, r]) => r === 'loved' || r === 'liked' || r === 'seen_disliked')
      .map(([id]) => titleLabel(Number(id), input.titleMap));
    const mood = MOOD_LABELS[input.moods[u.uid] ?? 'chill'];
    const genres = Object.entries(u.tasteProfile?.genres ?? {})
      .filter(([, s]) => s > 0.5)
      .map(([g]) => g)
      .join(', ') || 'variado';
    const age = u.ageRange ? ` (${AGE_RANGE_LABELS[u.ageRange]})` : '';
    const seenNote = alreadySeen.length > 0
      ? `\n  ya visto (NO recomendar): ${alreadySeen.join(', ')}`
      : '';
    return `- ${u.displayName}${age}: géneros favoritos [${genres}], le encantó [${loved}], no le gustó [${disliked}], mood esta noche: ${mood}${seenNote}`;
  }).join('\n');

  return `Sos el motor de recomendación de Queponemos. Analizá los perfiles y recomendá exactamente 3 títulos para ver juntos esta noche.

PERFILES:
${userBlocks}

PLATAFORMAS DISPONIBLES: ${input.platforms.join(', ')}

REGLAS:
1. NUNCA recomendés títulos marcados como "ya visto" en los perfiles.
2. VARIEDAD DE ERA: intentá cubrir distintas décadas (no es obligatorio uno por era si no hay buenos candidatos).
3. VARIEDAD DE GÉNERO: los 3 títulos deben ser de géneros/tonos claramente distintos.
4. VARIEDAD DE FORMATO: mezclar película y serie cuando sea posible.
5. COMPATIBILIDAD HONESTA — no inflés los scores, usá la escala real:
   - 60-70: buena opción, aunque no es un match perfecto
   - 71-82: muy buena opción, varios puntos de coincidencia
   - 83-91: match excelente, coincidencia clara en gustos y mood
   - 92-100: solo para coincidencia casi perfecta y evidente
   La mayoría de recomendaciones deberían estar entre 70-85. Scores de 90+ son la excepción, no la regla.
6. No repetir siempre los mismos títulos populares del momento.
7. Considerá la edad de los usuarios al elegir referencias culturales y títulos.

Respondé SOLO con JSON válido, sin texto extra, sin markdown, sin bloques de código:
{
  "recommendations": [{
    "tmdbId": 12345,
    "title": "string",
    "year": 2015,
    "type": "movie",
    "genres": ["Drama"],
    "rating": 8.2,
    "synopsis": "string en español, 2-3 oraciones",
    "platform": "netflix",
    "compatibilityScore": 78,
    "whyUs": "2-3 oraciones mencionando a los usuarios por nombre y explicando por qué es buena para ellos esta noche"
  }],
  "groupInsight": "observación breve y específica sobre el grupo basada en sus perfiles"
}`;
}

export async function runMatching(input: MatchingInput): Promise<MatchingOutput> {
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('EXPO_PUBLIC_ANTHROPIC_API_KEY no configurada');
  if (!apiKey.startsWith('sk-ant-')) throw new Error(`API key inválida (debe empezar con sk-ant-). Verificá EXPO_PUBLIC_ANTHROPIC_API_KEY.`);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
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

  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

  let parsed: { recommendations: Omit<Recommendation, 'posterPath' | 'groupStatus'>[]; groupInsight: string };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error('Claude raw response:', raw);
    throw new Error('Claude devolvió JSON inválido: ' + raw.slice(0, 200));
  }

  const validRecs = (parsed.recommendations ?? []).filter(r =>
    r.title && typeof r.year === 'number' && r.type && r.platform && r.whyUs && r.synopsis
  );
  if (validRecs.length === 0) {
    throw new Error('Claude no devolvió recomendaciones válidas. Intentá de nuevo.');
  }

  const baseRecs: Recommendation[] = validRecs.map(r => ({
    ...r,
    posterPath: null,
    groupStatus: 'pending' as const,
    platform: (r.platform ?? input.platforms[0]) as PlatformId,
  }));

  // Enriquecer con pósters de TMDB: buscar por título (confiable) y usar tmdbId de Claude solo como desempate
  const recommendations = await Promise.all(
    baseRecs.map(async rec => {
      try {
        const mediaType = rec.type === 'series' ? 'tv' : 'movie';
        // Buscar por título primero — más confiable que el tmdbId de Claude
        const results = await searchTitles(rec.title);
        const byYear = results.find(r => r.type === mediaType && Math.abs(r.year - rec.year) <= 1);
        const byType = results.find(r => r.type === mediaType);
        const match = byYear ?? byType;
        if (match) return { ...rec, tmdbId: match.tmdbId, posterPath: match.posterPath };
        // Último recurso: ID de Claude (puede ser incorrecto)
        if (rec.tmdbId) {
          const tmdbData = await fetchTitle(rec.tmdbId, mediaType);
          return { ...rec, posterPath: tmdbData.posterPath };
        }
      } catch { /* ignore */ }
      return rec;
    })
  );

  return { recommendations, groupInsight: parsed.groupInsight ?? '' };
}

// Mock para desarrollo sin API key
export function mockMatching(input: MatchingInput): MatchingOutput {
  const names = input.users.map(u => u.displayName).join(' y ');
  return {
    recommendations: [
      {
        tmdbId: 136315,
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
        tmdbId: 99966,
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
        tmdbId: 545611,
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
