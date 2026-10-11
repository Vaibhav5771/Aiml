# 0002. Extend the existing token layer into a full design system and UI foundation

**Date**: 2026-10-11
**Status**: In Progress

## Summary

Recyclens already has half a design system: tokens live in `src/global.css`, components are styled with Tailwind classes through the wrappers in `src/tw`, and eight components are in use on two screens. It drifted while those screens were built, so four declared type sizes became seven in practice and two declared corner radii became eight. This spec extends what is there rather than replacing it: it tightens the scales, gives every component one shared contract (how it handles variants, pressing, focus, disabling and screen readers), adds the few primitives the scan to verdict path keeps copying by hand, and adds a one second check that fails when a value sneaks in outside the system. It also settles the five questions spec 0001 handed forward: the app locks to light, the tab bar stops being the unstable native one, seven unused packages go, and the warm eco Figma prototype is marked as history.

## Requirements

**User stories**:

- As the person building features 8 through 12, I want one place that answers what colour, size, spacing and radius to use, so I never invent a value and never hunt for one.
- As the person building features 8 through 12, I want the pieces every screen repeats already built and shaped the same way, so I write a screen rather than reassemble its parts.
- As someone whose phone is set to a large text size, I want every screen to stay readable, so the app works for me rather than clipping its own words.
- As someone who uses an attached keyboard or Switch Access, I want to see what is focused, so I can move through the app at all.
- As someone who cannot distinguish red from green, I want each verdict to be identifiable, so the core answer of the product reaches me.

**Acceptance criteria**:

- **AC-1**: Every colour, type size, spacing step and corner radius used anywhere in `src/` resolves to a token declared in `src/global.css`. `npm run check:tokens` reports zero findings outside its written allow list, and every allow list entry carries a reason.
- **AC-2**: The type scale is exactly four sizes, each carrying its own line height, and no file in `src/` sets a font size any other way. The seven sizes in use today collapse to four.
- **AC-3**: Every interactive primitive declares variant, pressed, focused and disabled behaviour, exposes its accessibility role and label, and accepts a `className` that is merged last so a caller can adjust layout without forking the component.
- **AC-4**: Nothing tappable in the app is smaller than 48dp in either dimension.
- **AC-5**: With the Android font size set to its largest, the whole scan to verdict path is readable: no text clipped, no text truncated with an ellipsis, no control overlapping another. `allowFontScaling` is not set to false anywhere in `src/`.
- **AC-6**: Every interactive primitive draws a visible focus ring when it holds focus, confirmed on the real device with an attached keyboard or with Switch Access turned on.
- **AC-7**: Each of the three verdicts is identified by an icon, a word and a colour, all three read from one shared module, and each stays distinguishable from the other two in a greyscale screenshot.
- **AC-8**: The app renders identically whether the phone's system theme is light or dark, the bottom tab bar included. Nothing in the app reads the system colour scheme.
- **AC-9**: The bottom tab bar is drawn by the JS `Tabs` navigator from `expo-router`, sits flush and full width against the bottom of the screen respecting the safe area inset, carries no float, inset, shadow or pill shape, and draws its icons from the same Ionicons family as the rest of the app.
- **AC-10**: A single `StateView` primitive renders an icon, a title, an explanation and up to two actions, and the camera permission refused state is built from it rather than by hand.
- **AC-11**: `docs/design.md` documents colour, type, spacing, radius, motion, the component contract and every component in the system, and points at `src/global.css` for the values rather than restating them.
- **AC-12**: `package.json` lists no dependency that nothing in `src/` or `proxy/` imports. `npx expo-doctor` passes and the app cold launches on a real Android device afterwards.
- **AC-13**: The splash background and the Android adaptive icon background are palette values, and the icon foreground is still legible against the one chosen.
- **AC-14**: `docs/figma-prototype-prompt.md` and `screen-shots/` each carry a note saying they show a superseded direction, and when and why it changed.

## Decision

**Chosen option**: Option 1: Extend the existing token layer in place.

