export interface Aabb {
  x: number; // left
  y: number; // top
  w: number;
  h: number;
}

export interface Platform extends Aabb {}

// Authored field mechanisms. Their motion and state are frame-derived in mechanics.ts, so they
// remain deterministic and replayable: no tween clocks, physics bodies, or DOM state own gameplay.
export interface MovingPlatformPlacement extends Aabb {
  id: string;
  axis: 'x' | 'y';
  travel: number;
  periodFrames: number;
  phaseFrames?: number;
}

export interface BouncePadPlacement extends Aabb {
  id: string;
  launchV: number;
}

export interface SwitchPlacement extends Aabb {
  id: string;
  accepts: 'swing' | 'peel' | 'either';
}

export interface GatePlacement extends Aabb {
  id: string;
  switchId: string;
}

export interface SlickSurfacePlacement extends Aabb {
  id: string;
  grip: number;
}

export interface NutDropperPlacement {
  id: string;
  x: number;
  y: number;
  periodFrames: number;
  phaseFrames?: number;
}

export interface EnemyPlacement {
  name: string;
  x: number;
  y: number;
  patrolLeft: number;
  patrolRight: number;
  batterySwitchId?: string; // an active linked target disables this squirrel's lob machinery
}

// A pickup placed in the level (good corn / score). Size + value come from the collectible config.
export interface CollectiblePlacement {
  name: string;
  x: number;
  y: number;
}

// A static danger zone (thresher, spikes). Size comes from the hazard config; touching it sends
// the player back to the last armed checkpoint.
export interface HazardPlacement {
  name: string;
  x: number;
  y: number;
}

// A wheat-stamped power-up box at rest. Size + the power it grants come from the powerup config;
// break it (swing/stomp) to refill the selected crew power or bank fallback score.
export interface PowerupPlacement {
  name: string;
  x: number;
  y: number;
}

// A caged good-produce friend. Size comes from the ally config; the power it grants comes from the
// ally kit (its name). Reach it to free it and bank that power.
export interface AllyPlacement {
  name: string;
  x: number;
  y: number;
}

export interface PickupPlacement {
  kind: 'health' | 'life';
  x: number;
  y: number;
}

// A respawn point with a trigger band. Crossing the band (forward only) arms its respawn.
export interface Checkpoint extends Aabb {
  respawn: { x: number; y: number };
}

// A place a boss may hop to: the lane it patrols after landing + the platform top it lands on.
// Landing column = the lane's center. Authored per arena on the BossPlacement (like patrol bounds).
// The boss relocates its whole lane by leaping here (a telegraphed `hop` attack) — mobility without
// ever chasing the player. Data rule (never cruel): every target.patrolLeft >= placement.patrolLeft
// (the "safe apron" — a player parked left of the home lane is never body-chased).
export interface HopTarget {
  patrolLeft: number;
  patrolRight: number;
  surfaceY: number; // the top (y) of the platform this lane rides — 372 for a ledge, 500 for ground
}

export interface BossPlacement {
  name: string;
  x: number;
  y: number;
  dir: 1 | -1; // initial pacing direction
  patrolLeft: number;
  patrolRight: number;
  hopTargets?: readonly HopTarget[]; // authored hop circuit (omitted = a grounded boss, today's behavior)
}

export interface TeamBossPlacement {
  name: string;
  members: readonly BossPlacement[];
  royale?: RoyaleRules; // present only on the Boss Royale ring (members enter from a bench)
}

// One Boss Royale corner: a home ground lane plus its outward hop ledge. A boss in this corner paces
// the lane and hops only between the lane and the ledge, so its body never reaches the center strip.
export interface RoyaleCorner {
  laneLeft: number;
  laneRight: number;
  floorY: number; // top of the ground the lane rides
  ledge: HopTarget; // the corner's outward perch
  facing: 1 | -1; // toward the center strip
}

export interface RoyaleRules {
  groups: readonly (readonly string[])[];
  corners: readonly [RoyaleCorner, RoyaleCorner]; // [west, east]
  centerStrip: { left: number; right: number }; // no living ring body ever overlaps this span
  capacity: number; // living ring bodies at once
  breatherFrames: number; // after a pop (or the opening) before the next entry
  entryFrames: number; // a second entrant joins a lone boss after this long
  graceFrames: number; // an entrant can neither hurt nor be hurt while dropping in
  quietFrames: number; // after a recovery ends before another windup may start
  dropHeight: number; // px above its lane an entrant spawns
  drops: { health: { x: number; y: number }; power: { x: number; y: number } };
}

// A visible break in the floor. `y` is the lip height; any static terrain at or below that
// lip is carved away inside the horizontal span. The immutable id keeps terrain audits and replay
// evidence readable without adding mutable simulation state.
export interface PitPlacement {
  id: string;
  x: number;
  y: number;
  w: number;
}

export interface LevelDef {
  id: string;
  titleId?: string; // STRINGS key for the HUD label (presentation only — not hashed)
  clearId?: string; // STRINGS key for the completion banner (presentation only — not hashed)
  width: number;
  height: number;
  weather?: 'rain'; // presentation identity; gameplay grip remains explicit slick-surface data
  spawn: { x: number; y: number };
  platforms: readonly Platform[];
  pits?: readonly PitPlacement[];
  movingPlatforms?: readonly MovingPlatformPlacement[];
  bouncePads?: readonly BouncePadPlacement[];
  switches?: readonly SwitchPlacement[];
  gates?: readonly GatePlacement[];
  slickSurfaces?: readonly SlickSurfacePlacement[];
  nutDroppers?: readonly NutDropperPlacement[];
  enemies: readonly EnemyPlacement[];
  collectibles: readonly CollectiblePlacement[];
  hazards: readonly HazardPlacement[];
  checkpoints: readonly Checkpoint[];
  boxes?: readonly PowerupPlacement[]; // wheat-stamped power-up boxes (omitted = none)
  allies?: readonly AllyPlacement[]; // caged produce friends to rescue (omitted = none)
  pickups?: readonly PickupPlacement[]; // restorative pickups — health / extra life (omitted = none)
  goal?: Aabb; // reach it to finish a normal level (omitted for a boss arena)
  boss?: BossPlacement; // defeat it to finish a single-target boss arena (omitted otherwise)
  teamBoss?: TeamBossPlacement; // defeat every shaker to finish a team-boss arena (omitted otherwise)
}

// A terrace block for a climb: a SOLID step whose top (`y`) is walkable and whose left/right faces are
// walls the player must hop over to advance. It extends from its top down to the world floor (y=540),
// so it reads as a raised shelf of earth, never a floating ledge — running into it stops you, and a
// jump carries you up onto it. Because every climb sits on the full-width ground floor, a missed hop
// just bonks the wall and you retry (never a pit, never cruel). Tops step up ≤72px (one clean hop) and
// x-ranges overlap, so the staircase has no gaps. This is the building block of the longer, vertical
// fields — see the field redesigns below.
function terrace(x: number, y: number, w: number): Platform {
  return { x, y, w, h: 540 - y };
}

