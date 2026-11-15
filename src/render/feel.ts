import type { BossState } from '@/entities/boss/kingCorn';
import type { InputFrame } from '@/core/replay';
import type { WorldState } from '@/entities/level/run';
import type { PlayerConfig } from '@/entities/player/player';
import { aabbOverlap, type LevelDef } from '@/entities/level/level';
import { objectiveText } from '@/content/strings';
import type { FxEvent } from './fx';

// A field with a caged friend opens on its objective (UX review #7); other stages say nothing.
export function objectiveCue(level: LevelDef): string | undefined {
  const friend = level.allies?.[0];
  return friend && level.goal ? objectiveText(friend.name) : undefined;
}

// The kid just touched the barn door while a friend is still caged — say why it stays shut. Fires on
// the touch edge only, so standing at the door does not repeat it every frame.
export function lockedDoorTouched(prev: WorldState, curr: WorldState, level: LevelDef, pCfg: PlayerConfig): boolean {
  if (!level.goal || curr.allies.every((ally) => ally.freed)) return false;
  const touching = (w: WorldState) => aabbOverlap({ x: w.player.x, y: w.player.y, w: pCfg.width, h: pCfg.height }, level.goal!);
  return touching(curr) && !touching(prev);
}

// A kill or a boss hit freezes the action this many frames (UX review #10). The scene skips its sim
// step for them, like a pause, so frozen frames are never sim frames.
export const HIT_STOP_FRAMES = 4;

export function hitStopFor(events: readonly FxEvent[]): number {
  return events.some((e) => e.type === 'squish' || e.type === 'boss-hit') ? HIT_STOP_FRAMES : 0;
}

// Presses seen during a freeze. Jump, swing and power edges are detected inside the sim, so a tap
// that starts and ends inside a freeze would vanish; the latch carries it to the next sim frame.
export type LatchedPresses = Pick<InputFrame, 'jump' | 'attack' | 'power'>;

export function latchPresses(latched: LatchedPresses | undefined, input: InputFrame): LatchedPresses {
  return {
    jump: (latched?.jump ?? false) || input.jump,
    attack: (latched?.attack ?? false) || input.attack,
    power: (latched?.power ?? false) || input.power === true,
  };
}

export function mergeLatched(input: InputFrame, latched: LatchedPresses | undefined): InputFrame {
  if (!latched) return input;
  return {
    ...input,
    jump: input.jump || latched.jump,
    attack: input.attack || latched.attack,
    ...(latched.power || input.power ? { power: true } : {}),
  };
}

// One display scale per kid, taken from the idle frame, so crouched jump and swing art no longer
// balloons the kid up to 15% (UX review #12). Feet stay anchored by the sprite's bottom origin.
export function kidDisplayScale(idleNativeHeight: number, boxHeight: number, overhang: number): number {
  return (boxHeight * overhang) / (idleNativeHeight || boxHeight);
}

// A distinct wind-up silhouette per attack, by transform only (no new art): a lob leans back away
// from its throw, a dash crouches low and wide, a slam rears up tall. It builds as the launch nears.
// The hop keeps the coil the scene already draws. Angles are radians, signed by the boss's facing.
export interface WindupLook {
  scaleX: number;
  scaleY: number;
  angle: number;
  dy: number;
}

export function bossWindupLook(b: BossState, windupFrames: number): WindupLook | null {
  if (b.mode !== 'windup' || !b.attack || b.attack === 'hop' || b.hp <= 0) return null;
  const t = Math.min(1, Math.max(0, 1 - b.modeTimer / Math.max(1, windupFrames)));
  if (b.attack === 'lob') return { scaleX: 1, scaleY: 1 + 0.05 * t, angle: -b.dir * 0.22 * t, dy: 0 };
  if (b.attack === 'dash') return { scaleX: 1 + 0.12 * t, scaleY: 1 - 0.16 * t, angle: b.dir * 0.14 * t, dy: 0 };
  return { scaleX: 1 - 0.08 * t, scaleY: 1 + 0.16 * t, angle: 0, dy: -12 * t }; // slam
}

// The mid background layer is full of painted cobs that compete with the real ones (UX review Tier 3:
// yellow on yellow). Its tint grade is darkened by this factor so scenery recedes behind actors.
export const MID_LAYER_MUTE = 0.8;

export function mutedTint(color: number, factor: number): number {
  const channel = (shift: number) => Math.round(((color >> shift) & 0xff) * factor) << shift;
  return channel(16) | channel(8) | channel(0);
}

// A felled critter is dizzy for a beat, poofs once, then is gone: no lingering flattened body
// (UX review #14, a child-safety flag).
export const KO_VISIBLE_FRAMES = 36;

export function koPhase(framesSinceKo: number): 'dizzy' | 'poof' | 'gone' {
  if (framesSinceKo < KO_VISIBLE_FRAMES) return 'dizzy';
  return framesSinceKo === KO_VISIBLE_FRAMES ? 'poof' : 'gone';
}
