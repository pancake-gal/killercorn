// Chrome bridge. The single seam between the Phaser sim and the React DOM chrome.
//
// Phaser is the SOLE source of truth for game state and scene transitions. The DOM never
// drives the sim directly: it emits *intents* (player wants to start/pause/...) which the
// boot wiring (src/main.ts) translates into Phaser-owned transitions, and it reads a
// *snapshot* the sim publishes (which logical view is active). Nothing is duplicated.
//
// Determinism (the One Rule) holds because intents are inert until Phaser applies them and
// the snapshot is a read-only copy — the DOM cannot mutate sim state through this channel.
//
// Two shapes on purpose:
//   intent   — a transient one-shot channel (a click happened now).
//   snapshot — a RETAINED store (the current view), shaped for useSyncExternalStore so a
//              snapshot published before React subscribes is never missed (it's read on mount).

import type { View } from '@/regime/derive';
import type { CrewFriend, CrewPower } from '@/campaign/session';
import type { TutorialCue } from '@/ui/tutorial';
import type { StageScoreAward } from '@/score/complete';
import type { RoyaleAward } from '@/royale/run';
import type { RoyaleSpices } from '@/royale/spices';

// DOM -> Phaser. Player-initiated requests. More variants slot in here as chrome grows.
//   start  — leave the title for character select.
//   select — a kid was picked; carries the chosen characterId, which the boot wiring threads into
//            PlayScene (configsForCharacter). Inert until Phaser applies it (the One Rule holds).
//   pause / resume — take a break / get back to it. PlayScene applies them (freezes/unfreezes its sim
//            step). Inert until Phaser applies them — the DOM never freezes the sim itself.
export type ChromeIntent =
  | { type: 'new-game' }
  | { type: 'cancel-new-game' }
  | { type: 'continue' }
  | { type: 'select'; characterId: string }
  | { type: 'switch-character' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'select-power'; power: CrewPower }
  | { type: 'restart-stage' }
  | { type: 'retry' }
  | { type: 'next-stage' } // the stage score card's Next button (PlayScene moves on once it may)
  | { type: 'quit-title' }
  | { type: 'replay-stage'; stageId: string }
  | { type: 'start-royale'; characterId: string; spices: RoyaleSpices } // title → a fresh Boss Royale run
  | { type: 'royale-again' }; // the Royale result's Mash Again: a fresh run with the same kid and spices

export interface CampaignChromeState {
  stageId: string;
  rescuedCrew: CrewFriend[];
  activePower: CrewPower | 'none';
  completedStageIds: string[];
  bestStageFrames?: Record<string, number>;
  bestStageCobs?: Record<string, number>;
  bestStageScores?: Record<string, number>;
  runScore?: number;
  completed: boolean;
}

export type ScoreAwardState = StageScoreAward;

// Phaser -> DOM. A read-only copy of what the sim wants the chrome to show.
//   view   — which logical screen is active.
//   paused — gameplay is frozen on a break (PlayScene publishes it). Optional so the existing
//            `snapshot.set({ view })` call sites stay valid; readers coerce `!!paused`.
export interface ChromeSnapshot {
  view: View;
  titleReady?: boolean;
  paused?: boolean;
  canContinue?: boolean;
  campaignVictory?: boolean;
  gameOver?: boolean;
  completed?: boolean;
  bossIntro?: boolean; // the boss title card is on screen; the control tip stays out of its way
  creditsRoll?: number; // deterministic finale-frame token; Chrome rolls each token once
  campaign?: CampaignChromeState;
  scoreAward?: ScoreAwardState;
  visualCue?: { id: number; text: string };
  tutorialCue?: TutorialCue;
  invisibility?: { remaining: number; recharge: number };
  switchCharacterId?: string; // current kid; absent when quick switching is locked
  royale?: { attempt: number }; // a Boss Royale run is live (its campaign state is synthetic, never saved)
  royaleAward?: RoyaleAward; // the Boss Royale clear just banked (the result panel reads it)
}

export interface TouchInput {
  left: boolean;
  right: boolean;
  jump: boolean;
  attack: boolean;
  power: boolean;
  ability?: boolean;
}

type Listener<T> = (value: T) => void;

// Transient one-shot channel. Listeners are cloned on emit so a listener that
// subscribes/unsubscribes during delivery can't corrupt the in-flight iteration.
// Exported as the shared reactive primitive (the audio bus reuses it — same seam shape).
export function channel<T>() {
  const listeners = new Set<Listener<T>>();
  return {
    emit(value: T): void {
      for (const listener of [...listeners]) listener(value);
    },
    on(listener: Listener<T>): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

// Retained store. Holds the latest value and notifies subscribers on change. The get/subscribe
// shape is exactly what React's useSyncExternalStore consumes (see Chrome.tsx). Exported as the
// shared reactive primitive (the audio settings store reuses it).
export function store<T>(initial: T) {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    get(): T {
      return current;
    },
    set(value: T): void {
      current = value;
      for (const notify of [...listeners]) notify();
    },
    subscribe(onChange: () => void): () => void {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
  };
}

export const intent = channel<ChromeIntent>();
export const snapshot = store<ChromeSnapshot>({ view: 'title', titleReady: false });
export const touch = store<TouchInput>({ left: false, right: false, jump: false, attack: false, power: false });
