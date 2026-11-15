// iPad browsers use WebKit's Web Audio policy even when the browser is Chrome. Phaser installs its
// own unlock listeners, but a context can remain suspended (or become interrupted after backgrounding)
// on real devices. Prime it from capture phase on a qualifying end-of-tap gesture so this runs before
// React's Start / character-select handlers attempt to enter gameplay.

interface AudioSourceLike {
  buffer: unknown;
  connect(destination: unknown): unknown;
  disconnect(): void;
  start(when?: number): void;
  onended: (() => void) | null;
}

interface AudioContextLike {
  state: string;
  sampleRate: number;
  destination: unknown;
  resume(): Promise<void>;
  createBuffer(channels: number, length: number, sampleRate: number): unknown;
  createBufferSource(): AudioSourceLike;
}

const GESTURE_EVENTS = ['pointerup', 'touchend', 'click', 'keydown'] as const;
const primedContexts = new WeakSet<object>();

function audioContextFrom(manager: unknown): AudioContextLike | null {
  if (typeof manager !== 'object' || manager === null) return null;
  const context = (manager as { context?: unknown }).context;
  if (typeof context !== 'object' || context === null) return null;

  const candidate = context as Partial<AudioContextLike>;
  if (
    typeof candidate.resume !== 'function' ||
    typeof candidate.createBuffer !== 'function' ||
    typeof candidate.createBufferSource !== 'function'
  ) {
    return null;
  }
  return context as AudioContextLike;
}

function activate(manager: unknown): void {
  const context = audioContextFrom(manager);
  if (!context) return;

  // Do not await: both operations must begin synchronously while WebKit's user-activation token is
  // live. A source started while suspended begins once resume resolves.
  if (context.state !== 'running') {
    try {
      void context.resume().catch(() => undefined);
    } catch {
      // Some browser implementations throw synchronously instead of rejecting. Try again next tap.
    }
  }

  if (primedContexts.has(context)) return;
  try {
    const source = context.createBufferSource();
    source.buffer = context.createBuffer(1, 1, context.sampleRate || 22_050);
    source.connect(context.destination);
    source.onended = () => {
      try {
        source.disconnect();
      } catch {
        // Already disconnected by the browser.
      }
    };
    source.start(0);
    primedContexts.add(context);
  } catch {
    // Keep the context unprimed so a later qualifying gesture can retry.
  }
}

export function installAudioActivation(
  soundManager: unknown,
  target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> = document,
): () => void {
  const onGesture: EventListener = () => activate(soundManager);
  for (const eventType of GESTURE_EVENTS) target.addEventListener(eventType, onGesture, true);

  return () => {
    for (const eventType of GESTURE_EVENTS) target.removeEventListener(eventType, onGesture, true);
  };
}
