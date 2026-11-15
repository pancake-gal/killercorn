import { moveAabb, type EnemyPlacement, type LevelDef } from '@/entities/level/level';

export interface EnemyConfig {
  width: number;
  height: number;
  speed: number; // px / frame
  gravity: number;
  maxFall: number;
}

// The mob kind drives the per-frame step dispatch (run.ts): a plain patroller vs a thrower.
export type EnemyKind = 'kernel' | 'squirrel';

// Per-kind collision body. The single source of each mob's footprint: the kind's config (movement)
// and the spawned EnemyState (combat box) both read it, so a mob's body is one size everywhere.
export const ENEMY_BODY: Record<EnemyKind, { width: number; height: number }> = {
  kernel: { width: 32, height: 32 },
  squirrel: { width: 30, height: 34 },
};

export const KERNEL_CREEP_CONFIG: EnemyConfig = {
  width: ENEMY_BODY.kernel.width,
  height: ENEMY_BODY.kernel.height,
  speed: 1.5,
  gravity: 0.7,
  maxFall: 14,
};

export interface EnemyState {
  x: number;
  y: number;
  vy: number;
  dir: 1 | -1;
  patrolLeft: number;
  patrolRight: number;
  alive: boolean; // squished enemies go inert (no patrol, no contact)
  kind: EnemyKind; // which step runs for this mob
  throwTimer: number; // frames until a thrower's next lob (squirrel only; 0/unused for a kernel)
  w: number; // collision-box width  (this mob's own body, not a shared enemy config)
  h: number; // collision-box height
  batterySwitchId?: string; // immutable level wiring for royal squirrel machinery
}

export function spawnEnemy(p: EnemyPlacement): EnemyState {
  // The placement's registry name picks the kind; everything else patrols by default.
  const kind: EnemyKind = p.name === 'squirrel' ? 'squirrel' : 'kernel';
  const body = ENEMY_BODY[kind];
  return {
    x: p.x,
    y: p.y,
    vy: 0,
    dir: 1,
    patrolLeft: p.patrolLeft,
    patrolRight: p.patrolRight,
    alive: true,
    kind,
    throwTimer: 0,
    w: body.width,
    h: body.height,
    ...(p.batterySwitchId ? { batterySwitchId: p.batterySwitchId } : {}),
  };
}

export function kernelStep(state: EnemyState, cfg: EnemyConfig, level: LevelDef): EnemyState {
  if (!state.alive) return state; // a squished mob stays put and harmless
  let dir = state.dir;
  // Turn at the patrol edges before moving, so the mob stays inside its span (impossible_state).
  if (state.x <= state.patrolLeft && dir < 0) dir = 1;
  if (state.x + cfg.width >= state.patrolRight && dir > 0) dir = -1;

  const vy = Math.min(state.vy + cfg.gravity, cfg.maxFall);
  const moved = moveAabb({ x: state.x, y: state.y, w: cfg.width, h: cfg.height }, dir * cfg.speed, vy, level);

  // A wall (or a platform edge resolved as a wall) also flips the patrol direction.
  if (moved.hitWall) dir = (dir * -1) as 1 | -1;

  // Clamp hard to the patrol span — defense in depth so the oracle can never be violated.
  const x = Math.min(Math.max(moved.x, state.patrolLeft), state.patrolRight - cfg.width);

  // Spread state so kind/throwTimer carry through (a kernel's throwTimer is inert).
  return { ...state, x, y: moved.y, vy: moved.vy, dir, alive: true };
}