// World 1-1: Cornfield Sunrise. A flat ground strip, four raised platforms to jump between,
// kernel mobs patrolling, good cobs to grab, a thresher guarding the high ledge, a mid-level
// checkpoint, and a barn door at the far right that ends the level. Two screens wide so the
// camera has somewhere to go.
export const WORLD_1_1: LevelDef = {
  id: '1-1',
  titleId: 'world1',
  clearId: 'world1Clear',
  width: 4500, // +25% (was 3600): a longer opening run before the barn door
  height: 540,
  spawn: { x: 80, y: 430 },
  // The gentle opener: a long FLAT ground run (the completion path) past kernel mobs and good cobs,
  // with floating platforms carrying optional prizes — including a thresher-guarded ledge and the
  // wheat power-up box. Every loot platform sits within one clean hop of the ground (top ≈ 410–418,
  // an ~85px rise — comfortably under a hero's jump) yet high enough to clear a standing player's head
  // (bottom ≤ 439), so a ground sprinter passes under them untouched while a hopper can claim the loot.
  // (The later fields add the real climbs; this one teaches the run.)
  platforms: [
    { x: 0, y: 500, w: 4500, h: 40 }, // ground — full width, flat to the door
    { x: 380, y: 415, w: 170, h: 24 },
    { x: 720, y: 415, w: 170, h: 24 }, // holds the wheat box + a cob
    { x: 1120, y: 418, w: 220, h: 24 },
    { x: 1560, y: 415, w: 180, h: 24 }, // ledge — thresher + prize cob (hop up for the risky prize)
    { x: 2120, y: 414, w: 200, h: 24 },
    { x: 2600, y: 412, w: 180, h: 24 },
    { x: 3060, y: 416, w: 200, h: 24 },
    // +25% tail: two more loot ledges (mirror the opener's reachable ~85px-rise floaters).
    { x: 3560, y: 414, w: 200, h: 24 },
    { x: 4020, y: 416, w: 200, h: 24 },
  ],
  // First safe gap: comfortably inside every kid's measured run-jump range, with broad flat banks.
  pits: [{ id: 'sunrise-hop-gap', x: 3300, y: 500, w: 96 }],
  enemies: [
    { name: 'kernelCreep', x: 600, y: 468, patrolLeft: 540, patrolRight: 720 }, // the ground mob on the path
    { name: 'kernelCreep', x: 1700, y: 468, patrolLeft: 1620, patrolRight: 1820 },
    { name: 'kernelCreep', x: 2750, y: 468, patrolLeft: 2680, patrolRight: 2900 },
    { name: 'kernelCreep', x: 3780, y: 468, patrolLeft: 3700, patrolRight: 3920 }, // tail mob (clear furrow)
  ],
  collectibles: [
    { name: 'goodCob', x: 300, y: 476 }, // ground, early
    { name: 'goodCob', x: 800, y: 391 }, // up on the x720 platform
    { name: 'goodCob', x: 1000, y: 476 }, // ground, mid
    { name: 'goodCob', x: 1700, y: 391 }, // on the thresher ledge, away from the blade — the risky prize
    { name: 'goodCob', x: 2000, y: 476 }, // ground
    { name: 'goodCob', x: 2900, y: 476 }, // ground, near the barn
    { name: 'goodCob', x: 3640, y: 390 }, // up on the first tail ledge
    { name: 'goodCob', x: 3900, y: 476 }, // ground, in the tail
    { name: 'goodCob', x: 4280, y: 476 }, // ground, near the barn
  ],
  hazards: [
    { name: 'thresher', x: 1580, y: 391 }, // on the ledge's left end — its spin is above the ground path (bottom 423 < a standing player's head at 448)
  ],
  checkpoints: [
    { x: 1800, y: 420, w: 60, h: 80, respawn: { x: 1900, y: 430 } }, // wide ground band; respawn nudged right, clear of the x1700 kernel's patrol span
    { x: 3500, y: 300, w: 60, h: 200, respawn: { x: 3500, y: 430 } }, // tail checkpoint (item 4): clear furrow between mobs [2680,2900] and [3700,3920]
  ],
  boxes: [
    { name: 'wheatBox', x: 780, y: 387 }, // resting on the x720 platform — a now-reachable jump-up reward, off the ground completion path
  ],
  allies: [
    { name: 'strawberry', x: 2050, y: 452 }, // after the safe opening — rescue her with half a field left to try BERRY RUSH
  ],
  pickups: [
    { kind: 'health', x: 2200, y: 386 }, // a fresh-pie heal on the x2120 platform — teaches the health pickup
  ],
  goal: { x: 4380, y: 340, w: 60, h: 160 }, // barn door at the far right
};

// World 1-2: the Squirrel Range. A ground run past two squirrels perched above the path, lobbing
// spiked corn down at you. Keep moving and the arcs land behind you (the lob aims where you WERE);
// a mid checkpoint and a barn door at the end. The level that activates the projectile substrate.
export const WORLD_1_RANGE: LevelDef = {
  id: '1-range',
  titleId: 'world1Range',
  clearId: 'world1Clear',
  width: 4500, // +25% (was 3600): two more perches in the longer lane
  height: 540,
  spawn: { x: 80, y: 430 },
  // The long horizontal gauntlet: a flat ground sprint past SEVEN squirrel perches lobbing spiked corn
  // down the lane. Keep moving and every arc lands where you WERE; the run is the dodge. The level
  // that stresses the projectile substrate across a full field, not a single screen.
  platforms: [
    { x: 0, y: 500, w: 4500, h: 40 }, // ground
    // Perches at one uniform height, generously spaced (>throwRange apart) so a steady run faces only
    // one lobber at a time and every arc lands behind — outrun the corn, don't stop under a perch.
    { x: 520, y: 392, w: 150, h: 24 }, // squirrel perch 1
    { x: 1160, y: 392, w: 150, h: 24 }, // perch 2
    { x: 1800, y: 392, w: 150, h: 24 }, // perch 3
    { x: 2440, y: 392, w: 150, h: 24 }, // perch 4
    { x: 3080, y: 392, w: 150, h: 24 }, // perch 5
    { x: 3720, y: 392, w: 150, h: 24 }, // perch 6 (tail)
    { x: 4300, y: 392, w: 150, h: 24 }, // perch 7 (tail)
  ],
  pits: [{ id: 'range-wagon-gap', x: 2700, y: 500, w: 190 }],
  movingPlatforms: [
    // A low, slow wagon crosses the wider ditch. Its 34px rise and generous overlap make waiting
    // readable while the nearby squirrel turns the learned jump into a light dodge test.
    { id: 'range-wagon-bridge', x: 2700, y: 466, w: 160, h: 24, axis: 'x', travel: 50, periodFrames: 180, phaseFrames: 45 },
  ],
  enemies: [
    { name: 'squirrel', x: 560, y: 358, patrolLeft: 520, patrolRight: 670 },
    { name: 'squirrel', x: 1200, y: 358, patrolLeft: 1160, patrolRight: 1310 },
    { name: 'squirrel', x: 1840, y: 358, patrolLeft: 1800, patrolRight: 1950 },
    { name: 'squirrel', x: 2480, y: 358, patrolLeft: 2440, patrolRight: 2590 },
    { name: 'squirrel', x: 3120, y: 358, patrolLeft: 3080, patrolRight: 3230 },
    { name: 'squirrel', x: 3760, y: 358, patrolLeft: 3720, patrolRight: 3870 },
    { name: 'squirrel', x: 4340, y: 358, patrolLeft: 4300, patrolRight: 4450 },
  ],
  collectibles: [
    { name: 'goodCob', x: 360, y: 476 },
    { name: 'goodCob', x: 1400, y: 476 },
    { name: 'goodCob', x: 2500, y: 476 },
    { name: 'goodCob', x: 3500, y: 476 }, // tail
  ],
  hazards: [],
  checkpoints: [
    { x: 1800, y: 420, w: 60, h: 80, respawn: { x: 1800, y: 430 } },
    { x: 3500, y: 300, w: 60, h: 200, respawn: { x: 3500, y: 430 } }, // tail checkpoint (item 4): clear ground between the x3120 + x3760 perches
  ],
  // A ground pie between perches 3 and 4: seven lobbers and no heal cost cautious kids two lives.
  pickups: [{ kind: 'health', x: 2300, y: 472 }],
  goal: { x: 4400, y: 340, w: 60, h: 160 }, // barn door at the far right
};

// World 1 boss arena: King Corn. A single-screen flat arena with two low ledges to leap from.
// No door — the level is won by popping the boss (run.ts: a defeated boss completes the level).
export const WORLD_1_BOSS: LevelDef = {
  id: '1-boss',
  titleId: 'world1Boss',
  clearId: 'bossDown',
  width: 1400,
  height: 540,
  spawn: { x: 80, y: 430 },
  platforms: [
    { x: 0, y: 500, w: 1400, h: 40 }, // ground
    { x: 170, y: 400, w: 140, h: 24 },
    { x: 130, y: 190, w: 190, h: 24 }, // high perch — moved up-LEFT, out of the boss hop flight path (unreachable scenery)
    { x: 620, y: 372, w: 130, h: 24 }, // boss hop tier A (right of the clear home lane)
    { x: 1000, y: 372, w: 130, h: 24 }, // boss hop tier B (spread wide for a clean down-hop)
  ],
  enemies: [],
  collectibles: [],
  hazards: [],
  checkpoints: [],
  boss: {
    name: 'kingCorn',
    x: 500,
    y: 412,
    dir: -1,
    patrolLeft: 440,
    patrolRight: 600,
    hopTargets: [
      { patrolLeft: 620, patrolRight: 750, surfaceY: 372 }, // ledge A
      { patrolLeft: 780, patrolRight: 980, surfaceY: 500 }, // mid ground (clear gap A↔B)
      { patrolLeft: 1000, patrolRight: 1130, surfaceY: 372 }, // ledge B
      { patrolLeft: 780, patrolRight: 980, surfaceY: 500 }, // mid ground
    ],
  },
};

