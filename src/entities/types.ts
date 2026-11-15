export type Axis = 'container' | 'role';

export type Category =
  | 'level'
  | 'player-character'
  | 'enemy'
  | 'boss'
  | 'team-boss'
  | 'collectible'
  | 'hazard'
  | 'projectile'
  | 'powerup'
  | 'ally';

export type OracleClass =
  | 'impossible_state'
  | 'idempotent_save_load'
  | 'stable_serialization'
  | 'economy_bounds'
  | 'a11y_defaults';

// Minimum a registered entity must declare. Concrete actor/level specs extend this.
export interface EntitySpec {
  name: string;
  category: Category;
  // Display name shown in-fiction; voice-checked copy, not an engine id.
  title: string;
}
