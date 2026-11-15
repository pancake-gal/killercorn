// Level art set (presentation only — the One Rule is untouched by anything here). PlayScene used to
// hardcode World-1 art everywhere; this module is the data it now reads instead, so every later field
// and boss is a lookup, not a literal. A LevelArtSet binds a LevelDef to its environment art, its
// music bed, and (for an arena) its boss art. Each completed world pack lives here as explicit
// presentation data; simulation and replay state never depend on these lookups.

import { type LevelDef } from '@/entities/level/level';
import { type BossConfig, KING_CORN_CONFIG } from '@/entities/boss/kingCorn';
import { BUTTER_STICK_CONFIG, GENERAL_ACORN_CONFIG, SIR_PICKLE_CONFIG, SALT_CONFIG, PEPPER_CONFIG } from '@/entities/boss/configs';
import { resolveAsset } from '@/assets/resolve';
import type { PowerKind } from '@/entities/player/powerup';
import { friendForPower, type CrewFriend } from '@/campaign/session';
import { CHARACTER_ROSTER } from '@/entities/player/characters';

// Parallax + tileset + the one carved ground tile that skins every platform.
export interface EnvArt {
  bgFar: string;
  bgMid: string;
  bgNear: string;
  // Optional upward reveal for low-authored far scenery, measured in source-image pixels.
  farLiftPx?: number;
  tileset: string;
  groundTile: { x: number; y: number; w: number; h: number };
  groundFrame: string;
  groundScale: number;
}

export interface EnvGrade {
  far: number; // tint for the far parallax layer (sky/barn/hills)
  mid: number; // tint for the mid parallax layer (corn/fence)
  near: number; // tint for the near parallax layer (grass)
  ground: number; // tint for the tiled platform strips
  camBg?: string; // optional camera background colour (shows only at the viewport edges)
}

// A boss's pose art: which sheet (frame ids), the sim config that sizes its box + counts its hp
// pips, and the logical pose → frame-id map (the active pose varies per boss: King Corn "strides",
// Butter Stick "lunges", General Acorn "hurls", Sir Pickle "thrusts", the shakers "attack").
export interface BossPoseArt {
  framePrefix: string;
  config: BossConfig;
  poses: { idle: string; move: string; hurt: string; defeated: string };
}

// A single-target boss: its pose art plus its intro card (poster).
export interface BossArt extends BossPoseArt {
  card: string;
}

// A team boss (Salt & Pepper): one shared intro card plus each shaker's pose art. The Boss Royale ring
// has no card: its bosses drop in one group at a time, each named by a banner.
export interface TeamBossArt {
  card?: string;
  members: BossPoseArt[];
}

export interface LevelArtSet {
  env: EnvArt;
  grade: EnvGrade; // per-world tint grade (item 3 — environment art data, not a regime change)
  theme: string; // music cue id
  themeStartFraction: number; // deterministic A/B entry point; second fields start at the contrasting half
  rageTheme?: string; // more-intense bed swapped in while the boss's marked RAGE phase is live (King only)
  victoryTheme?: string; // celebratory narrative handoff from the final fight into eruption + credits
  boss?: BossArt; // present only for a single-target boss arena
  teamBoss?: TeamBossArt; // present only for a team-boss arena
}

// The World-1 environment, hand-measured off the world1-tileset sheet (the ground tile is the
// grass-topped cell at x11,y100).
export const WORLD_1_ENV: EnvArt = {
  bgFar: 'world1-bg-far',
  bgMid: 'world1-bg-mid',
  bgNear: 'world1-bg-near',
  tileset: 'world1-tileset',
  groundTile: { x: 11, y: 100, w: 125, h: 132 },
  groundFrame: 'ground',
  groundScale: 0.34, // tile shows ~45px; the platform's own height clips the dirt below
};

// Shaker Acres / Root Rows: terracotta beds, carrot rows, irrigation rails, and shaker silos.
// The carved first terrain block tiles to ~45px at runtime, matching World 1's visual density.
export const WORLD_2_ENV: EnvArt = {
  bgFar: 'world2-bg-far',
  bgMid: 'world2-bg-mid',
  bgNear: 'world2-bg-near',
  tileset: 'world2-tileset',
  groundTile: { x: 15, y: 124, w: 195, h: 158 },
  groundFrame: 'ground',
  groundScale: 0.23,
};

