import type { StorageLike } from '@/campaign/save';
import { readStorage, removeStorage, writeStorage } from '@/core/storage';
import { ROYALE_CROWNS, type RoyaleCrown } from './score';
import { ROYALE_SPICES } from './spices';

export const ROYALE_RECORD_SCHEMA_VERSION = 1 as const;
export const ROYALE_RECORD_KEY = 'killercorn.royale.v1';
export const ROYALE_RECORD_RECOVERY_KEY = 'killercorn.royale.recovery';
export const ROYALE_BOARD_LIMIT = 5;

export interface RoyaleScoreEntry {
  score: number;
  frames: number;
  characterId: string; // the starting kid
  kids: string[]; // every kid used, in order
  spices: number; // spice toggles on
}

export interface RoyaleRecord {
  schemaVersion: typeof ROYALE_RECORD_SCHEMA_VERSION;
  clears: number;
  crowns: RoyaleCrown[]; // earned at least once, in display order
  scores: RoyaleScoreEntry[];
  times: RoyaleScoreEntry[];
}

export interface RoyaleClearSubmission {
  record: RoyaleRecord;
  scoreRank: number | null;
  timeRank: number | null;
  newBestScore: boolean;
  newBestTime: boolean;
  newCrowns: RoyaleCrown[];
}

function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function createRoyaleRecord(): RoyaleRecord {
  return { schemaVersion: ROYALE_RECORD_SCHEMA_VERSION, clears: 0, crowns: [], scores: [], times: [] };
}

// Spices open after the first Royale clear.
export function spicesUnlocked(record: RoyaleRecord): boolean {
  return record.clears > 0;
}

function compareId(a: string, b: string): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

function compareScore(a: RoyaleScoreEntry, b: RoyaleScoreEntry): number {
  return b.score - a.score || a.frames - b.frames || b.spices - a.spices || compareId(a.characterId, b.characterId);
}

function compareTime(a: RoyaleScoreEntry, b: RoyaleScoreEntry): number {
  return a.frames - b.frames || b.score - a.score || b.spices - a.spices || compareId(a.characterId, b.characterId);
}

function rank(board: RoyaleScoreEntry[], entry: RoyaleScoreEntry, compare: (a: RoyaleScoreEntry, b: RoyaleScoreEntry) => number) {
  const ranked = [...board, entry].sort(compare);
  const index = ranked.indexOf(entry);
  return { kept: ranked.slice(0, ROYALE_BOARD_LIMIT), rank: index < ROYALE_BOARD_LIMIT ? index + 1 : null };
}

export function submitRoyaleClear(record: RoyaleRecord, entry: RoyaleScoreEntry, crowns: readonly RoyaleCrown[]): RoyaleClearSubmission {
  const scores = rank(record.scores, entry, compareScore);
  const times = rank(record.times, entry, compareTime);
  const newCrowns = crowns.filter((crown) => !record.crowns.includes(crown));
  return {
    record: {
      ...record,
      clears: record.clears + 1,
      crowns: ROYALE_CROWNS.filter((crown) => record.crowns.includes(crown) || crowns.includes(crown)),
      scores: scores.kept,
      times: times.kept,
    },
    scoreRank: scores.rank,
    timeRank: times.rank,
    newBestScore: record.scores.length === 0 || entry.score > record.scores[0]!.score,
    newBestTime: record.times.length === 0 || entry.frames < record.times[0]!.frames,
    newCrowns,
  };
}

export function saveRoyaleRecord(record: RoyaleRecord, storage: StorageLike | null = browserStorage()): boolean {
  return writeStorage(storage, ROYALE_RECORD_KEY, JSON.stringify(record));
}

export function loadRoyaleRecord(storage: StorageLike | null = browserStorage()): RoyaleRecord {
  const raw = readStorage(storage, ROYALE_RECORD_KEY);
  if (!raw) return createRoyaleRecord();
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRoyaleRecord(value)) throw new Error('Malformed royale record');
    return value;
  } catch {
    if (writeStorage(storage, ROYALE_RECORD_RECOVERY_KEY, raw)) removeStorage(storage, ROYALE_RECORD_KEY);
    return createRoyaleRecord();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCount(value: unknown, minimum = 0): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum;
}

function isEntry(value: unknown): value is RoyaleScoreEntry {
  return isRecord(value) && isCount(value.score) && isCount(value.frames, 1) &&
    typeof value.characterId === 'string' && value.characterId.length > 0 &&
    Array.isArray(value.kids) && value.kids.length >= 1 && value.kids.length <= 6 &&
    value.kids.every((kid) => typeof kid === 'string' && kid.length > 0) && new Set(value.kids).size === value.kids.length &&
    isCount(value.spices) && (value.spices as number) <= ROYALE_SPICES.length;
}

function isBoard(value: unknown, compare: (a: RoyaleScoreEntry, b: RoyaleScoreEntry) => number): value is RoyaleScoreEntry[] {
  return Array.isArray(value) && value.length <= ROYALE_BOARD_LIMIT && value.every(isEntry) &&
    value.every((entry, index) => index === 0 || compare(value[index - 1]!, entry) <= 0);
}

function isRoyaleRecord(value: unknown): value is RoyaleRecord {
  return isRecord(value) && value.schemaVersion === ROYALE_RECORD_SCHEMA_VERSION && isCount(value.clears) &&
    Array.isArray(value.crowns) && value.crowns.every((crown) => (ROYALE_CROWNS as readonly unknown[]).includes(crown)) &&
    new Set(value.crowns).size === value.crowns.length &&
    isBoard(value.scores, compareScore) && isBoard(value.times, compareTime);
}
