import { aabbOverlap, type Aabb, type CollectiblePlacement } from '@/entities/level/level';

export interface CollectibleConfig {
  width: number;
  height: number;
  value: number; // score banked when collected
}

export const GOOD_COB_CONFIG: CollectibleConfig = { width: 24, height: 24, value: 10 };

export interface CollectibleState {
  x: number;
  y: number;
  collected: boolean;
}

export function spawnCollectible(p: CollectiblePlacement): CollectibleState {
  return { x: p.x, y: p.y, collected: false };
}

export interface CollectResult {
  items: CollectibleState[];
  score: number;
  gained: number; // score banked this step (always >= 0)
}

// Pure: (items, score, playerBox) → updated items + new score. An uncollected cob the player box
// overlaps flips to collected and pays its value once; already-collected cobs are inert. Score is
// therefore monotonic and bounded by sum(value) — the economy_bounds oracle.
export function collectStep(
  items: readonly CollectibleState[],
  score: number,
  playerBox: Aabb,
  cfg: CollectibleConfig = GOOD_COB_CONFIG,
): CollectResult {
  let gained = 0;
  const next = items.map((c) => {
    if (c.collected) return c;
    const box: Aabb = { x: c.x, y: c.y, w: cfg.width, h: cfg.height };
    if (aabbOverlap(playerBox, box)) {
      gained += cfg.value;
      return { ...c, collected: true };
    }
    return c;
  });
  return { items: next, score: score + gained, gained };
}
