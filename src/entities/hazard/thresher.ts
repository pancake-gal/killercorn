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
  return hazardHitX(hazards, playerBox, cfg) !== undefined;
}

// Centre x of the first hazard the player box touches, or undefined (the knockback pushes away from it).
export function hazardHitX(
  hazards: readonly HazardPlacement[],
  playerBox: Aabb,
  cfg: HazardConfig = THRESHER_CONFIG,
): number | undefined {
  const zone = hazards.map((h) => hazardZone(h, cfg)).find((z) => aabbOverlap(playerBox, z));
  return zone ? zone.x + zone.w / 2 : undefined;
}
