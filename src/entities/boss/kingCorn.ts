import { moveAabb, aabbOverlap, type Aabb, type LevelDef, type BossPlacement, type HopTarget } from '@/entities/level/level';
import { type PlayerState, type PlayerConfig } from '@/entities/player/player';
import { swingHitbox } from '@/entities/combat';
import { type ProjectileState, spawnProjectile, SPIKED_CORN_CONFIG } from '@/entities/projectile/spikedCorn';
import {
  assistedBossHp,
  BOSS_ASSIST_RECOVERY_FRAMES_PER_TIER,
  clampBossAssistTier,
} from './assist';

export { BOSS_ASSIST_RECOVERY_FRAMES_PER_TIER } from './assist';

// The attacks a boss can throw. A phase lists which ones it rotates through. `hop` is a TRAVERSAL
// move: a telegraphed leap to an authored waypoint that relocates the whole patrol lane (mobility
// without ever chasing the player — the lane moves, not toward the player, only to fixed waypoints).
export type BossAttack = 'lob' | 'dash' | 'slam' | 'hop';
// The state-machine mode. pace = patrol (open); windup = telegraph (guarded); attack = the move
// (guarded, and a dash/slam body is dangerous); recover = the open stun window after a move.
export type BossMode = 'pace' | 'windup' | 'attack' | 'recover';

export interface BossLobShot {
  delayFrames: number; // fixed offset from the committed release frame (0 = release immediately)
  speedMul: number; // horizontal-speed multiplier; direction stays locked from the windup
  liftMul: number; // upward-velocity multiplier; larger values make a higher, longer arc
}

export interface BossSlamShot {
  vxMul: number;
  vy: number;
}

export interface BossAttackProfile {
  windupFrames?: number; // override the phase's generic anticipation for this move
  activeFrames?: number; // fixed committed duration for lob/dash/slam (hop derives its airtime)
  recoverFrames?: number; // override the phase's generic open punish window for this move
  // An authored, deterministic volley. The boss commits to the direction chosen during windup, so
  // later shots never track a dodging player. Omitted/empty keeps the original single-corn throw.
  lobShots?: readonly BossLobShot[];
  // The landing burst. Omitted/empty keeps the original four-corn fan and its safe center pocket.
  slamFan?: readonly BossSlamShot[];
}

// One phase of a fight: how the boss behaves while its hp fraction is ABOVE `aboveHpFrac`. Phases are
// listed DESCENDING (the last is the 0 floor), so a boss escalates as it loses pips.
export interface BossPhase {
  aboveHpFrac: number; // active while hp/maxHp > this; the last phase uses 0 (always matches when alive)
  paceSpeed: number; // px/frame while pacing in this phase
  paceFrames: number; // frames to pace before the next attack (the cadence)
  windupFrames: number; // telegraph length before the attack lands (the tell + the guard window)
  recoverFrames: number; // the open, vulnerable window after the attack
  attacks: readonly BossAttack[]; // the attack rotation; [] = a pure pacer this phase
  guardWhilePacing: boolean; // true = armored even while pacing (open ONLY on recover — hardest)
  attackProfiles?: Partial<Record<BossAttack, BossAttackProfile>>; // attack-specific authored rhythm
  rage?: boolean; // the desperate last-pip phase (King Corn). Presentation/FX read it (a hot flush +
  // roar + tremble); the SIM behavior IS just this phase's tuning — so rage adds NO new BossState and
  // nothing to frameSig. A tantrum, not a terror: the tells stay above the fairness floors.
}

export interface BossConfig {
  width: number;
  height: number;
  gravity: number;
  maxFall: number;
  maxHp: number;
  hitCooldownFrames: number; // invulnerability + flash frames after each hit
  stompBand: number; // how far below the head a falling player still counts as a stomp
  openingPaceFrames?: number; // optional first-attack offset (used to stage deterministic team tells)
  soloPaceTicks?: number; // extra pace-timer ticks/frame when this boss is the last team member standing
  // Attack tunables (shared across this boss's phases):
  dashSpeed: number; // px/frame while dashing
  lobSpeed: number; // horizontal speed of a lobbed corn (toward the player)
  lobLob: number; // initial upward velocity of a lobbed corn (negative = up)
  slamJump: number; // initial upward velocity of the slam leap (negative = up)
  hopJump: number; // initial upward velocity of a hop leap (negative = up). Present on every config
  // (even non-hoppers, for config-shape consistency — like dashSpeed on a boss that never dashes);
  // horizontal hop speed is COMPUTED (dx / remaining airtime), not authored.
  phases: readonly BossPhase[];
}

