import { aabbOverlap, type Aabb, type PowerupPlacement } from '@/entities/level/level';
import { type PlayerState, type PlayerConfig } from '@/entities/player/player';
import { type PowerKind } from '@/entities/player/powerup';
import { swingHitbox } from '@/entities/combat';

export interface WheatBoxConfig {
  width: number;
  height: number;
  grants: PowerKind; // deterministic payout signal; world rules convert it to refill/fallback
  stompBand: number; // how far below the box top a falling player still counts as a stomp
}

export const WHEAT_BOX_CONFIG: WheatBoxConfig = {
  width: 36,
  height: 36,
  grants: 'cornpop',
  stompBand: 20,
};

export interface WheatBoxState {
  x: number;
  y: number;
  broken: boolean; // a broken box is terminal: no art, no payout, no collision (economy_bounds)
}

export function spawnWheatBox(p: PowerupPlacement): WheatBoxState {
  return { x: p.x, y: p.y, broken: false };
}

export interface WheatBoxResolution {
  boxes: WheatBoxState[];
  granted: PowerKind | null; // payout signal from the FIRST box broken, else null
  bounced: boolean; // a stomp broke a box — bounce the player like a stomped mob (a swing does not)
}

// Resolve one frame of player ↔ box contact. The FIRST unbroken box the player breaks (a live swing
// reaching it, or a falling stomp onto its top band) pays out its power and goes broken; at most one
// box breaks per frame so a power is never consumed unbanked. A stomp break bounces the player; a
// swing break does not. Pure — fixed output from (player, boxes, cfg).
export function resolveWheatBoxes(
  player: PlayerState,
  boxes: readonly WheatBoxState[],
  pCfg: PlayerConfig,
  cfg: WheatBoxConfig = WHEAT_BOX_CONFIG,
): WheatBoxResolution {
  const pBox: Aabb = { x: player.x, y: player.y, w: pCfg.width, h: pCfg.height };
  const feet = player.y + pCfg.height;
  const hb = swingHitbox(player, pCfg);
  let granted: PowerKind | null = null;
  let bounced = false;
  let broke = false; // one break per frame

  const out = boxes.map((b) => {
    if (broke || b.broken) return b;
    const box: Aabb = { x: b.x, y: b.y, w: cfg.width, h: cfg.height };

    if (hb && aabbOverlap(hb, box)) {
      broke = true;
      granted = cfg.grants;
      return { ...b, broken: true }; // swing break — no bounce
    }
    if (player.vy > 0 && aabbOverlap(pBox, box) && feet <= box.y + cfg.stompBand) {
      broke = true;
      granted = cfg.grants;
      bounced = true; // stomp break — bounce off the lid
      return { ...b, broken: true };
    }
    return b;
  });

  return { boxes: out, granted, bounced };
}
