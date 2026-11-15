import { registerEntity, getEntity } from './index';
import { type EntitySpec } from './types';

export function loadEntities(): void {
  if (getEntity('playerCharacter.fred')) return;

  // Container: the first stage.
  registerEntity({ name: 'world1-1', category: 'level', title: 'Cornfield Sunrise' });

  registerEntity({ name: 'fred', category: 'player-character', title: 'Fred' });
  registerEntity({ name: 'daisy', category: 'player-character', title: 'Daisy' });
  registerEntity({ name: 'theo', category: 'player-character', title: 'Theo' });
  registerEntity({ name: 'rosa', category: 'player-character', title: 'Rosa' });
  registerEntity({ name: 'luca', category: 'player-character', title: 'Luca' });
  registerEntity({ name: 'izzy', category: 'player-character', title: 'Izzy' });

  // Role: bosses (one per field; King Corn is the climax).
  registerEntity({ name: 'kingCorn', category: 'boss', title: 'King Corn' });
  registerEntity({ name: 'butterStick', category: 'boss', title: 'Butter Stick' });
  registerEntity({ name: 'generalAcorn', category: 'boss', title: 'General Acorn' });
  registerEntity({ name: 'sirPickle', category: 'boss', title: 'Sir Pickle' });

  // Role: team-boss (both shakers fought simultaneously).
  registerEntity({ name: 'saltAndPepper', category: 'team-boss', title: 'Salt & Pepper' });

  // Role: a common mob, a pickup, a hazard — one of each axis member so the taxonomy is exercised.
  registerEntity({ name: 'kernelCreep', category: 'enemy', title: 'Kernel Creep' });
  registerEntity({ name: 'squirrel', category: 'enemy', title: 'Squirrel' });
  registerEntity({ name: 'spikedCorn', category: 'projectile', title: 'Spiked Corn' });
  registerEntity({ name: 'goodCob', category: 'collectible', title: 'Good Cob' });
  registerEntity({ name: 'thresher', category: 'hazard', title: 'Thresher' });

  registerEntity({ name: 'wheatBox', category: 'powerup', title: 'Wheat Box' });

  registerEntity({ name: 'strawberry', category: 'ally', title: 'Strawberry' });
  registerEntity({ name: 'carrot', category: 'ally', title: 'Carrot' });
  registerEntity({ name: 'blueberry', category: 'ally', title: 'Blueberry' });
  registerEntity({ name: 'lettuce', category: 'ally', title: 'Lettuce' });
  registerEntity({ name: 'banana', category: 'ally', title: 'Banana' });
}

// Convenience for tests / tooling that want the seed list without side effects on the singleton.
export const SEED_ROSTER: ReadonlyArray<Pick<EntitySpec, 'name' | 'category' | 'title'>> = [
  { name: 'world1-1', category: 'level', title: 'Cornfield Sunrise' },
  { name: 'fred', category: 'player-character', title: 'Fred' },
  { name: 'daisy', category: 'player-character', title: 'Daisy' },
  { name: 'theo', category: 'player-character', title: 'Theo' },
  { name: 'rosa', category: 'player-character', title: 'Rosa' },
  { name: 'luca', category: 'player-character', title: 'Luca' },
  { name: 'izzy', category: 'player-character', title: 'Izzy' },
  { name: 'kingCorn', category: 'boss', title: 'King Corn' },
  { name: 'butterStick', category: 'boss', title: 'Butter Stick' },
  { name: 'generalAcorn', category: 'boss', title: 'General Acorn' },
  { name: 'sirPickle', category: 'boss', title: 'Sir Pickle' },
  { name: 'saltAndPepper', category: 'team-boss', title: 'Salt & Pepper' },
  { name: 'kernelCreep', category: 'enemy', title: 'Kernel Creep' },
  { name: 'squirrel', category: 'enemy', title: 'Squirrel' },
  { name: 'spikedCorn', category: 'projectile', title: 'Spiked Corn' },
  { name: 'goodCob', category: 'collectible', title: 'Good Cob' },
  { name: 'thresher', category: 'hazard', title: 'Thresher' },
  { name: 'wheatBox', category: 'powerup', title: 'Wheat Box' },
  { name: 'strawberry', category: 'ally', title: 'Strawberry' },
  { name: 'carrot', category: 'ally', title: 'Carrot' },
  { name: 'blueberry', category: 'ally', title: 'Blueberry' },
  { name: 'lettuce', category: 'ally', title: 'Lettuce' },
  { name: 'banana', category: 'ally', title: 'Banana' },
];
