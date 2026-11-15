import type { CampaignSession } from '@/campaign/session';
import type { CampaignChromeState } from './bus';

// One-way presentation copy. React receives no mutable reference owned by the campaign session.
export function toCampaignChromeState(session: CampaignSession): CampaignChromeState {
  return {
    stageId: session.stageId,
    rescuedCrew: [...session.rescuedCrew],
    activePower: session.activePower,
    completedStageIds: [...session.completedStageIds],
    bestStageFrames: { ...session.bestStageFrames },
    bestStageCobs: { ...session.bestStageCobs },
    bestStageScores: { ...session.bestStageScores },
    runScore: session.runScore,
    completed: session.completed,
  };
}
