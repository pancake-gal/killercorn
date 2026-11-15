import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { STRINGS } from '@/content/strings';
import { CREW_POWER, type CrewFriend, type CrewPower } from '@/campaign/session';
import { ControlIcon } from './ControlIcon';
import { ACTIVATION_KEYS } from './dialog';

export interface PauseControlProps {
  paused: boolean;
  onPause: () => void;
  onResume: () => void;
  onRestart?: () => void;
  onQuit?: () => void;
  rescuedCrew?: CrewFriend[];
  activePower?: CrewPower | 'none';
  onSelectPower?: (power: CrewPower) => void;
  onSettings?: () => void;
  onWorldMap?: () => void;
  restartLabel?: string; // Boss Royale restarts the run, not a stage
}

const FOCUSABLE = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

const CREW_NAMES: Record<CrewFriend, string> = {
  strawberry: 'Strawberry: Berry Rush',
  carrot: 'Carrot: Long Reach',
  blueberry: 'Blueberry: Blue Bounce',
  lettuce: 'Lettuce: Leaf Guard',
  banana: 'Banana: Peel Toss',
};

export function PauseControl({ paused, onPause, onResume, onRestart, onQuit, rescuedCrew = [], activePower = 'none', onSelectPower, onSettings, onWorldMap, restartLabel = STRINGS.restartStage }: PauseControlProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const pauseRef = useRef<HTMLButtonElement>(null);
  const resumeRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef(false);
  const pauseHadFocusRef = useRef(false);

  useEffect(() => {
    if (paused) {
      restoreRef.current = true;
      resumeRef.current?.focus({ preventScroll: true }); // keep the title and crew in view on a short screen
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onResume();
          return;
        }
        if (event.key !== 'Tab') return;
        const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
        if (controls.length === 0) return;
        const first = controls[0]!;
        const last = controls.at(-1)!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      };
      document.addEventListener('keydown', onKeyDown);
      return () => document.removeEventListener('keydown', onKeyDown);
    }
    if (restoreRef.current) {
      restoreRef.current = false;
      if (pauseHadFocusRef.current) pauseRef.current?.focus();
    }
  }, [paused, onResume]);

  if (paused) {
    // The paused stage still captures SPACE (and any bound key) at the window, which would cancel the
    // press before a focused button activates. Play is frozen, so the break keeps those keys to itself.
    const keepActivationKeys = (event: ReactKeyboardEvent) => {
      if (ACTIVATION_KEYS.has(event.key)) event.stopPropagation();
    };
    return (
      <div ref={dialogRef} className="pause-overlay" data-testid="pause-overlay" role="dialog" aria-modal="true" aria-label={STRINGS.pauseTitle} onKeyDown={keepActivationKeys} onKeyUp={keepActivationKeys}>
        <div className="pause-card pause-menu">
          <h2 className="pause-title">{STRINGS.pauseTitle}</h2>
          {rescuedCrew.length > 0 && (
            <fieldset className="crew-picker">
              <legend>Active Crew Power</legend>
              {rescuedCrew.map((friend) => {
                const power = CREW_POWER[friend];
                return (
                  <button
                    type="button"
                    className="btn-secondary"
                    aria-pressed={activePower === power}
                    key={friend}
                    onClick={() => onSelectPower?.(power)}
                  >
                    {CREW_NAMES[friend]}
                  </button>
                );
              })}
            </fieldset>
          )}
          <button ref={resumeRef} type="button" className="btn-primary" data-testid="resume-button" onClick={onResume}>
            {STRINGS.resume}
          </button>
          {onSettings && <button type="button" className="btn-secondary" onClick={onSettings}>Settings</button>}
          {onWorldMap && <button type="button" className="btn-secondary" onClick={onWorldMap}>World Map</button>}
          {onRestart && <button type="button" className="btn-secondary" data-testid="restart-button" onClick={onRestart}>{restartLabel}</button>}
          {onQuit && <button type="button" className="btn-secondary" data-testid="quit-button" onClick={onQuit}>{STRINGS.quitToTitle}</button>}
        </div>
      </div>
    );
  }
  return (
    <button
      type="button"
      ref={pauseRef}
      className="pause-control"
      data-testid="pause-button"
      aria-label={STRINGS.pause}
      title={STRINGS.pause}
      onClick={onPause}
      onFocus={() => { pauseHadFocusRef.current = true; }}
      onBlur={() => { pauseHadFocusRef.current = false; }}
    >
      <span className="utility-glyph" aria-hidden="true"><ControlIcon name="pause" /></span>
    </button>
  );
}
