import { type BossConfig, KING_CORN_CONFIG } from './kingCorn';

// Butter Stick (field 1) — the warm-up. It first teaches one slow LOB and a wide-open recovery. Below
// half, the same tell becomes a committed two-corn toss (one low, one high), alternating with a short,
// heavily telegraphed butter-slide. The new move is a second-half surprise, not an opening gotcha.
export const BUTTER_STICK_CONFIG: BossConfig = {
  width: 70,
  height: 80,
  gravity: 0.7,
  maxFall: 14,
  maxHp: 4,
  hitCooldownFrames: 28,
  stompBand: 24,
  dashSpeed: 5,
  lobSpeed: 3.4,
  lobLob: -7,
  slamJump: -11,
  hopJump: -13, // unused — Butter Stick stays grounded (the teaching fight); present for config-shape consistency
  phases: [
    { aboveHpFrac: 0.5, paceSpeed: 1.4, paceFrames: 154, windupFrames: 44, recoverFrames: 80, attacks: ['lob'], guardWhilePacing: true },
    {
      aboveHpFrac: 0,
      paceSpeed: 1.7,
      paceFrames: 128,
      windupFrames: 42,
      recoverFrames: 82,
      attacks: ['lob', 'dash'],
      guardWhilePacing: true,
      attackProfiles: {
        lob: {
          windupFrames: 46,
          recoverFrames: 86,
          lobShots: [
            { delayFrames: 0, speedMul: 0.9, liftMul: 0.9 },
            { delayFrames: 12, speedMul: 1.05, liftMul: 1.25 },
          ],
        },
        dash: { windupFrames: 54, activeFrames: 28, recoverFrames: 88 },
      },
    },
  ],
};

// General Acorn (field 3) — the busy fight: a quick pacer that mixes LOBS and a DASH, escalating to a
// tighter cadence in its second phase. More hp, shorter tells than the warm-up.
export const GENERAL_ACORN_CONFIG: BossConfig = {
  width: 76,
  height: 84,
  gravity: 0.7,
  maxFall: 14,
  maxHp: 5,
  hitCooldownFrames: 26,
  stompBand: 26,
  dashSpeed: 6,
  lobSpeed: 4.4,
  lobLob: -8,
  slamJump: -12,
  hopJump: -17,
  phases: [
    { aboveHpFrac: 0.5, paceSpeed: 1.8, paceFrames: 116, windupFrames: 36, recoverFrames: 66, attacks: ['lob', 'dash'], guardWhilePacing: true },
    {
      aboveHpFrac: 0,
      paceSpeed: 2.2,
      paceFrames: 92,
      windupFrames: 30,
      recoverFrames: 64,
      attacks: ['dash', 'lob', 'hop'],
      guardWhilePacing: true,
      attackProfiles: {
        lob: {
          lobShots: [
            { delayFrames: 0, speedMul: 1, liftMul: 1.1 },
            { delayFrames: 8, speedMul: 0.88, liftMul: 0.82 },
            { delayFrames: 16, speedMul: 1.12, liftMul: 1.35 },
          ],
        },
      },
    },
  ],
};

// Sir Pickle (field 4) — the patient, heavy fight: tall and slow, with the longest tells, built around
// the DASH and the leaping SLAM (its shockwave fan). The deliberate test right before the King Corn
// climax; the most hp of the single field bosses.
export const SIR_PICKLE_CONFIG: BossConfig = {
  width: 64,
  height: 100,
  gravity: 0.7,
  maxFall: 14,
  maxHp: 5,
  hitCooldownFrames: 32,
  stompBand: 28,
  dashSpeed: 5.5,
  lobSpeed: 4,
  lobLob: -8,
  slamJump: -13,
  hopJump: -18,
  phases: [
    { aboveHpFrac: 0.5, paceSpeed: 1.1, paceFrames: 138, windupFrames: 44, recoverFrames: 74, attacks: ['dash', 'slam'], guardWhilePacing: true },
    {
      aboveHpFrac: 0,
      paceSpeed: 1.5,
      paceFrames: 110,
      windupFrames: 38,
      recoverFrames: 74,
      attacks: ['slam', 'hop', 'dash'],
      guardWhilePacing: true,
      attackProfiles: {
        slam: {
          windupFrames: 52,
          recoverFrames: 90,
          slamFan: [
            { vxMul: -1.8, vy: -6 },
            { vxMul: -1.15, vy: -8 },
            { vxMul: -0.55, vy: -10 },
            { vxMul: 0.55, vy: -10 },
            { vxMul: 1.15, vy: -8 },
            { vxMul: 1.8, vy: -6 },
          ],
        },
      },
    },
  ],
};

export const SALT_CONFIG: BossConfig = {
  width: 60,
  height: 92,
  gravity: 0.7,
  maxFall: 14,
  maxHp: 4,
  hitCooldownFrames: 28,
  stompBand: 26,
  openingPaceFrames: 84, // Salt calls the opening lunge; Pepper answers one second later
  soloPaceTicks: 1, // last shaker standing scrambles sooner; tell and recovery timing stay intact
  dashSpeed: 5.5,
  lobSpeed: 3.6,
  lobLob: -7,
  slamJump: -11,
  hopJump: -13, // unused — Salt stays the grounded lunger (his identity); present for config-shape consistency
  phases: [{ aboveHpFrac: 0, paceSpeed: 1.3, paceFrames: 138, windupFrames: 42, recoverFrames: 72, attacks: ['dash'], guardWhilePacing: true }],
};

// Pepper (the brawler) — the nimble shaker: quick, low-hp, a single-phase LOBBER; the team falls when
// BOTH are popped, so its job is to pepper you with corn while you deal with Salt's lunges.
export const PEPPER_CONFIG: BossConfig = {
  width: 56,
  height: 80,
  gravity: 0.7,
  maxFall: 14,
  maxHp: 3,
  hitCooldownFrames: 24,
  stompBand: 24,
  openingPaceFrames: 144, // the answer beat, staged well clear of Salt's first tell
  soloPaceTicks: 1, // last shaker standing scrambles sooner; tell and recovery timing stay intact
  dashSpeed: 6,
  lobSpeed: 4,
  lobLob: -8,
  slamJump: -11,
  hopJump: -16,
  phases: [{
    aboveHpFrac: 0,
    paceSpeed: 1.7,
    paceFrames: 120,
    windupFrames: 36,
    recoverFrames: 66,
    attacks: ['lob', 'hop'],
    guardWhilePacing: true,
  }], // the nimble shaker peppers from range, then takes its own ledge
};

// Boss config by registry name (single-target bosses + the two team shakers, keyed by member name).
export const BOSS_CONFIGS: Record<string, BossConfig> = {
  kingCorn: KING_CORN_CONFIG,
  butterStick: BUTTER_STICK_CONFIG,
  generalAcorn: GENERAL_ACORN_CONFIG,
  sirPickle: SIR_PICKLE_CONFIG,
  salt: SALT_CONFIG,
  pepper: PEPPER_CONFIG,
};

export function bossConfigFor(name: string): BossConfig {
  const cfg = BOSS_CONFIGS[name];
  if (!cfg) throw new Error(`bossConfigFor: no config for boss "${name}"`);
  return cfg;
}
