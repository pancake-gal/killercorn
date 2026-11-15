export const BONUS_CHARACTER_COPY = {
  luca: { title: 'Luca', trait: 'Rake ready. Mashes snacks twice as fast.' },
  izzy: { title: 'Izzy', trait: 'Hose ready. Turn invisible for 30 seconds.' },
  unlocked: 'Luca and Izzy unlocked. Pick a new farm friend!',
  ability: 'Turn invisible',
} as const;

export function invisibilityStatus(remaining: number, recharge: number, key: string): string {
  if (remaining > 0) return `INVISIBLE · ${Math.ceil(remaining / 60)}s`;
  if (recharge > 0) return `INVISIBILITY RECHARGING · ${Math.ceil(recharge / 60)}s`;
  return `INVISIBILITY READY · ${key.replace(/^Key/, '')} / Y / HIDE`;
}
