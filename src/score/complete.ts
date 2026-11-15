import { recordStageResult, type CampaignSession } from '@/campaign/session';
import { calculateStageScore } from './scoring';
import type { StageScoreBreakdown } from './scoring';
import {
  submitGameScore,
  submitLevelScore,
  type HighScores,
} from './highScores';

export interface CompletedWorldScore {
  frames: number;
  rawScore: number;
  lives: number;
  deaths: number;
  cobs: number;
  totalCobs?: number;
}

export interface CompletionOptions {
  recordCampaign: boolean;
  finalStage: boolean;
}

export interface StageScoreCompletion {
  session: CampaignSession;
  scores: HighScores;
  award: StageScoreAward;
}

export interface StageScoreAward {
  stageId: string;
  score: number;
  rank: number | null;
  newBest: boolean;
  frames: number;
  cobs: number;
  totalCobs: number;
  breakdown: StageScoreBreakdown;
  gameScore?: number;
  gameRank?: number | null;
  newGameBest?: boolean;
}

// One pure coordinator for every completion path. Replays can compete on a level board while the
// campaign aggregate remains untouched; only the terminal campaign clear enters the full-game list.
export function completeStageScore(
  session: CampaignSession,
  highScores: HighScores,
  stageId: string,
  world: CompletedWorldScore,
  options: CompletionOptions,
): StageScoreCompletion {
  const stageScore = calculateStageScore(world);
  const level = submitLevelScore(highScores, stageId, {
    score: stageScore.total,
    characterId: session.characterId,
    frames: Math.max(1, Math.trunc(world.frames)),
    cobs: Math.max(0, Math.trunc(world.cobs)),
  });
  const nextSession = options.recordCampaign
    ? recordStageResult(session, stageId, {
        frames: world.frames,
        cobs: world.cobs,
        score: stageScore.total,
      })
    : session;
  const award: StageScoreAward = {
    stageId,
    score: stageScore.total,
    rank: level.rank,
    newBest: level.newBest,
    frames: Math.max(1, Math.trunc(world.frames)),
    cobs: Math.max(0, Math.trunc(world.cobs)),
    totalCobs: Math.max(0, Math.trunc(world.totalCobs ?? world.cobs)),
    breakdown: stageScore.breakdown,
  };

  if (!options.recordCampaign || !options.finalStage) {
    return { session: nextSession, scores: level.scores, award };
  }

  const game = submitGameScore(level.scores, {
    score: nextSession.runScore,
    characterId: nextSession.characterId,
    frames: nextSession.runFrames,
    stages: Math.max(Object.keys(nextSession.bestStageScores).length, nextSession.completedStageIds.length + 1),
  });
  return {
    session: nextSession,
    scores: game.scores,
    award: {
      ...award,
      gameScore: nextSession.runScore,
      gameRank: game.rank,
      newGameBest: game.newBest,
    },
  };
}
