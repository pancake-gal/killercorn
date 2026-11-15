import { type InputFrame, type ReplayFixture, type ReplayInit } from '@/core/replay';
import { type LevelDef, type Aabb, aabbOverlap } from './level';
import { type PlayerState, type PlayerConfig, playerStep, spawnPlayer, spawnPlayerAt, grantPower, rechargePower, FRED_CONFIG, MAX_HEALTH, INVISIBILITY_FRAMES } from '@/entities/player/player';
import { powerConfig, POWER_UPS, type PowerKind } from '@/entities/player/powerup';
import { type PickupState, spawnPickup, resolvePickups } from '@/entities/collectible/pickup';
import { CHARACTER_ROSTER, DEFAULT_CHARACTER, playerConfigFor } from '@/entities/player/characters';
import { type WheatBoxState, type WheatBoxConfig, spawnWheatBox, resolveWheatBoxes, WHEAT_BOX_CONFIG } from '@/entities/powerup/wheatBox';
import { type EnemyState, type EnemyConfig, kernelStep, spawnEnemy, KERNEL_CREEP_CONFIG } from '@/entities/enemy/kernel';
import { type SquirrelConfig, squirrelStep, SQUIRREL_CONFIG } from '@/entities/enemy/squirrel';
import { type CollectibleState, spawnCollectible, collectStep } from '@/entities/collectible/goodCob';
import { type ProjectileState, type ProjectileConfig, projectileStep, resolveProjectiles, SPIKED_CORN_CONFIG } from '@/entities/projectile/spikedCorn';
import { tossPeel, resolvePeels, PEEL_CONFIG } from '@/entities/projectile/peel';
import { type AllyState, type AllyConfig, spawnAlly, resolveAllies, ALLY_CONFIG } from '@/entities/ally/produce';
import { hazardHit } from '@/entities/hazard/thresher';
import { resolveCombat } from '@/entities/combat';
import { type BossState, spawnBoss, bossStep, resolveBoss } from '@/entities/boss/kingCorn';
import { bossConfigFor } from '@/entities/boss/configs';
import { type TeamBossState, spawnTeamBoss, stepTeamBoss, resolveTeamBoss, teamConfigsFor, teamDefeated } from '@/entities/boss/saltAndPepper';
import { resolveRoyale, resolveRoyaleDrops, royaleSig, spawnRoyale, stepRoyale } from '@/entities/boss/royale';
import {
  carryPlatformRider,
  FALLING_NUT_CONFIG,
  fallingNutsForFrame,
  levelWithActiveSolids,
  resolveBouncePad,
  resolvePeelSwitches,
  resolveSwitches,
  type MechanismState,
} from './mechanics';

export interface WorldState {
  frame: number;
  characterId?: string; // present in victory-enabled runs; the simulation owns mid-stage selection
  switchCharacterHeld?: boolean;
  player: PlayerState;
  enemies: EnemyState[];
  boss: BossState | null; // present only in a single-target boss arena
  teamBoss: TeamBossState | null; // present only in a team-boss arena (Salt & Pepper)
  collectibles: CollectibleState[];
  projectiles: ProjectileState[];
  fallingNuts: ProjectileState[]; // World-3 acorns on authored frame cadences
  peels: ProjectileState[]; // live player-tossed peels (banana slip attack); fell enemies, then cull
  boxes: WheatBoxState[]; // wheat-stamped boxes; break one to refill the selected crew power
  allies: AllyState[]; // caged produce friends; free one to bank its signature power
  pickups: PickupState[];
  mechanisms: MechanismState; // opened field switches; moving-platform poses derive from frame
  // Rescued crew powers → stored charges, present when the run carries a campaign crew. The active
  // power's live count is player.powerCharges; this holds the rest so a swap never refills for free.
  crewCharges?: CrewCharges;
  score: number;
  checkpoint: number; // index of the last armed checkpoint, -1 = none (respawn at the level spawn)
  respawn: { x: number; y: number };
  deaths: number;
  lives: number; // lives left in the run; a life is lost when the health bar empties, 0 = game over
  gameOver: boolean; // the run is out of lives — the scene offers "try again" (freezes the sim)
  completed: boolean;
}

export const INITIAL_LIVES = 3;

export type CrewCharges = Partial<Record<PowerKind, number>>;

