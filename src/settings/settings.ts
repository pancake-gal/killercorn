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

export function parseSettings(json: string | null, fallback: GameSettings = DEFAULT_SETTINGS): GameSettings {
  if (!json) return { ...fallback };
  try {
    const value = JSON.parse(json) as Partial<GameSettings>;
    if (
      value.schemaVersion !== SETTINGS_SCHEMA_VERSION ||
      typeof value.reducedMotion !== 'boolean' ||
      typeof value.highContrast !== 'boolean' ||
      (value.textScale !== 'normal' && value.textScale !== 'large') ||
      typeof value.visualCues !== 'boolean'
    ) return { ...fallback };
    return value as GameSettings;
  } catch {
    return { ...fallback };
  }
}

export function applySettings(value: GameSettings, root: HTMLElement = document.documentElement): void {
  root.dataset.reducedMotion = String(value.reducedMotion);
  root.dataset.highContrast = String(value.highContrast);
  root.dataset.textScale = value.textScale;
  root.dataset.visualCues = String(value.visualCues);
}

// Until the player saves a choice, reduced motion follows the device's "reduce motion" preference.
export function loadSettings(
  storage: Pick<Storage, 'getItem'> | null = safeStorage(),
  prefersReducedMotion: boolean = osPrefersReducedMotion(),
): GameSettings {
  return parseSettings(readStorage(storage, SETTINGS_KEY), { ...DEFAULT_SETTINGS, reducedMotion: prefersReducedMotion });
}

function osPrefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
