import { aabbOverlap, type Aabb, type AllyPlacement } from '@/entities/level/level';
import { type PlayerState, type PlayerConfig } from '@/entities/player/player';
import { type PowerKind } from '@/entities/player/powerup';

export interface AllyConfig {
  width: number;
  height: number;
}

export const ALLY_CONFIG: AllyConfig = { width: 40, height: 48 };
const RESCUE_REACH_X = 24;
const RESCUE_REACH_ABOVE = 96;

export const ALLY_GRANTS: Record<string, PowerKind> = {
  strawberry: 'berryRush', // SPEED
  carrot: 'carrotReach', // LONGER REACH
  blueberry: 'blueBounce', // HIGHER JUMP
  lettuce: 'leafGuard', // LEAF SHIELD
  banana: 'peelToss', // SLIP ATTACK
};

export interface AllyState {
  x: number;
  y: number;
  name: string;
  grants: PowerKind; // the power freeing this ally banks
  freed: boolean; // a freed ally is terminal: it has hopped free and paid out (impossible_state)
}

export function spawnAlly(p: AllyPlacement): AllyState {
  return { x: p.x, y: p.y, name: p.name, grants: ALLY_GRANTS[p.name] ?? 'none', freed: false };
}

export interface AllyResolution {
  allies: AllyState[];
  granted: PowerKind | null; // the power banked this frame (the FIRST ally freed), else null
}

// Resolve one frame of player ↔ cage contact. The FIRST caged ally the player's body overlaps is
// freed and banks its power; at most one ally is freed per frame (a power is never granted unbanked).
// A freed ally never re-pays. Pure — fixed output from (player, allies, cfg).
export function resolveAllies(
  player: PlayerState,
  allies: readonly AllyState[],
  pCfg: PlayerConfig,
  cfg: AllyConfig = ALLY_CONFIG,
): AllyResolution {
  const pBox: Aabb = { x: player.x, y: player.y, w: pCfg.width, h: pCfg.height };
  let granted: PowerKind | null = null;
  let freed = false; // one free per frame

  const out = allies.map((a) => {
    if (freed || a.freed) return a;
    const box: Aabb = {
      x: a.x - RESCUE_REACH_X,
      y: a.y - RESCUE_REACH_ABOVE,
      w: cfg.width + RESCUE_REACH_X * 2,
      h: cfg.height + RESCUE_REACH_ABOVE,
    };
    if (aabbOverlap(pBox, box)) {
      freed = true;
      granted = a.grants;
      return { ...a, freed: true };
    }
    return a;
  });

  return { allies: out, granted };
}
