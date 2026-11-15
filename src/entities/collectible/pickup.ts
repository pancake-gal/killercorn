import { aabbOverlap, type Aabb, type PickupPlacement } from '@/entities/level/level';
import { type PlayerState, type PlayerConfig, MAX_HEALTH } from '@/entities/player/player';

export type PickupKind = 'health' | 'life';

export interface PickupConfig {
  width: number;
  height: number;
}

export const PICKUP_CONFIG: PickupConfig = { width: 28, height: 28 };

export interface PickupState {
  x: number;
  y: number;
  kind: PickupKind;
  taken: boolean; // a taken pickup is terminal: no art, no payout, no collision (economy_bounds)
}

export function spawnPickup(p: PickupPlacement): PickupState {
  return { x: p.x, y: p.y, kind: p.kind, taken: false };
}

export interface PickupResolution {
  pickups: PickupState[];
  healed: boolean; // a health pickup was banked this frame → refill the bar
  gainedLife: boolean; // a life pickup was banked this frame → +1 life
}

// Resolve one frame of player ↔ pickup contact. At most ONE pickup is banked per frame; a health
// pickup is skipped while the bar is full (left for later), a life pickup always pays. Pure — a fixed
// output from (player, pickups, cfg); the world stepper applies `healed`/`gainedLife` to player.health
// and world.lives.
export function resolvePickups(
  player: PlayerState,
  pickups: readonly PickupState[],
  pCfg: PlayerConfig,
  cfg: PickupConfig = PICKUP_CONFIG,
): PickupResolution {
  const pBox: Aabb = { x: player.x, y: player.y, w: pCfg.width, h: pCfg.height };
  let healed = false;
  let gainedLife = false;
  let banked = false; // one payout per frame

  const out = pickups.map((p) => {
    if (banked || p.taken) return p;
    const box: Aabb = { x: p.x, y: p.y, w: cfg.width, h: cfg.height };
    if (!aabbOverlap(pBox, box)) return p;
    if (p.kind === 'health') {
      if (player.health >= MAX_HEALTH) return p; // full bar — leave it for later, never wasted
      banked = true;
      healed = true;
      return { ...p, taken: true };
    }
    banked = true;
    gainedLife = true;
    return { ...p, taken: true };
  });

  return { pickups: out, healed, gainedLife };
}