export const WORLD_3_ENV: EnvArt = {
  bgFar: 'world3-bg-far',
  bgMid: 'world3-bg-mid',
  bgNear: 'world3-bg-near',
  farLiftPx: 88,
  tileset: 'world3-tileset',
  groundTile: { x: 15, y: 124, w: 195, h: 158 },
  groundFrame: 'ground',
  groundScale: 0.23,
};

export const WORLD_4_ENV: EnvArt = {
  bgFar: 'world4-bg-far',
  bgMid: 'world4-bg-mid',
  bgNear: 'world4-bg-near',
  tileset: 'world4-tileset',
  groundTile: { x: 15, y: 124, w: 195, h: 158 },
  groundFrame: 'ground',
  groundScale: 0.23,
};

export const WORLD_5_ENV: EnvArt = {
  bgFar: 'world5-bg-far',
  bgMid: 'world5-bg-mid',
  bgNear: 'world5-bg-near',
  tileset: 'world5-tileset',
  groundTile: { x: 15, y: 124, w: 195, h: 158 },
  groundFrame: 'ground',
  groundScale: 0.23,
};

const ENVIRONMENT_BY_LEVEL_ID: Record<string, EnvArt> = {
  '2-1': WORLD_2_ENV,
  '2-2': WORLD_2_ENV,
  'salt-pepper-arena': WORLD_2_ENV,
  '3-1': WORLD_3_ENV,
  '3-2': WORLD_3_ENV,
  'general-acorn-arena': WORLD_3_ENV,
  '4-1': WORLD_4_ENV,
  '4-2': WORLD_4_ENV,
  'sir-pickle-arena': WORLD_4_ENV,
  '5-1': WORLD_5_ENV,
  '5-2': WORLD_5_ENV,
  '1-boss': WORLD_5_ENV,
  'end-grab': WORLD_5_ENV,
  'end-furrow': WORLD_5_ENV,
  'end-final': WORLD_5_ENV,
  'boss-royale': WORLD_5_ENV,
};

function environmentFor(id: string): EnvArt {
  return ENVIRONMENT_BY_LEVEL_ID[id] ?? WORLD_1_ENV;
}

// Single-target boss art by registry name (the four field bosses + the climax King Corn).
export const BOSS_ART: Record<string, BossArt> = {
  kingCorn: {
    framePrefix: 'king-corn',
    card: 'king-corn-card',
    config: KING_CORN_CONFIG,
    poses: { idle: 'king-corn-idle', move: 'king-corn-stride', hurt: 'king-corn-hurt', defeated: 'king-corn-defeated' },
  },
  butterStick: {
    framePrefix: 'butter-stick',
    card: 'butter-stick-card',
    config: BUTTER_STICK_CONFIG,
    poses: { idle: 'butter-stick-idle', move: 'butter-stick-lunge', hurt: 'butter-stick-hurt', defeated: 'butter-stick-defeated' },
  },
  generalAcorn: {
    framePrefix: 'general-acorn',
    card: 'general-acorn-card',
    config: GENERAL_ACORN_CONFIG,
    poses: { idle: 'general-acorn-idle', move: 'general-acorn-hurl', hurt: 'general-acorn-hurt', defeated: 'general-acorn-defeated' },
  },
  sirPickle: {
    framePrefix: 'sir-pickle',
    card: 'sir-pickle-card',
    config: SIR_PICKLE_CONFIG,
    poses: { idle: 'sir-pickle-idle', move: 'sir-pickle-thrust', hurt: 'sir-pickle-hurt', defeated: 'sir-pickle-defeated' },
  },
};

// Pose art for each Salt & Pepper shaker, keyed by member name (rows of the salt-and-pepper sheet).
const SHAKER_ART: Record<string, BossPoseArt> = {
  salt: {
    framePrefix: 'salt',
    config: SALT_CONFIG,
    poses: { idle: 'salt-idle', move: 'salt-attack', hurt: 'salt-hurt', defeated: 'salt-defeated' },
  },
  pepper: {
    framePrefix: 'pepper',
    config: PEPPER_CONFIG,
    poses: { idle: 'pepper-idle', move: 'pepper-attack', hurt: 'pepper-hurt', defeated: 'pepper-defeated' },
  },
};

