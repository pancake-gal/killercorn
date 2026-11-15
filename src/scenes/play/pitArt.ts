import type { PitPlacement } from '@/entities/level/level';

export interface PitVisual {
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
  alpha: number;
  lipHeight: number;
  lipColor: number;
  lipAlpha: number;
}

function shade(color: number, factor: number): number {
  const channel = (shift: number) => Math.round(((color >> shift) & 0xff) * factor);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

// Presentation-only geometry for a floor gap. The extra 96px of overdraw stays behind a tumbling
// actor if the camera follows slightly below the authored world before the deterministic respawn.
export function pitVisualFor(pit: PitPlacement, worldHeight: number, color: number): PitVisual {
  return {
    x: pit.x,
    y: pit.y,
    width: pit.w,
    height: Math.max(1, worldHeight - pit.y + 96),
    color,
    alpha: 0.96,
    lipHeight: 6,
    lipColor: shade(color, 0.52),
    lipAlpha: 0.92,
  };
}
