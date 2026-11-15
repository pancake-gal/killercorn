// Shared semantic line artwork for gameplay and utility controls. Inline SVG keeps every icon crisp
// at device scale, inherits the active regime color, and avoids shipping opaque bitmap plates over
// the playfield. The SVG is decorative; each owning button provides the literal accessible label.

export type ControlIconName =
  | 'left'
  | 'right'
  | 'jump'
  | 'sword'
  | 'power'
  | 'pause'
  | 'fullscreen-enter'
  | 'fullscreen-exit'
  | 'sound-on'
  | 'sound-off';

export function ControlIcon({ name }: { name: ControlIconName }) {
  const artwork = (() => {
    switch (name) {
      case 'left':
        return <><path d="M15.5 5.5 9 12l6.5 6.5" /><path d="M9.5 12H19" /></>;
      case 'right':
        return <><path d="m8.5 5.5 6.5 6.5-6.5 6.5" /><path d="M15 12H5.5" /></>;
      case 'jump':
        return <><path d="m6 14 6-6 6 6" /><path d="M12 8v10" /><path d="M6.5 19h11" /></>;
      case 'sword':
        // Blade tip up-right, crossguard, grip, and pommel down-left: reads as "attack" at thumb size.
        return (
          <>
            <path d="M19.5 4.5 18.4 7.6 10.3 15.7 8.3 13.7 16.4 5.6Z" />
            <path d="M6.5 11.9 12.1 17.5" />
            <path d="M9.3 14.7 6.8 17.2" />
            <circle cx="5.9" cy="18.1" r="1.2" />
          </>
        );
      case 'power':
        return <path d="m12 3.7 2.35 4.76 5.25.76-3.8 3.7.9 5.23L12 15.68l-4.7 2.47.9-5.23-3.8-3.7 5.25-.76L12 3.7Z" />;
      case 'pause':
        return <><path d="M8.5 6.5v11" /><path d="M15.5 6.5v11" /></>;
      case 'fullscreen-enter':
        return <><path d="M9 4H4v5" /><path d="M15 4h5v5" /><path d="M20 15v5h-5" /><path d="M9 20H4v-5" /></>;
      case 'fullscreen-exit':
        return <><path d="M4 9h5V4" /><path d="M20 9h-5V4" /><path d="M15 20v-5h5" /><path d="M9 20v-5H4" /></>;
      case 'sound-on':
        return <><path d="M5 10h3l4-3v10l-4-3H5Z" /><path d="M15 9.3c1.5 1.5 1.5 3.9 0 5.4" /><path d="M17.8 6.8a7.4 7.4 0 0 1 0 10.4" /></>;
      case 'sound-off':
        return <><path d="M5 10h3l4-3v10l-4-3H5Z" /><path d="m16 9 5 6" /><path d="m21 9-5 6" /></>;
    }
  })();

  return (
    <svg
      viewBox="0 0 24 24"
      data-control-icon={name}
      aria-hidden="true"
      focusable="false"
    >
      {artwork}
    </svg>
  );
}
