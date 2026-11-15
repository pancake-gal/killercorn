import { REGIMES } from '@/regime/regimes';

export const PRIMARY_BUTTON_CLASS = 'btn-primary';

// Canonical accent reference for DOM / inline styles.
export const BTN_ACCENT = 'var(--regime-accent)';
export const BTN_ON_ACCENT_TEXT = 'var(--on-accent-text)';

// Resolve the live accent as a concrete hex for canvas drawing (Phaser fill colors).
// Reads the computed CSS var so canvas CTAs track the regime exactly like DOM ones.
// The fallback pulls from the palette table (allowlisted source-of-truth), never a literal.
export function currentAccent(root: HTMLElement = document.documentElement): string {
  const value = getComputedStyle(root).getPropertyValue('--regime-accent').trim();
  return value || REGIMES.menu.accent;
}

// Phaser fill colors are numbers; convert the live accent for canvas use.
export function currentAccentInt(root: HTMLElement = document.documentElement): number {
  const hex = currentAccent(root).replace('#', '');
  return Number.parseInt(hex.length === 3 ? hex.replace(/./g, '$&$&') : hex, 16);
}

// Inline style for a DOM primary button. Accent comes from the var, never a literal.
export function primaryButtonStyle(): Partial<CSSStyleDeclaration> {
  return {
    background: BTN_ACCENT,
    color: BTN_ON_ACCENT_TEXT,
    border: 'none',
    borderRadius: '10px',
    padding: '12px 20px',
    font: 'inherit',
    fontWeight: '800',
    cursor: 'pointer',
  };
}
