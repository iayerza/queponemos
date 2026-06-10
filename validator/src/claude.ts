const API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';

export interface ValidatorRec {
  title:    string;
  year:     number;
  type:     'movie' | 'series';
  platform: string;
  reason:   string;
}

export async function generateRecommendations(
  profile: Record<string, number>,
  mood: string,
): Promise<{ recs: ValidatorRec[]; rawJson: string; ms: number }> {
  const profileText = Object.entries(profile)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 12)
    .map(([g, v]) => `  ${g}: ${v.toFixed(2)}`)
    .join('\n');

  const prompt =
    `Sos un recomendador de películas y series para Argentina. ` +
    `Dado el perfil de gustos del usuario y su estado de ánimo, ` +
    `recomendá exactamente 3 títulos disponibles en streaming.\n\n` +
    `Perfil de géneros (escala 0-1, mayor = más preferido):\n${profileText}\n\n` +
    `Estado de ánimo: ${mood}\n\n` +
    `Respondé SOLO con JSON válido, sin texto extra:\n` +
    `{\n` +
    `  "recommendations": [\n` +
    `    { "title": string, "year": number, "type": "movie"|"series", "platform": string, "reason": string }\n` +
    `  ]\n` +
    `}`;

  const t0 = Date.now();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
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
