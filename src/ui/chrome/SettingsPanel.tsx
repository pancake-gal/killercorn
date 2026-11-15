import type { GameSettings } from '@/settings/settings';
import type { ActionBindings } from '@/input/actions';
import { CHARACTER_SWITCH_COPY } from '@/content/characterSwitch';
import { useDialogFocus } from './dialog';

export interface SettingsPanelProps {
  value: GameSettings;
  onChange: (value: GameSettings) => void;
  onClose: () => void;
  bindings?: ActionBindings;
  onBindingsChange?: (value: ActionBindings) => void;
  volume?: number;
  onVolumeChange?: (value: number) => void;
  musicVolume?: number;
  onMusicVolumeChange?: (value: number) => void;
  sfxVolume?: number;
  onSfxVolumeChange?: (value: number) => void;
}

const BINDING_LABEL: Record<keyof ActionBindings, string> = {
  moveLeft: 'Move left key',
  moveRight: 'Move right key',
  jump: 'Jump key',
  attack: 'Swing key',
  power: 'Crew power key',
  ability: 'Invisibility key',
  switchCharacter: CHARACTER_SWITCH_COPY.keyLabel,
  switchLeft: 'Previous crew key',
  switchRight: 'Next crew key',
  pause: 'Pause key',
  confirm: 'Confirm key',
  back: 'Back key',
};
const KEY_OPTIONS = [
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Enter', 'Escape',
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => `Key${letter}`),
];

export function SettingsPanel({
  value,
  onChange,
  onClose,
  bindings,
  onBindingsChange,
  volume,
  onVolumeChange,
  musicVolume,
  onMusicVolumeChange,
  sfxVolume,
  onSfxVolumeChange,
}: SettingsPanelProps) {
  const dialogRef = useDialogFocus(onClose);
  const change = <K extends keyof GameSettings>(key: K, next: GameSettings[K]) =>
    onChange({ ...value, [key]: next });

  return (
    <div ref={dialogRef} className="pause-overlay" role="dialog" aria-modal="true" aria-label="Settings">
      <section className="pause-card settings-card">
        <h2 className="pause-title">Settings</h2>
        <div className="settings-sections">
          <fieldset className="settings-section settings-audio">
            <legend>Audio</legend>
            {volume !== undefined && onVolumeChange && volumeSlider('Master volume', volume, onVolumeChange)}
            {musicVolume !== undefined && onMusicVolumeChange && volumeSlider('Music volume', musicVolume, onMusicVolumeChange)}
            {sfxVolume !== undefined && onSfxVolumeChange && volumeSlider('Sound effects volume', sfxVolume, onSfxVolumeChange)}
          </fieldset>
          <fieldset className="settings-section settings-accessibility">
            <legend>Accessibility</legend>
            <label className="settings-row">
              <input type="checkbox" checked={value.reducedMotion} onChange={(event) => change('reducedMotion', event.currentTarget.checked)} />
              Reduce motion
            </label>
            <label className="settings-row">
              <input type="checkbox" checked={value.highContrast} onChange={(event) => change('highContrast', event.currentTarget.checked)} />
              High contrast
            </label>
            <label className="settings-row">
              <input type="checkbox" checked={value.visualCues} onChange={(event) => change('visualCues', event.currentTarget.checked)} />
              Visual sound cues
            </label>
            <label className="settings-row">
              Text size
              <select value={value.textScale} onChange={(event) => change('textScale', event.currentTarget.value as GameSettings['textScale'])}>
                <option value="normal">Normal</option>
                <option value="large">Large</option>
              </select>
            </label>
          </fieldset>
          {bindings && onBindingsChange && (
            <fieldset className="binding-grid settings-section">
              <legend>Keyboard controls</legend>
              {(Object.keys(BINDING_LABEL) as (keyof ActionBindings)[]).map((action) => (
                <label className="settings-row" key={action}>
                  {BINDING_LABEL[action]}
                  <select
                    data-testid={`binding-${action}`}
                    aria-label={BINDING_LABEL[action]}
                    value={bindings[action]}
                    onChange={(event) => onBindingsChange({ ...bindings, [action]: event.currentTarget.value })}
                  >
                    {KEY_OPTIONS.map((code) => <option value={code} key={code}>{code.replace(/^Key/, '')}</option>)}
                  </select>
                </label>
              ))}
            </fieldset>
          )}
        </div>
        <button type="button" className="btn-primary" data-gamepad-back="true" onClick={onClose}>Done</button>
      </section>
    </div>
  );
}

function volumeSlider(label: string, value: number, onChange: (value: number) => void) {
  return (
    <label className="settings-row settings-volume">
      <span>{label} <output>{Math.round(value * 100)}%</output></span>
      <input
        type="range"
        aria-label={label}
        min="0"
        max="100"
        step="5"
        value={Math.round(value * 100)}
        onChange={(event) => onChange(Number(event.currentTarget.value) / 100)}
      />
    </label>
  );
}
