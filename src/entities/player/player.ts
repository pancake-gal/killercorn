import { type InputFrame } from '@/core/replay';
import { moveAabb, type LevelDef } from '@/entities/level/level';
import { surfaceGripAt } from '@/entities/level/mechanics';
import { type PowerKind, POWER_UPS, powerConfig } from './powerup';

export interface PlayerConfig {
  width: number;
  height: number;
  runAccel: number; // px / frame^2, while a direction is held
  runDecel: number; // px / frame^2, while no direction is held
  maxRun: number; // px / frame
  gravity: number; // px / frame^2
  maxFall: number; // px / frame terminal velocity
  jumpV: number; // initial jump velocity (negative = up)
  coyoteFrames: number; // grace frames to still jump after leaving a ledge
  jumpBufferFrames: number; // grace frames to honor a jump pressed just before landing
  jumpCut: number; // vy multiplier when jump is released while rising (variable height)
  // Swing attack — character-agnostic for now; only the sprite (hoe / rake / shovel) varies per
  // character later (gated on art). The mechanic is shared by every kid.
  swingReach: number; // px the weapon hitbox extends in front of the player
  swingHeight: number; // px tall the weapon hitbox is, centered on the body
  swingFrames: number; // frames the hitbox stays live per swing
  swingCooldown: number; // frames after a swing before another can start
  stompBounce: number; // upward velocity after squishing an enemy by stomping it
  canTurnInvisible?: boolean;
}

export const MAX_HEALTH = 3;
export const INVISIBILITY_FRAMES = 30 * 60;
// Berry Rush: a level dash at this speed for the first frames of its cooldown (UX review #11; the
// one-frame 8.6 flick it replaces added about 4 px).
const BERRY_DASH_SPEED = 9;
const BERRY_DASH_FRAMES = 8;
const BERRY_DASH_COOLDOWN = 12;

// Fred's feel. Every field is a knob the build-path's "jump-feel tunable" gate exercises.
export const FRED_CONFIG: PlayerConfig = {
  width: 36,
  height: 52,
  runAccel: 0.6,
  runDecel: 0.8,
  maxRun: 4.2,
  gravity: 0.7,
  maxFall: 14,
  jumpV: -12.5,
  coyoteFrames: 6,
  jumpBufferFrames: 6,
  jumpCut: 0.5,
  swingReach: 44,
  swingHeight: 44,
  swingFrames: 10,
  swingCooldown: 4,
  stompBounce: 9,
};

export interface PlayerState {
  invisibility?: { remaining: number; recharge: number; held: boolean; lastSeenX: number };
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  facing: 1 | -1;
  coyote: number; // frames of coyote time remaining
  jumpBuffer: number; // frames a buffered jump stays live
  jumpHeld: boolean; // jump down last frame (rising-edge + variable-height detection)
  attackTimer: number; // frames of live swing hitbox remaining (>0 = weapon can squish)
  attackCooldown: number; // frames until the next swing can start
  attackHeld: boolean; // attack down last frame (rising-edge detection)
  power: PowerKind; // active power-up overlay ('none' = base feel); see powerup.ts
  powerTimer: number; // legacy cornpop frames; rescued crew powers keep this at 0 and never expire
  powerCharges: number; // player-controlled uses remaining for the selected crew power
  powerCooldown: number; // fixed frames until another active use may start
  powerHeld: boolean; // crew-power button last frame (rising-edge detection)
  shield: boolean; // lettuce's leaf guard is up — the next hit is absorbed (world stepper), not fatal
  health: number; // hit-points left in this life's bar; a hit drains one, 0 = lose a life (run.ts)
  invuln: number; // mercy i-frames after a non-fatal hit/respawn — hits are ignored while >0
}

