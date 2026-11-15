// "Turn your phone sideways" — always rendered, shown only on portrait phones by regime.css.
import { STRINGS } from '@/content/strings';

export function RotateHint() {
  return (
    <p className="rotate-hint" role="note" data-testid="rotate-hint">
      <span aria-hidden="true">↻</span>
      {STRINGS.rotateHint}
    </p>
  );
}
