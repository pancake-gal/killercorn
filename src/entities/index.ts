import { type EntitySpec, type Category } from './types';
import { CATEGORY_TREE } from './registry';

const REGISTRY = new Map<string, EntitySpec>();

// camelCase the category so `team-boss` → `teamBoss`, `player-character` → `playerCharacter`.
function camel(name: string): string {
  return name
    .trim()
    .replace(/[-_\s]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/[-_\s]+$/, '');
}

export function entityKey(category: Category, name: string): string {
  return `${camel(category)}.${name}`;
}

export function registerEntity<T extends EntitySpec>(spec: T): T {
  if (!CATEGORY_TREE[spec.category]) {
    throw new Error(`registerEntity: unknown category "${spec.category}" for "${spec.name}"`);
  }
  const key = entityKey(spec.category, spec.name);
  if (REGISTRY.has(key)) {
    throw new Error(`registerEntity: duplicate entity key "${key}"`);
  }
  REGISTRY.set(key, spec);
  return spec;
}

export function getEntity(key: string): EntitySpec | undefined {
  return REGISTRY.get(key);
}

export function allEntities(): EntitySpec[] {
  return [...REGISTRY.values()];
}

export function entitiesInCategory(category: Category): EntitySpec[] {
  return allEntities().filter((e) => e.category === category);
}

export function __resetRegistry(): void {
  REGISTRY.clear();
}

export { type EntitySpec, type Category } from './types';
export { CATEGORY_TREE, CATEGORIES, requiredOracles, categoriesByAxis } from './registry';
