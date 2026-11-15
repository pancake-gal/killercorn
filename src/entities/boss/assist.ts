// Deterministic boss retry assistance. A tier is chosen before the arena spawns from persisted
// campaign state; the simulation never guesses from live performance or wall-clock time.

export const MAX_BOSS_ASSIST_TIER = 3 as const;
export const BOSS_ASSIST_RECOVERY_FRAMES_PER_TIER = 24 as const;

export function clampBossAssistTier(tier: number): number {
  if (!Number.isFinite(tier)) return 0;
  return Math.max(0, Math.min(MAX_BOSS_ASSIST_TIER, Math.trunc(tier)));
}

export function assistedBossHp(maxHp: number, tier: number): number {
  return Math.max(1, maxHp - clampBossAssistTier(tier));
}
