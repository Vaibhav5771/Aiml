# 0002. Rationale

The reasoning behind [index.md](index.md). A build reads `index.md` only; this file is for a human, and for `/architect` on a later update.

## Context

> ⚠️ Premise note, three things worth saying before the reasoning.
>
> **The system is being derived from screens rather than the screens from a system.** Features 8 through 12 have not run, yet two of their screens are already built, and they were built from a Figma prototype whose visual direction spec 0001 then abandoned halfway through. That inversion is the direct cause of the drift this spec cleans up: four declared type sizes became seven, two declared radii became eight, and five arbitrary spacing values appeared. Nothing here is wrong in a way that hurts a user today, but it is why feature 6 opens with an audit rather than with a blank page.
>
> **Two of the eight components are being hardened against a contract that is explicitly provisional.** `src/vision/types.ts` says so in its own header: feature 3 owns the attribute vocabulary and feature 4 owns the rule shape, and neither has run. `AttributeRow` and `RuleCard` are built directly on those types. The right framing is to treat the presentation layer, which is tokens, the component contract, the screen scaffold, the state view and the verdict map, as the real product of feature 6, because none of it depends on features 3 or 4. The two data bound components get retrofitted to the tokens and nothing more, and their shape stays owned by the features that own the data.
>
> **Root `AGENTS.md` will actively mislead whoever builds this.** Its `## Rules` section still says every colour comes from `src/theme.ts` and that each `StyleSheet.create` belongs at the bottom of its component file. Both were true before the 2026-10-11 styling revision and neither is true now. Spec 0001 already raised it, feature 2 has not run, and a build that reads the context file cold will follow the wrong convention. This is tracked as the first follow up item, and `/sync` owns that file.

Recyclens is an Android only Expo app, built in two weeks by one person on a zero budget, for a demonstration on a real phone rather than a store release. Spec 0001 chose the stack and, on a same day revision, replaced React Native `StyleSheet` with NativeWind 5 over Tailwind v4 and replaced a warm eco visual direction with an Apple inspired one. That revision installed the token file, the wrapper layer and the measured colour palette, then explicitly handed the rest to feature 6: "the full design system, components and states, is feature 6."

What exists today is real but partial. `src/global.css` declares colours, four type sizes and two radii using Tailwind v4's `@theme`. `src/theme.ts` mirrors the colours for props that take a value rather than a class. `src/tw/index.tsx` wraps six React Native components so they accept `className`. Eight components sit in `src/components/`, and two screens use them. The colours were each measured against WCAG AA rather than copied from Apple as published, and carry their ratios in comments, which is better evidence than most design systems start with.

What is missing is everything that keeps a system a system. There is no spacing scale on record, so Tailwind's default silently governs and five arbitrary values have already appeared. There are no rules about how a component is shaped, so eight components have eight shapes: one has a `variant` prop, none handles `disabled` or focus, none accepts a layout override. Nothing stops the next screen from writing `text-[21px]`. The three verdicts are correctly told apart by icon and word and colour, but the mapping lives privately inside one component, so feature 11's history pill will inevitably write a second copy.

Five decisions were handed forward unresolved. `app.json` says `userInterfaceStyle: "automatic"` while `global.css` defines light values only and the root layout hardcodes a light navigation theme, so on a phone in dark mode the Material tab bar goes dark against light surfaces. `NativeTabs` is imported from `expo-router/unstable-native-tabs` and nobody has decided whether it stays. Seven installed packages are imported by nothing. `docs/figma-prototype-prompt.md` and the three images in `screen-shots/` describe the superseded warm eco direction and read as current. And the scope's own wording for feature 6 still says "eco and warm", contradicting the spec that overrode it.

The scope sets three conditions for this feature being done: a `design.md` covering colour, type, spacing and the core components; the three verdicts told apart by more than colour alone; and the base components surviving large text and keyboard focus. The third is the expensive one. Several components wrap text in fixed size containers, `allowFontScaling` is on and uncapped by default, and nothing in the app draws a focus state at all.

The consequence of not deciding is cheap to predict, because it already happened once. Four features (8 through 12) are about to build roughly ten more screen states against a system with no scale, no contract and no enforcement, in a codebase where the context file describes a different styling approach entirely.

## Options considered

### Option 1: Extend the existing token layer in place

Treat `src/global.css` as the source of truth, tighten the scales it already declares, add the missing ones, give the eight existing components one contract, and build only the primitives the scan to verdict path needs. Enforce it with a grep check.

