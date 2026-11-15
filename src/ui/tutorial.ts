export type TutorialAction = 'move' | 'jump' | 'attack' | 'power' | 'pause';

export type TutorialDevice = 'keyboard' | 'gamepad' | 'touch';

export type TutorialProgress = Record<TutorialAction, boolean>;

export interface TutorialCue {
  action: TutorialAction;
  text: string;
}

interface TutorialStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): unknown;
}

const TUTORIAL_STORAGE_KEY = 'killercorn.tutorial.v1';

export const DEFAULT_TUTORIAL_PROGRESS: TutorialProgress = {
  move: false,
  jump: false,
  attack: false,
  power: false,
  pause: false,
};

const LABELS: Record<TutorialDevice, Record<TutorialAction, string>> = {
  keyboard: {
    move: 'MOVE • A/D OR ARROWS',
    jump: 'JUMP • SPACE',
    attack: 'SWING • J',
    power: 'CREW POWER • L',
    pause: 'FIELD BREAK • ESC',
  },
  gamepad: {
    move: 'MOVE • LEFT STICK',
    jump: 'JUMP • A BUTTON',
    attack: 'SWING • B BUTTON',
    power: 'CREW POWER • X BUTTON',
    pause: 'FIELD BREAK • MENU',
  },
  touch: {
    move: 'MOVE • HOLD LEFT/RIGHT',
    jump: 'JUMP • TAP JUMP',
    attack: 'SWING • TAP SWING',
    power: 'CREW POWER • TAP CREW',
    pause: 'FIELD BREAK • TAP PAUSE',
  },
};

export function learnTutorialAction(
  progress: TutorialProgress,
  action: TutorialAction,
): TutorialProgress {
  if (progress[action]) return progress;
  return { ...progress, [action]: true };
}

export function nextTutorialCue(
  progress: TutorialProgress,
  device: TutorialDevice,
  hasPower: boolean,
): TutorialCue | undefined {
  const order: TutorialAction[] = ['move', 'jump', 'attack'];
  if (hasPower) order.push('power');
  order.push('pause');

  const action = order.find((candidate) => !progress[candidate]);
  return action ? { action, text: LABELS[device][action] } : undefined;
}

function browserStorage(): TutorialStorage | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const storage = window.localStorage;
    return typeof storage?.getItem === 'function' && typeof storage?.setItem === 'function'
      ? storage
      : undefined;
  } catch {
    return undefined;
  }
}

export function loadTutorialProgress(
  storage: TutorialStorage | undefined = browserStorage(),
): TutorialProgress {
  if (!storage) return { ...DEFAULT_TUTORIAL_PROGRESS };

  try {
    const saved = JSON.parse(storage.getItem(TUTORIAL_STORAGE_KEY) ?? 'null') as {
      version?: unknown;
      progress?: Partial<TutorialProgress>;
    } | null;
    const progress = saved?.version === 1 ? saved.progress : undefined;
    if (
      !progress ||
      (Object.keys(DEFAULT_TUTORIAL_PROGRESS) as TutorialAction[]).some(
        (action) => typeof progress[action] !== 'boolean',
      )
    ) {
      return { ...DEFAULT_TUTORIAL_PROGRESS };
    }
    return { ...DEFAULT_TUTORIAL_PROGRESS, ...progress };
  } catch {
    return { ...DEFAULT_TUTORIAL_PROGRESS };
  }
}

export function saveTutorialProgress(
  progress: TutorialProgress,
  storage: TutorialStorage | undefined = browserStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify({ version: 1, progress }));
  } catch {
    // A blocked storage API should never block play.
  }
}
