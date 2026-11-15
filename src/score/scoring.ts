export interface StageScoreInput {
  frames: number;
  rawScore: number;
  lives: number;
  deaths: number;
}

export interface StageScoreBreakdown {
  clear: number;
  farm: number;
  lives: number;
  flawless: number;
  pace: number;
}

export interface StageScore {
  total: number;
  breakdown: StageScoreBreakdown;
}

const CLEAR_BONUS = 5_000;
const FARM_POINT_MULTIPLIER = 25;
const LIFE_BONUS = 500;
const FLAWLESS_BONUS = 1_000;
const MAX_PACE_BONUS = 3_000;
const PACE_COST_PER_SECOND = 10;
const MAX_SAFE_COMPONENT = 1_000_000;

function safeCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(MAX_SAFE_COMPONENT, Math.trunc(value))) : 0;
}

// Pure post-stage scoring. It reads only deterministic frozen world values, so the same replay
// always earns the same number. Pace bottoms out at zero: a player is never punished for taking
// their time, while an efficient route still has something concrete to chase.
export function calculateStageScore(input: StageScoreInput): StageScore {
  const frames = safeCount(input.frames);
  const rawScore = safeCount(input.rawScore);
  const lives = safeCount(input.lives);
  const deaths = safeCount(input.deaths);
  const breakdown: StageScoreBreakdown = {
    clear: CLEAR_BONUS,
    farm: rawScore * FARM_POINT_MULTIPLIER,
    lives: lives * LIFE_BONUS,
    flawless: deaths === 0 ? FLAWLESS_BONUS : 0,
    pace: Math.max(0, MAX_PACE_BONUS - Math.floor(frames / 60) * PACE_COST_PER_SECOND),
  };
  return {
    total: Object.values(breakdown).reduce((sum, value) => sum + value, 0),
    breakdown,
  };
}
