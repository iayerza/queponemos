// ─── Queponemos Design Tokens ────────────────────────────────────────────────

export interface ColorPalette {
  bg: string; s1: string; s2: string; s3: string;
  border: string; border2: string;
  accent: string; accentFaint: string; accentBorder: string;
  coral: string;
  text: string; sub: string; faint: string;
  success: string; warning: string; danger: string; dangerFaint: string;
  redBg: string; redSubtle: string;
  isDark: boolean;
}

export const darkColors: ColorPalette = {
  bg:  '#0D0D0F',
  s1:  '#1C1C20',
  s2:  '#252528',
  s3:  '#141418',
  border:  '#2A2A2E',
  border2: '#3A2020',
  accent:       '#C8302A',
  accentFaint:  'rgba(200,48,42,0.15)',
  accentBorder: 'rgba(200,48,42,0.4)',
  coral: '#E8503A',
  text:  '#FFFFFF',
  sub:   '#888888',
  faint: '#555555',
  success: '#1D9E75',
  warning: '#BA7517',
  danger:  '#C8302A',
  dangerFaint: 'rgba(200,48,42,0.15)',
  redBg:     '#1A1014',
  redSubtle: 'rgba(200,48,42,0.12)',
  isDark: true,
};

export const lightColors: ColorPalette = {
  bg:  '#F5F5F7',
  s1:  '#FFFFFF',
  s2:  '#EBEBED',
  s3:  '#F0F0F2',
  border:  '#DADADE',
  border2: '#F5D5D3',
  accent:       '#C8302A',
  accentFaint:  'rgba(200,48,42,0.10)',
  accentBorder: 'rgba(200,48,42,0.35)',
  coral: '#E8503A',
  text:  '#111114',
  sub:   '#666670',
  faint: '#AAAABC',
  success: '#1D9E75',
  warning: '#BA7517',
  danger:  '#C8302A',
  dangerFaint: 'rgba(200,48,42,0.10)',
  redBg:     '#FFF0F0',
  redSubtle: 'rgba(200,48,42,0.08)',
  isDark: false,
};

// Default dark export for backward compat (static stylesheets, components)
export const Colors = darkColors;

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
