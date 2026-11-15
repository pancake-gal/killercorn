// Title screen (view: title → menu regime). The wordmark, tagline, and primary CTA are React
// DOM chrome (src/ui/chrome/TitleScreen), which emits the `start` intent that src/main.ts turns
// into the title → play transition. This scene paints the title key art behind that chrome and owns
// the regime (it sets data-regime so the chrome's --regime-accent resolves). The splash was authored
// with quiet zones — upper-center for the wordmark, a darker bottom strip — so the DOM overlay reads.

import Phaser from 'phaser';
import { applyRegime } from '@/regime/derive';
import { regimeCanvas } from '@/regime/canvas';
import { assetPath } from '@/assets/resolve';
import { SCENE } from './keys';
import { snapshot } from '@/ui/chrome/bus';

const SPLASH = 'title-splash';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super(SCENE.title);
  }

  preload(): void {
    if (!this.textures.exists(SPLASH)) this.load.image(SPLASH, assetPath(SPLASH));
  }

  create(): void {
    applyRegime('title');
    // SceneManager emits CREATE only after this method returns and promotes the scene from CREATING
    // to RUNNING. Publishing any earlier leaves a click-sized window where the button is enabled but
    // game.scene.isActive(title) is still false, so the bridge correctly rejects the intent.
    this.events.once(Phaser.Scenes.Events.CREATE, () => {
      snapshot.set({ ...snapshot.get(), view: 'title', titleReady: true });
    });
    this.cameras.main.setBackgroundColor(regimeCanvas().bg);
    // Title key art: cover-fit the splash to the viewport, behind the React title chrome overlay.
    if (this.textures.exists(SPLASH)) {
      const img = this.add.image(0, 0, SPLASH).setDepth(-10);
      const src = this.textures.get(SPLASH).getSourceImage();
      const fit = () => {
        this.tweens.killTweensOf(img);
        img.setPosition(this.scale.width / 2, this.scale.height / 2);
        const base = Math.max(this.scale.width / (src.width || 1), this.scale.height / (src.height || 1));
        img.setScale(base);
        // Slow Ken Burns drift — a gentle live-poster breathe on the menu (pure tween, menu-only; the
        // splash always cover-fills, so a ~6% zoom never reveals an edge). Presentation only.
        if (document.documentElement.dataset.reducedMotion !== 'true') {
          this.tweens.add({ targets: img, scaleX: base * 1.06, scaleY: base * 1.06, duration: 20000, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        }
      };
      fit();
      // A phone turned on the title resizes the game; cover-fit the splash to the new shape.
      this.scale.on(Phaser.Scale.Events.RESIZE, fit);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, fit));
    }
  }
}
