# Recyclens design system

The one place that answers what colour, size, spacing or radius to use, so you
never invent a value and never hunt for one.

**This file holds the direction and the rules. It holds no values.** Every
colour, type size, radius and duration lives in [`src/global.css`](../src/global.css),
which is the single source of truth. If you want a number, open that file. If
you want to know which number to reach for and why, stay here.

Decided in [spec 0002](specs/0002-design-system-ui-foundation/index.md).

## Character

Apple inspired, and deliberately so on an Android only build.

Content leads and chrome recedes. Surfaces are white and near white, the
accent is used sparingly, and nothing is decorated that does not need to be.
The product's claim is that you can read its reasoning and trust it, so the
visual language is built for legibility first: generous type, real whitespace,
and colour that carries meaning rather than mood.

Two things follow from that and they are worth stating plainly, because both
look like mistakes if you do not know they were chosen:

- **Apple styling on Android is a named tell** (Cross Platform Costume). It is
  allowed here as a deliberate, documented, platform neutral treatment. The
  treatment is consistent everywhere, which is what separates a choice from an
  accident.
- **Press feedback dims rather than ripples.** Android's idiom is a ripple.
  This app dims, everywhere, for the same reason. See *Press feedback* below.

## The build mandate

1. **Never write a value.** Not a hex code, not a font size, not a radius. If
   you need one that does not exist, add it to `src/global.css` and write down
   why. `npm run check:tokens` fails the build when a value sneaks in.
2. **Reach for a component before you write markup.** If the thing you are
   building exists in the inventory below, use it. If you are writing the same
   view a second time, it wants to be a component; a third time is already
   too late.
3. **Import from `@/tw`, never from `react-native`.** `View`, `Text`,
   `Pressable`, `ScrollView`, `SafeAreaView` and `Image` all come from there.
   The `react-native` original silently ignores `className`, with no error and
   no warning, which is a genuinely horrible afternoon.
4. **Nothing tappable is under 48dp**, in either dimension, ever.
5. **Nothing claims more certainty than it has.** A confidence renders neutral
   until something decides it has earned a colour.

## Colour

Values: `src/global.css`, the `@theme` block. A colours only mirror lives in
[`src/theme.ts`](../src/theme.ts) for the places React Native takes a colour
value rather than a class name, such as an icon's `color` prop. That mirror
carries colours and nothing else. It never grows to hold type, spacing or
radius.

Every value was measured against WCAG AA at 4.5:1 for small text. **These are
not Apple's published values.** Apple's own secondary text grey scores 3.62:1
on white and fails its own guidance, and every system accent fails badly as
small text, so each one here was darkened until it passed. If you change one,
measure it.

| Group | Tokens | For |
|---|---|---|
| Surfaces | `background`, `card`, `hairline`, `track` | the page, a card, a divider, an empty bar |
| Accent | `primary`, `accent` (the same value, two names) | actions, links, the focus ring, a citation |
| Text | `ink`, `ink-soft` | body copy, and anything secondary |
| Verdict | `verdict-ok`, `verdict-no`, `verdict-maybe` | the answer itself, never anything else |
| Verdict tints | `surface-*`, `edge-*` | the barely there wash behind a verdict |
| Note | `note-surface`, `note-edge` | the caveat row |

**One palette, always.** The app is locked to light in `app.json`
(`userInterfaceStyle: "light"`). Nothing in `src/` reads the system colour
scheme, and nothing should start. Someone who uses dark mode because they need
it gets a white screen, which is a real cost that spec 0002 accepted for the
deadline rather than claimed was fine.

### Colour is never the only signal

A verdict is carried by an icon **and** a word **and** a colour. Always all
three. Take a greyscale screenshot: if you cannot tell the three verdicts
apart, something is wrong.

This is not a thing to remember. It is a thing one file enforces:
[`src/components/verdict.ts`](../src/components/verdict.ts) holds one record
per verdict with its word, icon, tone, surface, edge and icon colour. Every
verdict surface reads from it, and no component keeps a copy.

## Type

Four sizes. Not five.

Each carries its own line height through Tailwind's `--<name>--line-height`
companion, so the two always travel together and **no file writes `leading-*`
by hand**. The scale is Apple's iOS scale, not the 48px web scale, because a
48px hero on a 360px phone is not a hero, it is a wrapping mess.

| Token | For |
|---|---|
| `text-label` | section labels, captions, chips, control labels |
| `text-body` | body copy, button labels, attribute values, titles in a bar |
| `text-title` | screen titles, the reading overlay |
| `text-verdict` | the verdict word, and nothing else |

Weight does the rest of the work: `font-normal`, `font-medium`,
`font-semibold`, `font-bold`. The Android system font ships all four, so they
cost nothing to load. A title is `text-body font-bold`, not a fifth size.

`allowFontScaling` is never set to `false`, anywhere, at any scope. Someone
whose phone is set to large text has set it for a reason. Prefer `min-h-` over
`h-` on anything containing words, and let rows reflow rather than truncate: a
wrapped line is readable, an ellipsis is not.

