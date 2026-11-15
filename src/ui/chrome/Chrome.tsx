// Chrome root. Renders the right chrome for the active view, mirrored from the snapshot store
// Phaser publishes — it holds no game state of its own. useSyncExternalStore reads the current
// view synchronously on mount, so a snapshot set before React subscribes is never missed.
// Player actions go back out as intents (src/main.ts maps them to Phaser-owned transitions).

import { useEffect, useState, useSyncExternalStore } from 'react';
import { intent, snapshot } from './bus';
import { TitleScreen } from './TitleScreen';
import { CharacterSelect } from './CharacterSelect';
import { CharacterSwitchControl } from './CharacterSwitchControl';
import { AudioControl } from './AudioControl';
import { FullscreenControl } from './FullscreenControl';
import { PauseControl } from './PauseControl';
import { TouchControls } from './TouchControls';
import { SettingsPanel } from './SettingsPanel';
import { AddToHomePanel, CompletionPanel, CreditsPanel, DisclosuresPanel, GameOverPanel, HighScoresPanel, ScoreAward, StartOverPanel, WorldMapPanel } from './ProductPanels';
import { canOfferHomeScreen, homeScreen, homeScreenSteps, openInstallPrompt } from './homeScreen';
import { applySettings, loadSettings, saveSettings } from '@/settings/settings';
import { loadBindings, saveBindings } from '@/input/actions';
import { audioSettings, setMusicVolume, setSfxVolume, setVolume } from '@/audio/bus';
import { useMenuGamepadNavigation } from './useMenuGamepadNavigation';
import { PublisherNotice } from './PublisherNotice';
import { invisibilityStatus } from '@/content/bonusCharacters';
import { RoyalePanel, RoyaleResultPanel } from './RoyalePanel';
import { ROYALE_COPY } from '@/content/royale';
import { hasCampaignVictory } from '@/campaign/save';
import { loadRoyaleRecord } from '@/royale/record';

type LocalPanel = 'settings' | 'credits' | 'disclosures' | 'world-map' | 'high-scores' | 'start-over' | 'royale' | 'add-to-home' | null;

// How long a visual sound cue stays readable after the event that published it.
const VISUAL_CUE_MS = 2_000;

