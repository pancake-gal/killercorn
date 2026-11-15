import { useEffect, useRef } from 'react';

const FOCUSABLE = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

// Keys a focused dialog button activates natively. Phaser captures them at the window (and keeps a
// scene's captures after the scene ends), cancelling the press before the button sees it. A modal
// dialog freezes play behind it, so it keeps these keys to itself; their native default still runs.
export const ACTIVATION_KEYS = new Set(['Enter', ' ']);

// `onClose` runs on Escape; omit it for a dialog that must be answered (Escape is still swallowed).
export function useDialogFocus(onClose?: () => void) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog) return;

    // Query on demand: a control enabled after mount (e.g. once a scene is ready) must join the trap.
    const focusable = () => [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
    // No scroll: on a short screen the first control can sit below the fold, and scrolling to it would
    // open the card past its heading (Boss Royale result, Privacy & Access).
    focusable()[0]?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }
      if (ACTIVATION_KEYS.has(event.key)) {
        event.stopPropagation();
        return;
      }
      const controls = focusable();
      if (event.key !== 'Tab' || controls.length === 0) return;
      const first = controls[0]!;
      const last = controls.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (ACTIVATION_KEYS.has(event.key)) event.stopPropagation();
    };

    dialog.addEventListener('keydown', onKeyDown);
    dialog.addEventListener('keyup', onKeyUp);
    return () => {
      dialog.removeEventListener('keydown', onKeyDown);
      dialog.removeEventListener('keyup', onKeyUp);
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  return dialogRef;
}