### Brand typography and warm surfaces

`font-display` (Bluu Next, bold only) and `font-inter` / `font-inter-bold`
(Inter) are loaded once in `src/app/_layout.tsx` and declared in
`src/global.css` beside the rest of the type tokens. They set the brand voice
for welcome/authentication and the signed-in Home, History and Result screens.
Its headline also carries its own size, `text-welcome-heading` (40px), bigger
than `text-title`, because the reference mock's two line "Recycle garbage"
only reads as a display headline at that size. Still not a fifth general
size: it is paired with `font-display` the same way `text-auth-heading` is
paired with it on sign-in and sign-up.
`--font-sans` still carries every other screen, for the reason recorded next
to it: the Android system font ships four weights for free, and `project.md`
records that this app deliberately ships no other webfont. Reach for these two
again only for another genuine brand moment, not as a general purpose face.

## Spacing

Tailwind's default 4px base, which is already right for Android, so nothing is
declared. What matters is which steps you use and what each one means.

| Step | Role |
|---|---|
| `1` | inside a tight pair, a label above its value |
| `2` | a row gap, between items on one line |
| `3` | the in between step, use it sparingly |
| `4` | card padding, the screen gutter, a group gap |
| `6` | a section gap, between blocks on a screen |
| `8` | the bottom of a scrolling screen |

**Hard rule: row gap `2` is smaller than group gap `4` is smaller than section
gap `6`.** A screen that uses one value for all three is wrong even though
every value is on the scale, because proximity stops telling you anything
about what belongs together.

## Radius

Each radius is named for the thing it belongs to, so choosing one is a
question about the content rather than about a number. Values in
`src/global.css`.

| Token | For |
|---|---|
| `rounded-bar` | the confidence bar |
| `rounded-tile` | icon tiles, the wordmark mark |
| `rounded-thumb` | photo thumbnails, camera control tiles |
| `rounded-card` | every card |
| `rounded-frame` | the camera viewfinder |
| `rounded-button` | pills |

`rounded-full` is for true circles only.

**No `borderCurve: "continuous"` anywhere.** It maps to an iOS layer property
and does nothing on Android, which is the only target. It is left out
deliberately, not forgotten, so please do not helpfully add it.

## Motion

Three durations: 150ms for a press or a toggle, 250ms for something entering
or leaving, 400ms for a whole surface.

Honest caveat: Tailwind v4 has no `--duration-*` theme namespace, so these
cannot generate utility names the way colours and radii do. They are recorded
as plain custom properties on `:root` in `src/global.css` and the code writes
the bare utility (`duration-150`, `duration-250`, `duration-400`). **There is
no `duration-fast` class and there cannot be one.** This is weaker than a real
token and it will tempt someone to write an arbitrary duration. Please do not.

### Press feedback

Two levels, and nothing tappable ships without one:

| Surface | Pressed |
|---|---|
| a solid or bordered surface (buttons, tiles, rows) | `active:opacity-85` |
| text or an icon with nothing behind it | `active:opacity-60` |

### Focus

One treatment: a 2px ring in the accent colour, drawn outside the control's
own border. Add the `focus-ring` class to anything interactive and you are
done. It is defined once in `src/global.css` and it is part of the component
contract rather than a per screen decision.

This is how someone using an attached keyboard or Switch Access knows where
they are. Without it they cannot move through the app at all.

## The component contract

Every component in `src/components/` answers all five of these, and fills in
only what a real screen actually needs.

| Part | The rule |
|---|---|
| **variant** | visual intent, only where two or more genuinely exist. `AppButton` has two. Most components have none. |
| **size** | `sm` to `lg`, default `md`, only where two genuinely exist. `IconTile` has sizes. `NoteRow` does not. |
| **state** | `default`, `pressed`, `focused`, `disabled`, and `loading` where an action can be in flight. Never a tappable element with no pressed state. |
| **className** | accepted, and merged **last** through `cn()`, so a caller can adjust layout without forking the component. |
| **accessibility** | a role and a label, always. `disabled`, `busy` and `selected` where they apply. An icon only control needs an explicit label, and that label has to survive the visible text being swapped for a spinner. |

Two rules that are easy to get wrong:

**Variants are literal class maps, never interpolation.** Write
`SURFACE[variant]` where `SURFACE` is a record of full class strings. Never
`` `bg-surface-${variant}` ``. Tailwind only sees class names written out
literally in the source, so the interpolated version produces no styles, no
error and no warning. `check:tokens` catches this shape.

**A caller reaching for `className` to change a colour means the variant set
is missing one.** Add the variant. `IconTile` already gained a third this way.

`cn()` lives in [`src/tw/cn.ts`](../src/tw/cn.ts). It registers our custom
font size and radius class names with `tailwind-merge`, which otherwise does
not know them and would silently keep both the component's class and the
caller's.

## The components

Values and behaviour live in the files; this is the map.

### Layout

