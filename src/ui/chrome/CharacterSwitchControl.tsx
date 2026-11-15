import { CHARACTER_ROSTER } from '@/entities/player/characters';
import { assetPath } from '@/assets/resolve';
import { CHARACTER_SWITCH_COPY } from '@/content/characterSwitch';

export function CharacterSwitchControl({ characterId, binding, onSwitch }: {
  characterId: string;
  binding: string;
  onSwitch: () => void;
}) {
  const index = Math.max(0, CHARACTER_ROSTER.findIndex((kid) => kid.id === characterId));
  const current = CHARACTER_ROSTER[index]!;
  const next = CHARACTER_ROSTER[(index + 1) % CHARACTER_ROSTER.length]!;
  return (
    <button type="button" className="character-switch" data-testid="switch-character" data-character={current.id}
      aria-label={CHARACTER_SWITCH_COPY.describe(current.title, next.title)} onClick={onSwitch}>
      <img src={assetPath(`${current.id}-idle`)} width="32" height="40" alt="" />
      <span className="character-switch-copy">
        <strong>{CHARACTER_SWITCH_COPY.label}</strong>
        <span>{current.title}<span className="character-switch-key"> · {binding.replace(/^Key/, '')} / R3</span></span>
      </span>
    </button>
  );
}
