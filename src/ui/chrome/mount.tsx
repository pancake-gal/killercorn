// Mounts the React chrome overlay into #ui. The boot path (src/main.ts) skips this when the
// dev harness requests a bare scene (?bare=true), so a single scene can render chrome-free.

import { createRoot } from 'react-dom/client';
import { Chrome } from './Chrome';

export function mountChrome(container: HTMLElement): void {
  createRoot(container).render(<Chrome />);
}
