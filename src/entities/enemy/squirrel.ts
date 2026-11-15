import { type LevelDef } from '@/entities/level/level';
import { type EnemyState, type EnemyConfig, kernelStep, ENEMY_BODY } from './kernel';
import { type ProjectileState, spawnProjectile } from '@/entities/projectile/spikedCorn';

export interface SquirrelConfig extends EnemyConfig {
  throwInterval: number; // frames between lobs (the cadence)
  throwRange: number; // only release when the player is within this horizontal distance
  throwSpeed: number; // horizontal speed of the lobbed corn
  throwLob: number; // initial upward velocity of the lob (negative = up)
}

export const SQUIRREL_CONFIG: SquirrelConfig = {
  width: ENEMY_BODY.squirrel.width,
  height: ENEMY_BODY.squirrel.height,
  speed: 1.1,
  gravity: 0.7,
  maxFall: 14,
  throwInterval: 78,
  throwRange: 540, //  ...and engages sooner (was 460); arc shape unchanged so a full-speed run still outruns it (verified clean)
  throwSpeed: 4,
  throwLob: -7,
};

export interface SquirrelStepResult {
  enemy: EnemyState;
  corn: ProjectileState | null; // a freshly lobbed spiked corn this frame, else null
}

// One fixed frame: patrol (shared with the kernel), tick the throw cadence, and release a corn aimed
// at the player when the timer elapses AND the player is in range. Pure given (state, cfg, level, x).
export function squirrelStep(state: EnemyState, cfg: SquirrelConfig, level: LevelDef, playerX: number): SquirrelStepResult {
  const patrolled = kernelStep(state, cfg, level); // patrol + dead-mob early-out, preserves kind
  if (!patrolled.alive) return { enemy: patrolled, corn: null };

  const tt = patrolled.throwTimer - 1;
  if (tt > 0) return { enemy: { ...patrolled, throwTimer: tt }, corn: null };

  // Timer elapsed: reset the cadence either way (so the wind-up telegraph is steady), but only
  // actually release a corn when the player is within range.
  const centerX = patrolled.x + cfg.width / 2;
  const inRange = Math.abs(playerX - centerX) <= cfg.throwRange;
  const enemy: EnemyState = { ...patrolled, throwTimer: cfg.throwInterval };
  if (!inRange) return { enemy, corn: null };

  const dir = playerX >= centerX ? 1 : -1;
  // Spawn at the squirrel's center-top so the corn clears its own body before arcing toward the player.
  const corn = spawnProjectile(centerX - 9, patrolled.y, dir * cfg.throwSpeed, cfg.throwLob);
  return { enemy, corn };
}
