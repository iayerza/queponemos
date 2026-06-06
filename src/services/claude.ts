import type { PlatformId } from '../constants/platforms';
import type { UserProfile } from './firebase';
import { fetchTitle, searchTitles, type NormalizedTitle } from './tmdb';

interface ClaudeResponse {
  content: { type: string; text?: string }[];
  stop_reason?: string;
}

// fetch a Claude con timeout (AbortController) y reintentos con backoff
// exponencial para 429 (rate limit), 500 y 529 (overloaded). Distingue
// timeouts y errores de red (reintentables) de errores HTTP no reintentables.
async function callClaudeWithRetry(apiKey: string, body: unknown): Promise<ClaudeResponse> {
  const MAX_ATTEMPTS = 3;
  let lastErr: Error | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) return await res.json() as ClaudeResponse;

      const errText = await res.text();
      const retryable = res.status === 429 || res.status === 500 || res.status === 529;
      if (retryable && attempt < MAX_ATTEMPTS - 1) {
        const retryAfter = Number(res.headers.get('retry-after'));
        const waitMs = retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt;
        await new Promise(r => setTimeout(r, waitMs));
        lastErr = new Error(`Claude API ${res.status}: ${errText}`);
        continue;
      }
      throw new Error(`Claude API ${res.status}: ${errText}`);
    } catch (e) {
      clearTimeout(timeout);
      const err = e as Error;
      if (err.name === 'AbortError') {
        lastErr = new Error('Claude tardó demasiado en responder (timeout).');
      } else if (err instanceof TypeError) {
        lastErr = new Error('Sin conexión con Claude. Verificá tu internet.');
      } else {
        throw err; // error HTTP no reintentable u otro: propagar
      }
      if (attempt < MAX_ATTEMPTS - 1) {
        await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }
      throw lastErr;
    }
  }
  throw lastErr ?? new Error('No se pudo contactar a Claude.');
}

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

// Normaliza un título para comparar: minúsculas, sin tildes ni puntuación.
function normalizeTitle(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
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

  const data = await callClaudeWithRetry(apiKey, {
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: buildPrompt(input) }],
  });

  // Tomamos el primer bloque de texto (robusto ante futuros bloques no-texto)
  const raw = data.content?.find(b => b.type === 'text')?.text ?? '{}';
  if (data.stop_reason === 'max_tokens') {
    throw new Error('La respuesta de Claude se cortó. Probá de nuevo.');
  }

  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

  let parsed: { recommendations?: Array<Record<string, unknown>>; groupInsight?: string };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error('Claude raw response:', raw);
    throw new Error('Claude devolvió JSON inválido: ' + raw.slice(0, 200));
  }

  // Validación/saneamiento: el modelo puede alucinar campos, tipos o valores
  // fuera de rango. Normalizamos a un máximo de 3 recomendaciones bien tipadas.
  const platformSet = new Set(input.platforms);
  const rawRecs = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
  const baseRecs: Recommendation[] = rawRecs.slice(0, 3).map(r => {
    const score = Number(r.compatibilityScore);
    const platform = (typeof r.platform === 'string' && platformSet.has(r.platform as PlatformId)
      ? r.platform
      : input.platforms[0]) as PlatformId;
    return {
      tmdbId: typeof r.tmdbId === 'number' ? r.tmdbId : undefined,
      title: String(r.title ?? '').trim() || 'Sin título',
      year: Number(r.year) || 0,
      type: r.type === 'series' ? 'series' : 'movie',
      genres: Array.isArray(r.genres) ? r.genres.map(String) : [],
      synopsis: String(r.synopsis ?? ''),
      rating: Number(r.rating) || 0,
      platform,
      compatibilityScore: Number.isFinite(score) ? Math.min(100, Math.max(0, Math.round(score))) : 70,
      whyUs: String(r.whyUs ?? ''),
      posterPath: null,
      groupStatus: 'pending' as const,
    };
  });

  if (baseRecs.length === 0) {
    throw new Error('Claude no devolvió recomendaciones. Probá de nuevo.');
  }

  // Enriquecer con pósters de TMDB. TMDB es la fuente autoritativa para type
  // (movie/series). Hacemos match por TÍTULO normalizado para no agarrar un
  // título homónimo, y NO confiamos en el tmdbId de Claude (lo alucina seguido).
  const recommendations = await Promise.all(
    baseRecs.map(async rec => {
      try {
        const claudeMediaType = rec.type === 'series' ? 'tv' : 'movie';
        const results = await searchTitles(rec.title);
        const target = normalizeTitle(rec.title);
        const sameTitle = (r: NormalizedTitle) => normalizeTitle(r.title) === target;

        // Prioridad: título exacto + tipo + año → título + tipo → título →
        // tipo + año → primer resultado. El título manda sobre el tipo de Claude.
        const match =
          results.find(r => sameTitle(r) && r.type === claudeMediaType && Math.abs(r.year - rec.year) <= 1) ??
          results.find(r => sameTitle(r) && r.type === claudeMediaType) ??
          results.find(r => sameTitle(r)) ??
          results.find(r => r.type === claudeMediaType && Math.abs(r.year - rec.year) <= 1) ??
          results[0];

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
        // Sin match en TMDB: devolvemos sin póster en vez de adivinar con un ID dudoso.
      } catch { /* ignore */ }
      return { ...rec, tmdbId: undefined };
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
