import { HOME_SCREEN_STEPS, STRINGS } from '@/content/strings';
import { CREDITS } from '@/content/credits';
import { CAMPAIGN } from '@/campaign/definition';
import type { CampaignChromeState } from './bus';
import type { ScoreAwardState } from './bus';
import { useDialogFocus } from './dialog';
import { useEffect, useState } from 'react';
import { loadHighScores, type GameScoreEntry, type LevelScoreEntry } from '@/score/highScores';
import { CHARACTER_ROSTER } from '@/entities/player/characters';
import { stageReplayGoals } from '@/score/goals';
import { loadRoyaleRecord, type RoyaleScoreEntry } from '@/royale/record';
import { ROYALE_COPY } from '@/content/royale';

interface CloseableProps { onClose: () => void }

// The safe choice comes first, bright, and focused: a returning kid who hits the big button or Enter
// keeps their save. Erasing takes a deliberate move to the second button.
export function StartOverPanel({ onConfirm, onClose }: { onConfirm: () => void; onClose: () => void }) {
  const dialogRef = useDialogFocus(onClose);
  return (
    <div ref={dialogRef} className="pause-overlay" role="dialog" aria-modal="true" aria-label="Start Over?" aria-describedby="start-over-warning">
      <section className="pause-card product-panel confirm-panel">
        <p className="eyebrow">CAMPAIGN SAVE</p>
        <h2 className="pause-title">Start Over?</h2>
        <p id="start-over-warning">{STRINGS.startOverWarning}</p>
        <button type="button" className="btn-primary" data-gamepad-back="true" onClick={onClose}>Keep My Save</button>
        <button type="button" className="btn-secondary" onClick={onConfirm}>Start Over</button>
      </section>
    </div>
  );
}

export const GAME_OVER_INPUT_GRACE_MS = 1_000;

// Game over is a terminal choice: Escape (the taught pause key) closes nothing.
export function GameOverPanel({ onRetry, onQuit, copy = 'The crew is ready for another run.' }: { onRetry: () => void; onQuit: () => void; copy?: string }) {
  const dialogRef = useDialogFocus();
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setArmed(true), GAME_OVER_INPUT_GRACE_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div ref={dialogRef} className="pause-overlay" role="dialog" aria-modal="true" aria-label={STRINGS.gameOver} aria-describedby="game-over-copy">
      <section className="pause-card">
        <h2 className="pause-title">{STRINGS.gameOver}</h2>
        <p id="game-over-copy">{copy}</p>
        <button type="button" className="btn-primary" aria-disabled={!armed} onClick={() => armed && onRetry()}>{STRINGS.retry}</button>
        <button type="button" className="btn-secondary" aria-disabled={!armed} onClick={() => armed && onQuit()}>{STRINGS.quitToTitle}</button>
      </section>
    </div>
  );
}

export function CompletionPanel({ campaign, ready = true, onReplay, onWorldMap, onHighScores, onCredits, onClose }: {
  campaign: CampaignChromeState;
  // False while the scene that handles replay/quit is still starting; those actions wait for it.
  ready?: boolean;
  onReplay: (stageId: string) => void;
  onWorldMap: () => void;
  onHighScores: () => void;
  onCredits: () => void;
  onClose: () => void;
}) {
  const dialogRef = useDialogFocus(() => {
    if (ready) onClose();
  });
  return (
    <div ref={dialogRef} className="pause-overlay" role="dialog" aria-modal="true" aria-label="Campaign Complete" aria-busy={!ready}>
      <section className="pause-card product-panel completion-panel">
        <p className="eyebrow">FARM SAVED</p>
        <h2 className="pause-title">The Corn Is Good Again!</h2>
        <p>Five friends free. Three Corn King showdowns won.</p>
        <div className="completion-crew" aria-label="Rescued crew celebration">
          {campaign.rescuedCrew.map((friend) => (
            <span key={friend}>
              <b aria-hidden="true">★</b>
              {friend.toUpperCase()}
            </span>
          ))}
        </div>
        <button type="button" className="btn-primary" disabled={!ready} onClick={() => onReplay(campaign.stageId)}>Replay Final Stage</button>
        <button type="button" className="btn-secondary" disabled={!ready} onClick={onWorldMap}>World Map</button>
        <button type="button" className="btn-secondary" onClick={onHighScores}>High Scores</button>
        <button type="button" className="btn-secondary" onClick={onCredits}>Credits</button>
        <button type="button" className="btn-secondary" disabled={!ready} onClick={onClose}>Title Menu</button>
      </section>
    </div>
  );
}

