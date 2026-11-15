// Banana peel (player-side projectile — the banana ally's SLIP ATTACK). While the peelToss power is
// live, every swing the player starts tosses a peel that arcs forward and fells the first enemy it
// touches, then shatters. The faction-opposite of spiked corn: spiked corn (squirrels') hurts the
// PLAYER; a peel (the player's) fells an ENEMY. Reuses the projectile physics (arc + shatter on a
// solid) so the One Rule holds — identical (toss, config, level) reproduces an identical arc.

import { type ProjectileConfig, type ProjectileState, spawnProjectile } from './spikedCorn';
import { aabbOverlap, type Aabb } from '@/entities/level/level';
import { type EnemyState } from '@/entities/enemy/kernel';
import { type PlayerState, type PlayerConfig } from '@/entities/player/player';

// A peel is light and lobs flatter than spiked corn (a slide, not a heavy throw).
export const PEEL_CONFIG: ProjectileConfig = { width: 22, height: 14, gravity: 0.32, maxFall: 10 };
const PEEL_SPEED = 6.2; // horizontal throw speed
const PEEL_LOB = -3.2; // initial upward lob so it arcs out before dropping

// Toss a peel from the player's front in the facing direction (the swing-start hook in run.ts).
export function tossPeel(player: PlayerState, pCfg: PlayerConfig): ProjectileState {
  const x = player.facing > 0 ? player.x + pCfg.width : player.x - PEEL_CONFIG.width;
  const y = player.y + pCfg.height * 0.45; // thrown from about hip height
  return spawnProjectile(x, y, player.facing * PEEL_SPEED, PEEL_LOB);
}

export interface PeelResolution {
  peels: ProjectileState[];
  enemies: EnemyState[];
  felled: number; // enemies felled by a peel this frame (>= 0)
}

// Resolve one frame of peel ↔ enemy contact. A live peel overlapping a live enemy fells that enemy
// (alive=false) and shatters the peel (alive=false); each peel fells at most one enemy. Pure. The
// peel config defaults to PEEL_CONFIG but is passed by the stepper so the collision box matches the
// SAME config the peel was stepped with (no step/collide size mismatch under a custom config).
export function resolvePeels(
  peels: readonly ProjectileState[],
  enemies: readonly EnemyState[],
  cfg: ProjectileConfig = PEEL_CONFIG,
): PeelResolution {
  const nextEnemies = enemies.map((e) => ({ ...e }));
  let felled = 0;

  const nextPeels = peels.map((pr) => {
    if (!pr.alive) return pr;
    const pBox: Aabb = { x: pr.x, y: pr.y, w: cfg.width, h: cfg.height };
    for (const e of nextEnemies) {
      if (!e.alive) continue;
      const eBox: Aabb = { x: e.x, y: e.y, w: e.w, h: e.h }; // the mob's own body
      if (aabbOverlap(pBox, eBox)) {
        e.alive = false;
        felled += 1;
        return { ...pr, alive: false }; // the peel shatters on the foe it fells
      }
    }
    return pr;
  });

  return { peels: nextPeels, enemies: nextEnemies, felled };
}