// Butter Stick — the field-1 boss (the warm-up). A flat room with two leap ledges, like King Corn's.
export const BUTTER_STICK_ARENA: LevelDef = {
  id: 'butter-stick-arena',
  titleId: 'bossButter',
  clearId: 'butterDown',
  width: 1400,
  height: 540,
  spawn: { x: 80, y: 430 },
  platforms: [
    { x: 0, y: 500, w: 1400, h: 40 },
    { x: 360, y: 372, w: 130, h: 24 },
    { x: 620, y: 372, w: 130, h: 24 },
    { x: 390, y: 240, w: 220, h: 24 }, // high perch
  ],
  enemies: [],
  collectibles: [],
  hazards: [],
  checkpoints: [],
  boss: { name: 'butterStick', x: 460, y: 420, dir: -1, patrolLeft: 360, patrolRight: 640 },
};

// Salt & Pepper — the field-2 TEAM boss. A wider room so the two shakers pace separate lanes; clear
// it only by popping BOTH. Salt (left, sturdier) and Pepper (right, nimbler) never share a corner.
export const SALT_PEPPER_ARENA: LevelDef = {
  id: 'salt-pepper-arena',
  titleId: 'bossSalt',
  clearId: 'saltDown',
  width: 1500,
  height: 540,
  spawn: { x: 80, y: 430 },
  platforms: [
    { x: 0, y: 500, w: 1500, h: 40 },
    { x: 120, y: 400, w: 130, h: 24 },
    { x: 300, y: 384, w: 130, h: 24 },
    { x: 850, y: 384, w: 140, h: 24 },
    { x: 480, y: 250, w: 200, h: 24 }, // high perch between the two shakers' lanes (clear of Pepper's flight)
  ],
  enemies: [],
  collectibles: [],
  hazards: [],
  checkpoints: [],
  teamBoss: {
    name: 'saltAndPepper',
    members: [
      // Tight, separate lanes: each shaker paces a small readable zone, so a player parked just
      // outside a lane can pulse-swing it without the body ever reaching them (never cruel). Salt stays
      // GROUNDED (the sturdy lunger's identity); Pepper takes its own ledge via a telegraphed hop.
      { name: 'salt', x: 380, y: 408, dir: 1, patrolLeft: 330, patrolRight: 470 },
      {
        name: 'pepper',
        x: 760,
        y: 420,
        dir: -1,
        patrolLeft: 690,
        patrolRight: 830,
        hopTargets: [
          { patrolLeft: 850, patrolRight: 990, surfaceY: 384 },
          { patrolLeft: 690, patrolRight: 830, surfaceY: 500 },
        ],
      },
    ],
  },
};

// General Acorn — the field-3 boss (the busy fight): a quicker pacer in a slightly longer room.
export const GENERAL_ACORN_ARENA: LevelDef = {
  id: 'general-acorn-arena',
  titleId: 'bossAcorn',
  clearId: 'acornDown',
  width: 1440,
  height: 540,
  spawn: { x: 80, y: 430 },
  platforms: [
    { x: 0, y: 500, w: 1440, h: 40 },
    { x: 160, y: 400, w: 140, h: 24 },
    { x: 130, y: 190, w: 190, h: 24 }, // high perch — moved up-left, out of the boss hop flight path
    { x: 620, y: 372, w: 130, h: 24 }, // boss hop tier A (right of the clear home lane)
    { x: 1000, y: 372, w: 130, h: 24 }, // boss hop tier B (spread wide for a clean down-hop)
  ],
  enemies: [],
  collectibles: [],
  hazards: [],
  checkpoints: [],
  boss: {
    name: 'generalAcorn',
    x: 500,
    y: 416,
    dir: -1,
    patrolLeft: 440,
    patrolRight: 600,
    // Home is a CLEAR-LEFT ground lane (no ledge above it), so the boss's up-hops never bonk. It bounds
    // right onto ledge A → mid ground → ledge B → mid ground, roaming the arena. Safe apron: every lane ≥ 360.
    hopTargets: [
      { patrolLeft: 620, patrolRight: 750, surfaceY: 372 }, // ledge A
      { patrolLeft: 780, patrolRight: 980, surfaceY: 500 }, // mid ground (clear gap A↔B)
      { patrolLeft: 1000, patrolRight: 1130, surfaceY: 372 }, // ledge B
      { patrolLeft: 780, patrolRight: 980, surfaceY: 500 }, // mid ground
    ],
  },
};

// Sir Pickle — the field-4 boss (the patient fight): the tall, slow thruster before the climax.
export const SIR_PICKLE_ARENA: LevelDef = {
  id: 'sir-pickle-arena',
  titleId: 'bossPickle',
  clearId: 'pickleDown',
  width: 1400,
  height: 540,
  spawn: { x: 80, y: 430 },
  platforms: [
    { x: 0, y: 500, w: 1400, h: 40 },
    { x: 160, y: 400, w: 140, h: 24 },
    { x: 130, y: 160, w: 190, h: 24 }, // high perch — moved up-left, out of the boss hop flight path (Pickle is tall)
    { x: 620, y: 372, w: 130, h: 24 }, // boss hop tier A (right of the clear home lane)
    { x: 1000, y: 372, w: 130, h: 24 }, // boss hop tier B (spread wide for a clean down-hop)
  ],
  enemies: [],
  collectibles: [],
  hazards: [],
  checkpoints: [],
  boss: {
    name: 'sirPickle',
    x: 500,
    y: 400,
    dir: -1,
    patrolLeft: 440,
    patrolRight: 600,
    // Home is a CLEAR-LEFT ground lane (no ledge above it), so the boss's up-hops never bonk. It bounds
    // right onto ledge A → mid ground → ledge B → mid ground, roaming the arena. Safe apron: every lane ≥ 360.
    hopTargets: [
      { patrolLeft: 620, patrolRight: 750, surfaceY: 372 }, // ledge A
      { patrolLeft: 780, patrolRight: 980, surfaceY: 500 }, // mid ground (clear gap A↔B)
      { patrolLeft: 1000, patrolRight: 1130, surfaceY: 372 }, // ledge B
      { patrolLeft: 780, patrolRight: 980, surfaceY: 500 }, // mid ground
    ],
  },
};

const ROYALE_WEST_LANE = { left: 200, right: 360 };
const ROYALE_EAST_LANE = { left: 720, right: 880 };
const ROYALE_NAMES = ['butterStick', 'salt', 'pepper', 'generalAcorn', 'sirPickle', 'kingCorn'] as const;

export const BOSS_ROYALE_ARENA: LevelDef = {
  id: 'boss-royale',
  titleId: 'bossRoyale',
  clearId: 'royaleDown',
  width: 1080,
  height: 540,
  spawn: { x: 522, y: 430 },
  platforms: [
    { x: 0, y: 500, w: 1080, h: 40 }, // ground
    { x: 40, y: 384, w: 130, h: 24 }, // west hop ledge (outward of the west lane)
    { x: 910, y: 384, w: 130, h: 24 }, // east hop ledge (outward of the east lane)
    { x: 480, y: 400, w: 120, h: 24 }, // low player tier in the center strip (rise 100 ≤ every kid's jump)
  ],
  enemies: [],
  collectibles: [],
  hazards: [],
  checkpoints: [],
  teamBoss: {
    name: 'bossRoyale',
    // Six permanent member indices in ladder order. Placements are bench parking above the west lane;
    // an entrant is re-placed into its corner when it drops in (boss/royale.ts).
    members: ROYALE_NAMES.map((name) => ({
      name,
      x: ROYALE_WEST_LANE.left,
      y: -400,
      dir: 1 as const,
      patrolLeft: ROYALE_WEST_LANE.left,
      patrolRight: ROYALE_WEST_LANE.right,
    })),
    royale: {
      groups: [['butterStick'], ['salt', 'pepper'], ['generalAcorn'], ['sirPickle'], ['kingCorn']],
      corners: [
        { laneLeft: ROYALE_WEST_LANE.left, laneRight: ROYALE_WEST_LANE.right, floorY: 500, ledge: { patrolLeft: 40, patrolRight: 170, surfaceY: 384 }, facing: 1 },
        { laneLeft: ROYALE_EAST_LANE.left, laneRight: ROYALE_EAST_LANE.right, floorY: 500, ledge: { patrolLeft: 910, patrolRight: 1040, surfaceY: 384 }, facing: -1 },
      ],
      centerStrip: { left: ROYALE_WEST_LANE.right, right: ROYALE_EAST_LANE.left },
      capacity: 2,
      breatherFrames: 90,
      entryFrames: 2400,
      graceFrames: 90,
      quietFrames: 36,
      dropHeight: 400,
      drops: { health: { x: 430, y: 472 }, power: { x: 622, y: 472 } },
    },
  },
};