function stageTitle(titleId: string | undefined, fallback: string): string {
  return titleId && titleId in STRINGS ? STRINGS[titleId as keyof typeof STRINGS] : fallback;
}

function clearTime(frames: number | undefined): string | null {
  if (!frames) return null;
  const seconds = Math.round(frames / 60);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function formatScore(score: number | undefined): string | null {
  return score === undefined ? null : score.toLocaleString('en-US');
}

function cobCount(cobs: number): string {
  return `${cobs} ${cobs === 1 ? 'cob' : 'cobs'}`;
}

function characterName(characterId: string): string {
  return CHARACTER_ROSTER.find((character) => character.id === characterId)?.title ?? characterId;
}

export function ScoreAward({ award, onNext }: { award: ScoreAwardState; onNext: () => void }) {
  const level = CAMPAIGN.find((candidate) => candidate.id === award.stageId);
  const title = stageTitle(level?.titleId, award.stageId);
  const goals = stageReplayGoals({
    stageId: award.stageId,
    boss: !!(level?.boss || level?.teamBoss),
    cobs: award.cobs,
    totalCobs: award.totalCobs,
    flawless: award.breakdown.flawless > 0,
    newBest: award.newBest,
  });
  return (
    <div className="score-award-overlay" role="status" aria-live="assertive" aria-label={award.newBest ? 'New level best' : 'Stage score'}>
      <section className="score-award-card" data-new-best={award.newBest}>
        <div className="score-award-rays" aria-hidden="true" />
        <span className="score-award-trophy" aria-hidden="true">★</span>
        <p className="eyebrow">{award.newBest ? 'NEW LEVEL BEST' : 'STAGE CLEAR'}</p>
        <h2>{title}</h2>
        <strong className="score-award-total">{formatScore(award.score)}</strong>
        <p>{award.rank ? `Level Rank #${award.rank}` : 'Score banked'}</p>
        <dl className="score-breakdown">
          <div><dt>Clear</dt><dd>{formatScore(award.breakdown.clear)}</dd></div>
          <div><dt>Farm</dt><dd>{formatScore(award.breakdown.farm)}</dd></div>
          <div><dt>Lives</dt><dd>{formatScore(award.breakdown.lives)}</dd></div>
          <div><dt>Clean</dt><dd>{formatScore(award.breakdown.flawless)}</dd></div>
          <div><dt>Pace</dt><dd>{formatScore(award.breakdown.pace)}</dd></div>
        </dl>
        <small>{clearTime(award.frames)} · {cobCount(award.cobs)}</small>
        <ul className="score-replay-goals" aria-label="Friendly replay goals">
          {goals.map((goal) => (
            <li key={goal.id} data-achieved={goal.achieved}>
              <span aria-hidden="true">{goal.achieved ? '✓' : '›'}</span>{goal.label}
            </li>
          ))}
        </ul>
        {award.gameScore !== undefined && (
          <p className="score-award-game" data-new-best={award.newGameBest}>
            {award.newGameBest ? 'NEW FULL-GAME BEST' : 'FULL-GAME SCORE'}
            <strong>{formatScore(award.gameScore)}</strong>
            {award.gameRank ? `Rank #${award.gameRank}` : ''}
          </p>
        )}
        {/* The card waits for the player (UX review #9). A jump or swing press also moves on. */}
        <button type="button" className="btn-primary score-award-next" onClick={onNext}>{STRINGS.keepGoing}</button>
      </section>
    </div>
  );
}

function HighScoreRows({ entries, game }: { entries: (LevelScoreEntry | GameScoreEntry)[]; game: boolean }) {
  if (entries.length === 0) return <p className="high-score-empty">No scores yet. Clear a stage to fill the board.</p>;
  return (
    <div className="high-score-table-wrap">
      <table className="high-score-table">
        <thead><tr><th>Rank</th><th>Kid</th><th>Score</th><th>{game ? 'Run' : 'Clear'}</th></tr></thead>
        <tbody>
          {entries.map((entry, index) => (
            <tr key={`${entry.score}-${entry.characterId}-${entry.frames}-${index}`}>
              <td>#{index + 1}</td>
              <td>{characterName(entry.characterId)}</td>
              <td>{formatScore(entry.score)}</td>
              <td>{clearTime(entry.frames)}<small>{game ? `${(entry as GameScoreEntry).stages} stages` : cobCount((entry as LevelScoreEntry).cobs)}</small></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// The High Scores rows for a Boss Royale board (score or time order). The ranked measure takes the
// emphasized third column, so the time board leads with the time to beat.
function RoyaleBoardRows({ entries, byTime }: { entries: readonly RoyaleScoreEntry[]; byTime: boolean }) {
  if (entries.length === 0) return <p className="high-score-empty">{ROYALE_COPY.emptyBoard}</p>;
  return (
    <div className="high-score-table-wrap">
      <table className="high-score-table">
        <thead><tr><th>Rank</th><th>Kid</th>{byTime ? <><th>Time</th><th>Score</th></> : <><th>Score</th><th>Clear</th></>}</tr></thead>
        <tbody>
          {entries.map((entry, index) => {
            const detail = <small>{entry.kids.length} {entry.kids.length === 1 ? 'kid' : 'kids'} · {entry.spices} {entry.spices === 1 ? 'spice' : 'spices'}</small>;
            return (
              <tr key={`${entry.score}-${entry.frames}-${entry.characterId}-${index}`}>
                <td>#{index + 1}</td>
                <td>{characterName(entry.characterId)}</td>
                {byTime ? (
                  <>
                    <td>{clearTime(entry.frames)}</td>
                    <td>{formatScore(entry.score)}{detail}</td>
                  </>
                ) : (
                  <>
                    <td>{formatScore(entry.score)}</td>
                    <td>{clearTime(entry.frames)}{detail}</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const ROYALE_BOARDS: Record<string, string> = { 'royale-score': ROYALE_COPY.scoreBoard, 'royale-time': ROYALE_COPY.timeBoard };

export function HighScoresPanel({ onClose }: CloseableProps) {
  const dialogRef = useDialogFocus(onClose);
  const [list, setList] = useState('game');
  const [scores] = useState(loadHighScores);
  const [royale] = useState(loadRoyaleRecord);
  const level = CAMPAIGN.find((candidate) => candidate.id === list);
  const royaleBoard = ROYALE_BOARDS[list];
  const entries = list === 'game' ? scores.game : scores.levels[list] ?? [];
  return (
    <div ref={dialogRef} className="pause-overlay" role="dialog" aria-modal="true" aria-label="High Scores">
      <section className="pause-card product-panel high-scores-panel">
        <p className="eyebrow">LOCAL ARCADE BOARD</p>
        <h2 className="pause-title">High Scores</h2>
        <p>Top five clears saved only in this browser.</p>
        <label className="high-score-picker">
          <span>Score list</span>
          <select value={list} onChange={(event) => setList(event.target.value)}>
            <option value="game">Full Game</option>
            {CAMPAIGN.map((stage) => <option key={stage.id} value={stage.id}>{stageTitle(stage.titleId, stage.id)}</option>)}
            {Object.entries(ROYALE_BOARDS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <h3>{royaleBoard ?? (list === 'game' ? 'Full Game' : stageTitle(level?.titleId, list))}</h3>
        {royaleBoard
          ? <RoyaleBoardRows entries={list === 'royale-time' ? royale.times : royale.scores} byTime={list === 'royale-time'} />
          : <HighScoreRows entries={entries} game={list === 'game'} />}
        <button type="button" className="btn-primary" data-gamepad-back="true" onClick={onClose}>Done</button>
      </section>
    </div>
  );
}

const WORLD_MAP_REGIONS = [
  { name: 'Cornfield Sunrise', label: 'WORLD 1', friend: 'strawberry' },
  { name: 'Root Rows', label: 'WORLD 2', friend: 'carrot' },
  { name: 'Bramble Patch', label: 'WORLD 3', friend: 'blueberry' },
  { name: 'Leaf Beds', label: 'WORLD 4', friend: 'lettuce' },
  { name: 'Orchard Bend', label: 'WORLD 5', friend: 'banana' },
  { name: 'Final Furrow', label: 'FINALE' },
] as const;

const CREW_NAMES = ['strawberry', 'carrot', 'blueberry', 'lettuce', 'banana'] as const;

function displayName(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function WorldMapPanel({ campaign, onReplay, onClose }: {
  campaign: CampaignChromeState;
  onReplay: (stageId: string) => void;
  onClose: () => void;
}) {
  const completed = new Set(campaign.completedStageIds);
  const dialogRef = useDialogFocus(onClose);
  return (
    <div ref={dialogRef} className="pause-overlay" role="dialog" aria-modal="true" aria-label="World Map">
      <section className="pause-card product-panel world-map-panel">
        <header className="world-map-header">
          <div>
            <p className="eyebrow">FIVE WORLDS + THE FINAL FURROW</p>
            <h2 className="pause-title">World Map</h2>
          </div>
          <div className="world-map-progress">
            <strong>{completed.size} of {CAMPAIGN.length} stages cleared</strong>
            <progress aria-label="Campaign progress" value={completed.size} max={CAMPAIGN.length} />
          </div>
        </header>
        <ul className="world-map-crew" aria-label="Rescued crew">
          {CREW_NAMES.map((friend) => {
            const rescued = campaign.rescuedCrew.includes(friend);
            return (
              <li key={friend} data-rescued={rescued}>
                <span aria-hidden="true">{rescued ? '★' : '◇'}</span>
                {displayName(friend)} {rescued ? 'rescued' : 'waiting'}
              </li>
            );
          })}
        </ul>
        <div className="world-map-route">
          {WORLD_MAP_REGIONS.map((region, regionIndex) => {
            const stages = CAMPAIGN.slice(regionIndex * 3, regionIndex * 3 + 3);
            const regionComplete = stages.every((level) => completed.has(level.id));
            const regionCurrent = stages.some((level) => campaign.stageId === level.id && !completed.has(level.id));
            return (
              <section
                key={region.name}
                className="world-map-region"
                role="group"
                aria-label={region.name}
                data-complete={regionComplete}
                data-current={regionCurrent}
              >
                <header>
                  <span>{region.label}</span>
                  <strong>{region.name}</strong>
                  {'friend' in region && <small>{displayName(region.friend)} crew power</small>}
                </header>
                <ol>
                  {stages.map((level, stageIndex) => {
                    const title = stageTitle(level.titleId, level.id);
                    const isCompleted = completed.has(level.id);
                    const isCurrent = campaign.stageId === level.id && !isCompleted;
                    const bestTime = clearTime(campaign.bestStageFrames?.[level.id]);
                    const bestCobs = campaign.bestStageCobs?.[level.id];
                    const bestScore = formatScore(campaign.bestStageScores?.[level.id]);
                    return (
                      <li key={level.id} data-state={isCompleted ? 'cleared' : isCurrent ? 'current' : 'locked'}>
                        <span className="world-map-node" aria-hidden="true">{isCompleted ? stageIndex === 2 ? '★' : '✓' : stageIndex + 1}</span>
                        {isCompleted ? (
                          <button type="button" onClick={() => onReplay(level.id)}>
                            {title}
                            {stageIndex === 2 && <em className="world-map-boss-stamp">Boss mashed</em>}
                            {(bestTime || bestCobs !== undefined || bestScore) && (
                              <small>{bestScore ? `${bestScore} pts · ` : ''}Best {bestTime ?? '—'} · {cobCount(bestCobs ?? 0)}</small>
                            )}
                          </button>
                        ) : (
                          <span className="world-map-locked">{title}<small>{isCurrent ? 'Current stage' : 'Locked'}</small></span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })}
        </div>
        <button type="button" className="btn-primary" onClick={onClose}>Done</button>
      </section>
    </div>
  );
}

function creditsMotionAllowed(): boolean {
  if (typeof document !== 'undefined' && document.documentElement.dataset.reducedMotion === 'true') return false;
  return typeof window === 'undefined' || typeof window.matchMedia !== 'function'
    ? true
    : !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function CreditsPanel({ onClose, autoPlay = false }: CloseableProps & { autoPlay?: boolean }) {
  const dialogRef = useDialogFocus(onClose);
  const rolling = autoPlay && creditsMotionAllowed();
  return (
    <div ref={dialogRef} className="credits-overlay" role="dialog" aria-modal="true" aria-label="Credits">
      <section className="credits-screen">
        <div className="credits-marquee" aria-hidden="true"><span>★</span><b>END OF THE FURROW</b><span>★</span></div>
        <div className={`credits-viewport ${rolling ? 'credits-viewport--rolling' : 'credits-viewport--static'}`}>
          <div
            className={`credits-track ${rolling ? 'credits-track--rolling' : 'credits-track--static'}`}
            data-testid="credits-track"
            data-motion={rolling ? 'rolling' : 'static'}
            onAnimationEnd={(event) => {
              if (rolling && event.currentTarget === event.target) onClose();
            }}
          >
            <p className="credits-eyebrow">{CREDITS.eyebrow}</p>
            <h2>{CREDITS.title}</h2>
            <p className="credits-victory">{CREDITS.victory}</p>
            <span className="credits-star" aria-hidden="true">✦</span>
            {CREDITS.sections.map((section) => (
              <section className="credits-block" key={section.role}>
                <h3>{section.role}</h3>
                {section.names.map((name) => <p key={name}>{name}</p>)}
              </section>
            ))}
            <section className="credits-block credits-disclosure">
              <h3>{CREDITS.disclosureRole}</h3>
              <p>{CREDITS.disclosure}</p>
            </section>
            <span className="credits-star" aria-hidden="true">✦</span>
            <p className="credits-thanks">{CREDITS.thanks}</p>
            <p className="credits-signoff">{CREDITS.signoff}</p>
          </div>
        </div>
        <button type="button" className="btn-secondary credits-skip" data-gamepad-back="true" onClick={onClose}>
          {autoPlay ? rolling ? 'Skip Credits' : 'Continue' : 'Done'}
        </button>
      </section>
    </div>
  );
}

export function AddToHomePanel({ steps, onClose }: CloseableProps & { steps: keyof typeof HOME_SCREEN_STEPS }) {
  const dialogRef = useDialogFocus(onClose);
  return (
    <div ref={dialogRef} className="pause-overlay" role="dialog" aria-modal="true" aria-label={STRINGS.homeScreenTitle}>
      <section className="pause-card product-panel">
        <h2 className="pause-title">{STRINGS.homeScreenTitle}</h2>
        <p>{STRINGS.homeScreenLead}</p>
        <ol className="home-screen-steps">
          {HOME_SCREEN_STEPS[steps].map((step) => <li key={step}>{step}</li>)}
        </ol>
        <button type="button" className="btn-primary" data-gamepad-back="true" onClick={onClose}>Got It</button>
      </section>
    </div>
  );
}

export function DisclosuresPanel({ onClose }: CloseableProps) {
  const dialogRef = useDialogFocus(onClose);
  return (
    <div ref={dialogRef} className="pause-overlay" role="dialog" aria-modal="true" aria-label="Privacy and accessibility">
      <section className="pause-card product-panel">
        <h2 className="pause-title">Privacy & Access</h2>
        <h3>Privacy</h3>
        <p>The game stores progress, settings, and anonymous high scores in this browser. It does not require an account or collect gameplay data.</p>
        <h3>Accessibility</h3>
        <p>Keyboard, touch, gamepad, reduced-motion, high-contrast, large-text, pause, and visual-cue options are built in.</p>
        <h3>AI-assisted assets</h3>
        <p>Selected art and audio were made with generative tools, then selected, edited, and reviewed by people.</p>
        <button type="button" className="btn-primary" onClick={onClose}>Done</button>
      </section>
    </div>
  );
}