**Pros**:
- It is what the `expo-design-system` skill prescribes in its own "Adopt Before You Build" section: when a system exists it is the source of truth, extended in its own idiom, and a second token set beside it is drift rather than adoption.
- The expensive and genuinely good work, measuring every colour for contrast, is already done and is kept.
- The app runs after every task, so there is no window where the build is broken.
- Smallest total diff of the three real options, which matters most on a two week clock.

**Cons**:
- Inherits the existing structure's shape, including a hand maintained colour mirror in `src/theme.ts` that has to stay in step with `global.css` by hand.
- Two currently working screens are rewritten with no user visible benefit, and every one of those edits can regress correct code.
- Cleaning up drift in place is less satisfying, and less visible, than a fresh system, so it is easy to stop halfway.

### Option 2: Build a parallel system and migrate screen by screen

Stand up a second, complete token set and component library beside the current one, move the scan screen to it, prove it, then move the result screen, then delete the old.

**Pros**:
- The strangler pattern, which is almost always right for migrating a live production system.
- Each screen's migration is independently reversible.
- The new system can be designed cleanly without being shaped by what the old one happens to do.

**Cons**:
- There is no live system to protect. Nothing is deployed, there are no users, and the whole app is two screens. The pattern's entire benefit is insurance against a risk that does not exist here.
- It requires exactly the thing the design system skill forbids: two competing token files coexisting, which is the definition of drift.
- With two screens, the parallel period costs more than the migration it de risks.

### Option 3: Rewrite the tokens and components from scratch

Delete `global.css` and the eight components, design the system properly on paper, and rebuild.

**Pros**:
- No inherited compromises and no half migrated state.
- The chance to fix the hand maintained colour mirror by reading tokens straight out of the CSS at runtime.
- Produces the cleanest possible `design.md`, written from the system rather than from the code.

**Cons**:
- Throws away the measured contrast work, which is the single most valuable thing in the current system and the slowest to redo.
- A big bang rewrite of the only two working screens in the app, during the week before the vision call is even built.
- The result would land in roughly the same place, because the existing palette and type scale are already the right answers.

### Option 4: Adopt a component library instead of hand building

Use `@expo/ui`, already installed, or a third party kit such as Tamagui or a headless library, and style it rather than writing primitives.

**Pros**:
- Accessibility, focus, pressed states and large text handling arrive solved rather than as work items.
- Far less code to write and maintain.
- `@expo/ui` is a first party Expo module, so it is a defensible choice on this stack.

**Cons**:
- `@expo/ui` draws Jetpack Compose components on Android, which are Material by construction, directly opposing the Apple inspired direction just chosen.
- It is a second styling system sitting beside NativeWind, which the design system skill explicitly forbids and which doubles the places a value can live.
- A third party kit on top of two release candidates (`nativewind@5.0.0-rc.0` and `react-native-css@3.1.0-rc.0`) stacks a third unknown onto a two week deadline.
- The app needs about ten components in total. A library is overhead at that size.

## Rationale

Option 1 wins on three specific forces from the context. The first is the skill's own adoption rule, which is authoritative here: a system exists, so it is extended in its idiom rather than replaced, and a second token file beside it would be drift by definition. The second is that the most valuable asset in the current system, a palette where every colour was measured rather than copied, is exactly what options 2 and 3 risk or discard. The third is the deadline. Two weeks, one person, the vision call not yet built, and features 3, 4 and 5 all still undesigned. The correct move is the smallest one that makes the next four features cheaper, not the most complete one.

Option 2 fails on a precise point rather than a general one. The strangler pattern buys safety during a migration of a system that people depend on. Nothing here is deployed and the app is two screens, so the pattern would cost a parallel token set, which the skill forbids, to insure a risk that does not exist.

Within option 1, the choices that carry the most weight are the ones that were genuinely close.

**Locking to a single light palette** was the most debatable. A full dark palette is the correct long term answer and a reviewer would expect it of something called a design system. It was rejected on cost: every colour would be re measured against a dark background, every verdict tint redone, and a camera overlay, a photo thumbnail and three surfaces all behave differently in the dark. For a demonstration on one phone it does not earn its price. The cost is real and is recorded in Consequences, because someone who uses dark mode for a reason gets a white screen in a kitchen at night.

**Replacing `NativeTabs`** was decided by three forces pointing the same way rather than by any one of them. It draws Material 3 while the chosen direction is Apple inspired. It is the one place in the app that cannot use the single icon family just chosen, since it takes Material names. And it is an `unstable` import on a stack already carrying two release candidates. Against that, it genuinely is native and it handles its own insets. The deciding factor is that there are two tabs and no native tab behaviour the app depends on, so the thing being given up is small and the thing being gained is consistency plus one fewer unstable API. The risk this creates, a hand drawn tab bar becoming the Floating Pill tell from the skill's anti pattern list, is pinned shut in the spec: flush, full width, no inset, no shadow, no pill.

