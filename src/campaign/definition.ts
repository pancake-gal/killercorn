import {
  type LevelDef,
  WORLD_1_1,
  WORLD_1_RANGE,
  BUTTER_STICK_ARENA,
  FIELD_CARROT,
  FIELD_CARROT_2,
  SALT_PEPPER_ARENA,
  FIELD_BERRY,
  FIELD_BERRY_2,
  GENERAL_ACORN_ARENA,
  FIELD_LETTUCE,
  FIELD_LETTUCE_2,
  SIR_PICKLE_ARENA,
  FIELD_BANANA,
  FIELD_BANANA_2,
  WORLD_1_BOSS,
  CREW_GRAB_ARENA,
  THE_LAST_FURROW,
  FINAL_UNCOB,
} from '@/entities/level/level';

export const CAMPAIGN: readonly LevelDef[] = [
  WORLD_1_1,
  WORLD_1_RANGE,
  BUTTER_STICK_ARENA,
  FIELD_CARROT,
  FIELD_CARROT_2,
  SALT_PEPPER_ARENA,
  FIELD_BERRY,
  FIELD_BERRY_2,
  GENERAL_ACORN_ARENA,
  FIELD_LETTUCE,
  FIELD_LETTUCE_2,
  SIR_PICKLE_ARENA,
  FIELD_BANANA,
  FIELD_BANANA_2,
  WORLD_1_BOSS,
  CREW_GRAB_ARENA,
  THE_LAST_FURROW,
  FINAL_UNCOB,
];

// The next stage after `id`, or null at the end of the campaign.
export function nextLevel(id: string): LevelDef | null {
  const index = CAMPAIGN.findIndex((level) => level.id === id);
  if (index < 0 || index + 1 >= CAMPAIGN.length) return null;
  return CAMPAIGN[index + 1]!;
}
