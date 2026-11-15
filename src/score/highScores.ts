import type { StorageLike } from '@/campaign/save';
import { readStorage, removeStorage, writeStorage } from '@/core/storage';

export const HIGH_SCORE_SCHEMA_VERSION = 1 as const;
export const HIGH_SCORE_KEY = 'killercorn.high-scores.v1';
export const HIGH_SCORE_RECOVERY_KEY = 'killercorn.high-scores.recovery';
export const HIGH_SCORE_LIMIT = 5;

export interface LevelScoreEntry {
  score: number;
  characterId: string;
  frames: number;
  cobs: number;
}

export interface GameScoreEntry {
  score: number;
  characterId: string;
  frames: number;
  stages: number;
}

export interface HighScores {
  schemaVersion: typeof HIGH_SCORE_SCHEMA_VERSION;
  levels: Record<string, LevelScoreEntry[]>;
  game: GameScoreEntry[];
}

export interface ScoreSubmission {
  scores: HighScores;
  rank: number | null;
  newBest: boolean;
}

function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function createHighScores(): HighScores {
  return { schemaVersion: HIGH_SCORE_SCHEMA_VERSION, levels: {}, game: [] };
}

function compareLevel(a: LevelScoreEntry, b: LevelScoreEntry): number {
  return b.score - a.score || a.frames - b.frames || b.cobs - a.cobs || compareId(a.characterId, b.characterId);
}

function compareGame(a: GameScoreEntry, b: GameScoreEntry): number {
  return b.score - a.score || a.frames - b.frames || b.stages - a.stages || compareId(a.characterId, b.characterId);
}

function compareId(a: string, b: string): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

export function submitLevelScore(scores: HighScores, stageId: string, entry: LevelScoreEntry): ScoreSubmission {
  const previous = scores.levels[stageId] ?? [];
  const ranked = [...previous, entry].sort(compareLevel);
  const rankIndex = ranked.indexOf(entry);
  const kept = ranked.slice(0, HIGH_SCORE_LIMIT);
  return {
    scores: { ...scores, levels: { ...scores.levels, [stageId]: kept } },
    rank: rankIndex < HIGH_SCORE_LIMIT ? rankIndex + 1 : null,
    newBest: previous.length === 0 || entry.score > previous[0]!.score,
  };
}

export function submitGameScore(scores: HighScores, entry: GameScoreEntry): ScoreSubmission {
  const ranked = [...scores.game, entry].sort(compareGame);
  const rankIndex = ranked.indexOf(entry);
  return {
    scores: { ...scores, game: ranked.slice(0, HIGH_SCORE_LIMIT) },
    rank: rankIndex < HIGH_SCORE_LIMIT ? rankIndex + 1 : null,
    newBest: scores.game.length === 0 || entry.score > scores.game[0]!.score,
  };
}

export function saveHighScores(scores: HighScores, storage: StorageLike | null = browserStorage()): boolean {
  return writeStorage(storage, HIGH_SCORE_KEY, JSON.stringify(scores));
}

export function loadHighScores(storage: StorageLike | null = browserStorage()): HighScores {
  const raw = readStorage(storage, HIGH_SCORE_KEY);
  if (!raw) return createHighScores();
  try {
    const value: unknown = JSON.parse(raw);
    if (!isHighScores(value)) throw new Error('Malformed high scores');
    return value;
  } catch {
    if (writeStorage(storage, HIGH_SCORE_RECOVERY_KEY, raw)) removeStorage(storage, HIGH_SCORE_KEY);
    return createHighScores();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCount(value: unknown, minimum = 0): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum;
}

function isLevelEntry(value: unknown): value is LevelScoreEntry {
  return isRecord(value) && isCount(value.score) && typeof value.characterId === 'string' && value.characterId.length > 0 &&
    isCount(value.frames, 1) && isCount(value.cobs);
}

function isGameEntry(value: unknown): value is GameScoreEntry {
  return isRecord(value) && isCount(value.score) && typeof value.characterId === 'string' && value.characterId.length > 0 &&
    isCount(value.frames, 1) && isCount(value.stages, 1);
}

function isHighScores(value: unknown): value is HighScores {
  if (!isRecord(value) || value.schemaVersion !== HIGH_SCORE_SCHEMA_VERSION || !isRecord(value.levels) || !Array.isArray(value.game)) return false;
  const levelsValid = Object.entries(value.levels).every(([stageId, entries]) => stageId.length > 0 && Array.isArray(entries) &&
    entries.length <= HIGH_SCORE_LIMIT && entries.every(isLevelEntry) && entries.every((entry, index) => index === 0 || compareLevel(entries[index - 1]!, entry) <= 0));
  const game = value.game;
  return levelsValid && game.length <= HIGH_SCORE_LIMIT && game.every(isGameEntry) &&
    game.every((entry, index) => index === 0 || compareGame(game[index - 1]!, entry) <= 0);
}