const HOP_VX_CAP = 6;
// Safety ceiling on a hop's airtime (frames). moveAabb's floor-safety guarantees a landing well
// before this; the cap only bounds the airtime search for a mis-authored (unreachable) surface.
const HOP_MAX = 120;

// Frames of airtime for a hop from `bottom0` (the body's bottom at launch) to `surfaceY`, integrating
// the exact vertical trajectory the sim produces: vy launches at `hopJump`, then rides gravity each
// frame (capped at maxFall). Returns the first frame the body's bottom is at-or-below the surface
// while falling — a pure, integer-frame loop (no rng), so the hop's `modeTimer` matches its arc.
function hopAirtime(bottom0: number, surfaceY: number, cfg: BossConfig): number {
  let vy = cfg.hopJump;
  let bottom = bottom0;
  for (let t = 1; t <= HOP_MAX; t++) {
    if (t > 1) vy = Math.min(vy + cfg.gravity, cfg.maxFall);
    bottom += vy;
    if (vy > 0 && bottom >= surfaceY) return t; // first descending frame at/under the surface
  }
  return HOP_MAX;
}

const clampNum = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

// Fixed attack-mode durations (frames). A dash/slam also ends early on a wall / patrol edge / landing.
const LOB_ACTIVE = 10; // the throw pose holds this long after a lob releases, then recover
const DASH_MAX = 80; // safety cap on a dash (it normally ends at a wall or the lane edge first)
const SLAM_MAX = 100; // safety cap on a slam's airtime (it normally ends on landing first)

// The slam shockwave: on landing, a fan of corn bursts up-and-out to both sides. vx is scaled by the
// boss's lobSpeed (so each boss's burst keeps its flavor); vy is a fixed upward pop so it arcs.
const SLAM_FAN: readonly BossSlamShot[] = [
  { vxMul: -1.5, vy: -7 },
  { vxMul: -0.8, vy: -9 },
  { vxMul: 0.8, vy: -9 },
  { vxMul: 1.5, vy: -7 },
];

const DEFAULT_LOB_SHOTS: readonly BossLobShot[] = [{ delayFrames: 0, speedMul: 1, liftMul: 1 }];

function lobShotsFor(ph: BossPhase): readonly BossLobShot[] {
  const authored = ph.attackProfiles?.lob?.lobShots;
  return authored && authored.length > 0 ? authored : DEFAULT_LOB_SHOTS;
}

function lobActiveFrames(ph: BossPhase): number {
  return Math.max(ph.attackProfiles?.lob?.activeFrames ?? LOB_ACTIVE, ...lobShotsFor(ph).map((shot) => shot.delayFrames + LOB_ACTIVE));
}

function slamFanFor(ph: BossPhase): readonly BossSlamShot[] {
  const authored = ph.attackProfiles?.slam?.slamFan;
  return authored && authored.length > 0 ? authored : SLAM_FAN;
}

export interface ResolvedBossAttackProfile {
  windupFrames: number;
  activeFrames: number;
  recoverFrames: number;
}

// Resolve one move's rhythm without mutating state. Presentation also reads this so the visual coil
// and settle stay aligned with the simulation when a move overrides the phase-wide defaults.
export function attackProfileFor(ph: BossPhase, attack: BossAttack | null): ResolvedBossAttackProfile {
  const profile = attack ? ph.attackProfiles?.[attack] : undefined;
  const fallbackActive = attack === 'lob' ? lobActiveFrames(ph) : attack === 'dash' ? DASH_MAX : SLAM_MAX;
  return {
    windupFrames: profile?.windupFrames ?? ph.windupFrames,
    activeFrames: attack === 'lob' ? lobActiveFrames(ph) : profile?.activeFrames ?? fallbackActive,
    recoverFrames: profile?.recoverFrames ?? ph.recoverFrames,
  };
}

