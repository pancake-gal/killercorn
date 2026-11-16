import './styles/regime.css';
import Phaser from 'phaser';
import { activeMount } from '@/dev/harness';
import { applyRegime } from '@/regime/derive';
import { TitleScene } from '@/scenes/TitleScene';
import { OverworldScene } from '@/scenes/OverworldScene';
import { PlayScene } from '@/scenes/PlayScene';
import { SCENE, SCENE_VIEW, resolveDevScene } from '@/scenes/keys';
import { CAMPAIGN } from '@/campaign/definition';
import { intent, snapshot } from '@/ui/chrome/bus';
import { mountChrome } from '@/ui/chrome/mount';
import { listenForInstallPrompt } from '@/ui/chrome/homeScreen';
import { toCampaignChromeState } from '@/ui/chrome/campaignState';
import { publishCampaignTitle, replayCompletedStage } from '@/ui/chrome/campaignNavigation';
import { createCampaignSession } from '@/campaign/session';
import { hasCampaignVictory, loadCampaign, saveCampaign } from '@/campaign/save';
import { canSelectCharacter, DEFAULT_CHARACTER } from '@/entities/player/characters';
import { BOSS_ROYALE_ARENA } from '@/entities/level/level';
import { royaleRunFromMenu, startRoyaleRun } from '@/royale/run';
import { loadRoyaleRecord, spicesUnlocked } from '@/royale/record';
import { freshRoyaleSeed } from '@/scenes/play/royaleSeed';
import { installAudioActivation } from '@/audio/activation';

const mount = activeMount();

const devScene = mount.harness && mount.scene ? resolveDevScene(mount.scene) : null;
const bootScene = devScene ?? SCENE.title;

// Apply the matching regime to the DOM root before Phaser paints, so CSS vars are live.
applyRegime(SCENE_VIEW[bootScene]);

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 540,
  backgroundColor: '#0f1320',
  // EXPAND keeps the authored 16:9 scale as the minimum view, then reveals extra world on wider
  // displays. Unlike CSS stretching or ENVELOP, it fills landscape phones without distorting pixel
  // art or cropping the HUD/ground. This changes presentation only; the fixed-step sim is untouched.
  scale: { mode: Phaser.Scale.EXPAND, autoCenter: Phaser.Scale.CENTER_BOTH },
  // Fixed timestep — deterministic stepping, no variable-dt drift.
  fps: { target: 60, forceSetTimeOut: true, smoothStep: false },
  scene: [TitleScene, OverworldScene, PlayScene],
};

const game = new Phaser.Game(config);
// Phaser 3.90's orientation listener refreshes with the pre-rotation parent size and then records the
// new one, so its per-frame resize check never fires and a phone turned mid-stage keeps the old canvas
// shape. Refresh again once the rotation is known; the parent size is current by then.
game.scale.on(Phaser.Scale.Events.ORIENTATION_CHANGE, () => game.scale.refresh());
installAudioActivation(game.sound);
listenForInstallPrompt();
const devLevel = devScene === SCENE.play && mount.level ? CAMPAIGN.find((l) => l.id === mount.level) : undefined;
// ?dev=play&harness=1&level=boss-royale mounts a fresh Boss Royale run (no campaign save is touched).
const devRoyale = devScene === SCENE.play && mount.level === BOSS_ROYALE_ARENA.id;
game.scene.start(
  bootScene,
  devRoyale ? { royale: startRoyaleRun({ characterId: DEFAULT_CHARACTER }) } : devLevel ? { level: devLevel } : undefined,
);

