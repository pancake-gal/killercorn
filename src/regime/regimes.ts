export const REGIME_IDS = ['menu', 'overworld', 'boss', 'poster'] as const;
export type RegimeId = (typeof REGIME_IDS)[number];

export interface RegimePalette {
  bg: string;
  text: string;
  accent: string;
  glow: string;
}

export const REGIMES: Record<RegimeId, RegimePalette> = {
  menu: { bg: '#0f1320', text: '#ffe9b0', accent: '#f5c518', glow: '#f5c518' },
  overworld: { bg: '#7ec8ff', text: '#2a2417', accent: '#f5c518', glow: '#ffe066' },
  boss: { bg: '#1a1320', text: '#f3ead9', accent: '#e23a3a', glow: '#e23a3a' },
  poster: { bg: '#120e1a', text: '#fff3d0', accent: '#ffcf4d', glow: '#ffcf4d' },
};

export const ON_ACCENT_TEXT = '#1a1320';

export function isRegimeId(value: string): value is RegimeId {
  return (REGIME_IDS as readonly string[]).includes(value);
}