// World 2 — Root Rows: a washboard of raised earth BEDS leads to the carrot rescue, then a payoff
// stretch where LONG REACH helps control the remaining furrows.
// You hop up onto each bed, cross it, and drop into the furrow between — a rolling up-and-down rhythm
// (the first field that breaks the dead-flat ground) with kernels in the furrows and patrolling a
// bed. Pure hold-right stalls at the first bed wall; you hop to advance.
export const FIELD_CARROT: LevelDef = {
  id: '2-1',
  titleId: 'fieldCarrot',
  clearId: 'world1Clear',
  width: 4750, // +25% (was 3800): two more beds + a furrow in the longer washboard
  height: 540,
  spawn: { x: 80, y: 430 },
  platforms: [
    { x: 0, y: 500, w: 4750, h: 40 }, // ground floor beneath beds; authored pits carve select furrows
    terrace(520, 440, 300), // bed 1 (60 up)
    terrace(1020, 432, 300), // bed 2 (68 up)
    terrace(1560, 444, 300), // bed 3 (56 up)
    terrace(2100, 432, 320), // bed 4
    terrace(2680, 440, 320), // bed 5
    terrace(3240, 436, 300), // bed 6
    terrace(3620, 438, 300), // bed 7 (tail)
    terrace(4080, 440, 300), // bed 8, last row before the door
  ],
  // The trench sits a run-up past bed 5's drop (was x3020, 20 px past it: walking off the bed fell in).
  // x3104 also keeps the shared climb route deathless for every kid (rollup character coverage).
  pits: [{ id: 'root-row-trench', x: 3104, y: 500, w: 104 }],
  switches: [{ id: 'root-row-lever', x: 1496, y: 444, w: 28, h: 44, accepts: 'swing' }],
  gates: [{ id: 'root-row-gate', switchId: 'root-row-lever', x: 1512, y: 372, w: 32, h: 128 }],
  enemies: [
    { name: 'kernelCreep', x: 880, y: 468, patrolLeft: 840, patrolRight: 1000 }, // in a furrow
    { name: 'kernelCreep', x: 1900, y: 468, patrolLeft: 1860, patrolRight: 2080 }, // in a furrow
    { name: 'kernelCreep', x: 2280, y: 400, patrolLeft: 2120, patrolRight: 2400 }, // patrolling bed 4 (feet on its top)
    { name: 'kernelCreep', x: 3970, y: 468, patrolLeft: 3950, patrolRight: 4050 }, // tail furrow (beds 7|8)
  ],
  collectibles: [
    { name: 'goodCob', x: 640, y: 416 }, // on a bed
    { name: 'goodCob', x: 1400, y: 476 }, // in a furrow
    { name: 'goodCob', x: 2800, y: 416 }, // on a bed
    { name: 'goodCob', x: 3740, y: 414 }, // on tail bed 7
    { name: 'goodCob', x: 4500, y: 476 }, // furrow near the door
  ],
  hazards: [],
  // In a clear furrow (away from every kernel's patrol span) with a tall band, so a hopping player
  // arms it AND a post-death respawn never drops onto a mob.
  checkpoints: [
    { x: 1420, y: 300, w: 60, h: 200, respawn: { x: 1420, y: 430 } },
    { x: 3560, y: 300, w: 60, h: 200, respawn: { x: 3560, y: 430 } }, // tail checkpoint (item 4): clear furrow (beds 6|7), left of the x3970 kernel
  ],
  allies: [{ name: 'carrot', x: 2500, y: 452 }], // clear mid-field furrow — earn LONG REACH before the last four beds
  pickups: [{ kind: 'health', x: 2200, y: 404 }], // a heal up on bed 4
  goal: { x: 4630, y: 340, w: 60, h: 160 },
};

// World 3 — Bramble Patch: THE BIG CLIMB. A terraced hillside teaches the vertical rhythm before
// the blueberry rescue; BLUE BOUNCE then opens a more expressive route through the second rise.
// Pure hold-right stalls at the first shelf — you have to jump up to advance.
export const FIELD_BERRY: LevelDef = {
  id: '3-1',
  titleId: 'fieldBerry',
  clearId: 'world1Clear',
  width: 5000, // +25% (was 4000): a second pair of rises after the big climb
  height: 540,
  spawn: { x: 80, y: 430 },
  platforms: [
    { x: 0, y: 500, w: 5000, h: 40 }, // ground floor beneath the climb; authored gaps carve challenge beats
    // The climb: three shelves stepping up ~68px each (jump up 3 levels), x-ranges overlapping.
    terrace(640, 432, 380), // shelf 1
    terrace(1000, 364, 380), // shelf 2
    terrace(1340, 296, 760), // shelf 3 + the high bramble traverse (long top to walk)
    // A second, smaller rise late in the field for rhythm, then the ground run to the door.
    terrace(2680, 432, 320),
    // +25% tail: two more brambly beds before the longer run to the door.
    terrace(3500, 436, 320),
    terrace(4060, 438, 320),
  ],
  pits: [{ id: 'bramble-lift-gap', x: 2910, y: 432, w: 160 }],
  bouncePads: [
    { id: 'blueberry-practice-pad', x: 2580, y: 484, w: 84, h: 16, launchV: 15 },
    { id: 'bramble-tail-pad', x: 3380, y: 484, w: 76, h: 16, launchV: 14 },
  ],
  movingPlatforms: [
    { id: 'bramble-tree-lift', x: 2920, y: 350, w: 150, h: 24, axis: 'y', travel: 82, periodFrames: 180 },
  ],
  nutDroppers: [
    { id: 'bramble-oak-a', x: 1180, y: 72, periodFrames: 168, phaseFrames: 28 },
    { id: 'bramble-oak-b', x: 3260, y: 64, periodFrames: 156, phaseFrames: 78 },
  ],
  enemies: [
    { name: 'kernelCreep', x: 420, y: 468, patrolLeft: 360, patrolRight: 600 }, // ground, before the climb
    { name: 'kernelCreep', x: 1560, y: 264, patrolLeft: 1380, patrolRight: 1760 }, // patrolling the high traverse
    { name: 'kernelCreep', x: 3180, y: 468, patrolLeft: 3080, patrolRight: 3360 }, // ground, mid
    { name: 'kernelCreep', x: 3900, y: 468, patrolLeft: 3870, patrolRight: 3990 }, // tail furrow (beds)
    { name: 'kernelCreep', x: 2200, y: 468, patrolLeft: 2120, patrolRight: 2320 },
  ],
  collectibles: [
    { name: 'goodCob', x: 820, y: 408 }, // on shelf 1
    { name: 'goodCob', x: 1700, y: 272 }, // up on the high traverse — the climb's reward
    { name: 'goodCob', x: 3380, y: 476 }, // landing reward after the lift gap, clear of the kernel patrol
    { name: 'goodCob', x: 3620, y: 412 }, // on a tail bed
    { name: 'goodCob', x: 4600, y: 476 }, // ground near the door
  ],
  hazards: [],
  // On the flat run after the drop, with a tall band so a hopping player always crosses it.
  checkpoints: [
    { x: 2360, y: 300, w: 60, h: 200, respawn: { x: 2360, y: 430 } },
    { x: 3420, y: 300, w: 60, h: 200, respawn: { x: 3420, y: 430 } }, // tail checkpoint (item 4): clear furrow, right of the x3180 kernel [3080,3360]
  ],
  allies: [{ name: 'blueberry', x: 2480, y: 452 }], // after the main climb — BLUE BOUNCE opens the expressive tail route
  pickups: [{ kind: 'life', x: 1700, y: 268 }], // an extra life up on the high bramble traverse — the climb's big reward
  goal: { x: 4880, y: 340, w: 60, h: 160 },
};