// Team boss art by team name. One shared card; member pose art is resolved per member name (a shaker,
// or any single boss for the Boss Royale ring).
export const TEAM_BOSS_ART: Record<string, { card?: string; memberNames: readonly string[] }> = {
  saltAndPepper: { card: 'salt-and-pepper-card', memberNames: ['salt', 'pepper'] },
  bossRoyale: { memberNames: ['butterStick', 'salt', 'pepper', 'generalAcorn', 'sirPickle', 'kingCorn'] },
};

export function bossArtFor(name: string): BossArt {
  const art = BOSS_ART[name];
  if (!art) throw new Error(`bossArtFor: no boss art for "${name}"`);
  return art;
}

export function teamBossArtFor(name: string): TeamBossArt {
  const team = TEAM_BOSS_ART[name];
  if (!team) throw new Error(`teamBossArtFor: no team-boss art for "${name}"`);
  return {
    ...(team.card ? { card: team.card } : {}),
    members: team.memberNames.map((m) => {
      const art = SHAKER_ART[m] ?? BOSS_ART[m];
      if (!art) throw new Error(`teamBossArtFor: no member art for "${m}"`);
      return art;
    }),
  };
}

// Per-stage score: five authored field identities, a contrasting A/B entry for each world's second
// field, unique villain romps, a King march, final showdown, and eruption/credits victory reel.
const FIELD_THEME: Record<string, string> = {
  '1-1': 'overworld-theme',
  '1-range': 'overworld-theme',
  '2-1': 'field2-theme',
  '2-2': 'field2-theme',
  '3-1': 'field3-theme',
  '3-2': 'field3-theme',
  '4-1': 'field4-theme',
  '4-2': 'field4-theme',
  '5-1': 'field5-theme',
  '5-2': 'field5-theme',
  'end-furrow': 'extra-theme',
};
const BOSS_THEME: Record<string, string> = {
  'butter-stick-arena': 'boss-theme',
  'salt-pepper-arena': 'boss-battle-theme',
  'general-acorn-arena': 'acorn-battle-theme',
  'sir-pickle-arena': 'pickle-battle-theme',
  '1-boss': 'king-corn-theme', // the King's own march (WORLD_1_BOSS)
  'end-grab': 'king-corn-theme',
  'end-final': 'finale-theme',
};
const THEME_START: Record<string, number> = {
  '1-range': 0.5,
  '2-2': 0.5,
  '3-2': 0.5,
  '4-2': 0.5,
  '5-2': 0.5,
  'end-furrow-2': 0.5,
};
// The rage variant a theme swaps to while the arena boss's marked RAGE phase is live (King only —
// no field-boss config declares a rage phase). Keyed by BASE theme so the pairing lives in one place.
const RAGE_THEME: Record<string, string> = {
  'king-corn-theme': 'king-corn-rage-theme',
  'finale-theme': 'king-corn-rage-theme',
};
const VICTORY_THEME: Record<string, string> = { 'end-final': 'victory-theme' };

function fieldThemeFor(id: string): string {
  return FIELD_THEME[id] ?? 'overworld-theme';
}
function bossThemeFor(id: string): string {
  return BOSS_THEME[id] ?? 'boss-battle-theme';
}

// Per-world tint grades (item 3), keyed like FIELD_THEME. Phaser tints MULTIPLY, so 0xffffff is a no-op
// (World 1 keeps the reference sunny look). Every other world pushes its environment toward its own
// hour/weather; boss arenas get a dark storm grade so the flipped red `boss` accent sits in a storm.
// All values are ordinary environment colours — verified free of the accent cores by the grep-guard.
export const IDENTITY_GRADE: EnvGrade = { far: 0xffffff, mid: 0xffffff, near: 0xffffff, ground: 0xffffff };
// Root Rows keeps the reference blue sky. A very light spring grade distinguishes foliage and soil
// without putting a sepia multiply wash over the whole screen.
const WORLD2_GRADE: EnvGrade = { far: 0xffffff, mid: 0xf5fff0, near: 0xedf8e5, ground: 0xf8f3e8 };
// Dedicated environment packs already carry their world palette. Keep grades light so they unify
// actors and layers without multiplying the authored sky into murk.
const WORLD3_GRADE: EnvGrade = { far: 0xffffff, mid: 0xf4f0ff, near: 0xeee8fa, ground: 0xf2ecf8, camBg: '#7876a8' }; // Bramble — violet dusk
const WORLD4_GRADE: EnvGrade = { far: 0xffffff, mid: 0xf0fff2, near: 0xe8f6ed, ground: 0xedf8f0, camBg: '#78928c' }; // Leaf Beds — rainy green
const WORLD5_GRADE: EnvGrade = { far: 0xffffff, mid: 0xfff7e8, near: 0xf8f0e4, ground: 0xfff5e5, camBg: '#efb36f' };
const ENDGAME_GRADE: EnvGrade = { far: 0x9aa4b2, mid: 0x8b95a4, near: 0x7c8696, ground: 0x8892a0, camBg: '#3e4652' }; // furrows — desaturated cold slate
const STORM_GRADE: EnvGrade = { far: 0x66667f, mid: 0x5a5a72, near: 0x505066, ground: 0x585870, camBg: '#241d33' }; // boss arenas — dark storm (~40% + cool shift)

