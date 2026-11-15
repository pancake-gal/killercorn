// Detects whether the game runs inside a frame owned by another site. Reading the parent's
// location throws a SecurityError across origins in every browser; a same-origin parent reads fine.

type FrameWindow = { readonly top: Window | null; readonly self: Window };

export function isCrossOriginFramed(win: FrameWindow = window): boolean {
  try {
    const top = win.top;
    if (!top || top === win.self) return false;
    void top.location.origin;
    return false;
  } catch {
    return true;
  }
}