export interface WorldLoadout {
  activePower: PowerKind;
  powerCharges?: number;
  shield?: boolean;
  bossAssistTier?: number;
  crewCharges?: CrewCharges;
  royale?: { cleared?: readonly string[]; shuffleSeed?: number }; // Boss Royale progress (royale arenas only)
}

// The recorded spawn init (core/replay.ts) as a world loadout. The equipped power resumes its stored
// count, and Lettuce's leaf is up only with a leaf left — the same rule the campaign scene applies.
export function loadoutFromInit(init: ReplayInit = {}): WorldLoadout {
  const activePower = init.activePower ?? 'none';
  const charges = activePower === 'none' ? undefined : init.crewCharges?.[activePower];
  return {
    activePower,
    ...(charges !== undefined ? { powerCharges: charges, shield: activePower === 'leafGuard' && charges > 0 } : {}),
    ...(init.bossAssistTier !== undefined ? { bossAssistTier: init.bossAssistTier } : {}),
    ...(init.crewCharges ? { crewCharges: { ...init.crewCharges } } : {}),
    ...(init.royale ? { royale: init.royale } : {}),
  };
}

export function spawnWorldFromInit(level: LevelDef, init?: ReplayInit): WorldState {
  return init ? spawnWorld(level, init.lives ?? INITIAL_LIVES, loadoutFromInit(init)) : spawnWorld(level);
}

export interface WorldConfigs {
  player: PlayerConfig;
  characterId?: string;
  canSwitchCharacters?: boolean;
  enemy: EnemyConfig;
  squirrel: SquirrelConfig;
  projectile: ProjectileConfig;
  peel: ProjectileConfig;
  box: WheatBoxConfig;
  ally: AllyConfig;
}

export const DEFAULT_CONFIGS: WorldConfigs = { player: FRED_CONFIG, enemy: KERNEL_CREEP_CONFIG, squirrel: SQUIRREL_CONFIG, projectile: SPIKED_CORN_CONFIG, peel: PEEL_CONFIG, box: WHEAT_BOX_CONFIG, ally: ALLY_CONFIG };

export function spawnWorld(
  level: LevelDef,
  initialLives: number = INITIAL_LIVES,
  loadout: WorldLoadout = { activePower: 'none' },
): WorldState {
  // A level is at most ONE kind of arena: a single boss or a team boss, never both. Declaring both
  // would let either's defeat complete the level while the other is still live — fail fast instead.
  if (level.boss && level.teamBoss) throw new Error(`spawnWorld: level "${level.id}" declares both a boss and a teamBoss (mutually exclusive)`);
  const selectedPlayer = grantPower(spawnPlayer(level), loadout.activePower);
  const player = {
    ...selectedPlayer,
    powerCharges: loadout.powerCharges ?? selectedPlayer.powerCharges,
    shield: loadout.shield ?? selectedPlayer.shield,
  };
  return {
    frame: 0,
    player,
    enemies: level.enemies.map(spawnEnemy),
    boss: level.boss ? spawnBoss(level.boss, bossConfigFor(level.boss.name), loadout.bossAssistTier) : null,
    teamBoss: level.teamBoss
      ? level.teamBoss.royale
        ? spawnRoyale(level.teamBoss, loadout.bossAssistTier, loadout.royale)
        : spawnTeamBoss(level.teamBoss, loadout.bossAssistTier)
      : null,
    collectibles: level.collectibles.map(spawnCollectible),
    projectiles: [],
    fallingNuts: [],
    peels: [], // none until the player tosses one (banana slip attack)
    boxes: (level.boxes ?? []).map(spawnWheatBox),
    allies: (level.allies ?? []).map(spawnAlly),
    pickups: (level.pickups ?? []).map(spawnPickup),
    mechanisms: { activeSwitchIds: [] },
    ...(loadout.crewCharges ? { crewCharges: { ...loadout.crewCharges } } : {}),
    score: 0,
    checkpoint: -1,
    respawn: { x: level.spawn.x, y: level.spawn.y },
    deaths: 0,
    lives: initialLives,
    gameOver: false,
    completed: false,
  };
}

// How hard the leaf guard knocks the player back when it absorbs a hit (px/frame). A backward,
// upward shove that buys space — the "one hit before a knockback" the lettuce ally promises.
const SHIELD_KNOCKBACK_VX = 5;
const SHIELD_KNOCKBACK_VY = 7;

