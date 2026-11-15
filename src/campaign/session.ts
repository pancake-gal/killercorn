import type { PowerKind } from '@/entities/player/powerup';
import { MAX_BOSS_ASSIST_TIER } from '@/entities/boss/assist';

export { MAX_BOSS_ASSIST_TIER } from '@/entities/boss/assist';

export const CAMPAIGN_SCHEMA_VERSION = 1 as const;

export const CREW_POWER = {
  strawberry: 'berryRush',
  carrot: 'carrotReach',
  blueberry: 'blueBounce',
  lettuce: 'leafGuard',
  banana: 'peelToss',
} as const satisfies Record<string, Exclude<PowerKind, 'none' | 'cornpop'>>;

export type CrewFriend = keyof typeof CREW_POWER;
export type CrewPower = (typeof CREW_POWER)[CrewFriend];

export const CREW_MAX_CHARGES: Record<CrewPower, number> = {
  berryRush: 2,
  carrotReach: 0,
  blueBounce: 1,
  leafGuard: 1,
  peelToss: 3,
};

export interface CampaignSession {
  schemaVersion: typeof CAMPAIGN_SCHEMA_VERSION;
  characterId: string;
  stageId: string;
  lives: number;
  rescuedCrew: CrewFriend[];
  activePower: CrewPower | 'none';
  crewResources: Partial<Record<CrewPower, number>>;
  completedStageIds: string[];
  bestStageFrames: Record<string, number>;
  bestStageCobs: Record<string, number>;
  bestStageScores: Record<string, number>;
  bossAssistTiers: Record<string, number>;
  runScore: number;
  runFrames: number;
  runCobs: number;
  completed: boolean;
}

export function createCampaignSession(options: {
  characterId: string;
  stageId: string;
  lives?: number;
}): CampaignSession {
  return {
    schemaVersion: CAMPAIGN_SCHEMA_VERSION,
    characterId: options.characterId,
    stageId: options.stageId,
    lives: options.lives ?? 3,
    rescuedCrew: [],
    activePower: 'none',
    crewResources: {},
    completedStageIds: [],
    bestStageFrames: {},
    bestStageCobs: {},
    bestStageScores: {},
    bossAssistTiers: {},
    runScore: 0,
    runFrames: 0,
    runCobs: 0,
    completed: false,
  };
}

export function isCrewFriend(value: string): value is CrewFriend {
  return Object.prototype.hasOwnProperty.call(CREW_POWER, value);
}

export function friendForPower(power: PowerKind): CrewFriend | undefined {
  return (Object.keys(CREW_POWER) as CrewFriend[]).find((friend) => CREW_POWER[friend] === power);
}

export function rescueFriend(session: CampaignSession, friend: CrewFriend): CampaignSession {
  const rescuedCrew = session.rescuedCrew.includes(friend)
    ? session.rescuedCrew
    : [...session.rescuedCrew, friend];
  const activePower = CREW_POWER[friend];
  return {
    ...session,
    rescuedCrew,
    activePower,
    crewResources: {
      ...session.crewResources,
      [activePower]: CREW_MAX_CHARGES[activePower],
    },
  };
}

export function selectCrewPower(session: CampaignSession, power: CrewPower): CampaignSession {
  const friend = (Object.keys(CREW_POWER) as CrewFriend[]).find(
    (candidate) => CREW_POWER[candidate] === power,
  );
  if (!friend || !session.rescuedCrew.includes(friend)) {
    throw new Error(`Crew power ${power} is not rescued`);
  }
  return { ...session, activePower: power };
}

export function cycleCrewPower(session: CampaignSession, direction: -1 | 1): CampaignSession {
  if (session.rescuedCrew.length === 0) return session;
  const powers = session.rescuedCrew.map((friend) => CREW_POWER[friend]);
  const current = powers.indexOf(session.activePower as CrewPower);
  const start = current < 0 ? 0 : current;
  const index = (start + direction + powers.length) % powers.length;
  return { ...session, activePower: powers[index]! };
}

// Boss second wind: one deterministic tier per stage after a full three-life wipe. It is campaign
// state rather than a runtime guess, so identical saved state + inputs always produces the same fight.
export function bossAssistTier(session: CampaignSession, stageId: string): number {
  return session.bossAssistTiers?.[stageId] ?? 0;
}

export function recordBossWipe(session: CampaignSession, stageId: string): CampaignSession {
  const next = Math.min(MAX_BOSS_ASSIST_TIER, bossAssistTier(session, stageId) + 1);
  return {
    ...session,
    bossAssistTiers: { ...(session.bossAssistTiers ?? {}), [stageId]: next },
  };
}

export function updateCrewResource(
  session: CampaignSession,
  power: CrewPower,
  charges: number,
): CampaignSession {
  const max = CREW_MAX_CHARGES[power];
  return {
    ...session,
    crewResources: {
      ...session.crewResources,
      [power]: Math.max(0, Math.min(max, Math.trunc(charges))),
    },
  };
}