// World 4 — Leaf Beds: a two-shelf introduction leads to the lettuce rescue, then a hazard field
// where LEAF GUARD supports one planned risk. Threshers sit on raised ledges ABOVE the path — leap the beds
// while the blades spin overhead and out of reach (the high ledges hold the risky prize cobs). The
// climb is mandatory; the threshers are off the leap line, so a clean run never meets a blade.
export const FIELD_LETTUCE: LevelDef = {
  id: '4-1',
  titleId: 'fieldLettuce',
  clearId: 'world1Clear',
  width: 4750, // +25% (was 3800): two more beds + one more overhead blade-ledge in the tail
  height: 540,
  weather: 'rain',
  spawn: { x: 80, y: 430 },
  platforms: [
    { x: 0, y: 500, w: 4750, h: 40 }, // ground floor beneath terraces; gaps are explicit below
    terrace(640, 432, 360), // climb shelf 1
    terrace(1000, 364, 520), // shelf 2 + the high leaf terrace (walk it, then drop off the right)
    terrace(2360, 440, 320), // a late bed
    terrace(2900, 440, 320), // another
    terrace(3600, 438, 320), // tail bed 1 (clear of the x3380 ground mob's span)
    terrace(4080, 440, 300), // tail bed 2, last row before the door
    { x: 1700, y: 320, w: 200, h: 24 }, // high floating ledge — thresher + prize (off the leap path)
    { x: 2500, y: 332, w: 200, h: 24 }, // another high ledge with a thresher
    { x: 3760, y: 324, w: 200, h: 24 }, // tail high ledge — overhead thresher (off the leap path)
  ],
  pits: [{ id: 'leaf-bed-rain-gap', x: 2680, y: 500, w: 80 }],
  slickSurfaces: [
    { id: 'pickle-rain-board-a', x: 1520, y: 500, w: 540, h: 16, grip: 0.3 },
    { id: 'pickle-rain-board-b', x: 3220, y: 500, w: 360, h: 16, grip: 0.34 },
  ],
  enemies: [
    { name: 'kernelCreep', x: 420, y: 468, patrolLeft: 360, patrolRight: 600 },
    { name: 'kernelCreep', x: 3380, y: 468, patrolLeft: 3300, patrolRight: 3520 },
    { name: 'kernelCreep', x: 3970, y: 468, patrolLeft: 3950, patrolRight: 4050 }, // tail furrow (beds)
    { name: 'kernelCreep', x: 1800, y: 468, patrolLeft: 1700, patrolRight: 1980 },
  ],
  collectibles: [
    { name: 'goodCob', x: 1200, y: 340 }, // up on the high leaf terrace (reached via the two-shelf climb)
    { name: 'goodCob', x: 2500, y: 416 }, // on a late bed — the prize, moved off the unreachable high blade-ledge
    { name: 'goodCob', x: 3500, y: 476 },
    { name: 'goodCob', x: 3720, y: 414 }, // on tail bed 1
    { name: 'goodCob', x: 4500, y: 476 }, // furrow near the door
  ],
  hazards: [
    // The threshers stay up on their high floating ledges — overhead hazards above the leap line (like
    // the squirrel perches), so a clean run never meets a blade. The ledges are not player platforms.
    { name: 'thresher', x: 1760, y: 296 }, // high ledge, well above the leap line
    { name: 'thresher', x: 2560, y: 308 }, // high ledge
    { name: 'thresher', x: 3820, y: 300 }, // tail high ledge
  ],
  checkpoints: [
    { x: 2080, y: 420, w: 60, h: 80, respawn: { x: 2080, y: 430 } },
    { x: 3550, y: 300, w: 60, h: 200, respawn: { x: 3550, y: 430 } }, // tail checkpoint (item 4): clear furrow, right of the x3380 kernel [3300,3520]
  ],
  allies: [{ name: 'lettuce', x: 2200, y: 452 }], // safe post-climb furrow — LEAF GUARD arrives before the blade beds
  pickups: [{ kind: 'health', x: 2780, y: 472 }],
  goal: { x: 4630, y: 340, w: 60, h: 160 },
};

// World 5 — Orchard Bend: the longest, most varied field — every motif at once. Climb two shelves
// onto a high orchard branch (a kernel patrols it), rescue Banana after the drop, then use PEEL TOSS,
// cross a run of raised beds and furrows, then a last rise to the barn. The full bend before King Corn.
export const FIELD_BANANA: LevelDef = {
  id: '5-1',
  titleId: 'fieldBanana',
  clearId: 'world1Clear',
  width: 5250, // +25% (was 4200): two more orchard beds before the door
  height: 540,
  spawn: { x: 80, y: 430 },
  platforms: [
    { x: 0, y: 500, w: 5250, h: 40 }, // ground floor beneath orchard beds; machinery gaps carve through it
    terrace(640, 432, 360), // climb shelf 1
    terrace(1000, 360, 760), // shelf 2 + the high branch traverse
    terrace(2300, 440, 300), // beds after the drop
    terrace(2820, 452, 300), // lower first machinery bed: Theo's short hop keeps the base route valid
    terrace(3340, 440, 320), // last rise (mid)
    terrace(3900, 436, 320), // tail bed 1
    terrace(4460, 438, 320), // tail bed 2, last rise toward the door
    { x: 2640, y: 360, w: 150, h: 24 }, // squirrel battery perch above the clear furrow
  ],
  pits: [{ id: 'royal-lift-gap-a', x: 3010, y: 452, w: 180 }],
  // The plate overlaps the gate by 12px (like the World 2 levers) so a swing thrown flush at the gate opens it.
  switches: [{ id: 'crown-ricochet-a', x: 2212, y: 438, w: 60, h: 46, accepts: 'either' }],
  gates: [{ id: 'crown-machine-gate-a', switchId: 'crown-ricochet-a', x: 2260, y: 366, w: 32, h: 134 }],
  movingPlatforms: [
    { id: 'royal-orchard-lift-a', x: 3020, y: 390, w: 150, h: 24, axis: 'y', travel: 42, periodFrames: 192, phaseFrames: 32 },
  ],
  enemies: [
    { name: 'kernelCreep', x: 420, y: 468, patrolLeft: 360, patrolRight: 600 },
    { name: 'kernelCreep', x: 1400, y: 328, patrolLeft: 1220, patrolRight: 1700 }, // patrolling the high branch
    { name: 'kernelCreep', x: 2680, y: 468, patrolLeft: 2640, patrolRight: 2780 },
    { name: 'kernelCreep', x: 4310, y: 468, patrolLeft: 4290, patrolRight: 4390 }, // tail furrow (beds)
    { name: 'kernelCreep', x: 3760, y: 468, patrolLeft: 3680, patrolRight: 3860 },
    { name: 'squirrel', x: 2680, y: 326, patrolLeft: 2640, patrolRight: 2790, batterySwitchId: 'crown-ricochet-a' },
  ],
  collectibles: [
    { name: 'goodCob', x: 1380, y: 336 }, // up on the branch
    { name: 'goodCob', x: 2000, y: 476 },
    { name: 'goodCob', x: 3500, y: 416 },
    { name: 'goodCob', x: 4020, y: 412 }, // on tail bed 1
    { name: 'goodCob', x: 4950, y: 476 }, // ground near the door
  ],
  hazards: [],
  checkpoints: [
    { x: 2080, y: 420, w: 60, h: 80, respawn: { x: 2080, y: 430 } },
    // Tail checkpoint (item 4): no clear furrow in range (the x3760 kernel sits in it), so it rides bed
    // terrace(3340,440,320); the respawn is grounded on the bed top (y 370 → feet 422, an 18px drop onto 440).
    { x: 3450, y: 300, w: 60, h: 200, respawn: { x: 3450, y: 370 } },
  ],
  allies: [{ name: 'banana', x: 2150, y: 452 }], // after the branch — PEEL TOSS controls the enemy-heavy orchard tail
  pickups: [{ kind: 'health', x: 2920, y: 424 }], // grounded on the lowered short-hop machinery bed
  goal: { x: 5130, y: 340, w: 60, h: 160 },
};

// Endgame: King Corn grabs the rescued crew, bolts through a second confrontation, then re-cages
// every friend in the last furrow before the final un-cobbing.