// A non-fatal hit (the health bar still has pips left) shoves the player back-and-up like the shield
// and arms mercy i-frames, so a single contact costs ONE pip — never a chain-drain while standing in
// a blade or against a mob. A life-loss respawn arms a longer mercy window so you never re-die on the
// respawn frame. (px/frame for the shoves; frames for the windows.)
const HIT_KNOCKBACK_VX = 4;
const HIT_KNOCKBACK_VY = 6;
const HURT_IFRAMES = 48; // mercy frames after surviving a hit
const RESPAWN_IFRAMES = 60; // mercy frames after a life-loss respawn
const PIT_RESPAWN_DEPTH = 80; // let the tumble read on-screen before banking the life loss

function respawnPlayer(player: PlayerState, respawn: { x: number; y: number }): PlayerState {
  const body = grantPower(spawnPlayerAt(respawn.x, respawn.y), player.power);
  return {
    ...body,
    powerCharges: player.powerCharges,
    powerCooldown: player.powerCooldown,
    shield: player.shield,
    invuln: RESPAWN_IFRAMES,
    ...(player.invisibility ? { invisibility: {
      ...player.invisibility,
      remaining: 0,
      recharge: player.invisibility.remaining > 0 ? INVISIBILITY_FRAMES : player.invisibility.recharge,
    } } : {}),
  };
}

// Equip another rescued friend from a recorded selectPower input. The outgoing friend's live count
// is stored and the incoming friend resumes its stored count, so swapping never refills a resource.
function applyCrewSwap(world: WorldState, select: PowerKind | undefined): WorldState {
  const crew = world.crewCharges;
  const current = world.player;
  if (!select || select === 'none' || !crew || select === current.power || crew[select] === undefined) return world;
  const stored: CrewCharges = current.power === 'none' ? crew : { ...crew, [current.power]: current.powerCharges };
  const charges = stored[select]!;
  const equipped = grantPower(current, select);
  return {
    ...world,
    crewCharges: stored,
    player: { ...equipped, powerCharges: charges, shield: POWER_UPS[select].grantsShield === true && charges > 0 },
  };
}

// How far from the stage spawn still counts as "the start" for a crew swap (px).
const CREW_SWAP_START_REACH = 64;

export function atCrewSwapPoint(world: WorldState, level: LevelDef, playerCfg: PlayerConfig): boolean {
  const p = world.player;
  // The start counts before the first landing (a fresh spawn begins slightly airborne).
  if (Math.abs(p.x - level.spawn.x) <= CREW_SWAP_START_REACH) return true;
  if (!p.onGround) return false;
  const box: Aabb = { x: p.x, y: p.y, w: playerCfg.width, h: playerCfg.height };
  return level.checkpoints.some((cp, index) => index <= world.checkpoint && aabbOverlap(box, cp));
}

