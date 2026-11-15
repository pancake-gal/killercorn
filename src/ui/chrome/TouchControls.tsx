import { useEffect, useRef, useState } from 'react';
import { touch, type TouchInput } from './bus';
import { ControlIcon, type ControlIconName } from './ControlIcon';
import { BONUS_CHARACTER_COPY } from '@/content/bonusCharacters';
import { readStorage, writeStorage } from '@/core/storage';

const ALL_UP: TouchInput = { left: false, right: false, jump: false, attack: false, power: false };

// First-run hint: each control pulses until its first press so a new player can find the glass
// buttons. Left and right are one "move" control. Used controls are remembered on this device, so
// the pulse never returns on the next stage; blocked storage just means it shows again next visit.
type HintGroup = 'move' | 'jump' | 'attack' | 'power' | 'ability';
const HINT_GROUP: Record<keyof TouchInput, HintGroup> = {
  left: 'move',
  right: 'move',
  jump: 'jump',
  attack: 'attack',
  power: 'power',
  ability: 'ability',
};
const HINT_STORAGE_KEY = 'killercorn.touch-hints.v1';

// Some privacy contexts throw from the localStorage getter itself.
function deviceStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function loadUsedHints(): ReadonlySet<string> {
  try {
    const saved: unknown = JSON.parse(readStorage(deviceStorage(), HINT_STORAGE_KEY) ?? '[]');
    return new Set(Array.isArray(saved) ? saved.filter((item): item is string => typeof item === 'string') : []);
  } catch {
    return new Set();
  }
}

export interface TouchControlsProps {
  powerAvailable?: boolean;
  abilityAvailable?: boolean;
}

type TouchIconName = Extract<ControlIconName, 'left' | 'right' | 'jump' | 'sword' | 'power'>;

const FIELD_ATTR = 'data-touch-field';

function detectCoarsePointer(): boolean {
  if (typeof window === 'undefined') return false;
  return !!window.matchMedia?.('(pointer: coarse)').matches;
}

export function TouchControls({ powerAvailable = true, abilityAvailable = false }: TouchControlsProps) {
  const [coarse] = useState(detectCoarsePointer);
  const [pressed, setPressed] = useState<TouchInput>(() => ({ ...ALL_UP }));
  const [usedHints, setUsedHints] = useState(loadUsedHints);
  const rootRef = useRef<HTMLDivElement>(null);
  const holdRef = useRef<(field: keyof TouchInput, held: boolean) => void>(() => {});

  // A finger "held" when the tab backgrounds or the window blurs must not carry a stuck input into
  // resume (the app already auto-pauses on blur). Reset on both, and on unmount (the overlay leaves the
  // 'level' view / a break opens).
  useEffect(() => {
    if (!coarse) return;
    const root = rootRef.current;
    document.documentElement.classList.add('touch-gameplay-active');
    // Finger identifier -> the control it landed on. A touch keeps its start target for its whole life,
    // so a finger that slides off its button still lifts here (no stuck input).
    const fingers = new Map<number, keyof TouchInput>();
    const clear = (): void => {
      fingers.clear();
      touch.set({ ...ALL_UP });
      setPressed({ ...ALL_UP });
    };
    const start = (event: TouchEvent): void => {
      event.preventDefault();
      for (const finger of Array.from(event.changedTouches)) {
        const target = finger.target instanceof Element ? finger.target : null;
        const button = target?.closest<HTMLButtonElement>(`[${FIELD_ATTR}]`);
        if (!button || button.disabled) continue;
        const field = button.getAttribute(FIELD_ATTR) as keyof TouchInput;
        fingers.set(finger.identifier, field);
        holdRef.current(field, true);
      }
    };
    const end = (event: TouchEvent): void => {
      for (const finger of Array.from(event.changedTouches)) {
        const field = fingers.get(finger.identifier);
        if (!field) continue;
        fingers.delete(finger.identifier);
        if (![...fingers.values()].includes(field)) holdRef.current(field, false);
      }
    };
    root?.addEventListener('touchstart', start, { passive: false });
    root?.addEventListener('touchend', end);
    root?.addEventListener('touchcancel', end);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', clear);
    return () => {
      root?.removeEventListener('touchstart', start);
      root?.removeEventListener('touchend', end);
      root?.removeEventListener('touchcancel', end);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', clear);
      document.documentElement.classList.remove('touch-gameplay-active');
      touch.set({ ...ALL_UP }); // nothing left held when the controls unmount
    };
  }, [coarse]);

  // Read-modify-write the shared held object so simultaneous holds (move + jump + attack) coexist.
  const hold = (field: keyof TouchInput, held: boolean): void => {
    touch.set({ ...touch.get(), [field]: held });
    setPressed((current) => ({ ...current, [field]: held }));
    const group = HINT_GROUP[field];
    if (held && !usedHints.has(group)) {
      const next = new Set(usedHints).add(group);
      setUsedHints(next);
      writeStorage(deviceStorage(), HINT_STORAGE_KEY, JSON.stringify([...next]));
    }
  };
  // The native listeners outlive renders; point them at the hold that sees current hint state.
  useEffect(() => {
    holdRef.current = hold;
  });

  if (!coarse) return null;

  const btn = (
    field: keyof TouchInput,
    testid: string,
    label: string,
    glyph: TouchIconName,
    visualLabel: string,
    className: string,
    disabled = false,
  ) => (
    <button
      type="button"
      className={className}
      data-testid={testid}
      data-touch-field={field}
      data-pressed={pressed[field]}
      data-hint={!disabled && !usedHints.has(HINT_GROUP[field])}
      aria-label={label}
      disabled={disabled}
    >
      <span className="touch-glyph" data-touch-icon={glyph} aria-hidden="true"><ControlIcon name={glyph} /></span>
      <span className="touch-label" aria-hidden="true">{visualLabel}</span>
    </button>
  );

  return (
    <div className="touch-controls" data-testid="touch-controls" ref={rootRef}>
      {abilityAvailable && btn('ability', 'touch-ability', BONUS_CHARACTER_COPY.ability, 'power', 'HIDE', 'touch-btn touch-act touch-ability')}
      <div className="touch-pad">
        {btn('left', 'touch-left', 'Move left', 'left', 'LEFT', 'touch-btn touch-dir')}
        {btn('right', 'touch-right', 'Move right', 'right', 'RIGHT', 'touch-btn touch-dir')}
      </div>
      <div className="touch-actions">
        {btn(
          'power',
          'touch-power',
          powerAvailable ? 'Use crew power' : 'Crew power locked',
          'power',
          powerAvailable ? 'CREW' : 'LOCKED',
          'touch-btn touch-act touch-power',
          !powerAvailable,
        )}
        {btn('attack', 'touch-attack', 'Swing', 'sword', 'SWING', 'touch-btn touch-act touch-attack')}
        {btn('jump', 'touch-jump', 'Jump', 'jump', 'JUMP', 'touch-btn touch-act touch-jump')}
      </div>
    </div>
  );
}
