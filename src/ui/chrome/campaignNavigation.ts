import { CAMPAIGN } from '@/campaign/definition';
import type { CampaignSession } from '@/campaign/session';
import { SCENE } from '@/scenes/keys';
import { toCampaignChromeState } from './campaignState';
import { snapshot } from './bus';

export interface CampaignSceneNavigator {
  isActive(key: string): boolean;
  stop(key: string): unknown;
  start(key: string, data?: object): unknown;
}

function retainedSnapshotWithoutCompletion() {
  const {
    creditsRoll: _previousCreditsRoll,
    scoreAward: _previousScoreAward,
    invisibility: _previousInvisibility,
    switchCharacterId: _previousSwitchCharacterId,
    royale: _previousRoyale,
    royaleAward: _previousRoyaleAward,
    ...previousSnapshot
  } = snapshot.get();
  return previousSnapshot;
}

export function publishCampaignTitle(session: CampaignSession, titleReady: boolean): void {
  snapshot.set({
    ...retainedSnapshotWithoutCompletion(),
    view: 'title',
    titleReady,
    paused: false,
    gameOver: false,
    canContinue: true,
    completed: false,
    campaign: toCampaignChromeState(session),
  });
}

// Back to the title from a run whose campaign state was synthetic (Boss Royale): show the real saved
// campaign, or, with none saved, no campaign at all.
export function publishSavedTitle(saved: CampaignSession | null, titleReady: boolean): void {
  if (saved) {
    publishCampaignTitle(saved, titleReady);
    return;
  }
  const { campaign: _syntheticCampaign, ...previousSnapshot } = retainedSnapshotWithoutCompletion();
  snapshot.set({
    ...previousSnapshot,
    view: 'title',
    titleReady,
    paused: false,
    gameOver: false,
    canContinue: false,
    completed: false,
  });
}

export function replayCompletedStage(
  scenes: CampaignSceneNavigator,
  session: CampaignSession,
  stageId: string,
): boolean {
  const level = CAMPAIGN.find((candidate) => candidate.id === stageId);
  const titleActive = scenes.isActive(SCENE.title);
  const playActive = scenes.isActive(SCENE.play);
  if (
    !level ||
    !session.completedStageIds.includes(level.id) ||
    (!titleActive && !playActive)
  ) {
    return false;
  }

  snapshot.set({
    ...retainedSnapshotWithoutCompletion(),
    view: 'level',
    paused: false,
    gameOver: false,
    completed: false,
  });

  if (titleActive) scenes.stop(SCENE.title);
  if (playActive) scenes.stop(SCENE.play);
  scenes.start(SCENE.play, {
    level,
    session: { ...session, stageId: level.id },
    replay: true,
  });
  return true;
}
