import { POWER_UPS, type PowerKind } from '@/entities/player/powerup';
import { friendForPower, type CrewFriend } from '@/campaign/session';

const POWER_IDENTITY: Record<Exclude<PowerKind, 'none'>, readonly [string, string]> = {
  cornpop: ['WHEAT BOX', 'CORNPOP'],
  berryRush: ['STRAWBERRY', 'BERRY RUSH'],
  carrotReach: ['CARROT', 'LONG REACH'],
  blueBounce: ['BLUEBERRY', 'BLUE BOUNCE'],
  leafGuard: ['LETTUCE', 'LEAF GUARD'],
  peelToss: ['BANANA', 'PEEL TOSS'],
};

export function formatPowerHud(
  power: Exclude<PowerKind, 'none'>,
  charges: number,
  timerFrames: number,
): string {
  const [friend, move] = POWER_IDENTITY[power];
  const spec = POWER_UPS[power];
  let resource = 'READY';
  if (power === 'cornpop') resource = `${Math.max(0, Math.ceil(timerFrames / 60))}s`;
  else if (spec.maxCharges > 0) {
    const filled = Math.max(0, Math.min(spec.maxCharges, Math.floor(charges)));
    resource = '●'.repeat(filled) + '○'.repeat(spec.maxCharges - filled);
  }
  return `${friend} • ${move}  ${resource}`;
}

const RESCUE_MOVE: Record<CrewFriend, string> = {
  strawberry: 'BERRY RUSH',
  carrot: 'LONG REACH',
  blueberry: 'BLUE BOUNCE',
  lettuce: 'LEAF GUARD',
  banana: 'PEEL TOSS',
};

export function rescuePowerCue(friend: CrewFriend): string {
  return `${friend.toUpperCase()} RESCUED • ${RESCUE_MOVE[friend]} READY`;
}

export function powerFriend(power: PowerKind): CrewFriend | undefined {
  return friendForPower(power);
}

export function powerChipStyle(regime: { bg: string; text: string; accent: string }) {
  return { text: regime.text, fill: regime.bg, fillAlpha: 0.85, stroke: regime.accent };
}
