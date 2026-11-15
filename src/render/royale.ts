import type { WorldState } from '@/entities/level/run';
import type { TeamBossPlacement } from '@/entities/level/level';
import type { TeamBossState } from '@/entities/boss/saltAndPepper';
import { inRoyaleRing, royaleGroupMembers } from '@/entities/boss/royale';

// A popped ring boss holds its defeated pose this long, then fades out of its corner.
export const ROYALE_POP_LINGER = 45;
export const ROYALE_POP_FADE = 30;
// A drop-in is drawn ghosted while it can neither hurt nor be hurt.
const GRACE_ALPHA = 0.6;

// Members that dropped into the ring this frame (the entry count rose).
export function royaleEntrants(prev: WorldState, curr: WorldState): number[] {
  const before = prev.teamBoss?.royale;
  const after = curr.teamBoss?.royale;
  if (!before || !after || after.entries <= before.entries) return [];
  return after.slot.flatMap((slot, i) => (slot >= 0 && before.slot[i]! < 0 ? [i] : []));
}

// Members that touched down from their drop this frame: still in grace, falling last frame, grounded now.
export function royaleLandings(prev: WorldState, curr: WorldState): number[] {
  const before = prev.teamBoss;
  const after = curr.teamBoss;
  if (!before?.royale || !after?.royale) return [];
  return after.members.flatMap((m, i) => {
    const was = before.members[i];
    const dropping = before.royale!.slot[i]! >= 0 && after.royale!.grace[i]! > 0;
    return dropping && was && was.vy > 0 && m.vy === 0 ? [i] : [];
  });
}

// The HUD row a ring boss owns: its corner (0 west, 1 east), so a survivor never jumps rows.
export function royaleHudRow(team: TeamBossState, i: number): number | null {
  return inRoyaleRing(team, i) ? team.royale!.slot[i]! : null;
}

// The waiting ladder group's remaining members, by name. Empty once everyone has entered.
export function royaleNextUp(team: TeamBossState, p: TeamBossPlacement): string[] {
  const royale = team.royale;
  if (!royale) return [];
  for (let k = royale.nextEntry; k < royale.order.length; k++) {
    const members = royaleGroupMembers(team, p, royale.order[k]!);
    if (members.length > 0) return members.map((i) => p.members[i]!.name);
  }
  return [];
}

// How visible member i's body is (0 = hidden). The bench is off stage; a grace drop is ghosted; a pop
// lingers in its defeated pose, then fades (`popAge` = frames since it popped; Infinity before this
// attempt began, so an earlier attempt's pop never shows).
export function royaleBodyAlpha(team: TeamBossState, i: number, popAge: number): number {
  const royale = team.royale;
  const member = team.members[i];
  if (!royale || !member) return 1;
  if (member.hp <= 0) {
    if (popAge < ROYALE_POP_LINGER) return 1;
    return Math.max(0, 1 - (popAge - ROYALE_POP_LINGER) / ROYALE_POP_FADE);
  }
  if (royale.slot[i]! < 0) return 0;
  return royale.grace[i]! > 0 ? GRACE_ALPHA : 1;
}
