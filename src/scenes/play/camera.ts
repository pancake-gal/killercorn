export interface CameraShakeState {
  frames: number;
  duration: number;
  magnitude: number;
}

export interface CameraShakeStep {
  x: number;
  y: number;
  state: CameraShakeState;
}

export interface CameraBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const AUTHORED_VIEW_WIDTH = 960;
const EDGE_CONTROL_SAFE_FRACTION = 0.14;

/** Presentation-only camera bounds for expanded displays. Extra width becomes symmetric background
 * gutter at the level edges. Extra height is added above the authored level so its ground remains
 * bottom-anchored instead of exposing moving parallax beneath solid platforms. The sim does not move. */
export function cameraBoundsForViewport(
  levelWidth: number,
  levelHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): CameraBounds {
  const extraWidth = Math.max(0, viewportWidth - AUTHORED_VIEW_WIDTH);
  const extraHeight = Math.max(0, viewportHeight - levelHeight);
  const gutter = Math.min(extraWidth, viewportWidth * EDGE_CONTROL_SAFE_FRACTION);
  return {
    x: gutter === 0 ? 0 : -gutter,
    y: extraHeight === 0 ? 0 : -extraHeight,
    width: levelWidth + gutter * 2,
    height: levelHeight + extraHeight,
  };
}

/** Presentation-only deterministic shake. Reduced motion also consumes the
 * pending shake, so turning the setting off later cannot replay stale motion. */
export function stepCameraShake(
  state: CameraShakeState,
  frame: number,
  reducedMotion: boolean,
): CameraShakeStep {
  if (reducedMotion) {
    return { x: 0, y: 0, state: { ...state, frames: 0, magnitude: 0 } };
  }
  if (state.frames <= 0 || state.magnitude <= 0) return { x: 0, y: 0, state };

  const amplitude = state.magnitude * (state.frames / Math.max(1, state.duration));
  const frames = state.frames - 1;
  return {
    x: frame % 2 === 0 ? amplitude : -amplitude,
    y: (Math.floor(frame / 2) % 2 === 0 ? amplitude : -amplitude) * 0.6,
    state: {
      ...state,
      frames,
      magnitude: frames === 0 ? 0 : state.magnitude,
    },
  };
}
