// Title chrome: wordmark, tagline, and the primary CTA — DOM, not canvas.
// Colors come from the regime CSS vars via .chrome-* / .btn-primary classes
// (src/styles/regime.css), so this names no hex and tracks --regime-accent.
// Pure presentation: it takes an onStart callback and owns no game state.

import { useEffect, useRef } from 'react';
import { STRINGS } from '@/content/strings';
import { assetPath } from '@/assets/resolve';
import { focusIfIdle } from './focusIfIdle';
import { RotateHint } from './RotateHint';
import { ROYALE_COPY } from '@/content/royale';

export interface TitleScreenProps {
  canContinue: boolean;
  ready?: boolean;
  onNewGame: () => void;
  onContinue: () => void;
  onSettings?: () => void;
  onCredits?: () => void;
  onDisclosures?: () => void;
  onWorldMap?: () => void;
  onHighScores?: () => void;
  onBossRoyale?: () => void; // present only once the first campaign victory unlocks Boss Royale
  onAddToHome?: () => void; // present only on a phone or tablet not already running the installed game
}

export function TitleScreen({ canContinue, ready = true, onNewGame, onContinue, onSettings, onCredits, onDisclosures, onWorldMap, onHighScores, onBossRoyale, onAddToHome }: TitleScreenProps) {
  const startRef = useRef<HTMLButtonElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  // Enter and gamepad A act on the focused control, so give the bright primary action focus once enabled.
  useEffect(() => {
    if (ready) focusIfIdle(canContinue ? continueRef.current : startRef.current);
  }, [ready, canContinue]);

  return (
    <section className="chrome title-chrome" data-testid="title-screen" aria-busy={!ready}>
      <img
        className="title-backdrop"
        data-testid="title-backdrop"
        src={assetPath('title-splash')}
        alt=""
        width="1536"
        height="1024"
      />
      <div className="title-panel">
        <h1 className="chrome-title" data-testid="title-wordmark">
          {STRINGS.title}
        </h1>
        <p className="chrome-tagline">{STRINGS.tagline}</p>
        <RotateHint />
        {/* With a save, Continue is the bright default so a returning kid keeps playing. */}
        <div className="chrome-actions">
          <button ref={startRef} type="button" className={canContinue ? 'btn-secondary' : 'btn-primary'} data-testid="start-button" disabled={!ready} onClick={onNewGame}>
            {STRINGS.newGame}
          </button>
          <button
            ref={continueRef}
            type="button"
            className={canContinue ? 'btn-primary' : 'btn-secondary'}
            data-testid="continue-button"
            disabled={!ready || !canContinue}
            onClick={onContinue}
          >
            {STRINGS.continueGame}
          </button>
          {onBossRoyale && (
            <button type="button" className="btn-secondary btn-royale" data-testid="royale-button" disabled={!ready} onClick={onBossRoyale}>
              {ROYALE_COPY.titleButton}
            </button>
          )}
        </div>
        {(onSettings || onCredits || onDisclosures || onWorldMap || onHighScores || onAddToHome) && (
          <nav className="chrome-links" aria-label="Game information">
            {onWorldMap && <button type="button" className="btn-link" onClick={onWorldMap}>World Map</button>}
            {onHighScores && <button type="button" className="btn-link" onClick={onHighScores}>High Scores</button>}
            {onSettings && <button type="button" className="btn-link" onClick={onSettings}>Settings</button>}
            {onCredits && <button type="button" className="btn-link" onClick={onCredits}>Credits</button>}
            {onDisclosures && <button type="button" className="btn-link" onClick={onDisclosures}>Privacy & Access</button>}
            {onAddToHome && <button type="button" className="btn-link" data-testid="add-to-home" onClick={onAddToHome}>{STRINGS.addToHome}</button>}
          </nav>
        )}
      </div>
    </section>
  );
}
