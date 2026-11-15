import { type Axis, type Category, type OracleClass } from './types';

export interface CategoryDef {
  axis: Axis;
  label: string;
  // Oracle classes required for every entity in this category.
  oracles: readonly OracleClass[];
  // Registry-key prefix; for `level` the suffix is `<world>-<n>`, for roles it is the camelCase name.
  keyHint: string;
}

export const CATEGORY_TREE: Record<Category, CategoryDef> = {
  level: { axis: 'container', label: 'a side-scrolling stage', oracles: ['impossible_state', 'stable_serialization'], keyHint: 'level.<world>-<n>' },
  'player-character': { axis: 'role', label: 'selectable hero (Fred and friends)', oracles: ['impossible_state'], keyHint: 'playerCharacter.<name>' },
  enemy: { axis: 'role', label: 'common food-gone-bad mob', oracles: ['impossible_state'], keyHint: 'enemy.<name>' },
  boss: { axis: 'role', label: 'end-of-world food boss', oracles: ['impossible_state', 'stable_serialization'], keyHint: 'boss.<name>' },
  'team-boss': { axis: 'role', label: 'simultaneous multi-target boss', oracles: ['impossible_state'], keyHint: 'teamBoss.<name>' },
  collectible: { axis: 'role', label: 'pickup: good corn, power-ups, score', oracles: ['economy_bounds'], keyHint: 'collectible.<name>' },
  hazard: { axis: 'role', label: 'environmental danger (pits, spikes, machinery)', oracles: ['impossible_state'], keyHint: 'hazard.<name>' },
  projectile: { axis: 'role', label: "a thrown object (squirrels' spiked corn, the banana peel)", oracles: ['impossible_state', 'stable_serialization'], keyHint: 'projectile.<name>' },
  powerup: { axis: 'role', label: 'the wheat-stamped box and the timed power-up it grants', oracles: ['economy_bounds', 'stable_serialization'], keyHint: 'powerup.<name>' },
  ally: { axis: 'role', label: 'a caged good-produce friend; freeing it grants a signature power-up', oracles: ['impossible_state', 'stable_serialization'], keyHint: 'ally.<name>' },
};

export const CATEGORIES = Object.keys(CATEGORY_TREE) as Category[];

export function categoriesByAxis(axis: Axis): Category[] {
  return CATEGORIES.filter((c) => CATEGORY_TREE[c].axis === axis);
}

export function requiredOracles(category: Category): readonly OracleClass[] {
  return CATEGORY_TREE[category].oracles;
}
