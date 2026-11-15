// Overworld level (view: level → overworld regime). A sunny placeholder stage: the regime
// flips to the daytime palette, a ground strip and a hero block stand in for real pixel art.
// This is a boot target, not the real platformer — it proves scene/regime/seeded-RNG wiring.

import Phaser from 'phaser';
import { applyRegime } from '@/regime/derive';
import { regimeCanvas } from '@/regime/canvas';
import { STRINGS } from '@/content/strings';
import { Rng } from '@/core/rng';
import { getEntity } from '@/entities/index';
import { SCENE } from './keys';

const RUN_SEED = 0x0c0ffee5; // placeholder run seed; real runs derive this from the save/replay.

export class OverworldScene extends Phaser.Scene {
  constructor() {
    super(SCENE.overworld);
  }

  create(): void {
    applyRegime('level');
    const { width, height } = this.scale;
    const c = regimeCanvas();
    const rng = new Rng(RUN_SEED);

    this.cameras.main.setBackgroundColor(c.bg);

    // Ground strip.
    this.add.rectangle(width / 2, height - 40, width, 80, c.accentInt, 1);

    // Hero stand-in (Fred) — pulled from the entity registry so the roster is the source.
    const fred = getEntity('playerCharacter.fred');
    this.add.rectangle(width * 0.2, height - 110, 40, 60, c.accentInt, 1);
    this.add
      .text(width * 0.2, height - 160, fred?.title ?? 'Fred', { fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: c.text })
      .setOrigin(0.5);

    // World label.
    this.add
      .text(width / 2, height * 0.18, STRINGS.world1, { fontFamily: 'system-ui, sans-serif', fontSize: '28px', fontStyle: '800', color: c.text })
      .setOrigin(0.5);

    // A few deterministic kernel-clouds, scattered with the SEEDED rng (never Math.random).
    for (let i = 0; i < 6; i++) {
      const x = rng.float(width * 0.1, width * 0.9);
      const y = rng.float(height * 0.25, height * 0.55);
      this.add.circle(x, y, rng.int(8, 18), c.accentInt, 0.5);
    }
  }
}