export const KING_CORN_CONFIG: BossConfig = {
  width: 80,
  height: 88,
  gravity: 0.7,
  maxFall: 14,
  maxHp: 5,
  hitCooldownFrames: 30,
  stompBand: 26,
  dashSpeed: 5.5,
  lobSpeed: 4,
  lobLob: -8,
  slamJump: -12,
  hopJump: -17,
  phases: [
    { aboveHpFrac: 0.66, paceSpeed: 1.4, paceFrames: 138, windupFrames: 42, recoverFrames: 70, attacks: ['lob'], guardWhilePacing: true },
    { aboveHpFrac: 0.33, paceSpeed: 1.9, paceFrames: 106, windupFrames: 34, recoverFrames: 68, attacks: ['lob', 'dash', 'hop'], guardWhilePacing: true },
    {
      aboveHpFrac: 0,
      paceSpeed: 3.0,
      paceFrames: 64,
      windupFrames: 24,
      recoverFrames: 60,
      attacks: ['hop', 'dash', 'lob', 'slam'],
      guardWhilePacing: true,
      attackProfiles: {
        lob: {
          lobShots: [
            { delayFrames: 0, speedMul: 0.78, liftMul: 0.8 },
            { delayFrames: 6, speedMul: 1.08, liftMul: 1.12 },
            { delayFrames: 12, speedMul: 1.28, liftMul: 1.45 },
          ],
        },
        slam: {
          windupFrames: 36,
          recoverFrames: 84,
          slamFan: [
            { vxMul: -1.9, vy: -6 },
            { vxMul: -1.2, vy: -8 },
            { vxMul: -0.62, vy: -10 },
            { vxMul: 0.62, vy: -10 },
            { vxMul: 1.2, vy: -8 },
            { vxMul: 1.9, vy: -6 },
          ],
        },
      },
      rage: true,
    },
  ],
};

export interface BossState {
  x: number;
  y: number;
  vy: number;
  dir: 1 | -1;
  hp: number;
  assistTier: number; // full-wipe second wind chosen at spawn; hashed whenever nonzero
  hitCooldown: number; // i-frames remaining (>0 = flashing, invulnerable)
  patrolLeft: number;
  patrolRight: number;
  mode: BossMode;
  modeTimer: number; // frames remaining in the current mode
  actionIndex: number; // index into the active phase's attack rotation for the NEXT attack
  attack: BossAttack | null; // the attack being performed (windup → attack → recover), else null
  hopIndex: number; // position in the hop-target cycle (increments on each landing). HASHED
  // (conditionally — frameSig appends it only when > 0, so a non-hopper's digest is unchanged).
  hopTargets: readonly HopTarget[]; // the boss's hop circuit, copied from the placement at spawn so
  // bossStep needs no level lookup (immutable level data riding on state, like patrolLeft). NOT hashed
  // — it's constant across the fight (same rationale as the respawn-coords note in frameSig).
}

// The phase governing the boss at its current hp (first match scanning high→low; the 0-floor catches
// the rest while alive). Pure read of hp + config.
export function activePhase(boss: BossState, cfg: BossConfig): BossPhase {
  // Retry assistance trims durability, but does not drop the boss straight into a harder late phase.
  // Phase thresholds therefore use the assisted starting durability as their denominator.
  const frac = boss.hp / assistedBossHp(cfg.maxHp, boss.assistTier);
  for (const ph of cfg.phases) if (frac > ph.aboveHpFrac) return ph;
  return cfg.phases[cfg.phases.length - 1]!;
}

// Spawn a boss from its placement + config (hp seeded from maxHp; starts pacing in its first phase).
// Generalized so every field boss reuses this one engine — only the config (and art) differ.
export function spawnBoss(p: BossPlacement, cfg: BossConfig, requestedAssistTier = 0): BossState {
  const assistTier = clampBossAssistTier(requestedAssistTier);
  return {
    x: p.x,
    y: p.y,
    vy: 0,
    dir: p.dir,
    hp: assistedBossHp(cfg.maxHp, assistTier),
    assistTier,
    hitCooldown: 0,
    patrolLeft: p.patrolLeft,
    patrolRight: p.patrolRight,
    mode: 'pace',
    modeTimer: cfg.openingPaceFrames ?? cfg.phases[0]!.paceFrames,
    actionIndex: 0,
    attack: null,
    hopIndex: 0,
    hopTargets: p.hopTargets ?? [], // empty ⇒ a grounded boss (never picks a hop; today's behavior)
  };
}

export function bossRecoveryFramesFor(boss: BossState, ph: BossPhase, attack: BossAttack | null): number {
  return attackProfileFor(ph, attack).recoverFrames
    + boss.assistTier * BOSS_ASSIST_RECOVERY_FRAMES_PER_TIER;
}

