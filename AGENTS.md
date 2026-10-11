This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

This build targets **Android only**, run through Expo Go on a real device. There is no iOS target, no web target and no Play Store release. Check spec 0001 before adding work for another platform.

## Stack

- **Language / Runtime**: TypeScript, React Native 0.86.3, React 19.2.3
- **Framework**: Expo SDK 57 with Expo Router. Routes live in `src/app`, and `@/*` maps to `./src/*`
- **Key dependencies**: `expo-router` today. Decided by spec 0001 and installed just in time by the feature that needs each one: `expo-camera`, `expo-image-picker`, `expo-image-manipulator`, `expo-sqlite`, `expo-file-system`, `zustand`
- **Package manager**: npm, but always add packages with `npx expo install` so versions stay SDK compatible
- **Vision**: Google Gemini via `@google/genai` 2.3.0 or newer, reached only through the `proxy/` function, never directly from the app
- Mirrors [spec 0001](docs/specs/0001-stack-and-architecture/index.md), which is the source of truth. Do not let this section drift from it.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Build approach

**Journey**: finish one complete user path, states and polish included, before the next one starts. Mirrors the header of `docs/scope/scope.md`.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

**Not in use yet.** Spec 0001 runs this build through Expo Go on a single device, with no store release and no over the air updates. Treat the section above as guidance for when that changes, and do not set up build profiles unless you are asked to.

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

- Functions are pure by default: same input, same output, no side effects. Push side effects (network, database, file system) to the edges and keep them explicit.
- Data is immutable. Use `const` and `readonly`, never mutate in place, and keep module level variables constant.
- Prefer plain functions over classes, and `map`/`filter`/`reduce` over imperative loops where it reads better. Avoid `null`; use explicit `undefined` in a union.
- For an expected failure return an explicit error value rather than throwing. The proxy already works this way: every failure is `{ error: "<code>" }` and never a partial result.
- Comments explain **why**, not what. Name which feature owns a placeholder, so a later build reading the file cold does not have to guess.
- Never put a secret behind `EXPO_PUBLIC_`. Anything with that prefix is baked into the app bundle and readable by anyone holding the build. The Gemini key lives only as an environment variable on the proxy.
- Every colour, type size, spacing value and radius comes from `src/theme.ts`. Keep each `StyleSheet.create` at the bottom of its own component file, and put each test beside the file it tests.

## Specs

Stored in `docs/specs/`, as `docs/specs/NNNN-title/index.md`. The reasoning sits beside it in `rationale.md`; a build reads `index.md` only. The feature plan lives in `docs/scope/scope.md`.

## Agent skills

- [expo-overview](.agents/skills/expo-overview/): `expo/skills`, the entry point for any Expo or EAS task. Load it first, it routes to the right `expo-*` skill.
- [expo-project-structure](.agents/skills/expo-project-structure/): `expo/skills`, where a file belongs in this layout. Authoritative over habit.
- [expo-router](.agents/skills/expo-router/): `expo/skills`, routes, groups, tabs, modals and headers.
- [expo-design-system](.agents/skills/expo-design-system/): `expo/skills`, design tokens and component conventions. Feature 6 needs this one.
- [gemini-api-dev](.agents/skills/gemini-api-dev/): `google-gemini/gemini-skills`, the Gemini TypeScript SDK, structured output and image input. For the proxy.
- [react-native-best-practices](.agents/skills/react-native-best-practices/): `callstackincubator/agent-skills`, performance, list rendering and re-render problems.

Three collections are installed under `.agents/skills/`, 39 skills in all. The bullets above are the ones that govern this project; `expo-overview` routes to the rest.

## Context files

- [proxy/AGENTS.md](proxy/AGENTS.md): the vision proxy. A different runtime and deploy from the app, and the only place a secret lives.
