// Play scene (view: level → overworld regime). Drives the deterministic world stepper from live
// keyboard input: read an InputFrame, step the world one fixed frame, then SKIN the world state with
// the ingested World-1 art. Rendering is presentation only (the One Rule): the sim in
// src/entities/** is untouched — sprites read positions/state from `this.world` each frame, exactly
// like the placeholder rectangles did. Frames are separate files (one per pose), so animation is a
// setTexture() swap on a frame counter, not a Phaser atlas/anim. Parallax + the tileset are decor;
// collision stays driven by LevelDef. Arrows/WASD move, Up/W/Space jump, J/K swing.
// Parameterized by level via init({ level }); a cleared normal stage advances to the boss arena.

import Phaser from 'phaser';
import { applyRegime } from '@/regime/derive';
import { regimeCanvas, hexToInt } from '@/regime/canvas';
import { STRINGS, royaleEntryCue, royaleNames } from '@/content/strings';
import { BOSS_ROYALE_ARENA, WORLD_1_1, groundSupportY, type LevelDef, type Aabb } from '@/entities/level/level';
import { atCrewSwapPoint, spawnWorld, spawnWorldFromInit, stepWorld, configsForCharacter, INITIAL_LIVES, type WorldState, type WorldConfigs, DEFAULT_CONFIGS } from '@/entities/level/run';
import { inRoyaleRing, ROYALE_MEMBERS } from '@/entities/boss/royale';
import { MAX_HEALTH } from '@/entities/player/player';
import { PICKUP_CONFIG } from '@/entities/collectible/pickup';
import { DEFAULT_CHARACTER } from '@/entities/player/characters';
import { KERNEL_CREEP_CONFIG } from '@/entities/enemy/kernel';
import { SQUIRREL_CONFIG } from '@/entities/enemy/squirrel';
import { SPIKED_CORN_CONFIG } from '@/entities/projectile/spikedCorn';
import { GOOD_COB_CONFIG } from '@/entities/collectible/goodCob';
import { THRESHER_CONFIG } from '@/entities/hazard/thresher';
import { WHEAT_BOX_CONFIG } from '@/entities/powerup/wheatBox';
import { ALLY_CONFIG } from '@/entities/ally/produce';
import { PEEL_CONFIG } from '@/entities/projectile/peel';
import { assetPath } from '@/assets/resolve';
import { artSetFor, gameplayAssetIdsFor, playerArtPrefix, type LevelArtSet } from './artset';
import { activePhase, attackProfileFor, bossRecoveryFramesFor, type BossState, type BossConfig } from '@/entities/boss/kingCorn';
import { nextLevel } from '@/campaign/definition';
import { installVisibilityPause } from './autopause';
import { AudioBus } from '@/audio/AudioBus';
import { sfxForTransition } from '@/audio/events';
import { fxForTransition, powerUseFx, type FxEvent } from '@/render/fx';
import { anyBossRecovering, bossOpen, bossTellsForTransition, throwCueText, type BossTell } from '@/render/bossTells';
import { bossBlinkAlpha, calmFinaleKeyframe, hurtFlashFill, invulnAlpha, rageLook } from '@/render/motion';
import {
  bossWindupLook,
  crewChipY,
  hitStopFor,
  kidDisplayScale,
  koPhase,
  latchPresses,
  lockedDoorText,
  lockedDoorTouched,
  objectiveCue,
  mergeLatched,
  MID_LAYER_MUTE,
  mutedTint,
  type LatchedPresses,
} from '@/render/feel';
import { royaleBodyAlpha, royaleEntrants, royaleHudRow, royaleNextUp } from '@/render/royale';
import { lostTryToPit } from '@/render/pitHint';
import { powerConfig } from '@/entities/player/powerup';
import { HAZARD_OUTLINE, HAZARD_TINT, outlineHazard } from '@/render/hazardOutline';
import { activeMount } from '@/dev/harness';
import {
  finaleKeyframe,
  FINALE,
  FINALE_CRATER_INSET,
  PLUME_DISPLAY_H,
  VOLCANO_DISPLAY_H,
} from '@/render/finale';
import { type InputFrame } from '@/core/replay';
import { SCENE } from './keys';
import { intent, snapshot, touch } from '@/ui/chrome/bus';
import { toCampaignChromeState } from '@/ui/chrome/campaignState';
import { publishCampaignTitle, publishSavedTitle } from '@/ui/chrome/campaignNavigation';
import {
  advanceCampaign,
  bossAssistTier,
  completeCampaign,
  CREW_MAX_CHARGES,
  CREW_POWER,
  createCampaignSession,
  cycleCrewPower,
  isCrewFriend,
  rescueFriend,
  recordBossWipe,
  selectCrewPower,
  updateCrewResource,
  type CampaignSession,
  type CrewPower,
} from '@/campaign/session';
import { hasCampaignVictory, loadCampaign, saveCampaign } from '@/campaign/save';
import {
  finishRoyaleRun,
  nextRoyaleAttempt,
  noteRoyaleKid,
  royaleCanSwitch,
  royaleClearedNames,
  royaleInit,
  royaleSession,
  startRoyaleRun,
  type RoyaleAward,
  type RoyaleRun,
} from '@/royale/run';
import { loadRoyaleRecord, saveRoyaleRecord } from '@/royale/record';
import { freshRoyaleSeed } from './play/royaleSeed';
import { completeStageScore } from '@/score/complete';
import { loadHighScores, saveHighScores } from '@/score/highScores';
import { gamepadActions, loadBindings, type DeviceActions } from '@/input/actions';
import { cameraBoundsForViewport, stepCameraShake } from './play/camera';
import { hudSafeInsets, readSafeInsets } from './play/safeArea';
import { platformUnderlayFor } from './play/platformArt';
import { parallaxPlacement } from './parallax';
import { pitVisualFor } from './play/pitArt';
import { formatPowerHud, powerChipStyle, powerFriend, rescuePowerCue } from '@/ui/powerHud';
import { FALLING_NUT_CONFIG, movingPlatformAt } from '@/entities/level/mechanics';
import {
  DEFAULT_TUTORIAL_PROGRESS,
  learnTutorialAction,
  loadTutorialProgress,
  nextTutorialCue,
  saveTutorialProgress,
  type TutorialAction,
  type TutorialDevice,
  type TutorialProgress,
} from '@/ui/tutorial';

// Render order. Backgrounds sit behind the tiled platforms, which sit behind the actors; chrome
// (label/HUD/pips/banner) and the boss-intro card float on top.
const DEPTH = { bgFar: -40, bgMid: -30, bgNear: -20, platform: -10, decor: -6, fx: 50, hud: 100, card: 200 };

// Game-feel FX (item 1 — presentation only). The One Rule: fixed offset patterns / world.frame-derived
// variation only, never a Phaser ParticleEmitter (it randomizes internally) or Math.random. Every latch
// is a short (<300ms) cosmetic tween/frame-counter that never feeds back into stepWorld.
const HURT_TINT_FRAMES = 6; // white flash-fill on the player after a hit
const HURT_POSE_FRAMES = 14; // hold the hurt pose (item 5) after a hit
const JUICE_FRAMES = 6; // player squash / stretch latch length
const ENEMY_SQUISH_FRAMES = 8; // scaleY x0.5 KO pop on a felled enemy
const VICTIM_FLASH_FRAMES = 2; // a felled enemy flashes the regime glow this long (UX review #10)
const ENDING_HOLD_MS = 1_100;
const CARD_MIN_MS = 1_500;
// The game-over card waits for the tumble to read before covering it.
const GAME_OVER_HOLD_MS = 900;
// Crew-power ghost trail: drop a fading copy of the hero every few frames for a short window.
const TRAIL_FRAMES = 12;
const TRAIL_EVERY = 4;
const TRAIL_POOL = 3;
const GHOST_ALPHA = 0.45;
const GHOST_FADE = 0.04; // alpha lost per frame
// Thrown spiked corn: drawn at CORN_OVERHANG × its hitbox height, ringed by a HAZARD_RIM_PX rim on screen.
const CORN_OVERHANG = 1.1;
const HAZARD_RIM_PX = 2;
const HAZARD_SUFFIX = '-hazard';
// Rim width in source pixels for a frame of this height, so it lands near HAZARD_RIM_PX on screen.
function hazardRimFor(sourceHeight: number): number {
  return Math.max(1, Math.round((HAZARD_RIM_PX * sourceHeight) / (SPIKED_CORN_CONFIG.height * CORN_OVERHANG)));
}
// Fixed sparkle-burst offsets (never a random emitter): a small triangle over a banked cob, a ring
// around a freed ally / buffed player.
const COLLECT_PATTERN: readonly (readonly [number, number])[] = [[-8, -10], [8, -10], [0, -18]];
const RING_PATTERN: readonly (readonly [number, number])[] = [[0, -18], [16, -9], [16, 9], [0, 18], [-16, 9], [-16, -9]];

// Deterministic screen shake (item 1). Phaser's cameras.main.shake() uses Math.random internally, so
// it's banned here — instead a frame-derived decaying oscillation rides followOffset (composes with the
// lookahead below; the follow lerp attenuates it, so amplitudes are the pre-lerp swing). [frames, px].
const SHAKE_HURT: readonly [number, number] = [8, 48];
const SHAKE_BOSS_HIT: readonly [number, number] = [6, 32];
const SHAKE_SLAM: readonly [number, number] = [14, 80];
const SHAKE_BOX: readonly [number, number] = [5, 24];
const SHAKE_HOP: readonly [number, number] = [3, 14]; // a boss hop landing — a light thud (lighter than the slam)
const SHAKE_RAGE: readonly [number, number] = [8, 40]; // King Corn crossing into RAGE — the tantrum beat
const VISUAL_CUE: Partial<Record<string, string>> = {
  hurt: 'Ouch!',
  throw: STRINGS.squirrelThrows, // swapped for the boss's name in an arena (throwCueText)
  'boss-windup': 'Boss winds up',
  'slam-thud': 'Big slam!',
  'rage-roar': 'Corn King powers up!',
  'free-ally': 'Friend freed!',
  'boss-defeat': 'Boss popped!',
};

// Camera lookahead (item 7): bias the camera toward facing so the player sees more of what's ahead.
const CAM_LOOKAHEAD = 70; // px the view leads the player when running
const CAM_EASE = 2; // px/frame the offset eases toward its target (caps the turn-around swing ~1.2s)
const CAM_BOSS_BIAS_MAX = 300; // max px the view may lead toward the boss (keeps the player ≥180px from a 960px edge)
const CAM_BOSS_EASE = 6; // px/frame the bias eases toward the midpoint (fast enough to follow a rage circuit)

// Animation clocks (frames per step of a loop) driven off the deterministic world frame.
const COB_PERIOD = 10; // good-cob-1..4
const THRESHER_PERIOD = 6; // thresher-1..4 (spinning blades)
const KERNEL_PERIOD = 8; // walk-a ↔ walk-b
const PLAYER_RUN_PERIOD = 6; // long stride ↔ planted contact frame
const BOX_GLINT_PERIOD = 12; // wheat-box idle ↔ a brief glint flash
const BOX_BURST_FRAMES = 14; // wheat-box-burst shown this long after a break, then hidden
const KERNEL_TURN_FRAMES = 8; // brief turn pose after a direction flip
const SQUIRREL_WINDUP_FRAMES = 14; // show the wind-up pose this many frames before a lob
const BOSS_PERIOD = 24; // idle ↔ move pacing
const POPCORN_DISPLAY_H = 22; // finale particle base display height (px) — divides out the 6x sprite
// upscale so a kernel/puff reads at a sane size (its small footprint keeps the alpha floor-fade honest).
const FINALE_BUTTER_GLOW = 0xffd45c; // effect light from the authored butter fissures (not a CTA accent)

export class PlayScene extends Phaser.Scene {
  private level: LevelDef = WORLD_1_1;
  private characterId: string = DEFAULT_CHARACTER;
  private canSwitchCharacters = false;
  private introSeen = false; // set by restartStage so the boss card plays once per arena entry
  private pendingCharacterSwitch = false;
  private pendingPowerSelect: CrewPower | undefined; // sent as recorded input at the next fixed frame
  private art!: LevelArtSet; // the level's environment + theme + boss art, resolved in create()
  private playerPrefix: string = DEFAULT_CHARACTER; // the chosen hero's sprite-sheet prefix
  private cfg: WorldConfigs = DEFAULT_CONFIGS; // the chosen hero's feel, resolved in create()
  private world!: WorldState;
  private session!: CampaignSession;
  private replayMode = false;
  private royale: RoyaleRun | undefined;
  private royaleRetry: RoyaleRun | undefined; // the next attempt, banked on game over
  private royalePopAge: number[] = []; // frames since each ring boss popped (presentation only)
  private royaleNameTexts: Phaser.GameObjects.Text[] = []; // ring boss names beside their pip rows
  private royaleNextText: Phaser.GameObjects.Text | undefined; // "Next up:" readout
  private royaleDropSprites: Phaser.GameObjects.Sprite[] = []; // [health pie, power box]
  private teamCfgs: BossConfig[] = []; // each team member's config, for the frame-delta mappers
  private chipY = 80; // the crew-power chip's row (lower with a team boss, under its two health rows)
  private gamepadPauseHeld = false;
  private gamepadSwitchLeftHeld = false;
  private gamepadSwitchRightHeld = false;
  private tutorialProgress: TutorialProgress = { ...DEFAULT_TUTORIAL_PROGRESS };
  private tutorialDevice: TutorialDevice = 'keyboard';
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private bgFar!: Phaser.GameObjects.TileSprite;
  private bgMid!: Phaser.GameObjects.TileSprite;
  private bgNear!: Phaser.GameObjects.TileSprite;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private enemySprites: Phaser.GameObjects.Sprite[] = [];
  private enemyPrevDir: number[] = [];
  private enemyTurnTimer: number[] = [];
  private cobSprites: Phaser.GameObjects.Sprite[] = [];
  private boxSprites: Phaser.GameObjects.Sprite[] = [];
  private boxBurst: number[] = []; // frames of break-burst left per box (presentation only)
  private boxBurstDone: boolean[] = []; // latch so a broken box bursts once, then stays hidden
  private allySprites: Phaser.GameObjects.Sprite[] = [];
  private projSprites: Phaser.GameObjects.Sprite[] = []; // pooled spiked-corn sprites for live shots
  private peelSprites: Phaser.GameObjects.Sprite[] = []; // pooled banana-peel sprites for live peels
  private nutSprites: Phaser.GameObjects.Sprite[] = []; // pooled falling-acorn sprites
  private hazardSprites: Phaser.GameObjects.Sprite[] = [];
  private movingPlatformSprites: Phaser.GameObjects.Sprite[] = [];
  private bouncePadSprites: Phaser.GameObjects.Sprite[] = [];
  private switchSprites: Phaser.GameObjects.Sprite[] = [];
  private gateSprites: Phaser.GameObjects.Sprite[] = [];
  private slickBoardSprites: Phaser.GameObjects.Sprite[] = [];
  private rainStreaks: Phaser.GameObjects.Rectangle[] = [];
  private bossSprite: Phaser.GameObjects.Sprite | undefined;
  private teamSprites: Phaser.GameObjects.Sprite[] = []; // one per team-boss shaker (Salt & Pepper)
  private dizzyStars: Phaser.GameObjects.Sprite[][] = []; // three per boss while it is open (slot 0 = single boss, i = shaker i)
  private hpPips: Phaser.GameObjects.Rectangle[] = [];
  private teamPips: Phaser.GameObjects.Rectangle[][] = []; // hp pips per shaker (one row each)
  private pickupSprites: Phaser.GameObjects.Sprite[] = []; // pep-pie heals / 1-up star tokens
  private hud!: Phaser.GameObjects.Text;
  private powerChip!: Phaser.GameObjects.Text; // selected crew power and its charges/cooldown
  private livesText!: Phaser.GameObjects.Text; // top-right player readout: remaining lives ("TRIES x3")
  private healthPips: Phaser.GameObjects.Rectangle[] = []; // top-right health bar (one pip per hit-point)
  private rightHud: { obj: Phaser.GameObjects.Components.Transform; inset: number }[] = []; // re-pinned on resize
  private leftHud: Phaser.GameObjects.Components.Transform[] = []; // shifted clear of a left notch
  private hudLeft = 0; // safe-area offset (game px) currently applied to the left HUD
  private banner!: Phaser.GameObjects.Text;
  private startLives = INITIAL_LIVES; // lives the run enters this stage with (carried across stages)
  private gameOverShown = false; // latch so the game-over overlay is built once
  private transitioning = false;
  private paused = false; // on a break: the sim step is frozen (presentation only — see update())
  private offIntent: (() => void) | undefined; // unsubscribe handle for the chrome pause/resume intents
  private offVisibility: (() => void) | undefined; // unsubscribe handle for the tab-blur auto-pause (item 9)
  private audio!: AudioBus;
  private rageBedOn = false; // the rage music variant is currently playing (presentation only)
  private prevWorld!: WorldState; // last frame's world, for deriving SFX/FX deltas (presentation only)
  // Game-feel FX state (item 1 — presentation only, reset in init(), never read by the sim).
  private dustPool: Phaser.GameObjects.Sprite[] = []; // pooled dust-puff sprites (land / squish / box)
  private sparklePool: Phaser.GameObjects.Sprite[] = []; // pooled sparkle sprites (collect / rescue / power)
  private hurtTint = 0; // frames of white flash-fill left on the player after a hit
  private hurtPoseTimer = 0; // frames the hurt pose is held (item 5)
  private stretchTimer = 0; // jump stretch latch
  private squashTimer = 0; // land squash latch
  private enemySquish: number[] = []; // per-enemy KO scaleY latch
  private enemyKoFrame: (number | undefined)[] = []; // world frame each enemy was felled (dizzy → poof → gone)
  private enemyFlash: number[] = []; // per-enemy victim flash frames on a kill
  private hitStop = 0; // frames left in a hit-stop freeze (the sim step is skipped, like a pause)
  private advanceStage: (() => void) | undefined; // moves on past the held score card (once)
  private cardShownAt = 0; // scene time the score card appeared
  private nextPressHeld = false; // jump/swing held on the last card frame (a press needs a release first)
  private latchedPresses: LatchedPresses | undefined; // presses seen during a freeze, fed to the next sim frame
  private hurtTintColor = 0xffffff; // regime glow int for the hit flash, resolved in create()
  private shakeFrames = 0; // frames of screen shake left (deterministic, frame-derived)
  private shakeDur = 1; // the shake's full duration, for the decay ramp
  private shakeMag = 0; // shake amplitude (pre-lerp followOffset swing, px)
  private camLookahead = 0; // eased camera lookahead offset (item 7)
  // HUD restyle (item 6 — presentation only).
  private cobIcon: Phaser.GameObjects.Sprite | undefined; // spinning cob beside the counter (field stages)
  private powerPill!: Phaser.GameObjects.Graphics; // rounded pill behind the active-power chip
  private powerPortrait!: Phaser.GameObjects.Sprite; // selected friend's face beside the power verb
  private prevHealth = MAX_HEALTH; // last frame's health, to pulse a pip on a heal
  private accentInt = 0xffffff; // regime accent int (power pill), resolved in create()
  private bgInt = 0; // regime bg int (pip stroke), resolved in create()
  private chipFillInt = 0; // power pill fill: the regime bg, so the chip reads over any backdrop
  private chipFillAlpha = 1;
  // Crew-power ghost trail (presentation only): a few fading copies of the hero after a power press.
  private ghostPool: Phaser.GameObjects.Sprite[] = [];
  private trailFrames = 0; // frames left to drop ghosts
  private trailTick = 0; // frame counter for the ghost cadence
  private finaleActive = false;
  private finaleClock = 0;
  private finaleOriginX = 0;
  private finaleGroundY = 0;
  private volcanoSprite: Phaser.GameObjects.Sprite | undefined;
  private eruptionPlumeSprite: Phaser.GameObjects.Sprite | undefined;
  private craterGlow: Phaser.GameObjects.Arc | undefined;
  private craterFlash: Phaser.GameObjects.Arc | undefined;
  private shockwaveRing: Phaser.GameObjects.Arc | undefined;
  private finaleVeil: Phaser.GameObjects.Rectangle | undefined;
  private popcornPool: Phaser.GameObjects.Sprite[] = [];
  private finaleCreditsPublished = false;

