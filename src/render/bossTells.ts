import type { WorldState } from '@/entities/level/run';
import type { PlayerConfig } from '@/entities/player/player';
import { aabbOverlap, type Aabb } from '@/entities/level/level';
import { swingHitbox } from '@/entities/combat';
import { bossBox, bossVulnerable, type BossConfig, type BossState } from '@/entities/boss/kingCorn';
import { royaleActive } from '@/entities/boss/royale';
import { STRINGS } from '@/content/strings';

export type BossTell = { type: 'open' } | { type: 'blocked'; x: number; y: number };

// True while the boss sits in its recover window and a swing would land (not flashing from a hit).
export function bossOpen(b: BossState, cfg: BossConfig): boolean {
  return b.mode === 'recover' && bossVulnerable(b, cfg);
}

function overlapCenter(a: Aabb, b: Aabb): { x: number; y: number } {
  const left = Math.max(a.x, b.x);
  const right = Math.min(a.x + a.w, b.x + b.w);
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.h, b.y + b.h);
  return { x: (left + right) / 2, y: (top + bottom) / 2 };
}

// `pCfg` must be the player's effective config this frame (power overlay applied, as the stepper's
// combat uses), so a Carrot REACH swing is read with its real reach. `bossCfg` is the single boss's
// config; `teamCfgs[i]` is team member i's. At most one tell per frame; 'open' wins. In the Boss
// Royale ring only active ring bosses count: a benched body or a drop-in in grace is never told about.
export function bossTellsForTransition(
  prev: WorldState,
  curr: WorldState,
  pCfg: PlayerConfig,
  bossCfg?: BossConfig,
  teamCfgs: readonly BossConfig[] = [],
): BossTell[] {
  const pairs: { pb: BossState; cb: BossState; cfg: BossConfig }[] = [];
  if (prev.boss && curr.boss && bossCfg) pairs.push({ pb: prev.boss, cb: curr.boss, cfg: bossCfg });
  if (prev.teamBoss && curr.teamBoss) {
    const team = curr.teamBoss;
    team.members.forEach((cb, i) => {
      const pb = prev.teamBoss!.members[i];
      const cfg = teamCfgs[i];
      if (team.royale && !royaleActive(team, i)) return;
      if (pb && cfg) pairs.push({ pb, cb, cfg });
    });
  }
  if (pairs.length === 0) return [];

  if (pairs.some(({ pb, cb }) => pb.mode !== 'recover' && cb.mode === 'recover' && cb.hp > 0)) {
    return [{ type: 'open' }];
  }

  // A hit owns the frame: the player's (drained pip, lost life, mercy frames armed, leaf spent) or
  // the boss's (any pip lost). Neither should read as a block.
  const pp = prev.player;
  const cp = curr.player;
  const playerHit = curr.deaths > prev.deaths || cp.health < pp.health || cp.invuln > pp.invuln || (pp.shield && !cp.shield);
  if (playerHit || pairs.some(({ pb, cb }) => cb.hp < pb.hp)) return [];

  const hbNow = swingHitbox(cp, pCfg);
  if (!hbNow) return [];
  const hbBefore = swingHitbox(pp, pCfg);
  for (const { pb, cb, cfg } of pairs) {
    if (cb.hp <= 0 || cb.hitCooldown > 0 || bossVulnerable(cb, cfg)) continue;
    const body = bossBox(cb, cfg);
    if (!aabbOverlap(hbNow, body)) continue;
    if (hbBefore && aabbOverlap(hbBefore, bossBox(pb, cfg))) continue; // same contact as last frame
    return [{ type: 'blocked', ...overlapCenter(hbNow, body) }];
  }
  return [];
}

// True while any live boss is in its recover window (a hit flash inside it still counts). The
// "hit it now" banner outlasts a short window, so the scene clears it once this goes false.
export function anyBossRecovering(world: WorldState): boolean {
  const recovering = (b: BossState) => b.hp > 0 && b.mode === 'recover';
  return (!!world.boss && recovering(world.boss)) || (world.teamBoss?.members.some(recovering) ?? false);
}

// The throw banner: arenas hold no squirrels, so a throw there is always the boss's.
export function throwCueText(world: WorldState): string {
  return world.boss || world.teamBoss ? STRINGS.bossThrows : STRINGS.squirrelThrows;
}
