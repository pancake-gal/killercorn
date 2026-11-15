// Player power table behind rescued-friend selection and wheat-box rewards. Cornpop is a timed
// overlay; rescued crew powers remain selected across hits, respawns, and stage boundaries. Pure
// data + a pure resolver — no Math.random, no state (the One Rule); the live power and its resources
// live on PlayerState (player.ts), while this module declares what each power does. Two effects reach
// past a config overlay (full ally fidelity): `grantsShield`
// (lettuce's leaf guard — one hit absorbed, resolved in the world stepper) and `emitsPeel` (banana's
// slip attack — each swing tosses a peel that fells a foe). Adding a power is a data entry here.

import { type PlayerConfig } from './player';

// 'none' = base feel (no overlay). Concrete powers are the keys of POWER_UPS.
export type PowerKind =
  | 'none'
  | 'cornpop' // the wheat-box power
  | 'berryRush' // strawberry — a SPEED burst
  | 'carrotReach' // carrot — a LONGER swing REACH
  | 'blueBounce' // blueberry — a HIGHER JUMP
  | 'leafGuard' // lettuce — a LEAF SHIELD (one hit absorbed before a knockback)
  | 'peelToss'; // banana — a SLIP ATTACK (each swing tosses a peel that fells a foe)

export interface PowerUp {
  // Knobs overlaid on the base PlayerConfig while the power is active; everything else stays base.
  config: Partial<PlayerConfig>;
  // Frames the legacy overlay lasts once granted. 0 = a persistent crew selection with no global
  // countdown; only an explicit selection/clear replaces it. Shield state is tracked separately.
  durationFrames: number;
  maxCharges: number;
  // Lettuce's leaf guard: arming this power raises a one-hit shield on the player (player.shield).
  // The world stepper consumes it instead of respawning on the next hit. Not a config overlay.
  grantsShield?: boolean;
  // Banana's slip attack: while live, every swing the player starts tosses a peel projectile that
  // fells the first enemy it touches. Emitted + resolved in the world stepper. Not a config overlay.
  emitsPeel?: boolean;
}

export const POWER_UPS: Record<Exclude<PowerKind, 'none'>, PowerUp> = {
  // Cornpop: a springier, faster hop. The wheat-box power — proves a power reshapes feel.
  cornpop: { config: { jumpV: -15, maxRun: 5.4 }, durationFrames: 600, maxCharges: 0 },
  // Strawberry SPEED: a faster top run and quicker pickup.
  berryRush: { config: { maxRun: 6.2, runAccel: 0.95 }, durationFrames: 0, maxCharges: 2 },
  // Carrot REACH: a longer, taller swing hitbox — clear foes from farther away.
  carrotReach: { config: { swingReach: 74, swingHeight: 56 }, durationFrames: 0, maxCharges: 0 },
  // Blueberry HIGHER JUMP: a stronger launch (more-negative jumpV).
  blueBounce: { config: { jumpV: -15.5 }, durationFrames: 0, maxCharges: 1 },
  // Lettuce LEAF SHIELD: no feel overlay — it arms a one-hit guard (stays until it absorbs a hit).
  leafGuard: { config: {}, durationFrames: 0, maxCharges: 1, grantsShield: true },
  // Banana SLIP ATTACK: no feel overlay — each swing tosses a peel that fells a foe.
  peelToss: { config: {}, durationFrames: 0, maxCharges: 3, emitsPeel: true },
};

// Effective config = base with the active power's deltas overlaid. 'none' is the unmodified base.
export function powerConfig(base: PlayerConfig, power: PowerKind): PlayerConfig {
  return power === 'none' ? base : { ...base, ...POWER_UPS[power].config };
}
