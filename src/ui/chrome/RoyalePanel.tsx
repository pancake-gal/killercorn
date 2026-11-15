import { useEffect, useState } from 'react';
import { CHARACTER_ROSTER, DEFAULT_CHARACTER } from '@/entities/player/characters';
import { assetPath, resolveAsset } from '@/assets/resolve';
import { ROYALE_SPICES, NO_SPICES, type RoyaleSpices } from '@/royale/spices';
import { spicesUnlocked, type RoyaleRecord } from '@/royale/record';
import type { RoyaleAward } from '@/royale/run';
import { CROWN_COPY, ROYALE_BREAKDOWN_LABEL, ROYALE_COPY, SPICE_COPY } from '@/content/royale';
import { useDialogFocus } from './dialog';
import { GAME_OVER_INPUT_GRACE_MS } from './ProductPanels';

function clearTime(frames: number): string {
  const seconds = Math.round(frames / 60);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function formatScore(score: number): string {
  return score.toLocaleString('en-US');
}

function kidName(id: string): string {
  return CHARACTER_ROSTER.find((kid) => kid.id === id)?.title ?? id;
}

function portraitFor(id: string): string {
  return assetPath(`${resolveAsset(`${id}-idle`) ? id : DEFAULT_CHARACTER}-idle`);
}

export function RoyalePanel({ record, onStart, onClose }: {
  record: RoyaleRecord;
  onStart: (characterId: string, spices: RoyaleSpices) => void;
  onClose: () => void;
}) {
  const dialogRef = useDialogFocus(onClose);
  const [kid, setKid] = useState(DEFAULT_CHARACTER);
  const [spices, setSpices] = useState<RoyaleSpices>(NO_SPICES);
  const open = spicesUnlocked(record);
  const bestScore = record.scores[0];
  const bestTime = record.times[0];
  return (
    <div ref={dialogRef} className="pause-overlay" role="dialog" aria-modal="true" aria-label={ROYALE_COPY.title}>
      <section className="pause-card product-panel royale-panel">
        <p className="eyebrow">{ROYALE_COPY.eyebrow}</p>
        <h2 className="pause-title">{ROYALE_COPY.title}</h2>
        <p>{ROYALE_COPY.blurb}</p>
        <fieldset className="royale-kids">
          <legend>{ROYALE_COPY.kidLegend}</legend>
          {CHARACTER_ROSTER.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              className="royale-kid"
              aria-pressed={kid === candidate.id}
              onClick={() => setKid(candidate.id)}
            >
              <img src={portraitFor(candidate.id)} alt="" width="40" height="48" />
              {candidate.title}
            </button>
          ))}
        </fieldset>
        <fieldset className="royale-spices" data-locked={!open}>
          <legend>{ROYALE_COPY.spicesLegend} <small>{ROYALE_COPY.spiceBonus}</small></legend>
          {/* Locked spices stay one line, so Mash 'Em stays on screen. */}
          {open ? ROYALE_SPICES.map((spice) => (
            <label key={spice} className="royale-spice">
              <input
                type="checkbox"
                checked={spices[spice]}
                onChange={(event) => setSpices({ ...spices, [spice]: event.target.checked })}
              />
              <span>{SPICE_COPY[spice].label}</span>
              <small>{SPICE_COPY[spice].hint}</small>
            </label>
          )) : (
            <p className="royale-locked">
              {ROYALE_COPY.spicesLocked} <small>{ROYALE_SPICES.map((spice) => SPICE_COPY[spice].label).join(' · ')}</small>
            </p>
          )}
        </fieldset>
        {record.crowns.length > 0 && (
          <ul className="royale-crowns" aria-label={ROYALE_COPY.crowns}>
            {record.crowns.map((crown) => <li key={crown}><b aria-hidden="true">♛</b>{CROWN_COPY[crown]}</li>)}
          </ul>
        )}
        <section className="royale-bests" aria-label={ROYALE_COPY.bests}>
          {bestScore && bestTime ? (
            <dl>
              <div><dt>{ROYALE_COPY.bestScore}</dt><dd>{formatScore(bestScore.score)}</dd></div>
              <div><dt>{ROYALE_COPY.bestTime}</dt><dd>{clearTime(bestTime.frames)}</dd></div>
            </dl>
          ) : (
            <p>{ROYALE_COPY.noBests}</p>
          )}
        </section>
        {/* A sticky footer: on a short phone screen the start button never scrolls away. */}
        <div className="royale-actions">
          <button type="button" className="btn-primary" onClick={() => onStart(kid, open ? spices : NO_SPICES)}>{ROYALE_COPY.start}</button>
          <button type="button" className="btn-secondary" data-gamepad-back="true" onClick={onClose}>{ROYALE_COPY.back}</button>
        </div>
      </section>
    </div>
  );
}

// The ring's clear. Like the game-over card, its buttons wait a moment so a kid still mashing jump
// or swing at the final pop sees the result instead of skipping it.
export function RoyaleResultPanel({ award, onAgain, onTitle }: {
  award: RoyaleAward;
  onAgain: () => void;
  onTitle: () => void;
}) {
  const dialogRef = useDialogFocus();
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setArmed(true), GAME_OVER_INPUT_GRACE_MS);
    return () => clearTimeout(timer);
  }, []);
  const ranks = [
    award.scoreRank ? `Score Rank #${award.scoreRank}` : null,
    award.timeRank ? `Time Rank #${award.timeRank}` : null,
  ].filter(Boolean).join(' · ');
  return (
    <div ref={dialogRef} className="pause-overlay" role="dialog" aria-modal="true" aria-label={ROYALE_COPY.resultTitle}>
      <section className="pause-card product-panel royale-result" data-new-best={award.newBestScore}>
        <p className="eyebrow">{ROYALE_COPY.resultEyebrow}</p>
        <h2 className="pause-title">{ROYALE_COPY.resultTitle}</h2>
        <p className="royale-result-label">{award.newBestScore ? ROYALE_COPY.newBest : ROYALE_COPY.runScore}</p>
        <strong className="score-award-total">{formatScore(award.score)}</strong>
        {ranks && <p>{ranks}</p>}
        <dl className="score-breakdown">
          {(Object.keys(ROYALE_BREAKDOWN_LABEL) as (keyof typeof ROYALE_BREAKDOWN_LABEL)[]).map((part) => (
            <div key={part}><dt>{ROYALE_BREAKDOWN_LABEL[part]}</dt><dd>{formatScore(award.breakdown[part])}</dd></div>
          ))}
        </dl>
        <small>{clearTime(award.frames)} · {award.kids.map(kidName).join(', ')}</small>
        <ul className="royale-crowns" aria-label={ROYALE_COPY.resultCrowns}>
          {award.crowns.map((crown) => {
            const fresh = award.newCrowns.includes(crown);
            return (
              <li key={crown} data-new={fresh}>
                <b aria-hidden="true">♛</b>{CROWN_COPY[crown]}{fresh && <em>{ROYALE_COPY.newCrown}</em>}
              </li>
            );
          })}
        </ul>
        <button type="button" className="btn-primary" aria-disabled={!armed} onClick={() => armed && onAgain()}>{ROYALE_COPY.again}</button>
        <button type="button" className="btn-secondary" aria-disabled={!armed} onClick={() => armed && onTitle()}>{ROYALE_COPY.titleMenu}</button>
      </section>
    </div>
  );
}
