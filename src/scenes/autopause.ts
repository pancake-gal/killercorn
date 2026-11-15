// Auto-pause wiring (item 9): call `onHidden` whenever the tab is backgrounded, so a run freezes
// instead of ticking on while the player is away (a kid tabbing out shouldn't return to a lost life).
// Presentation-only — the caller (PlayScene) owns the pause; this is just the DOM visibility seam,
// extracted into a tiny pure helper so it's unit-testable without spinning up Phaser.

export function installVisibilityPause(onHidden: () => void, doc: Document = document): () => void {
  const handler = (): void => {
    if (doc.visibilityState === 'hidden') onHidden();
  };
  doc.addEventListener('visibilitychange', handler);
  return () => doc.removeEventListener('visibilitychange', handler);
}
