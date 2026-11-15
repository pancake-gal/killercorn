import type { WorldState } from '@/entities/level/run';

// A pit loss banks the try while the player is still below the level floor; an emptied health bar
// loses it on the ground. So the previous frame's height tells the two apart.
export function lostTryToPit(prev: WorldState, curr: WorldState, levelHeight: number): boolean {
  return curr.deaths > prev.deaths && !curr.gameOver && prev.player.y > levelHeight;
}