export function bossBox(boss: BossState, cfg: BossConfig = KING_CORN_CONFIG): Aabb {
  return { x: boss.x, y: boss.y, w: cfg.width, h: cfg.height };
}

// True while the boss is GUARDING — blows are deflected. It guards through its wind-up tell and the
// attack itself; a `guardWhilePacing` phase also guards while pacing (open only on recover).
function bossArmored(boss: BossState, ph: BossPhase): boolean {
  if (boss.mode === 'windup' || boss.mode === 'attack') return true;
  if (boss.mode === 'pace' && ph.guardWhilePacing) return true;
  return false;
}

// True when a stomp or a swing this frame can cost the boss a pip: alive, not flashing, and OPEN
// (pacing without a guard, or recovering). The defensive posture — you strike in the openings.
export function bossVulnerable(boss: BossState, cfg: BossConfig): boolean {
  if (boss.hp <= 0 || boss.hitCooldown > 0) return false;
  return !bossArmored(boss, activePhase(boss, cfg));
}

// True when the boss's BODY hurts the player on contact this frame: while pacing at full menace, or
// while a dash/slam/hop is live. Never while flashing (no post-stomp punish), winding up, or
// recovering. A hop is airborne like a slam — a telegraphed cannonball toward an authored landing
// zone, so it's dangerous in flight (armored) and fair (the destination is fixed, never the player).
export function bossBodyDangerous(boss: BossState): boolean {
  if (boss.hp <= 0 || boss.hitCooldown > 0) return false;
  if (boss.mode === 'pace') return true;
  if (boss.mode === 'attack' && (boss.attack === 'dash' || boss.attack === 'slam' || boss.attack === 'hop')) return true;
  return false;
}

export interface BossStepResult {
  boss: BossState;
  shots: ProjectileState[]; // corn the boss threw this frame (lob / slam burst); joins world.projectiles
}