**48dp over 44dp** is not close once the platform is named. Android's own minimum is 48dp, Android is the only target, and 48 satisfies Apple's 44 at the same time, so it is one number instead of two. The current code targets 44 because it was written to an Apple reference, which is the wrong reference for the only platform it ships to.

**Letting text scale freely and fixing the containers instead** follows the skill directly, which says to let labels wrap or reflow before reaching for a per element cap, and never to disable scaling. It is also the only version of this work that actually helps the person who turned the setting on. Capping chrome at 1.3 was the honest alternative and is cheaper, but it would have needed a written exemption for each cap, and with two screens the container work is small enough to just do.

**A grep check rather than an ESLint rule** is a deliberate compromise. Feature 2 owns lint and tooling and is the proper home for a real rule, but feature 2 has not run and will not run before features 8 through 12. A ten line script that exits non zero today is worth more than a correct rule that arrives after the drift it was meant to prevent. The spec hands the promotion to feature 2 as a follow up.

**Keeping `src/theme.ts`** is the one place the boring answer beat the better one. `src/tw/index.tsx` already exports a `useCSSVariable` hook that reads a token straight out of the CSS at runtime, and `metro.config.js` already has `inlineVariables` off, which is what makes that hook work. Using it everywhere would delete the hand maintained mirror and remove a negative that spec 0001 recorded. It was not chosen because it is a release candidate API whose failure mode is an icon rendering with no colour rather than an error, and because the mirror is forty lines that work today. The cost, two files kept in step by hand, is bounded and is written into the invariants as a cap: colours only, never spacing or radius or type.

**The system font** was settled by the research rather than by taste. NativeWind 5 needs one font file and one theme entry per weight, with no fallback and no weight selection. The app uses four weights. That is four files and four chances for a weight to resolve to something unintended, on a release candidate stack, in exchange for a typeface most people will not name. A custom face is the cheapest thing that stops an app looking like a template, which is a real argument, and it is the one piece of the warm eco direction worth regretting.

Two named anti patterns from the skill are being accepted deliberately rather than avoided, and both are recorded in Consequences so the choice is visible. Apple inspired styling on an Android only build is the Cross Platform Costume tell, which the skill permits as a deliberate, documented, platform neutral treatment. Hairline borders on nearly every card is the Wireframe Borders tell, kept here because there are no shadows and a grey card on white needs an edge to read as a surface. Both are judgement calls a different reviewer would make differently.

## Drift inventory

Taken from `src/` on 2026-10-11, before any change. This is the evidence behind the scale decisions.

**Type sizes in use: seven, against four declared.**

| Value | Where |
|---|---|
| `text-label` 13 | `section-label`, `attribute-row`, `app-header`, `verdict-card` |
| `text-body` 17 | most body copy and button labels |
| `text-title` 28 | `history.tsx`, the permission refused state |
| `text-verdict` 34 | `verdict-card` |
| `text-[19px]` | `screens/result`, the bar title |
| `text-[17px]` | `app-header`, the wordmark |
| `text-[13px]` | `note-row`, `rule-card`, `screens/scan` helper text |
| `text-xs` 12 | `verdict-card` chip, `screens/result` caption, `screens/scan` control labels |
| `text-xl` 20 | `screens/scan`, the reading overlay |

Line heights are set by hand with `leading-[20px]` and `leading-[24px]` in four files.

**Radii in use: eight, against two declared.** `rounded-card` 18, `rounded-button` 980, `rounded-full`, `rounded-3xl` 24, `rounded-2xl` 16, `rounded-xl` 12, `rounded-[10px]`, `rounded-sm` 4, plus `rounded-tl-[10px]` and its three corner siblings on the camera framing guides.

**Spacing: no scale declared at all.** Tailwind's default 4px base silently governs. Arbitrary values already present: `gap-[2px]`, `gap-[1px]`, `gap-[6px]`, `px-[10px]`, `py-[5px]`, `py-[3px]`, `mt-[1px]`.

**Raw colours outside the token system:** `bg-[#00000099]` and `bg-black` (the camera scrim), `border-[#FFFFFFE6]` (the framing guides), `text-[#FFFFFFD9]` (the overlay sub line), `text-white`, and in `app.json` the splash `#208AEF` and the adaptive icon `#E6F4FE`.

