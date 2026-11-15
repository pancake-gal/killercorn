import type { Aabb } from '@/entities/level/level';

export interface PlatformUnderlay {
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
  alpha: 1;
}

const SOIL_BASE = 0x4a2a18;

function multiplyColor(base: number, tint: number): number {
  const channel = (shift: number) => Math.round((((base >> shift) & 0xff) * ((tint >> shift) & 0xff)) / 0xff);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

/** Opaque backing geometry for a decorative platform tile skin. Presentation only. */
export function platformUnderlayFor(platform: Aabb, groundTint: number): PlatformUnderlay {
  return {
    x: platform.x,
    y: platform.y,
    width: platform.w,
    height: platform.h,
    color: multiplyColor(SOIL_BASE, groundTint),
    alpha: 1,
  };
}
