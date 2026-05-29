const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateInviteCode(): string {
  return 'SM' + Array.from(
    { length: 4 },
    () => CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join('');
}
