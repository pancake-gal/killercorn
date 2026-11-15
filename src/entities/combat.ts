// Player ↔ enemy combat resolution (pure, deterministic — no Math.random, the One Rule). Two
// verbs, both squish a mob: STOMP (a falling player landing on the enemy's top band, which bounces
// the player) and SWING (the character's weapon hitbox while a swing is live). Any other body
// contact with a live mob HURTS the player (the world stepper turns that into a checkpoint respawn).
// Resolution order per enemy: weapon squish → stomp squish → hurt — a kill always beats a hit, so
// the player is never punished for the same enemy it just squished.

import { aabbOverlap, type Aabb } from '@/entities/level/level';
import { type PlayerState, type PlayerConfig } from '@/entities/player/player';
import { type EnemyState } from '@/entities/enemy/kernel';

// How far below an enemy's top the player's feet may be (while falling) and still count as a stomp
// rather than a side hit. Keeps a clean "land on its head" feel without frame-perfect precision.
const STOMP_BAND = 20;

// The live weapon hitbox in front of the player, or null when no swing is active.
export function swingHitbox(player: PlayerState, cfg: PlayerConfig): Aabb | null {
  if (player.attackTimer <= 0) return null;
  const x = player.facing > 0 ? player.x + cfg.width : player.x - cfg.swingReach;
  const y = player.y + (cfg.height - cfg.swingHeight) / 2;
  return { x, y, w: cfg.swingReach, h: cfg.swingHeight };
}

export interface CombatResult {
  enemies: EnemyState[];
  bounced: boolean; // the player stomped something this frame (apply the stomp bounce)
  hit: boolean; // a live mob hurt the player this frame (respawn at the last checkpoint)
  hitX?: number; // centre x of the first mob that hurt (the knockback pushes away from it)
}

export function resolveCombat(
  player: PlayerState,
  enemies: readonly EnemyState[],
  pCfg: PlayerConfig,
): CombatResult {
  const pBox: Aabb = { x: player.x, y: player.y, w: pCfg.width, h: pCfg.height };
  const feet = player.y + pCfg.height;
  const hb = swingHitbox(player, pCfg);
  let bounced = false;
  let hit = false;
  let hitX: number | undefined;

  const out = enemies.map((e) => {
    if (!e.alive) return e;
    // Each mob carries its own collision body (kernel 32x32, squirrel 30x34) — no shared enemy cfg.
    const eBox: Aabb = { x: e.x, y: e.y, w: e.w, h: e.h };

    if (hb && aabbOverlap(hb, eBox)) return { ...e, alive: false }; // weapon squish
    if (!aabbOverlap(pBox, eBox)) return e; // no body contact, no interaction

    if (player.vy > 0 && feet <= eBox.y + STOMP_BAND) {
      bounced = true;
      return { ...e, alive: false }; // stomp squish
    }
    hit = true; // body contact that is neither a swing nor a stomp — it hurts
    hitX ??= eBox.x + eBox.w / 2;
    return e;
  });

  return { enemies: out, bounced, hit, ...(hitX !== undefined ? { hitX } : {}) };
}
