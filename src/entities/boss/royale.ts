import { type TeamBossPlacement, type RoyaleRules, type RoyaleCorner, type HopTarget, type LevelDef, type Aabb, aabbOverlap } from '@/entities/level/level';
import { Rng } from '@/core/rng';
import { type PlayerState, type PlayerConfig, MAX_HEALTH, rechargePower } from '@/entities/player/player';
import { POWER_UPS } from '@/entities/player/powerup';
import { PICKUP_CONFIG } from '@/entities/collectible/pickup';
import { spawnBoss, bossStep, resolveBoss, type BossConfig, type BossState } from './kingCorn';
import { bossConfigFor } from './configs';
import { type TeamBossState, type RoyaleState, type TeamBossStepResult, type TeamBossCombatResult } from './saltAndPepper';
import { type ProjectileState } from '@/entities/projectile/spikedCorn';

// The permanent member indices, in ladder order (mirrors BOSS_ROYALE_ARENA's members).
export const ROYALE_MEMBERS: readonly string[] = ['butterStick', 'salt', 'pepper', 'generalAcorn', 'sirPickle', 'kingCorn'];

export interface RoyaleProgress {
  cleared?: readonly string[]; // bosses popped in earlier attempts of this run (stay popped)
  shuffleSeed?: number; // present = shuffle the middle groups (Butter Stick opens, Corn King closes)
}

// Entry order of the ladder groups. Without a seed it is the authored ladder; with one, the middle
// groups are permuted by a seeded Fisher-Yates, so a retry with the same seed keeps the same order.
export function royaleOrder(rules: RoyaleRules, shuffleSeed?: number): number[] {
  const n = rules.groups.length;
  const all = Array.from({ length: n }, (_, i) => i);
  if (shuffleSeed === undefined || n < 4) return all;
  const middle = all.slice(1, n - 1);
  const rng = new Rng(shuffleSeed);
  for (let i = middle.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [middle[i], middle[j]] = [middle[j]!, middle[i]!];
  }
  return [0, ...middle, n - 1];
}

// Spawn the ring: every boss on the bench at its (assisted) starting health; cleared bosses stay
// popped; groups with nobody left are skipped. Six member indices never change.
export function spawnRoyale(p: TeamBossPlacement, assistTier = 0, progress: RoyaleProgress = {}): TeamBossState {
  const rules = p.royale;
  if (!rules) throw new Error(`spawnRoyale: team "${p.name}" has no royale rules`);
  const names = p.members.map((m) => m.name);
  const cleared = new Set(progress.cleared ?? []);
  for (const name of cleared) if (!names.includes(name)) throw new Error(`spawnRoyale: unknown royale boss "${name}"`);
  const members = p.members.map((m) => {
    const boss = spawnBoss(m, bossConfigFor(m.name), assistTier);
    return cleared.has(m.name) ? { ...boss, hp: 0 } : boss;
  });
  const order = royaleOrder(rules, progress.shuffleSeed).filter((group) =>
    rules.groups[group]!.some((name) => !cleared.has(name)),
  );
  const royale: RoyaleState = {
    order,
    nextEntry: 0,
    slot: members.map(() => -1),
    grace: members.map(() => 0),
    sinceEntry: 0,
    sincePop: 0,
    popCredit: false,
    quiet: 0,
    drops: [],
    entries: 0,
  };
  return { members, royale };
}

// The bench members of a ladder group still waiting to enter (popped members are not counted), as
// permanent member indices in the group's authored order.
export function royaleGroupMembers(team: TeamBossState, p: TeamBossPlacement, group: number): number[] {
  const names = p.members.map((m) => m.name);
  const royale = team.royale;
  return (p.royale?.groups[group] ?? [])
    .map((name) => names.indexOf(name))
    .filter((i) => i >= 0 && team.members[i]!.hp > 0 && (royale?.slot[i] ?? -1) < 0);
}

// A living boss in the ring (entered, not popped). Bench and popped members are not ring bodies.
export function inRoyaleRing(team: TeamBossState, i: number): boolean {
  return (team.royale?.slot[i] ?? -1) >= 0 && team.members[i]!.hp > 0;
}

// A ring boss that can act on the player: in the ring and past its drop-in grace.
export function royaleActive(team: TeamBossState, i: number): boolean {
  return inRoyaleRing(team, i) && (team.royale?.grace[i] ?? 0) === 0;
}