const FIELD_GRADE: Record<string, EnvGrade> = {
  '1-1': IDENTITY_GRADE,
  '1-range': IDENTITY_GRADE,
  '2-1': WORLD2_GRADE,
  '2-2': WORLD2_GRADE,
  '3-1': WORLD3_GRADE,
  '3-2': WORLD3_GRADE,
  '4-1': WORLD4_GRADE,
  '4-2': WORLD4_GRADE,
  '5-1': WORLD5_GRADE,
  '5-2': WORLD5_GRADE,
  'end-furrow': ENDGAME_GRADE,
};

// A boss arena reads as a storm regardless of its id; every other stage looks its grade up by id
// (World 1 + any unlisted stage = the identity/reference look).
export function gradeFor(level: LevelDef): EnvGrade {
  if (level.boss || level.teamBoss) return STORM_GRADE;
  return FIELD_GRADE[level.id] ?? IDENTITY_GRADE;
}

// Resolve a level's full art set: its environment, tint grade, music bed (per-field / boss /
// finale), and the (single or team) boss art for an arena.
export function artSetFor(level: LevelDef): LevelArtSet {
  const env = environmentFor(level.id);
  const grade = gradeFor(level);
  if (level.boss) {
    const theme = bossThemeFor(level.id);
    return {
      env,
      grade,
      theme,
      themeStartFraction: THEME_START[level.id] ?? 0,
      rageTheme: RAGE_THEME[theme],
      victoryTheme: VICTORY_THEME[level.id],
      boss: bossArtFor(level.boss.name),
    };
  }
  if (level.teamBoss) {
    // The Boss Royale ring closes on the King, so it carries his rage bed for his last pip.
    const rageTheme = level.teamBoss.royale ? RAGE_THEME['king-corn-theme'] : undefined;
    return {
      env,
      grade,
      theme: bossThemeFor(level.id),
      themeStartFraction: THEME_START[level.id] ?? 0,
      ...(rageTheme ? { rageTheme } : {}),
      teamBoss: teamBossArtFor(level.teamBoss.name),
    };
  }
  return { env, grade, theme: fieldThemeFor(level.id), themeStartFraction: THEME_START[level.id] ?? 0 };
}

// The sprite-sheet prefix for a chosen hero. Self-validating against the manifest: a kid with a real
// `<id>-idle` frame renders with their own sheet, anything else (a stale/forged id) degrades to Fred
// — the rendering mirror of the sim's playerConfigFor fallback (the One Rule across heroes).
export function playerArtPrefix(characterId: string): string {
  return resolveAsset(`${characterId}-idle`) ? characterId : 'fred';
}

const PLAYER_POSES = ['idle', 'run', 'jump', 'fall', 'swing', 'hurt'] as const;
const KERNEL_FRAMES = ['kernel-creep-walk-a', 'kernel-creep-walk-b', 'kernel-creep-turn', 'kernel-creep-squished'];
const SQUIRREL_FRAMES = ['squirrel-walk-a', 'squirrel-walk-b', 'squirrel-windup', 'squirrel-throw', 'squirrel-squished'];
const SPIKED_CORN_FRAMES = ['spiked-corn-1', 'spiked-corn-2', 'spiked-corn-3', 'spiked-corn-4'];

function bossConfigEmitsSpikedCorn(config: BossConfig): boolean {
  return config.phases.some((phase) => phase.attacks.some((attack) => attack === 'lob' || attack === 'slam'));
}