Keep `src/global.css` as the single source of truth and grow it, tighten the four scales, give every component one contract, build the six primitives the scan to verdict path needs, and enforce the result with a grep check rather than with goodwill.

**Implementation skills**: `expo-design-system` (`expo/skills`, `.agents/skills/expo-design-system/`) · `expo-native-ui` (`expo/skills`, `.agents/skills/expo-native-ui/`) · `expo-router` (`expo/skills`, `.agents/skills/expo-router/`) · `react-native-best-practices` (`callstackincubator/agent-skills`, `.agents/skills/react-native-best-practices/`) · `expo-tailwind-setup` (`expo/skills`, available through the Expo skill plugin)

## Feature design

### Token model

`src/global.css` stays the source of truth. `src/theme.ts` stays a mirror of colours only, and never grows to carry spacing, radius, type or duration.

**Colour: unchanged.** Every value in `global.css` was already measured against WCAG AA and carries its ratio in a comment. This spec adds nothing and changes nothing. One addition only: a focus ring reuses `--color-primary`.

**Type: four tokens, each carrying its line height.** Tailwind v4 pairs a size token with a `--<name>--line-height` companion, so the line height travels with the size and no file sets `leading-*` by hand.

| Token | Size | Line height | Weight in practice | Used for |
|---|---|---|---|---|
| `--text-label` | 13px | 18px | medium or semibold | section labels, captions, chips, control labels |
| `--text-body` | 17px | 24px | regular to bold | body copy, button labels, attribute values, titles in a bar |
| `--text-title` | 28px | 34px | bold | screen titles, the reading overlay |
| `--text-verdict` | 34px | 41px | bold | the verdict word, nothing else |

Migrations, all of them mechanical:

| In the code today | Becomes |
|---|---|
| `text-[19px]` (result bar title) | `text-body font-bold` |
| `text-[17px]` (wordmark) | `text-body font-bold` |
| `text-[13px]` (note row, rule source, camera helper) | `text-label` |
| `text-xs` (confidence chip, "Scanned item", control labels) | `text-label` |
| `text-xl` ("Reading the packaging...") | `text-title` |
| `leading-[20px]`, `leading-[24px]` | removed, the token carries it |

Four weights stay: regular, medium, semibold, bold. The system font supplies all four on Android, so none of them costs a file or a load.

**Spacing: Tailwind's default 4px base, with the allowed steps named and the roles kept distinct.** Nothing is declared in `@theme`, because the default base is already right for Android. What is declared is which steps exist and what each one means, because one padding value used at every level is a known tell that destroys proximity as a signal.

| Step | Value | Role |
|---|---|---|
| `1` | 4px | inside a tight pair, a label above its value |
| `2` | 8px | row gap, between items on one line |
| `3` | 12px | the in between step, use sparingly |
| `4` | 16px | card padding, screen gutter, group gap |
| `6` | 24px | section gap, between blocks on a screen |
| `8` | 32px | the bottom of a scrolling screen |

Hard rule: row gap `2` is smaller than group gap `4` is smaller than section gap `6`. A screen that uses the same value for all three is wrong even though every value is on the scale.

Migrations: `gap-[2px]` and `gap-[1px]` become `gap-1`, `py-[5px]` and `py-[3px]` become `py-1`, `gap-[6px]` becomes `gap-2`, `px-[10px]` becomes `px-3`, `mt-[1px]` is removed.

**Radius: five named plus the pill and the circle.**

| Token | Value | Used for |
|---|---|---|
| `--radius-bar` | 4px | the confidence bar |
| `--radius-tile` | 12px | icon tiles, the wordmark mark |
| `--radius-thumb` | 16px | photo thumbnails, camera control tiles |
| `--radius-card` | 18px | every card (kept from today) |
| `--radius-frame` | 24px | the camera viewfinder |
| `--radius-button` | 980px | pills (kept from today) |

