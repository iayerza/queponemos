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

// Dark — azul-negro profundo, acento azul eléctrico
export const darkColors: ColorPalette = {
  bg:  '#0C0C16',
  s1:  '#161622',
  s2:  '#1E1E2E',
  s3:  '#0A0A12',
  border:  '#2A2A40',
  border2: '#1A2448',
  accent:       '#2563EB',
  accentFaint:  'rgba(37,99,235,0.16)',
  accentBorder: 'rgba(37,99,235,0.42)',
  coral: '#60A5FA',
  text:  '#EEEEF8',
  sub:   '#6C6C90',
  faint: '#424260',
  success: '#1D9E75',
  warning: '#BA7517',
  danger:  '#C8302A',
  dangerFaint: 'rgba(200,48,42,0.16)',
  redBg:     '#0E1428',
  redSubtle: 'rgba(37,99,235,0.12)',
  isDark: true,
};

// Light — limpio, alto contraste (iOS system grays), acento azul
export const lightColors: ColorPalette = {
  bg:  '#F2F2F7',
  s1:  '#FFFFFF',
  s2:  '#E5E5EA',
  s3:  '#EAEAEF',
  border:  '#C7C7CC',
  border2: '#C8D8FA',
  accent:       '#2563EB',
  accentFaint:  'rgba(37,99,235,0.10)',
  accentBorder: 'rgba(37,99,235,0.35)',
  coral: '#3B82F6',
  text:  '#1C1C1E',
  sub:   '#48484A',
  faint: '#8E8E93',
  success: '#1D9E75',
  warning: '#BA7517',
  danger:  '#C8302A',
  dangerFaint: 'rgba(200,48,42,0.09)',
  redBg:     '#EEF3FF',
  redSubtle: 'rgba(37,99,235,0.08)',
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