export const CREW_GRAB_ARENA: LevelDef = {
  id: 'end-grab',
  titleId: 'crewGrab',
  clearId: 'kingEscapes',
  width: 1900,
  height: 540,
  spawn: { x: 80, y: 430 },
  platforms: [
    { x: 0, y: 500, w: 1900, h: 40 },
    { x: 260, y: 402, w: 180, h: 24 },
    { x: 760, y: 370, w: 160, h: 24 },
    { x: 1260, y: 402, w: 180, h: 24 },
    { x: 1610, y: 350, w: 180, h: 24 },
  ],
  enemies: [],
  collectibles: [],
  hazards: [],
  checkpoints: [],
  boss: {
    name: 'kingCorn',
    x: 720,
    y: 412,
    dir: -1,
    patrolLeft: 520,
    patrolRight: 900,
    hopTargets: [
      { patrolLeft: 1080, patrolRight: 1240, surfaceY: 500 },
      { patrolLeft: 1260, patrolRight: 1440, surfaceY: 402 },
      { patrolLeft: 1500, patrolRight: 1700, surfaceY: 500 },
      { patrolLeft: 760, patrolRight: 920, surfaceY: 370 },
    ],
  },
};

// Endgame 1 — The Last Furrow: a final gauntlet field (kernels + a climb), no ally, to a door.
export const THE_LAST_FURROW: LevelDef = {
  id: 'end-furrow',
  titleId: 'endFurrow',
  clearId: 'world1Clear',
  width: 4750, // +25% (was 3800): two more beds before the door
  height: 540,
  spawn: { x: 80, y: 430 },
  // The final gauntlet field — no rescue here, just the run. Ground kernels, a two-shelf climb onto a
  // ridge (a kernel patrols it), a drop back down, beds and furrows, and the last stretch to the door.
  platforms: [
    { x: 0, y: 500, w: 4750, h: 40 }, // ground floor beneath the gauntlet; the bridge gap is carved below
    terrace(820, 432, 360), // climb shelf 1
    terrace(1180, 364, 560), // shelf 2 + the ridge traverse
    terrace(2360, 440, 300), // beds after the drop
    terrace(2880, 436, 320),
    terrace(3500, 438, 320), // tail bed 1
    terrace(4080, 440, 300), // tail bed 2, last row before the door
  ],
  pits: [{ id: 'last-furrow-bridge-gap', x: 2020, y: 500, w: 200 }],
  movingPlatforms: [
    { id: 'last-furrow-bridge', x: 2030, y: 456, w: 120, h: 24, axis: 'x', travel: 70, periodFrames: 168, phaseFrames: 28 },
  ],
  enemies: [
    { name: 'kernelCreep', x: 420, y: 468, patrolLeft: 360, patrolRight: 620 },
    { name: 'kernelCreep', x: 1460, y: 332, patrolLeft: 1220, patrolRight: 1720 }, // patrolling the ridge
    { name: 'kernelCreep', x: 2740, y: 468, patrolLeft: 2700, patrolRight: 2840 },
    { name: 'kernelCreep', x: 3960, y: 468, patrolLeft: 3940, patrolRight: 4040 }, // tail furrow (beds)
    { name: 'kernelCreep', x: 2460, y: 408, patrolLeft: 2420, patrolRight: 2600 }, // bed-top twist after the moving bridge, never on its landing bank
  ],
  collectibles: [
    { name: 'goodCob', x: 360, y: 476 },
    { name: 'goodCob', x: 1440, y: 340 }, // up on the ridge
    { name: 'goodCob', x: 3200, y: 476 },
    { name: 'goodCob', x: 3620, y: 414 }, // on tail bed 1
    { name: 'goodCob', x: 4500, y: 476 }, // furrow near the door
  ],
  hazards: [],
  checkpoints: [
    { x: 1940, y: 300, w: 60, h: 200, respawn: { x: 1940, y: 430 } }, // bank progress immediately before the moving bridge
    { x: 3850, y: 300, w: 60, h: 200, respawn: { x: 3850, y: 430 } }, // tail checkpoint (item 4): clear furrow (beds), left of the x3960 kernel
  ],
  allies: [
    { name: 'strawberry', x: 690, y: 452 },
    { name: 'carrot', x: 1900, y: 452 },
    { name: 'blueberry', x: 2800, y: 452 },
    { name: 'lettuce', x: 3400, y: 452 },
    { name: 'banana', x: 4380, y: 452 },
  ],
  pickups: [{ kind: 'health', x: 2460, y: 412 }], // a heal up on a late bed before the climax
  goal: { x: 4630, y: 340, w: 60, h: 160 },
};

// Endgame 3 — Un-Cob the King: the climactic final fight in a tight arena.
export const FINAL_UNCOB: LevelDef = {
  id: 'end-final',
  titleId: 'endFinal',
  clearId: 'cornGood',
  width: 1600,
  height: 540,
  spawn: { x: 80, y: 430 },
  platforms: [
    { x: 0, y: 500, w: 1600, h: 40 },
    { x: 150, y: 400, w: 140, h: 24 },
    { x: 130, y: 190, w: 200, h: 24 }, // high perch — moved up-left, out of the boss hop flight path
    { x: 620, y: 372, w: 130, h: 24 }, // A boss ledge
    { x: 1000, y: 372, w: 130, h: 24 }, // B boss ledge
    { x: 1400, y: 372, w: 130, h: 24 },
  ],
  enemies: [],
  collectibles: [],
  hazards: [],
  checkpoints: [],
  boss: {
    name: 'kingCorn',
    x: 500,
    y: 412,
    dir: -1,
    patrolLeft: 440,
    patrolRight: 600,
    hopTargets: [
      { patrolLeft: 620, patrolRight: 750, surfaceY: 372 }, // A ledge
      { patrolLeft: 780, patrolRight: 980, surfaceY: 500 }, // mid1 ground (clear gap A↔B)
      { patrolLeft: 1000, patrolRight: 1130, surfaceY: 372 }, // B ledge
      { patrolLeft: 1180, patrolRight: 1380, surfaceY: 500 }, // mid2 ground (clear gap B↔C)
      { patrolLeft: 1400, patrolRight: 1530, surfaceY: 372 }, // C ledge (new right-field)
      { patrolLeft: 1180, patrolRight: 1380, surfaceY: 500 }, // mid2 ground
      { patrolLeft: 1000, patrolRight: 1130, surfaceY: 372 }, // B ledge
      { patrolLeft: 780, patrolRight: 980, surfaceY: 500 }, // mid1 ground
    ],
  },
};

// World 2 field B — Deep Furrows: the washboard taken further. More beds + furrows, a bed-top
// patroller, a heal on a mid bed. No rescue (the carrot was freed in 2-1).
export const FIELD_CARROT_2: LevelDef = {
  id: '2-2',
  titleId: 'fieldCarrot2',
  clearId: 'world1Clear',
  width: 4750,
  height: 540,
  spawn: { x: 80, y: 430 },
  platforms: [
    { x: 0, y: 500, w: 4750, h: 40 }, // ground floor beneath the deeper furrows
    terrace(540, 442, 260), // bed 1 (a flat run-up first, so even a non-hopping persona makes real progress)
    terrace(960, 434, 320), // bed 2
    terrace(1480, 440, 320), // bed 3
    terrace(2000, 432, 340), // bed 4
    terrace(2560, 440, 340), // bed 5
    terrace(3120, 436, 320), // bed 6
    terrace(3640, 440, 320), // bed 7
    terrace(4160, 438, 320), // bed 8, last row before the door
  ],
  pits: [{ id: 'deep-furrow-cart-gap', x: 2900, y: 500, w: 220 }],
  movingPlatforms: [
    { id: 'deep-furrow-cart', x: 2910, y: 456, w: 120, h: 24, axis: 'x', travel: 90, periodFrames: 180, phaseFrames: 60 },
  ],
  switches: [{ id: 'deep-root-lever', x: 1416, y: 444, w: 28, h: 44, accepts: 'swing' }],
  gates: [{ id: 'deep-root-gate', switchId: 'deep-root-lever', x: 1432, y: 372, w: 32, h: 128 }],
  enemies: [
    { name: 'kernelCreep', x: 860, y: 468, patrolLeft: 830, patrolRight: 930 }, // furrow (beds 1|2)
    { name: 'kernelCreep', x: 1900, y: 468, patrolLeft: 1830, patrolRight: 1970 }, // furrow (beds 3|4)
    { name: 'kernelCreep', x: 2280, y: 400, patrolLeft: 2030, patrolRight: 2310 }, // patrolling bed 4 (feet on top)
    { name: 'kernelCreep', x: 4040, y: 468, patrolLeft: 3990, patrolRight: 4130 }, // furrow (beds 7|8)
  ],
  collectibles: [
    { name: 'goodCob', x: 320, y: 476 }, // ground, early
    { name: 'goodCob', x: 640, y: 418 }, // on bed 1
    { name: 'goodCob', x: 1640, y: 416 }, // on bed 3
    { name: 'goodCob', x: 3300, y: 412 }, // on bed 6
    { name: 'goodCob', x: 4600, y: 476 }, // furrow near the door
  ],
  hazards: [],
  checkpoints: [
    { x: 1340, y: 300, w: 60, h: 200, respawn: { x: 1340, y: 430 } }, // clear furrow (beds 2|3)
    { x: 3520, y: 300, w: 60, h: 200, respawn: { x: 3520, y: 430 } }, // tail checkpoint (item 4): clear furrow (beds 6|7), left of the x4040 kernel
  ],
  pickups: [{ kind: 'health', x: 2700, y: 412 }], // a heal up on bed 5
  goal: { x: 4630, y: 340, w: 60, h: 160 },
};