`rounded-full` stays for true circles. Migrations: `rounded-sm` becomes `rounded-bar`, `rounded-xl` and `rounded-[10px]` become `rounded-tile`, `rounded-2xl` becomes `rounded-thumb`, `rounded-3xl` becomes `rounded-frame`.

Note on `borderCurve: "continuous"`, which the design system skill pairs with every non capsule radius: it maps to an iOS layer property and does nothing on Android. This build is Android only, so it is deliberately not applied, and `docs/design.md` says so rather than leaving it looking forgotten.

**Motion: three durations, and an honest caveat.**

| Name | Value | Used for |
|---|---|---|
| fast | 150ms | press, toggle |
| base | 250ms | something entering or leaving |
| slow | 400ms | a whole surface or screen |

Tailwind v4 has no `--duration-*` theme namespace, so these cannot generate utility names the way colours and radii do. They are declared as plain custom properties on `:root` in `global.css` for the record, and written in `docs/design.md`, and the code uses Tailwind's bare `duration-150`, `duration-250` and `duration-400`. That is weaker than a real token and it is named here so nobody later assumes a `duration-fast` class exists.

**Press feedback: two levels, both already in the code, now written down.**

| Surface | Pressed |
|---|---|
| a solid or bordered surface (buttons, tiles, rows) | `active:opacity-85` |
| text or an icon with no surface behind it | `active:opacity-60` |

Nothing tappable ships without one of these. A dimmed rectangle rather than an Android ripple is a deliberate, documented departure from the platform idiom, consistent with the Apple inspired direction, and `docs/design.md` records it as such.

**Focus: one treatment, on every interactive primitive.** A 2px ring in `--color-primary` drawn outside the control's own border. It is part of the component contract, not a per screen decision.

### Component contract

Every primitive in `src/components/` declares all five of these, and fills in only what a real screen needs:

| Part | Rule |
|---|---|
| **variant** | visual intent, only where two genuinely exist. `AppButton` has `primary` and `secondary`. Most components have none. |
| **size** | `sm` to `lg`, default `md`, only where two genuinely exist. `IconTile` has sizes. `NoteRow` does not. |
| **state** | `default`, `pressed`, `focused`, `disabled`, and `loading` where an action can be in flight. Never a tappable element with no pressed state. |
| **className override** | accepted and merged **last** through `cn()`, so a caller can add a margin without forking the component. A caller changing a component's colours means the variant set is missing one. |
| **accessibility** | role and label always. `disabled`, `busy` and `selected` where they apply. An icon only control needs an explicit label, and it must survive the label being replaced by a spinner. |

Variants are expressed as literal class maps, never by interpolation. Tailwind only sees class names written out in the source, so `bg-surface-${verdict}` produces no styles and no error. This is already the pattern in `verdict-card.tsx` and it becomes the rule.

`src/tw/cn.ts` provides the merge helper, built from the `clsx` and `tailwind-merge` already in `package.json`:

```ts
import clsx, { type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/*
 * tailwind-merge only knows Tailwind's own class names. Our custom tokens
 * (rounded-tile, text-verdict) are invisible to it, so without registering
 * them a className override silently loses to the component's own class.
 * Confirm the exact class group ids against tailwind-merge v3 before relying
 * on this; see the Follow-up item.
 */
const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': ['text-label', 'text-body', 'text-title', 'text-verdict'],
      rounded: [
        'rounded-bar', 'rounded-tile', 'rounded-thumb',
        'rounded-card', 'rounded-frame', 'rounded-button',
      ],
    },
  },
});

export const cn = (...inputs: ClassValue[]) => merge(clsx(inputs));
```

### Component inventory

Scoped by the Journey build approach: everything the scan to verdict path needs, nothing the history path needs.

**Retrofit, the eight that exist:**