  constructor() {
    super(SCENE.play);
  }

  init(data: {
    level?: LevelDef;
    characterId?: string;
    lives?: number;
    session?: CampaignSession;
    replay?: boolean;
    introSeen?: boolean; // a restart of this stage: the boss card already played on first entry
    royale?: RoyaleRun; // a Boss Royale attempt: the ring, a synthetic session, no campaign saves
  }): void {
    this.royale = data?.royale;
    this.royaleRetry = undefined;
    this.level = this.royale ? BOSS_ROYALE_ARENA : (data?.level ?? WORLD_1_1);
    this.introSeen = data?.introSeen ?? false;
    this.session = this.royale ? royaleSession(this.royale) : (data?.session ?? createCampaignSession({
      characterId: data?.characterId ?? DEFAULT_CHARACTER,
      stageId: this.level.id,
      lives: data?.lives ?? INITIAL_LIVES,
    }));
    this.characterId = this.session.characterId;
    this.canSwitchCharacters = this.royale ? royaleCanSwitch(this.royale, hasCampaignVictory()) : hasCampaignVictory();
    this.pendingCharacterSwitch = false;
    this.pendingPowerSelect = undefined;
    this.replayMode = data?.replay ?? false;
    this.gamepadPauseHeld = false;
    this.gamepadSwitchLeftHeld = false;
    this.gamepadSwitchRightHeld = false;
    this.tutorialProgress = loadTutorialProgress();
    this.tutorialDevice = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
      ? 'touch'
      : 'keyboard';
    this.startLives = this.session.lives;
    this.gameOverShown = false;
    this.transitioning = false;
    this.paused = false; // fresh per restart (level->boss reuses this scene instance)
    this.pickupSprites = [];
    this.healthPips = [];
    this.enemySprites = [];
    this.enemyPrevDir = [];
    this.enemyTurnTimer = [];
    this.cobSprites = [];
    this.boxSprites = [];
    this.boxBurst = [];
    this.boxBurstDone = [];
    this.allySprites = [];
    this.projSprites = [];
    this.peelSprites = [];
    this.nutSprites = [];
    this.hazardSprites = [];
    this.movingPlatformSprites = [];
    this.bouncePadSprites = [];
    this.switchSprites = [];
    this.gateSprites = [];
    this.slickBoardSprites = [];
    this.rainStreaks = [];
    this.bossSprite = undefined;
    this.teamSprites = [];
    this.dizzyStars = [];
    this.hpPips = [];
    this.teamPips = [];
    this.royalePopAge = [];
    this.royaleNameTexts = [];
    this.royaleNextText = undefined;
    this.royaleDropSprites = [];
    this.teamCfgs = [];
    // FX pools + latches (presentation only — scene.restart reuses this instance, so clear them).
    this.dustPool = [];
    this.sparklePool = [];
    this.hurtTint = 0;
    this.hurtPoseTimer = 0;
    this.stretchTimer = 0;
    this.squashTimer = 0;
    this.enemySquish = [];
    this.enemyKoFrame = [];
    this.enemyFlash = [];
    this.hitStop = 0;
    this.latchedPresses = undefined;
    this.advanceStage = undefined;
    this.cardShownAt = 0;
    this.nextPressHeld = false;
    this.shakeFrames = 0;
    this.shakeMag = 0;
    this.camLookahead = 0;
    this.cobIcon = undefined;
    this.ghostPool = [];
    this.trailFrames = 0;
    this.trailTick = 0;
    this.prevHealth = MAX_HEALTH;
    this.rageBedOn = false; // fresh bed per stage — a restart always re-enters on the base theme
    // Finale (presentation only) — zero it so a scene-instance reuse never leaks eruption state.
    this.finaleActive = false;
    this.finaleClock = 0;
    this.volcanoSprite = undefined;
    this.eruptionPlumeSprite = undefined;
    this.craterGlow = undefined;
    this.craterFlash = undefined;
    this.shockwaveRing = undefined;
    this.finaleVeil = undefined;
    this.popcornPool = [];
    this.finaleCreditsPublished = false;
  }

  preload(): void {
    // Loading screen: the title splash (cached from TitleScene) + a loading line while this arena's
    // gameplay + audio assets stream in, so the title→play handoff is never a blank frame. Cleared
    // on load complete (create() rebuilds the scene). Skipped on a bare/dev boot (splash not cached).
    if (this.textures.exists('title-splash')) {
      const splash = this.add.image(this.scale.width / 2, this.scale.height / 2, 'title-splash').setDepth(DEPTH.card);
      const src = this.textures.get('title-splash').getSourceImage();
      splash.setScale(Math.max(this.scale.width / (src.width || 1), this.scale.height / (src.height || 1)));
      const loading = this.add
        .text(this.scale.width / 2, this.scale.height - 40, STRINGS.loading, { fontFamily: 'system-ui, sans-serif', fontSize: '20px', fontStyle: '800', color: regimeCanvas().text })
        .setOrigin(0.5, 0.5)
        .setDepth(DEPTH.card);
      this.load.once(Phaser.Loader.Events.COMPLETE, () => {
        splash.destroy();
        loading.destroy();
      });
    }

    // Our frames are SEPARATE files (one pose each) — load every gameplay image as its own texture
    // keyed by manifest id. Phaser skips keys already cached on restart.
    for (const id of gameplayAssetIdsFor(this.level, this.characterId, this.session.activePower, this.session.rescuedCrew, this.canSwitchCharacters)) {
      if (!this.textures.exists(id)) this.load.image(id, assetPath(id));
    }
    // A boss arena flashes an intro card (a poster, not a gameplay asset) — load THIS arena's card
    // (single boss or team) so showBossCard never requests an unloaded texture.
    const art = artSetFor(this.level);
    const card = art.boss?.card ?? art.teamBoss?.card;
    if (card) this.load.image(card, assetPath(card));
    const sfx = ['ui', 'land', 'jump', 'collect', 'hurt', 'squish', 'swing', 'boss-roar', 'throw', 'box-break', 'power-up', 'free-ally', 'rage-roar', 'hop-thud', 'boss-windup', 'slam-thud', 'boss-defeat'];
    AudioBus.preload(this, [
      art.theme,
      ...(art.rageTheme ? [art.rageTheme] : []),
      ...(art.victoryTheme ? [art.victoryTheme] : []),
      ...sfx,
    ]);
  }