// Windup, attack, and recovery all hold the floor, so a punish window is never interrupted.
function holdsFloor(b: BossState): boolean {
  return b.mode === 'windup' || b.mode === 'attack' || b.mode === 'recover';
}

// Re-place a benched boss into a corner: lane center, high above the floor (it drops in), facing the
// center strip, with the corner's [ledge, home] hop circuit. Health and assistance carry over.
function placeInCorner(member: BossState, name: string, cfg: BossConfig, corner: RoyaleCorner, rules: RoyaleRules): BossState {
  const home: HopTarget = { patrolLeft: corner.laneLeft, patrolRight: corner.laneRight, surfaceY: corner.floorY };
  const fresh = spawnBoss({
    name,
    x: (corner.laneLeft + corner.laneRight - cfg.width) / 2,
    y: corner.floorY - cfg.height - rules.dropHeight,
    dir: corner.facing,
    patrolLeft: corner.laneLeft,
    patrolRight: corner.laneRight,
    hopTargets: [corner.ledge, home],
  }, cfg, member.assistTier);
  return { ...fresh, hp: member.hp };
}

// One fixed frame of the ring, in a fixed order:
//   1. clocks tick (since-entry, since-pop, drop-in grace);
//   2. the next ladder group enters if it fits and its trigger is met (empty ring after the breather,
//      a pop credit after the breather, or the entry timer);
//   3. ring bosses step on the shared engine. A boss about to leave pace for a windup is ADMITTED only
//      if no active ring boss holds the floor (windup/attack/recovery), the quiet gap is over, it is out
//      of grace, and nobody was admitted earlier this frame (lowest index first). Otherwise its pace
//      timer is held at 2 BEFORE the engine's decrement, so it keeps pacing and asks again next frame;
//   4. a release (the floor holder leaves recovery) starts the quiet gap; otherwise the gap counts down.
// Benched bosses never step. Popped bosses step inert (the engine zeroes their flash), like the team.
export function stepRoyale(
  team: TeamBossState,
  configs: readonly BossConfig[],
  p: TeamBossPlacement,
  level: LevelDef,
  playerX: number,
): TeamBossStepResult {
  const rules = p.royale!;
  const before = team.royale!;
  const members = team.members.slice();
  const slot = before.slot.slice();
  const grace = before.grace.map((g) => Math.max(0, g - 1));
  let { nextEntry, sinceEntry, sincePop, popCredit, quiet, entries } = before;
  sinceEntry += 1;
  sincePop += 1;

  // 2. Entry.
  const living = (i: number) => slot[i]! >= 0 && members[i]!.hp > 0;
  if (nextEntry < before.order.length) {
    const group = royaleGroupMembers({ members, royale: { ...before, slot } }, p, before.order[nextEntry]!);
    const ring = members.map((_, i) => i).filter(living);
    const breathed = sincePop >= rules.breatherFrames;
    const trigger = ring.length === 0 ? breathed : (popCredit && breathed) || sinceEntry >= rules.entryFrames;
    if (group.length > 0 && ring.length + group.length <= rules.capacity && trigger) {
      const used = new Set(ring.map((i) => slot[i]!));
      const free = [0, 1].filter((corner) => !used.has(corner));
      group.forEach((i, k) => {
        const corner = free[k]!;
        members[i] = placeInCorner(members[i]!, p.members[i]!.name, configs[i]!, rules.corners[corner as 0 | 1], rules);
        slot[i] = corner;
        grace[i] = rules.graceFrames;
      });
      nextEntry += 1;
      sinceEntry = 0;
      popCredit = false;
      entries += 1;
    }
  }

  // 3. Step with one admission per frame.
  const active = (i: number) => living(i) && grace[i] === 0;
  const floorHeld = members.some((b, i) => active(i) && holdsFloor(b));
  let admitted = false;
  const shots: ProjectileState[] = [];
  for (let i = 0; i < members.length; i++) {
    if (slot[i]! < 0) continue; // the bench never moves
    let b = members[i]!;
    if (b.hp > 0 && b.mode === 'pace' && b.modeTimer - 1 <= 0) {
      if (active(i) && !floorHeld && quiet === 0 && !admitted) admitted = true;
      else b = { ...b, modeTimer: 2 };
    }
    const r = bossStep(b, configs[i]!, level, playerX);
    members[i] = r.boss;
    shots.push(...r.shots);
  }

  // 4. Release starts the quiet gap; otherwise it counts down while the floor is free.
  const heldAfter = members.some((b, i) => active(i) && holdsFloor(b));
  if (floorHeld && !heldAfter) quiet = rules.quietFrames;
  else if (!heldAfter && quiet > 0) quiet -= 1;

  const royale: RoyaleState = { ...before, nextEntry, slot, grace, sinceEntry, sincePop, popCredit, quiet, entries };
  return { team: { members, royale }, shots };
}

