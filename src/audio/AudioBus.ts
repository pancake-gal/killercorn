// AudioBus — the Phaser-owned audio player. Owns nothing the sim depends on: it reads the
// audio-settings store (mute/volume) and the world deltas the scene feeds it, and plays cues.
// It NEVER writes to the deterministic sim, so the One Rule holds (audio is a side effect of
// state, not an input). The thin presentation wrapper around Phaser's sound manager; the
// testable logic (which cue, which path, mute) lives in events.ts / resolve.ts / bus.ts.

import Phaser from 'phaser';
import { cuesOfKind } from './resolve';
import { audioSettings, uiSound, type AudioSettings } from './bus';
import { musicPhaseFraction, musicSeekSeconds } from './musicTransition';

const MUSIC_VOLUME = 0.6;
const MUSIC_CROSSFADE_MS = 450;
// All SFX are peak-normalized to one ceiling, so relative balance is set here at playback.
const SFX_VOLUME: Record<string, number> = {
  ui: 0.4,
  land: 0.5,
  jump: 0.55,
  collect: 0.6,
  hurt: 0.6,
  squish: 0.65,
  swing: 0.45,
  'boss-roar': 0.85,
  throw: 0.4,
  'box-break': 0.6,
  'power-up': 0.6,
  'free-ally': 0.65,
  'rage-roar': 0.9, // King Corn's tantrum bellow — loud, it's a beat
  'hop-thud': 0.5, // a boss landing a hop — a soft pumpkin-on-turf thump
  'boss-windup': 0.35, // the telegraph crank — a quiet tell, never a nag (it fires every attack)
  'slam-thud': 0.7, // a boss slam hitting the field — the heavy twin of the hop thud
  'boss-defeat': 0.8, // the comedic give-up womp — a beat, it ends the fight
};

export class AudioBus {
  private scene: Phaser.Scene;
  private music: MusicSound | undefined;
  private musicLayers = new Set<MusicSound>();
  private offSettings: () => void;
  private offUi: () => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.apply(audioSettings.get());
    this.offSettings = audioSettings.subscribe(() => this.apply(audioSettings.get()));
    this.offUi = uiSound.on(() => this.playSfx('ui'));
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    scene.events.once(Phaser.Scenes.Events.DESTROY, () => this.destroy());
  }

  // Load every cue into the scene loader (call from a scene preload()). Skips already-cached keys.
  static preload(scene: Phaser.Scene, cueIds?: Iterable<string>): void {
    const wanted = cueIds ? new Set(cueIds) : null;
    for (const c of [...cuesOfKind('music'), ...cuesOfKind('sfx')]) {
      if (wanted && !wanted.has(c.id)) continue;
      if (!scene.cache.audio.exists(c.id)) scene.load.audio(c.id, c.path);
    }
  }

  playMusic(id: string, options: { startFraction?: number; preservePhase?: boolean; fadeMs?: number } = {}): void {
    if (!this.scene.cache.audio.exists(id)) return;
    const previous = this.music;
    if (previous?.key === id && previous.isPlaying) return;

    const fraction = options.preservePhase && previous
      ? musicPhaseFraction(previous.duration, previous.seek, options.startFraction ?? 0)
      : (options.startFraction ?? 0);
    const musicVolume = this.musicVolume();
    const next = this.scene.sound.add(id, { loop: true, volume: musicVolume }) as MusicSound;
    const seek = musicSeekSeconds(next.duration, fraction);
    const fadeMs = previous ? Math.max(0, options.fadeMs ?? MUSIC_CROSSFADE_MS) : 0;

    if (!previous || fadeMs === 0) {
      this.stopMusic();
      this.music = next;
      this.musicLayers.add(next);
      next.play({ loop: true, volume: musicVolume, seek });
      return;
    }

    this.music = next;
    this.musicLayers.add(next);
    next.play({ loop: true, volume: 0, seek });
    this.scene.tweens.killTweensOf(previous);
    this.scene.tweens.add({
      targets: previous,
      volume: 0,
      duration: fadeMs,
      ease: 'Linear',
      onComplete: () => this.releaseMusic(previous),
    });
    this.scene.tweens.add({ targets: next, volume: musicVolume, duration: fadeMs, ease: 'Linear' });
  }

  stopMusic(): void {
    for (const layer of this.musicLayers) this.releaseMusic(layer);
    this.musicLayers.clear();
    this.music = undefined;
  }

  // Pause/resume the bed on a break (presentation only — the sim is frozen by the scene, this just
  // hushes the loop so a break isn't scored over blaring music). Safe no-ops if nothing is playing.
  pauseMusic(): void {
    for (const layer of this.musicLayers) if (layer.isPlaying) layer.pause();
  }

  resumeMusic(): void {
    for (const layer of this.musicLayers) if (layer.isPaused) layer.resume();
  }

  playSfx(id: string): void {
    if (!this.scene.cache.audio.exists(id)) return;
    this.scene.sound.play(id, { volume: (SFX_VOLUME[id] ?? 0.6) * audioSettings.get().sfxVolume });
  }

  // Mute/volume are the global sound-manager props, so one toggle governs all cues.
  private apply(s: AudioSettings): void {
    this.scene.sound.mute = s.muted;
    this.scene.sound.volume = s.volume;
    if (this.music) this.music.volume = MUSIC_VOLUME * s.musicVolume;
  }

  private musicVolume(): number {
    return MUSIC_VOLUME * audioSettings.get().musicVolume;
  }

  private releaseMusic(sound: MusicSound): void {
    this.scene.tweens.killTweensOf(sound);
    sound.stop();
    sound.destroy();
    this.musicLayers.delete(sound);
  }

  destroy(): void {
    this.offSettings?.();
    this.offUi?.();
    this.stopMusic();
  }
}

type MusicSound = Phaser.Sound.BaseSound & {
  volume: number;
  seek: number;
};
