export const Colors = {
  bg:      '#080c14',
  s1:      '#0d1220',
  s2:      '#12182a',
  s3:      '#1a2236',

  border:  'rgba(255,255,255,0.08)',
  border2: 'rgba(255,255,255,0.16)',

  accent:       '#5577ff',
  accentFaint:  'rgba(85,119,255,0.15)',
  accentBorder: 'rgba(85,119,255,0.4)',

  text: '#ffffff',
  sub:  '#8899bb',
  faint:'#334466',

  success: '#30c060',
  warning: '#f0a030',
  danger:  '#e05050',
  dangerFaint: 'rgba(224,80,80,0.15)',
} as const;

export const Typography = {
  black:    '900' as const,
  bold:     '700' as const,
  semibold: '600' as const,
  medium:   '500' as const,
  regular:  '400' as const,

  hero:   32,
  h1:     24,
  h2:     20,
  h3:     16,
  body:   14,
  small:  12,
  tiny:   10,
} as const;
