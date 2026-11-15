// Notched phones: index.html sets viewport-fit=cover, so the canvas fills under the notch and rounded
// corners. The camera-pinned HUD keeps clear of the browser's safe-area insets. Presentation only.

export interface SafeInsets {
  left: number;
  right: number;
}

// The browser exposes the insets only through CSS env(), so read them off a throwaway probe.
export function readSafeInsets(doc: Document = document): SafeInsets {
  const probe = doc.createElement('div');
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;padding-left:env(safe-area-inset-left,0px);padding-right:env(safe-area-inset-right,0px)';
  doc.body.appendChild(probe);
  const style = getComputedStyle(probe);
  const insets = { left: parseFloat(style.paddingLeft) || 0, right: parseFloat(style.paddingRight) || 0 };
  probe.remove();
  return insets;
}

// CSS px to game px for a canvas `gameWidth` wide drawn `canvasCssWidth` CSS px wide.
export function hudSafeInsets(safe: SafeInsets, canvasCssWidth: number, gameWidth: number): SafeInsets {
  if (canvasCssWidth <= 0) return { left: 0, right: 0 };
  const toGame = gameWidth / canvasCssWidth;
  return { left: safe.left * toGame, right: safe.right * toGame };
}
