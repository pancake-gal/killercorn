// Pure mapping from a one-frame world transition to the SFX cues it should trigger. Lives in
// presentation, reads the sim's state but never writes it (the One Rule): the scene calls this
// each frame with (prev, curr) and plays whatever comes back. Pure + deterministic, so it is
// unit-testable without Phaser. `import type` keeps this a compile-time-only dependency on the
// sim — the deterministic sim never imports audio at runtime.

import type { WorldState } from '@/entities/level/run';
import { type BossConfig } from '@/entities/boss/kingCorn';
import { rageStarted } from '@/render/fx';
import { royaleEntrants, royaleLandings } from '@/render/royale';

export type SfxCue = 'jump' | 'land' | 'squish' | 'collect' | 'hurt' | 'boss-roar' | 'swing' | 'throw' | 'box-break' | 'power-up' | 'free-ally' | 'hop-thud' | 'rage-roar' | 'boss-windup' | 'slam-thud' | 'boss-defeat';

// A jump (or stomp-bounce) sets a large upward velocity in one frame; gravity alone only adds a
// small +vy. So a sharp negative vy delta with vy now rising marks a jump. A death respawn zeroes
// vy (vy === 0, not < 0), so it never reads as a jump.
const JUMP_IMPULSE = -5;

// A boss hop just landed iff it went from an in-progress hop to recover (single boss or team shaker).
function hopLanded(pb: { mode: string; attack: string | null } | null | undefined, cb: { mode: string } | null | undefined): boolean {
  return !!pb && !!cb && pb.mode === 'attack' && pb.attack === 'hop' && cb.mode === 'recover';
}

// A boss slam just hit the ground iff it went from an in-progress slam to recover (mirrors hopLanded).
function slamLanded(pb: { mode: string; attack: string | null } | null | undefined, cb: { mode: string } | null | undefined): boolean {
  return !!pb && !!cb && pb.mode === 'attack' && pb.attack === 'slam' && cb.mode === 'recover';
}

// A boss began its telegraph this frame (any mode → windup) — the audible tell before every attack.
function windupStarted(pb: { mode: string } | null | undefined, cb: { mode: string } | null | undefined): boolean {
  return !!pb && !!cb && pb.mode !== 'windup' && cb.mode === 'windup';
}

