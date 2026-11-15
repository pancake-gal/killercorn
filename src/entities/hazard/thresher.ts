import { aabbOverlap, type Aabb, type HazardPlacement } from '@/entities/level/level';

export interface HazardConfig {
  width: number;
  height: number;
}

export const THRESHER_CONFIG: HazardConfig = { width: 48, height: 32 };

export function hazardZone(p: HazardPlacement, cfg: HazardConfig = THRESHER_CONFIG): Aabb {
  return { x: p.x, y: p.y, w: cfg.width, h: cfg.height };
}

// Pure predicate: does the player box touch any hazard? Drives the respawn in the world stepper.
export function hazardHit(
  hazards: readonly HazardPlacement[],
  playerBox: Aabb,
  cfg: HazardConfig = THRESHER_CONFIG,
): boolean {
  return hazards.some((h) => aabbOverlap(playerBox, hazardZone(h, cfg)));
}
