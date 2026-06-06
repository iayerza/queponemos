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
  runtime?: number; // minutos: película = duración total; serie = duración por episodio
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
      .filter(([, r]) => r === 'loved' || r === 'liked')
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
    return `- ${u.displayName}: géneros favoritos [${genres}], le gustó o encantó [${loved}], no le gustó [${disliked}], mood esta noche: ${mood}`;
  }).join('\n');

  // All tmdbIds already seen by any user (loved, liked, or disliked) — never recommend these
  const seenIds = [...new Set(
    input.users.flatMap(u =>
      Object.entries(u.ratings ?? {})
        .filter(([, r]) => r !== 'not_seen')
        .map(([id]) => `ID:${id}`)
    )
  )];
  const excludeLine = seenIds.length > 0
    ? `\nTÍTULOS YA VISTOS (NUNCA recomendar estos IDs): ${seenIds.join(', ')}`
    : '';

  return `Sos el motor de recomendación de Queponemos. Analizá los perfiles y recomendá exactamente 3 títulos para ver juntos esta noche.

PERFILES:
${userBlocks}${excludeLine}

PLATAFORMAS DISPONIBLES: ${input.platforms.join(', ')}

REGLAS:
1. VARIEDAD DE ERA: uno anterior a 2010, uno entre 2010-2019, uno de 2020 en adelante.
2. VARIEDAD DE GÉNERO: los 3 títulos deben ser de géneros/tonos claramente distintos.
3. VARIEDAD DE FORMATO: mezclar película y serie cuando sea posible.
4. COMPATIBILIDAD HONESTA — no inflés los scores, usá la escala real:
   - 60-70: buena opción, aunque no es un match perfecto
   - 71-82: muy buena opción, varios puntos de coincidencia
   - 83-91: match excelente, coincidencia clara en gustos y mood
   - 92-100: solo para coincidencia casi perfecta y evidente
   La mayoría de recomendaciones deberían estar entre 70-85. Scores de 90+ son la excepción, no la regla.
5. No repetir siempre los mismos títulos populares del momento.
6. NUNCA recomendar un título que aparezca en TÍTULOS YA VISTOS. Esos IDs solo sirven para entender los gustos.
7. En el campo "type": usar "movie" SOLO para películas. Usar "series" para cualquier serie de TV, incluso miniseries.

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
  const apiKey = (process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '').trim();
  if (!apiKey) throw new Error('EXPO_PUBLIC_ANTHROPIC_API_KEY no configurada');
  if (!apiKey.startsWith('sk-ant-')) throw new Error(`API key inválida — empieza con: "${apiKey.slice(0, 10)}". Debe empezar con sk-ant-`);

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

  const baseRecs: Recommendation[] = (parsed.recommendations ?? []).map(r => ({
    ...r,
    posterPath: null,
    groupStatus: 'pending' as const,
    platform: (r.platform ?? input.platforms[0]) as PlatformId,
  }));

  // Enriquecer con pósters de TMDB. TMDB es la fuente autoritativa para type (movie/series).
  const recommendations = await Promise.all(
    baseRecs.map(async rec => {
      try {
        const claudeMediaType = rec.type === 'series' ? 'tv' : 'movie';
        const results = await searchTitles(rec.title);
        // Prefiere coincidencia exacta de tipo+año; si Claude se equivocó de tipo,
        // acepta cualquier resultado de TMDB (ej: The Last of Us = serie, no película)
        const byExactTypeYear = results.find(r => r.type === claudeMediaType && Math.abs(r.year - rec.year) <= 1);
        const byAnyYear       = results.find(r => Math.abs(r.year - rec.year) <= 1);
        const byExactType     = results.find(r => r.type === claudeMediaType);
        const match = byExactTypeYear ?? byAnyYear ?? byExactType ?? results[0];
        if (match) {
          const resolvedType: Recommendation['type'] = match.type === 'tv' ? 'series' : 'movie';
          // Traemos el detalle para obtener la duración (el search no la incluye)
          let runtime: number | undefined;
          try {
            const detail = await fetchTitle(match.tmdbId, match.type);
            runtime = detail.runtime;
          } catch { /* sin runtime */ }
          return { ...rec, tmdbId: match.tmdbId, posterPath: match.posterPath, type: resolvedType, runtime };
        }
        // Último recurso: ID de Claude (puede ser incorrecto)
        if (rec.tmdbId) {
          const tmdbData = await fetchTitle(rec.tmdbId, claudeMediaType);
          return { ...rec, posterPath: tmdbData.posterPath, runtime: tmdbData.runtime };
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