// One fixed frame of the boss state machine + motion. Pure given (state, cfg, level, playerX): the
// player's x aims the lobs and points the dash, but PACE stays a fixed lane patrol and a HOP travels
// only to an authored waypoint (never the player), so a player parked just outside the lane is never
// chased into a corner — never cruel. A hop is the one mode exempt from the lane clamp (the lane is
// relocating); on landing the boss adopts the target's lane and advances the hop cycle. Defeated = inert.
export function bossStep(state: BossState, cfg: BossConfig, level: LevelDef, playerX: number): BossStepResult {
  if (state.hp <= 0) return { boss: { ...state, hitCooldown: 0, vy: 0 }, shots: [] };

  const ph = activePhase(state, cfg);
  const shots: ProjectileState[] = [];
  const centerX = state.x + cfg.width / 2;
  const half = SPIKED_CORN_CONFIG.width / 2;
  const releaseLobShotsAt = (elapsedFrames: number): void => {
    for (const shot of lobShotsFor(ph)) {
      if (shot.delayFrames !== elapsedFrames) continue;
      shots.push(spawnProjectile(centerX - half, state.y, dir * cfg.lobSpeed * shot.speedMul, cfg.lobLob * shot.liftMul));
    }
  };

  let mode = state.mode;
  let modeTimer = state.modeTimer - 1;
  let actionIndex = state.actionIndex;
  let attack = state.attack;
  let dir = state.dir;
  // The patrol lane + hop-cycle position ride out unchanged except on a hop LANDING, where the boss
  // adopts the target's lane (mobility = the lane relocates, via telegraphed hops only).
  let patrolLeft = state.patrolLeft;
  let patrolRight = state.patrolRight;
  let hopIndex = state.hopIndex;
  const hopTarget = state.hopTargets.length > 0 ? state.hopTargets[state.hopIndex % state.hopTargets.length]! : null;
  const hitCooldown = Math.max(0, state.hitCooldown - 1);

  // Motion intents for this frame (resolved by moveAabb below).
  let vx = 0;
  let vy = Math.min(state.vy + cfg.gravity, cfg.maxFall);

  // --- State machine: pre-move intents + transitions that don't need the move result ---
  if (mode === 'pace') {
    // Patrol toward dir; turn at the lane edges (walls handled after the move).
    if (state.x <= state.patrolLeft && dir < 0) dir = 1;
    if (state.x + cfg.width >= state.patrolRight && dir > 0) dir = -1;
    vx = dir * ph.paceSpeed;
    if (modeTimer <= 0) {
      if (ph.attacks.length > 0) {
        attack = ph.attacks[actionIndex % ph.attacks.length]!;
        // Defensive: a `hop` on a boss with no authored circuit leaps in place as a slam — telegraphed,
        // never a soft-lock (mirrors the no-kind fallback below). Shipped hoppers always carry targets.
        if (attack === 'hop' && hopTarget === null) attack = 'slam';
        actionIndex += 1;
        mode = 'windup';
        modeTimer = attackProfileFor(ph, attack).windupFrames;
        vx = 0; // plant for the telegraph
      } else {
        modeTimer = ph.paceFrames; // a pure-pacer phase just keeps pacing
      }
    }
  } else if (mode === 'windup') {
    // Hold and telegraph. A hop faces its authored TARGET (an honest tell — he looks where he'll
    // leap, not at the player); every other attack faces the player so the launch aims true.
    if (attack === 'hop' && hopTarget !== null) {
      dir = (hopTarget.patrolLeft + hopTarget.patrolRight) / 2 >= centerX ? 1 : -1;
    } else {
      dir = playerX >= centerX ? 1 : -1;
    }
    vx = 0;
    if (modeTimer <= 0) {
      mode = 'attack';
      if (attack === 'lob') {
        modeTimer = attackProfileFor(ph, attack).activeFrames;
        releaseLobShotsAt(0); // the first authored shot releases on the committed attack frame
      } else if (attack === 'dash') {
        modeTimer = attackProfileFor(ph, attack).activeFrames;
        vx = dir * cfg.dashSpeed;
      } else if (attack === 'hop' && hopTarget !== null) {
        vy = cfg.hopJump; // BOING — the leap. Airtime is the exact arc from here to the target surface.
        modeTimer = hopAirtime(state.y + cfg.height, hopTarget.surfaceY, cfg);
      } else {
        modeTimer = attackProfileFor(ph, attack).activeFrames;
        vy = cfg.slamJump; // leap
      }
    }
  } else if (mode === 'attack') {
    if (attack === 'dash') vx = dir * cfg.dashSpeed; // keep dashing (completion handled post-move)
    else if (attack === 'lob') releaseLobShotsAt(lobActiveFrames(ph) - modeTimer);
    else if (attack === 'hop' && hopTarget !== null) {
      // Self-correcting horizontal drive: aim the remaining lateral distance across the remaining
      // airtime, capped. A mid-air bonk (moveAabb zeroes a substep's vx) is recovered next frame — no
      // stored velocity, so the boss converges on the target column regardless.
      const targetCenter = (hopTarget.patrolLeft + hopTarget.patrolRight) / 2;
      vx = clampNum((targetCenter - centerX) / Math.max(1, modeTimer), -HOP_VX_CAP, HOP_VX_CAP);
    }
    // lob/slam carry no horizontal intent; slam rides gravity from its leap velocity.
  } else {
    // recover: stand open, then resume pacing.
    vx = 0;
    if (modeTimer <= 0) {
      mode = 'pace';
      modeTimer = ph.paceFrames;
      attack = null;
    }
  }

  // --- Move ---
  const moved = moveAabb({ x: state.x, y: state.y, w: cfg.width, h: cfg.height }, vx, vy, level);
  let x = moved.x;
  const y = moved.y;
  let vyOut = moved.vy;

  // --- Post-move: lane clamp, wall turns, attack completion ---
  if (mode === 'pace') {
    if (moved.hitWall) dir = (dir * -1) as 1 | -1;
    x = Math.min(Math.max(x, state.patrolLeft), state.patrolRight - cfg.width);
  } else if (mode === 'attack' && attack === 'dash') {
    const atEdge = x <= state.patrolLeft || x + cfg.width >= state.patrolRight;
    x = Math.min(Math.max(x, state.patrolLeft), state.patrolRight - cfg.width);
    if (moved.hitWall || atEdge || modeTimer <= 0) {
      mode = 'recover';
      modeTimer = bossRecoveryFramesFor(state, ph, attack);
    }
  } else if (mode === 'attack' && attack === 'slam') {
    x = Math.min(Math.max(x, state.patrolLeft), state.patrolRight - cfg.width);
    if (moved.onGround) {
      const burstCenter = x + cfg.width / 2;
      for (const f of slamFanFor(ph)) shots.push(spawnProjectile(burstCenter - half, y, f.vxMul * cfg.lobSpeed, f.vy));
      mode = 'recover';
      modeTimer = bossRecoveryFramesFor(state, ph, attack);
      vyOut = 0;
    } else if (modeTimer <= 0) {
      mode = 'recover'; // safety: never hang in the air
      modeTimer = bossRecoveryFramesFor(state, ph, attack);
    }
  } else if (mode === 'attack' && attack === 'lob') {
    if (modeTimer <= 0) {
      mode = 'recover';
      modeTimer = bossRecoveryFramesFor(state, ph, attack);
    }
  } else if (mode === 'attack' && attack === 'hop') {
    // In transit between lanes — the ONE mode exempt from the lane clamp (the lane itself is moving).
    if (moved.onGround && hopTarget !== null) {
      // Landed: adopt the target's lane (mobility = the lane relocates) and clamp into it — a ≤few-px
      // seatbelt scoot in the worst bonk case (the reachability test proves shipped circuits land
      // in-lane, so this is a seatbelt, never a teleport). Advance the cycle and drop OPEN to recover.
      patrolLeft = hopTarget.patrolLeft;
      patrolRight = hopTarget.patrolRight;
      x = Math.min(Math.max(x, patrolLeft), patrolRight - cfg.width);
      hopIndex = state.hopIndex + 1;
      mode = 'recover';
      modeTimer = bossRecoveryFramesFor(state, ph, attack);
      vyOut = 0;
    } else if (modeTimer <= 0) {
      // Safety (unreachable in practice — moveAabb's floor guarantees grounding): recover in place,
      // keep the old lane, don't advance the cycle. Mirrors the slam's never-hang-in-the-air safety.
      mode = 'recover';
      modeTimer = bossRecoveryFramesFor(state, ph, attack);
    }
  } else if (mode === 'attack') {
    // Defensive: an attack with no kind (only reachable from a hand-authored / deserialized state —
    // the engine always sets `attack` before entering this mode) must never hang armored. Drop to the
    // open recover window so the boss can't soft-lock the fight.
    mode = 'recover';
    modeTimer = bossRecoveryFramesFor(state, ph, attack);
  }

  return { boss: { ...state, x, y, vy: vyOut, dir, hitCooldown, mode, modeTimer, actionIndex, attack, patrolLeft, patrolRight, hopIndex }, shots };
}

