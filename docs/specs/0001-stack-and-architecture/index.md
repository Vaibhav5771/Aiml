# 0001. Adopt Expo and React Native with a serverless proxy for the vision call

**Date**: 2026-10-10
**Revised**: 2026-10-11, the styling layer moved from React Native `StyleSheet` to NativeWind, and the visual direction moved from warm eco to Apple inspired
**Status**: Accepted

## Summary

Recyclens is built as an Expo app in TypeScript, running on React Native, because you already write TypeScript and have under two weeks. The photo never goes straight to the vision service. It passes through one small function you own on Vercel, so the API key stays off your phone. The Pune recycling rules ship as a JSON file inside the app and the rule engine runs locally in TypeScript, which is what keeps the verdict citable rather than a model's opinion. Scan history lives in SQLite on the phone, with the photos as files beside it.

Screens are styled with NativeWind, which lets you write Tailwind classes on a React Native component, and every colour, radius and type size is declared once in `src/global.css`. The look is Apple inspired rather than the warm eco direction the Figma prompt describes, and the colours were each measured for contrast rather than copied from Apple as published.

## Decision

**Chosen option**: Option 1: Expo and React Native in TypeScript, with a serverless proxy function.

Build the app with Expo SDK 57 and React Native in TypeScript, put a single TypeScript function on Vercel between the phone and Gemini, and keep both the recycling rules and the rule engine inside the app.

**Revised on 2026-10-11**: the styling rows below replaced the original choice of React Native `StyleSheet` plus a single `src/theme.ts`. The core decision, Expo plus a proxy plus a local rule engine, is unchanged. Why the styling changed is in [rationale.md](rationale.md).

**Implementation skills**: `expo-project-structure` (`expo/skills`, `.agents/skills/expo-project-structure/`) · `expo-router` (`expo/skills`, `.agents/skills/expo-router/`) · `expo-design-system` (`expo/skills`, `.agents/skills/expo-design-system/`) · `expo-native-ui` (`expo/skills`, `.agents/skills/expo-native-ui/`) · `expo-dev-client` (`expo/skills`, `.agents/skills/expo-dev-client/`) · `gemini-api-dev` (`google-gemini/gemini-skills`, `.agents/skills/gemini-api-dev/`) · `react-native-best-practices` (`callstackincubator/agent-skills`, `.agents/skills/react-native-best-practices/`) · `expo-tailwind-setup` (`expo/skills`, available through the Expo skill plugin, not under `.agents/skills/`)

## Proposed stack

