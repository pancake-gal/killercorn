import { useEffect, useRef } from 'react';
import { STRINGS } from '@/content/strings';
import { selectableCharacters, DEFAULT_CHARACTER } from '@/entities/player/characters';
import { focusIfIdle } from './focusIfIdle';
import { RotateHint } from './RotateHint';
import { BONUS_CHARACTER_COPY } from '@/content/bonusCharacters';
import { assetPath, resolveAsset } from '@/assets/resolve';

export interface CharacterSelectProps {
  onPick: (characterId: string) => void;
  onBack?: () => void;
  campaignVictory?: boolean;
}

// The kid's idle-pose portrait, falling back to Fred's sprite for any id without its own art.
function portraitFor(id: string): string {
  const prefix = resolveAsset(`${id}-idle`) ? id : DEFAULT_CHARACTER;
  return assetPath(`${prefix}-idle`);
}

export function CharacterSelect({ onPick, onBack, campaignVictory = false }: CharacterSelectProps) {
  const rosterRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    focusIfIdle(rosterRef.current?.querySelector<HTMLButtonElement>('.kid-card') ?? null);
  }, []);

  return (
    <section className="chrome character-chrome" data-testid="character-select">
      <img className="title-backdrop" src={assetPath('title-splash')} alt="" width="1536" height="1024" />
      <div className="character-panel">
        <h1 className="chrome-title">{STRINGS.pickKid}</h1>
        {campaignVictory && <p className="kid-trait">{BONUS_CHARACTER_COPY.unlocked}</p>}
        <RotateHint />
        <div className="chrome-roster" ref={rosterRef}>
          {selectableCharacters(campaignVictory).map((kid) => (
            <button
              key={kid.id}
              type="button"
              className="kid-card"
              data-testid={`pick-${kid.id}`}
              onClick={() => onPick(kid.id)}
            >
              <img
                className="kid-portrait"
              src={portraitFor(kid.id)}
              alt=""
              width="72"
              height="88"
              data-testid={`portrait-${kid.id}`}
              />
              <span className="kid-copy">
                <span className="kid-name">{kid.title}</span>
                <span className="kid-trait">{kid.trait}</span>
              </span>
            </button>
          ))}
        </div>
        {onBack && (
          <div className="character-actions">
            <button type="button" className="btn-secondary" data-gamepad-back="true" onClick={onBack}>Back</button>
          </div>
        )}
      </div>
    </section>
  );
}
