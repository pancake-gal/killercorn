// Canvas color bridge: read the live regime CSS vars as concrete colors for Phaser.
// Scenes call regimeCanvas() instead of naming any palette color, so the only place a hex
// lives is the allowlisted palette table — the grep guard stays meaningful.

import { REGIMES, ON_ACCENT_TEXT } from './regimes';
import { getRegime } from './derive';

function cssVar(name: string, fallback: string, root: HTMLElement): string {
  const value = getComputedStyle(root).getPropertyValue(name).trim();
  return value || fallback;
}

export function hexToInt(hex: string): number {
  const h = hex.replace('#', '');
  return Number.parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
}

export interface RegimeCanvas {
  bg: string;
  text: string;
  accent: string;
  glow: string;
  onAccent: string;
  bgInt: number;
  accentInt: number;
}

export function regimeCanvas(root: HTMLElement = document.documentElement): RegimeCanvas {
  // Fallbacks come from the palette table keyed by the current data-regime — never a literal.
  const p = REGIMES[getRegime(root)];
  const bg = cssVar('--regime-bg', p.bg, root);
  const text = cssVar('--regime-text', p.text, root);
  const accent = cssVar('--regime-accent', p.accent, root);
  const glow = cssVar('--regime-glow', p.glow, root);
  const onAccent = cssVar('--on-accent-text', ON_ACCENT_TEXT, root);
  return { bg, text, accent, glow, onAccent, bgInt: hexToInt(bg), accentInt: hexToInt(accent) };
}
