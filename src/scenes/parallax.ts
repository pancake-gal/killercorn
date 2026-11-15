export interface ParallaxPlacement {
  y: number;
  height: number;
  scale: number;
  originY: 0 | 1;
  tilePositionY: number;
}

// Converts authored source-image alignment into viewport placement. Opaque far art can overdraw
// above the viewport to reveal a low-authored horizon without wrapping terrain into the sky edge.
// Transparent mid/near bands keep their existing bottom anchor and one-pixel seam guard.
export function parallaxPlacement(
  viewportHeight: number,
  sourceHeight: number,
  heightFrac = 1,
  liftSourcePx = 0,
): ParallaxPlacement {
  const safeSourceHeight = sourceHeight || viewportHeight;
  const bandHeight = viewportHeight * heightFrac;
  const scale = bandHeight / safeSourceHeight;

  if (heightFrac < 1) {
    return {
      y: viewportHeight,
      height: bandHeight,
      scale,
      originY: 1,
      tilePositionY: 1,
    };
  }

  const lift = Math.max(0, liftSourcePx) * scale;
  return {
    y: -lift,
    height: bandHeight + lift,
    scale,
    originY: 0,
    tilePositionY: 0,
  };
}