| Component | File | What changes |
|---|---|---|
| `AppButton` | `src/components/app-button.tsx` | full contract: `disabled`, `loading`, focus ring, `className`. Minimum height 52px already clears 48dp. |
| `AppHeader` | `src/components/app-header.tsx` | tokens only. The 30px mark becomes a `sm` `IconTile`. |
| `AttributeRow` | `src/components/attribute-row.tsx` | tokens only. Data shape stays owned by feature 3. |
| `ConfidenceBar` | `src/components/confidence-bar.tsx` | tokens, plus a new `tone` prop. See the note below. |
| `NoteRow` | `src/components/note-row.tsx` | tokens only. |
| `RuleCard` | `src/components/rule-card.tsx` | tokens only. Data shape stays owned by feature 4. |
| `SectionLabel` | `src/components/section-label.tsx` | tokens only. |
| `VerdictCard` | `src/components/verdict-card.tsx` | reads its icon, word and colours from the shared verdict module instead of three private maps. |

A defect found while reading: `ConfidenceBar` fills in `bg-verdict-ok` and `AttributeRow` prints the confidence number in `text-verdict-ok`, both unconditionally. A 38% read therefore renders as a green bar and a green number, which quietly claims confidence the attribute does not support. Feature 6 adds a `tone` prop so the component **can** be coloured correctly and defaults it to the ink colour rather than green. The thresholds that pick a tone belong to feature 4, which owns the point where the app stops trusting a number.

**Build new, all needed by the scan to verdict path:**

| Component | File | Replaces | Shape |
|---|---|---|---|
| `verdict` | `src/components/verdict.ts` | three private maps in `verdict-card.tsx` | not a component. One record per verdict kind holding `word`, `icon`, `tone`, `surface` and `edge` class names. Every verdict surface reads it. |
| `Screen` | `src/components/screen.tsx` | three hand written `SafeAreaView` scaffolds | background, flex, safe area edges |
| `ScreenHeader` | `src/components/screen-header.tsx` | the hand built bar on the result screen | back control, title, optional right slot, title stays optically centred |
| `IconTile` | `src/components/icon-tile.tsx` | three inline copies at 30, 34 and 46px | `sm` 34px decorative, `md` 48px tappable. `variant` `quiet` or `accent`. |
| `LinkButton` | `src/components/link-button.tsx` | two inline text pressables | text only action, 48dp minimum, `active:opacity-60` |
| `StateView` | `src/components/state-view.tsx` | the hand built permission refused state | icon, title, explanation, up to two actions |
| `LoadingOverlay` | `src/components/loading-overlay.tsx` | the inline reading overlay | scrim, ring, title, sub line, over live content |

**Deferred to Journey 2**, when a real history screen exists to design against: `VerdictPill`, `HistoryRow`, `EmptyList`.

**The shell**, not a component but part of this feature: `src/app/(tabs)/_layout.tsx` moves from `NativeTabs` to the JS `Tabs` navigator. It sits flush and full width, carries no float, inset, shadow or pill shape, draws Ionicons, keeps both targets at 48dp, and owns the bottom safe area inset that `NativeTabs` used to handle.

### Value sourcing

Every visual value a surface shows, and where it comes from. The rows that matter are the ones where the answer was not already obvious.

