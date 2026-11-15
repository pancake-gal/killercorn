import { useEffect, useState } from 'react';
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

type TouchIconName = Extract<ControlIconName, 'left' | 'right' | 'jump' | 'swing' | 'power'>;

function detectCoarsePointer(): boolean {
  if (typeof window === 'undefined') return false;
  return !!window.matchMedia?.('(pointer: coarse)').matches;
}

export function TouchControls({ powerAvailable = true, abilityAvailable = false }: TouchControlsProps) {
  const [coarse] = useState(detectCoarsePointer);
  const [pressed, setPressed] = useState<TouchInput>(() => ({ ...ALL_UP }));
  const [usedHints, setUsedHints] = useState(loadUsedHints);

  // A finger "held" when the tab backgrounds or the window blurs must not carry a stuck input into
  // resume (the app already auto-pauses on blur). Reset on both, and on unmount (the overlay leaves the
  // 'level' view / a break opens). Pointer capture already releases on blur; this is the explicit guard.
  useEffect(() => {
    if (!coarse) return;
    document.documentElement.classList.add('touch-gameplay-active');
    const clear = (): void => {
      touch.set({ ...ALL_UP });
      setPressed({ ...ALL_UP });
    };
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', clear);
    return () => {
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', clear);
      document.documentElement.classList.remove('touch-gameplay-active');
      touch.set({ ...ALL_UP }); // nothing left held when the controls unmount
    };
  }, [coarse]);

  if (!coarse) return null;

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
      data-pressed={pressed[field]}
      data-hint={!disabled && !usedHints.has(HINT_GROUP[field])}
      aria-label={label}
      disabled={disabled}
      onPointerDown={(e) => {
        e.preventDefault();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* pointer capture unsupported — pointerup on the button still fires */
        }
        hold(field, true);
      }}
      onPointerUp={() => hold(field, false)}
      onPointerCancel={() => hold(field, false)}
      onLostPointerCapture={() => hold(field, false)}
    >
      <span className="touch-glyph" data-touch-icon={glyph} aria-hidden="true"><ControlIcon name={glyph} /></span>
      <span className="touch-label" aria-hidden="true">{visualLabel}</span>
    </button>
  );

  return (
    <div className="touch-controls" data-testid="touch-controls">
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
        {btn('attack', 'touch-attack', 'Swing', 'swing', 'SWING', 'touch-btn touch-act touch-attack')}
        {btn('jump', 'touch-jump', 'Jump', 'jump', 'JUMP', 'touch-btn touch-act touch-jump')}
      </div>
    </div>
  );
}
