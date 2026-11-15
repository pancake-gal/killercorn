# KILLER CORN

The corn has gone bad.

KILLER CORN is a deterministic, kid-friendly 2D side-scroller: a Phaser fixed-step
simulation with React menu chrome, in TypeScript on Vite. Rescue the good produce,
dodge spiked corn, and take the fight to King Corn across an 18-stage campaign with
permanent crew powers, save/continue, and full keyboard/touch support.

## Run it

```bash
npm ci
npm run dev
```

Open `http://localhost:5300`.

Other commands:

```bash
npm run build     # typecheck + production build into dist/
npm run verify    # the standard verification command
npm run landing   # serve the landing page from docs/
```

## Design rules

No runtime AI. No unseeded randomness. No wall-clock simulation logic. Identical
starting state and input frames must reproduce the same run.

Kid-safe by design: cartoon menace only, no ads, no purchases, no accounts, no
tracking. Progress and high scores stay in the player's browser.

## License

Free to play, with open-source code. The code, including its story and interface
text, is licensed under [AGPL-3.0-only](LICENSE). Art and audio are not open
source: all rights reserved ([LICENSE-CONTENT](LICENSE-CONTENT)). Playing,
streaming, recording, and reviewing the game are always fine, including on
monetized channels, and you may build and run the game for your own private,
non-commercial use. Sharing the art or audio, or a changed version of the game
that uses them, needs written permission from `Pancake Gal`.

KILLER CORN™ and Pancake Gal™ are not covered by these licenses; modified versions
you share need their own name and their own art and audio ([TRADEMARK.md](TRADEMARK.md)). [NOTICE.md](NOTICE.md)
maps every license. Third-party components keep their own licenses; see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Bug reports and ideas are welcome. Outside code and art contributions are not
merged at this time.

Published by `Pancake Gal`.