| Surface | Value shown | Source |
|---|---|---|
| any component | colour, type size, spacing, radius | a token in `src/global.css` |
| any component | a colour passed as a prop rather than a class (an icon's `color`) | `src/theme.ts`, the colours only mirror |
| `VerdictCard`, and later the history pill | the word, the icon, the tone, the surface and edge classes | `src/components/verdict.ts`, one record per kind |
| `VerdictCard` | the overall confidence number | the `Scan` record, owned by features 3 and 4 |
| `ConfidenceBar` | fill width 0 to 1 | `confidenceFraction()` in `confidence-bar.tsx` |
| `ConfidenceBar` | fill tone | the new `tone` prop. **Default is the ink colour, not green.** The thresholds that choose a tone are decided by feature 4. |
| `AttributeRow` | icon per attribute key | the `ICONS` map in `attribute-row.tsx`, keyed off `AttributeKey`, which feature 3 owns |
| `StateView` | which icon, which words, which actions | named by the calling feature (8, 10, 11), never by feature 6 |
| tab bar | bar height | 48dp minimum plus the bottom safe area inset from `react-native-safe-area-context` |
| tab bar | active and inactive tint | `--color-primary` and `--color-ink-soft` through `src/theme.ts` |
| camera overlay | the scrim `#00000099` and the guide `#FFFFFFE6` | **not tokens, and deliberately so.** They sit over live video rather than over an app surface, so they answer to the camera image, not to the palette. Both go on the drift check allow list with this reason. |
| focus ring | colour and width | `--color-primary`, 2px |
| splash screen | background | `#FFFFFF`, matching `--color-background`, so there is no colour flash between splash and first screen |
| Android launcher icon | adaptive icon background | `#0062C4`, matching `--color-primary`. If the existing foreground artwork does not read against it, fall back to `--color-card` and record which was chosen. |

### Key invariants

1. `src/global.css` is the only file in which a colour, type size or radius value is written. `src/theme.ts` mirrors colours and nothing else.
2. No arbitrary Tailwind value in `src/` except an entry on the written allow list, and every allow list entry carries a reason.
3. Nothing tappable is under 48dp in either dimension.
4. `allowFontScaling` is never set to `false`, anywhere, at any scope.
5. Every verdict surface reads its icon, word and colour from `src/components/verdict.ts`. No component holds its own copy.
6. Nothing in the app reads the system colour scheme. There is one palette.
7. Every interactive primitive handles pressed, focused and disabled.
8. A class name is never built by interpolation. Variants are literal class maps.
9. Row gap is smaller than group gap is smaller than section gap, on every screen.
10. `View`, `Text`, `Pressable`, `ScrollView`, `SafeAreaView` and `Image` are imported from `@/tw`, never from `react-native`. Importing from `react-native` gives an unstyled component with no error and no warning.

### Security model

No new surface. This feature renders no data it did not already render, reaches no network, stores nothing and reads no permission it did not already hold. The one thing worth saying is that `StateView` will carry the camera permission copy, and that copy must keep saying plainly that a photo leaves the device, because the proxy means it does.

### Configuration required

No new environment variables. Four edits to `app.json` and one to `package.json`:

| File | Change | Why |
|---|---|---|
| `app.json` | `userInterfaceStyle`: `"automatic"` to `"light"` | one palette, and it removes a live bug where the Material tab bar goes dark against light surfaces. `expo-system-ui` is installed, which is what makes this setting take effect. |
| `app.json` | remove the whole `web` block | no web target |
| `app.json` | `expo-splash-screen` `backgroundColor`: `#208AEF` to `#FFFFFF` | a palette value, and no colour flash into the white first screen |
| `app.json` | `android.adaptiveIcon.backgroundColor`: `#E6F4FE` to `#0062C4` | a palette value. Confirm the foreground still reads against it on the device. |
| `package.json` | add `"check:tokens": "node ./scripts/check-tokens.mjs"` | the drift check |

### Critical test scenarios

- **Dark mode launch**: set the phone to dark, cold launch, walk scan to verdict. Every surface including the tab bar stays light. Verifies **AC-8**.
- **Largest font**: set Android font size to maximum, walk scan to verdict. Nothing clipped, nothing truncated, nothing overlapping. Verifies **AC-5**.
- **Focus walk**: attach a keyboard or turn on Switch Access, move through every control on the scan and result screens. Each one shows a ring. Verifies **AC-6**.
- **Greyscale**: screenshot each of the three verdicts and desaturate. Each stays identifiable from the icon and the word alone. Verifies **AC-7**.
- **Drift check, both ways**: `npm run check:tokens` exits zero on a clean tree, then add a deliberate `text-[19px]` and confirm it exits non zero and names the file and line. Verifies **AC-1**, **AC-2**.
- **Target measurement**: with the layout inspector, measure the smallest control on each screen. All at 48dp or above. Verifies **AC-4**.
- **Cold launch after cleanup**: `npx expo-doctor` passes, Metro starts clean, the app cold launches on the real device after the seven packages are removed. Verifies **AC-12**.
- **Override merge**: pass a conflicting `className` (for example `rounded-frame` onto a component whose own class is `rounded-card`) and confirm the caller's class wins. Verifies **AC-3**.

## Build plan

_Progress: `[x]` landed and self checked · `[~]` code landed, the confirmation on the
real device is still owed · `[ ]` not started. Updated by `/develop` on 2026-10-11._

Ordered by the project's Journey approach: finish everything the scan to verdict path needs, completely, and build nothing the history path needs. Within that, the token layer comes first because every later task depends on it, and the changes that can stop the app booting come last.

**Phase A, the token layer:**

1. [x] Extend `src/global.css`: four type tokens with their line height companions, the five named radii, the three duration custom properties on `:root`, and a comment block recording the allowed spacing steps and their roles. Satisfies **AC-1**, **AC-2**.
2. [x] Add `src/tw/cn.ts` with `extendTailwindMerge` registering the custom font size and radius class groups. Satisfies **AC-3**.
3. [x] Add `scripts/check-tokens.mjs` and the `check:tokens` script: fail on `text-[`, `bg-[#`, `border-[#`, `rounded-[`, `p-[`, `gap-[`, `leading-[`, and on the off scale `text-xs` and `text-xl`, with a short allow list carrying a reason per entry. Satisfies **AC-1**, **AC-2**.
4. [~] Set `userInterfaceStyle` to `"light"` in `app.json` and confirm on a phone set to dark that every surface stays light. Satisfies **AC-8**.

**Phase B, the shared verdict rule:**

5. [x] Add `src/components/verdict.ts` and move the icon, word, tone, surface and edge maps out of `verdict-card.tsx` into it. Satisfies **AC-7**.

**Phase C, the primitives the path keeps copying:**

6. [x] Build `Screen` and `ScreenHeader`, and replace the three hand written scaffolds and the result screen's hand built bar. Satisfies **AC-3**, **AC-4**.
7. [x] Build `IconTile` and `LinkButton`, and replace the five inline copies. The two tappable ones go to 48dp. Satisfies **AC-3**, **AC-4**.
8. [x] Build `StateView` and rebuild the camera permission refused state from it. Satisfies **AC-10**, **AC-3**.
9. [x] Build `LoadingOverlay` and replace the inline reading overlay on the scan screen. Satisfies **AC-10**.

**Phase D, retrofit the eight:**

10. [x] Retrofit `AppButton` to the full contract: `disabled`, `loading`, the focus ring, the `className` override. Satisfies **AC-3**, **AC-4**, **AC-6**.
11. [x] Retrofit the remaining seven to the new tokens, and give `ConfidenceBar` its `tone` prop defaulting to the ink colour rather than green. Satisfies **AC-1**, **AC-2**, **AC-7**.

**Phase E, the shell:**

12. [~] Replace `NativeTabs` with the JS `Tabs` navigator: flush, full width, safe area aware, Ionicons, 48dp targets, tinted from the tokens, no float and no shadow. Satisfies **AC-9**, **AC-4**.

**Phase F, the sweeps and the record:**

13. [ ] Walk scan to verdict at Android's largest font size. Convert fixed heights to minimum heights, remove fixed widths wrapping text, let rows reflow, until nothing clips. Satisfies **AC-5**.
14. [ ] Walk the same path with a keyboard or Switch Access and confirm every control rings. Satisfies **AC-6**.
15. [~] Remove `@expo/ui`, `expo-glass-effect`, `expo-symbols`, `expo-device`, `expo-font`, `react-native-web` and `react-dom`, and the `web` block from `app.json`. Run `npx expo-doctor` and cold launch on the device. Satisfies **AC-12**.
16. [~] Point the splash background and the adaptive icon background at palette values and confirm the foreground still reads. Satisfies **AC-13**.
17. [x] Write `docs/design.md`, pointing at `global.css` for values rather than restating them. Add a superseded header to `docs/figma-prototype-prompt.md` and a `README.md` to `screen-shots/`. Satisfies **AC-11**, **AC-14**.

## Migration plan

**Strategy**: fix in place, ordered so the app runs after every single task.

**Phases**:

1. **Add, remove nothing.** Phase A adds new tokens beside the existing ones. Every class in the code today still resolves. The drift check is written but not yet wired into anything that fails.
2. **Migrate component by component.** Phases B through D move one file at a time to the new tokens and the contract. The app is runnable after each file.
3. **Close the door.** Once no file uses an old name, the superseded values come out of `global.css` and `check:tokens` becomes the gate.
4. **Shell last.** Phase E and task 15 touch the navigator, `app.json` and the dependency list. These are the only changes that can stop the app booting, so they run when everything else is already proven.

**Rollback**: each phase is one commit on a branch. Phase 4 is the only one with a real failure mode. If Metro fails to resolve after the package removal, `npm install` of the named package restores it, and the removal can be retried one package at a time.

**Risks**:

- `tailwind-merge` does not know the custom token class names, so until the class groups are registered correctly a `className` override loses silently rather than erroring. This is the single most likely thing to be subtly wrong.
- `react-native-css` 3.1 is a release candidate. The `focus:` variant on a `Pressable`, and `transition` and `duration-*` utilities, are all assumed here and none is confirmed. The component contract already allows the focus ring to be driven by `onFocus` and `onBlur` state instead, which is the fallback.
- Removing `react-native-web` and `react-dom` could upset Metro's resolver even with no web target built, because Expo's default config still registers a web platform.
- Two currently correct screens get rewritten. Every edit is a chance to regress working code for no user visible gain.

## Consequences

**Positive**:

- One file answers every visual question, so feature 8 onward writes screens instead of inventing values.
- Seven type sizes become four and eight radii become six, which is the difference between a scale a reader perceives and a set of numbers nobody can recall.
- The verdict rule from spec 0001, icon and word and colour and never colour alone, stops being a thing to remember and becomes a thing one module enforces.
- The drift check turns the design system from a document into a gate. It runs in about a second and it is the only reason any of this survives features 8 through 12.
- Four hand copied patterns, the icon tile, the link button, the screen scaffold and the state screen, collapse into primitives before they are copied a fifth and sixth time.
- Large text and focus are handled now, while there are two screens, rather than during the deferred accessibility pass when there are six.
- Locking to light removes a real visual bug that is on your phone today.
- The dependency list finally describes the app, which makes `expo-doctor` output meaningful instead of noise.

**Negative and tradeoffs**:

- **Two working screens get rewritten with nothing to show a user for it.** This is the real cost of this feature and it is paid up front, during a two week build, before the vision call even exists.
- **`AttributeRow` and `RuleCard` are being hardened against a contract that `src/vision/types.ts` itself marks PROVISIONAL.** Features 3 and 4 own that vocabulary and have not run. Expect to touch both components again.
- **Replacing `NativeTabs` gives up genuinely native Android navigation for a bar you draw.** A hand drawn tab bar is a named anti pattern in your own design system skill, the Floating Pill Tab Bar. It is only safe because this spec pins it flush, full width, no inset, no shadow. Drift there and the tell becomes true.
- **Apple inspired styling on an Android only build is another named tell, Cross Platform Costume.** The skill allows it as a deliberate, documented platform neutral treatment, which is exactly what this spec makes it. A reviewer who does not read the documentation will still read it as a mistake.
- **A single light palette means a person who uses dark mode because they need it gets a white screen.** For an app used over bins and kitchen counters, often in poor light, that is a real cost rather than a theoretical one. It is accepted for the deadline, not because it is better.
- Hairline borders on nearly every card is also on the tell list, as Wireframe Borders. Here they are doing real work, because there are no shadows and the grey card sits on white, so they are kept deliberately and recorded as such. It remains a judgement call that a different reviewer would make differently.
- `--duration-*` is not a Tailwind v4 namespace, so the three motion values are documented numbers rather than real tokens. That is weaker and it will tempt someone to write an arbitrary duration.
- The drift check is a grep. It catches shapes, not meaning. A class name that looks like a token but is not declared passes the check and renders nothing at all.
- Four weights of the system font is one more axis of inconsistency than two would have been.
- Removing seven packages is the one task in here that can stop the app booting, and it is being done during a two week build for cleanliness rather than for function.

**Neutral**:

- Root `AGENTS.md` and `src/README.md` both still describe `StyleSheet` and `theme.ts` as the styling system. Both are wrong today and will mislead a build that reads them cold. `/sync` owns those files, not this spec.
- The Figma prompt and the three screenshots stay in the repository as marked history rather than being deleted, so the record of why the direction changed stays readable.
- The app icon is still the Expo template artwork. Changing it is asset production, not a design decision.
- `clsx` and `tailwind-merge`, installed and unused since the scaffold, finally have a job.

## Follow-up

- [ ] **Root `AGENTS.md` `## Rules` is actively wrong about styling.** It says every colour comes from `src/theme.ts` and that each `StyleSheet.create` belongs at the bottom of its component file. The real rule is that `src/global.css` holds the tokens, components are styled with classes, and `View` and `Text` come from `@/tw`. This misleads every build that reads it. Project wide, so it belongs in root `AGENTS.md`. `/sync` owns that file.
- [ ] `src/README.md` carries the same two stale lines in its folder table, does not mention `tw/` or `global.css`, and does not mention the component contract.
- [ ] `expo-design-system` and `expo-native-ui` are installed and now directly govern this project, and `expo-tailwind-setup` is the setup path this styling stack follows. None of the three is listed in root `AGENTS.md` `## Agent skills`. Styling applies to every component file, so they belong at root level.
- [ ] **`ConfidenceBar` and the confidence number currently render green at any confidence**, so a 38% read looks reassuring. This spec gives the component a `tone` prop and defaults it away from green. Feature 4 owns the thresholds that choose a tone and should set them.
- [ ] `src/vision/types.ts` is marked PROVISIONAL and `AttributeRow` and `RuleCard` are built on it. Features 3 and 4 settle that vocabulary. Plan for a second pass on both components.
- [ ] The result screen sets `headerShown: false` and hand draws its back control and title, which gives up back swipe and scroll to top and is a named tell, the Hand Rolled Header. Feature 9 owns that screen and should reconsider it against the Stack header.
- [ ] Confirm `react-native-css` 3.1 supports the `focus:` variant on a `Pressable`. If it does not, drive the focus ring from `onFocus` and `onBlur` state instead.
- [ ] Confirm the exact `tailwind-merge` v3 class group ids for font size and border radius before registering the custom tokens. Getting these wrong fails silently.
- [ ] Confirm whether `react-native-css` supports `transition` and `duration-*` utilities at all. The landscape check could not reach the repository. If it does not, press feedback stays instant and the three durations are documentation only.
- [ ] Whether `react-native-css` scales `rem` units under the system font setting is unconfirmed. This spec declares type in `px`, which React Native scales through `allowFontScaling` regardless, so nothing here depends on the answer. Worth knowing before any later work uses `rem`.
- [ ] The app icon is still the Expo template artwork. A drawn Recyclens mark, reusing the leaf in a rounded square that `AppHeader` already draws, is worth doing before the demo.
- [ ] Feature 2 (Coding standards and tooling) can promote `scripts/check-tokens.mjs` into a real ESLint rule once it runs.
- [ ] Spec 0001's follow up asks whether features 3 to 6 each get their own `/architect` run under the two week deadline. Feature 6 has now had one. Features 3, 4 and 5 are still open.

## Rationale

The problem space, the options weighed, the full drift inventory taken from the code, and the references: see [rationale.md](rationale.md).
