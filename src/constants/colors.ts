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

// Dark — cinematográfico, cool-neutral (HBO Max / Apple TV+ inspired)
export const darkColors: ColorPalette = {
  bg:  '#09090E',
  s1:  '#13131A',
  s2:  '#1B1B24',
  s3:  '#0F0F14',
  border:  '#23232E',
  border2: '#381C22',
  accent:       '#C8302A',
  accentFaint:  'rgba(200,48,42,0.14)',
  accentBorder: 'rgba(200,48,42,0.38)',
  coral: '#E8503A',
  text:  '#EDEDF4',
  sub:   '#7A7A92',
  faint: '#48485C',
  success: '#1D9E75',
  warning: '#BA7517',
  danger:  '#C8302A',
  dangerFaint: 'rgba(200,48,42,0.14)',
  redBg:     '#130A0D',
  redSubtle: 'rgba(200,48,42,0.10)',
  isDark: true,
};

// Light — limpio, alto contraste (iOS system grays)
export const lightColors: ColorPalette = {
  bg:  '#F2F2F7',
  s1:  '#FFFFFF',
  s2:  '#E5E5EA',
  s3:  '#EAEAEF',
  border:  '#C7C7CC',
  border2: '#F7D0D4',
  accent:       '#C8302A',
  accentFaint:  'rgba(200,48,42,0.09)',
  accentBorder: 'rgba(200,48,42,0.32)',
  coral: '#E8503A',
  text:  '#1C1C1E',
  sub:   '#48484A',
  faint: '#8E8E93',
  success: '#1D9E75',
  warning: '#BA7517',
  danger:  '#C8302A',
  dangerFaint: 'rgba(200,48,42,0.09)',
  redBg:     '#FFF0F1',
  redSubtle: 'rgba(200,48,42,0.07)',
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
