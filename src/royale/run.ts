import type { ReplayInit } from '@/core/replay';
import { INITIAL_LIVES } from '@/entities/level/run';
import { BOSS_ROYALE_ARENA } from '@/entities/level/level';
import { MAX_BOSS_ASSIST_TIER } from '@/entities/boss/assist';
import { ROYALE_MEMBERS } from '@/entities/boss/royale';
import type { TeamBossState } from '@/entities/boss/saltAndPepper';
import {
  CREW_MAX_CHARGES,
  CREW_POWER,
  createCampaignSession,
  type CampaignSession,
  type CrewFriend,
  type CrewPower,
} from '@/campaign/session';
import { canSelectCharacter } from '@/entities/player/characters';
import { NO_SPICES, ROYALE_SPICES, spiceCount, type RoyaleSpices } from './spices';
import { calculateRoyaleScore, royaleCrowns, type RoyaleCrown, type RoyaleScoreBreakdown } from './score';
import { submitRoyaleClear, type RoyaleRecord } from './record';

export const ROYALE_STARTING_POWER: CrewPower = 'berryRush';

export interface RoyaleRun {
  characterId: string; // the starting kid (score boards)
  spices: RoyaleSpices;
  seed?: number; // shuffle seed, present only with the Shuffle spice; reused on every retry
  attempt: number; // 1-based
  cleared: string[]; // bosses popped in earlier attempts (they stay popped)
  assistTier: number; // Second Wind for the next attempt
  totalFrames: number; // finished attempts
  totalDeaths: number; // lives lost in finished attempts
  kids: string[]; // every kid used, in order
  activeKid: string; // the kid a retry starts with
  activePower: CrewPower | 'none'; // the crew power a retry starts with
}

export interface RoyaleAttemptEnd {
  frames: number;
  deaths: number;
  cleared: readonly string[]; // every boss popped so far in the run (earlier + this attempt)
  activeKid: string;
  activePower: CrewPower | 'none';
}

export interface RoyaleClearOutcome {
  frames: number; // the clearing attempt
  deaths: number; // lives lost in the clearing attempt
  lives: number; // lives left at the final pop
}

export interface RoyaleAward {
  score: number;
  breakdown: RoyaleScoreBreakdown;
  frames: number;
  deaths: number;
  characterId: string;
  kids: string[];
  spices: number;
  crowns: RoyaleCrown[];
  newCrowns: RoyaleCrown[];
  scoreRank: number | null;
  timeRank: number | null;
  newBestScore: boolean;
  newBestTime: boolean;
}

export function startRoyaleRun(options: { characterId: string; spices?: RoyaleSpices; seed?: number }): RoyaleRun {
  const spices = options.spices ?? NO_SPICES;
  return {
    characterId: options.characterId,
    spices,
    ...(spices.shuffle && options.seed !== undefined ? { seed: options.seed >>> 0 } : {}),
    attempt: 1,
    cleared: [],
    assistTier: 0,
    totalFrames: 0,
    totalDeaths: 0,
    kids: [options.characterId],
    activeKid: options.characterId,
    activePower: spices.noCrew ? 'none' : ROYALE_STARTING_POWER,
  };
}

// The title's Mash 'Em, checked at the DOM → Phaser boundary: Boss Royale needs the campaign victory,
// the kid must be unlocked, spices count only once the first Royale clear opens them (known flags
// only), and the seed (chosen outside the sim) is kept only for Shuffle. Null when not allowed.
export function royaleRunFromMenu(
  request: { characterId: string; spices: RoyaleSpices },
  gate: { victory: boolean; spicesOpen: boolean; seed: number },
): RoyaleRun | null {
  if (!gate.victory || !canSelectCharacter(request.characterId, true)) return null;
  const spices = Object.fromEntries(
    ROYALE_SPICES.map((spice) => [spice, gate.spicesOpen && request.spices?.[spice] === true]),
  ) as unknown as RoyaleSpices;
  return startRoyaleRun({ characterId: request.characterId, spices, seed: gate.seed });
}

