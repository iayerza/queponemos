import type { PlatformId } from '../constants/platforms';
import { PLATFORMS } from '../constants/platforms';
import type { UserProfile } from './firebase';
import { fetchTitle, searchTitles } from './tmdb';

const VALID_PLATFORMS = new Set(PLATFORMS.map(p => p.id));

const PLATFORM_ALIASES: Record<string, PlatformId> = {
  'netflix': 'netflix',
  'disney': 'disney', 'disney+': 'disney', 'disney plus': 'disney',
  'hbo': 'hbo', 'max': 'hbo', 'hbo max': 'hbo', 'hbomax': 'hbo', 'max (hbo)': 'hbo',
  'prime': 'prime', 'amazon': 'prime', 'prime video': 'prime', 'amazon prime': 'prime', 'amazon prime video': 'prime',
  'apple': 'apple', 'apple tv': 'apple', 'apple tv+': 'apple', 'appletv': 'apple', 'apple tv plus': 'apple',
};

/** Strip accents + punctuation + lowercase for robust TMDB title matching. */
function normalizeTitle(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // combining diacritics (accents)
    .replace(/[^\w\s]/g, '')           // punctuation
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function toNumber(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

interface ClaudeResponse {
  content: { text: string }[];
  stop_reason?: string;
}

/** Call Anthropic with a 45s timeout and exponential backoff for 429/500/529. */
async function callClaudeWithRetry(body: object, apiKey: string, maxRetries = 3): Promise<ClaudeResponse> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
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

      if (res.ok) return await res.json() as ClaudeResponse;

      // Retry on rate-limit / overload / transient server errors
      if ((res.status === 429 || res.status === 500 || res.status === 529) && attempt < maxRetries) {
        const retryAfter = parseFloat(res.headers.get('retry-after') ?? '');
        const waitMs = Number.isFinite(retryAfter)
          ? retryAfter * 1000
          : Math.min(8000, 1000 * 2 ** attempt);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }

      const err = await res.text();
      throw new Error(`Claude API ${res.status}: ${err}`);
    } catch (e) {
      lastErr = e;
      const name = (e as { name?: string })?.name;
      // Retry on abort/network only if attempts remain
      if (attempt < maxRetries && (name === 'AbortError' || name === 'TypeError')) {
        await new Promise(r => setTimeout(r, Math.min(8000, 1000 * 2 ** attempt)));
        continue;
      }
      throw e;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastErr ?? new Error('Claude API: error desconocido');
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
  runtime?: number;
  platform: PlatformId;
  compatibilityScore: number;
  whyUs: string;
  groupStatus: 'pending' | 'watched' | 'watchlist' | 'skipped' | 'chosen';
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
    const intensity = u.tasteProfile?.intensity ?? 0.5;
    const intensityLabel = intensity < 0.35 ? 'liviano (prefiere ritmo tranquilo)' : intensity > 0.65 ? 'intenso (le gusta la tensión y el drama)' : 'equilibrado';
    const formatPref = u.tasteProfile?.seriesVsMovies ?? 0.5;
    const formatLabel = formatPref < 0.35 ? 'prefiere películas' : formatPref > 0.65 ? 'prefiere series' : 'indistinto';
    return `- ${u.displayName}: géneros favoritos [${genres}], intensidad preferida: ${intensityLabel}, formato: ${formatLabel}, le encantó [${loved}], no le gustó [${disliked}], mood esta noche: ${mood}`;
  }).join('\n');

  return `Sos el motor de recomendación de Queponemos. Analizá los perfiles y recomendá exactamente 3 títulos para ver juntos esta noche.

PERFILES:
${userBlocks}

PLATAFORMAS DISPONIBLES — usá exactamente estos IDs en el campo "platform":
${input.platforms.map(id => {
  const p = PLATFORMS.find(pl => pl.id === id);
  return `  "${id}" → ${p?.name ?? id}`;
}).join('\n')}
REGLA 0 — CRÍTICA: Los 3 títulos DEBEN estar en alguna de las plataformas listadas. El campo "platform" debe ser uno de los IDs entre comillas de arriba.

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
6. TYPE CORRECTO — CRÍTICO: "movie" solo para largometrajes. Series de TV, miniseries, shows = "series". Ejemplos: The Last of Us → "series", Breaking Bad → "series", Inception → "movie".

Respondé SOLO con JSON válido, sin texto extra, sin markdown, sin bloques de código:
{
  "recommendations": [{
    "tmdbId": 12345,
    "title": "string",
    "year": 2015,
    "type": "movie o series",
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

  const data = await callClaudeWithRetry({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: buildPrompt(input) }],
  }, apiKey);

  const raw = data.content[0]?.text ?? '{}';

  if (data.stop_reason === 'max_tokens') {
    throw new Error('La respuesta se cortó (max_tokens). Volvé a intentar.');
  }

  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

  let parsed: { recommendations: Omit<Recommendation, 'posterPath' | 'groupStatus'>[]; groupInsight: string };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error('Claude raw response:', raw);
    throw new Error('Claude devolvió JSON inválido: ' + raw.slice(0, 200));
  }

  const fallbackPlatform = input.platforms[0] ?? 'netflix';
  const allowedPlatforms = new Set(input.platforms);
  const baseRecs: Recommendation[] = (parsed.recommendations ?? []).map(r => {
    const raw = String(r.platform ?? '').toLowerCase().trim();
    const normalized = PLATFORM_ALIASES[raw] ?? raw as PlatformId;
    const platform = (VALID_PLATFORMS.has(normalized) && allowedPlatforms.has(normalized))
      ? normalized
      : fallbackPlatform;
    return {
      ...r,
      title: String(r.title ?? '').trim() || 'Título',
      year: Math.round(toNumber(r.year, 0)),
      type: r.type === 'series' ? 'series' : 'movie',
      genres: Array.isArray(r.genres) ? r.genres : [],
      synopsis: String(r.synopsis ?? ''),
      rating: clamp(toNumber(r.rating, 0), 0, 10),
      compatibilityScore: Math.round(clamp(toNumber(r.compatibilityScore, 70), 0, 100)),
      whyUs: String(r.whyUs ?? ''),
      posterPath: null,
      groupStatus: 'pending' as const,
      platform,
    };
  });

  // Enriquecer con pósters de TMDB: buscar por título (confiable) y usar tmdbId de Claude solo como desempate
  const recommendations = await Promise.all(
    baseRecs.map(async rec => {
      try {
        const mediaType = rec.type === 'series' ? 'tv' : 'movie';
        // Buscar por título primero — más confiable que el tmdbId de Claude
        const results = await searchTitles(rec.title);
        const wanted = normalizeTitle(rec.title);
        const altMediaType = mediaType === 'movie' ? 'tv' : 'movie';

        // 1st pass: exact title match with the declared type
        const exactTitleYear = results.find(r => r.type === mediaType && normalizeTitle(r.title) === wanted && Math.abs(r.year - rec.year) <= 1);
        const exactTitle     = results.find(r => r.type === mediaType && normalizeTitle(r.title) === wanted);
        let match = exactTitleYear ?? exactTitle;
        let resolvedType = rec.type;

        // 2nd pass: if no exact match, try the OPPOSITE type (handles Claude type misclassification)
        if (!match) {
          const altExactYear = results.find(r => r.type === altMediaType && normalizeTitle(r.title) === wanted && Math.abs(r.year - rec.year) <= 1);
          const altExact     = results.find(r => r.type === altMediaType && normalizeTitle(r.title) === wanted);
          const altMatch     = altExactYear ?? altExact;
          if (altMatch) {
            match = altMatch;
            resolvedType = altMediaType === 'tv' ? 'series' : 'movie';
          }
        }

        // 3rd pass: loose fallback — type + year (title not checked)
        if (!match) {
          match = results.find(r => r.type === mediaType && Math.abs(r.year - rec.year) <= 1);
        }

        if (match) {
          const fetchType = resolvedType === 'series' ? 'tv' : 'movie';
          try {
            const full = await fetchTitle(match.tmdbId, fetchType);
            return { ...rec, type: resolvedType, tmdbId: match.tmdbId, posterPath: match.posterPath, runtime: full.runtime };
          } catch {
            return { ...rec, type: resolvedType, tmdbId: match.tmdbId, posterPath: match.posterPath };
          }
        }
        // Último recurso: ID de Claude (puede ser incorrecto)
        if (rec.tmdbId) {
          const tmdbData = await fetchTitle(rec.tmdbId, mediaType);
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
