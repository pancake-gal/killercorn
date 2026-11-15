import { ROYALE_SPICES } from './spices';

export const ROYALE_PAR_FRAMES = 4 * 60 * 60;

export interface RoyaleScoreInput {
  frames: number; // every attempt in the run, start to the final pop
  deaths: number; // lives lost across the run
  lives: number; // lives left on the clearing attempt
  spices: number; // spice toggles on
}

export interface RoyaleScoreBreakdown {
  clear: number;
  lives: number;
  clean: number;
  pace: number;
  spice: number;
}

const CLEAR_BONUS = 10_000;
const LIFE_BONUS = 500;
const CLEAN_BONUS = 2_000;
const MAX_PACE_BONUS = 6_000;
const PACE_COST_PER_SECOND = 10;
const SPICE_BONUS = 1_000;
const MAX_SAFE_COMPONENT = 1_000_000;

function safeCount(value: number, max = MAX_SAFE_COMPONENT): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(max, Math.trunc(value))) : 0;
}

export function calculateRoyaleScore(input: RoyaleScoreInput): { total: number; breakdown: RoyaleScoreBreakdown } {
  const frames = safeCount(input.frames);
  const breakdown: RoyaleScoreBreakdown = {
    clear: CLEAR_BONUS,
    lives: safeCount(input.lives, 99) * LIFE_BONUS,
    clean: safeCount(input.deaths) === 0 ? CLEAN_BONUS : 0,
    pace: Math.max(0, MAX_PACE_BONUS - Math.floor(frames / 60) * PACE_COST_PER_SECOND),
    spice: safeCount(input.spices, ROYALE_SPICES.length) * SPICE_BONUS,
  };
  return { total: Object.values(breakdown).reduce((sum, value) => sum + value, 0), breakdown };
}

export const ROYALE_CROWNS = ['clear', 'noLivesLost', 'underPar', 'spicy'] as const;
export type RoyaleCrown = (typeof ROYALE_CROWNS)[number];

// The crowns this clear earned, in display order. Only earned crowns ever appear.
export function royaleCrowns(run: { frames: number; deaths: number; spices: number }): RoyaleCrown[] {
  const earned: Record<RoyaleCrown, boolean> = {
    clear: true,
    noLivesLost: run.deaths === 0,
    underPar: run.frames <= ROYALE_PAR_FRAMES,
    spicy: run.spices > 0,
  };
  return ROYALE_CROWNS.filter((crown) => earned[crown]);
}