| Layer | Choice | Reason |
|---|---|---|
| Language | TypeScript | The language you already write, which is the single biggest factor under a two week deadline. |
| App framework | Expo SDK 57 on React Native 0.86.3 | Camera, SQLite, secure storage and file system all arrive as first party modules, so none of them costs you research time. |
| Navigation | Expo Router, routes under `src/app` | Ships with `create-expo-app` and is the current recommended default. The bottom bar uses `NativeTabs` from `expo-router/unstable-native-tabs`, which draws real Material 3 navigation on Android. That API is marked unstable and accepts only limited styling, so feature 6 decides whether it stays. |
| Dev workflow | Expo Go on your real Android phone | Live reload on a real device in minutes with no build step. Move to a development build only if you later need a native module Expo Go does not carry. |
| Camera and gallery | `expo-camera`, with `expo-image-picker` for the gallery path | Feature 8 requires both capture and picking an existing photo, and these are the current recommended modules for each. |
| Image preprocessing | `expo-image-manipulator`, long edge about 1568px, JPEG quality 0.8 | Reading a faded symbol is the whole product, so resolution is the wrong place to economize. Above roughly this size the major vision models stop gaining, so larger uploads cost you time and buy nothing. |
| App to proxy contract | HTTPS POST, JSON body with the image as base64 | One fetch, one JSON response, replayable with curl when something breaks. The vision APIs want base64 anyway, so the function passes it through without re-encoding. |
| Vision proxy | One TypeScript function on Vercel, in its own `proxy/` folder | The lightest form of the backend you asked for. Same language as the app, deploys in one command, and the key never leaves it. |
| Vision provider | Google Gemini via `@google/genai` version 2.3.0 or newer | Chosen for the free tier on a zero budget project. Note that `@google/generative-ai` is deprecated and most tutorials still use it. |
| Secrets | The Gemini key exists only as a Vercel environment variable | Nothing secret ships in the app. The app holds only the public proxy URL, through an `EXPO_PUBLIC_` variable. |
| Rules storage | A JSON file bundled in the app | Works with no network, sits in version control where you can diff it, and each rule carries its own source citation as a field. |
| Rule engine | Pure TypeScript functions in the app, beside the rules | Keeps your highest risk logic testable with no device and no network, and keeps the verdict traceable to a named, cited rule. |
| Local database | `expo-sqlite` | Real rows for scan history, so delete, reopen and list all behave properly, and feature 5 can add fields later through a simple migration. |
| Photo storage | `expo-file-system`, with the path stored in the scan row | Keeps the database small and list rendering fast. Deleting a scan removes the row and the file together, which feature 12 requires. |
| State | Zustand, with SQLite as the source of truth | Screens read a scan by its ID rather than being handed the object, so a fresh result and a reopened past scan take the same path through the code. |
| **Styling** | **NativeWind 5 over Tailwind CSS v4, with `src/global.css` as the one token file** | **Classes sit on the component, so a screen reads top to bottom instead of jumping to a style block at the bottom of the file. Tailwind v4 declares every token with `@theme` inside that one CSS file, so a contrast fix is one line and every screen picks it up. There is no `tailwind.config.js` in v4.** |
| **Styling runtime** | **`react-native-css` 3.1, the engine NativeWind 5 runs on. Both are release candidates** | **This is the one genuinely risky choice in the stack, and it is taken knowingly. It is the setup path the `expo-tailwind-setup` skill documents for Expo SDK 57 with Tailwind v4, so it is the supported combination rather than an improvised one, but a bug in a release candidate is yours to work around.** |
| **className wiring** | **Hand written wrappers in `src/tw`, with `globalClassNamePolyfill` turned off in `metro.config.js`** | **`react-native-css` does not patch React Native's components globally. Each component you want to style is wrapped once in `src/tw` and imported from there. `inlineVariables` is also off, because inlining breaks `PlatformColor` used inside a CSS variable.** |
| **Colour values in JS** | **`src/theme.ts`, a small mirror of the colours in `global.css`** | **Some React Native props take a colour value rather than a class: an icon's `color`, and the navigation theme. Those read `theme.ts`. `global.css` is the source of truth and both files say so; change one, change the other.** |
| **Design language** | **Apple inspired, light only, the iOS type scale (13 / 17 / 28 / 34), contrast measured against WCAG AA** | **This replaced the warm eco direction in `docs/figma-prototype-prompt.md`. Apple's published values were not copied as given, because several fail as small text: `#86868b` secondary text scores 3.62:1 on white against a 4.5:1 bar. Every value in `global.css` was darkened until it passed and carries that note beside it. The full design system, components and states, is feature 6.** |
| **Native build dependency** | **`include=optional` pinned in `.npmrc`, and `lightningcss` pinned to 1.30.1 through `overrides`** | **Tailwind v4 needs `lightningcss`, which ships a platform specific binary as an optional dependency. A global npm config carrying `omit=optional` skips it and the build dies with a confusing missing `.node` module error. The repo level `.npmrc` restores optional dependencies for this project only.** |
| Testing | Jest on the logic only, test files colocated beside their source | The rule engine is pure functions over bundled JSON, so it tests fast with no device. Screens are proved by `/check verify` driving the real app instead. |
| Lint and format | `expo lint`, the ESLint and Prettier setup Expo ships | Nothing to configure. Feature 2 installs it rather than this spec. |
| Observability | None. A React error boundary plus typed error states | A single user demo does not justify a crash reporting service. Feature 10 designs what each error state looks like. |
| Hosting | Vercel for the function. The app runs through Expo Go | No Play Store, no app signing, no release pipeline for a demo on your own phone. |

## Project layout

From the official `expo-project-structure` skill, which is authoritative here, with this app's own folders added as siblings under `src/`. Note that routes live under `src/app`, not a root level `app/`, and that `@/*` aliases to `./src/*`.

```
assets/
proxy/                      the Vercel function, its own package.json
  api/vision.ts
src/
  app/                      Expo Router routes only, nothing else
    _layout.tsx
    (tabs)/
      _layout.tsx
      index.tsx             Scan
      history.tsx           History
    result/[id].tsx         the verdict screen, found by scan id
  screens/                  screen bodies that the route files render
  components/               verdict-card.tsx, attribute-row.tsx, kebab-case names
  db/                       schema and queries over expo-sqlite
  rules/                    pune.json, engine.ts, engine.test.ts
  vision/                   the client that calls your proxy
  store/                    the Zustand store
  hooks/
  tw/                       className enabled wrappers. Import View, Text and the
                            rest from '@/tw', never from 'react-native'
  global.css                the design tokens. The source of truth for colour,
                            radius and type size, declared with Tailwind's @theme
  theme.ts                  a small JS mirror of the colours, for props that take
                            a value rather than a class
  constants.ts
app.json
metro.config.js             NativeWind wired into Metro
postcss.config.mjs          Tailwind v4 through PostCSS
nativewind-env.d.ts         generated types. Commit it, do not edit it
.npmrc                      include=optional, so lightningcss gets its binary
package.json
```

