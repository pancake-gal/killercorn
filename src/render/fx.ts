// Pure mapping from a one-frame world transition to the presentation FX it should trigger — the
// visual twin of the audio delta-mapper (src/audio/events.ts). Lives in presentation, reads the
// sim's state but never writes it (the One Rule): the scene calls this each frame with (prev, curr)
// and plays whatever comes back (screen shake, dust, sparkles, squash latches). Pure + deterministic,
// so it is unit-testable without Phaser. `import type` keeps this a compile-time-only dependency on
// the sim — the deterministic sim never imports the renderer at runtime.
//
// Positions are the triggering entity's SIM top-left (x,y); an index (`i` / `member`) identifies which
// entity fired a per-entity event, so the scene can translate to a feet/center display anchor using
// the dims it already holds. Nothing here feeds back into stepWorld — FX are a downstream read only.

import type { WorldState } from '@/entities/level/run';
import type { InputFrame } from '@/core/replay';
import { activePhase, type BossConfig, type BossState } from '@/entities/boss/kingCorn';
import { royaleLandings } from './royale';

export type FxEvent =
  | { type: 'hurt' } // player took a hit — screen shake + white flash + hurt pose
  | { type: 'land'; x: number; y: number } // player touched down — foot dust + squash latch
  | { type: 'squish'; i: number; x: number; y: number } // enemy i felled — squash latch + dust
  | { type: 'collect'; i: number; x: number; y: number } // cob i banked — sparkle burst + HUD pulse
  | { type: 'box-break'; i: number; x: number; y: number } // wheat box i smashed — shake + dust
  | { type: 'boss-hit'; member: number } // a boss took a hit — shake + pip pop (member -1 = single boss)
  | { type: 'slam-land'; x: number; y: number } // a boss slam just landed — heavy shake
  | { type: 'hop-land'; x: number; y: number; member: number } // a boss hop just landed — dust + light shake + thud (member -1 = single boss)
  | { type: 'rage-start' } // King Corn just entered his RAGE last pip — a roar + heavy shake
  | { type: 'ally-freed'; i: number; x: number; y: number } // ally i freed — sparkle ring
  | { type: 'power-up'; x: number; y: number } // a power was (re-)granted — sparkle ring at the player
  | { type: 'power-use'; power: ActivePower; x: number; y: number; facing: number } // a crew power fired — dust + afterimage
  | { type: 'checkpoint'; i: number } // checkpoint i just armed — a sparkle burst on its marker
  | { type: 'shield-block'; x: number; y: number } // the leaf absorbed a hit — a leaf-colored sparkle ring
  | { type: 'respawn'; x: number; y: number }; // a life was lost and the kid is back at the checkpoint — camera snap + poof

// The crew powers with a pressed activation (the only branches that raise powerCooldown).
type ActivePower = 'berryRush' | 'blueBounce' | 'peelToss';
function isActivePower(power: string): power is ActivePower {
  return power === 'berryRush' || power === 'blueBounce' || power === 'peelToss';
}

// A boss's slam just landed iff it went from an in-progress slam attack to the recover window.
function slamLanded(pb: WorldState['boss'], cb: WorldState['boss']): boolean {
  return !!pb && !!cb && pb.mode === 'attack' && pb.attack === 'slam' && cb.mode === 'recover';
}

// A boss's hop just landed iff it went from an in-progress hop to the recover window (mirrors slam).
function hopLanded(pb: WorldState['boss'], cb: WorldState['boss']): boolean {
  return !!pb && !!cb && pb.mode === 'attack' && pb.attack === 'hop' && cb.mode === 'recover';
}

// A live boss just crossed into its marked RAGE phase (never on the pop). Needs the boss's config.
export function rageStarted(pb: BossState, cb: BossState, cfg: BossConfig): boolean {
  return cb.hp > 0 && activePhase(pb, cfg).rage !== true && activePhase(cb, cfg).rage === true;
}