// World 3 field B — Thorn Climb: two terraced climbs onto bramble traverses (a kernel patrols each),
// drops between, an extra life up on the second traverse. The vertical field of world 3, doubled.
export const FIELD_BERRY_2: LevelDef = {
  id: '3-2',
  titleId: 'fieldBerry2',
  clearId: 'world1Clear',
  width: 5000,
  height: 540,
  spawn: { x: 80, y: 430 },
  platforms: [
    { x: 0, y: 500, w: 5000, h: 40 }, // ground floor beneath the twin climbs
    terrace(640, 432, 360), // climb 1 shelf 1
    terrace(900, 364, 360), // climb 1 shelf 2
    terrace(1240, 296, 640), // climb 1 shelf 3 + traverse
    terrace(2600, 432, 360), // climb 2 shelf 1
    terrace(2940, 364, 640), // climb 2 shelf 2 + traverse
    terrace(3900, 438, 320), // bed before the door
    terrace(4460, 440, 320), // last bed
  ],
  pits: [{ id: 'thorn-lift-gap', x: 2360, y: 500, w: 220 }],
  bouncePads: [
    { id: 'thorn-launch-pad-a', x: 2260, y: 484, w: 84, h: 16, launchV: 15 },
    { id: 'thorn-launch-pad-b', x: 3660, y: 484, w: 84, h: 16, launchV: 14 },
  ],
  movingPlatforms: [
    { id: 'thorn-tree-lift', x: 2380, y: 344, w: 150, h: 24, axis: 'y', travel: 88, periodFrames: 180, phaseFrames: 45 },
  ],
  nutDroppers: [
    { id: 'thorn-oak-a', x: 1520, y: 68, periodFrames: 162, phaseFrames: 42 },
    { id: 'thorn-oak-b', x: 3220, y: 72, periodFrames: 150, phaseFrames: 90 },
  ],
  enemies: [
    { name: 'kernelCreep', x: 420, y: 468, patrolLeft: 360, patrolRight: 600 }, // ground, before climb 1
    { name: 'kernelCreep', x: 1480, y: 264, patrolLeft: 1280, patrolRight: 1840 }, // traverse 1
    { name: 'kernelCreep', x: 3200, y: 332, patrolLeft: 2980, patrolRight: 3540 }, // traverse 2
    { name: 'kernelCreep', x: 4310, y: 468, patrolLeft: 4290, patrolRight: 4390 }, // tail furrow (beds)
  ],
  collectibles: [
    { name: 'goodCob', x: 740, y: 408 }, // on climb 1 shelf 1
    { name: 'goodCob', x: 1560, y: 272 }, // up on traverse 1
    { name: 'goodCob', x: 3200, y: 340 }, // up on traverse 2
    { name: 'goodCob', x: 4240, y: 476 },
  ],
  hazards: [],
  checkpoints: [
    { x: 2200, y: 300, w: 60, h: 200, respawn: { x: 2200, y: 430 } }, // flat drop between the climbs
    { x: 3700, y: 300, w: 60, h: 200, respawn: { x: 3700, y: 430 } }, // tail checkpoint (item 4): clear furrow after traverse 2, left of the x4310 kernel
  ],
  pickups: [{ kind: 'life', x: 3320, y: 336 }], // an extra life up on traverse 2 — the climb's reward
  goal: { x: 4880, y: 340, w: 60, h: 160 },
};

// World 4 field B — Compost Rows: a leaf-terrace climb, then beds with overhead thresher ledges (off
// the leap line, like 4-1), a heal on a bed. The hazard field of world 4, doubled.
export const FIELD_LETTUCE_2: LevelDef = {
  id: '4-2',
  titleId: 'fieldLettuce2',
  clearId: 'world1Clear',
  width: 4750,
  height: 540,
  weather: 'rain',
  spawn: { x: 80, y: 430 },
  platforms: [
    { x: 0, y: 500, w: 4750, h: 40 }, // ground floor beneath the compost beds
    terrace(640, 432, 380), // climb shelf 1
    terrace(920, 372, 520), // shelf 2 + the high leaf terrace
    terrace(2000, 440, 340), // bed
    terrace(2560, 440, 340), // bed
    terrace(3160, 438, 320), // bed
    terrace(3720, 440, 320), // bed
    terrace(4220, 438, 300), // last bed before the door
    { x: 1680, y: 320, w: 200, h: 24 }, // high thresher ledge (off the leap line)
    { x: 2900, y: 332, w: 200, h: 24 }, // high thresher ledge
  ],
  pits: [{ id: 'compost-storm-gap', x: 2900, y: 500, w: 260 }],
  movingPlatforms: [
    { id: 'compost-storm-board', x: 2910, y: 456, w: 130, h: 24, axis: 'x', travel: 110, periodFrames: 192, phaseFrames: 48 },
  ],
  slickSurfaces: [
    { id: 'brine-board-a', x: 1440, y: 500, w: 540, h: 16, grip: 0.28 },
    { id: 'brine-board-b', x: 3420, y: 500, w: 280, h: 16, grip: 0.34 },
  ],
  enemies: [
    { name: 'kernelCreep', x: 420, y: 468, patrolLeft: 360, patrolRight: 600 },
    { name: 'kernelCreep', x: 1700, y: 468, patrolLeft: 1640, patrolRight: 1820 }, // furrow (leaf terrace | bed)
    { name: 'kernelCreep', x: 2450, y: 468, patrolLeft: 2370, patrolRight: 2530 }, // furrow (beds)
    { name: 'kernelCreep', x: 4110, y: 468, patrolLeft: 4070, patrolRight: 4190 }, // tail furrow (beds)
  ],
  collectibles: [
    { name: 'goodCob', x: 1180, y: 348 }, // up on the leaf terrace
    { name: 'goodCob', x: 2200, y: 416 }, // on a bed
    { name: 'goodCob', x: 3300, y: 414 }, // on a bed
    { name: 'goodCob', x: 4400, y: 414 }, // on the last bed
  ],
  hazards: [
    { name: 'thresher', x: 1740, y: 296 }, // high ledge, above the leap line
    { name: 'thresher', x: 2960, y: 308 }, // high ledge
  ],
  checkpoints: [
    { x: 2080, y: 420, w: 60, h: 80, respawn: { x: 2080, y: 370 } },
    { x: 3580, y: 300, w: 60, h: 200, respawn: { x: 3580, y: 430 } }, // tail checkpoint (item 4): clear furrow (beds), left of the x4110 kernel
  ],
  pickups: [{ kind: 'health', x: 2700, y: 412 }], // a heal up on a bed
  goal: { x: 4630, y: 340, w: 60, h: 160 },
};