export function sfxForTransition(prev: WorldState, curr: WorldState, bossCfg?: BossConfig, teamCfgs: readonly BossConfig[] = []): SfxCue[] {
  const cues: SfxCue[] = [];
  const pp = prev.player;
  const cp = curr.player;

  // A hit landed this frame iff a health pip drained (a survivable hit) OR a life was lost (the bar
  // emptied → a checkpoint respawn). Both shove the player back-and-up, so the hurt cue OWNS the frame
  // — suppress jump/land so the knockback impulse never false-reads as a jump.
  const tookHit = curr.deaths > prev.deaths || cp.health < pp.health;
  if (tookHit) {
    cues.push('hurt');
  } else {
    if (cp.vy < 0 && cp.vy - pp.vy <= JUMP_IMPULSE) cues.push('jump');
    if (!pp.onGround && cp.onGround) cues.push('land');
  }

  // Collect: any cob banked this frame.
  for (let i = 0; i < curr.collectibles.length; i++) {
    if (curr.collectibles[i]?.collected && !prev.collectibles[i]?.collected) {
      cues.push('collect');
      break;
    }
  }

  // Squish: any enemy that died this frame (a stomp/swing kill).
  for (let i = 0; i < curr.enemies.length; i++) {
    if (prev.enemies[i]?.alive && !curr.enemies[i]?.alive) {
      cues.push('squish');
      break;
    }
  }

  // Boss roar / defeat: the boss took a hit this frame (hp dropped). A survivable pip barks the
  // roar; the POP gets the comedic defeat tumble instead (never both — the womp owns the frame).
  if (prev.boss && curr.boss && curr.boss.hp < prev.boss.hp) {
    cues.push(curr.boss.hp > 0 ? 'boss-roar' : 'boss-defeat');
  }
  // Team shakers bark the same roar per hit; the defeat womp fires when the LAST shaker pops. In the
  // Boss Royale ring every pop is a boss going down, so each one womps.
  if (prev.teamBoss && curr.teamBoss) {
    let memberHit = false;
    let memberPopped = false;
    for (let m = 0; m < curr.teamBoss.members.length; m++) {
      const pm = prev.teamBoss.members[m];
      const cm = curr.teamBoss.members[m];
      if (pm && cm && cm.hp < pm.hp) {
        memberHit = true;
        if (cm.hp <= 0) memberPopped = true;
      }
    }
    if (memberHit) {
      const anyLeft = curr.teamBoss.members.some((m) => m.hp > 0);
      cues.push(anyLeft && !(curr.teamBoss.royale && memberPopped) ? 'boss-roar' : 'boss-defeat');
    }
  }
  // A Boss Royale entrant roars as it drops into the ring.
  if (royaleEntrants(prev, curr).length > 0) cues.push('boss-roar');

  // Hop thud: a boss (single or a team shaker) landed a hop this frame — a pumpkin-on-turf thump. A
  // Boss Royale drop-in touching down thuds the same way.
  if (hopLanded(prev.boss, curr.boss)) cues.push('hop-thud');
  if (prev.teamBoss && curr.teamBoss) {
    const dropLanded = royaleLandings(prev, curr).length > 0;
    for (let m = 0; m < curr.teamBoss.members.length; m++) {
      if (dropLanded || hopLanded(prev.teamBoss.members[m], curr.teamBoss.members[m])) { cues.push('hop-thud'); break; }
    }
  }

  // Slam thud: a boss slam just hit the ground — the heavy twin of the hop thud.
  if (slamLanded(prev.boss, curr.boss)) cues.push('slam-thud');
  if (prev.teamBoss && curr.teamBoss) {
    for (let m = 0; m < curr.teamBoss.members.length; m++) {
      if (slamLanded(prev.teamBoss.members[m], curr.teamBoss.members[m])) { cues.push('slam-thud'); break; }
    }
  }

  // Boss windup: a boss began its telegraph this frame — the "uh-oh" crank, the audible tell that
  // pairs with the visual telegraph blink (soft at playback; a tell, never a stinger).
  if (windupStarted(prev.boss, curr.boss)) cues.push('boss-windup');
  if (prev.teamBoss && curr.teamBoss) {
    for (let m = 0; m < curr.teamBoss.members.length; m++) {
      if (windupStarted(prev.teamBoss.members[m], curr.teamBoss.members[m])) { cues.push('boss-windup'); break; }
    }
  }

  // Rage roar: the King just crossed into his RAGE phase this frame — the bellow layered over the
  // boss-hit roar of the pip that triggered it (needs the config; never on the pop). The single boss,
  // or the King as a member of the Boss Royale ring.
  const teamRage = !!prev.teamBoss && !!curr.teamBoss && curr.teamBoss.members.some((cm, m) => {
    const pm = prev.teamBoss!.members[m];
    const cfg = teamCfgs[m];
    return !!pm && !!cfg && rageStarted(pm, cm, cfg);
  });
  if ((bossCfg && prev.boss && curr.boss && rageStarted(prev.boss, curr.boss, bossCfg)) || teamRage) {
    cues.push('rage-roar');
  }

  // Swing: the weapon hitbox went live this frame (a fresh attack press started a swing). Rising
  // edge only — attackTimer 0 → >0 — so a held swing fires once, and a respawn (attackTimer reset
  // to 0) never reads as a swing.
  if (pp.attackTimer === 0 && cp.attackTimer > 0) cues.push('swing');

  // Throw: a squirrel actually LOBBED a corn this frame. world.projectiles only ever grows via a lob
  // (player peels live in world.peels), so a rising projectile count is a real emit — a squirrel that
  // resets its cadence while the player is out of range adds nothing, so this never false-fires.
  if (curr.projectiles.length > prev.projectiles.length) cues.push('throw');

  // Box break: a wheat box smashed this frame (its broken flag went false → true).
  for (let i = 0; i < curr.boxes.length; i++) {
    if (curr.boxes[i]?.broken && !prev.boxes[i]?.broken) {
      cues.push('box-break');
      break;
    }
  }

  // Free-ally: a caged friend popped free this frame — the rescue fanfare.
  let freedNow = false;
  for (let i = 0; i < curr.allies.length; i++) {
    if (curr.allies[i]?.freed && !prev.allies[i]?.freed) {
      freedNow = true;
      break;
    }
  }
  if (freedNow) cues.push('free-ally');

  // Power-up: a power was (re-)granted this frame — the slot changed kind (none → X or X → Y) OR its
  // timer jumped UP (a same-kind re-arm; timers otherwise only tick down). A rescue already plays
  // free-ally (the rescue IS the grant), so suppress the buff sparkle on a free-ally frame.
  if (!freedNow && cp.power !== 'none' && (cp.power !== pp.power || cp.powerTimer > pp.powerTimer)) cues.push('power-up');

  return cues;
}
