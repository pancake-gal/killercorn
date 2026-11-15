// Small, dismissible publisher credit for copies embedded by another site. Text only: external
// links need the parental gate. Presentation only; it never touches game state.

import { useState } from 'react';
import { STRINGS } from '@/content/strings';
import { isCrossOriginFramed } from './framing';

export function PublisherNotice({ framed = isCrossOriginFramed }: { framed?: () => boolean }) {
  const [visible, setVisible] = useState(framed);
  if (!visible) return null;
  return (
    <div className="publisher-notice" role="note" aria-label="About this game">
      <span>{STRINGS.publisherNotice}</span>
      <button type="button" onClick={() => setVisible(false)}>Dismiss</button>
    </div>
  );
}