export function fxForTransition(prev: WorldState, curr: WorldState, bossCfg?: BossConfig, teamCfgs: readonly BossConfig[] = []): FxEvent[] {
  const evs: FxEvent[] = [];
  const pp = prev.player;
  const cp = curr.player;

  // A hit OWNS the frame (same rule as the audio mapper): a drained pip or a lost life shoves the
  // player back-and-up, so suppress the land FX so the knockback impulse never reads as a touchdown.
  const tookHit = curr.deaths > prev.deaths || cp.health < pp.health;
  if (tookHit) {
    evs.push({ type: 'hurt' });
  } else if (!pp.onGround && cp.onGround) {
    evs.push({ type: 'land', x: cp.x, y: cp.y });
  }

  // Squish: every enemy felled this frame (per enemy — a multi-kill sprays each one's dust).
  for (let i = 0; i < curr.enemies.length; i++) {
    if (prev.enemies[i]?.alive && !curr.enemies[i]?.alive) {
      const e = curr.enemies[i]!;
      evs.push({ type: 'squish', i, x: e.x, y: e.y });
    }
  }

  // Collect: every cob banked this frame (per cob).
  for (let i = 0; i < curr.collectibles.length; i++) {
    if (curr.collectibles[i]?.collected && !prev.collectibles[i]?.collected) {
      const cob = curr.collectibles[i]!;
      evs.push({ type: 'collect', i, x: cob.x, y: cob.y });
    }
  }

  // Box break: every wheat box smashed this frame (per box).
  for (let i = 0; i < curr.boxes.length; i++) {
    if (curr.boxes[i]?.broken && !prev.boxes[i]?.broken) {
      const bx = curr.boxes[i]!;
      evs.push({ type: 'box-break', i, x: bx.x, y: bx.y });
    }
  }

  // Boss hit: a single boss (member -1) or any team shaker whose hp dropped this frame.
  if (prev.boss && curr.boss && curr.boss.hp < prev.boss.hp) evs.push({ type: 'boss-hit', member: -1 });
  if (prev.teamBoss && curr.teamBoss) {
    for (let m = 0; m < curr.teamBoss.members.length; m++) {
      const pm = prev.teamBoss.members[m];
      const cm = curr.teamBoss.members[m];
      if (pm && cm && cm.hp < pm.hp) evs.push({ type: 'boss-hit', member: m });
    }
  }

  // Slam land: a single boss or a team shaker whose slam just hit the ground (attack → recover).
  if (slamLanded(prev.boss, curr.boss)) evs.push({ type: 'slam-land', x: curr.boss!.x, y: curr.boss!.y });
  if (prev.teamBoss && curr.teamBoss) {
    for (let m = 0; m < curr.teamBoss.members.length; m++) {
      if (slamLanded(prev.teamBoss.members[m] ?? null, curr.teamBoss.members[m] ?? null)) {
        const cm = curr.teamBoss.members[m]!;
        evs.push({ type: 'slam-land', x: cm.x, y: cm.y });
      }
    }
  }

  // Hop land: a single boss (member -1) or a team shaker (Pepper) whose hop just touched down.
  if (hopLanded(prev.boss, curr.boss)) evs.push({ type: 'hop-land', x: curr.boss!.x, y: curr.boss!.y, member: -1 });
  if (prev.teamBoss && curr.teamBoss) {
    for (let m = 0; m < curr.teamBoss.members.length; m++) {
      if (hopLanded(prev.teamBoss.members[m] ?? null, curr.teamBoss.members[m] ?? null)) {
        const cm = curr.teamBoss.members[m]!;
        evs.push({ type: 'hop-land', x: cm.x, y: cm.y, member: m });
      }
    }
  }
  // A Boss Royale drop-in touching down lands like a hop: boss-sized dust and a light thud.
  for (const m of royaleLandings(prev, curr)) {
    const cm = curr.teamBoss!.members[m]!;
    evs.push({ type: 'hop-land', x: cm.x, y: cm.y, member: m });
  }

  // Rage start: the King just crossed into his marked RAGE phase this frame — the tantrum beat (roar +
  // heavy shake), layered over the boss-hit of the pip that triggered it. Needs the config to read the
  // phase; guarded to fire once (prev not raging → curr raging) and never on the pop. The single boss,
  // or a team member (the King in the Boss Royale ring).
  const teamRage = !!prev.teamBoss && !!curr.teamBoss && curr.teamBoss.members.some((cm, m) => {
    const pm = prev.teamBoss!.members[m];
    const cfg = teamCfgs[m];
    return !!pm && !!cfg && rageStarted(pm, cm, cfg);
  });
  if ((bossCfg && prev.boss && curr.boss && rageStarted(prev.boss, curr.boss, bossCfg)) || teamRage) {
    evs.push({ type: 'rage-start' });
  }

  // Free-ally: every caged friend popped free this frame (per ally). A rescue IS the power grant, so
  // it suppresses the duplicate power-up sparkle below (same rule as the audio mapper).
  let freedNow = false;
  for (let i = 0; i < curr.allies.length; i++) {
    if (curr.allies[i]?.freed && !prev.allies[i]?.freed) {
      const a = curr.allies[i]!;
      evs.push({ type: 'ally-freed', i, x: a.x, y: a.y });
      freedNow = true;
    }
  }

  // Power-up: a power (re-)granted this frame — the slot changed kind OR its timer jumped up (a
  // same-kind re-arm). Suppressed on a free-ally frame (the rescue already sparkles the ally).
  if (!freedNow && cp.power !== 'none' && (cp.power !== pp.power || cp.powerTimer > pp.powerTimer)) {
    evs.push({ type: 'power-up', x: cp.x, y: cp.y });
  }

  // Checkpoint armed (forward only in the sim), the leaf soaking a hit, and a life-loss respawn
  // (never on the game-over frame, which freezes in place) — feedback the sim state already holds.
  if (curr.checkpoint > prev.checkpoint) evs.push({ type: 'checkpoint', i: curr.checkpoint });
  if (pp.shield && !cp.shield && !tookHit) evs.push({ type: 'shield-block', x: cp.x, y: cp.y });
  if (curr.deaths > prev.deaths && !curr.gameOver) evs.push({ type: 'respawn', x: cp.x, y: cp.y });

  // The jump stretch latch has no dedicated FX event (a jump moves nothing on screen to burst) — the
  // scene reads the audio 'jump' cue for it.
  return evs;
}

