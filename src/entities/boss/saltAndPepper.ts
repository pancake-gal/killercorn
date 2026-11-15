import { type BossState, type BossConfig, spawnBoss, bossStep, resolveBoss } from './kingCorn';
import { bossConfigFor } from './configs';
import { type LevelDef, type TeamBossPlacement } from '@/entities/level/level';
import { type PlayerState, type PlayerConfig } from '@/entities/player/player';
import { type ProjectileState } from '@/entities/projectile/spikedCorn';

export interface TeamBossState {
  members: BossState[];
  royale?: RoyaleState; // present only on the Boss Royale ring (boss/royale.ts owns its rules)
}

// A pop drop waiting in the center strip (one pair at most; taking one removes both).
export interface RoyaleDrop {
  kind: 'health' | 'power';
  x: number;
  y: number;
}

// Boss Royale ring state. Every field is hashed (run.ts frameSig `R:` segment); corner placement
// (lane + hop circuit) is a pure function of `slot` and the immutable rules, so it needs no hash.
export interface RoyaleState {
  order: number[]; // ladder group indices in entry order (the shuffle reorders the middle; empty groups skipped)
  nextEntry: number; // position in `order` of the next group to enter
  slot: number[]; // per member: -1 bench (or cleared before this attempt), 0 west corner, 1 east corner
  grace: number[]; // per member: drop-in grace frames left
  sinceEntry: number; // frames since the last entry
  sincePop: number; // frames since the last pop (or the opening)
  popCredit: boolean; // a boss popped since the last entry
  quiet: number; // frames before another windup may start
  drops: RoyaleDrop[]; // the untaken pop pair ([] when none)
  entries: number; // groups entered so far (a presentation edge counter)
}

// Resolve each member's config from its placement name (parallel arrays — same order as members).
export function teamConfigsFor(p: TeamBossPlacement): BossConfig[] {
  return p.members.map((m) => bossConfigFor(m.name));
}

export function spawnTeamBoss(p: TeamBossPlacement, assistTier = 0): TeamBossState {
  // A team boss is two-or-more shakers. Guard the lower bound so a malformed empty team can't
  // auto-complete the arena (teamDefeated([]) would otherwise be vacuously true on the first step).
  if (p.members.length < 2) throw new Error(`spawnTeamBoss: team "${p.name}" needs >=2 members, got ${p.members.length}`);
  return { members: p.members.map((m) => spawnBoss(m, bossConfigFor(m.name), assistTier)) };
}

export interface TeamBossStepResult {
  team: TeamBossState;
  shots: ProjectileState[]; // corn thrown by any shaker this frame (joins world.projectiles)
}

// One fixed frame: each shaker runs the full boss state machine independently under its own config
// (configs[i] ↔ members[i]), aimed at the same player x; their thrown corn is pooled into one shot list.
export function stepTeamBoss(state: TeamBossState, configs: readonly BossConfig[], level: LevelDef, playerX: number): TeamBossStepResult {
  const shots: ProjectileState[] = [];
  const aliveMembers = state.members.filter((member) => member.hp > 0).length;
  const members = state.members.map((m, i) => {
    const cfg = configs[i]!;
    // When one shaker remains, only its neutral pacing clock speeds up. The anticipation, committed
    // attack, and recovery clocks still advance one tick per frame, preserving every fairness floor.
    const soloTicks = aliveMembers === 1 && m.hp > 0 && m.mode === 'pace' ? cfg.soloPaceTicks ?? 0 : 0;
    const steppedState = soloTicks > 0 ? { ...m, modeTimer: m.modeTimer - soloTicks } : m;
    const r = bossStep(steppedState, cfg, level, playerX);
    shots.push(...r.shots);
    return r.boss;
  });
  return { team: { members }, shots };
}

export interface TeamBossCombatResult {
  teamBoss: TeamBossState;
  bounced: boolean; // the player stomped any shaker this frame (apply the stomp bounce)
  hit: boolean; // a shaker's body hurt the player this frame (respawn) — suppressed on an attack frame
  damaged: boolean; // any shaker lost a pip this frame
}

// Resolve player ↔ team combat: each shaker runs the single-boss combat rule. A stomp/swing on a
// vulnerable shaker costs it a pip; a stomp bounces. Never cruel: a frame on which the player damaged
// OR bounced ANY shaker never also punishes them (mirrors the single boss "rising out of a stomp is
// never punished") — so cleanly stomping Salt while Pepper is adjacent doesn't double-charge a hit.
export function resolveTeamBoss(
  player: PlayerState,
  state: TeamBossState,
  pCfg: PlayerConfig,
  configs: readonly BossConfig[],
): TeamBossCombatResult {
  let bounced = false;
  let damaged = false;
  let anyHit = false;
  const members = state.members.map((m, i) => {
    const r = resolveBoss(player, m, pCfg, configs[i]!);
    if (r.bounced) bounced = true;
    if (r.damaged) damaged = true;
    if (r.hit) anyHit = true;
    return r.boss;
  });
  const hit = anyHit && !bounced && !damaged;
  return { teamBoss: { members }, bounced, hit, damaged };
}

// The team is down when every shaker is popped (the arena's win condition; a popped team is terminal).
export function teamDefeated(state: TeamBossState): boolean {
  return state.members.every((m) => m.hp <= 0);
}
