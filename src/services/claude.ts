import type { PlatformId } from '../constants/platforms';
import { PLATFORMS } from '../constants/platforms';
import type { UserProfile } from './firebase';
import { fetchTitle, searchTitles } from './tmdb';
import { topKeywordLabels } from '../utils/tasteProfile';

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
  moods: Record<string, MoodId[]>;
  platforms: PlatformId[];
  titleMap?: Record<number, string>; // tmdbId → "Título (año)" para historial
  ratedTitleNames?: Record<number, string>; // tmdbId → nombre; enriquece el prompt con nombres reales
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

// Merges titleMap (from history) with ratedTitleNames (from onboarding/results ratings)
function resolveName(id: number, input: MatchingInput): string {
  return input.ratedTitleNames?.[id] ?? input.titleMap?.[id] ?? '';
}

function eraLabel(era?: number): string {
  if (era === undefined) return '';
  if (era < 0.25) return 'clásicos (80s-90s)';
  if (era < 0.5)  return 'títulos de los 90s-2000s';
  if (era < 0.75) return 'títulos de los 2000s-2010s';
  return 'cine contemporáneo (2010s-hoy)';
}

function toneLabel(tone?: number): string {
  if (tone === undefined) return '';
  if (tone < -0.5) return 'prefiere oscuro y tenso';
  if (tone < -0.1) return 'prefiere tonos serios con algo de tensión';
  if (tone <  0.1) return 'equilibrado entre oscuro y ligero';
  if (tone <  0.5) return 'prefiere algo más liviano y optimista';
  return 'prefiere ligero y entretenido, evita el oscurantismo';
}

