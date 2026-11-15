// The popcorn-volcano finale timeline (presentation only). A closed-form map from a scene-local
// frame counter to everything Phaser draws: no sim imports, no wall clock, no random emitter, and no
// Math.random. The cinematic camera, lighting, plume, debris, and popcorn variants therefore obey the
// One Rule just as strictly as the underlying final fight.

export const FINALE = Object.freeze({
  BURST: 120, // a two-second swell/readable breath, then the crater opens
  BANNER_AT: 180, // the clear banner lands one second after the eruption
  TAPER_END: 480, // the fountain settles into a quiet celebration loop
  CREDITS_AT: 540, // hold one calm second on the brimming crater, then roll credits
  LOOP_PERIOD: 60,
  FOUNTAIN: 64, // eight authored waves of eight arcs
  POOL: 96,
} as const);

export const VOLCANO_DISPLAY_H = 240;
export const PLUME_DISPLAY_H = 300;
export const FINALE_CRATER_INSET = 22;

export type FinaleParticleKey =
  | 'finale-popcorn-kernel'
  | 'finale-popcorn-puff-a'
  | 'finale-popcorn-puff-b'
  | 'finale-popcorn-puff-c'
  | 'finale-popcorn-puff-d'
  | 'finale-husk-shard';

export interface FinaleParticle {
  key: FinaleParticleKey;
  x: number;
  y: number;
  scale: number;
  alpha: number;
  rot: number;
}

export interface FinaleKeyframe {
  volcanoScaleY: number; // bottom-anchored 0.06→1 swell
  rumble: number; // deterministic mound-only x jitter
  cameraZoom: number; // restrained cinematic push, never gameplay state
  veilAlpha: number; // world dim before the butter-lit burst
  craterGlow: number; // persistent warm light intensity
  flash: { scale: number; alpha: number } | null;
  plume: { scaleX: number; scaleY: number; alpha: number } | null;
  shockwave: { scale: number; alpha: number } | null;
  particles: FinaleParticle[];
  bannerOn: boolean;
  creditsOn: boolean;
  kingVisible: boolean;
  sfx: ('burst' | 'pop' | 'fanfare')[];
}

const G = 0.32;
const SWELL_START = 36;
const SWELL_END = 112;
const RUMBLE_AMP = 5;
const RUMBLE_EASE = 40;
const POP_SILENCE_AFTER = 200;
const KING_POP = FINALE.BURST;
const KING_CENTER_OFF = 55;

const PUFF_KEYS = [
  'finale-popcorn-puff-a',
  'finale-popcorn-puff-b',
  'finale-popcorn-puff-c',
  'finale-popcorn-puff-d',
] as const;

// An irregular upward throw reads like a real pressure release. A perfect radial ring looked like a
// stamped wreath once the detailed popcorn silhouettes replaced the placeholders.
const KING_BURST_VELOCITIES: readonly (readonly [number, number])[] = [
  [-3.8, -5.5], [-3.2, -4.3], [-2.7, -3.2], [-2.1, -5.0],
  [-1.5, -3.8], [-1.0, -5.8], [-0.4, -4.6], [0.2, -3.4],
  [0.7, -5.2], [1.2, -4.0], [1.7, -5.7], [2.2, -3.5],
  [2.8, -4.8], [3.4, -4.2], [0.5, -6.1], [-0.6, -2.9],
];

const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value);
const easeOutCubic = (value: number): number => 1 - (1 - value) ** 3;
const puffKey = (seed: number): (typeof PUFF_KEYS)[number] => PUFF_KEYS[Math.abs(seed) % PUFF_KEYS.length]!;

// Eight waves of eight. Index arithmetic supplies the variation, so each replay gets the same
// popcorn physics while the four authored silhouettes prevent a stamped-particle look.
const spec = (index: number): { t0: number; vx: number; vy: number; popAt: number } => ({
  t0: FINALE.BURST + (index % 8) * 5 + Math.floor(index / 8) * 26,
  vx: [-3.1, -2.2, -1.35, -0.55, 0.55, 1.35, 2.2, 3.1][index % 8]!,
  vy: -(7.2 + ((index * 5) % 6) * 0.45),
  popAt: 12 + ((index * 3) % 7),
});

