import { type RegimeId, isRegimeId } from './regimes';

export type View =
  | 'title'
  | 'character-select'
  | 'world-map'
  | 'level'
  | 'boss'
  | 'interstitial'
  | 'boss-intro';

const VIEW_REGIME: Record<View, RegimeId> = {
  title: 'menu',
  'character-select': 'menu',
  'world-map': 'menu',
  level: 'overworld',
  boss: 'boss',
  interstitial: 'poster',
  'boss-intro': 'poster',
};

export function deriveRegime(view: View): RegimeId {
  return VIEW_REGIME[view];
}

const ROOT_ATTR = 'data-regime';

// Apply a regime to the document root so the CSS vars (and any reader of getRegime) update.
export function applyRegime(view: View, root: HTMLElement = document.documentElement): RegimeId {
  const regime = deriveRegime(view);
  root.setAttribute(ROOT_ATTR, regime);
  return regime;
}

export function getRegime(root: HTMLElement = document.documentElement): RegimeId {
  const value = root.getAttribute(ROOT_ATTR);
  return value && isRegimeId(value) ? value : 'menu';
}