function buildPrompt(input: MatchingInput): string {
  const userBlocks = input.users.map(u => {
    const entries = Object.entries(u.ratings ?? {});
    const moodArr = input.moods[u.uid] ?? ['chill'];
    const mood = moodArr.map(m => MOOD_LABELS[m] ?? m).join(' + ');

    // Top genres by score
    const topGenres = Object.entries(u.tasteProfile?.genres ?? {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([g]) => g)
      .join(', ') || 'variado';

    // Era and tone descriptors from new TasteProfile fields
    const era  = eraLabel(u.tasteProfile?.eraPreference);
    const tone = toneLabel(u.tasteProfile?.toneScore);

    // Format preference
    const formatPref = u.tasteProfile?.seriesVsMovies ?? 0.5;
    const formatLabel = formatPref < 0.3 ? 'prefiere películas' : formatPref > 0.7 ? 'prefiere series' : 'películas y series';

    // Loved titles — use real names, limit to 8 most recent
    const lovedIds = entries
      .filter(([, r]) => r === 'loved')
      .map(([id]) => Number(id));
    const likedIds = entries
      .filter(([, r]) => r === 'liked')
      .map(([id]) => Number(id));
    const dislikedIds = entries
      .filter(([, r]) => r === 'seen_disliked')
      .map(([id]) => Number(id));

    const lovedNames  = lovedIds.map(id => resolveName(id, input)).filter(Boolean).slice(0, 8);
    const likedNames  = likedIds.map(id => resolveName(id, input)).filter(Boolean).slice(0, 6);
    const dislikedNames = dislikedIds.map(id => resolveName(id, input)).filter(Boolean).slice(0, 4);

    // All seen titles (tmdbId or name) to block from recommendations
    const allSeenIds = [...lovedIds, ...likedIds, ...dislikedIds];
    const seenBlock = allSeenIds.length > 0
      ? `\n  NO recomendar (ya visto): ${allSeenIds.map(id => resolveName(id, input) || `tmdbId:${id}`).join(', ')}`
      : '';

    const age = u.ageRange ? ` (${AGE_RANGE_LABELS[u.ageRange]})` : '';

    const keywords = topKeywordLabels(u.tasteProfile ?? { genres: {}, intensity: 0.5, seriesVsMovies: 0.5, implicitGenres: [] });
    const profileLines = [
      `géneros dominantes: ${topGenres}`,
      era  ? `época preferida: ${era}`  : '',
      tone ? `tono: ${tone}` : '',
      `formato: ${formatLabel}`,
      keywords.length ? `afinidades estilísticas: ${keywords.join(', ')}` : '',
    ].filter(Boolean).join('; ');

    const lovedBlock   = lovedNames.length   ? `\n  le encantó: ${lovedNames.join(', ')}`   : '';
    const likedBlock   = likedNames.length   ? `\n  le gustó: ${likedNames.join(', ')}`     : '';
    const dislikBlock  = dislikedNames.length? `\n  no le gustó: ${dislikedNames.join(', ')}` : '';

    return `- ${u.displayName}${age}: ${profileLines}${lovedBlock}${likedBlock}${dislikBlock}\n  mood esta noche: ${mood}${seenBlock}`;
  }).join('\n');

  return `Sos el motor de recomendación de Queponemos. Analizá los perfiles y recomendá exactamente 3 títulos para ver juntos esta noche.

PERFILES:
${userBlocks}

PLATAFORMAS DISPONIBLES — usá exactamente estos IDs en el campo "platform":
${input.platforms.map(id => {
  const p = PLATFORMS.find(pl => pl.id === id);
  return `  "${id}" → ${p?.name ?? id}`;
}).join('\n')}
REGLA 0 — CRÍTICA: Los 3 títulos DEBEN estar en alguna de las plataformas listadas. El campo "platform" debe ser uno de los IDs entre comillas de arriba. Si hay más de una plataforma disponible, distribuí los títulos entre ellas (no pongas los 3 en la misma plataforma).

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
7. TYPE CORRECTO — CRÍTICO: "movie" solo para largometrajes. Series de TV, miniseries, shows = "series". Ejemplos: The Last of Us → "series", Breaking Bad → "series", Inception → "movie".
8. Considerá la edad de los usuarios al elegir referencias culturales y títulos.

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
      type: (r.type === 'series' ? 'series' : 'movie') as 'movie' | 'series',
      genres: Array.isArray(r.genres) ? r.genres : [],
      synopsis: String(r.synopsis ?? ''),
      rating: clamp(toNumber(r.rating, 0), 0, 10),
      compatibilityScore: Math.round(clamp(toNumber(r.compatibilityScore, 70), 0, 100)),
      whyUs: String(r.whyUs ?? ''),
      posterPath: null,
      groupStatus: 'pending' as const,
      platform,
    };
  }).filter(r => r.title !== 'Título' || r.year > 0);

  if (baseRecs.length === 0) {
    throw new Error('Claude no devolvió recomendaciones válidas. Intentá de nuevo.');
  }

  // Enriquecer con pósters de TMDB: buscar por título y validar antes de usar tmdbId de Claude
  const recommendations = await Promise.all(
    baseRecs.map(async rec => {
      try {
        const mediaType = rec.type === 'series' ? 'tv' : 'movie';
        const results = await searchTitles(rec.title);
        const wanted = normalizeTitle(rec.title);
        const altMediaType = mediaType === 'movie' ? 'tv' : 'movie';

        function titleMatches(r: { title: string; originalTitle?: string }): boolean {
          return normalizeTitle(r.title) === wanted || (r.originalTitle ? normalizeTitle(r.originalTitle) === wanted : false);
        }

        // 1st pass: title match (localized or original) + type + year
        const pass1 = results.find(r => r.type === mediaType && titleMatches(r) && Math.abs(r.year - rec.year) <= 1);
        // 2nd pass: title match + type (any year)
        const pass2 = results.find(r => r.type === mediaType && titleMatches(r));
        let match = pass1 ?? pass2;
        let resolvedType = rec.type;

        // 3rd pass: try opposite type (handles Claude misclassifications)
        if (!match) {
          const altYear = results.find(r => r.type === altMediaType && titleMatches(r) && Math.abs(r.year - rec.year) <= 1);
          const altAny  = results.find(r => r.type === altMediaType && titleMatches(r));
          const altMatch = altYear ?? altAny;
          if (altMatch) {
            match = altMatch;
            resolvedType = altMediaType === 'tv' ? 'series' : 'movie';
          }
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

        // Fallback: ID de Claude — verificar que el año coincida para evitar póster incorrecto
        if (rec.tmdbId) {
          const tmdbData = await fetchTitle(rec.tmdbId, mediaType);
          if (Math.abs(tmdbData.year - rec.year) <= 2) {
            return { ...rec, posterPath: tmdbData.posterPath, runtime: tmdbData.runtime };
          }
          // Año no coincide → tmdbId de Claude es incorrecto, omitir póster
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