export function gameplayAssetIdsFor(
  level: LevelDef,
  characterId: string,
  activePower: PowerKind,
  rescuedCrew: readonly CrewFriend[] = [],
  canSwitchCharacters = false,
): string[] {
  const art = artSetFor(level);
  const player = playerArtPrefix(characterId);
  const ids = new Set<string>([
    art.env.bgFar,
    art.env.bgMid,
    art.env.bgNear,
    art.env.tileset,
    'dust-puff',
    'sparkle',
    ...PLAYER_POSES.map((pose) => `${player}-${pose}`),
    `${player}-run-b`,
  ]);
  if (canSwitchCharacters) {
    for (const kid of CHARACTER_ROSTER) {
      for (const pose of [...PLAYER_POSES, 'run-b']) ids.add(`${kid.id}-${pose}`);
    }
  }
  if (level.goal) ids.add('level-exit');
  if (level.checkpoints.length) ids.add('checkpoint-marker');
  if (level.collectibles.length) ['good-cob-1', 'good-cob-2', 'good-cob-3', 'good-cob-4'].forEach((id) => ids.add(id));
  if (level.enemies.some((enemy) => enemy.name === 'kernelCreep')) KERNEL_FRAMES.forEach((id) => ids.add(id));
  if (level.enemies.some((enemy) => enemy.name === 'squirrel')) {
    SQUIRREL_FRAMES.forEach((id) => ids.add(id));
    SPIKED_CORN_FRAMES.forEach((id) => ids.add(id));
  }
  const bossEmitsSpikedCorn = art.boss
    ? bossConfigEmitsSpikedCorn(art.boss.config)
    : art.teamBoss?.members.some((member) => bossConfigEmitsSpikedCorn(member.config)) ?? false;
  if (bossEmitsSpikedCorn) SPIKED_CORN_FRAMES.forEach((id) => ids.add(id));
  if (level.hazards.length) ['thresher-1', 'thresher-2', 'thresher-3', 'thresher-4'].forEach((id) => ids.add(id));
  if (level.movingPlatforms?.length) ids.add('moving-platform');
  if (level.bouncePads?.length) ids.add('bounce-pad');
  if (level.switches?.some((target) => target.accepts === 'swing')) ids.add('root-switch');
  if (level.switches?.some((target) => target.accepts !== 'swing')) ids.add('ricochet-target');
  if (level.gates?.length) ids.add('root-gate');
  if (level.slickSurfaces?.length) ids.add('slick-board');
  if (level.nutDroppers?.length) ids.add('falling-acorn');
  if (level.boxes?.length) ['wheat-box-idle', 'wheat-box-glint', 'wheat-box-burst', 'wheat-box-squash'].forEach((id) => ids.add(id));
  if (level.pickups?.some((pickup) => pickup.kind === 'health')) ids.add('pep-pickup');
  // Boss Royale pop drops: a pep pie (health) and a wheat box (power refill).
  if (level.teamBoss?.royale) ['pep-pickup', 'wheat-box-idle', 'wheat-box-glint'].forEach((id) => ids.add(id));
  if (level.pickups?.some((pickup) => pickup.kind === 'life')) ids.add('oneup-pickup');
  for (const ally of level.allies ?? []) {
    ids.add(`ally-${ally.name}-caged`);
    ids.add(`ally-${ally.name}-freed`);
  }
  const equippedFriend = friendForPower(activePower);
  if (equippedFriend) ids.add(`ally-${equippedFriend}-freed`);
  for (const friend of rescuedCrew) ids.add(`ally-${friend}-freed`);
  // Any rescued power can be equipped from Pause mid-stage, so a rescued banana's peel loads too.
  const peelFriend = friendForPower('peelToss');
  const peelsReady = activePower === 'peelToss' || (peelFriend !== undefined && rescuedCrew.includes(peelFriend));
  if (peelsReady || level.allies?.some((ally) => ally.name === 'banana') || level.switches?.some((target) => target.accepts !== 'swing')) ids.add('banana-peel');
  if (art.boss) Object.values(art.boss.poses).forEach((id) => ids.add(id));
  if (art.teamBoss) for (const member of art.teamBoss.members) Object.values(member.poses).forEach((id) => ids.add(id));
  if (level.id === 'end-final') {
    [
      'finale-volcano-cinematic',
      'finale-eruption-plume',
      'finale-popcorn-kernel',
      'finale-popcorn-puff-a',
      'finale-popcorn-puff-b',
      'finale-popcorn-puff-c',
      'finale-popcorn-puff-d',
      'finale-husk-shard',
    ].forEach((id) => ids.add(id));
  }
  return [...ids];
}
