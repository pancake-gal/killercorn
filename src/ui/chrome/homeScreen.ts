import { store } from './bus';

export interface InstallPromptEvent extends Event {
  prompt(): Promise<unknown>;
}

export interface HomeScreenState {
  prompt: InstallPromptEvent | null;
  installed: boolean;
}

export const homeScreen = store<HomeScreenState>({ prompt: null, installed: false });

// Register at boot: the browser can fire the event before the title chrome mounts.
export function listenForInstallPrompt(target: Window = window): void {
  target.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // the Add to Home link asks instead of the browser's own banner
    homeScreen.set({ ...homeScreen.get(), prompt: event as InstallPromptEvent });
  });
  target.addEventListener('appinstalled', () => homeScreen.set({ prompt: null, installed: true }));
}

// A held prompt can be shown only once; the browser fires a fresh event if it may ask again.
export function openInstallPrompt(): void {
  const { prompt } = homeScreen.get();
  if (!prompt) return;
  homeScreen.set({ ...homeScreen.get(), prompt: null });
  void prompt.prompt().catch(() => {});
}

function matches(query: string): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.(query).matches;
}

// Phones and tablets only (same coarse-pointer test as the touch controls), and never inside the
// game already opened from its home-screen icon.
export function canOfferHomeScreen(): boolean {
  const installedApp = matches('(display-mode: standalone)')
    || matches('(display-mode: fullscreen)')
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return matches('(pointer: coarse)') && !installedApp;
}

// iPhone and iPad add to the home screen from Share; iPadOS reports a Mac with a touchscreen.
export function homeScreenSteps(): 'share' | 'menu' {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'share' : 'menu';
}