export function royaleInit(run: RoyaleRun): ReplayInit {
  return {
    lives: run.spices.oneLife ? 1 : INITIAL_LIVES,
    activePower: run.spices.noCrew ? 'none' : run.activePower,
    ...(run.spices.noCrew ? {} : { crewCharges: { ...CREW_MAX_CHARGES } }),
    bossAssistTier: run.spices.noSecondWind ? 0 : run.assistTier,
    royale: { cleared: [...run.cleared], ...(run.seed !== undefined ? { shuffleSeed: run.seed } : {}) },
  };
}

// Quick kid switching follows the first-victory entitlement unless the Solo Kid spice is on.
export function royaleCanSwitch(run: RoyaleRun, campaignVictory: boolean): boolean {
  return campaignVictory && !run.spices.soloKid;
}

export function noteRoyaleKid(run: RoyaleRun, kid: string): RoyaleRun {
  return run.kids.includes(kid) ? run : { ...run, kids: [...run.kids, kid] };
}

// Every boss popped so far in the run (earlier attempts' pops spawn popped), in ladder order.
export function royaleClearedNames(team: TeamBossState): string[] {
  return team.members.flatMap((m, i) => (m.hp <= 0 ? [ROYALE_MEMBERS[i]!] : []));
}

// A wipe: carry the pops forward, raise Second Wind (unless spiced off), and bank this attempt's totals.
export function nextRoyaleAttempt(run: RoyaleRun, end: RoyaleAttemptEnd): RoyaleRun {
  return {
    ...noteRoyaleKid(run, end.activeKid),
    attempt: run.attempt + 1,
    cleared: [...end.cleared],
    assistTier: run.spices.noSecondWind ? 0 : Math.min(MAX_BOSS_ASSIST_TIER, run.assistTier + 1),
    totalFrames: run.totalFrames + Math.max(0, Math.trunc(end.frames)),
    totalDeaths: run.totalDeaths + Math.max(0, Math.trunc(end.deaths)),
    activeKid: end.activeKid,
    activePower: run.spices.noCrew ? 'none' : end.activePower,
  };
}

// The synthetic campaign session the play scene drives during a royale run. It is never saved.
export function royaleSession(run: RoyaleRun): CampaignSession {
  const base = createCampaignSession({
    characterId: run.activeKid,
    stageId: BOSS_ROYALE_ARENA.id,
    lives: run.spices.oneLife ? 1 : INITIAL_LIVES,
  });
  if (run.spices.noCrew) return base;
  return {
    ...base,
    rescuedCrew: Object.keys(CREW_POWER) as CrewFriend[],
    activePower: run.activePower as CrewPower,
    crewResources: { ...CREW_MAX_CHARGES },
  };
}

// The final pop: score the whole run, earn crowns, and bank it on the local record.
export function finishRoyaleRun(run: RoyaleRun, outcome: RoyaleClearOutcome, record: RoyaleRecord): { record: RoyaleRecord; award: RoyaleAward } {
  const frames = Math.max(1, run.totalFrames + Math.max(0, Math.trunc(outcome.frames)));
  const deaths = run.totalDeaths + Math.max(0, Math.trunc(outcome.deaths));
  const spices = spiceCount(run.spices);
  const score = calculateRoyaleScore({ frames, deaths, lives: outcome.lives, spices });
  const crowns = royaleCrowns({ frames, deaths, spices });
  const entry = { score: score.total, frames, characterId: run.characterId, kids: [...run.kids], spices };
  const submitted = submitRoyaleClear(record, entry, crowns);
  return {
    record: submitted.record,
    award: {
      score: score.total,
      breakdown: score.breakdown,
      frames,
      deaths,
      characterId: run.characterId,
      kids: [...run.kids],
      spices,
      crowns,
      newCrowns: submitted.newCrowns,
      scoreRank: submitted.scoreRank,
      timeRank: submitted.timeRank,
      newBestScore: submitted.newBestScore,
      newBestTime: submitted.newBestTime,
    },
  };
}
