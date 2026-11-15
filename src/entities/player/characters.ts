import { type PlayerConfig, FRED_CONFIG } from './player';
import { BONUS_CHARACTER_COPY } from '@/content/bonusCharacters';

export const DEFAULT_CHARACTER = 'fred';

// A selectable kid: id (replay/sim key), display title + one-line trait (voiced UI copy), and the
// feel its config carries. Every kid shares Fred's body size (width/height) so rendering and the
// collision box stay correct regardless of who is picked; only feel knobs differ.
export interface CharacterDef {
  id: string;
  title: string;
  trait: string;
  config: PlayerConfig;
  requiresVictory?: boolean;
}

// Fred is the balanced template; the other kids share his movement body and use their own sprites.
export const CHARACTER_ROSTER: readonly CharacterDef[] = [
  {
    id: 'fred',
    title: 'Fred',
    trait: 'The all-arounder. No bad habits.',
    config: FRED_CONFIG,
  },
  {
    id: 'daisy',
    title: 'Daisy',
    trait: 'Big floaty hops. Hangs in the air.',
    // floatier: a stronger, lighter jump and a softer fall; a touch slower on the ground.
    config: { ...FRED_CONFIG, jumpV: -14, gravity: 0.58, maxFall: 12, maxRun: 3.8 },
  },
  {
    id: 'theo',
    title: 'Theo',
    trait: 'Built to barrel. Fast feet, low hops.',
    // heavy runner: faster top speed, a heavier and shorter jump. The hop (~97px apex vs Fred's ~105)
    // still clears the tallest loot ledge with the reachability gate's margin (1-1 needs 94px).
    config: { ...FRED_CONFIG, maxRun: 5.1, runAccel: 0.75, jumpV: -13, gravity: 0.82 },
  },
  {
    id: 'rosa',
    title: 'Rosa',
    trait: 'Quick and twitchy. Forgiving feet.',
    // nimble: snappier acceleration and roomier coyote/buffer windows (easy to control).
    config: { ...FRED_CONFIG, runAccel: 0.9, runDecel: 1.0, coyoteFrames: 8, jumpBufferFrames: 8 },
  },
  { id: 'luca', ...BONUS_CHARACTER_COPY.luca, requiresVictory: true, config: { ...FRED_CONFIG, swingFrames: 4, swingCooldown: 3 } },
  { id: 'izzy', ...BONUS_CHARACTER_COPY.izzy, requiresVictory: true, config: { ...FRED_CONFIG, canTurnInvisible: true } },
];

export function selectableCharacters(campaignVictory: boolean): readonly CharacterDef[] {
  return CHARACTER_ROSTER.filter((kid) => !kid.requiresVictory || campaignVictory);
}

export function canSelectCharacter(id: string, campaignVictory: boolean): boolean {
  return selectableCharacters(campaignVictory).some((kid) => kid.id === id);
}

const ROSTER = new Map<string, PlayerConfig>();

function seed(): void {
  for (const c of CHARACTER_ROSTER) ROSTER.set(c.id, c.config);
}
seed();

// Register a character's feel. A registered id (including the seeded roster) CANNOT be replaced —
// like registerEntity, a duplicate throws — so a fixture's characterId maps to a stable config
// regardless of process history (the One Rule).
export function registerCharacter(id: string, config: PlayerConfig): void {
  if (ROSTER.has(id)) {
    throw new Error(`registerCharacter: duplicate character "${id}"`);
  }
  ROSTER.set(id, config);
}

// Resolve a character id to its config; an unregistered id degrades to the template hero (Fred).
export function playerConfigFor(id: string): PlayerConfig {
  return ROSTER.get(id) ?? FRED_CONFIG;
}

export function characterIds(): string[] {
  return [...ROSTER.keys()];
}

export function __resetCharacters(): void {
  ROSTER.clear();
  seed();
}