export function stepWorld(world: WorldState, input: InputFrame, level: LevelDef, cfg: WorldConfigs = DEFAULT_CONFIGS): WorldState {
  // Out of lives: the run is frozen on its game-over frame until the scene restarts it (try again).
  // Returning the same world keeps the sim deterministic and the SFX delta-mapper quiet.
  if (world.gameOver) return world;
  let characterId: string | undefined;
  if (cfg.canSwitchCharacters === true) {
    characterId = world.characterId ?? cfg.characterId ?? DEFAULT_CHARACTER;
    if (!world.completed && input.switchCharacter && !world.switchCharacterHeld) {
      const index = CHARACTER_ROSTER.findIndex((kid) => kid.id === characterId);
      characterId = CHARACTER_ROSTER[(index + 1) % CHARACTER_ROSTER.length]!.id;
    }
    cfg = { ...cfg, player: playerConfigFor(characterId) };
  }
  world = applyCrewSwap(world, input.selectPower);
  const incomingCfg = powerConfig(cfg.player, world.player.power);
  const carriedPlayer = carryPlatformRider(world.player, incomingCfg, level.movingPlatforms ?? [], world.frame);
  const collisionLevel = levelWithActiveSolids(level, world.frame + 1, world.mechanisms);
  let moved = playerStep(carriedPlayer, input, cfg.player, collisionLevel);

  // The player's EFFECTIVE config this frame — the base character config with the (incoming) power
  // overlaid, the same config playerStep used for movement. Every player-box read below (combat,
  // stomp, hitbox, hazard, projectile) uses pCfg so size/reach/bounce stay in sync with movement if
  // a future power touches them. For 'none' this is cfg.player by reference, so digests are unchanged.
  const pCfg = powerConfig(cfg.player, world.player.power);
  moved = resolveBouncePad(moved, pCfg, level.bouncePads ?? []);

  // Enemies: dispatch by kind. A kernel just patrols; a squirrel patrols AND may lob spiked corn,
  // aimed at the player's CENTER. The corn it releases this frame joins the live projectiles AFTER
  // this frame's resolution (below), so a fresh lob never hits on its own spawn frame.
  const invisible = (moved.invisibility?.remaining ?? 0) > 0;
  const playerCenterX = invisible ? moved.invisibility!.lastSeenX : moved.x + pCfg.width / 2;
  const steppedEnemies: EnemyState[] = [];
  const emittedCorn: ProjectileState[] = [];
  for (const e of world.enemies) {
    if (e.kind === 'squirrel') {
      const batteryOff = !!e.batterySwitchId && world.mechanisms.activeSwitchIds.includes(e.batterySwitchId);
      const r = batteryOff
        ? {
            enemy: { ...kernelStep(e, cfg.squirrel, collisionLevel), throwTimer: cfg.squirrel.throwInterval },
            corn: null,
          }
        : squirrelStep(e, cfg.squirrel, collisionLevel, playerCenterX);
      steppedEnemies.push(r.enemy);
      if (r.corn) emittedCorn.push(r.corn);
    } else {
      steppedEnemies.push(kernelStep(e, cfg.enemy, collisionLevel));
    }
  }
  const bossCfg = level.boss ? bossConfigFor(level.boss.name) : null;
  const bossStepRes = world.boss && bossCfg ? bossStep(world.boss, bossCfg, collisionLevel, playerCenterX) : null;
  const steppedBoss = bossStepRes ? bossStepRes.boss : null;
  if (bossStepRes) emittedCorn.push(...bossStepRes.shots);
  const teamCfgs = level.teamBoss ? teamConfigsFor(level.teamBoss) : null;
  // Boss Royale rides the team slot with its own step (bench, entry, one attack floor); every other
  // team arena keeps the untouched team step, so its digests stay byte-for-byte.
  const royaleRing = level.teamBoss?.royale && world.teamBoss?.royale ? level.teamBoss : null;
  const teamStepRes = world.teamBoss && teamCfgs
    ? royaleRing
      ? stepRoyale(world.teamBoss, teamCfgs, royaleRing, collisionLevel, playerCenterX)
      : stepTeamBoss(world.teamBoss, teamCfgs, collisionLevel, playerCenterX)
    : null;
  const steppedTeam = teamStepRes ? teamStepRes.team : null;
  if (teamStepRes) emittedCorn.push(...teamStepRes.shots);
  // Step last frame's shots (this frame's fresh lobs are added AFTER resolution, below).
  const steppedProjectiles = world.projectiles.map((pr) => projectileStep(pr, cfg.projectile, collisionLevel));
  const steppedNuts = world.fallingNuts.map((nut) => projectileStep(nut, FALLING_NUT_CONFIG, collisionLevel));

  // Peels (banana slip attack): step + cull last frame's peels, toss a fresh one when the dedicated
  // crew-power action spends a Banana charge, then fell any enemy a peel touches before combat.
  let peels = world.peels.map((pr) => projectileStep(pr, cfg.peel, collisionLevel)).filter((pr) => pr.alive);
  const peelUsed =
    world.player.power === 'peelToss' && moved.powerCharges < world.player.powerCharges;
  if (peelUsed) peels = [...peels, tossPeel(moved, pCfg)];
  const peelSwitchRes = resolvePeelSwitches(
    peels,
    world.mechanisms.activeSwitchIds,
    level.switches ?? [],
    cfg.peel,
  );
  peels = peelSwitchRes.peels;
  const peelRes = resolvePeels(peels, steppedEnemies, cfg.peel);
  peels = peelRes.peels.filter((pr) => pr.alive);
  const enemiesAfterPeel = peelRes.enemies;

  // Combat: squish mobs / damage the boss by stomp or swing; a non-killing body contact hurts.
  const combat = resolveCombat(moved, enemiesAfterPeel, pCfg);
  const enemies = combat.enemies;
  const bossCombat = steppedBoss && bossCfg ? resolveBoss(moved, steppedBoss, pCfg, bossCfg) : null;
  const boss = bossCombat ? bossCombat.boss : null;
  const teamCombat = steppedTeam && teamCfgs
    ? royaleRing
      ? resolveRoyale(moved, steppedTeam, pCfg, teamCfgs, royaleRing, world.crewCharges !== undefined)
      : resolveTeamBoss(moved, steppedTeam, pCfg, teamCfgs)
    : null;
  let teamBoss = teamCombat ? teamCombat.teamBoss : null;

  // Wheat boxes: a live swing or a stomp breaks the first box in reach and banks its power. A stomp
  // break bounces like a stomped mob; the power is granted onto the (post-bounce) player below.
  const boxRes = resolveWheatBoxes(moved, world.boxes, pCfg, cfg.box);
  const boxes = boxRes.boxes;

  const bounced = combat.bounced || (bossCombat?.bounced ?? false) || (teamCombat?.bounced ?? false) || boxRes.bounced;
  let player = bounced ? { ...moved, vy: -pCfg.stompBounce, onGround: false } : moved;
  // A wheat box replenishes the selected crew power. Before the first rescue it pays a score-corn
  // fallback instead of installing a short-lived replacement power.
  const boxBonus = boxRes.granted && player.power === 'none' ? 1 : 0;
  if (boxRes.granted && player.power !== 'none') player = rechargePower(player);

  // Allies: free the first caged friend the player reaches and bank its signature power.
  const allyRes = resolveAllies(moved, world.allies, pCfg, cfg.ally);
  const allies = allyRes.allies;
  let crewCharges = world.crewCharges;
  if (allyRes.granted) {
    // A freed friend joins the swappable crew at full charge; the outgoing friend keeps its count.
    if (crewCharges && allyRes.granted !== 'none') {
      crewCharges = {
        ...crewCharges,
        ...(player.power !== 'none' ? { [player.power]: player.powerCharges } : {}),
        [allyRes.granted]: POWER_UPS[allyRes.granted].maxCharges,
      };
    }
    player = grantPower(player, allyRes.granted);
  }

  const activeSwitchIds = resolveSwitches(
    moved,
    pCfg,
    peelSwitchRes.activeSwitchIds,
    level.switches ?? [],
  );
  const mechanisms = activeSwitchIds === world.mechanisms.activeSwitchIds
    ? world.mechanisms
    : { activeSwitchIds };

  // Position is unchanged by a stomp bounce (it only sets upward velocity), so the box is `moved`.
  const movedBox: Aabb = { x: moved.x, y: moved.y, w: pCfg.width, h: pCfg.height };

  // Restorative pickups: a health pickup refills the bar (only banked below full), a life pickup adds
  // a life. Resolved BEFORE the hit handling so a heal grabbed on the same frame as a hit counts first.
  const pickupRes = resolvePickups(moved, world.pickups, pCfg);
  const pickups = pickupRes.pickups;
  let lives = world.lives;
  if (pickupRes.healed) player = { ...player, health: MAX_HEALTH };
  if (pickupRes.gainedLife) lives += 1;
  // Boss Royale pop drops resolve with the pickups (before the hit ladder).
  if (teamBoss?.royale && teamBoss.royale.drops.length > 0) {
    const dropRes = resolveRoyaleDrops(player, movedBox, teamBoss);
    player = dropRes.player;
    teamBoss = dropRes.team;
  }

  // Projectiles: a live shot striking the player (resolved against `moved`, like combat/hazards)
  // hurts and shatters; shattered shots are culled so the live list never accumulates inert corn.
  // Only shots ALREADY in flight are resolved this frame; this frame's fresh lobs join the live list
  // afterward (un-resolved), so a corn always gets a telegraph + a dodge window before it can hit.
  const projResolved = resolveProjectiles(moved, steppedProjectiles, pCfg, cfg.projectile);
  const projectiles = [...projResolved.projectiles.filter((pr) => pr.alive), ...emittedCorn];
  const nutResolved = resolveProjectiles(moved, steppedNuts, pCfg, FALLING_NUT_CONFIG);
  const fallingNuts = [
    ...nutResolved.projectiles.filter((nut) => nut.alive),
    ...fallingNutsForFrame(level.nutDroppers ?? [], world.frame + 1),
  ];

  // Bank cobs the player now overlaps (economy_bounds stays in the collectible logic).
  const collected = collectStep(world.collectibles, world.score, movedBox);

  // Arm the next checkpoint(s) the player has reached — forward only, so a respawn never rewinds.
  let checkpoint = world.checkpoint;
  let respawn = world.respawn;
  for (let i = checkpoint + 1; i < level.checkpoints.length; i++) {
    if (aabbOverlap(movedBox, level.checkpoints[i]!)) {
      checkpoint = i;
      respawn = level.checkpoints[i]!.respawn;
    }
  }
  if (checkpoint > world.checkpoint) {
    if (player.power === 'leafGuard') player = rechargePower(player);
    if (crewCharges?.leafGuard !== undefined) crewCharges = { ...crewCharges, leafGuard: POWER_UPS.leafGuard.maxCharges };
  }

  // Arena win is decided BEFORE the hurt handling: a killing blow that lands on the same frame as an
  // incoming attack (a boss/leftover projectile) is a clean WIN, never a death+win — the player is not
  // sent back on the very frame they pop the boss (never cruel).
  const bossDefeated = boss !== null && boss.hp <= 0;
  const teamBossDefeated = teamBoss !== null && teamDefeated(teamBoss);
  const wonArena = bossDefeated || teamBossDefeated;

  const enemyHit = combat.hit || (bossCombat?.hit ?? false) || (teamCombat?.hit ?? false) || projResolved.hit;
  const hurt = (!invisible && enemyHit) || hazardHit(level.hazards, movedBox) || nutResolved.hit;
  const fellIntoPit = moved.y > level.height + PIT_RESPAWN_DEPTH;
  let deaths = world.deaths;
  let gameOver = false;
  if (fellIntoPit && !wonArena) {
    // A pit is a full tumble, not a three-pip contact drain. Bank one life and return to the most
    // recent safe checkpoint; shield and mercy frames intentionally cannot strand the player below
    // the world. The final life freezes on the out-of-bounds frame for the game-over handoff.
    deaths += 1;
    lives -= 1;
    if (lives <= 0) {
      gameOver = true;
      player = { ...player, health: 0 };
    } else {
      player = respawnPlayer(player, respawn);
    }
  } else if (hurt && !wonArena && player.invuln <= 0) {
    if (player.shield) {
      // The block spends the leaf; only a checkpoint or wheat box regrows it.
      player = { ...player, shield: false, powerCharges: Math.max(0, player.powerCharges - 1), powerTimer: 0, vx: -player.facing * SHIELD_KNOCKBACK_VX, vy: -SHIELD_KNOCKBACK_VY, onGround: false };
    } else if (player.health > 1) {
      // Survived: one pip off, mercy frames + a knockback so the same threat can't chain-drain.
      player = { ...player, health: player.health - 1, invuln: HURT_IFRAMES, vx: -player.facing * HIT_KNOCKBACK_VX, vy: -HIT_KNOCKBACK_VY, onGround: false };
    } else {
      // The bar emptied — a life is lost.
      deaths += 1;
      lives -= 1;
      if (lives <= 0) {
        gameOver = true; // out of lives; the player stays put for the game-over frame, no respawn
        player = { ...player, health: 0 };
      } else {
        player = respawnPlayer(player, respawn);
      }
    }
  }

  // Win condition: a popped boss/team finishes a boss arena; otherwise reaching the goal door does —
  // but never on a frame the player was hit (a death teleports them to the respawn, a shield absorb
  // knocks them back, so neither can be bounced onto the door and "win").
  const completed =
    world.completed || wonArena || (
      !hurt &&
      !fellIntoPit &&
      level.goal !== undefined &&
      allies.every((ally) => ally.freed) &&
      aabbOverlap(movedBox, level.goal)
    );

  return {
    frame: world.frame + 1,
    ...(characterId ? { characterId, switchCharacterHeld: input.switchCharacter === true } : {}),
    player,
    enemies,
    boss,
    teamBoss,
    collectibles: collected.items,
    projectiles,
    fallingNuts,
    peels,
    boxes,
    allies,
    pickups,
    mechanisms,
    ...(crewCharges ? { crewCharges } : {}),
    score: collected.score + boxBonus,
    checkpoint,
    respawn,
    deaths,
    lives,
    gameOver,
    completed,
  };
}

