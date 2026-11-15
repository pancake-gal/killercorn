import { readStorage, writeStorage } from '@/core/storage';

export const SETTINGS_SCHEMA_VERSION = 1 as const;
export const SETTINGS_KEY = 'killercorn.settings.v1';

export interface GameSettings {
  schemaVersion: typeof SETTINGS_SCHEMA_VERSION;
  reducedMotion: boolean;
  highContrast: boolean;
  textScale: 'normal' | 'large';
  visualCues: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = Object.freeze({
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  reducedMotion: false,
  highContrast: false,
  textScale: 'normal',
  visualCues: true,
});

export function serializeSettings(value: GameSettings): string {
  return JSON.stringify(value);
}

export function parseSettings(json: string | null): GameSettings {
  if (!json) return { ...DEFAULT_SETTINGS };
  try {
    const value = JSON.parse(json) as Partial<GameSettings>;
    if (
      value.schemaVersion !== SETTINGS_SCHEMA_VERSION ||
      typeof value.reducedMotion !== 'boolean' ||
      typeof value.highContrast !== 'boolean' ||
      (value.textScale !== 'normal' && value.textScale !== 'large') ||
      typeof value.visualCues !== 'boolean'
    ) return { ...DEFAULT_SETTINGS };
    return value as GameSettings;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function applySettings(value: GameSettings, root: HTMLElement = document.documentElement): void {
  root.dataset.reducedMotion = String(value.reducedMotion);
  root.dataset.highContrast = String(value.highContrast);
  root.dataset.textScale = value.textScale;
  root.dataset.visualCues = String(value.visualCues);
}

export function loadSettings(storage: Pick<Storage, 'getItem'> | null = safeStorage()): GameSettings {
  return parseSettings(readStorage(storage, SETTINGS_KEY));
}

export function saveSettings(value: GameSettings, storage: Pick<Storage, 'setItem'> | null = safeStorage()): void {
  writeStorage(storage, SETTINGS_KEY, serializeSettings(value));
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function' || typeof localStorage.setItem !== 'function'
      ? null
      : localStorage;
  } catch {
    return null;
  }
}