## Contracts

The attribute vocabulary itself belongs to feature 3. This spec pins only the shape of the pipe, so the walking skeleton in feature 7 can be built before that vocabulary is final.

**App to proxy**: `POST /api/vision`, body `{ "image": "<base64 jpeg>", "mimeType": "image/jpeg" }`.

**Proxy to app**: HTTP 200 with `{ "attributes": { ... } }`, where the attributes object matches the schema feature 3 defines. On any failure the proxy returns a non 200 with `{ "error": "<machine readable code>" }` rather than a partial result, so the app has one clear path for every failure.

**Two rules that hold regardless of what feature 3 decides.** The proxy validates the model's response against the declared attribute schema and refuses anything that does not match, rather than passing a malformed object to the app. The rule engine treats a missing attribute, or one whose confidence is below the threshold feature 4 sets, as a reason to return check manually, rather than trusting a number the model reported about itself.

**One styling rule that holds for every screen.** A verdict is carried by an icon and a word and a colour, never by colour alone, so a colour blind reader and a greyscale screenshot both still work. Feature 6 may change the colours. It may not drop the icon or the word.

## Consequences

**Positive**:
- You are productive on day one rather than day five, because nothing here is a language or a framework you have to learn first.
- Camera, local database and file storage, the three hardest setup problems for this app, are all solved by first party modules confirmed current today.
- Expo Go puts a running app on your real phone within minutes, which matters when the camera is the input to everything.
- The Gemini key never ships inside the app, which is the entire reason the proxy exists.
- The rule engine is pure functions, so the Beta tier's test requirement is cheap to satisfy and the logic most likely to be wrong is the logic best covered.
- Changing vision provider later is a redeploy of one file, not a new app build.
- A colour or radius change is one line in `src/global.css` and every screen picks it up, instead of a hunt through a dozen `StyleSheet` blocks.
- Each colour carries its measured contrast ratio in a comment beside it, so the accessibility pass sitting in the scope's deferred list starts from evidence rather than from a repaint.

**Negative and tradeoffs**:
- **The serverless execution limit is the real risk in this design.** A Gemini vision call on a large image can take several seconds and Vercel's default function timeout is short. You must set `maxDuration` explicitly and confirm what the free tier actually allows. If a vision call cannot fit inside it, your fallback is calling Gemini directly from the app, which gives up exactly the key safety the proxy exists for.
- **The styling layer is pre release.** NativeWind `5.0.0-rc.0` and `react-native-css` `3.1.0-rc.0` are both release candidates. A bug there is yours to work around on a two week deadline, which is the opposite of the boring and proven rule the rest of this stack follows. It is accepted because it is the documented Expo SDK 57 path for Tailwind v4, and because the blast radius is styling rather than the vision call or the rule engine.
- There is now a build pipeline where there was none. Metro, PostCSS and `lightningcss` all have to resolve before the app will start, and that already failed once with an error message that did not explain itself. The `.npmrc` in this repo is the fix for that specific failure.
- **Importing `View` or `Text` from `react-native` instead of `@/tw` silently gives you an unstyled component with no error and no warning.** This is the easiest mistake to make in this codebase and it will happen.
- Tailwind only sees class names written literally in the source, so a computed class such as `bg-surface-${verdict}` produces no styles at all and no error. Components use explicit class maps instead, which is more code than interpolation would be.
- Colours now live in two files, `global.css` and `theme.ts`, kept in step by hand.
- A live demo now depends on the function being reachable and the network being up. Without the proxy there was nothing to be down.
- Two deploy targets and two `package.json` files instead of one.
- Gemini's free tier is rate limited. A demo that scans repeatedly can be throttled at the worst possible moment, so build your demo photo set in advance rather than relying on live scans.
- A model's self reported confidence is not calibrated, and this product displays those numbers prominently. They have to be treated as a signal that feeds a rule, never as truth.
- Expo Go runs a different binary from a real build, so a few behaviours will differ from a shipped APK, and you cannot add any native module without first moving to a development build.
- No crash reporting means that if the app crashes on your phone during the demo, you have nothing to debug from afterwards.
- React Native's performance ceiling is below native. Irrelevant at five screens, but it is a real ceiling.
- The warm eco direction in `docs/figma-prototype-prompt.md` and the three images in `screen-shots/` now describe an app that does not exist. Until feature 6 replaces them, they are a trap for anyone reading this repository cold.

