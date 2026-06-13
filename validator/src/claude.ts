const API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';

export interface ValidatorRec {
  title:    string;
  year:     number;
  type:     'movie' | 'series';
  platform: string;
  reason:   string;
}

// El perfil viene con features prefijadas: g: género, p: par de sabor,
// e: época, t: tono (prestigio/palomitera)
function section(profile: Record<string, number>, prefix: string) {
  return Object.entries(profile)
    .filter(([f]) => f.startsWith(prefix))
    .map(([f, v]) => [f.slice(prefix.length), v] as const)
    .sort(([, a], [, b]) => b - a);
}

export async function generateRecommendations(
  profile: Record<string, number>,
  mood: string,
  exclude: string[] = [],
): Promise<{ recs: ValidatorRec[]; rawJson: string; ms: number }> {
  const genres = section(profile, 'g:');
  const pairs  = section(profile, 'p:');
  const eras   = section(profile, 'e:');
  const tones  = section(profile, 't:');

  const likes    = genres.filter(([, v]) => v > 0.1).slice(0, 8);
  const dislikes = genres.filter(([, v]) => v < 0);
  const topPairs = pairs.filter(([, v]) => v > 0.2).slice(0, 3);
  const topEras  = eras.filter(([, v]) => v > 0.2).slice(0, 2);
  const tone     = tones.length > 0 && tones[0][1] > 0.2 ? tones[0] : null;

  let profileText = `Géneros que le gustan (escala 0-1, mayor = más preferido):\n` +
    likes.map(([g, v]) => `  ${g}: ${v.toFixed(2)}`).join('\n') + '\n';
  if (dislikes.length > 0) {
    profileText += `\nGéneros que le DISGUSTAN (evitalos por completo):\n` +
      dislikes.map(([g, v]) => `  ${g}: ${v.toFixed(2)}`).join('\n') + '\n';
  }
  if (topPairs.length > 0) {
    profileText += `\nSabores específicos que más le gustan (combinaciones de género):\n` +
      topPairs.map(([p, v]) => `  ${p.replace('+', ' + ')}: ${v.toFixed(2)}`).join('\n') + '\n';
  }
  if (topEras.length > 0) {
    profileText += `\nÉpocas preferidas: ${topEras.map(([e]) => e).join(', ')}\n`;
  }
  if (tone) {
    profileText += `\nTono preferido: ${tone[0] === 'prestigio'
      ? 'cine aclamado y de prestigio'
      : 'cine palomitero y entretenido'}\n`;
  }

  const excludeBlock = exclude.length > 0
    ? `\nTítulos ya recomendados anteriormente — NO los repitas bajo ninguna circunstancia:\n` +
      exclude.map(t => `  - ${t}`).join('\n') + '\n'
    : '';

  const prompt =
    `Sos un recomendador de películas para Argentina. ` +
    `Dado el perfil de gustos del usuario y su estado de ánimo, ` +
    `recomendá exactamente 3 PELÍCULAS (no series) disponibles en streaming.\n\n` +
    profileText +
    excludeBlock +
    `\nEstado de ánimo: ${mood}\n\n` +
    `MATRIZ DE RAREZA — distribución obligatoria de las 3 opciones:\n` +
    `- Opción 1: Éxito comercial accesible — entretenimiento de ritmo sólido y fácil de digerir.\n` +
    `- Opción 2: Joya oculta — título poco comentado, gran factor sorpresa.\n` +
    `- Opción 3: Equilibrio — la más alineada al estado de ánimo de hoy.\n` +
    `Evitá las obviedades masivas que todo el mundo ya vio (ej: Inception, Titanic).\n\n` +
    `Respondé SOLO con JSON válido, sin texto extra:\n` +
    `{\n` +
    `  "recommendations": [\n` +
    `    { "title": string, "year": number, "type": "movie", "platform": string, "reason": string }\n` +
    `  ]\n` +
    `}`;

  const t0 = Date.now();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const ms = Date.now() - t0;

  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  const data = await res.json() as { content: [{ text: string }] };
  const rawJson = data.content[0].text;

  const match = rawJson.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON en la respuesta');
  const parsed = JSON.parse(match[0]) as { recommendations: ValidatorRec[] };
  return { recs: parsed.recommendations, rawJson, ms };
}