export function advanceCampaign(session: CampaignSession, stageId: string): CampaignSession {
  const completedStageIds = session.completedStageIds.includes(session.stageId)
    ? session.completedStageIds
    : [...session.completedStageIds, session.stageId];
  return { ...session, stageId, completedStageIds };
}

export function completeCampaign(session: CampaignSession): CampaignSession {
  const completedStageIds = session.completedStageIds.includes(session.stageId)
    ? session.completedStageIds
    : [...session.completedStageIds, session.stageId];
  return { ...session, completedStageIds, completed: true };
}

export function recordStageResult(
  session: CampaignSession,
  stageId: string,
  result: { frames: number; cobs: number; score: number },
): CampaignSession {
  const frames = Math.max(1, Math.trunc(result.frames));
  const cobs = Math.max(0, Math.trunc(result.cobs));
  const score = Math.max(0, Math.trunc(result.score));
  const previousFrames = session.bestStageFrames[stageId];
  const previousCobs = session.bestStageCobs[stageId];
  const previousScore = session.bestStageScores[stageId];
  return {
    ...session,
    bestStageFrames: {
      ...session.bestStageFrames,
      [stageId]: previousFrames === undefined ? frames : Math.min(previousFrames, frames),
    },
    bestStageCobs: {
      ...session.bestStageCobs,
      [stageId]: previousCobs === undefined ? cobs : Math.max(previousCobs, cobs),
    },
    bestStageScores: {
      ...session.bestStageScores,
      [stageId]: previousScore === undefined ? score : Math.max(previousScore, score),
    },
    runScore: session.runScore + score,
    runFrames: session.runFrames + frames,
    runCobs: session.runCobs + cobs,
  };
}

export function serializeCampaign(session: CampaignSession): string {
  return JSON.stringify(session);
}

export function deserializeCampaign(json: string): CampaignSession {
  const value: unknown = JSON.parse(json);
  if (!isRecord(value) || value.schemaVersion !== CAMPAIGN_SCHEMA_VERSION) {
    throw new Error(`Unsupported campaign save version: ${String(isRecord(value) ? value.schemaVersion : undefined)}`);
  }
  const bestStageFrames = value.bestStageFrames ?? {};
  const bestStageCobs = value.bestStageCobs ?? {};
  const bestStageScores = value.bestStageScores ?? {};
  const bossAssistTiers = value.bossAssistTiers ?? {};
  const runScore = value.runScore ?? 0;
  const runFrames = value.runFrames ?? 0;
  const runCobs = value.runCobs ?? 0;
  if (
    typeof value.characterId !== 'string' || value.characterId.length === 0 ||
    typeof value.stageId !== 'string' || value.stageId.length === 0 ||
    !Number.isInteger(value.lives) || (value.lives as number) < 0 ||
    !Array.isArray(value.rescuedCrew) || !value.rescuedCrew.every((friend) => typeof friend === 'string' && isCrewFriend(friend)) ||
    new Set(value.rescuedCrew).size !== value.rescuedCrew.length ||
    (value.activePower !== 'none' && !isCrewPower(value.activePower)) ||
    !isRecord(value.crewResources) ||
    !Object.entries(value.crewResources).every(([power, charges]) =>
      isCrewPower(power) && Number.isInteger(charges) && (charges as number) >= 0 && (charges as number) <= CREW_MAX_CHARGES[power],
    ) ||
    !Array.isArray(value.completedStageIds) || !value.completedStageIds.every((id) => typeof id === 'string') ||
    !isStageRecord(bestStageFrames, false) ||
    !isStageRecord(bestStageCobs, true) ||
    !isStageRecord(bestStageScores, true) ||
    !isBossAssistRecord(bossAssistTiers) ||
    !Number.isSafeInteger(runScore) || (runScore as number) < 0 ||
    !Number.isSafeInteger(runFrames) || (runFrames as number) < 0 ||
    !Number.isSafeInteger(runCobs) || (runCobs as number) < 0 ||
    typeof value.completed !== 'boolean'
  ) {
    throw new Error('Malformed campaign save');
  }
  if (value.activePower !== 'none') {
    const owner = (Object.keys(CREW_POWER) as CrewFriend[]).find((friend) => CREW_POWER[friend] === value.activePower);
    if (!owner || !value.rescuedCrew.includes(owner)) throw new Error('Active power has not been rescued');
  }
  return { ...value, bestStageFrames, bestStageCobs, bestStageScores, bossAssistTiers, runScore, runFrames, runCobs } as unknown as CampaignSession;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCrewPower(value: unknown): value is CrewPower {
  return typeof value === 'string' && (Object.values(CREW_POWER) as string[]).includes(value);
}

function isStageRecord(value: unknown, allowZero: boolean): value is Record<string, number> {
  return isRecord(value) && Object.entries(value).every(([stageId, amount]) =>
    stageId.length > 0 && Number.isInteger(amount) && (amount as number) >= (allowZero ? 0 : 1),
  );
}

function isBossAssistRecord(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.entries(value).every(([stageId, tier]) =>
    stageId.length > 0 && Number.isInteger(tier) && (tier as number) >= 1 && (tier as number) <= MAX_BOSS_ASSIST_TIER,
  );
}