// FNV-1a over the COMPLETE per-frame state — every field of the player and every enemy, plus the
// frame counter. Exact floats (not rounded) so the digest changes if any field drifts by a single
// ULP: a true byte-for-byte replay anchor, not just a trajectory sketch.
function fnv1a(seed: number, s: string): number {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function frameSig(w: WorldState): string {
  const p = w.player;
  // Power state is appended only when a power is active, so a power-free run's digest is unchanged.
  // The leaf-guard flag rides here too (shield is only ever up while the leafGuard power is live).
  const pw = p.power !== 'none'
    ? `,pw:${p.power},${p.powerTimer},${p.powerCharges},${p.powerCooldown},${p.powerHeld ? 1 : 0},${p.shield ? 1 : 0}`
    : '';
  // Health/i-frames append only off-default (bar below full OR mercy frames live), so a full-health
  // run is byte-for-byte unchanged from before the health system landed.
  const hp = p.health !== MAX_HEALTH || p.invuln > 0 ? `,hp:${p.health},${p.invuln}` : '';
  const invis = p.invisibility;
  const stealth = invis ? `,iv:${invis.remaining},${invis.recharge},${invis.held ? 1 : 0},${invis.lastSeenX}` : '';
  const player = `${p.x},${p.y},${p.vx},${p.vy},${p.onGround ? 1 : 0},${p.facing},${p.coyote},${p.jumpBuffer},${p.jumpHeld ? 1 : 0},${p.attackTimer},${p.attackCooldown},${p.attackHeld ? 1 : 0}${pw}${hp}${stealth}`;
  const enemies = w.enemies.map((e) => `${e.x},${e.y},${e.vy},${e.dir},${e.patrolLeft},${e.patrolRight},${e.alive ? 1 : 0}`).join(';');
  // Squirrel throw cadence — appended only when a thrower is present, so kernel-only levels are
  // byte-for-byte unchanged. The thrown corn itself rides the projectile segment below.
  const throwers = w.enemies.filter((e) => e.kind === 'squirrel');
  const sqSeg = throwers.length ? `|S:${throwers.map((e) => e.throwTimer).join(',')}` : '';
  const cobs = w.collectibles.map((c) => (c.collected ? 1 : 0)).join('');
  // respawn coords are deliberately NOT hashed: respawn is a pure function of the (hashed)
  // checkpoint index plus immutable level data, so the checkpoint field already pins it. Likewise a
  // boss's `hopTargets` is immutable level data (constant across the fight) — not hashed; only the
  // mutable `hopIndex` (which lane it's on in the cycle) is, appended to the boss/team segments below.
  // Lives/game-over append only off-default (lives spent OR the run ended), so a no-death run is
  // byte-for-byte unchanged.
  const lv = w.lives !== INITIAL_LIVES || w.gameOver ? `,L:${w.lives},${w.gameOver ? 1 : 0}` : '';
  const meta = `${w.score},${w.checkpoint},${w.deaths},${w.completed ? 1 : 0}${lv}`;
  const base = `${w.frame}|${player}|${enemies}|${cobs}|${meta}`;
  // Boss segment is appended only in a boss arena, so non-boss level digests are unchanged. The full
  // state-machine state (mode/timer/action/attack) rides here too, so the digest pins the whole fight.
  // patrolLeft/patrolRight are ALREADY hashed here, so a hop's lane relocation is pinned for free; the
  // hop-cycle position (hopIndex) is appended only once it advances (> 0), so a non-hopper's digest is
  // byte-for-byte unchanged (the keep-untouched-digests-stable pattern — cf. pw/hp/lv above).
  const b = w.boss;
  const bossSeg = b
    ? `|${b.x},${b.y},${b.vy},${b.dir},${b.hp},${b.hitCooldown},${b.patrolLeft},${b.patrolRight},${b.mode},${b.modeTimer},${b.actionIndex},${b.attack ?? '-'}${b.hopIndex > 0 ? `,H:${b.hopIndex}` : ''}${b.assistTier > 0 ? `,A:${b.assistTier}` : ''}`
    : '';
  // Team-boss segment (each shaker, full state incl. patrol bounds + state machine — mirrors the
  // single-boss segment so the digest hashes the complete TeamBossState) — appended only in a team
  // arena, so every other level is byte-for-byte unchanged. The IDENTICAL conditional hopIndex append
  // rides here too (Pepper hops), or it would be an un-pinned determinism hole.
  const tb = w.teamBoss;
  const teamSeg = tb
    ? `|T:${tb.members.map((m) => `${m.x},${m.y},${m.vy},${m.dir},${m.hp},${m.hitCooldown},${m.patrolLeft},${m.patrolRight},${m.mode},${m.modeTimer},${m.actionIndex},${m.attack ?? '-'}${m.hopIndex > 0 ? `,H:${m.hopIndex}` : ''}${m.assistTier > 0 ? `,A:${m.assistTier}` : ''}`).join(';')}`
    : '';
  // Boss Royale ring state — appended only on the royale ring, so every other level is unchanged.
  const royaleSeg = tb?.royale ? `|R:${royaleSig(tb.royale)}` : '';
  // Projectile segment is appended only when shots are live (the list is post-cull, all alive), so
  // a projectile-free run is byte-for-byte unchanged.
  const projSeg = w.projectiles.length ? `|P:${w.projectiles.map((pr) => `${pr.x},${pr.y},${pr.vx},${pr.vy}`).join(';')}` : '';
  const nutSeg = w.fallingNuts.length ? `|N:${w.fallingNuts.map((nut) => `${nut.x},${nut.y},${nut.vx},${nut.vy}`).join(';')}` : '';
  // Peel segment (player-tossed peels) — appended only when peels are live, so a peel-free run is unchanged.
  const peelSeg = w.peels.length ? `|L:${w.peels.map((pr) => `${pr.x},${pr.y},${pr.vx},${pr.vy}`).join(';')}` : '';
  // Box segment is appended only when the level has power-up boxes, so a box-free run is unchanged.
  const boxSeg = w.boxes.length ? `|X:${w.boxes.map((b) => (b.broken ? 1 : 0)).join('')}` : '';
  // Ally segment (freed flags) — appended only when the level has allies, so an ally-free run is unchanged.
  const allySeg = w.allies.length ? `|Y:${w.allies.map((a) => (a.freed ? 1 : 0)).join('')}` : '';
  // Pickup segment (taken flags) — appended only when the level has pickups, so a pickup-free run is unchanged.
  const pickupSeg = w.pickups.length ? `|K:${w.pickups.map((p) => (p.taken ? 1 : 0)).join('')}` : '';
  const mechanismSeg = w.mechanisms.activeSwitchIds.length ? `|M:${w.mechanisms.activeSwitchIds.join(',')}` : '';
  const characterSeg = w.characterId ? `|C:${w.characterId},${w.switchCharacterHeld ? 1 : 0}` : '';
  const crew = w.crewCharges;
  const crewSeg = crew ? `|W:${(Object.keys(crew) as PowerKind[]).sort().map((power) => `${power}=${crew[power]}`).join(',')}` : '';
  return `${base}${sqSeg}${bossSeg}${teamSeg}${royaleSeg}${projSeg}${nutSeg}${peelSeg}${boxSeg}${allySeg}${pickupSeg}${mechanismSeg}${characterSeg}${crewSeg}`;
}

export interface RunResult {
  world: WorldState;
  digest: string; // 8-hex-char trajectory hash
  frames: number;
}

export function simulate(level: LevelDef, inputStream: readonly InputFrame[], cfg: WorldConfigs = DEFAULT_CONFIGS, init?: ReplayInit): RunResult {
  let world = spawnWorldFromInit(level, init);
  let h = 0x811c9dc5;
  for (const input of inputStream) {
    world = stepWorld(world, input, level, cfg);
    h = fnv1a(h, frameSig(world));
  }
  return { world, digest: (h >>> 0).toString(16).padStart(8, '0'), frames: inputStream.length };
}

// Resolve the world configs for a chosen hero — swap in that character's PlayerConfig (its feel),
// keep the shared enemy/boss/projectile configs. The plumbing seam for character-select + replays.
export function configsForCharacter(characterId: string, base: WorldConfigs = DEFAULT_CONFIGS): WorldConfigs {
  return { ...base, characterId, player: playerConfigFor(characterId) };
}

export function simulateReplay(level: LevelDef, fixture: ReplayFixture): RunResult {
  return simulate(level, fixture.inputStream, { ...configsForCharacter(fixture.characterId), canSwitchCharacters: fixture.canSwitchCharacters === true }, fixture.init);
}
