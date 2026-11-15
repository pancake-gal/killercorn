import type { BossState } from '@/entities/boss/kingCorn';
import type { FinaleKeyframe } from './finale';

// Mercy frames after a hit: a 7.5 Hz blink, or a steady see-through kid under reduced motion.
export function invulnAlpha(invuln: number, reduced: boolean): number {
  if (invuln <= 0) return 1;
  if (reduced) return 0.55;
  return invuln % 8 < 4 ? 0.45 : 1;
}

// A boss blinks while flashing from a hit and while winding up (the tell); reduced motion holds one
// dimmed alpha for the same states instead.
export function bossBlinkAlpha(b: BossState, reduced: boolean): number {
  if (b.hp <= 0) return 1;
  const timer = b.hitCooldown > 0 ? b.hitCooldown : b.mode === 'windup' ? b.modeTimer : -1;
  if (timer < 0) return 1;
  if (reduced) return 0.7;
  return timer % 8 < 4 ? 0.55 : 1;
}

// King Corn's rage: a hot tint pulse and a ±3 px tremble, or a steady tint and no tremble.
export function rageLook(frame: number, reduced: boolean): { tinted: boolean; dx: number } {
  if (reduced) return { tinted: true, dx: 0 };
  return { tinted: frame % 16 < 6, dx: (Math.floor(frame / 2) % 2 === 0 ? 1 : -1) * 3 };
}

// The full-body white flash on a hit. Under reduced motion the hurt pose alone carries the cue.
export function hurtFlashFill(reduced: boolean): boolean {
  return !reduced;
}

// The finale without the camera push, the mound tremble, the crater flash or the shockwave ring; the
// swell, plume, popcorn, banner and credits still tell the ending.
export function calmFinaleKeyframe(kf: FinaleKeyframe): FinaleKeyframe {
  return { ...kf, cameraZoom: 1, rumble: 0, flash: null, shockwave: null };
}