export interface BossCombatResult {
  boss: BossState;
  bounced: boolean; // the player stomped the boss this frame (apply the stomp bounce)
  hit: boolean; // the boss's body / a live attack hurt the player this frame (respawn)
  damaged: boolean; // the boss lost a pip this frame
}

// Resolve one frame of player↔boss combat. A stomp or a swing while the boss is OPEN (vulnerable)
// costs a pip and starts the flash; a stomp always bounces (even off a guard, so the player is never
// stuck atop it). Body contact hurts only while the boss's body is dangerous (pacing, or a live
// dash/slam) — striking or rising out of the open boss is never punished (never cruel).
export function resolveBoss(player: PlayerState, boss: BossState, pCfg: PlayerConfig, bCfg: BossConfig): BossCombatResult {
  if (boss.hp <= 0) return { boss, bounced: false, hit: false, damaged: false };

  const pBox: Aabb = { x: player.x, y: player.y, w: pCfg.width, h: pCfg.height };
  const feet = player.y + pCfg.height;
  const bBox = bossBox(boss, bCfg);
  const hb = swingHitbox(player, pCfg);

  const swung = !!hb && aabbOverlap(hb, bBox);
  const body = aabbOverlap(pBox, bBox);
  const stomp = player.vy > 0 && body && feet <= bBox.y + bCfg.stompBand;

  if (bossVulnerable(boss, bCfg) && (swung || stomp)) {
    return { boss: { ...boss, hp: boss.hp - 1, hitCooldown: bCfg.hitCooldownFrames }, bounced: stomp, hit: false, damaged: true };
  }
  // No damage (guarded, or no contact). A stomp still bounces harmlessly off the guard; otherwise a
  // dangerous body hurts the player.
  if (stomp) return { boss, bounced: true, hit: false, damaged: false };
  if (body && bossBodyDangerous(boss)) return { boss, bounced: false, hit: true, damaged: false };
  return { boss, bounced: false, hit: false, damaged: false };
}
