import { deserializeCampaign, serializeCampaign, type CampaignSession } from './session';
import { readStorage, removeStorage, writeStorage } from '@/core/storage';
import { loadHighScores } from '@/score/highScores';

export const CAMPAIGN_SAVE_KEY = 'killercorn.campaign.v1';
export const CAMPAIGN_RECOVERY_KEY = 'killercorn.campaign.recovery';
export const CAMPAIGN_VICTORY_KEY = 'killercorn.victory.v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function saveCampaign(session: CampaignSession, storage: StorageLike | null = browserStorage()): boolean {
  // Bank the first victory before a new run can replace the completed save.
  if (session.completed || hasCampaignVictory(storage)) {
    writeStorage(storage, CAMPAIGN_VICTORY_KEY, 'true');
  }
  return writeStorage(storage, CAMPAIGN_SAVE_KEY, serializeCampaign(session));
}

export function hasCampaignVictory(storage: StorageLike | null = browserStorage()): boolean {
  if (readStorage(storage, CAMPAIGN_VICTORY_KEY) === 'true') return true;
  const raw = readStorage(storage, CAMPAIGN_SAVE_KEY);
  if (raw) {
    try {
      if (deserializeCampaign(raw).completed) return true;
    } catch {
      // A malformed campaign cannot prove a victory; a validated full-game score still can.
    }
  }
  return loadHighScores(storage).game.length > 0;
}

export function loadCampaign(storage: StorageLike | null = browserStorage()): CampaignSession | null {
  const raw = readStorage(storage, CAMPAIGN_SAVE_KEY);
  if (!raw) return null;
  try {
    return deserializeCampaign(raw);
  } catch {
    if (writeStorage(storage, CAMPAIGN_RECOVERY_KEY, raw)) removeStorage(storage, CAMPAIGN_SAVE_KEY);
    return null;
  }
}

export function clearCampaign(
  storage: StorageLike | null = browserStorage(),
  options: { includeRecovery?: boolean } = {},
): void {
  if (hasCampaignVictory(storage)) writeStorage(storage, CAMPAIGN_VICTORY_KEY, 'true');
  removeStorage(storage, CAMPAIGN_SAVE_KEY);
  if (options.includeRecovery) removeStorage(storage, CAMPAIGN_RECOVERY_KEY);
}

export function hasCampaignSave(storage: StorageLike | null = browserStorage()): boolean {
  return readStorage(storage, CAMPAIGN_SAVE_KEY) !== null;
}
