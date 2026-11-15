import type { PowerKind } from '@/entities/player/powerup';

// One frame of input. Fixed-order boolean lanes keep serialization stable across builds.
export interface InputFrame {
  left: boolean;
  right: boolean;
  jump: boolean;
  attack: boolean;
  power?: boolean;
  ability?: boolean;
  switchCharacter?: boolean;
  selectPower?: PowerKind; // equip this rescued crew friend this frame (the scene decides when it may be sent)
}

export const NO_INPUT: InputFrame = Object.freeze({ left: false, right: false, jump: false, attack: false, power: false });

export interface ReplayInit {
  lives?: number;
  activePower?: PowerKind;
  crewCharges?: Partial<Record<PowerKind, number>>;
  bossAssistTier?: number;
  royale?: { cleared?: string[]; shuffleSeed?: number };
}

export interface ReplayFixture {
  seed: number; // uint32 run seed feeding src/core/rng.ts
  levelId: string; // e.g. "1-1"
  characterId: string; // selectable hero, e.g. "fred"
  canSwitchCharacters?: boolean; // victory entitlement captured at the start, never read from live storage during replay
  entryCheckpoint: number; // checkpoint index the run starts from
  revision: string; // build git sha (provenance)
  init?: ReplayInit; // omitted = the bare level default (every legacy fixture)
  inputStream: InputFrame[]; // per-frame input record
}

// Every PowerKind the writer can emit; 'none' and 'cornpop' are no-ops in the stepper but must still load.
const CREW_SELECTIONS: readonly PowerKind[] = ['none', 'cornpop', 'berryRush', 'carrotReach', 'blueBounce', 'leafGuard', 'peelToss'];

export function serializeReplay(fixture: ReplayFixture): string {
  const selects = fixture.inputStream.flatMap((f, i) => (f.selectPower ? [[i, f.selectPower] as const] : []));
  return JSON.stringify({
    seed: fixture.seed >>> 0,
    levelId: fixture.levelId,
    characterId: fixture.characterId,
    ...(fixture.canSwitchCharacters !== undefined ? { canSwitchCharacters: fixture.canSwitchCharacters } : {}),
    entryCheckpoint: fixture.entryCheckpoint,
    revision: fixture.revision,
    ...(fixture.init ? { init: stableInit(fixture.init) } : {}),
    inputStream: fixture.inputStream.map((f) => encodeFrame(f)),
    ...(selects.length ? { selects } : {}),
  });
}

export function deserializeReplay(json: string): ReplayFixture {
  const raw = JSON.parse(json) as Omit<ReplayFixture, 'inputStream'> & { inputStream: number[]; selects?: unknown };
  const { selects, ...rest } = raw;
  const inputStream = raw.inputStream.map(decodeFrame);
  for (const entry of Array.isArray(selects) ? selects : selects === undefined ? [] : [null]) {
    const [index, power] = Array.isArray(entry) ? entry : [];
    if (!Number.isInteger(index) || index < 0 || index >= inputStream.length || !CREW_SELECTIONS.includes(power)) {
      throw new Error(`deserializeReplay: invalid crew selection ${JSON.stringify(entry)}`);
    }
    inputStream[index] = { ...inputStream[index]!, selectPower: power as PowerKind };
  }
  return { ...rest, seed: raw.seed >>> 0, inputStream };
}

// Fixed key order for the init record so equal inits serialize identically.
function stableInit(init: ReplayInit): ReplayInit {
  const crew = init.crewCharges;
  return {
    ...(init.lives !== undefined ? { lives: init.lives } : {}),
    ...(init.activePower !== undefined ? { activePower: init.activePower } : {}),
    ...(crew ? { crewCharges: Object.fromEntries(Object.keys(crew).sort().map((power) => [power, crew[power as PowerKind]])) } : {}),
    ...(init.bossAssistTier !== undefined ? { bossAssistTier: init.bossAssistTier } : {}),
    ...(init.royale ? { royale: {
      ...(init.royale.cleared ? { cleared: [...init.royale.cleared] } : {}),
      ...(init.royale.shuffleSeed !== undefined ? { shuffleSeed: init.royale.shuffleSeed >>> 0 } : {}),
    } } : {}),
  };
}

// 7-bit packed frame: left=1, right=2, jump=4, attack=8, crew power=16, ability=32, switch kid=64.
function encodeFrame(f: InputFrame): number {
  return (f.left ? 1 : 0) | (f.right ? 2 : 0) | (f.jump ? 4 : 0) | (f.attack ? 8 : 0) | (f.power ? 16 : 0) | (f.ability ? 32 : 0) | (f.switchCharacter ? 64 : 0);
}

function decodeFrame(bits: number): InputFrame {
  // Reject malformed input: only the seven defined lanes (0..127) are valid. A higher bit means
  // a corrupt or wrong-version replay, which must fail loudly, not silently drop lanes.
  if (!Number.isInteger(bits) || bits < 0 || bits > 127) {
    throw new Error(`deserializeReplay: invalid input frame ${bits} (expected 0..127)`);
  }
  const frame: InputFrame = {
    left: !!(bits & 1),
    right: !!(bits & 2),
    jump: !!(bits & 4),
    attack: !!(bits & 8),
  };
  return { ...frame, ...(bits & 16 ? { power: true } : {}), ...(bits & 32 ? { ability: true } : {}), ...(bits & 64 ? { switchCharacter: true } : {}) };
}
