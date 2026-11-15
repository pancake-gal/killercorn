import { useEffect, useState } from 'react';
import { ControlIcon } from './ControlIcon';

export function FullscreenControl() {
  const supported = document.fullscreenEnabled
    && typeof document.documentElement.requestFullscreen === 'function'
    && typeof document.exitFullscreen === 'function';
  const [fullscreen, setFullscreen] = useState(() => Boolean(document.fullscreenElement));

  useEffect(() => {
    if (!supported) return;
    const syncFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncFullscreen);
    syncFullscreen();
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, [supported]);

  if (!supported) return null;
  const label = fullscreen ? 'Exit fullscreen' : 'Enter fullscreen';

  return (
    <button
      type="button"
      className="fullscreen-control"
      data-testid="fullscreen-button"
      aria-pressed={fullscreen}
      aria-label={label}
      title={label}
      onClick={() => {
        const change = fullscreen
          ? document.exitFullscreen()
          : document.documentElement.requestFullscreen();
        void change.catch(() => {});
      }}
    >
      <span className="utility-glyph" aria-hidden="true">
        <ControlIcon name={fullscreen ? 'fullscreen-exit' : 'fullscreen-enter'} />
      </span>
    </button>
  );
}
