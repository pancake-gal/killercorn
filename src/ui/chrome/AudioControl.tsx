import { useSyncExternalStore } from 'react';
import { audioSettings, toggleMuted, uiSound } from '@/audio/bus';
import { ControlIcon } from './ControlIcon';

export function AudioControl() {
  const muted = useSyncExternalStore(audioSettings.subscribe, () => audioSettings.get().muted);
  return (
    <button
      type="button"
      className="audio-control"
      data-testid="audio-mute"
      aria-pressed={muted}
      aria-label={muted ? 'Unmute sound' : 'Mute sound'}
      title={muted ? 'Unmute sound' : 'Mute sound'}
      onClick={() => {
        toggleMuted();
        uiSound.emit(); // a little blip on the toggle (muted itself if you just muted)
      }}
    >
      <span className="utility-glyph" aria-hidden="true">
        <ControlIcon name={muted ? 'sound-off' : 'sound-on'} />
      </span>
    </button>
  );
}