export function finaleKeyframe(frame: number, originX: number, groundY: number): FinaleKeyframe {
  const swell = easeOutCubic(clamp01((frame - SWELL_START) / (SWELL_END - SWELL_START)));
  const volcanoScaleY = 0.06 + 0.94 * swell;

  // Slow push-in during the held breath, a tiny punch at the burst, then a stable celebratory frame.
  const cameraZoom = frame < FINALE.BURST
    ? 1 + 0.07 * easeOutCubic(clamp01(frame / FINALE.BURST))
    : 1.025 + 0.075 * (1 - clamp01((frame - FINALE.BURST) / 42));

  // Dim the arena behind the King so the butter fissures become the focal point. The veil clears on
  // the burst instead of flashing the whole canvas white (safer and less fatiguing).
  const veilAlpha = frame < FINALE.BURST
    ? 0.36 * easeOutCubic(clamp01((frame - 45) / (FINALE.BURST - 45)))
    : frame < FINALE.BURST + 18
      ? 0.12 * (1 - (frame - FINALE.BURST) / 18)
      : 0;

  let amp = 0;
  if (frame <= FINALE.BURST) amp = RUMBLE_AMP * easeOutCubic(frame / FINALE.BURST);
  else if (frame < FINALE.BURST + RUMBLE_EASE) amp = RUMBLE_AMP * (1 - (frame - FINALE.BURST) / RUMBLE_EASE);
  const rumble = amp > 0 ? Math.sin(frame * 0.9) * amp : 0;

  const burstDt = frame - FINALE.BURST;
  const preGlow = 0.12 + 0.36 * swell;
  const craterGlow = burstDt < 0
    ? preGlow
    : burstDt < 100
      ? 0.34 + 0.66 * (1 - burstDt / 100)
      : 0.3 + Math.sin(frame * 0.08) * 0.035;

  const flash = burstDt >= 0 && burstDt < 18
    ? { scale: 1 + burstDt * 0.34, alpha: 1 - burstDt / 18 }
    : null;

  let plume: FinaleKeyframe['plume'] = null;
  if (burstDt >= 0 && burstDt < 180) {
    const grow = easeOutCubic(clamp01(burstDt / 18));
    const fade = burstDt > 110 ? clamp01((180 - burstDt) / 70) : 1;
    plume = {
      scaleX: 0.64 + 0.36 * grow,
      scaleY: 0.12 + 0.88 * grow,
      alpha: clamp01(grow * 1.25) * fade,
    };
  }

  const shockwave = burstDt >= 0 && burstDt < 32
    ? { scale: 0.45 + burstDt * 0.14, alpha: 1 - burstDt / 32 }
    : null;

  const craterY = groundY - VOLCANO_DISPLAY_H + FINALE_CRATER_INSET;
  const particles: FinaleParticle[] = [];
  const sfx: ('burst' | 'pop' | 'fanfare')[] = [];

  if (frame < FINALE.TAPER_END) {
    for (let index = 0; index < FINALE.FOUNTAIN; index++) {
      const launch = spec(index);
      const t = frame - launch.t0;
      if (t < 0 || t > launch.popAt + 68) continue;
      const y = craterY + launch.vy * t + 0.5 * G * t * t;
      if (y >= groundY - 4) continue;
      const x = originX + launch.vx * t;
      const popped = t >= launch.popAt;
      const alpha = clamp01(Math.min((launch.popAt + 68 - t) / 20, (groundY - 4 - y) / 30));
      particles.push({
        key: popped ? puffKey(index) : 'finale-popcorn-kernel',
        x,
        y,
        scale: popped ? Math.min(2.0, 0.9 + (t - launch.popAt) * 0.16) : 0.58,
        alpha,
        rot: t * 0.1 * (index % 2 ? 1 : -1),
      });
      if (index % 4 === 0 && t === launch.popAt && frame <= POP_SILENCE_AFTER) sfx.push('pop');
    }
  } else {
    // Absolute launch frames across this and the previous loop keep in-flight puffs continuous at wrap.
    const loopFrame = frame - FINALE.TAPER_END;
    const cycle = Math.floor(loopFrame / FINALE.LOOP_PERIOD);
    const velocities = [-1.45, -0.9, -0.35, 0.35, 0.9, 1.45];
    for (let cyc = cycle - 1; cyc <= cycle; cyc++) {
      for (let index = 0; index < velocities.length; index++) {
        const t = loopFrame - (cyc * FINALE.LOOP_PERIOD + index * 10);
        if (t < 0 || t > 46) continue;
        const y = craterY - 4.7 * t + 0.5 * G * t * t;
        if (y >= groundY - 4) continue;
        const alpha = clamp01(Math.min((46 - t) / 12, (groundY - 4 - y) / 30));
        particles.push({
          key: puffKey(index + cyc),
          x: originX + velocities[index]! * t,
          y,
          scale: 1.15 + (index % 3) * 0.12,
          alpha,
          rot: t * 0.07 * (index % 2 ? 1 : -1),
        });
      }
    }
  }

  // The crater lip tears open on the burst. These fibrous husk shards are visual debris, not danger.
  if (burstDt >= 0 && burstDt <= 58) {
    const velocities = [-3.4, -2.8, -2.1, -1.4, -0.7, 0.7, 1.4, 2.1, 2.8, 3.4];
    for (let index = 0; index < velocities.length; index++) {
      const t = burstDt - (index % 3) * 2;
      if (t < 0) continue;
      const vy = -(5.8 + (index % 4) * 0.45);
      const y = craterY + vy * t + 0.5 * G * t * t;
      if (y >= groundY - 4) continue;
      particles.push({
        key: 'finale-husk-shard',
        x: originX + velocities[index]! * t,
        y,
        scale: 0.42 + (index % 3) * 0.1,
        alpha: clamp01(Math.min((58 - t) / 14, (groundY - 4 - y) / 30)),
        rot: t * 0.16 * (index % 2 ? 1 : -1),
      });
    }
  }

  // Corn King un-cobs into an authored, irregular upward burst, then one large popped kernel settles
  // in his place. The fixed velocity list gives natural-looking asymmetry without runtime randomness.
  const kingY = groundY - KING_CENTER_OFF;
  const kingDt = frame - KING_POP;
  if (kingDt >= 0 && kingDt <= 44) {
    for (let index = 0; index < KING_BURST_VELOCITIES.length; index++) {
      const [vx, vy] = KING_BURST_VELOCITIES[index]!;
      const y = kingY + vy * kingDt + 0.5 * G * kingDt * kingDt;
      if (y >= groundY - 4) continue;
      const alpha = clamp01(Math.min((44 - kingDt) / 14, (groundY - 4 - y) / 30));
      particles.push({
        key: puffKey(index),
        x: originX + vx * kingDt,
        y,
        scale: Math.min(1.5, 0.68 + (index % 4) * 0.08 + kingDt * 0.08),
        alpha,
        rot: kingDt * 0.12 * (index % 2 ? 1 : -1),
      });
    }
  }
  if (kingDt >= 10) {
    particles.push({
      key: 'finale-popcorn-puff-c',
      x: originX,
      y: groundY - 40,
      scale: Math.min(2.6, (kingDt - 10) * 0.13),
      alpha: 1,
      rot: 0,
    });
  }

  const rimX = [-34, -24, -14, -5, 5, 14, 24, 34];
  const rimY = [2, -2, 1, -4, -3, 0, -2, 2];
  for (let index = 0; index < rimX.length; index++) {
    const t = frame - (315 + index * 10);
    if (t < 0) continue;
    particles.push({
      key: puffKey(index + 1),
      x: originX + rimX[index]!,
      y: craterY + rimY[index]!,
      scale: 1 + (index % 4) * 0.16,
      alpha: clamp01(t / 18),
      rot: (index - 3.5) * 0.13,
    });
  }

  if (frame === FINALE.BURST) sfx.push('burst');
  if (frame === FINALE.BANNER_AT) sfx.push('fanfare');

  return {
    volcanoScaleY,
    rumble,
    cameraZoom,
    veilAlpha,
    craterGlow,
    flash,
    plume,
    shockwave,
    particles,
    bannerOn: frame >= FINALE.BANNER_AT,
    creditsOn: frame >= FINALE.CREDITS_AT,
    kingVisible: frame < KING_POP,
    sfx,
  };
}