// Bridge: chrome intents become Phaser-owned transitions — Phaser stays the source of truth.
// Most CTAs are honored only while the title backdrop is active so a double-click cannot re-fire.
// Completion recovery is the exception: replay can replace either the title backdrop or the frozen
// final PlayScene, while Title Menu can dismiss a completed save already sitting on the title.
intent.on((i) => {
  // Title CTA -> character select. No scene change: the TitleScene stays as the menu backdrop while
  // the React chrome swaps the title screen for the roster (driven by the snapshot view).
  if (i.type === 'new-game' && game.scene.isActive(SCENE.title)) {
    applyRegime('character-select');
    snapshot.set({ view: 'character-select', campaignVictory: hasCampaignVictory() });
    return;
  }
  if (i.type === 'quit-title' && game.scene.isActive(SCENE.title)) {
    const saved = loadCampaign();
    if (saved) publishCampaignTitle(saved, true);
    else snapshot.set({ view: 'title', titleReady: true, canContinue: false, completed: false });
    return;
  }
  if (i.type === 'cancel-new-game' && game.scene.isActive(SCENE.title)) {
    applyRegime('title');
    const saved = loadCampaign();
    snapshot.set({
      view: 'title',
      titleReady: true,
      canContinue: saved !== null,
      ...(saved ? { campaign: toCampaignChromeState(saved), completed: saved.completed } : {}),
    });
    return;
  }
  if (i.type === 'continue' && game.scene.isActive(SCENE.title)) {
    const session = loadCampaign();
    if (!session) {
      snapshot.set({ view: 'title', titleReady: true, canContinue: false });
      return;
    }
    if (session.completed) {
      snapshot.set({ view: 'title', titleReady: true, canContinue: true, completed: true, campaign: toCampaignChromeState(session) });
      return;
    }
    const level = CAMPAIGN.find((candidate) => candidate.id === session.stageId) ?? CAMPAIGN[0]!;
    game.scene.stop(SCENE.title);
    game.scene.start(SCENE.play, { level, session: { ...session, stageId: level.id } });
    return;
  }
  // A kid was picked -> start the run with that hero's feel (PlayScene threads it through
  // configsForCharacter). The chosen id rides the scene-start data, the One Rule's only input.
  if (i.type === 'select' && game.scene.isActive(SCENE.title)) {
    if (snapshot.get().view !== 'character-select' || !canSelectCharacter(i.characterId, hasCampaignVictory())) return;
    const session = createCampaignSession({
      characterId: i.characterId,
      stageId: CAMPAIGN[0]!.id,
    });
    saveCampaign(session);
    game.scene.stop(SCENE.title);
    game.scene.start(SCENE.play, { session });
    return;
  }
  // Boss Royale from the title: validated here (victory, unlocked kid, unlocked spices). The run's
  // session is synthetic, so the campaign save is never touched.
  if (i.type === 'start-royale' && game.scene.isActive(SCENE.title)) {
    const run = royaleRunFromMenu(i, {
      victory: hasCampaignVictory(),
      spicesOpen: spicesUnlocked(loadRoyaleRecord()),
      seed: freshRoyaleSeed(),
    });
    if (!run) return;
    game.scene.stop(SCENE.title);
    game.scene.start(SCENE.play, { royale: run });
    return;
  }
  if (i.type === 'replay-stage') {
    const session = loadCampaign();
    if (session) replayCompletedStage(game.scene, session, i.stageId, i.characterId, hasCampaignVictory());
  }
});

// Mount the React chrome overlay, unless the harness asked for a bare (chrome-free) scene.
// Seed the snapshot to the boot view first so the chrome renders the right screen on mount.
// (A scene that introduces its own transition should likewise publish a snapshot here.)
const ui = document.getElementById('ui');
if (ui && !mount.bare) {
  const saved = loadCampaign();
  snapshot.set({
    view: SCENE_VIEW[bootScene],
    ...(bootScene === SCENE.title ? { titleReady: game.scene.isActive(SCENE.title) } : {}),
    canContinue: saved !== null,
    ...(saved ? { campaign: toCampaignChromeState(saved), completed: saved.completed } : {}),
  });
  mountChrome(ui);
}

if (mount.harness) {
  (window as unknown as { __kc?: unknown }).__kc = { game, mount };
}