// Clean spawn state at an explicit position — used for the level spawn and for checkpoint respawn
// after a hazard hit. Always a fresh, at-rest body (no carried momentum or buffered input).
export function spawnPlayerAt(x: number, y: number): PlayerState {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    onGround: false,
    facing: 1,
    coyote: 0,
    jumpBuffer: 0,
    jumpHeld: false,
    attackTimer: 0,
    attackCooldown: 0,
    attackHeld: false,
    power: 'none', // bare spawn state; world/session creation reapplies the selected crew power
    powerTimer: 0,
    powerCharges: 0,
    powerCooldown: 0,
    powerHeld: false,
    shield: false, // a fresh body carries no guard either
    health: MAX_HEALTH, // a fresh life spawns with a full bar
    invuln: 0, // no mercy frames on a clean spawn (a life-loss respawn arms them in run.ts)
  };
}

export function spawnPlayer(level: LevelDef): PlayerState {
  return spawnPlayerAt(level.spawn.x, level.spawn.y);
}

function approach(value: number, target: number, step: number): number {
  if (value < target) return Math.min(value + step, target);
  if (value > target) return Math.max(value - step, target);
  return value;
}

// One fixed frame. Order matters for replay-stability; do not reorder without re-baselining.
export function playerStep(state: PlayerState, input: InputFrame, cfg: PlayerConfig, level: LevelDef): PlayerState {
  let { vx, vy, facing } = state;

  // The power-up governing THIS frame is the incoming one. ecfg overlays its knobs on the base
  // character config, so every physics read below uses the powered feel (not just a flag). The
  // timer is ticked at the END of the step (for the next frame), so a power granted with
  // durationFrames=N gets exactly N powered frames — no off-by-one.
  const ecfg = powerConfig(cfg, state.power);
  const surfaceGrip = surfaceGripAt(state, ecfg, level);

  // Horizontal: accelerate toward the held direction, decelerate to rest otherwise.
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir !== 0) {
    vx = approach(vx, dir * ecfg.maxRun, ecfg.runAccel * surfaceGrip);
    facing = dir > 0 ? 1 : -1;
  } else {
    vx = approach(vx, 0, ecfg.runDecel * surfaceGrip);
  }

  // Coyote time counts down from the last grounded frame; buffer latches a fresh press.
  let coyote = state.onGround ? ecfg.coyoteFrames : Math.max(0, state.coyote - 1);
  const pressedJump = input.jump && !state.jumpHeld;
  let jumpBuffer = pressedJump ? ecfg.jumpBufferFrames : Math.max(0, state.jumpBuffer - 1);

  // Jump fires when a buffered press meets available coyote time.
  if (jumpBuffer > 0 && coyote > 0) {
    vy = ecfg.jumpV;
    jumpBuffer = 0;
    coyote = 0;
  }
  // Variable height: cut the ascent once, on the frame jump is RELEASED while still rising
  // (release edge). Checking `!input.jump` alone would damp every un-held rising frame, which
  // crushes a tap far below one clean cut.
  if (state.jumpHeld && !input.jump && vy < 0) {
    vy *= ecfg.jumpCut;
  }

  // Swing attack: a fresh press starts a swing if the weapon is idle and off cooldown. The live
  // hitbox itself is resolved against enemies in the world stepper (run.ts swingHitbox).
  const pressedAttack = input.attack && !state.attackHeld;
  let attackTimer = Math.max(0, state.attackTimer - 1);
  let attackCooldown = Math.max(0, state.attackCooldown - 1);
  if (pressedAttack && attackTimer === 0 && attackCooldown === 0) {
    attackTimer = ecfg.swingFrames;
    attackCooldown = ecfg.swingFrames + ecfg.swingCooldown;
  }

  let invisibility: PlayerState['invisibility'];
  if (cfg.canTurnInvisible || state.invisibility) {
    const previous = state.invisibility ?? { remaining: 0, recharge: 0, held: false, lastSeenX: state.x + cfg.width / 2 };
    const leavingInvisible = !cfg.canTurnInvisible && previous.remaining > 0;
    const remaining = leavingInvisible ? 0 : Math.max(0, previous.remaining - 1);
    const recharge = leavingInvisible || previous.remaining === 1 ? INVISIBILITY_FRAMES : Math.max(0, previous.recharge - 1);
    const activate = cfg.canTurnInvisible && input.ability === true && !previous.held && previous.remaining === 0 && recharge === 0;
    invisibility = {
      remaining: activate ? INVISIBILITY_FRAMES : remaining,
      recharge,
      held: input.ability === true,
      lastSeenX: activate ? state.x + cfg.width / 2 : previous.lastSeenX,
    };
  }

  let powerCharges = state.powerCharges;
  let powerCooldown = Math.max(0, state.powerCooldown - 1);
  // Berry Rush keeps dashing for the first BERRY_DASH_FRAMES of its cooldown while still moving the way
  // the kid faces (a wall or a knockback ends it), so one press carries the kid instead of a flick.
  let dashing = state.power === 'berryRush'
    && powerCooldown > BERRY_DASH_COOLDOWN - BERRY_DASH_FRAMES
    && Math.sign(state.vx) === facing;
  const pressedPower = input.power === true && !state.powerHeld;
  if (pressedPower && powerCooldown === 0 && powerCharges > 0) {
    if (state.power === 'berryRush') {
      dashing = true;
      powerCharges -= 1;
      powerCooldown = BERRY_DASH_COOLDOWN;
    } else if (state.power === 'blueBounce' && !state.onGround) {
      vy = -14.5;
      powerCharges -= 1;
      powerCooldown = 8;
    } else if (state.power === 'peelToss') {
      powerCharges -= 1;
      powerCooldown = 10;
    }
  }

  if (dashing) {
    vx = facing * BERRY_DASH_SPEED;
    vy = 0; // a level dash: no sag, so it can carry a kid across a gap
  } else {
    // Gravity, clamped to terminal velocity.
    vy = Math.min(vy + ecfg.gravity, ecfg.maxFall);
  }

  const moved = moveAabb({ x: state.x, y: state.y, w: ecfg.width, h: ecfg.height }, vx, vy, level);

  const landed = moved.onGround && !state.onGround;
  if (landed && (state.power === 'berryRush' || state.power === 'blueBounce') && powerCooldown === 0) {
    powerCharges = POWER_UPS[state.power].maxCharges;
  }

  // Tick the legacy cornpop overlay for the next frame. Rescued crew powers are permanent selections:
  // durationFrames=0 never decrements, including across life-loss respawns and stage boundaries.
  let power = state.power;
  let powerTimer = state.powerTimer;
  if (power !== 'none' && POWER_UPS[power].durationFrames > 0) {
    powerTimer = Math.max(0, powerTimer - 1);
    if (powerTimer === 0) power = 'none';
  }

  return {
    x: moved.x,
    ...(invisibility ? { invisibility } : {}),
    y: moved.y,
    vx: moved.vx,
    vy: moved.vy,
    onGround: moved.onGround,
    facing,
    coyote,
    jumpBuffer,
    jumpHeld: input.jump,
    attackTimer,
    attackCooldown,
    attackHeld: input.attack,
    power,
    powerTimer,
    powerCharges,
    powerCooldown,
    powerHeld: input.power === true,
    shield: state.shield, // the guard persists across frames; only grant/absorb change it
    health: state.health, // health changes only on a hit/heal (world stepper), never in movement
    invuln: Math.max(0, state.invuln - 1), // mercy frames tick down each step
  };
}

export function grantPower(state: PlayerState, power: PowerKind): PlayerState {
  return power === 'none'
    ? { ...state, power: 'none', powerTimer: 0, powerCharges: 0, powerCooldown: 0, powerHeld: false, shield: false }
    : {
        ...state,
        power,
        powerTimer: POWER_UPS[power].durationFrames,
        powerCharges: POWER_UPS[power].maxCharges,
        powerCooldown: 0,
        powerHeld: false,
        shield: POWER_UPS[power].grantsShield === true,
      };
}

export function rechargePower(state: PlayerState): PlayerState {
  if (state.power === 'none') return state;
  const spec = POWER_UPS[state.power];
  return {
    ...state,
    powerCharges: spec.maxCharges,
    powerCooldown: 0,
    shield: spec.grantsShield === true ? true : state.shield,
  };
}