  create(): void {
    // A team arena is a boss arena too — drive the boss regime (accent) off either kind.
    applyRegime(this.level.boss || this.level.teamBoss ? 'boss' : 'level');
    this.art = artSetFor(this.level);
    this.playerPrefix = playerArtPrefix(this.characterId);
    const env = this.art.env;
    const c = regimeCanvas();
    this.hurtTintColor = hexToInt(c.glow); // the hit-flash fill (regime glow, never a literal accent)
    this.accentInt = c.accentInt; // HUD power-pill fill/border (item 6)
    this.bgInt = c.bgInt; // HUD pip stroke (item 6)
    const chip = powerChipStyle(c);
    this.chipFillInt = hexToInt(chip.fill);
    this.chipFillAlpha = chip.fillAlpha;
    this.ensureHazardTextures();
    this.cfg = { ...configsForCharacter(this.characterId), canSwitchCharacters: this.canSwitchCharacters };
    this.cameras.main.setBackgroundColor(c.bg);
    const cameraBounds = cameraBoundsForViewport(this.level.width, this.level.height, this.scale.width, this.scale.height);
    this.cameras.main.setBounds(cameraBounds.x, cameraBounds.y, cameraBounds.width, cameraBounds.height);
    this.cameras.main.fadeIn(300); // ease into the stage (paired with the completion fade-out; item 5)

    // Parallax backgrounds — camera-fixed TileSprites covering the viewport; update() drives
    // tilePositionX off the camera scroll so each layer slides at its own depth. Drawn first.
    // The FAR layer (opaque sky + barn + hills) fills the viewport; the transparent MID corn/fence
    // and NEAR grass layers render as shorter BOTTOM-anchored bands so the foliage sits low and
    // never climbs over the barn on the far layer.
    this.bgFar = this.addParallax(env.bgFar, DEPTH.bgFar, 1, env.farLiftPx);
    this.bgMid = this.addParallax(env.bgMid, DEPTH.bgMid, 0.6);
    this.bgNear = this.addParallax(env.bgNear, DEPTH.bgNear, 0.5);
    // Per-world tint grade (item 3): multiply-tint each parallax layer so every world reads at its own
    // hour/weather (boss arenas = storm), from the shared World-1 art. Presentation-only art data.
    const grade = this.art.grade;
    this.bgFar.setTint(grade.far);
    this.bgMid.setTint(mutedTint(grade.mid, MID_LAYER_MUTE)); // scenery cobs recede behind real ones
    this.bgNear.setTint(grade.near);
    if (grade.camBg) this.cameras.main.setBackgroundColor(grade.camBg);

    // Platforms: skin each LevelDef AABB with a tiled grass-ground strip from the tileset. The art
    // is decoration only — collision is still resolved against this.level.platforms in the sim.
    const tex = this.textures.get(env.tileset);
    if (!tex.has(env.groundFrame)) tex.add(env.groundFrame, 0, env.groundTile.x, env.groundTile.y, env.groundTile.w, env.groundTile.h);
    for (const p of this.level.platforms) {
      const underlay = platformUnderlayFor(p, grade.ground);
      this.add
        .rectangle(underlay.x, underlay.y, underlay.width, underlay.height, underlay.color, underlay.alpha)
        .setOrigin(0, 0)
        .setDepth(DEPTH.platform - 1);
      this.add
        .tileSprite(p.x, p.y, p.w, p.h, env.tileset, env.groundFrame)
        .setOrigin(0, 0)
        .setTileScale(env.groundScale, env.groundScale)
        .setTint(grade.ground) // item 3: match the world's tint grade
        .setDepth(DEPTH.platform);
    }

    // Pits carve through otherwise continuous ground strips in the deterministic collision data.
    // Paint the same spans above the terrain skin with a deep regime-colored void; the extra
    // overdraw stays behind the player during the short readable tumble before checkpoint respawn.
    for (const pit of this.level.pits ?? []) {
      const soilShade = platformUnderlayFor({ x: pit.x, y: pit.y, w: pit.w, h: 1 }, grade.ground).color;
      const visual = pitVisualFor(pit, this.level.height, soilShade);
      this.add
        .rectangle(visual.x, visual.y, visual.width, visual.height, visual.color, visual.alpha)
        .setOrigin(0, 0)
        .setDepth(DEPTH.platform + 1);
      this.add
        .rectangle(visual.x, visual.y, visual.width, visual.lipHeight, visual.lipColor, visual.lipAlpha)
        .setOrigin(0, 0)
        .setDepth(DEPTH.platform + 2);
    }

    // Field mechanisms are authored simulation objects with matching pixel-art skins. Unlike the
    // static terrain, moving-platform poses are refreshed from the deterministic world frame below.
    this.movingPlatformSprites = (this.level.movingPlatforms ?? []).map((platform) => {
      const pose = movingPlatformAt(platform, 0);
      return this.add
        .sprite(pose.x + pose.w / 2, pose.y + pose.h, 'moving-platform')
        .setOrigin(0.5, 1)
        .setDisplaySize(pose.w, 100)
        .setDepth(DEPTH.decor);
    });
    this.bouncePadSprites = (this.level.bouncePads ?? []).map((pad) =>
      this.add
        .sprite(pad.x + pad.w / 2, pad.y + pad.h, 'bounce-pad')
        .setOrigin(0.5, 1)
        .setDisplaySize(pad.w, 64)
        .setDepth(DEPTH.decor),
    );
    this.switchSprites = (this.level.switches ?? []).map((target) => {
      const id = target.accepts === 'swing' ? 'root-switch' : 'ricochet-target';
      const w = target.accepts === 'swing' ? 48 : 64;
      const h = target.accepts === 'swing' ? 64 : 72;
      return this.add
        .sprite(target.x + target.w / 2, target.y + target.h, id)
        .setOrigin(0.5, 1)
        .setDisplaySize(w, h)
        .setDepth(DEPTH.decor + 1);
    });
    this.gateSprites = (this.level.gates ?? []).map((gate) =>
      this.add
        .sprite(gate.x + gate.w / 2, gate.y + gate.h, 'root-gate')
        .setOrigin(0.5, 1)
        .setDisplaySize(64, gate.h)
        .setDepth(DEPTH.decor),
    );
    this.slickBoardSprites = (this.level.slickSurfaces ?? []).map((surface) =>
      this.add
        .sprite(surface.x + surface.w / 2, surface.y + 4, 'slick-board')
        .setOrigin(0.5, 1)
        .setDisplaySize(surface.w, 32)
        .setDepth(DEPTH.decor),
    );

    // Pickle Storm rain is camera-fixed presentation driven from the sim frame (never Phaser's
    // randomized particles). Reduced-motion keeps the weather visible but still.
    if (this.level.weather === 'rain') {
      this.rainStreaks = Array.from({ length: 42 }, (_, i) =>
        this.add
          .rectangle((i * 149) % this.scale.width, (i * 83) % this.scale.height, 2, 20, hexToInt(c.glow), 0.34)
          .setRotation(-0.2)
          .setScrollFactor(0)
          .setDepth(DEPTH.fx - 1),
      );
    }

    // Barn door (the goal): a local sprite filling the goal portal (authored at the goal's 3:8 ratio,
    // so the fill doesn't distort). Checkpoints: a scarecrow waypoint standing on the ground at the band.
    if (this.level.goal) {
      const g = this.level.goal;
      this.add.sprite(g.x, g.y, 'level-exit').setOrigin(0, 0).setDisplaySize(g.w, g.h).setDepth(DEPTH.decor);
    }
    for (const cp of this.level.checkpoints) {
      const centerX = cp.x + cp.w / 2;
      const marker = this.add.sprite(centerX, groundSupportY(this.level, centerX), 'checkpoint-marker').setOrigin(0.5, 1).setDepth(DEPTH.decor);
      const tex = this.textures.get('checkpoint-marker').getSourceImage();
      marker.setScale(120 / (tex.height || 120)); // ~120px-tall scarecrow, rooted at the surface
    }

    // Threshers (hazards) — placement only, from this.level.hazards. Spinning loop in update().
    this.hazardSprites = this.level.hazards.map(() =>
      this.add.sprite(0, 0, 'thresher-1').setOrigin(0.5, 1).setDepth(0),
    );
    this.level.hazards.forEach((h, i) =>
      this.skin(this.hazardSprites[i]!, 'thresher-1', this.box(h.x, h.y, THRESHER_CONFIG.width, THRESHER_CONFIG.height), 1.2),
    );

    const active = this.session.activePower;
    this.world = this.royale ? spawnWorldFromInit(this.level, royaleInit(this.royale)) : spawnWorld(this.level, this.startLives, {
      activePower: active,
      powerCharges: active === 'none' ? 0 : (this.session.crewResources[active] ?? 0),
      shield: active === 'leafGuard' && (this.session.crewResources.leafGuard ?? 0) > 0,
      bossAssistTier: bossAssistTier(this.session, this.level.id),
      crewCharges: Object.fromEntries(this.session.rescuedCrew.map((friend) => {
        const power = CREW_POWER[friend];
        // A save may list a rescued friend without a stored count; that friend starts full, as before.
        return [power, this.session.crewResources[power] ?? CREW_MAX_CHARGES[power]];
      })),
    });
    this.prevWorld = this.world;
    this.teamCfgs = this.art.teamBoss?.members.map((m) => m.config) ?? [];
    // Earlier attempts' pops never show; a pop this attempt restarts its clock.
    this.royalePopAge = this.world.teamBoss?.members.map(() => Infinity) ?? [];
    this.chipY = crewChipY(this.level);

    // Audio: a presentation-only bus (reads state, never writes the sim). Start the bed for this
    // arena — the boss romp in an arena, the bouncy farm theme otherwise. On a scene restart the
    // old bus is torn down on SHUTDOWN, so the previous track stops before the new one starts.
    this.audio = new AudioBus(this);
    this.audio.playMusic(this.art.theme, { startFraction: this.art.themeStartFraction });

    // Good cobs (pickups). Tracked so update() can hide one the instant it is collected.
    this.cobSprites = this.world.collectibles.map((cob) => {
      const s = this.add.sprite(0, 0, 'good-cob-1').setOrigin(0.5, 1);
      this.skin(s, 'good-cob-1', this.box(cob.x, cob.y, GOOD_COB_CONFIG.width, GOOD_COB_CONFIG.height), 1.5);
      return s;
    });

    // Wheat-stamped power-up boxes. Idle bob + glint while intact; a burst, then hidden, on break.
    this.boxSprites = this.world.boxes.map((bx) => {
      const s = this.add.sprite(0, 0, 'wheat-box-idle').setOrigin(0.5, 1);
      this.skin(s, 'wheat-box-idle', this.box(bx.x, bx.y, WHEAT_BOX_CONFIG.width, WHEAT_BOX_CONFIG.height), 1.1);
      return s;
    });
    this.boxBurst = this.world.boxes.map(() => 0);
    this.boxBurstDone = this.world.boxes.map(() => false);

    // Captured-produce allies. Caged behind husk-bars until rescued, then the freed (happy-hop) pose.
    this.allySprites = this.world.allies.map((a) => {
      const id = `ally-${a.name}-caged`;
      const s = this.add.sprite(0, 0, id).setOrigin(0.5, 1);
      this.skin(s, id, this.box(a.x, a.y, ALLY_CONFIG.width, ALLY_CONFIG.height), 1.2);
      return s;
    });

    const glowInt = hexToInt(c.glow); // regime glow for the HUD health pips (below)
    // Restorative pickups: a pep-pie heal (health) or a 1-up star token (extra life), skinned to the
    // pickup AABB. Hidden the instant it is banked.
    this.pickupSprites = this.world.pickups.map((pk) => {
      const id = pk.kind === 'life' ? 'oneup-pickup' : 'pep-pickup';
      const s = this.add.sprite(0, 0, id).setOrigin(0.5, 1).setDepth(DEPTH.decor);
      this.skin(s, id, this.box(pk.x, pk.y, PICKUP_CONFIG.width, PICKUP_CONFIG.height), 1.15);
      return s;
    });

    // The boss, if this is an arena.
    if (this.world.boss && this.art.boss) {
      const b = this.world.boss;
      const bc = this.art.boss.config;
      this.bossSprite = this.add.sprite(0, 0, this.art.boss.poses.idle).setOrigin(0.5, 1);
      this.skin(this.bossSprite, this.art.boss.poses.idle, this.box(b.x, b.y, bc.width, bc.height), 1.25);
    }

    // The team boss (Salt & Pepper) — one sprite per shaker, each from its row of the sheet.
    if (this.world.teamBoss && this.art.teamBoss) {
      this.teamSprites = this.world.teamBoss.members.map((m, i) => {
        const art = this.art.teamBoss!.members[i]!;
        const s = this.add.sprite(0, 0, art.poses.idle).setOrigin(0.5, 1);
        this.skin(s, art.poses.idle, this.box(m.x, m.y, art.config.width, art.config.height), 1.25);
        if (this.world.teamBoss!.royale) s.setVisible(royaleBodyAlpha(this.world.teamBoss!, i, Infinity) > 0);
        return s;
      });
    }
    // Boss Royale pop drops: a pep pie (health) and a wheat box (power refill), shown while on offer.
    if (this.world.teamBoss?.royale) {
      this.royaleDropSprites = ['pep-pickup', 'wheat-box-idle'].map((id) =>
        this.add.sprite(0, 0, id).setOrigin(0.5, 1).setDepth(DEPTH.decor).setVisible(false),
      );
    }

    const idleFrame = `${this.playerPrefix}-idle`;
    this.playerSprite = this.add.sprite(0, 0, idleFrame).setOrigin(0.5, 1);
    this.skin(this.playerSprite, idleFrame, this.playerBox(), 1.3);

    this.enemySprites = this.world.enemies.map((e) => {
      const id = e.kind === 'squirrel' ? 'squirrel-walk-a' : 'kernel-creep-walk-a';
      const dims = e.kind === 'squirrel' ? SQUIRREL_CONFIG : KERNEL_CREEP_CONFIG;
      const s = this.add.sprite(0, 0, id).setOrigin(0.5, 1);
      this.skin(s, id, this.box(e.x, e.y, dims.width, dims.height), 1.3);
      return s;
    });
    this.enemyPrevDir = this.world.enemies.map((e) => e.dir);
    this.enemyTurnTimer = this.world.enemies.map(() => 0);
    this.enemySquish = this.world.enemies.map(() => 0);
    this.enemyKoFrame = this.world.enemies.map(() => undefined);
    this.enemyFlash = this.world.enemies.map(() => 0);

    this.cameras.main.startFollow(this.playerSprite, true, 0.12, 0.12);
    this.cameras.main.setFollowOffset(0, 0); // reset the lookahead/shake channel (item 7; scene reused)

    const title = STRINGS[(this.level.titleId ?? 'world1') as keyof typeof STRINGS] ?? STRINGS.world1;
    const titleText = this.add
      .text(20, 18, title, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        fontStyle: '800',
        color: c.text,
      })
      .setScrollFactor(0)
      .setOrigin(0, 0)
      .setDepth(DEPTH.hud);

    // HUD: cob count for a normal stage, boss hp pips for an arena (one row per team shaker). Pips get a
    // 1px darker stroke (regime bg) so they read against any graded backdrop (item 6).
    const pipColor = hexToInt(c.glow);
    const makePips = (count: number, row: number): Phaser.GameObjects.Rectangle[] =>
      Array.from({ length: count }, (_, i) =>
        this.add.rectangle(20 + i * 26, 52 + row * 20, 20, 14, pipColor, 1).setStrokeStyle(1, this.bgInt).setScrollFactor(0).setOrigin(0, 0).setDepth(DEPTH.hud),
      );
    if (this.world.boss && this.art.boss) {
      this.hpPips = makePips(this.art.boss.config.maxHp, 0);
    } else if (this.world.teamBoss?.royale && this.art.teamBoss) {
      // The ring shows a pip row (plus the boss's name) only for each boss in it, by corner; update()
      // places and reveals them.
      this.teamPips = this.world.teamBoss.members.map((_, i) => makePips(this.art.teamBoss!.members[i]!.config.maxHp, 0));
      this.teamPips.forEach((row) => row.forEach((pip) => pip.setVisible(false)));
      this.royaleNameTexts = this.art.teamBoss.members.map((m, i) =>
        this.add
          .text(20 + m.config.maxHp * 26 + 4, 50, royaleNames([ROYALE_MEMBERS[i]!]), { fontFamily: 'system-ui, sans-serif', fontSize: '14px', fontStyle: '800', color: c.text })
          .setScrollFactor(0)
          .setOrigin(0, 0)
          .setDepth(DEPTH.hud)
          .setVisible(false),
      );
    } else if (this.world.teamBoss && this.art.teamBoss) {
      this.teamPips = this.world.teamBoss.members.map((_, i) => makePips(this.art.teamBoss!.members[i]!.config.maxHp, i));
    } else {
      // Cob counter: a spinning cob icon + an "x got/total" tally (item 6), replacing the bare string.
      this.cobIcon = this.add.sprite(30, 56, 'good-cob-1').setScrollFactor(0).setOrigin(0.5, 0.5).setDepth(DEPTH.hud);
      const ct = this.textures.get('good-cob-1').getSourceImage();
      this.cobIcon.setScale(28 / (ct.height || 28));
      this.cobIcon.setData('baseScale', this.cobIcon.scaleX); // pulse() pops relative to this fit scale, not 1
      this.hud = this.add
        .text(48, 48, '', { fontFamily: 'system-ui, sans-serif', fontSize: '16px', fontStyle: '700', color: c.text })
        .setScrollFactor(0)
        .setOrigin(0, 0)
        .setDepth(DEPTH.hud);
    }