// Power-use: did this frame's input fire the crew power? Mirrors playerStep's activation rule
// (src/entities/player/player.ts): a fresh press of the power action, a charge in hand, the cooldown
// elapsed this step, and for Blue Bounce an airborne hero. It reads the pre-step world (after any crew
// selection) plus the input, because a wheat box broken in the same step refills the charge AND resets
// the cooldown, which hides the use from a before/after diff. A hit owns its frame; a heal-plus-hit
// frame keeps health level but raises the mercy frames. Tests pin this against the real stepper.
export function powerUseFx(before: WorldState, input: InputFrame, after: WorldState): FxEvent | undefined {
  const bp = before.player;
  const ap = after.player;
  if (!isActivePower(bp.power) || ap.power !== bp.power) return undefined;
  const fresh = input.power === true && !bp.powerHeld;
  const ready = bp.powerCharges > 0 && Math.max(0, bp.powerCooldown - 1) === 0;
  const canFire = bp.power !== 'blueBounce' || !bp.onGround;
  const hit = after.deaths > before.deaths || ap.health < bp.health || ap.invuln > bp.invuln;
  if (!fresh || !ready || !canFire || hit) return undefined;
  return { type: 'power-use', power: bp.power, x: ap.x, y: ap.y, facing: ap.facing };
}
