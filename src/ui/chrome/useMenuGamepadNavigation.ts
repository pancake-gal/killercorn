import { useEffect, useRef } from 'react';
import { menuGamepadActions, type MenuGamepadActions } from '@/input/actions';

const MENU_FOCUSABLE = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), [href], [tabindex]:not([tabindex="-1"])';
const RELEASED: MenuGamepadActions = { previous: false, next: false, confirm: false, back: false };

function activateControl(active: HTMLElement | null): void {
  if (active instanceof HTMLSelectElement) {
    if (active.options.length === 0) return;
    active.selectedIndex = (active.selectedIndex + 1) % active.options.length;
    active.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
  if (active instanceof HTMLInputElement && (active.type === 'checkbox' || active.type === 'radio')) {
    active.click();
    return;
  }
  if (active instanceof HTMLInputElement && active.type === 'range') {
    const minimum = Number(active.min || 0);
    const maximum = Number(active.max || 100);
    const step = Number(active.step || 1);
    const advanced = Number(active.value) + step;
    const next = advanced > maximum ? minimum : advanced;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(active, String(next));
    active.dispatchEvent(new Event('input', { bubbles: true }));
    active.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
  if (active instanceof HTMLButtonElement) active.click();
}

export function useMenuGamepadNavigation(enabled: boolean): void {
  const previousRef = useRef<MenuGamepadActions>(RELEASED);

  useEffect(() => {
    previousRef.current = RELEASED;
    if (!enabled || typeof navigator.getGamepads !== 'function') return;

    const firstPad = () => [...navigator.getGamepads()].find((candidate): candidate is Gamepad => candidate !== null);
    // A menu that opens mid-run (game over, stage clear) must not read a still-held jump or swing
    // as a press: seed with the current state so each button has to be released first.
    previousRef.current = menuGamepadActions(firstPad());

    const poll = () => {
      const current = menuGamepadActions(firstPad());
      const previous = previousRef.current;
      const dialog = document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]');
      // body, not document: the <head> icon links match [href] but can never take focus.
      const root: ParentNode = dialog ?? document.body;
      const controls = [...root.querySelectorAll<HTMLElement>(MENU_FOCUSABLE)];
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;

      if (current.back && !previous.back) {
        const back = root.querySelector<HTMLButtonElement>('[data-gamepad-back="true"]');
        if (back) back.click();
        else active?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      } else if (current.confirm && !previous.confirm) {
        activateControl(active);
      } else if ((current.next && !previous.next) || (current.previous && !previous.previous)) {
        const direction = current.next ? 1 : -1;
        const activeIndex = active ? controls.indexOf(active) : -1;
        const start = activeIndex >= 0 ? activeIndex : direction > 0 ? -1 : 0;
        controls[(start + direction + controls.length) % controls.length]?.focus();
      }

      previousRef.current = current;
    };

    const timer = window.setInterval(poll, 50);
    return () => window.clearInterval(timer);
  }, [enabled]);
}
