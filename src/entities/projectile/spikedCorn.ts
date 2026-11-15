import { moveAabb, aabbOverlap, type Aabb, type LevelDef } from '@/entities/level/level';
import { type PlayerState, type PlayerConfig } from '@/entities/player/player';

export interface ProjectileConfig {
  width: number;
  height: number;
  gravity: number; // px/frame^2; bends the throw into an arc (0 = a flat shot)
  maxFall: number; // terminal velocity
}

export const SPIKED_CORN_CONFIG: ProjectileConfig = {
  width: 18,
  height: 18,
  gravity: 0.5,
  maxFall: 12,
};

export interface ProjectileState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean; // a shattered shot goes inert; the world stepper culls it
}

export function spawnProjectile(x: number, y: number, vx: number, vy: number): ProjectileState {
  return { x, y, vx, vy, alive: true };
}

// One fixed frame: gravity-arc, then move against the level's solids. ANY solid contact (a wall, a
// floor/platform top, or a ceiling that kills vertical velocity) or hitting the level bounds shatters
// it — spiked corn breaks on impact, it never bounces or sticks. Pure, no rng.
export function projectileStep(state: ProjectileState, cfg: ProjectileConfig, level: LevelDef): ProjectileState {
  if (!state.alive) return state;
  const vy = Math.min(state.vy + cfg.gravity, cfg.maxFall);
  const moved = moveAabb({ x: state.x, y: state.y, w: cfg.width, h: cfg.height }, state.vx, vy, level);
  // A collision is the only thing that alters intended velocity: hitWall (horizontal block or the
  // x-bounds), onGround (a floor/platform top or the level bottom), or a killed vertical component
  // (a ceiling / platform underside). Any of those = shatter.
  const hitSolid = moved.hitWall || moved.onGround || moved.vy !== vy;
  // A shot that falls through a pit is gone: the floor no longer catches bodies below its line.
  const belowWorld = moved.y >= level.height;
  return { x: moved.x, y: moved.y, vx: moved.vx, vy: moved.vy, alive: !hitSolid && !belowWorld };
}

export interface ProjectileResolution {
  projectiles: ProjectileState[];
  hit: boolean; // a live projectile struck the player this frame (the stepper turns this into a respawn)
}

// Resolve one frame of projectile ↔ player contact. A live projectile overlapping the player box
// hurts (hit) and shatters on impact (alive=false); dead projectiles never re-hurt. Pure.
export function resolveProjectiles(
  player: PlayerState,
  projectiles: readonly ProjectileState[],
  pCfg: PlayerConfig,
  cfg: ProjectileConfig = SPIKED_CORN_CONFIG,
): ProjectileResolution {
  const pBox: Aabb = { x: player.x, y: player.y, w: pCfg.width, h: pCfg.height };
  let hit = false;
  const out = projectiles.map((pr) => {
    if (!pr.alive) return pr;
    const box: Aabb = { x: pr.x, y: pr.y, w: cfg.width, h: cfg.height };
    if (aabbOverlap(pBox, box)) {
      hit = true;
      return { ...pr, alive: false };
    }
    return pr;
  });
  return { projectiles: out, hit };
}
