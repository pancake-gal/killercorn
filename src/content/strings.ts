export const STRINGS = {
  title: 'KILLER CORN',
  tagline: 'The corn has gone bad.',
  start: "Mash 'Em",
  newGame: 'New Game',
  continueGame: 'Continue',
  howToTitle: 'How To Play',
  howMove: 'Move: Arrows, A/D, stick, or touch',
  howJump: 'Jump: Space, W/Up, A button, or touch',
  howMash: "Mash 'Em: J/K, B button, or touch",
  howGoal: 'Bonk the bad corn, grab the good cobs, reach the barn.',
  pickKid: 'Pick Your Kid',
  retry: 'One More Try',
  world1: 'World 1: Cornfield Sunrise',
  world1Range: 'World 1: Squirrel Range',
  world1Boss: 'World 5: King Corn',
  world1Clear: 'Field Cleared!',
  bossDown: 'King Corn Popped!',
  loading: 'Buttering up...',
  // Shown on the title screen only when another site embeds the game in a frame.
  publisherNotice: 'KILLER CORN is free to play from Pancake Gal.',
  // Field titles (campaign worlds 2-5 — field A holds the world's caged produce friend to free).
  fieldCarrot: 'World 2: Root Rows',
  fieldBerry: 'World 3: Bramble Patch',
  fieldLettuce: 'World 4: Leaf Beds',
  fieldBanana: 'World 5: Orchard Bend',
  // Field B titles (the second field of each world — two fields now gate every boss).
  fieldCarrot2: 'World 2: Deep Furrows',
  fieldBerry2: 'World 3: Thorn Climb',
  fieldLettuce2: 'World 4: Compost Rows',
  fieldBanana2: 'World 5: Windfall Wood',
  endFurrow2: 'The Final Furrow',
  // Boss-arena titles.
  bossButter: 'Boss: Butter Stick',
  bossSalt: 'Boss: Salt & Pepper',
  bossAcorn: 'Boss: General Acorn',
  bossPickle: 'Boss: Sir Pickle',
  // Endgame arc (story canon): King Corn grabs the freed crew, a last furrow, the un-cobbing.
  endFurrow: 'The Last Furrow',
  crewGrab: 'The Crew Grab',
  kingEscapes: 'The King Bolts!',
  endFinal: 'Un-Cob the King',
  // Boss-down banners (one per boss, plus the field-clear + final lines).
  butterDown: 'Butter Stick Melted!',
  saltDown: 'Shakers Down!',
  acornDown: 'General Acorn Toppled!',
  pickleDown: 'Sir Pickle Speared!',
  cornGood: 'The Corn Is Good Again!',
  lives: 'TRIES',
  health: 'PEP',
  // Game-over headline. Cute-menace: the corn gloats, the kid is never blamed, and a rematch is
  // promised. Paired with the existing `retry` ("One More Try") on the try-again button.
  gameOver: 'The Corn Wins This Round',
  pause: 'Pause',
  pauseTitle: 'Field Break',
  resume: 'Back To It',
  restartStage: 'Restart Stage',
  quitToTitle: 'Quit To Title',
  startOverWarning: 'Starting over erases your saved game.',
  crewSwapWhere: 'Swap friends at a scarecrow or in Pause',
  squirrelThrows: 'Squirrel throws!',
  bossThrows: 'Boss throws!',
  bossOpen: 'Dizzy! Hit it now!',
  bossBlocked: 'Blocked! Wait for the stars.',
  pitHint: 'Hold jump for a bigger jump!',
  // Portrait phones shrink play to a sliver; asked before the run starts, never blocking it.
  rotateHint: 'Turn your phone sideways for a bigger view',
  // Home-screen shortcut: the title link and the how-to card for browsers with no install dialog.
  addToHome: 'Add to Home',
  homeScreenTitle: 'Add to Home Screen',
  homeScreenLead: 'Put KILLER CORN with your apps. One tap and you are back in the corn.',
  bossRoyale: 'Boss Royale',
  royaleDown: 'Every Boss Popped!',
  royaleNext: 'Next up:',
} as const;

export type StringId = keyof typeof STRINGS;

// Steps on the Add to Home card. Safari (iPhone, iPad) uses Share; other browsers use their menu.
export const HOME_SCREEN_STEPS = {
  share: [
    'Tap Share, the square with an arrow. No Share? Tap the three-dot button first.',
    'Tap Add to Home Screen. Scroll down if you need to.',
    'Tap Add.',
  ],
  menu: [
    'Open your browser menu.',
    'Tap Add to Home screen or Install.',
    'Tap Add or Install.',
  ],
} as const;

// Boss Royale ring names, keyed by boss registry name.
export const ROYALE_BOSS_NAME: Record<string, string> = {
  butterStick: 'Butter Stick',
  salt: 'Salt',
  pepper: 'Pepper',
  generalAcorn: 'General Acorn',
  sirPickle: 'Sir Pickle',
  kingCorn: 'King Corn',
};

// A ring group's display names ("Butter Stick", "Salt & Pepper").
export function royaleNames(ids: readonly string[]): string {
  return ids.map((id) => ROYALE_BOSS_NAME[id] ?? id).join(' & ');
}

// The drop-in banner for a group entering the ring.
export function royaleEntryCue(names: string): string {
  return `${names} ${names.includes(' & ') ? 'drop' : 'drops'} in!`;
}

// HUD power-up readout labels (the active-power chip). Arcade-short, concrete-noun, in voice.
// Keyed by PowerKind so a granted power maps straight to its on-screen tag.
import type { PowerKind } from '@/entities/player/powerup';

export const POWER_LABEL: Record<Exclude<PowerKind, 'none'>, string> = {
  cornpop: 'CORNPOP',
  berryRush: 'SPEED',
  carrotReach: 'REACH',
  blueBounce: 'HOPS',
  leafGuard: 'LEAF SHIELD',
  peelToss: 'PEELS',
} as const;