// World 5 field B — Windfall Wood: the orchard's every motif again — a branch climb, then beds and
// furrows to the door, a heal mid-field. The full bend, doubled, before King Corn.
export const FIELD_BANANA_2: LevelDef = {
  id: '5-2',
  titleId: 'fieldBanana2',
  clearId: 'world1Clear',
  width: 5250,
  height: 540,
  spawn: { x: 80, y: 430 },
  platforms: [
    { x: 0, y: 500, w: 5250, h: 40 }, // ground floor beneath the orchard machinery
    terrace(640, 432, 360), // climb shelf 1
    terrace(900, 360, 720), // shelf 2 + the high branch traverse
    terrace(2200, 440, 320), // bed
    terrace(2740, 432, 320), // bed
    terrace(3300, 440, 320), // bed
    terrace(3880, 436, 320), // bed
    terrace(4460, 438, 320), // last bed before the door
    { x: 3100, y: 350, w: 150, h: 24 }, // switchable squirrel battery perch
  ],
  pits: [{ id: 'royal-lift-gap-b', x: 3660, y: 500, w: 220 }],
  // The plate overlaps the gate by 12px (like the World 2 levers) so a swing thrown flush at the gate opens it.
  switches: [{ id: 'crown-ricochet-b', x: 2010, y: 438, w: 142, h: 46, accepts: 'either' }],
  gates: [{ id: 'crown-machine-gate-b', switchId: 'crown-ricochet-b', x: 2140, y: 366, w: 32, h: 134 }],
  movingPlatforms: [
    { id: 'royal-orchard-lift-b', x: 3700, y: 350, w: 150, h: 24, axis: 'y', travel: 82, periodFrames: 192, phaseFrames: 64 },
  ],
  enemies: [
    { name: 'kernelCreep', x: 420, y: 468, patrolLeft: 360, patrolRight: 600 },
    { name: 'kernelCreep', x: 1300, y: 328, patrolLeft: 1120, patrolRight: 1600 }, // the high branch traverse
    { name: 'kernelCreep', x: 2600, y: 468, patrolLeft: 2550, patrolRight: 2690 }, // furrow (beds)
    { name: 'kernelCreep', x: 4300, y: 468, patrolLeft: 4230, patrolRight: 4370 }, // tail furrow (beds)
    { name: 'squirrel', x: 3140, y: 316, patrolLeft: 3100, patrolRight: 3250, batterySwitchId: 'crown-ricochet-b' },
  ],
  collectibles: [
    { name: 'goodCob', x: 1280, y: 336 }, // up on the branch
    { name: 'goodCob', x: 2000, y: 476 }, // ground
    { name: 'goodCob', x: 3460, y: 416 }, // on a bed
    { name: 'goodCob', x: 4400, y: 476 },
  ],
  hazards: [],
  checkpoints: [
    { x: 2080, y: 420, w: 60, h: 80, respawn: { x: 2080, y: 430 } },
    { x: 3560, y: 300, w: 60, h: 200, respawn: { x: 3560, y: 370 } }, // bank progress on the bed immediately before the royal lift gap
  ],
  pickups: [{ kind: 'health', x: 2900, y: 404 }], // a heal up on a bed
  goal: { x: 5130, y: 340, w: 60, h: 160 },
};

// Endgame field B — The Final Furrow: one more gauntlet between the last furrow and the un-cobbing, so
// the FINAL boss is gated behind two fields too. A ridge climb, beds, no rescue, to the door.
export const THE_FINAL_FURROW: LevelDef = {
  id: 'end-furrow-2',
  titleId: 'endFurrow2',
  clearId: 'world1Clear',
  width: 4750,
  height: 540,
  spawn: { x: 80, y: 430 },
  platforms: [
    { x: 0, y: 500, w: 4750, h: 40 }, // ground floor — no pits
    terrace(760, 432, 360), // climb shelf 1
    terrace(1120, 364, 560), // shelf 2 + the ridge traverse
    terrace(2300, 440, 320), // bed
    terrace(2860, 436, 320), // bed
    terrace(3460, 438, 320), // bed
    terrace(4040, 440, 300), // last bed before the door
  ],
  enemies: [
    { name: 'kernelCreep', x: 420, y: 468, patrolLeft: 360, patrolRight: 620 },
    { name: 'kernelCreep', x: 1400, y: 332, patrolLeft: 1160, patrolRight: 1660 }, // the ridge
    { name: 'kernelCreep', x: 2700, y: 468, patrolLeft: 2650, patrolRight: 2790 }, // furrow (beds)
    { name: 'kernelCreep', x: 3900, y: 468, patrolLeft: 3870, patrolRight: 3990 }, // tail furrow (beds)
  ],
  collectibles: [
    { name: 'goodCob', x: 360, y: 476 },
    { name: 'goodCob', x: 1400, y: 340 }, // up on the ridge
    { name: 'goodCob', x: 3300, y: 476 },
    { name: 'goodCob', x: 4500, y: 476 }, // ground near the door
  ],
  hazards: [],
  checkpoints: [
    { x: 2080, y: 420, w: 60, h: 80, respawn: { x: 2080, y: 430 } },
    { x: 3800, y: 300, w: 60, h: 200, respawn: { x: 3800, y: 430 } }, // tail checkpoint (item 4): clear furrow (beds), left of the x3900 kernel
  ],
  pickups: [{ kind: 'health', x: 2460, y: 412 }], // a last heal before the un-cobbing
  goal: { x: 4630, y: 340, w: 60, h: 160 },
};

export function aabbOverlap(a: Aabb, b: Aabb): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function groundSupportY(level: LevelDef, x: number): number {
  let top = level.height; // the world floor, as the worst case
  for (const p of level.platforms) {
    if (x < p.x || x >= p.x + p.w) continue; // column not over this platform
    if (p.y + p.h < level.height) continue; // floating ledge — not ground support
    if (p.y < top) top = p.y;
  }
  return top;
}

export interface MoveResult {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  hitWall: boolean;
}

// Largest distance a body may move in one collision substep. Kept below the thinnest solid
// (platforms are 24px tall) so a fast actor can never cross a platform in a single step and
// tunnel through it. The per-frame move is split into ceil(speed / MAX_STEP) equal substeps.
const MAX_STEP = 8;

function pitUnderBody(level: LevelDef, x: number, w: number): PitPlacement | null {
  const centerX = x + w / 2;
  return level.pits?.find((pit) => centerX >= pit.x && centerX < pit.x + pit.w) ?? null;
}

function collisionPlatforms(level: LevelDef): Platform[] {
  const pits = level.pits ?? [];
  return level.platforms.flatMap((platform) => {
    let pieces: Platform[] = [platform];
    for (const pit of pits) {
      if (platform.y < pit.y) continue;
      pieces = pieces.flatMap((piece) => {
        const cutLeft = Math.max(piece.x, pit.x);
        const cutRight = Math.min(piece.x + piece.w, pit.x + pit.w);
        if (cutLeft >= cutRight) return [piece];
        const next: Platform[] = [];
        if (cutLeft > piece.x) next.push({ ...piece, w: cutLeft - piece.x });
        if (cutRight < piece.x + piece.w) next.push({ ...piece, x: cutRight, w: piece.x + piece.w - cutRight });
        return next;
      });
    }
    return pieces;
  });
}

// Deterministic axis-separated AABB move against the level's solid platforms and bounds.
// Pure: (box, velocity, level) → resolved (position, velocity, contact flags). No rng, no dt —
// one fixed frame, substepped so high speeds don't tunnel. Each substep resolves horizontal then
// vertical; once an axis hits something its velocity is killed for the remaining substeps.
export function moveAabb(box: Aabb, vx: number, vy: number, level: LevelDef): MoveResult {
  let { x, y } = box;
  const { w, h } = box;
  let onGround = false;
  let hitWall = false;
  let vxLive = vx;
  let vyLive = vy;
  const platforms = collisionPlatforms(level);

  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(vx), Math.abs(vy)) / MAX_STEP));
  const stepX = vx / steps;
  const stepY = vy / steps;

  for (let i = 0; i < steps; i++) {
    // --- Horizontal substep (resolved against the current vertical span) ---
    if (vxLive !== 0) {
      x += stepX;
      if (x < 0) { x = 0; vxLive = 0; hitWall = true; }
      else if (x + w > level.width) { x = level.width - w; vxLive = 0; hitWall = true; }
      else {
        for (const p of platforms) {
          if (aabbOverlap({ x, y, w, h }, p)) {
            x = stepX > 0 ? p.x - w : p.x + p.w;
            vxLive = 0;
            hitWall = true;
            break;
          }
        }
      }
    }

    // --- Vertical substep ---
    if (vyLive !== 0) {
      y += stepY;
      for (const p of platforms) {
        if (aabbOverlap({ x, y, w, h }, p)) {
          if (stepY > 0) { y = p.y - h; onGround = true; }
          else { y = p.y + p.h; }
          vyLive = 0;
          break;
        }
      }
    }
  }

  // Floor + ceiling safety. Authored pits deliberately suspend the floor clamp while the body's
  // center is over their span; every other column retains the impossible-state world floor.
  // Only a pit can leave a body below the floor line, so a body that started this move there is
  // mid-fall: re-clamping it once its centre drifts past the lip would wedge it into the bank.
  const startedBelowFloor = box.y + h > level.height;
  if (y + h > level.height && !startedBelowFloor && !pitUnderBody(level, x, w)) { y = level.height - h; vyLive = 0; onGround = true; }
  if (y < 0) { y = 0; if (vyLive < 0) vyLive = 0; }

  return { x, y, vx: vxLive, vy: vyLive, onGround, hitWall };
}
