// ─── Queponemos Design Tokens ────────────────────────────────────────────────
// Blueprint V1.0 — Modo oscuro es el default

export const Colors = {
  // Fondos
  bg:  '#0D0D0F',   // BG_DARK — fondo principal
  s1:  '#1C1C20',   // SURFACE — cards y superficies
  s2:  '#252528',   // SURFACE_2 — superficies secundarias
  s3:  '#141418',   // SURFACE_3 — dentro de cards

  // Bordes
  border:  '#2A2A2E',           // borde estándar
  border2: '#3A2020',           // borde en contexto rojo/alerta

  // Brand — Rojo Quepo (SOLO para CTAs, logo y scores)
  accent:       '#C8302A',
  accentFaint:  'rgba(200,48,42,0.15)',
  accentBorder: 'rgba(200,48,42,0.4)',

  // Coral (gradientes, highlights secundarios)
  coral: '#E8503A',

  // Texto
  text:  '#FFFFFF',
  sub:   '#888888',   // texto secundario
  faint: '#555555',   // hints, labels

  // Estados
  success: '#1D9E75',
  warning: '#BA7517',
  danger:  '#C8302A',
  dangerFaint: 'rgba(200,48,42,0.15)',

  // Contextos especiales
  redBg:     '#1A1014',               // background cards de alerta
  redSubtle: 'rgba(200,48,42,0.12)',  // match score background
} as const;

// ─── Tipografía ───────────────────────────────────────────────────────────────
// Regla: solo pesos 400 y 500. Nunca 600, 700 ni 900.
export const Typography = {
  // Pesos permitidos
  medium:  '500' as const,
  regular: '400' as const,

  // Aliases para compatibilidad (todos apuntan a 400 o 500)
  bold:     '500' as const,
  semibold: '500' as const,
  black:    '500' as const,

  // Familias (DM Sans)
  fontMedium:  'DMSans_500Medium',
  fontRegular: 'DMSans_400Regular',

  // Tamaños
  hero:  28,  // 6xl
  h1:    22,  // 4xl
  h2:    18,  // 3xl
  h3:    16,  // 2xl
  body:  14,  // lg
  small: 12,  // base
  tiny:  10,  // xs
} as const;

// ─── Spacing ──────────────────────────────────────────────────────────────────
export const Spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  '2xl': 24,
  '3xl': 32,
} as const;

// ─── Radios ───────────────────────────────────────────────────────────────────
export const Radius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  pill: 20,
  full: 9999,
} as const;
