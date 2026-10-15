# Brand capture — Recyclens

Captured 2026-10-14 by the `explore-design` skill (brand init). Re-run with
"rebrand the explorations" to adjust.

## Sources detected

| Source | Path | Role |
|---|---|---|
| Design system doc | [docs/design.md](../docs/design.md) | direction, rules, component contract — **holds no values by design** |
| Token file (authoritative) | [src/global.css](../src/global.css) | the single source of truth for colour, type size, radius, motion |
| Colour mirror | [src/theme.ts](../src/theme.ts) | colours only, for RN props that take a value not a className |

The code won where it could have disagreed with a doc, per brand-init step 1.
`docs/figma-prototype-prompt.md` and `screen-shots/` describe a **warm eco
palette the app deliberately no longer uses** — `src/global.css` records that
replacement explicitly, so those two were ignored as brand inputs.

## What was applied to the chrome

Light adaptation — the chrome is a quiet frame, not a copy of the app's surfaces.

- **Paper** `--bg: #f5f5f7` (the app's `--color-card`), `--paper: #ffffff` (`--color-background`). Cool neutral, matching the brand's temperature.
- **Ink** `#1d1d1f` (`--color-ink`), soft `#6e6e73` (`--color-ink-soft`).
- **Accent** `#0062c4` (`--color-primary`) on the eyebrow, letter badges, labels and links. This is Apple blue *darkened* to clear 4.5:1 — not Apple's published `#0071e3`.
- **Secondary accent** `#176b33` / `#f0f9f2` (`--color-verdict-ok`) on the "pick this if" block.
- **Risk accent** `#d70015` (`--color-verdict-no`).
- **Typeface** the platform system stack. Recyclens ships no webfont: `src/global.css` sets `--font-sans` per platform. The template's Fraunces + Plus Jakarta webfonts and their `<link>` tags were **removed**, not merely overridden.
- **Radii** `18px` cards (`--radius-card`), `12px` tiles (`--radius-tile`), `24px` the decision block (`--radius-frame`), `999px` pills (`--radius-button`).
- **Density** generous. Apple-inspired deference: content leads, chrome recedes.

Chrome stays light. The app is locked to a light palette (`app.json`,
`userInterfaceStyle: "light"`), and dark chrome is opt-in only.

## Constraints any implementation inherits

These come from `docs/design.md` and are not style preferences — they are
enforced by `npm run check:tokens`:

1. **Never write a raw value** in `src/`. Add it to `src/global.css` or do not use it.
2. **Four type sizes only**: `text-label` 13, `text-body` 17, `text-title` 28, `text-verdict` 34. Weight does the rest.
3. **Spacing rhythm**: row gap `2` < group gap `4` < section gap `6`.
4. **Colour is never the only signal** — every verdict carries icon + word + colour, from `src/components/verdict.ts`.
5. **Nothing tappable under 48dp.** `allowFontScaling` is never `false`.
6. **No `borderCurve: "continuous"`** — iOS-only, and this build is Android-only.
7. Import styleable components from `@/tw`, never `react-native`.
