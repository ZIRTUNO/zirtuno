# Stack marks — S8, card 03

Third-party brand marks, used as a TOOL STACK on the "IA, Automação & Dados"
card: these are the platforms the studio builds on. They are not clients, not
work, and not claimed as either — the caption above them reads "agentes e
painéis", and the card's other neighbour on the row is where the work lives.
This is the same use the scale reference makes of them (upsunday.co fans the
Adobe suite on its Motion card).

The sixth tile in that fan is not from here: it is
`public/studio/avatar.svg`, the studio's own companion, generated from the
shipped kernel by `scripts/capture/studio-avatar.mjs`. Our agent standing in
front of the tools it is built on.

## Source

[svgl](https://svgl.app) — `https://svgl.app/library/<slug>.svg`.

| File          | svgl slug            | Colour                              |
| ------------- | -------------------- | ----------------------------------- |
| `figma.svg`   | `figma`              | #F24E1E #FF7262 #A259FF #1ABCFE #0ACF83 |
| `blender.svg` | `blender`            | #ff7021 #005385 #fff                |
| `n8n.svg`     | `n8n`                | #ea4b71                             |
| `openai.svg`  | `openai_dark`        | #fff (the on-dark mark)             |
| `claude.svg`  | `claude-ai-icon`     | #D97757                             |

## Rules

**Their colours, unaltered — owner's call (2026-09-10).** These marks ship in
full brand colour, not masked into cyan. That is a deliberate exception to the
site's one-hue rule, and the only place on the site where a colour outside the
cyan family is painted. Do not "harmonise" them: a recoloured trademark is both
less recognisable and less correct, and recognisability is the entire reason
the fan exists. Keep the tile GROUND neutral instead — near-black glass, not
the cyan-tinted glass the rest of the card uses — so five palettes have
something quiet to sit on.

An earlier pass masked all five into flat cyan for exactly the one-hue reason.
It is in git history if the decision is ever revisited.

**Symbols only.** The fan overlaps each tile by about a third, so a logotype
loses its first letters to the tile in front of it — Zapier was here for one
pass and read as "apier" from behind the centre tile, because the collection
in use then shipped its wordmark. Any replacement has to be a symbol.

**On-dark variants.** OpenAI is monochrome, so it must come from the on-dark
route (`openai_dark`) or it paints black on a black tile.

**TODO(owner):** the set is fixed by owner instruction (2026-09-10): OpenAI,
Claude, n8n, Blender, Figma, plus the companion. Changing one is a single line
in `STACK` in `components/chapters/StudioCards.tsx` plus its `.svg` here;
nothing else reads these files.