| Component | What it is |
|---|---|
| `Screen` | the outer wrapper of every screen: background, flex column, safe area edges |
| `ScreenHeader` | the bar on a pushed screen: back control, title, optional right slot |
| `AppHeader` | the Scan screen's header: the wordmark, and the region whose rules apply |
| `SectionLabel` | the small uppercase heading above a block |

### Actions

| Component | What it is |
|---|---|
| `AppButton` | filled `primary` or outlined `secondary`. The reference implementation of the contract: every state including `loading`, and a name that survives the spinner |
| `LinkButton` | a text only action, padded out to 48dp rather than leaning on `hitSlop` |
| `IconTile` | a rounded square with an icon. `sm` 34px decorative, `md` 48px for inside a tappable control. Variants `quiet` (on a card), `soft` (on the background), `accent` (carrying the brand). Presentational: it never handles its own press |

### Content

| Component | What it is |
|---|---|
| `VerdictCard` | the answer. Reads everything visual from `verdict.ts` |
| `AttributeRow` | one observation: icon, caption, the read, and how sure it is |
| `ConfidenceBar` | the thin bar under an attribute |
| `RuleCard` | the rule that fired, and the source it came from |
| `NoteRow` | a caveat, so nothing on screen overclaims |

### States

| Component | What it is |
|---|---|
| `StateView` | one screen filling state: icon, title, explanation, up to two actions. Every non happy path is built from this |
| `LoadingOverlay` | the scrim over live content while the app is thinking |

### History

| Component | What it is |
|---|---|
| `VerdictPill` | a verdict at list size: icon, word and colour, in a tinted pill |
| `HistoryRow` | one past scan: thumbnail, item name, verdict pill, when it happened |

Feature 6 deliberately did **not** build these. There was no real history
screen to design them against, and a primitive invented ahead of its first
caller is a guess. Feature 11 built them against the real list.

`EmptyList` was never built, and deliberately so: `StateView` already renders
an icon, a title, an explanation and an action, which is exactly what an empty
list needs. History's empty state is a `StateView`, and a second component
wrapping the first would have been a name, not a design.

### A note on confidence colour

`ConfidenceBar` and the number beside it default to **neutral ink, not green**.

Before spec 0002 they were green unconditionally, so a 38% read rendered as a
reassuring green bar and quietly claimed a confidence the attribute did not
support. The `tone` prop exists so a confidence **can** be coloured correctly.
Feature 4 owns the thresholds that decide when it has earned one. Until then,
neutral says nothing rather than something false.

## The tab bar

Drawn by the JS `Tabs` navigator from `expo-router/js-tabs`, not `NativeTabs`.
The native one renders Material 3, which accepts almost no styling and went
dark against our light surfaces whenever the phone was set to dark.

Drawing your own tab bar is a named anti pattern (the Floating Pill Tab Bar)
and it is only safe here because of what is **not** on it: no margin, no
inset, no corner radius, no shadow, no elevation. It sits flush and full width
against the bottom with a hairline above it, and it owns the bottom safe area
inset. If you are tempted to float it, read the Consequences section of spec
0002 first.

## The drift check

```bash
npm run check:tokens
```

Runs in about a second. It fails when a colour, type size, spacing step or
radius lands in `src/` instead of in `global.css`, and it names the file and
the line.

**It is a grep, and it catches shapes, not meaning.** A class name that looks
like a token but was never declared (`text-huge`) passes the check and renders
nothing at all. Feature 2 can promote it into a real ESLint rule.

The allow list lives at the top of [`scripts/check-tokens.mjs`](../scripts/check-tokens.mjs).
Every entry carries a reason, and "it was quicker" is not one. The four
entries there today are all the same reason: the camera overlay colours sit
over live video rather than over an app surface, so they answer to the
photographed scene rather than to the palette. A palette value there would be
a lie about where the number came from.

## Known debts

Honest about what this system does not yet do:

- **Hairline borders on nearly every card** is on the anti pattern list
  (Wireframe Borders). They are kept deliberately: there are no shadows and
  the grey card sits on white, so they are doing real separating work. A
  different reviewer would make this call differently.
- **The result screen hand draws its header** instead of using the Stack
  header, which gives up back swipe and scroll to top. That is a named tell
  (the Hand Rolled Header). Feature 9 owns that screen and should revisit it.
- **`AttributeRow` and `RuleCard` are built on a vocabulary that
  `src/vision/types.ts` itself marks PROVISIONAL.** Features 3 and 4 settle
  it. Expect a second pass on both.
- **The app icon is still the Expo template artwork.** Replacing it is asset
  production, not a design decision, and it is queued in the scope.

  Spec 0002 asked for the Android adaptive icon background to become
  `--color-primary`. It did not, and here is the record of why: the template
  foreground is a **blue** chevron, so on the primary blue it all but
  disappeared. The spec named the fallback for exactly this case, so the
  background is `--color-card` instead, which the blue chevron reads against
  cleanly. The template's `android-icon-background.png` had to go from
  `app.json` as well, because a background image overrides the background
  colour and the colour would never have shown. Revisit all of this when a
  real Recyclens mark is drawn.
