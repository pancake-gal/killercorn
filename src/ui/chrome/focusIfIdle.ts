// Give a screen's primary control focus, unless the player (or an open dialog) already put it elsewhere.
export function focusIfIdle(target: HTMLElement | null): void {
  const active = document.activeElement;
  if (target && (active === null || active === document.body)) target.focus();
}