**Duplicated inline patterns:** an icon tile at three sizes (30px in `app-header`, 34px in `attribute-row` and `rule-card`, 46px in `screens/scan`), a text only pressable twice (`screens/scan` gallery link, `screens/result` retake link), and a `SafeAreaView` screen scaffold three times.

**Tappable targets below 48dp:** the result screen back control at 44px, the `ControlButton` tile at 46px, and both text only pressables which rely on `min-h-[44px]`.

**Component contract coverage, before:** one component of eight has a `variant` prop, none handles `disabled`, none handles `loading`, none draws a focus state, none accepts a `className` override.

**Named anti pattern tells present** (from `.agents/skills/expo-design-system/references/native-slop.md`): #11 The Hand Rolled Header, on the result screen, which sets `headerShown: false` and redraws the bar. #9 Wireframe Borders, kept deliberately, reasoned about above. #16 Cross Platform Costume, kept deliberately. #19 The Spinner Blink, a full screen `ActivityIndicator` while the camera permission resolves, which `StateView` and `LoadingOverlay` are the fix for. Not present and worth noting: no emoji icons, no gradients, no `TouchableOpacity`, no downloaded font, no heavy shadows, no press scale on list rows.

**Defect found, not drift:** `ConfidenceBar` fills with `bg-verdict-ok` and `AttributeRow` prints the confidence number in `text-verdict-ok`, both unconditionally, so a 38% read renders green. This quietly contradicts the scope's requirement that nothing on screen claims more certainty than the attributes support.

## References

**Project sources** (verifiable, in this repository):

- [Spec 0001](../0001-stack-and-architecture/index.md), the 2026-10-11 styling revision: NativeWind over Tailwind v4, `global.css` as the one token file, the Apple inspired direction, the measured palette, and the hard rule that a verdict is never carried by colour alone. Its follow up list is where the five open questions this spec closes came from.
- [`docs/scope/scope.md`](../../scope/scope.md), feature 6's intent and its three done when conditions, and the Journey build approach that orders the build plan.
- The `expo-design-system` skill (`expo/skills`, `.agents/skills/expo-design-system/`): the "Adopt Before You Build" rule that made option 1 the right shape, the five part component contract, the spacing, typography, radius and motion scales, the Dynamic Type guidance, and `references/native-slop.md`, the named anti pattern list used in the drift inventory above.
- The `expo-native-ui` skill (`expo/skills`, `.agents/skills/expo-native-ui/`): platform styling, semantic colours, and the shadow syntax rule.
- `src/global.css` and `src/tw/index.tsx` as the existing token and wrapper layer, and `metro.config.js` for the `inlineVariables` and `globalClassNamePolyfill` settings that the `useCSSVariable` option depended on.
- Root `AGENTS.md`: the Android only target, the Expo Go workflow, and its instruction not to answer Expo questions from training data, which is why the landscape check ran.

**Practices and standards**:

- WCAG 2.1 AA contrast, 4.5:1 for small text. Already applied to every colour in `global.css`, which is why the palette is unchanged here.
- WCAG 1.4.1 Use of Color: never identify something by colour alone. This is the basis for the shared verdict module.
- WCAG 2.2 SC 2.5.8 Target Size (Minimum), 24 CSS pixels. The weakest of the three target rules, cited for completeness; the 48dp decision comes from the platform rule, not this one.
- Material 3 minimum touch target, 48dp. Apple Human Interface Guidelines minimum touch target, 44pt. The spec takes the stricter of the two.
- The strangler pattern, considered and rejected as option 2 for the reason given above.

**Links** (web verified during this spec's landscape check, 2026-10-11, for a human to follow; no later step refetches them):

- Expo SDK 57 app config, for `userInterfaceStyle` and its dependency on `expo-system-ui`: https://docs.expo.dev/versions/v57.0.0/config/app/
- NativeWind 5 custom fonts, the one file and one theme entry per weight constraint that settled the font decision: https://www.nativewind.dev/v5/guides/custom-fonts
- Tailwind CSS v4 theme variables, for the `@theme` namespaces and the `--text-*--line-height` companion syntax: https://tailwindcss.com/docs/theme
- React Native `Text`, for `allowFontScaling` and `maxFontSizeMultiplier` defaults: https://reactnative.dev/docs/text
- Expo Router native tabs, confirming `NativeTabs` is still unstable in SDK 57 and which styling props it accepts: https://docs.expo.dev/router/advanced/native-tabs/

Three things the check could not confirm, each carried as a follow up in [index.md](index.md): whether `react-native-css` 3.1 supports the `focus:` variant on a `Pressable`, whether it supports `transition` and `duration-*` utilities, and how it treats `rem` units under the system font scale.