export function Chrome() {
  const view = useSyncExternalStore(snapshot.subscribe, () => snapshot.get().view);
  const paused = useSyncExternalStore(snapshot.subscribe, () => !!snapshot.get().paused);
  const canContinue = useSyncExternalStore(snapshot.subscribe, () => !!snapshot.get().canContinue);
  const campaignVictory = useSyncExternalStore(snapshot.subscribe, () => !!snapshot.get().campaignVictory);
  const invisibility = useSyncExternalStore(snapshot.subscribe, () => snapshot.get().invisibility);
  const switchCharacterId = useSyncExternalStore(snapshot.subscribe, () => snapshot.get().switchCharacterId);
  const titleReady = useSyncExternalStore(snapshot.subscribe, () => snapshot.get().titleReady ?? true);
  const gameOver = useSyncExternalStore(snapshot.subscribe, () => !!snapshot.get().gameOver);
  const completed = useSyncExternalStore(snapshot.subscribe, () => !!snapshot.get().completed);
  const bossIntro = useSyncExternalStore(snapshot.subscribe, () => !!snapshot.get().bossIntro);
  const creditsRoll = useSyncExternalStore(snapshot.subscribe, () => snapshot.get().creditsRoll);
  const campaign = useSyncExternalStore(snapshot.subscribe, () => snapshot.get().campaign);
  const visualCue = useSyncExternalStore(snapshot.subscribe, () => snapshot.get().visualCue);
  const tutorialCue = useSyncExternalStore(snapshot.subscribe, () => snapshot.get().tutorialCue);
  const scoreAward = useSyncExternalStore(snapshot.subscribe, () => snapshot.get().scoreAward);
  const royale = useSyncExternalStore(snapshot.subscribe, () => snapshot.get().royale);
  const royaleAward = useSyncExternalStore(snapshot.subscribe, () => snapshot.get().royaleAward);
  const volume = useSyncExternalStore(audioSettings.subscribe, () => audioSettings.get().volume);
  const musicVolume = useSyncExternalStore(audioSettings.subscribe, () => audioSettings.get().musicVolume);
  const sfxVolume = useSyncExternalStore(audioSettings.subscribe, () => audioSettings.get().sfxVolume);
  const homeScreenState = useSyncExternalStore(homeScreen.subscribe, homeScreen.get);
  const [homeScreenDevice] = useState(canOfferHomeScreen);
  const [panel, setPanel] = useState<LocalPanel>(null);
  const [dismissedCreditsRoll, setDismissedCreditsRoll] = useState<number | undefined>();
  const [gameSettings, setGameSettings] = useState(loadSettings);
  const [bindings, setBindings] = useState(loadBindings);
  // Each published cue is a fresh object, so identity (not the frame id, which repeats after a
  // retry) marks the one whose moment has passed. The live region stays mounted between cues.
  const [expiredCue, setExpiredCue] = useState<typeof visualCue>();
  const autoCredits = creditsRoll !== undefined && creditsRoll !== dismissedCreditsRoll;
  useMenuGamepadNavigation(view !== 'level' || paused || panel !== null || gameOver || completed || autoCredits || !!scoreAward || !!royaleAward);
  // Boss Royale opens with the first campaign victory (read from the device each title render).
  const royaleUnlocked = view === 'title' && hasCampaignVictory();
  const liveControls = !gameOver && !completed && !autoCredits && !scoreAward && !royaleAward;
  const replayStage = (stageId: string) => {
    setPanel(null);
    intent.emit({ type: 'replay-stage', stageId });
  };

  // Saved only on a player change: an unsaved device keeps following the OS "reduce motion" answer.
  useEffect(() => applySettings(gameSettings), [gameSettings]);
  const changeSettings = (next: typeof gameSettings) => {
    saveSettings(next);
    setGameSettings(next);
  };
  useEffect(() => saveBindings(bindings), [bindings]);
  useEffect(() => {
    if (!visualCue) return;
    const timer = setTimeout(() => setExpiredCue(visualCue), VISUAL_CUE_MS);
    return () => clearTimeout(timer);
  }, [visualCue]);

  // The mute control is always available; the title and character-select screens render for their
  // own views. The pause control shows only during gameplay (`level` covers play AND boss arenas —
  // the snapshot view stays 'level' across a run, only the regime accent flips). All are presentation
  // + intent-emitters; none drives the sim. (Dev-only edge: `?dev=overworld` also reports 'level', so
  // the button shows with no PlayScene listening — the emit is a harmless no-op.)
  return (
    <>
      {view === 'title' && (
        <TitleScreen
          canContinue={canContinue}
          ready={titleReady}
          onNewGame={() => canContinue ? setPanel('start-over') : intent.emit({ type: 'new-game' })}
          onContinue={() => intent.emit({ type: 'continue' })}
          onSettings={() => setPanel('settings')}
          onCredits={() => setPanel('credits')}
          onDisclosures={() => setPanel('disclosures')}
          onHighScores={() => setPanel('high-scores')}
          {...(campaign && campaign.completedStageIds.length > 0 ? { onWorldMap: () => setPanel('world-map') } : {})}
          {...(royaleUnlocked ? { onBossRoyale: () => setPanel('royale') } : {})}
          {...(homeScreenDevice && !homeScreenState.installed
            ? { onAddToHome: () => (homeScreenState.prompt ? openInstallPrompt() : setPanel('add-to-home')) }
            : {})}
        />
      )}
      {view === 'title' && <PublisherNotice />}
      {view === 'character-select' && (
        <CharacterSelect
          campaignVictory={campaignVictory}
          onPick={(characterId) => intent.emit({ type: 'select', characterId })}
          onBack={() => intent.emit({ type: 'cancel-new-game' })}
        />
      )}
      {view === 'level' && liveControls && panel === null && (
        <PauseControl
          paused={paused}
          onPause={() => intent.emit({ type: 'pause' })}
          onResume={() => intent.emit({ type: 'resume' })}
          onRestart={() => intent.emit({ type: 'restart-stage' })}
          {...(royale ? { restartLabel: ROYALE_COPY.restart } : {})}
          onQuit={() => intent.emit({ type: 'quit-title' })}
          rescuedCrew={campaign?.rescuedCrew ?? []}
          activePower={campaign?.activePower ?? 'none'}
          onSelectPower={(power) => intent.emit({ type: 'select-power', power })}
          onSettings={() => setPanel('settings')}
          {...(campaign && campaign.completedStageIds.length > 0 ? { onWorldMap: () => setPanel('world-map') } : {})}
        />
      )}
      {/* Touch controls only during live gameplay — hidden on the break screen (held inputs are
          meaningless while frozen; unmount resets the store). The component self-gates to coarse
          pointers, so this renders nothing on desktop. */}
      {view === 'level' && !paused && liveControls && (
        <>
          <TouchControls powerAvailable={campaign?.activePower !== 'none'} abilityAvailable={invisibility !== undefined} />
          {switchCharacterId && panel === null && <CharacterSwitchControl characterId={switchCharacterId}
            binding={bindings.switchCharacter} onSwitch={() => intent.emit({ type: 'switch-character' })} />}
          {invisibility && <div className="invisibility-status" data-testid="invisibility-status">
            {invisibilityStatus(invisibility.remaining, invisibility.recharge, bindings.ability)}
          </div>}
        </>
      )}
      {gameOver && (
        <GameOverPanel
          onRetry={() => intent.emit({ type: 'retry' })}
          onQuit={() => intent.emit({ type: 'quit-title' })}
          {...(royale ? { copy: ROYALE_COPY.gameOverCopy } : {})}
        />
      )}
      {royaleAward && (
        <RoyaleResultPanel
          award={royaleAward}
          onAgain={() => intent.emit({ type: 'royale-again' })}
          onTitle={() => intent.emit({ type: 'quit-title' })}
        />
      )}
      {panel === 'royale' && (
        <RoyalePanel
          record={loadRoyaleRecord()}
          onStart={(characterId, spices) => {
            setPanel(null);
            intent.emit({ type: 'start-royale', characterId, spices });
          }}
          onClose={() => setPanel(null)}
        />
      )}
      {completed && campaign && !autoCredits && panel === null && (
        <CompletionPanel
          campaign={campaign}
          // On the title, main.ts honors replay/quit only once the title scene runs; in a level,
          // PlayScene handles them directly.
          ready={view !== 'title' || titleReady}
          onReplay={replayStage}
          onWorldMap={() => setPanel('world-map')}
          onHighScores={() => setPanel('high-scores')}
          onCredits={() => setPanel('credits')}
          onClose={() => intent.emit({ type: 'quit-title' })}
        />
      )}
      {panel === 'settings' && (
        <SettingsPanel
          value={gameSettings}
          onChange={changeSettings}
          bindings={bindings}
          onBindingsChange={setBindings}
          volume={volume}
          onVolumeChange={setVolume}
          musicVolume={musicVolume}
          onMusicVolumeChange={setMusicVolume}
          sfxVolume={sfxVolume}
          onSfxVolumeChange={setSfxVolume}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === 'start-over' && (
        <StartOverPanel
          onConfirm={() => {
            setPanel(null);
            intent.emit({ type: 'new-game' });
          }}
          onClose={() => setPanel(null)}
        />
      )}
      {(panel === 'credits' || autoCredits) && (
        <CreditsPanel
          autoPlay={autoCredits}
          onClose={() => {
            if (autoCredits) setDismissedCreditsRoll(creditsRoll);
            setPanel(null);
          }}
        />
      )}
      {panel === 'disclosures' && <DisclosuresPanel onClose={() => setPanel(null)} />}
      {panel === 'add-to-home' && <AddToHomePanel steps={homeScreenSteps()} onClose={() => setPanel(null)} />}
      {panel === 'high-scores' && <HighScoresPanel onClose={() => setPanel(null)} />}
      {panel === 'world-map' && campaign && (
        <WorldMapPanel
          campaign={campaign}
          onReplay={replayStage}
          onClose={() => setPanel(null)}
        />
      )}
      {view === 'level' && !paused && !gameOver && !completed && !autoCredits && !bossIntro && tutorialCue && (
        <div className="tutorial-coach" role="note" aria-label="Control tip" aria-live="polite">
          {tutorialCue.text}
        </div>
      )}
      {scoreAward && !autoCredits && <ScoreAward award={scoreAward} onNext={() => intent.emit({ type: 'next-stage' })} />}
      {visualCue && <div className="visual-cue" role="status" aria-live="polite">{visualCue === expiredCue ? '' : visualCue.text}</div>}
      <FullscreenControl />
      <AudioControl />
    </>
  );
}
