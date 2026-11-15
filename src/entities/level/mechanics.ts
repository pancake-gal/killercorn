// Deterministic field mechanisms. These are simulation primitives, not Phaser tweens: every moving
// platform position is a closed function of the world frame, and the only mutable mechanism state is
// the stable set of switches already activated. Moving rides, gates, pads, and slick boards therefore
// obey the One Rule.

import { swingHitbox } from '@/entities/combat';
import {
  aabbOverlap,
  type Aabb,
  type BouncePadPlacement,
  type LevelDef,
  type MovingPlatformPlacement,
  type NutDropperPlacement,
  type Platform,
  type SwitchPlacement,
} from './level';
import type { PlayerConfig, PlayerState } from '@/entities/player/player';
import { spawnProjectile, type ProjectileConfig, type ProjectileState } from '@/entities/projectile/spikedCorn';

export interface MechanismState {
  activeSwitchIds: readonly string[];
}

export const FALLING_NUT_CONFIG: ProjectileConfig = {
  width: 22,
  height: 22,
  gravity: 0.58,
  maxFall: 11,
};

export function fallingNutsForFrame(
  droppers: readonly NutDropperPlacement[],
  frame: number,
): ProjectileState[] {
  return droppers
    .filter((dropper) => {
      if (!Number.isInteger(dropper.periodFrames) || dropper.periodFrames < 30) {
        throw new Error(`nut dropper "${dropper.id}" needs periodFrames >= 30`);
      }
      return positiveModulo(frame + (dropper.phaseFrames ?? 0), dropper.periodFrames) === 0;
    })
    .map((dropper) => spawnProjectile(dropper.x, dropper.y, 0, 0));
}

export interface ActiveSolid extends Platform {
  id?: string;
  mechanism?: 'moving-platform' | 'gate';
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

export function movingPlatformAt(placement: MovingPlatformPlacement, frame: number): MovingPlatformPlacement {
  if (!Number.isInteger(placement.periodFrames) || placement.periodFrames < 2) {
    throw new Error(`moving platform "${placement.id}" needs periodFrames >= 2`);
  }
  if (placement.travel < 0) throw new Error(`moving platform "${placement.id}" needs non-negative travel`);
  const phase = positiveModulo(frame + (placement.phaseFrames ?? 0), placement.periodFrames);
  const half = placement.periodFrames / 2;
  const unit = phase <= half ? phase / half : (placement.periodFrames - phase) / half;
  const offset = Math.round(placement.travel * unit);
  return {
    ...placement,
    x: placement.x + (placement.axis === 'x' ? offset : 0),
    y: placement.y + (placement.axis === 'y' ? offset : 0),
  };
}

export function activeSolids(level: LevelDef, frame: number, state: MechanismState): ActiveSolid[] {
  const active = new Set(state.activeSwitchIds);
  return [
    ...level.platforms,
    ...(level.movingPlatforms ?? []).map((platform) => ({
      ...movingPlatformAt(platform, frame),
      mechanism: 'moving-platform' as const,
    })),
    ...(level.gates ?? [])
      .filter((gate) => !active.has(gate.switchId))
      .map((gate) => ({ ...gate, mechanism: 'gate' as const })),
  ];
}

export function levelWithActiveSolids(level: LevelDef, frame: number, state: MechanismState): LevelDef {
  return { ...level, platforms: activeSolids(level, frame, state) };
}

function horizontalOverlap(player: PlayerState, cfg: PlayerConfig, box: Aabb): boolean {
  return player.x < box.x + box.w && player.x + cfg.width > box.x;
}

export function carryPlatformRider(
  player: PlayerState,
  cfg: PlayerConfig,
  platforms: readonly MovingPlatformPlacement[],
  frame: number,
): PlayerState {
  for (const placement of platforms) {
    const current = movingPlatformAt(placement, frame);
    const feet = player.y + cfg.height;
    if (!horizontalOverlap(player, cfg, current) || Math.abs(feet - current.y) > 1) continue;
    const next = movingPlatformAt(placement, frame + 1);
    return { ...player, x: player.x + next.x - current.x, y: player.y + next.y - current.y };
  }
  return player;
}

export function resolveBouncePad(
  player: PlayerState,
  cfg: PlayerConfig,
  pads: readonly BouncePadPlacement[],
): PlayerState {
  if (player.vy < 0) return player;
  const feet = player.y + cfg.height;
  const pad = pads.find((candidate) =>
    horizontalOverlap(player, cfg, candidate) && feet >= candidate.y && feet <= candidate.y + candidate.h,
  );
  return pad ? { ...player, vy: -pad.launchV, onGround: false, coyote: 0 } : player;
}

export function resolveSwitches(
  player: PlayerState,
  cfg: PlayerConfig,
  activeSwitchIds: readonly string[],
  switches: readonly SwitchPlacement[],
): readonly string[] {
  const hitbox = swingHitbox(player, cfg);
  if (!hitbox) return activeSwitchIds;
  const active = new Set(activeSwitchIds);
  let changed = false;
  for (const target of switches) {
    if (active.has(target.id) || target.accepts === 'peel') continue;
    if (!aabbOverlap(hitbox, target)) continue;
    active.add(target.id);
    changed = true;
  }
  return changed ? [...active].sort() : activeSwitchIds;
}

export interface PeelSwitchResult {
  peels: ProjectileState[];
  activeSwitchIds: readonly string[];
}

export function resolvePeelSwitches(
  peels: readonly ProjectileState[],
  activeSwitchIds: readonly string[],
  switches: readonly SwitchPlacement[],
  cfg: Pick<ProjectileConfig, 'width' | 'height'>,
): PeelSwitchResult {
  const active = new Set(activeSwitchIds);
  let changed = false;
  const nextPeels = peels.map((peel) => {
    if (!peel.alive) return peel;
    const peelBox = { x: peel.x, y: peel.y, w: cfg.width, h: cfg.height };
    const target = switches.find((candidate) =>
      !active.has(candidate.id) &&
      candidate.accepts !== 'swing' &&
      aabbOverlap(peelBox, candidate),
    );
    if (!target) return peel;
    active.add(target.id);
    changed = true;
    // The target is a bright angled plate: a successful hit returns the peel toward the player and
    // pops it slightly upward, preserving it as a readable ricochet instead of consuming it.
    return { ...peel, vx: -peel.vx, vy: -Math.max(2, Math.abs(peel.vy)) };
  });
  return { peels: nextPeels, activeSwitchIds: changed ? [...active].sort() : activeSwitchIds };
}

export function surfaceGripAt(player: PlayerState, cfg: PlayerConfig, level: LevelDef): number {
  if (!player.onGround && Math.abs(player.vy) > 1) return 1;
  const feet = player.y + cfg.height;
  for (const surface of level.slickSurfaces ?? []) {
    if (surface.grip <= 0 || surface.grip > 1) throw new Error(`slick surface "${surface.id}" needs grip in (0, 1]`);
    if (horizontalOverlap(player, cfg, surface) && Math.abs(feet - surface.y) <= Math.max(2, surface.h)) {
      return surface.grip;
    }
  }
  return 1;
}