**Neutral**:
- Expo Router's file based routing is a pattern to learn, though a small one.
- The `src/app` layout comes from the official Expo skill and differs from many tutorials, which put `app/` at the repository root. Follow the skill.
- Tailwind v4 has no `tailwind.config.js`. Tokens are declared with `@theme` inside `src/global.css`, which is a change from every Tailwind tutorial written before v4.
- `nativewind-env.d.ts` is generated and committed. Do not edit it by hand.
- The type scale is Apple's iOS scale, 13 for labels through 34 for the verdict, not the 48px web scale the Figma prompt implies. A 48px hero on a 360px wide phone wraps.
- Vercel's free tier is for non commercial use. An academic project qualifies.
- Photos leave the device and pass through infrastructure you operate, which changes the privacy picture from the scope's original assumption.

## Follow-up

- [ ] Verify the maximum function duration available on Vercel's free tier and set `maxDuration` explicitly in the function config. If a Gemini vision call cannot fit inside it, decide between a different host and calling Gemini directly from the app.
- [ ] Confirm whether React Native's New Architecture is on by default in Expo SDK 57. The paired React Native version is now settled at 0.86.3 by `package.json`; the New Architecture question from the original landscape scan is still open.
- [ ] Rotate the Gemini key before you submit the project, and confirm it never entered git history.
- [ ] **Root `AGENTS.md` still says every colour comes from `src/theme.ts` and that each `StyleSheet.create` belongs at the bottom of its component file. Both are now wrong.** The real rule is that `src/global.css` holds the tokens and components are styled with classes from `@/tw`. This is a project wide convention, so it belongs in root `AGENTS.md` under `## Rules`. `/sync` owns that file, not this spec.
- [ ] `src/README.md` carries the same two stale lines in its folder table, and does not mention `tw/` or `global.css`.
- [ ] **`docs/figma-prototype-prompt.md` and `screen-shots/` describe the superseded warm eco palette.** Feature 6 should replace the prompt with the real design language and mark the three screenshots as historical rather than current, so a later build does not read them as the target.
- [ ] The `expo-tailwind-setup` skill is the setup path this styling stack follows, and it is not referenced in root `AGENTS.md`. Styling applies to every component file, so it belongs at root level, not in a nested `AGENTS.md`.
- [ ] `expo-native-ui` is installed at `.agents/skills/expo-native-ui/` and is now directly relevant, since it covers Apple HIG styling, semantic colours and SF Symbols. It is not in the governing list in root `AGENTS.md`.
- [ ] **Seven packages are installed that nothing in `src/` imports**: `@expo/ui`, `expo-glass-effect`, `expo-symbols`, `clsx`, `tailwind-merge`, `expo-device` and `expo-font`. `react-native-web` and `react-dom` are also unused on an Android only build, and `app.json` still declares a `web` output. Decide which of these feature 6 actually wants and drop the rest, so the dependency list matches the app.
- [ ] **`app.json` sets `userInterfaceStyle: "automatic"`, but `global.css` defines light values only and the root layout hard codes `DefaultTheme` and `StatusBar style="dark"`.** On a phone in dark mode the Material 3 tab bar follows the system and goes dark while every other surface stays light. Feature 6 decides: either set `userInterfaceStyle` to `light`, or add a dark palette.
- [ ] `NativeTabs` comes from `expo-router/unstable-native-tabs`. The API is marked unstable and styles only within what Material 3 allows. Feature 6 decides whether to keep it or swap it for the fully styleable JS `Tabs` navigator.
- [ ] Expo Router supports server API routes (`+api.ts`) that could host the vision proxy inside this same codebase. Not chosen here because it requires deploying the Expo web output, which is more setup than a standalone function under this deadline. Worth revisiting if the proxy grows beyond one call.
- [ ] The privacy and camera note sitting in the scope's deferred list matters more now that photos pass through a service you operate. Worth doing before anyone other than you uses the app.
- [ ] The premise note in `rationale.md` recommends collapsing the remaining foundation design passes to fit two weeks. Decide which of features 3 to 6 get their own `/architect` run. Note that the styling revision has already made part of feature 6's decision for it.

## Rationale

Reasoning, the options weighed, the references and the landscape scan evidence: see [rationale.md](rationale.md). The 2026-10-11 styling revision has its own section there.
