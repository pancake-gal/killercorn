// Scene keys ↔ views. The view drives the regime (src/regime/derive.ts), so every scene
// declares which view it presents and the boot path applies the matching regime.

import { type View } from '@/regime/derive';

export const SCENE = {
  title: 'TitleScene',
  overworld: 'OverworldScene',
  play: 'PlayScene',
} as const;

export type SceneKey = (typeof SCENE)[keyof typeof SCENE];

export const SCENE_VIEW: Record<SceneKey, View> = {
  [SCENE.title]: 'title',
  [SCENE.overworld]: 'level',
  [SCENE.play]: 'level',
};

// Dev harness ?dev=<scene> accepts either a scene key or a short alias.
export function resolveDevScene(name: string): SceneKey | null {
  const lower = name.toLowerCase();
  if (lower === 'title' || lower === SCENE.title.toLowerCase()) return SCENE.title;
  if (lower === 'overworld' || lower === SCENE.overworld.toLowerCase()) return SCENE.overworld;
  if (lower === 'play' || lower === 'level' || lower === SCENE.play.toLowerCase()) return SCENE.play;
  return null;
}
