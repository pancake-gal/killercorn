import { readStorage, writeStorage } from '@/core/storage';

export const BINDINGS_SCHEMA_VERSION = 1 as const;
export const BINDINGS_KEY = 'killercorn.bindings.v1';

export interface ActionBindings {
  moveLeft: string;
  moveRight: string;
  jump: string;
  attack: string;
  power: string;
  ability: string;
  switchCharacter: string;
  switchLeft: string;
  switchRight: string;
  pause: string;
  confirm: string;
  back: string;
}

export const DEFAULT_BINDINGS: ActionBindings = Object.freeze({
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  jump: 'Space',
  attack: 'KeyJ',
  power: 'KeyL',
  ability: 'KeyI',
  switchCharacter: 'KeyC',
  switchLeft: 'KeyQ',
  switchRight: 'KeyE',
  pause: 'Escape',
  confirm: 'Enter',
  back: 'Escape',
});

export function serializeBindings(value: ActionBindings): string {
  return JSON.stringify({ schemaVersion: BINDINGS_SCHEMA_VERSION, ...value });
}

export function parseBindings(json: string | null): ActionBindings {
  if (!json) return { ...DEFAULT_BINDINGS };
  try {
    const value = JSON.parse(json) as Record<string, unknown>;
    const entries = Object.keys(DEFAULT_BINDINGS) as (keyof ActionBindings)[];
    if (value.ability === undefined) value.ability = DEFAULT_BINDINGS.ability;
    if (value.switchCharacter === undefined) {
      // Adding a new action must not make an existing remap also switch the kid.
      // PlayScene's movement/combat/crew aliases stay active even after a remap.
      const aliases = ['KeyA', 'KeyD', 'KeyW', 'KeyJ', 'KeyK', 'KeyL', 'KeyQ', 'KeyE'];
      const candidates = [DEFAULT_BINDINGS.switchCharacter, ...Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ', (letter) => `Key${letter}`)];
      value.switchCharacter = candidates.find((code) => !aliases.includes(code) && !entries.some((key) => value[key] === code));
    }
    if (value.schemaVersion !== BINDINGS_SCHEMA_VERSION || !entries.every((key) => typeof value[key] === 'string' && value[key] !== '')) {
      return { ...DEFAULT_BINDINGS };
    }
    return Object.fromEntries(entries.map((key) => [key, value[key]])) as unknown as ActionBindings;
  } catch {
    return { ...DEFAULT_BINDINGS };
  }
}

export function loadBindings(storage: Pick<Storage, 'getItem'> | null = safeStorage()): ActionBindings {
  return parseBindings(readStorage(storage, BINDINGS_KEY));
}

export function saveBindings(value: ActionBindings, storage: Pick<Storage, 'setItem'> | null = safeStorage()): void {
  writeStorage(storage, BINDINGS_KEY, serializeBindings(value));
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

export interface GamepadLike {
  axes: readonly number[];
  buttons: readonly { pressed: boolean }[];
}

export interface DeviceActions {
  left: boolean;
  right: boolean;
  jump: boolean;
  attack: boolean;
  power: boolean;
  ability: boolean;
  switchCharacter: boolean;
  switchLeft: boolean;
  switchRight: boolean;
  pause: boolean;
  confirm: boolean;
  back: boolean;
}

export function gamepadActions(pad: GamepadLike | null | undefined): DeviceActions {
  const pressed = (index: number) => !!pad?.buttons[index]?.pressed;
  const horizontal = pad?.axes[0] ?? 0;
  return {
    left: horizontal < -0.35 || pressed(14),
    right: horizontal > 0.35 || pressed(15),
    jump: pressed(0),
    attack: pressed(1),
    power: pressed(2),
    ability: pressed(3),
    switchCharacter: pressed(11),
    switchLeft: pressed(4),
    switchRight: pressed(5),
    pause: pressed(9),
    confirm: pressed(0),
    back: pressed(1),
  };
}

export interface MenuGamepadActions {
  previous: boolean;
  next: boolean;
  confirm: boolean;
  back: boolean;
}

export function menuGamepadActions(pad: GamepadLike | null | undefined): MenuGamepadActions {
  const pressed = (index: number) => !!pad?.buttons[index]?.pressed;
  const vertical = pad?.axes[1] ?? 0;
  return {
    previous: vertical < -0.45 || pressed(12) || pressed(14),
    next: vertical > 0.45 || pressed(13) || pressed(15),
    confirm: pressed(0),
    back: pressed(1),
  };
}