    const isBossArena = !!(this.level.boss || this.level.teamBoss);
    const clearText = STRINGS[(this.level.clearId ?? (isBossArena ? 'bossDown' : 'world1Clear')) as keyof typeof STRINGS] ?? STRINGS.world1Clear;
    this.banner = this.add
      .text(this.scale.width / 2, this.scale.height / 2, clearText, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '40px',
        fontStyle: '900',
        color: c.accent,
      })
      .setScrollFactor(0)
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH.hud)
      .setVisible(false);

    // Active-power chip: selected crew power plus charges/cooldown (never a rescue countdown).
    // Below the cob/pip HUD so it never collides; hidden until a power is live. A rounded pill in the
    // regime bg, outlined in the accent, sits behind it (item 6; kid-session F5 for legibility over sky)
    // — colours via the regime bridge, never a literal accent.
    this.powerPill = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud - 1).setVisible(false);
    this.powerPortrait = this.add
      .sprite(34, this.chipY + 11, 'sparkle')
      .setScrollFactor(0)
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH.hud)
      .setVisible(false);
    this.powerChip = this.add
      .text(60, this.chipY, '', { fontFamily: 'system-ui, sans-serif', fontSize: '16px', fontStyle: '800', color: chip.text })
      .setScrollFactor(0)
      .setOrigin(0, 0)
      .setDepth(DEPTH.hud)
      .setVisible(false);

    // Player survival readout, top-right (camera-fixed): remaining lives + this life's health bar.
    // Lives carry across stages; the bar refills on respawn. Both update() off the sim each frame.
    const RX = this.scale.width - 20;
    this.livesText = this.add
      .text(RX, 14, '', { fontFamily: 'system-ui, sans-serif', fontSize: '20px', fontStyle: '800', color: c.text })
      .setScrollFactor(0)
      .setOrigin(1, 0)
      .setDepth(DEPTH.hud);
    const PIP_W = 22;
    const PIP_GAP = 5;
    const barW = MAX_HEALTH * PIP_W + (MAX_HEALTH - 1) * PIP_GAP;
    const healthLabel = this.add
      .text(RX - barW - 8, 46, STRINGS.health, { fontFamily: 'system-ui, sans-serif', fontSize: '14px', fontStyle: '700', color: c.text })
      .setScrollFactor(0)
      .setOrigin(1, 0)
      .setDepth(DEPTH.hud);
    if (this.world.teamBoss?.royale) {
      // Beside the ring title, clear of the corner buttons the chrome lays over the top-right.
      this.royaleNextText = this.add
        .text(20 + titleText.width + 14, 25, '', { fontFamily: 'system-ui, sans-serif', fontSize: '14px', fontStyle: '800', color: c.text })
        .setScrollFactor(0)
        .setOrigin(0, 0)
        .setDepth(DEPTH.hud);
    }
    this.healthPips = Array.from({ length: MAX_HEALTH }, (_, i) =>
      this.add
        .rectangle(RX - barW + i * (PIP_W + PIP_GAP), 48, PIP_W, 14, glowInt, 1)
        .setStrokeStyle(1, this.bgInt) // item 6: a darker stroke so pips read on any graded backdrop
        .setScrollFactor(0)
        .setOrigin(0, 0)
        .setDepth(DEPTH.hud),
    );
    // Keep each right-anchored readout's distance from the right edge, so a resize re-pins it there.
    this.rightHud = [this.livesText, healthLabel, ...this.healthPips].map((obj) => ({ obj, inset: this.scale.width - obj.x }));
    // The left readouts, built at their base x; fitHudToSafeArea() shifts them past a notch.
    this.leftHud = [
      titleText,
      ...this.hpPips,
      ...this.teamPips.flat(),
      ...this.royaleNameTexts,
      ...(this.cobIcon ? [this.cobIcon, this.hud] : []), // the counter exists on field stages only
      this.powerPortrait,
      this.powerChip,
      this.royaleNextText,
    ].filter((obj): obj is NonNullable<typeof obj> => obj !== undefined);
    this.hudLeft = 0;
    this.fitHudToSafeArea();

    // Boss-intro card: flash the boss poster centered, then fade. Pure presentation — the tween
    // never touches the stepWorld() loop, so determinism holds. A team arena flashes one shared card.
    // Shown on first entry only: a retry or restart goes straight back to the fight.
    if (!this.introSeen && this.art.boss) this.showBossCard(this.art.boss.card);
    else if (!this.introSeen && this.art.teamBoss?.card) this.showBossCard(this.art.teamBoss.card);

    const kb = this.input.keyboard;
    // ESC/P toggle the break from the keyboard (the chrome button does it by mouse/touch).
    if (kb) {
      this.keys = kb.addKeys('LEFT,RIGHT,UP,SPACE,A,D,W,J,K,L,Q,E,SHIFT,ESC,P') as Record<string, Phaser.Input.Keyboard.Key>;
      const bindings = loadBindings();
      for (const [action, code] of Object.entries(bindings)) {
        // Confirm and back are menu bindings the chrome reads; play never does. Adding them here would
        // make Phaser cancel Enter page-wide, so focused corner buttons ignored it during play.
        if (action === 'confirm' || action === 'back') continue;
        const token = code === 'Space'
          ? 'SPACE'
          : code === 'Escape'
            ? 'ESC'
            : code.startsWith('Key')
              ? code.slice(3)
              : code.replace(/^Arrow/, '').toUpperCase();
        const keyCode = Phaser.Input.Keyboard.KeyCodes[token as keyof typeof Phaser.Input.Keyboard.KeyCodes];
        if (typeof keyCode === 'number') this.keys[`ACTION_${action}`] = kb.addKey(keyCode);
      }
    }

    // Break wiring: the React chrome's pause button emits pause/resume intents; PlayScene is the sole
    // owner of the frozen state (it applies them and publishes `paused` back via the snapshot). Stored
    // off-handle is torn down on SHUTDOWN so listeners don't pile up across the level->boss restart
    // (the same scene instance is reused — scene.restart re-runs create()).
    this.offIntent = intent.on((i) => {
      if (i.type === 'pause') this.setPaused(true);
      else if (i.type === 'resume') this.setPaused(false);
      else if (i.type === 'select-power') this.equipCrewPower(i.power);
      else if (i.type === 'restart-stage') this.restartStage(false);
      else if (i.type === 'retry') this.restartStage(true);
      else if (i.type === 'next-stage') this.requestNextStage();
      else if (i.type === 'quit-title') this.quitToTitle();
      else if (i.type === 'royale-again' && this.royale) this.restartStage(false); // Mash Again: a fresh run
      else if (i.type === 'switch-character' && this.canSwitchCharacters && !this.paused && !this.transitioning && !this.gameOverShown) {
        this.pendingCharacterSwitch = true; // consumed as recorded input at the next fixed frame
      }
    });
    // Auto-pause when the tab is backgrounded (item 9): Phaser keeps ticking via forceSetTimeOut, so a
    // kid who tabs away shouldn't return to a lost life. PlayScene owns the pause (setPaused publishes it
    // back to the chrome), so this just routes the DOM visibility event in.
    this.offVisibility = installVisibilityPause(() => this.setPaused(true));
    this.scale.on(Phaser.Scale.Events.RESIZE, this.fitViewport, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.fitViewport, this);
      this.offIntent?.();
      this.offIntent = undefined;
      this.offVisibility?.();
      this.offVisibility = undefined;
      // Clear the overlay so a scene change never leaves the chrome stuck on "paused".
      if (snapshot.get().paused || snapshot.get().gameOver) snapshot.set({ ...snapshot.get(), paused: false, gameOver: false });
      if (snapshot.get().bossIntro) snapshot.set({ ...snapshot.get(), bossIntro: false });
      // A banner raised on the last frame (the final "Ouch!") must not ride into the restarted stage.
      if (snapshot.get().visualCue) {
        const cleared = { ...snapshot.get() };
        delete cleared.visualCue;
        snapshot.set(cleared);
      }
    });
    // Publish gameplay chrome only after every intent listener is installed. On a slower phone,
    // exposing Pause earlier created a real race where the first tap was delivered to nobody.
    this.publishCampaign();
    // A field with a caged friend opens on its objective (UX review #7). Not a sound caption, so it
    // shows whatever the visual-cue setting says.
    const objective = this.royale ? undefined : objectiveCue(this.level);
    if (objective) snapshot.set({ ...snapshot.get(), visualCue: { id: this.world.frame, text: objective } });
  }

  private setPaused(paused: boolean): void {
    if (this.transitioning || this.gameOverShown) return;
    if (this.paused === paused) return;
    this.paused = paused;
    if (paused) {
      this.learnTutorial('pause');
      this.audio.pauseMusic();
    }
    else this.audio.resumeMusic();
    snapshot.set({ ...snapshot.get(), paused });
  }

  // A camera-fixed TileSprite for one parallax layer. update() slides tilePositionX for the
  // parallax; tiling across the level width is automatic. heightFrac === 1 fills the viewport
  // (origin top-left) — the opaque far backdrop; heightFrac < 1 renders a shorter band hugging the
  // viewport floor (origin bottom-left) so a transparent foliage layer sits low and reads as
  // foreground. A low-authored far horizon may overdraw above the viewport by a source-pixel lift;
  // this reveals the distant scene without wrapping terrain into the top edge of the sky.
  private addParallax(key: string, depth: number, heightFrac = 1, liftSourcePx = 0): Phaser.GameObjects.TileSprite {
    const ts = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, key);
    ts.setScrollFactor(0).setDepth(depth).setData('parallax', { key, heightFrac, liftSourcePx });
    this.placeParallax(ts);
    return ts;
  }

  // Size and place one parallax layer for the current viewport (at create and after a resize).
  private placeParallax(ts: Phaser.GameObjects.TileSprite): void {
    const { key, heightFrac, liftSourcePx } = ts.getData('parallax') as { key: string; heightFrac: number; liftSourcePx: number };
    const h = this.scale.height;
    const src = this.textures.get(key).getSourceImage(); // the art, not ts.texture (the sprite's own canvas)
    const placement = parallaxPlacement(h, src.height || h, heightFrac, liftSourcePx);
    ts.setPosition(0, placement.y).setSize(this.scale.width, placement.height).setOrigin(0, placement.originY);
    ts.setTileScale(placement.scale, placement.scale);
    // TileSprite textures wrap. Sampling the exact top edge of a cropped transparent band blends
    // its opaque bottom row back into row zero and draws a full-width hairline. Nudge one source
    // pixel into the transparent padding; horizontal tiling remains unchanged.
    ts.tilePositionY = placement.tilePositionY;
  }

  // A phone turned mid-stage resizes the game (Phaser EXPAND). Re-fit what create() sized to the old
  // viewport: camera bounds, parallax bands, the right-anchored HUD, and the centered banner.
  private fitViewport(): void {
    const { width, height } = this.scale;
    const bounds = cameraBoundsForViewport(this.level.width, this.level.height, width, height);
    this.cameras.main.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);
    for (const layer of [this.bgFar, this.bgMid, this.bgNear]) this.placeParallax(layer);
    this.fitHudToSafeArea(); // a turned phone moves the notch to the other side
    this.banner.setPosition(width / 2, this.finaleVeil ? this.banner.y : height / 2); // the finale pins it near the top
  }

  // Keep the camera-pinned HUD inside the safe area: the canvas fills under a notch and the rounded
  // corners (viewport-fit=cover). Presentation only; nothing here reaches the sim.
  private fitHudToSafeArea(): void {
    const { width } = this.scale;
    const { left, right } = hudSafeInsets(readSafeInsets(), this.game.canvas.getBoundingClientRect().width, width);
    for (const obj of this.leftHud) obj.x += left - this.hudLeft;
    this.hudLeft = left;
    for (const { obj, inset } of this.rightHud) obj.x = width - inset - right;
  }

  private box(x: number, y: number, w: number, h: number): Aabb {
    return { x, y, w, h };
  }

  private playerBox(): Aabb {
    const p = this.world.player;
    return { x: p.x, y: p.y, w: this.cfg.player.width, h: this.cfg.player.height };
  }

  // Skin one sprite over an AABB: swap to the frame, scale uniformly so it reads at the box height
  // with a little overhang (cutouts are trimmed at varying sizes — anchor at the feet, not a fixed
  // frame size), and plant it at the AABB's bottom-center (origin 0.5,1).
  private skin(sprite: Phaser.GameObjects.Sprite, id: string, b: Aabb, overhang: number): void {
    if (sprite.texture.key !== id) sprite.setTexture(id);
    const native = sprite.height || b.h;
    sprite.setScale((b.h * overhang) / native);
    sprite.setPosition(b.x + b.w / 2, b.y + b.h);
  }

  // Build the rimmed, recolored spiked-corn frames once from the loaded images. Canvas textures, so
  // they look the same under the WebGL and Canvas renderers. Textures outlive a scene restart, so a
  // later stage reuses them. A frame this stage didn't load is skipped (the plain frame is drawn).
  private ensureHazardTextures(): void {
    for (let n = 1; n <= 4; n++) {
      const id = `spiked-corn-${n}`;
      const key = `${id}${HAZARD_SUFFIX}`;
      if (this.textures.exists(key) || !this.textures.exists(id)) continue;
      const image = this.textures.get(id).getSourceImage() as CanvasImageSource & { width: number; height: number };
      const scratch = document.createElement('canvas');
      scratch.width = image.width;
      scratch.height = image.height;
      const ctx = scratch.getContext('2d', { willReadFrequently: true });
      if (!ctx) continue;
      ctx.drawImage(image, 0, 0);
      const source = ctx.getImageData(0, 0, image.width, image.height);
      const out = outlineHazard(source, hazardRimFor(image.height), HAZARD_OUTLINE, HAZARD_TINT);
      const texture = this.textures.createCanvas(key, out.width, out.height);
      if (!texture) continue;
      const pixels = texture.context.createImageData(out.width, out.height);
      pixels.data.set(out.data);
      texture.context.putImageData(pixels, 0, 0);
      texture.refresh();
    }
  }

  // Fade the crew-power ghosts and drop a new one on the trail cadence. Presentation only.
  private tickGhostTrail(): void {
    for (const ghost of this.ghostPool) {
      if (!ghost.visible) continue;
      ghost.setAlpha(ghost.alpha - GHOST_FADE);
      if (ghost.alpha <= 0) ghost.setVisible(false);
    }
    if (this.trailFrames <= 0) return;
    if (this.trailTick % TRAIL_EVERY === 0) {
      const hero = this.playerSprite;
      let ghost = this.ghostPool.find((g) => !g.visible);
      if (!ghost && this.ghostPool.length < TRAIL_POOL) {
        ghost = this.add.sprite(0, 0, hero.texture.key);
        this.ghostPool.push(ghost);
      }
      ghost
        ?.setTexture(hero.texture.key)
        .setOrigin(hero.originX, hero.originY)
        .setScale(hero.scaleX, hero.scaleY)
        .setFlipX(hero.flipX)
        .setRotation(hero.rotation)
        .setPosition(hero.x, hero.y)
        .setDepth(hero.depth - 1)
        .setAlpha(GHOST_ALPHA)
        .setVisible(true);
    }
    this.trailTick++;
    this.trailFrames--;
  }

  private clearGhostTrail(): void {
    this.trailFrames = 0;
    for (const ghost of this.ghostPool) ghost.setVisible(false);
  }

  // Map a boss's state-machine mode to its pose frame (presentation only — reads sim state, never
  // writes it). The `hurt` (reeling) frame is reserved for an ACTUAL hit (hitCooldown > 0) — reusing
  // it for the wind-up made every telegraph read as a spurious stun ("flashing/reeling, but no damage").
  // The wind-up now rears into the aggressive `move` pose (a charging tell, distinguished from the live
  // attack by the telegraph blink); an attack holds `move`, a recovery the open `idle`; a live pacer
  // alternates idle↔move.
  private bossPose(b: BossState, poses: { idle: string; move: string; hurt: string; defeated: string }, frame: number): string {
    if (b.hp <= 0) return poses.defeated;
    if (b.hitCooldown > 0) return poses.hurt;
    if (b.mode === 'windup') return poses.move;
    if (b.mode === 'attack') return poses.move;
    if (b.mode === 'recover') return poses.idle;
    return Math.floor(frame / BOSS_PERIOD) % 2 === 0 ? poses.idle : poses.move;
  }

  private bossHopRageJuice(sprite: Phaser.GameObjects.Sprite, b: BossState, bc: BossConfig, frame: number, rage: boolean): void {
    // Per-attack wind-up silhouette (plan §0 item 4): a lob leans back, a dash crouches, a slam rears up,
    // so the three tells no longer share one pose. The hop keeps its coil below.
    const windup = bossWindupLook(b, attackProfileFor(activePhase(b, bc), b.attack).windupFrames);
    if (windup) {
      sprite.scaleX *= windup.scaleX;
      sprite.scaleY *= windup.scaleY;
      sprite.y += windup.dy;
    }
    sprite.setRotation(windup ? windup.angle : 0);
    if (b.attack === 'hop') {
      const ph = activePhase(b, bc);
      if (b.mode === 'windup') {
        const squash = 0.25 * (1 - b.modeTimer / ph.windupFrames); // 0 → 25% as launch nears
        sprite.scaleY *= 1 - squash;
        sprite.scaleX *= 1 + 0.5 * squash; // bulge out to preserve volume — reads as a coiling spring
      } else if (b.mode === 'attack') {
        sprite.scaleY *= 1.06;
      } else if (b.mode === 'recover') {
        const into = bossRecoveryFramesFor(b, ph, b.attack) - b.modeTimer; // frames since touchdown
        if (into < 12) {
          const settle = 0.14 * (1 - into / 12); // absorb the crash, then rise back to idle
          sprite.scaleY *= 1 - settle;
          sprite.scaleX *= 1 + 0.5 * settle;
        }
      }
    }
    if (rage) {
      const look = rageLook(frame, this.reducedMotion); // pulse + ±3px tremble, or a steady tint
      if (look.tinted) sprite.setTint(this.hurtTintColor);
      else sprite.clearTint();
      sprite.x += look.dx;
    } else {
      sprite.clearTint();
    }
  }

  // Dizzy stars: while a boss is open (recovering, not flashing) three small stars circle above its
  // drawn head, the kid-readable "hit it now" sign. Owned sprites, not the sparkle pool (pool reuse
  // would kill them mid-orbit). Position is frame-derived (no tweens, no rng); reduced motion holds
  // them still in a row. The drawn head sits a quarter-height above the body (skin overhang 1.25).
  private drawDizzyStars(slot: number, b: BossState, bc: BossConfig, frame: number): void {
    const open = bossOpen(b, bc);
    let stars = this.dizzyStars[slot];
    if (!stars) {
      if (!open) return;
      stars = Array.from({ length: 3 }, () => this.add.sprite(0, 0, 'sparkle').setOrigin(0.5, 0.5).setDepth(DEPTH.fx).setScale(0.2));
      this.dizzyStars[slot] = stars;
    }
    const cx = b.x + bc.width / 2;
    const cy = b.y - bc.height * 0.25 - 10;
    const still = document.documentElement.dataset.reducedMotion === 'true';
    stars.forEach((star, k) => {
      star.setVisible(open);
      if (!open) return;
      if (still) {
        star.setPosition(cx + (k - 1) * bc.width * 0.35, cy);
      } else {
        const angle = frame * 0.08 + (k * 2 * Math.PI) / 3;
        star.setPosition(cx + Math.cos(angle) * bc.width * 0.4, cy + Math.sin(angle) * 6);
      }
    });
  }

  // The King inside the Boss Royale ring in his marked RAGE phase (team members otherwise never rage).
  private memberRaging(i: number): boolean {
    const team = this.world.teamBoss;
    const m = team?.members[i];
    const cfg = this.teamCfgs[i];
    return !!team && !!m && !!cfg && m.hp > 0 && (!team.royale || inRoyaleRing(team, i)) && activePhase(m, cfg).rage === true;
  }

  // Reduced motion (Settings or the OS default) swaps every canvas flash, blink and tremble for a
  // steady stand-in (src/render/motion.ts).
  private get reducedMotion(): boolean {
    return document.documentElement.dataset.reducedMotion === 'true';
  }

  private showBossCard(cardId: string): void {
    const card = this.add
      .image(this.scale.width / 2, this.scale.height / 2, cardId)
      .setScrollFactor(0)
      .setDepth(DEPTH.card);
    const src = this.textures.get(cardId).getSourceImage();
    const fit = Math.min((this.scale.width * 0.9) / (src.width || 1), (this.scale.height * 0.9) / (src.height || 1));
    card.setScale(fit);
    // The control tip hides while the card shows (cleared on SHUTDOWN too, if the card is cut short).
    snapshot.set({ ...snapshot.get(), bossIntro: true });
    this.tweens.add({
      targets: card,
      alpha: 0,
      delay: 900,
      duration: 500,
      onComplete: () => {
        card.destroy();
        snapshot.set({ ...snapshot.get(), bossIntro: false });
      },
    });
  }

  // Apply one presentation FX event (item 1): screen shake, dust puffs, sparkle bursts, and the short
  // latches the render loops read. Colors route through the regime bridge (this.hurtTintColor), never a
  // literal accent. Pure downstream of the sim — nothing here feeds back into stepWorld (the One Rule).
  private applyFx(ev: FxEvent): void {
    switch (ev.type) {
      case 'hurt':
        this.shake(...SHAKE_HURT);
        this.hurtTint = HURT_TINT_FRAMES;
        this.hurtPoseTimer = HURT_POSE_FRAMES;
        this.clearGhostTrail();
        break;
      case 'power-use': {
        // A crew-power press: a kick of dust at the rear foot and a short ghost trail behind the hero.
        const w = this.cfg.player.width;
        this.spawnDust(ev.x + w / 2 - ev.facing * (w / 2), ev.y + this.cfg.player.height, 2);
        if (document.documentElement.dataset.reducedMotion !== 'true') {
          this.trailFrames = TRAIL_FRAMES;
          this.trailTick = 0;
        }
        break;
      }
      case 'land':
        this.spawnDust(ev.x + this.cfg.player.width / 2, ev.y + this.cfg.player.height, 3);
        this.squashTimer = JUICE_FRAMES;
        break;
      case 'squish': {
        this.enemySquish[ev.i] = ENEMY_SQUISH_FRAMES;
        this.enemyKoFrame[ev.i] = this.world.frame;
        this.enemyFlash[ev.i] = VICTIM_FLASH_FRAMES;
        const dims = this.world.enemies[ev.i]?.kind === 'squirrel' ? SQUIRREL_CONFIG : KERNEL_CREEP_CONFIG;
        this.spawnDust(ev.x + dims.width / 2, ev.y + dims.height, 1);
        this.spawnSparkles(ev.x + dims.width / 2, ev.y + dims.height / 2, COLLECT_PATTERN); // contact spark
        break;
      }
      case 'collect':
        this.spawnSparkles(ev.x + GOOD_COB_CONFIG.width / 2, ev.y + GOOD_COB_CONFIG.height / 2, COLLECT_PATTERN);
        this.pulse(this.cobIcon ?? this.hud); // cob-counter pop (icon on a field, the text otherwise)
        break;
      case 'box-break':
        this.shake(...SHAKE_BOX);
        this.spawnDust(ev.x + WHEAT_BOX_CONFIG.width / 2, ev.y + WHEAT_BOX_CONFIG.height, 2);
        break;
      case 'boss-hit': {
        this.shake(...SHAKE_BOSS_HIT);
        this.popBossPip(ev.member);
        // Contact spark on the boss body (the hit-stop freezes on it).
        const hitBoss = ev.member < 0 ? this.world.boss : this.world.teamBoss?.members[ev.member];
        const hitCfg = ev.member < 0 ? this.art.boss?.config : this.art.teamBoss?.members[ev.member]?.config;
        if (hitBoss && hitCfg) this.spawnSparkles(hitBoss.x + hitCfg.width / 2, hitBoss.y + hitCfg.height / 3, RING_PATTERN);
        break;
      }
      case 'checkpoint': {
        // The scarecrow armed: a sparkle ring on its marker (it used to arm silently).
        const cp = this.level.checkpoints[ev.i];
        if (cp) this.spawnSparkles(cp.respawn.x + this.cfg.player.width / 2, cp.y + cp.h - 70, RING_PATTERN);
        break;
      }
      case 'shield-block':
        // The leaf soaked a hit: a ring at the kid instead of a silent knockback.
        this.spawnSparkles(ev.x + this.cfg.player.width / 2, ev.y + this.cfg.player.height / 2, RING_PATTERN);
        this.pulse(this.powerPortrait);
        break;
      case 'respawn': {
        // Back at the checkpoint: snap the camera there behind a poof, instead of an ~850 px whip-pan.
        const cam = this.cameras.main;
        cam.centerOn(ev.x + this.cfg.player.width / 2, ev.y + this.cfg.player.height / 2);
        this.camLookahead = 0;
        this.spawnDust(ev.x + this.cfg.player.width / 2, ev.y + this.cfg.player.height, 5, 1.5, 1.5);
        break;
      }
      case 'slam-land':
        this.shake(...SHAKE_SLAM); // the slam should FEEL heavy
        break;
      case 'hop-land': {
        const bc = ev.member < 0 ? this.art.boss?.config : this.art.teamBoss?.members[ev.member]?.config;
        if (bc) this.spawnDust(ev.x + bc.width / 2, ev.y + bc.height, 5, bc.width / 24, 2);
        this.shake(...SHAKE_HOP);
        break;
      }
      case 'rage-start':
        this.shake(...SHAKE_RAGE); // the tantrum lands as a beat (layered over the boss-hit shake/roar)
        break;
      case 'ally-freed':
        this.spawnSparkles(ev.x + ALLY_CONFIG.width / 2, ev.y + ALLY_CONFIG.height / 2, RING_PATTERN);
        break;
      case 'power-up':
        this.spawnSparkles(ev.x + this.cfg.player.width / 2, ev.y + this.cfg.player.height / 2, RING_PATTERN);
        break;
    }
  }

  // A free (invisible) sprite from a pool, or a fresh one grown onto the pool. One key per pool, so the
  // pool only ever holds that texture. Any in-flight fade is killed before reuse.
  private pooledSprite(pool: Phaser.GameObjects.Sprite[], key: string): Phaser.GameObjects.Sprite {
    let s = pool.find((q) => !q.visible);
    if (!s) {
      s = this.add.sprite(0, 0, key).setOrigin(0.5, 0.5).setDepth(DEPTH.fx);
      pool.push(s);
    }
    this.tweens.killTweensOf(s);
    return s;
  }

  private spawnDust(cx: number, cy: number, count: number, spread = 1, scale = 1): void {
    const offs = [0, -12, 12, -6, 6];
    for (let k = 0; k < count; k++) {
      const s = this.pooledSprite(this.dustPool, 'dust-puff');
      s.setPosition(cx + offs[k % offs.length]! * spread, cy).setScale(0.22 * scale).setAlpha(0.95).setVisible(true);
      this.tweens.add({ targets: s, scaleX: 0.44 * scale, scaleY: 0.44 * scale, alpha: 0, duration: 240, onComplete: () => s.setVisible(false) });
    }
  }

  // A sparkle burst at a point in a FIXED pattern of [dx,dy] offsets (collect triangle / rescue ring).
  private spawnSparkles(cx: number, cy: number, pattern: readonly (readonly [number, number])[]): void {
    for (const [dx, dy] of pattern) {
      const s = this.pooledSprite(this.sparklePool, 'sparkle');
      s.setPosition(cx + dx, cy + dy).setScale(0.3).setAlpha(1).setVisible(true);
      this.tweens.add({ targets: s, scaleX: 0.12, scaleY: 0.12, alpha: 0, duration: 250, onComplete: () => s.setVisible(false) });
    }
  }

  // A quick scale-pop on a HUD object (cob icon / counter / hp pip). Kills any prior pop so rapid hits
  // don't stack. Pops relative to the object's authored base scale ('baseScale' data, default 1) so a
  // fit-scaled sprite (the cob icon) isn't blown up to native size — base is stored at creation because
  // a mid-tween restart leaves the live scale anywhere in [base, base*big].
  private pulse(obj: Phaser.GameObjects.Text | Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite | undefined, big = 1.35): void {
    if (!obj) return;
    const base = (obj.getData('baseScale') as number | undefined) ?? 1;
    this.tweens.killTweensOf(obj);
    obj.setScale(base);
    this.tweens.add({ targets: obj, scaleX: base * big, scaleY: base * big, duration: 90, yoyo: true, onComplete: () => obj.setScale(base) });
  }

  // Arm a deterministic screen shake (item 1). The stronger/longer shake wins if one is already running;
  // decays over its duration. No Math.random — the offset is frame-derived in applyCameraFx (the One Rule
  // for presentation FX). [frames, amplitude px].
  private shake(frames: number, mag: number): void {
    this.shakeFrames = Math.max(this.shakeFrames, frames);
    this.shakeDur = this.shakeFrames;
    this.shakeMag = Math.max(this.shakeMag, mag);
  }

  private bossCameraAnchorX(): number | undefined {
    if (this.world.boss && this.art.boss && this.world.boss.hp > 0) {
      return this.world.boss.x + this.art.boss.config.width / 2;
    }
    if (this.world.teamBoss && this.art.teamBoss) {
      let sum = 0;
      let n = 0;
      const team = this.world.teamBoss;
      for (let i = 0; i < team.members.length; i++) {
        const m = team.members[i]!;
        if (m.hp > 0 && (!team.royale || inRoyaleRing(team, i))) { // the Boss Royale bench is off stage
          sum += m.x + this.art.teamBoss.members[i]!.config.width / 2;
          n++;
        }
      }
      if (n > 0) return sum / n;
    }
    return undefined;
  }

  private applyCameraFx(facing: number, frame: number, biasTarget?: number): void {
    const target = biasTarget !== undefined ? biasTarget : -facing * CAM_LOOKAHEAD;
    const ease = biasTarget !== undefined ? CAM_BOSS_EASE : CAM_EASE;
    this.camLookahead += Phaser.Math.Clamp(target - this.camLookahead, -ease, ease);
    const shake = stepCameraShake(
      { frames: this.shakeFrames, duration: this.shakeDur, magnitude: this.shakeMag },
      frame,
      document.documentElement.dataset.reducedMotion === 'true',
    );
    this.shakeFrames = shake.state.frames;
    this.shakeDur = shake.state.duration;
    this.shakeMag = shake.state.magnitude;
    this.cameras.main.followOffset.set(this.camLookahead + shake.x, shake.y);
  }

  // Pop the top remaining hp pip when a boss takes a hit (member -1 = single boss). The just-lost pip is
  // already hidden by the render, so pop the highest still-lit one — reads as "one closer to done".
  private popBossPip(member: number): void {
    if (member < 0) {
      const b = this.world.boss;
      if (b && b.hp > 0) this.pulse(this.hpPips[b.hp - 1], 1.6);
    } else {
      const m = this.world.teamBoss?.members[member];
      const pips = this.teamPips[member];
      if (m && pips && m.hp > 0) this.pulse(pips[m.hp - 1], 1.6);
    }
  }

  private readInput(t = touch.get(), g = this.readGamepad()): InputFrame {
    const k = this.keys;
    // OR the on-screen touch controls (iPad/mobile) into the same InputFrame the keyboard feeds. The
    // held state is a retained store the DOM chrome writes; reading it here is a cheap synchronous get.
    // On desktop it's always all-false (the controls never mount), so keyboard behaviour is identical.
    const down = (key: string): boolean => !!k?.[key]?.isDown;
    return {
      left: down('ACTION_moveLeft') || down('LEFT') || down('A') || t.left || g.left,
      right: down('ACTION_moveRight') || down('RIGHT') || down('D') || t.right || g.right,
      jump: down('ACTION_jump') || down('UP') || down('W') || down('SPACE') || t.jump || g.jump,
      attack: down('ACTION_attack') || down('J') || down('K') || t.attack || g.attack,
      power: down('ACTION_power') || down('SHIFT') || down('L') || t.power || g.power,
      ability: down('ACTION_ability') || t.ability === true || g.ability,
      switchCharacter: down('ACTION_switchCharacter') || g.switchCharacter || this.pendingCharacterSwitch,
      ...(this.pendingPowerSelect ? { selectPower: this.pendingPowerSelect } : {}),
    };
  }

  private readGamepad(): DeviceActions {
    try {
      const pad = typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function'
        ? null
        : [...navigator.getGamepads()].find((candidate): candidate is Gamepad => candidate !== null);
      return gamepadActions(pad);
    } catch {
      return gamepadActions(null);
    }
  }

  private refreshTutorialCue(): void {
    const tutorialCue = nextTutorialCue(
      this.tutorialProgress,
      this.tutorialDevice,
      this.session.activePower !== 'none',
    );
    const current = snapshot.get().tutorialCue;
    if (current?.action === tutorialCue?.action && current?.text === tutorialCue?.text) return;
    const nextSnapshot = { ...snapshot.get() };
    if (tutorialCue) nextSnapshot.tutorialCue = tutorialCue;
    else delete nextSnapshot.tutorialCue;
    snapshot.set(nextSnapshot);
  }

  private learnTutorial(action: TutorialAction): void {
    const next = learnTutorialAction(this.tutorialProgress, action);
    if (next === this.tutorialProgress) return;
    this.tutorialProgress = next;
    saveTutorialProgress(next);
    this.refreshTutorialCue();
  }

  private observeTutorialInput(input: InputFrame, t = touch.get(), g = this.readGamepad()): void {
    const touchActive = t.left || t.right || t.jump || t.attack || t.power;
    const gamepadActive = g.left || g.right || g.jump || g.attack || g.power;
    const nextDevice: TutorialDevice = touchActive ? 'touch' : gamepadActive ? 'gamepad' : 'keyboard';
    if ((touchActive || gamepadActive || input.left || input.right || input.jump || input.attack || input.power)
      && nextDevice !== this.tutorialDevice) {
      this.tutorialDevice = nextDevice;
      this.refreshTutorialCue();
    }
    if (input.left || input.right) this.learnTutorial('move');
    if (input.jump) this.learnTutorial('jump');
    if (input.attack) this.learnTutorial('attack');
    if (input.power && this.session.activePower !== 'none') this.learnTutorial('power');
  }

  // The menu reflects the choice at once; the sim equips it from the next frame's recorded input, so
  // the swap (and the charges it carries) is part of replay state.
  private equipCrewPower(power: CrewPower): void {
    try {
      this.session = selectCrewPower(this.session, power);
    } catch {
      return;
    }
    this.pendingPowerSelect = power;
    if (this.savesCampaign) saveCampaign(this.session);
    this.publishCampaign();
  }

  // Live swap keys work only at a swap point (stage start or an armed checkpoint); the pause menu
  // covers everywhere else.
  private cycleCrewPower(direction: -1 | 1): void {
    const next = cycleCrewPower(this.session, direction);
    if (next.activePower === 'none' || next.activePower === this.session.activePower) return;
    if (!atCrewSwapPoint(this.world, this.level, this.cfg.player)) {
      if (document.documentElement.dataset.visualCues !== 'false') {
        snapshot.set({ ...snapshot.get(), visualCue: { id: this.world.frame, text: STRINGS.crewSwapWhere } });
      }
      return;
    }
    this.equipCrewPower(next.activePower);
  }

  private syncCampaign(previous: WorldState): void {
    let session = this.session;
    let changed = false;
    if (session.characterId !== this.characterId) {
      session = { ...session, characterId: this.characterId };
      changed = true;
    }
    for (let index = 0; index < this.world.allies.length; index++) {
      const before = previous.allies[index];
      const after = this.world.allies[index];
      if (before && after && !before.freed && after.freed && isCrewFriend(after.name)) {
        session = rescueFriend(session, after.name);
        changed = true;
      }
    }

    const active = session.activePower;
    if (active !== 'none' && this.world.player.power === active) {
      const charges = this.world.player.powerCharges;
      if (session.crewResources[active] !== charges) {
        session = updateCrewResource(session, active, charges);
        changed = true;
      }
    }
    // Stored friends' charges change on a swap, a rescue, or a checkpoint regrow.
    const stored = this.world.crewCharges ?? {};
    for (const power of Object.keys(stored) as CrewPower[]) {
      if (power === active || !(power in CREW_MAX_CHARGES)) continue;
      if (session.crewResources[power] !== stored[power]) {
        session = updateCrewResource(session, power, stored[power]!);
        changed = true;
      }
    }
    if (session.lives !== this.world.lives) {
      session = { ...session, lives: this.world.lives };
      changed = true;
    }
    if (changed) {
      this.session = session;
      if (this.savesCampaign) saveCampaign(session);
      this.publishCampaign();
    }
  }

  // Only a real campaign run writes the save: never a replay, never Boss Royale.
  private get savesCampaign(): boolean {
    return !this.replayMode && !this.royale;
  }

  private publishCampaign(extra: { paused?: boolean; gameOver?: boolean; completed?: boolean; creditsRoll?: number; scoreAward?: import('@/ui/chrome/bus').ScoreAwardState; royaleAward?: RoyaleAward } = {}): void {
    const {
      tutorialCue: _previousTutorialCue,
      scoreAward: _previousScoreAward,
      invisibility: _previousInvisibility,
      switchCharacterId: _previousSwitchCharacterId,
      royale: _previousRoyale,
      royaleAward: _previousRoyaleAward,
      ...previousSnapshot
    } = snapshot.get();
    const tutorialCue = nextTutorialCue(
      this.tutorialProgress,
      this.tutorialDevice,
      this.session.activePower !== 'none',
    );
    snapshot.set({
      ...previousSnapshot,
      view: 'level',
      canContinue: true,
      campaign: toCampaignChromeState(this.session),
      ...(this.canSwitchCharacters ? { switchCharacterId: this.characterId } : {}),
      ...(this.royale ? { royale: { attempt: this.royale.attempt } } : {}),
      ...(this.cfg.player.canTurnInvisible ? { invisibility: {
        remaining: this.world.player.invisibility?.remaining ?? 0,
        recharge: this.world.player.invisibility?.recharge ?? 0,
      } } : {}),
      ...(tutorialCue ? { tutorialCue } : {}),
      ...extra,
    });
  }

  private restartStage(freshLives: boolean): void {
    if (this.royale) {
      // One More Try resumes the ring from the last pop; a restart is a fresh run (new Shuffle seed).
      const run = freshLives && this.royaleRetry
        ? this.royaleRetry
        : startRoyaleRun({ characterId: this.royale.characterId, spices: this.royale.spices, seed: freshRoyaleSeed() });
      this.scene.restart({ royale: run, introSeen: true });
      return;
    }
    const lives = freshLives ? INITIAL_LIVES : Math.max(1, this.session.lives);
    this.session = { ...this.session, lives, stageId: this.level.id };
    if (this.savesCampaign) saveCampaign(this.session);
    this.scene.restart({ level: this.level, session: this.session, replay: this.replayMode, introSeen: true });
  }

  private quitToTitle(): void {
    this.audio.stopMusic();
    // A royale or replay session is a copy that never saves: the title gets the real saved campaign
    // (or none) back, so the World Map keeps the true current stage after a replay.
    if (this.royale || this.replayMode) publishSavedTitle(loadCampaign(), false);
    else publishCampaignTitle(this.session, false);
    this.scene.start(SCENE.title);
  }

  // The chosen hero's pose from live state (attack > airborne > running > idle). The sheet prefix
  // follows the active kid after each switch; every kid shares this pose machine.
  private playerFrame(): string {
    const p = this.world.player;
    const k = this.playerPrefix;
    // Hurt pose (item 5): highest priority, held by a scene-local timer armed on the health-drop edge
    // (applyFx 'hurt'). NOT inferred from invuln — the 60f respawn window overlaps the hurt window and
    // would re-show the reel mid-respawn; the timer from the hit edge is unambiguous.
    if (this.hurtPoseTimer > 0) return `${k}-hurt`;
    if (p.attackTimer > 0) return `${k}-swing`;
    if (!p.onGround) return p.vy < 0 ? `${k}-jump` : `${k}-fall`;
    if (p.vx !== 0) return Math.floor(this.world.frame / PLAYER_RUN_PERIOD) % 2 === 0 ? `${k}-run` : `${k}-run-b`;
    return `${k}-idle`;
  }

  override update(): void {
    if (!this.world) return;
    // The popcorn-volcano finale (presentation only): once armed on the terminal stage, animate the
    // eruption off a scene-local frame counter while the sim stays frozen. Above the freeze gate (and
    // the pause check) — this is the end-of-game celebration, and there is no failure state left.
    if (this.finaleActive) { this.tickFinale(); return; }
    // Frozen states: once the stage is cleared (celebrating the banner before the next stage) or the
    // run is over (game-over card up), stop stepping the sim. Otherwise a stray projectile/hazard hit
    // during the 1.2s celebration could drain a life — or even end the run — and the wrong life count
    // would carry to the next stage. The banner/overlay are already drawn; nothing left to simulate.
    if (this.transitioning || this.gameOverShown) {
      this.clearGhostTrail(); // no half-faded ghosts frozen over the banner or game-over card
      // While the score card waits, a fresh jump or swing press moves on (a press held from play
      // must be released first, so the card is never skipped by accident).
      if (this.advanceStage) {
        const pad = this.readInput();
        const held = pad.jump || pad.attack;
        if (held && !this.nextPressHeld) this.requestNextStage();
        this.nextPressHeld = held;
      }
      return;
    }
    // Break toggle — checked BEFORE the freeze gate so ESC/P both pause AND resume. The chrome
    // button routes through the same setPaused (via the pause/resume intents).
    const k = this.keys;
    if (k && (Phaser.Input.Keyboard.JustDown(k.ESC!) || Phaser.Input.Keyboard.JustDown(k.P!))) {
      this.setPaused(!this.paused);
    }
    const device = this.readGamepad();
    if (device.pause && !this.gamepadPauseHeld) this.setPaused(!this.paused);
    this.gamepadPauseHeld = device.pause;
    const justDown = (key: Phaser.Input.Keyboard.Key | undefined): boolean => !!key && Phaser.Input.Keyboard.JustDown(key);
    const switchLeft = justDown(k?.ACTION_switchLeft) || justDown(k?.Q);
    const switchRight = justDown(k?.ACTION_switchRight) || justDown(k?.E);
    if (!this.paused && (switchLeft || (device.switchLeft && !this.gamepadSwitchLeftHeld))) this.cycleCrewPower(-1);
    if (!this.paused && (switchRight || (device.switchRight && !this.gamepadSwitchRightHeld))) this.cycleCrewPower(1);
    this.gamepadSwitchLeftHeld = device.switchLeft;
    this.gamepadSwitchRightHeld = device.switchRight;
    if (this.paused) return;
    // Hit-stop: a kill or boss hit freezes the picture for a few frames by skipping the sim step, the
    // same way a pause does (frozen frames are never sim frames). Presses made during the freeze are
    // latched and handed to the next sim frame so a quick tap is never swallowed.
    if (this.hitStop > 0) {
      this.hitStop--;
      this.latchedPresses = latchPresses(this.latchedPresses, this.readInput(touch.get(), device));
      return;
    }
    // The One Rule: one fixed step per frame, untouched. Everything below is presentation.
    const previous = this.world;
    const touchInput = touch.get();
    const input = mergeLatched(this.readInput(touchInput, device), this.latchedPresses);
    this.latchedPresses = undefined;
    this.pendingCharacterSwitch = false;
    this.pendingPowerSelect = undefined;
    this.world = stepWorld(this.world, input, this.level, this.cfg);
    if (this.world.characterId && this.world.characterId !== this.characterId) {
      this.characterId = this.world.characterId;
      this.cfg = configsForCharacter(this.characterId, this.cfg);
      this.playerPrefix = playerArtPrefix(this.characterId);
      if (this.royale) this.royale = noteRoyaleKid(this.royale, this.characterId); // kids used, for the boards
    }
    const invisibility = this.world.player.invisibility;
    const shownInvisibility = snapshot.get().invisibility;
    if (this.cfg.player.canTurnInvisible && invisibility && (
      Math.ceil(invisibility.remaining / 60) !== Math.ceil((shownInvisibility?.remaining ?? 0) / 60) ||
      Math.ceil(invisibility.recharge / 60) !== Math.ceil((shownInvisibility?.recharge ?? 0) / 60)
    )) {
      snapshot.set({ ...snapshot.get(), invisibility: { remaining: invisibility.remaining, recharge: invisibility.recharge } });
    }
    this.observeTutorialInput(input, touchInput, device);
    this.syncCampaign(previous);
    // SFX + presentation FX: both derive from this frame's state delta via pure mappers that read the
    // sim and never write back, so the One Rule holds. Audio plays the cues; applyFx runs screen shake,
    // dust, sparkles, and the short latches the render loops read.
    // The single boss's config feeds the mappers the RAGE-phase read (presentation-only); undefined in
    // a field/team arena, which the mappers tolerate (rage is a single-boss, King-only beat).
    const bossCfg = this.art.boss?.config;
    const cues = sfxForTransition(this.prevWorld, this.world, bossCfg, this.teamCfgs);
    for (const cue of cues) this.audio.playSfx(cue);
    // Boss teaching tells: when the boss opens up, and when a swing bounced off its guard. Read with
    // the player's effective (power-adjusted) config, the same one the stepper's combat used.
    const bossTells = bossTellsForTransition(
      this.prevWorld,
      this.world,
      powerConfig(this.cfg.player, previous.player.power),
      bossCfg,
      this.teamCfgs,
    );
    if (document.documentElement.dataset.visualCues !== 'false') {
      const visual = [...cues].reverse().find((candidate) => VISUAL_CUE[candidate]);
      const entrants = royaleEntrants(this.prevWorld, this.world);
      if (lostTryToPit(this.prevWorld, this.world, this.level.height)) {
        // A try lost to a gap teaches the held jump instead of a bare "Ouch!".
        snapshot.set({ ...snapshot.get(), visualCue: { id: this.world.frame, text: STRINGS.pitHint } });
      } else if (entrants.length > 0) {
        // A Boss Royale group drops in: name it (its entry roar has no banner of its own).
        const text = royaleEntryCue(royaleNames(entrants.map((i) => ROYALE_MEMBERS[i]!)));
        snapshot.set({ ...snapshot.get(), visualCue: { id: this.world.frame, text } });
      } else if (visual) {
        let text = VISUAL_CUE[visual]!;
        if (visual === 'throw') text = throwCueText(this.world);
        if (visual === 'free-ally') {
          const rescued = this.world.allies.find((ally, index) => ally.freed && !previous.allies[index]?.freed);
          if (rescued && isCrewFriend(rescued.name)) text = rescuePowerCue(rescued.name);
        }
        snapshot.set({ ...snapshot.get(), visualCue: { id: this.world.frame, text } });
      } else if (bossTells[0]) {
        // A sound-cue banner owns its frame (a slam lands on the frame it opens); tells fill the rest.
        const text = bossTells[0].type === 'open' ? STRINGS.bossOpen : STRINGS.bossBlocked;
        snapshot.set({ ...snapshot.get(), visualCue: { id: this.world.frame, text } });
      }
    }
    // A barn door touched with a friend still caged says why it stays shut (UX review #7).
    if (lockedDoorTouched(previous, this.world, this.level, this.cfg.player)) {
      snapshot.set({ ...snapshot.get(), visualCue: { id: this.world.frame, text: lockedDoorText(this.world.allies) } });
    }
    // "Hit it now" must not outlive the opening: drop it the frame the boss stops recovering.
    if (snapshot.get().visualCue?.text === STRINGS.bossOpen && !anyBossRecovering(this.world)) {
      const cleared = { ...snapshot.get() };
      delete cleared.visualCue;
      snapshot.set(cleared);
    }
    const blocked = bossTells.find((t): t is Extract<BossTell, { type: 'blocked' }> => t.type === 'blocked');
    if (blocked) this.spawnSparkles(blocked.x, blocked.y, COLLECT_PATTERN); // the guard's "clink"
    if (cues.includes('jump')) this.stretchTimer = JUICE_FRAMES; // stretch on the jump cue (no FX-event twin)
    const fxEvents = fxForTransition(this.prevWorld, this.world, bossCfg, this.teamCfgs);
    for (const ev of fxEvents) this.applyFx(ev);
    this.hitStop = hitStopFor(fxEvents);
    // A crew-power press reads from this step's input and the state it was applied to.
    const powerUse = powerUseFx(previous, input, this.world);
    if (powerUse) this.applyFx(powerUse);
    const rb = this.world.boss;
    const kingRaging = (!!rb && rb.hp > 0 && !!bossCfg && activePhase(rb, bossCfg).rage === true) ||
      (this.world.teamBoss?.members.some((_, i) => this.memberRaging(i)) ?? false);
    const rageBed = this.art.rageTheme !== undefined && kingRaging;
    if (rageBed !== this.rageBedOn) {
      this.rageBedOn = rageBed;
      this.audio.playMusic(rageBed ? this.art.rageTheme! : this.art.theme, {
        preservePhase: true,
        fadeMs: 450,
      });
    }
    // Boss Royale pop clocks: a pop this frame restarts its member's linger/fade (presentation only).
    const poppedBefore = previous.teamBoss?.members;
    for (let i = 0; i < this.royalePopAge.length; i++) {
      const popped = (poppedBefore?.[i]?.hp ?? 0) > 0 && (this.world.teamBoss?.members[i]?.hp ?? 0) <= 0;
      this.royalePopAge[i] = popped ? 0 : this.royalePopAge[i]! + 1;
    }
    this.prevWorld = this.world;
    const frame = this.world.frame;

    // Parallax: slide each layer a fraction of the camera scroll.
    const sx = this.cameras.main.scrollX;
    this.bgFar.tilePositionX = sx * 0.2;
    this.bgMid.tilePositionX = sx * 0.5;
    this.bgNear.tilePositionX = sx * 0.85;

    for (let i = 0; i < this.movingPlatformSprites.length; i++) {
      const platform = movingPlatformAt(this.level.movingPlatforms![i]!, frame);
      this.movingPlatformSprites[i]!
        .setPosition(platform.x + platform.w / 2, platform.y + platform.h)
        .setDisplaySize(platform.w, 100);
    }
    const activeTargets = new Set(this.world.mechanisms.activeSwitchIds);
    for (let i = 0; i < this.switchSprites.length; i++) {
      const target = this.level.switches![i]!;
      const active = activeTargets.has(target.id);
      this.switchSprites[i]!.setAlpha(active ? 0.62 : 1).setRotation(active && target.accepts === 'swing' ? -0.16 : 0);
    }
    for (let i = 0; i < this.gateSprites.length; i++) {
      this.gateSprites[i]!.setVisible(!activeTargets.has(this.level.gates![i]!.switchId));
    }
    for (let i = 0; i < this.bouncePadSprites.length; i++) {
      const pad = this.level.bouncePads![i]!;
      const launched = previous.player.vy >= 0 && this.world.player.vy <= -pad.launchV &&
        this.world.player.x < pad.x + pad.w && this.world.player.x + this.cfg.player.width > pad.x;
      this.bouncePadSprites[i]!.setDisplaySize(pad.w, launched ? 52 : 64);
    }
    for (let i = 0; i < this.slickBoardSprites.length; i++) {
      this.slickBoardSprites[i]!.setAlpha(frame % 36 < 8 ? 1 : 0.82);
    }
    const reduceWeatherMotion = document.documentElement.dataset.reducedMotion === 'true';
    for (let i = 0; i < this.rainStreaks.length; i++) {
      const y = reduceWeatherMotion ? (i * 83) % this.scale.height : (i * 83 + frame * 14) % (this.scale.height + 30) - 15;
      const x = (i * 149 - (reduceWeatherMotion ? 0 : frame * 3)) % (this.scale.width + 40);
      this.rainStreaks[i]!.setPosition(x < -20 ? x + this.scale.width + 40 : x, y);
    }

    const p = this.world.player;
    const anchorX = this.bossCameraAnchorX();
    let biasTarget: number | undefined;
    if (anchorX !== undefined) {
      const playerC = p.x + this.cfg.player.width / 2;
      biasTarget = Phaser.Math.Clamp((playerC - anchorX) / 2, -CAM_BOSS_BIAS_MAX, CAM_BOSS_BIAS_MAX);
    }
    this.applyCameraFx(p.facing, frame, biasTarget);

    // Player: one display scale per kid from the idle frame (UX review #12), so crouched jump and
    // swing art no longer balloons the kid between poses. Feet stay planted (origin 0.5,1).
    this.skin(this.playerSprite, this.playerFrame(), this.playerBox(), 1.3);
    const idleKey = `${this.playerPrefix}-idle`;
    if (this.textures.exists(idleKey)) {
      this.playerSprite.setScale(kidDisplayScale(this.textures.get(idleKey).getSourceImage().height, this.cfg.player.height, 1.3));
    }
    this.playerSprite.setFlipX(p.facing === -1);
    // Squash & stretch juice (item 1): multiply the skinned scale by a short latch. skin() stays
    // untouched so every other caller is unaffected; the multiply is applied only here on the player.
    if (this.stretchTimer > 0) { this.playerSprite.scaleX *= 0.92; this.playerSprite.scaleY *= 1.08; this.stretchTimer--; }
    else if (this.squashTimer > 0) { this.playerSprite.scaleX *= 1.08; this.playerSprite.scaleY *= 0.9; this.squashTimer--; }
    // Run-cycle bob + lean, driven purely off the world frame. The authored long-stride/contact pair
    // carries the motion; this one-pixel settle keeps the planted frame from floating at speed.
    if (p.onGround && p.vx !== 0) {
      const bob = Math.floor(frame / PLAYER_RUN_PERIOD) % 2;
      this.playerSprite.y -= bob;
      this.playerSprite.setRotation((bob ? 1 : -1) * (Math.PI / 180));
    } else {
      this.playerSprite.setRotation(0);
    }
    // Hit flash: a brief white fill-tint latch after a hit (frame-counted, not a tween). Composes with
    // the invuln alpha blink below. hurtPoseTimer (item 5) is ticked AFTER playerFrame() read it above.
    if (this.hurtTint > 0 && hurtFlashFill(this.reducedMotion)) this.playerSprite.setTintFill(this.hurtTintColor);
    else this.playerSprite.clearTint();
    if (this.hurtTint > 0) this.hurtTint--;
    if (this.hurtPoseTimer > 0) this.hurtPoseTimer--;

    // Active crew readout: selected friend power and player-controlled resource. No rescue countdown.
    if (p.power === 'none') {
      this.powerChip.setVisible(false);
      this.powerPill.setVisible(false);
      this.powerPortrait.setVisible(false);
    } else {
      this.powerChip.setText(formatPowerHud(p.power, p.powerCharges, p.powerTimer)).setVisible(true);
      const friend = powerFriend(p.power);
      const portraitId = friend ? `ally-${friend}-freed` : undefined;
      if (portraitId && this.textures.exists(portraitId)) {
        this.powerPortrait.setTexture(portraitId);
        const source = this.textures.get(portraitId).getSourceImage();
        this.powerPortrait.setScale(36 / (source.height || 36)).setVisible(true);
      } else {
        this.powerPortrait.setVisible(false);
      }
      // Redraw the rounded accent pill to fit the chip (item 6). Cheap; the label is short + stable.
      const px = 60 + this.hudLeft;
      const py = this.chipY;
      const padX = 9;
      const padY = 4;
      this.powerPill.clear();
      this.powerPill.fillStyle(this.chipFillInt, this.chipFillAlpha);
      this.powerPill.lineStyle(2, this.accentInt, 0.9);
      const pillX = 11 + this.hudLeft;
      const pillWidth = this.powerChip.width + padX * 2 + px - pillX;
      this.powerPill.fillRoundedRect(pillX, py - padY, pillWidth, this.powerChip.height + padY * 2, 9);
      this.powerPill.strokeRoundedRect(pillX, py - padY, pillWidth, this.powerChip.height + padY * 2, 9);
      this.powerPill.setVisible(true);
    }

    // Survival readout: remaining lives + the current health bar (a lost pip dims, not vanishes).
    // The hero blinks while invulnerable (mercy frames after a hit) — a clear "I just took one" tell.
    this.livesText.setText(`${STRINGS.lives} x${this.world.lives}`);
    for (let i = 0; i < this.healthPips.length; i++) this.healthPips[i]!.setAlpha(i < p.health ? 1 : 0.18);
    // Pulse the pip(s) that just lit on a heal (item 6). A drained pip already has the hit flash + shake.
    if (p.health > this.prevHealth) for (let i = this.prevHealth; i < p.health; i++) this.pulse(this.healthPips[i]);
    this.prevHealth = p.health;
    if ((p.invisibility?.remaining ?? 0) > 0) this.playerSprite.setAlpha(0.35);
    else this.playerSprite.setAlpha(invulnAlpha(p.invuln, this.reducedMotion));
    this.tickGhostTrail();

    // Enemies: dispatch the pose by kind. Kernel: squished/turn/walk. Squirrel: its own squished KO,
    // a throw pose on the release frame, a wind-up telegraph just before, else walk.
    for (let i = 0; i < this.enemySprites.length; i++) {
      const e = this.world.enemies[i]!;
      const sprite = this.enemySprites[i]!;
      if (e.dir !== this.enemyPrevDir[i]) this.enemyTurnTimer[i] = KERNEL_TURN_FRAMES;
      this.enemyPrevDir[i] = e.dir;
      const turn = this.enemyTurnTimer[i]! > 0;
      if (turn) this.enemyTurnTimer[i]!--;

      let id: string;
      const dims = e.kind === 'squirrel' ? SQUIRREL_CONFIG : KERNEL_CREEP_CONFIG;
      if (e.kind === 'squirrel') {
        if (!e.alive) id = 'squirrel-squished';
        else if (e.throwTimer === SQUIRREL_CONFIG.throwInterval) id = 'squirrel-throw'; // just released
        else if (e.throwTimer <= SQUIRREL_WINDUP_FRAMES) id = 'squirrel-windup'; // about to throw
        else id = Math.floor(frame / KERNEL_PERIOD) % 2 === 0 ? 'squirrel-walk-a' : 'squirrel-walk-b';
      } else {
        if (!e.alive) id = 'kernel-creep-squished';
        else if (turn) id = 'kernel-creep-turn';
        else id = Math.floor(frame / KERNEL_PERIOD) % 2 === 0 ? 'kernel-creep-walk-a' : 'kernel-creep-walk-b';
      }

      // A felled critter is dizzy for a beat, poofs, then is gone (UX review #14: never a lingering
      // flattened body). An enemy already down when the stage drew (none today) is simply hidden.
      if (!e.alive) {
        const koAt = this.enemyKoFrame[i];
        const phase = koAt === undefined ? 'gone' : koPhase(frame - koAt);
        if (phase === 'poof') this.spawnDust(e.x + dims.width / 2, e.y + dims.height, 4, 1.2, 1.3);
        if (phase !== 'dizzy') { sprite.setVisible(false); continue; }
      }
      sprite.setVisible(true);
      this.skin(sprite, id, this.box(e.x, e.y, dims.width, dims.height), 1.3);
      // KO squash pop (item 1): a felled enemy squishes flat for a few frames, then settles to the
      // flattened pose. The latch is armed by applyFx('squish'); compose it over the skinned scale.
      const squishing = this.enemySquish[i]! > 0;
      if (squishing) { sprite.scaleX *= 1.2; sprite.scaleY *= 0.5; this.enemySquish[i]!--; }
      // A dizzy wobble on the KO pose before the poof (still under reduced motion).
      sprite.setRotation(!e.alive && !squishing && !this.reducedMotion ? Math.sin(frame * 0.5) * 0.12 : 0);
      // Victim flash: a felled enemy flashes the regime glow for two frames (skipped under reduced motion).
      if (this.enemyFlash[i]! > 0) {
        if (!this.reducedMotion) sprite.setTintFill(this.hurtTintColor);
        this.enemyFlash[i]!--;
      } else {
        sprite.clearTint();
      }
      sprite.setFlipX(e.dir === -1);
    }

    // Spiked corn in flight: a dynamic pool of spinning sprites grown to match the live shots. Uses the
    // rimmed, recolored hazard frame (ensureHazardTextures) so a thrown cob never reads as a good one;
    // the scale and origin skip the frame's transparent padding so the body keeps its size and footing.
    const cornId = `spiked-corn-${(Math.floor(frame / COB_PERIOD) % 4) + 1}`;
    const hazardId = `${cornId}${HAZARD_SUFFIX}`;
    const rimmed = this.textures.exists(hazardId);
    const cornFrame = rimmed ? hazardId : cornId;
    const bodyH = rimmed ? this.textures.get(cornId).getSourceImage().height : 1;
    const rim = rimmed ? hazardRimFor(bodyH) : 0;
    const cornOverhang = rimmed ? CORN_OVERHANG * ((bodyH + rim * 2) / bodyH) : CORN_OVERHANG;
    const cornOriginY = rimmed ? (bodyH + rim) / (bodyH + rim * 2) : 1;
    for (let i = 0; i < this.world.projectiles.length; i++) {
      if (!this.projSprites[i]) this.projSprites[i] = this.add.sprite(0, 0, cornFrame).setOrigin(0.5, 1).setDepth(DEPTH.decor);
      const pr = this.world.projectiles[i]!;
      this.projSprites[i]!.setOrigin(0.5, cornOriginY);
      this.skin(this.projSprites[i]!, cornFrame, this.box(pr.x, pr.y, SPIKED_CORN_CONFIG.width, SPIKED_CORN_CONFIG.height), cornOverhang);
      this.projSprites[i]!.setVisible(true);
    }
    for (let i = this.world.projectiles.length; i < this.projSprites.length; i++) this.projSprites[i]!.setVisible(false);

    // Falling acorns: World 3's authored overhead cadence. Spin is frame-derived and the pool mirrors
    // the replay-owned live list, so there is no random particle emitter or hidden physics state.
    for (let i = 0; i < this.world.fallingNuts.length; i++) {
      if (!this.nutSprites[i]) this.nutSprites[i] = this.add.sprite(0, 0, 'falling-acorn').setOrigin(0.5, 1).setDepth(DEPTH.decor);
      const nut = this.world.fallingNuts[i]!;
      this.skin(this.nutSprites[i]!, 'falling-acorn', this.box(nut.x, nut.y, FALLING_NUT_CONFIG.width, FALLING_NUT_CONFIG.height), 1.18);
      this.nutSprites[i]!.setRotation((frame % 24) * (Math.PI / 12)).setVisible(true);
    }
    for (let i = this.world.fallingNuts.length; i < this.nutSprites.length; i++) this.nutSprites[i]!.setVisible(false);

    // Good cobs: spin while uncollected, vanish the instant they are banked.
    const cobFrame = `good-cob-${(Math.floor(frame / COB_PERIOD) % 4) + 1}`;
    for (let i = 0; i < this.cobSprites.length; i++) {
      const cob = this.world.collectibles[i]!;
      const sprite = this.cobSprites[i]!;
      if (cob.collected) sprite.setVisible(false);
      else this.skin(sprite, cobFrame, this.box(cob.x, cob.y, GOOD_COB_CONFIG.width, GOOD_COB_CONFIG.height), 1.5);
    }

    // Wheat boxes: idle with a periodic glint while intact; on the break frame, flash the burst for
    // BOX_BURST_FRAMES then hide. The break edge is read off the sim's `broken` flag (presentation).
    for (let i = 0; i < this.boxSprites.length; i++) {
      const bx = this.world.boxes[i]!;
      const sprite = this.boxSprites[i]!;
      if (bx.broken) {
        if (!this.boxBurstDone[i]) { this.boxBurstDone[i] = true; this.boxBurst[i] = BOX_BURST_FRAMES; }
        if (this.boxBurst[i]! > 0) {
          this.skin(sprite, 'wheat-box-burst', this.box(bx.x, bx.y, WHEAT_BOX_CONFIG.width, WHEAT_BOX_CONFIG.height), 1.2);
          this.boxBurst[i]!--;
        } else {
          sprite.setVisible(false);
        }
      } else {
        const id = Math.floor(frame / BOX_GLINT_PERIOD) % 6 === 0 ? 'wheat-box-glint' : 'wheat-box-idle';
        this.skin(sprite, id, this.box(bx.x, bx.y, WHEAT_BOX_CONFIG.width, WHEAT_BOX_CONFIG.height), 1.1);
      }
    }

    // Allies: caged until rescued, then the freed (happy-hop) pose at the same spot.
    for (let i = 0; i < this.allySprites.length; i++) {
      const a = this.world.allies[i]!;
      const id = `ally-${a.name}-${a.freed ? 'freed' : 'caged'}`;
      this.skin(this.allySprites[i]!, id, this.box(a.x, a.y, ALLY_CONFIG.width, ALLY_CONFIG.height), 1.2);
    }

    // Pickups: a pep-pie / 1-up token, hidden the instant it is banked (a taken pickup is terminal).
    for (let i = 0; i < this.pickupSprites.length; i++) this.pickupSprites[i]!.setVisible(!this.world.pickups[i]!.taken);

    // Peels (banana slip attack): a dynamic list — grow the sprite pool to match, place the live ones,
    // hide the rest.
    for (let i = 0; i < this.world.peels.length; i++) {
      if (!this.peelSprites[i]) this.peelSprites[i] = this.add.sprite(0, 0, 'banana-peel').setOrigin(0.5, 1).setDepth(DEPTH.decor);
      const pr = this.world.peels[i]!;
      this.skin(this.peelSprites[i]!, 'banana-peel', this.box(pr.x, pr.y, PEEL_CONFIG.width, PEEL_CONFIG.height), 1.2);
      this.peelSprites[i]!.setVisible(true);
    }
    for (let i = this.world.peels.length; i < this.peelSprites.length; i++) this.peelSprites[i]!.setVisible(false);

    // Threshers: spin in place (placement-only, no world state).
    const threshFrame = `thresher-${(Math.floor(frame / THRESHER_PERIOD) % 4) + 1}`;
    for (let i = 0; i < this.hazardSprites.length; i++) {
      const h = this.level.hazards[i]!;
      this.skin(this.hazardSprites[i]!, threshFrame, this.box(h.x, h.y, THRESHER_CONFIG.width, THRESHER_CONFIG.height), 1.2);
    }

    if (this.bossSprite && this.world.boss && this.art.boss) {
      const b = this.world.boss;
      const bc = this.art.boss.config;
      // RAGE (King's last pip): halve the idle↔move cadence so he pumps twice as fast (a doubled pose
      // clock), and drive the sustained aura/tremble below. Cleared on the pop (defeated pose stays clean).
      const rage = b.hp > 0 && activePhase(b, bc).rage === true;
      this.skin(this.bossSprite, this.bossPose(b, this.art.boss.poses, rage ? frame * 2 : frame), this.box(b.x, b.y, bc.width, bc.height), 1.25);
      this.bossSprite.setFlipX(b.dir === -1);
      this.bossSprite.setAlpha(bossBlinkAlpha(b, this.reducedMotion));
      this.bossHopRageJuice(this.bossSprite, b, bc, frame, rage);
      this.drawDizzyStars(0, b, bc, frame);
      for (let i = 0; i < this.hpPips.length; i++) this.hpPips[i]!.setVisible(i < b.hp);
    } else if (this.world.teamBoss && this.art.teamBoss) {
      // Team boss: pose + flash + pips for each member independently (same machine as the single boss).
      // A shaker (Pepper) can hop, so it gets the hop latches too; rage is King-only (the King in the
      // Boss Royale ring). In the ring, a body shows only once it drops in and fades after its pop.
      const tb = this.world.teamBoss;
      for (let i = 0; i < this.teamSprites.length; i++) {
        const m = tb.members[i]!;
        const art = this.art.teamBoss.members[i]!;
        const sprite = this.teamSprites[i]!;
        const shown = tb.royale ? royaleBodyAlpha(tb, i, this.royalePopAge[i] ?? Infinity) : 1;
        sprite.setVisible(shown > 0);
        if (shown > 0) {
          const rage = this.memberRaging(i);
          this.skin(sprite, this.bossPose(m, art.poses, rage ? frame * 2 : frame), this.box(m.x, m.y, art.config.width, art.config.height), 1.25);
          sprite.setFlipX(m.dir === -1);
          sprite.setAlpha(bossBlinkAlpha(m, this.reducedMotion) * shown);
          this.bossHopRageJuice(sprite, m, art.config, frame, rage);
        }
        if (m.hp > 0 || !tb.royale) this.drawDizzyStars(i, m, art.config, frame);
        else this.dizzyStars[i]?.forEach((star) => star.setVisible(false));
        const pips = this.teamPips[i] ?? [];
        const row = tb.royale ? royaleHudRow(tb, i) : i;
        for (let j = 0; j < pips.length; j++) {
          pips[j]!.setVisible(row !== null && j < m.hp);
          if (tb.royale && row !== null) pips[j]!.setY(52 + row * 20);
        }
        const name = this.royaleNameTexts[i];
        if (name) {
          name.setVisible(row !== null);
          if (row !== null) name.setY(50 + row * 20);
        }
      }
      if (tb.royale) {
        const next = royaleNextUp(tb, this.level.teamBoss!);
        this.royaleNextText?.setText(next.length > 0 ? `${STRINGS.royaleNext} ${royaleNames(next)}` : '');
        const health = tb.royale.drops.find((d) => d.kind === 'health');
        const power = tb.royale.drops.find((d) => d.kind === 'power');
        const [pie, box] = this.royaleDropSprites;
        pie?.setVisible(!!health);
        if (pie && health) this.skin(pie, 'pep-pickup', this.box(health.x, health.y, PICKUP_CONFIG.width, PICKUP_CONFIG.height), 1.15);
        box?.setVisible(!!power);
        if (box && power) {
          const id = Math.floor(frame / BOX_GLINT_PERIOD) % 6 === 0 ? 'wheat-box-glint' : 'wheat-box-idle';
          this.skin(box, id, this.box(power.x, power.y, PICKUP_CONFIG.width, PICKUP_CONFIG.height), 1.1);
        }
      }
    } else {
      const total = this.world.collectibles.length;
      const got = this.world.collectibles.filter((c) => c.collected).length;
      this.hud.setText(`x ${got}/${total}`);
      this.cobIcon?.setTexture(`good-cob-${(Math.floor(frame / COB_PERIOD) % 4) + 1}`); // spin the counter icon
    }

    // Out of lives: freeze on the game-over card with a "try again" prompt (restarts this stage with a
    // fresh run of lives — gentle, never cruel). Built once; the sim is already frozen (run.ts).
    if (this.world.gameOver && !this.gameOverShown) {
      this.gameOverShown = true;
      this.time.delayedCall(GAME_OVER_HOLD_MS, () => this.showGameOver()); // let the tumble read first
      return;
    }

    // On completion: advance along the campaign sequence (data, not a hardcoded chain). The final
    // stage has no next, so it just celebrates. Rescued crew and their resources stay in the campaign;
    // the run's remaining lives carry forward to the next stage.
    if (this.world.completed && !this.transitioning) {
      this.transitioning = true;
      if (this.royale) {
        this.completeRoyale();
        return;
      }
      const next = nextLevel(this.level.id);
      const carryLives = this.world.lives; // snapshot now; the sim is frozen from here, so this is final
      const scoreCompletion = completeStageScore(this.session, loadHighScores(), this.level.id, {
        frames: this.world.frame,
        rawScore: this.world.score,
        lives: this.world.lives,
        deaths: this.world.deaths,
        cobs: this.world.collectibles.filter((collectible) => collectible.collected).length,
        totalCobs: this.level.collectibles.length,
      }, {
        recordCampaign: !this.replayMode && (next !== null || this.level.id === 'end-final'),
        finalStage: this.level.id === 'end-final',
      });
      saveHighScores(scoreCompletion.scores);
      if (this.replayMode) {
        this.holdScoreCard(scoreCompletion.award, () => this.quitToTitle());
      } else if (next) {
        const recorded = { ...scoreCompletion.session, lives: carryLives };
        this.session = advanceCampaign(recorded, next.id);
        saveCampaign(this.session);
        // Banner pop-in (item 5): from 0.6 with a back-ease overshoot to 1 — a celebratory snap. Then
        // celebrate + fade out into the next stage (create() fades back in).
        this.banner.setScale(0.6).setVisible(true);
        this.tweens.add({ targets: this.banner, scaleX: 1, scaleY: 1, duration: 420, ease: 'Back.Out' });
        // Drive the restart off the fade-out COMPLETION, not a second hand-timed delayedCall. The old
        // pair coincided (fadeOut(400) at 800ms finishes at ~1200ms — the same tick the 1200ms restart
        // fired), so whether the screen had reached full black at restart was a per-run coin flip → the
        // "sometimes dark" boss-arena residue leaking into the next stage. Ordering by event guarantees
        // the last painted frame before the swap is full black; the next stage's create() fades back in.
        this.holdScoreCard(scoreCompletion.award, () => {
          this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
            this.scene.restart({ level: next, session: this.session }),
          );
          this.cameras.main.fadeOut(400);
        });
      } else if (this.level.id === 'end-final') {
        const recorded = { ...scoreCompletion.session, lives: carryLives };
        this.session = completeCampaign(recorded);
        saveCampaign(this.session);
        // The campaign's true finale: erupt the popcorn volcano. The banner defers to the eruption
        // crescendo, so it is NOT shown here.
        this.holdScoreCard(scoreCompletion.award, () => {
          this.publishCampaign({ completed: false });
          this.startFinale();
        });
      } else {
        // Unknown / dev-mounted level with no next: keep today's behavior (banner pop, freeze).
        this.banner.setScale(0.6).setVisible(true);
        this.tweens.add({ targets: this.banner, scaleX: 1, scaleY: 1, duration: 420, ease: 'Back.Out' });
      }
    }
  }

  // The stage score card (UX review #9): hold a beat so the pop or the door touch lands, then show the
  // card and wait for the player (a Next press, or a fresh jump/swing) instead of rushing on after ~2 s.
  // A press in the first CARD_MIN_MS is ignored; the card then waits as long as the player needs.
  private holdScoreCard(award: import('@/ui/chrome/bus').ScoreAwardState, proceed: () => void): void {
    this.time.delayedCall(ENDING_HOLD_MS, () => {
      this.publishCampaign({ scoreAward: award });
      this.cardShownAt = this.time.now;
      this.nextPressHeld = true; // a button still held from play must be released first
      let done = false;
      this.advanceStage = () => {
        if (done) return;
        done = true;
        this.advanceStage = undefined;
        proceed();
      };
    });
  }

  private requestNextStage(): void {
    if (this.advanceStage && this.time.now - this.cardShownAt >= CARD_MIN_MS) this.advanceStage();
  }

  // Every ring boss popped: score the whole run, bank it on the local Royale record (never the campaign
  // save or the stage high scores), and hand the award to the result panel under the clear banner.
  private completeRoyale(): void {
    const { record, award } = finishRoyaleRun(this.royale!, {
      frames: this.world.frame,
      deaths: this.world.deaths,
      lives: this.world.lives,
    }, loadRoyaleRecord());
    saveRoyaleRecord(record);
    this.banner.setScale(0.6).setVisible(true);
    this.tweens.add({ targets: this.banner, scaleX: 1, scaleY: 1, duration: 420, ease: 'Back.Out' });
    // Let the clear banner land before the result card covers it.
    this.time.delayedCall(1_400, () => this.publishCampaign({ royaleAward: award }));
  }

  private startFinale(): void {
    this.finaleActive = true;
    this.finaleClock = 0;
    if (this.art.victoryTheme) this.audio.playMusic(this.art.victoryTheme, { fadeMs: 800 });
    // Clear any live camera juice: the killing boss-hit arms a screen shake that would otherwise
    // freeze into a static followOffset once the finale short-circuits update(). The mound's
    // own deterministic tremble is the finale's only motion.
    this.shakeFrames = 0;
    this.shakeMag = 0;
    this.camLookahead = 0;
    this.cameras.main.setFollowOffset(0, 0);
    // Behind the popped king at his VISUAL center — bossSprite.x is the AABB bottom-center skin()
    // planted (world.boss.x is the AABB *left edge*, 40px off). groundSupportY roots the mound on the
    // real surface under that column (the same helper the checkpoint scarecrows use).
    this.finaleOriginX = this.bossSprite?.x ?? this.level.width / 2;
    this.finaleGroundY = groundSupportY(this.level, this.finaleOriginX);
    this.cameras.main.stopFollow();
    this.cameras.main.centerOn(this.finaleOriginX, this.finaleGroundY - 150);

    // Strip away the combat readouts for the closing shot. The clear banner is part of this same
    // depth group and starts hidden; tickFinale reveals only it on the authored crescendo frame.
    for (const child of this.children.list) {
      const gameObject = child as Phaser.GameObjects.GameObject & { depth?: number; setVisible?: (value: boolean) => unknown };
      if (gameObject.depth === DEPTH.hud) gameObject.setVisible?.(false);
    }

    const c = regimeCanvas(); // the boss regime governs end-final (applyRegime('boss') in create())
    const glow = FINALE_BUTTER_GLOW;
    this.banner
      .setPosition(this.scale.width / 2, 86)
      .setColor(c.text)
      .setStroke(c.bg, 8)
      .setShadow(0, 4, c.bg, 5, true, true);
    this.finaleVeil = this.add
      .rectangle(
        this.scale.width / 2,
        this.scale.height / 2,
        this.scale.width * 1.5,
        this.scale.height * 1.5,
        0x000000,
        1,
      )
      .setScrollFactor(0)
      .setDepth(DEPTH.fx - 10)
      .setAlpha(0);
    this.volcanoSprite = this.add
      .sprite(this.finaleOriginX, this.finaleGroundY + 8, 'finale-volcano-cinematic')
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.fx - 9);
    const src = this.textures.get('finale-volcano-cinematic').getSourceImage();
    this.volcanoSprite.setScale(VOLCANO_DISPLAY_H / (src.height || 1)); // uniform; scaleY animated per tick
    const craterY = this.finaleGroundY - VOLCANO_DISPLAY_H + FINALE_CRATER_INSET;
    this.craterGlow = this.add
      .circle(this.finaleOriginX, craterY, 54, glow, 0.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.fx - 8);
    this.eruptionPlumeSprite = this.add
      .sprite(this.finaleOriginX, craterY + 24, 'finale-eruption-plume')
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.fx - 7)
      .setVisible(false);
    const plumeSource = this.textures.get('finale-eruption-plume').getSourceImage();
    this.eruptionPlumeSprite.setData('baseScale', PLUME_DISPLAY_H / (plumeSource.height || 1));
    this.shockwaveRing = this.add
      .circle(this.finaleOriginX, craterY + 5, 30, glow, 0)
      .setStrokeStyle(5, glow, 1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.fx - 6)
      .setVisible(false);
    this.craterFlash = this.add
      .circle(this.finaleOriginX, craterY, 26, glow, 1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.fx - 5)
      .setVisible(false);
    this.popcornPool = Array.from({ length: FINALE.POOL }, () =>
      this.add.sprite(0, 0, 'finale-popcorn-kernel').setOrigin(0.5, 0.5).setDepth(DEPTH.fx - 4).setVisible(false),
    );
    this.tickFinale(); // draw frame 0 immediately (no one-frame pop-in)
  }

  // Draw one finale frame from the pure timeline (no sim, no randomness — the One Rule). Camera zoom,
  // veil, plume, shockwave, mound tremble, and particles are all functions of the same integer frame.
  private tickFinale(): void {
    const raw = finaleKeyframe(this.finaleClock++, this.finaleOriginX, this.finaleGroundY);
    const kf = this.reducedMotion ? calmFinaleKeyframe(raw) : raw; // no push, tremble or flash
    // The King un-cobs on the pop frame: hide the frozen defeated boss sprite so his puff ring + the
    // settled popcorn (from the timeline) read as him bursting into popcorn. end-final is a single-boss
    // arena (bossSprite, never teamSprites); the optional-chain keeps dev-mounts safe.
    this.bossSprite?.setVisible(kf.kingVisible);
    this.cameras.main.setZoom(kf.cameraZoom);
    this.finaleVeil!.setAlpha(kf.veilAlpha);
    const v = this.volcanoSprite!;
    v.scaleY = v.scaleX * kf.volcanoScaleY; // bottom-anchored swell (origin 0.5,1)
    v.x = this.finaleOriginX + kf.rumble; // deterministic tremble on the sprite
    this.craterGlow!
      .setAlpha(kf.craterGlow * 0.7)
      .setScale(0.72 + kf.craterGlow * 0.58, 0.35 + kf.craterGlow * 0.2);
    if (kf.plume) {
      const plume = this.eruptionPlumeSprite!;
      const base = plume.getData('baseScale') as number;
      plume
        .setVisible(true)
        .setScale(base * kf.plume.scaleX, base * kf.plume.scaleY)
        .setAlpha(kf.plume.alpha);
    } else {
      this.eruptionPlumeSprite!.setVisible(false);
    }
    if (kf.shockwave) {
      this.shockwaveRing!
        .setVisible(true)
        .setScale(kf.shockwave.scale, kf.shockwave.scale * 0.34)
        .setAlpha(kf.shockwave.alpha);
    } else {
      this.shockwaveRing!.setVisible(false);
    }
    if (kf.flash) this.craterFlash!.setVisible(true).setScale(kf.flash.scale).setAlpha(kf.flash.alpha);
    else this.craterFlash!.setVisible(false);
    for (let i = 0; i < this.popcornPool.length; i++) {
      const s = this.popcornPool[i]!;
      const p = kf.particles[i];
      if (!p) { s.setVisible(false); continue; }
      if (s.texture.key !== p.key) s.setTexture(p.key);
      // Normalize to a sane display height (the skin() idiom — divide out the 6x sprite upscale) so
      // the popcorn isn't 6x oversized; the small footprint also keeps the timeline's floor-fade honest.
      const base = POPCORN_DISPLAY_H / (s.height || POPCORN_DISPLAY_H);
      s.setVisible(true).setPosition(p.x, p.y).setScale(base * p.scale).setAlpha(p.alpha).setRotation(p.rot);
    }
    // Banner lands on the crescendo, popped in with the same item-5 back-ease snap the field
    // transitions use.
    if (kf.bannerOn && !this.banner.visible) {
      this.banner.setScale(0.6).setVisible(true);
      this.tweens.add({ targets: this.banner, scaleX: 1, scaleY: 1, duration: 420, ease: 'Back.Out' });
    }
    for (const e of kf.sfx) this.audio.playSfx(e === 'burst' ? 'box-break' : e === 'fanfare' ? 'power-up' : 'collect');
    if (kf.creditsOn && !this.finaleCreditsPublished) {
      this.finaleCreditsPublished = true;
      this.publishCampaign({ completed: true, creditsRoll: this.finaleClock });
    }
  }

  // The game-over card: a dimming veil, the corn's gloat headline, and a "try again" button that
  // restarts THIS stage with a fresh run of lives (start of stage, never the whole campaign — gentle).
  private showGameOver(): void {
    this.audio.stopMusic(); // hush the bouncy field theme so the defeat card isn't scored over it (item 5)
    // Bank the next attempt as soon as the last life is spent, not only after the Retry click. That
    // keeps Second Wind intact if the player takes a break at the title screen, and also prevents a
    // saved zero-life campaign from resuming into another immediate game-over. One-shot via the
    // gameOverShown latch; replay stages never mutate the campaign save or earn assistance.
    if (this.royale) {
      // Bank the ring's next attempt: popped bosses stay popped, Second Wind rises, totals add once.
      this.royaleRetry = nextRoyaleAttempt(this.royale, {
        frames: this.world.frame,
        deaths: this.world.deaths,
        cleared: royaleClearedNames(this.world.teamBoss!),
        activeKid: this.characterId,
        activePower: this.session.activePower,
      });
    } else if (!this.replayMode) {
      const retrySession = this.level.boss || this.level.teamBoss
        ? recordBossWipe(this.session, this.level.id)
        : this.session;
      this.session = { ...retrySession, lives: INITIAL_LIVES };
      saveCampaign(this.session);
    }
    this.publishCampaign({ gameOver: true });
    // The chrome card owns Retry and Quit. Only a chrome-less harness mount needs a key shortcut;
    // a global Enter here would also fire while a kid's focus sits on the Quit button.
    if (activeMount().bare) this.input.keyboard?.once('keydown-ENTER', () => this.restartStage(true));
  }
}
