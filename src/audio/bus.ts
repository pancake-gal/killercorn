// Audio bus — the seam between the React chrome and the Phaser-owned AudioBus, mirroring
// the chrome bus exactly. Presentation-only: this carries mute/volume settings and UI-click
// requests; it never touches the deterministic sim, so the One Rule holds (audio is a
// downstream side effect of game state, never an input to it).
//
//   audioSettings — a RETAINED store (current mute/volume), shaped for useSyncExternalStore.
//   uiSound       — a transient channel: the chrome asks for a one-shot UI blip.

import { channel, store } from '@/ui/chrome/bus';

export interface AudioSettings {
  muted: boolean;
  volume: number; // 0..1 master
  musicVolume: number; // 0..1 within the master mix
  sfxVolume: number; // 0..1 within the master mix
}

const MUTE_KEY = 'kc.audio.muted';
const VOLUME_KEY = 'kc.audio.volume';
const MUSIC_VOLUME_KEY = 'kc.audio.music-volume';
const SFX_VOLUME_KEY = 'kc.audio.sfx-volume';
const DEFAULT_VOLUME = 0.8;

// Persist the player's mute choice across reloads (browser-only; guarded for non-DOM envs).
function initialMuted(): boolean {
  try {
    return globalThis.localStorage?.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function initialVolume(key: string): number {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (raw === null || raw === undefined || raw.trim() === '') return DEFAULT_VOLUME;
    const saved = Number(raw);
    return Number.isFinite(saved) && saved >= 0 && saved <= 1 ? saved : DEFAULT_VOLUME;
  } catch {
    return DEFAULT_VOLUME;
  }
}

export const audioSettings = store<AudioSettings>({
  muted: initialMuted(),
  volume: initialVolume(VOLUME_KEY),
  musicVolume: initialVolume(MUSIC_VOLUME_KEY),
  sfxVolume: initialVolume(SFX_VOLUME_KEY),
});
export const uiSound = channel<void>();

export function setMuted(muted: boolean): void {
  try {
    globalThis.localStorage?.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // no-op when storage is unavailable
  }
  audioSettings.set({ ...audioSettings.get(), muted });
}

export function toggleMuted(): void {
  setMuted(!audioSettings.get().muted);
}

export function setVolume(volume: number): void {
  setLevel('volume', VOLUME_KEY, volume);
}

export function setMusicVolume(volume: number): void {
  setLevel('musicVolume', MUSIC_VOLUME_KEY, volume);
}

export function setSfxVolume(volume: number): void {
  setLevel('sfxVolume', SFX_VOLUME_KEY, volume);
}

function setLevel(key: 'volume' | 'musicVolume' | 'sfxVolume', storageKey: string, volume: number): void {
  const next = Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 1));
  try {
    globalThis.localStorage?.setItem(storageKey, String(next));
  } catch {
    // no-op when storage is unavailable
  }
  audioSettings.set({ ...audioSettings.get(), [key]: next });
}
