import type { RoyaleSpice } from '@/royale/spices';
import type { RoyaleCrown } from '@/royale/score';

export const ROYALE_COPY = {
  titleButton: 'Boss Royale',
  eyebrow: 'POST-GAME RING',
  title: 'Boss Royale',
  blurb: 'Every boss. One ring. Two at a time. Pop them all.',
  kidLegend: 'Pick your kid',
  spicesLegend: 'Spices',
  spiceBonus: '+1,000 each',
  spicesLocked: 'Clear the ring once to unlock spices.',
  crowns: 'Earned crowns',
  bests: 'Your bests',
  bestScore: 'Best score',
  bestTime: 'Fastest clear',
  noBests: 'No clears yet. The ring is waiting.',
  start: "Mash 'Em",
  back: 'Back',
  resultEyebrow: 'RING CLEARED',
  resultTitle: 'Every Boss Popped!',
  newBest: 'NEW ROYALE BEST',
  runScore: 'ROYALE SCORE',
  resultCrowns: 'Crowns this run',
  newCrown: 'NEW',
  again: 'Mash Again',
  titleMenu: 'Title Menu',
  gameOverCopy: 'Popped bosses stay popped.',
  restart: 'Restart Royale',
  scoreBoard: 'Boss Royale: Score',
  timeBoard: 'Boss Royale: Time',
  emptyBoard: 'No Royale clears yet. Pop every boss to fill the board.',
} as const;

export const SPICE_COPY: Record<RoyaleSpice, { label: string; hint: string }> = {
  soloKid: { label: 'Solo Kid', hint: 'No kid switching.' },
  noCrew: { label: 'No Crew', hint: 'No crew powers or power drops.' },
  oneLife: { label: 'One Life', hint: 'One life per try.' },
  noSecondWind: { label: 'No Second Wind', hint: 'Bosses never soften after a wipe.' },
  shuffle: { label: 'Shuffle', hint: 'The middle bosses come in a new order.' },
};

export const CROWN_COPY: Record<RoyaleCrown, string> = {
  clear: 'Royale Clear',
  noLivesLost: 'No Lives Lost',
  underPar: 'Under Par',
  spicy: 'Spicy Clear',
};

export const ROYALE_BREAKDOWN_LABEL = {
  clear: 'Clear',
  lives: 'Lives',
  clean: 'Clean',
  pace: 'Pace',
  spice: 'Spice',
} as const;