// Resolve player ↔ ring combat. Only active ring bosses take part (bench and drop-in grace can neither
// hurt nor be hurt). A pop sets the pop credit, restarts the breather, opens the quiet gap, and leaves
// a fresh drop pair in the center strip (health only without a crew). The same never-cruel rule as the
// team: a frame on which the player damaged or bounced any boss never also punishes them.
export function resolveRoyale(
  player: PlayerState,
  team: TeamBossState,
  pCfg: PlayerConfig,
  configs: readonly BossConfig[],
  p: TeamBossPlacement,
  withPower: boolean,
): TeamBossCombatResult {
  const rules = p.royale!;
  let bounced = false;
  let damaged = false;
  let anyHit = false;
  let popped = false;
  const members = team.members.map((m, i) => {
    if (!royaleActive(team, i)) return m;
    const r = resolveBoss(player, m, pCfg, configs[i]!);
    if (r.bounced) bounced = true;
    if (r.damaged) damaged = true;
    if (r.hit) anyHit = true;
    if (r.boss.hp <= 0) popped = true;
    return r.boss;
  });
  const hit = anyHit && !bounced && !damaged;
  const royale: RoyaleState = popped
    ? {
        ...team.royale!,
        popCredit: true,
        sincePop: 0,
        quiet: rules.quietFrames,
        drops: [
          { kind: 'health', ...rules.drops.health },
          ...(withPower ? [{ kind: 'power' as const, ...rules.drops.power }] : []),
        ],
      }
    : team.royale!;
  return { teamBoss: { members, royale }, bounced, hit, damaged };
}

// True when a power refill would change something: a spent charge, a running cooldown, or a fallen
// leaf. A full kid (or one with no crew power) leaves the refill for later — never a wasted drop.
function refillHelps(player: PlayerState): boolean {
  if (player.power === 'none') return false;
  const spec = POWER_UPS[player.power];
  return player.powerCharges < spec.maxCharges || player.powerCooldown > 0 || (spec.grantsShield === true && !player.shield);
}

// Take a pop drop the kid is touching, if it helps (health is checked first). Taking one clears the
// pair. Resolved with the pickups, before the hit ladder, so a heal grabbed on a hit frame counts first.
export function resolveRoyaleDrops(player: PlayerState, box: Aabb, team: TeamBossState): { player: PlayerState; team: TeamBossState } {
  const royale = team.royale;
  if (!royale || royale.drops.length === 0) return { player, team };
  for (const drop of royale.drops) {
    if (!aabbOverlap(box, { x: drop.x, y: drop.y, w: PICKUP_CONFIG.width, h: PICKUP_CONFIG.height })) continue;
    if (drop.kind === 'health' && player.health < MAX_HEALTH) {
      return { player: { ...player, health: MAX_HEALTH }, team: { ...team, royale: { ...royale, drops: [] } } };
    }
    if (drop.kind === 'power' && refillHelps(player)) {
      return { player: rechargePower(player), team: { ...team, royale: { ...royale, drops: [] } } };
    }
  }
  return { player, team };
}

// The royale digest segment: every mutable field, in a fixed order.
export function royaleSig(r: RoyaleState): string {
  const drops = r.drops.map((d) => `${d.kind === 'health' ? 'h' : 'p'}${d.x},${d.y}`).join('.');
  return `${r.order.join('.')},${r.nextEntry},${r.slot.join('.')},${r.grace.join('.')},${r.sinceEntry},${r.sincePop},${r.popCredit ? 1 : 0},${r.quiet},${drops},${r.entries}`;
}
