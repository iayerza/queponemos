export type PlatformId = 'netflix' | 'disney' | 'hbo' | 'prime' | 'apple';

export interface Platform {
  id: PlatformId;
  name: string;
  color: string;
  emoji: string;
}

export const PLATFORMS: Platform[] = [
  { id: 'netflix', name: 'Netflix',    color: '#e50914', emoji: '🔴' },
  { id: 'disney',  name: 'Disney+',    color: '#0063e5', emoji: '🔵' },
  { id: 'hbo',     name: 'Max',        color: '#5822b4', emoji: '🟣' },
  { id: 'prime',   name: 'Prime',      color: '#00a8e1', emoji: '🩵' },
  { id: 'apple',   name: 'Apple TV+',  color: '#555555', emoji: '⚫' },
];

export function getPlatform(id: PlatformId): Platform {
  return PLATFORMS.find(p => p.id === id) ?? PLATFORMS[0];
}
