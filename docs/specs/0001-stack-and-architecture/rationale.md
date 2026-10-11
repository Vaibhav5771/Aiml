# 0001. Adopt Expo and React Native with a serverless proxy for the vision call

Reasoning and evidence behind the decision. The build spec itself is in [index.md](index.md); `/develop` reads that file and skips this one.

The sections below are the original 2026-10-10 decision. The styling layer was changed on 2026-10-11; that reasoning has its own section further down, under [Revision, 2026-10-11](#revision-2026-10-11-the-styling-layer-changed).

## Context

> ⚠️ Premise note: the scope lists six foundation features that each want their own design pass, and under two weeks there is not room to run all of them properly before building starts. The failure mode is specific and common: you spend the first week writing specs and the second week discovering the screens do not behave on a real phone. Keep separate design passes only for feature 3 (the attribute vocabulary) and feature 4 (the Pune rule set), because those two are what make the verdict defensible and the brief turns on them. Fold feature 5 (data model) into feature 3, since a saved scan is just the attribute set plus the verdict that followed from it. Treat feature 6 (design system) as a tokens file transcribed from the Figma prompt you have already written, not a design system that gets specced. Features 2, 7, 8, 10, 11 and 12 go straight to `/develop`.

Recyclens photographs a piece of damaged or faded packaging, reads what is visible on it, checks that against written recycling rules for Pune, and shows a verdict with the reasoning behind it. The explanation is the product. A bare label would not satisfy the brief in `Researrch.md`, which asks for an assessment against predefined local guidelines with uncertain cases flagged for manual inspection.

The forces that actually shaped this choice:

- **Under two weeks, one person.** This is the dominant constraint. Every layer was chosen for shortest distance from empty folder to something running on a phone.
- **The developer writes TypeScript, React and Python, and has not shipped a mobile app.** Kotlin, Compose, CameraX and Room would be four unfamiliar systems learned at once, on a deadline.
- **One device, one user.** The app runs on the developer's own Android phone for a demo. Nothing goes to the Play Store and nobody else installs it.
- **A cloud vision service means a credential exists.** Anything shipped inside an installable app can be extracted from it. The developer chose a backend as a service rather than embedding the key.
- **The rules must be citable.** The scope requires each rule to carry the source it came from, and the verdict screen must name the rule that fired. That rules out asking a model for a verdict directly.
- **Zero budget.** An academic project with no spend approved.
- **Nothing exists yet.** No code, no `AGENTS.md`, not even a git repository.
- **Journey build approach, Beta tier.** One user path is finished completely before the next starts, and this feature gets `/check verify` then `/test`.

Not deciding is not an option here, because every other feature in the scope sits on top of this one and cannot start without it.

## Options considered

### Option 1: Expo and React Native in TypeScript, with a serverless proxy function

The app is React Native, run through Expo, which supplies first party modules for camera, SQLite and file storage. A single TypeScript function on a serverless host holds the vision API key and passes photos through. Scan history lives in SQLite on the phone; the Pune rules ship as a JSON file inside the app and the rule engine runs locally.

**Pros**:
- The developer is productive on day one, because it is the language and the component model they already write.
- Camera, SQLite, secure storage and file system are all first party Expo modules, confirmed current, so none of them is a research project.
- Expo Go gives live reload on a real phone in minutes with no build step.
- The proxy is one file in the same language as the app, so there is no second toolchain to learn.
- The rule engine is pure TypeScript over bundled JSON, so it unit tests with no device and no network, which is what the Beta tier needs.

**Cons**:
- A JavaScript bridge sits between the app and the camera, so anything Expo does not already wrap means dropping into native code.
- Serverless functions have a hard execution limit, and a vision call on a large photo can run close to it.
- React Native's performance ceiling is below native, which does not matter at five screens but would at fifty.
- Two deploy targets instead of one, even though one of them is a single file.

### Option 2: Native Android with Kotlin, Jetpack Compose, Room and CameraX

The real Android stack, currently Kotlin 2.4.21, Compose 1.12.1 and CameraX 1.6.2. Room for the local database, Retrofit for the network call, either directly to the vision API or through the same proxy.

**Pros**:
- Best camera control by a clear margin, and CameraX is genuinely good at the kind of capture this app needs.
- No bridge, no framework between you and the platform, and the best performance available.
- Carries the most weight with a reviewer judging it as an Android project.
- Room migrations are mature and well documented, which matters once feature 5 adds fields.

**Cons**:
- Four unfamiliar systems at once for a developer who does not write Kotlin, with under two weeks on the clock.
- Gradle build times alone would eat a meaningful share of the remaining days.
- The realistic outcome is a deadline spent learning rather than building, with the screens unfinished.

### Option 3: Flutter and Dart

A single Dart codebase with `camera` and `sqflite`, talking to the same proxy.

**Pros**:
- Excellent rendering control, which suits a custom warm visual language better than most options.
- Strong camera and local database packages, and very good performance.
- One language for the whole app with no bridge.

**Cons**:
- Dart is a third language the developer does not currently write, so the learning cost lands squarely on the deadline.
- No benefit here over option 1 that is worth that cost at this size.

### Option 4: Expo with no backend, key embedded in the app

Identical to option 1 with the proxy removed. The app holds the vision API key and calls the provider directly.

**Pros**:
- The simplest possible shape, with nothing to deploy and nothing that can be down during a live demo.
- One repository, one deploy target, one thing to reason about.
- No network hop added between the phone and the vision provider, so the scan is slightly faster.

**Cons**:
- The key ships inside the app and can be pulled out of it by anyone holding the build.
- An academic project is usually submitted with its source, so a key in the repository is a realistic leak rather than a theoretical one.
- Changing the vision provider later means shipping a new build rather than redeploying a function.

## Rationale

**Option 1, because the deadline and the developer's existing skills point the same way and nothing else outweighs them.** Two weeks is not enough to learn Kotlin or Dart and also finish journey 1 of the scope. Expo removes the three hardest setup problems for this specific app, camera, local database and file storage, by shipping all of them as first party modules that are confirmed current. The developer writes TypeScript already, so day one is spent on the verdict screen rather than on a build system.

**The proxy stays, in its lightest possible form.** The developer asked for a backend as a service, and option 4 was the recommendation before that answer. Under two weeks a heavy platform would be the wrong way to honour that choice, so the decision is a single TypeScript file on a serverless host: it keeps the key off the phone exactly as intended, it is the same language as the app, and it deploys in one command. The cost is one real risk worth naming, that a serverless function has a hard execution limit and a vision call on a large photo can approach it. That is why the photo is resized before it is sent and why the function's maximum duration is set explicitly rather than left at its default.

**The rule engine runs in the app, and that is what makes the project defensible.** The brief asks for an assessment against predefined local guidelines, and the scope requires each rule to carry its source. Asking the vision model for a verdict directly would have been far less code and would have destroyed exactly the property the project is being judged on. Keeping the engine in TypeScript beside the bundled rules also makes the highest risk logic in the app a set of pure functions, testable with no device and no network, which is what the Beta tier on this feature actually needs.

**Two choices went against the recommendation, and both are reasonable.** Claude was recommended for the vision call because its structured output mode guarantees the response matches a declared schema, which is precisely what feature 3 asks for, and because calibrated uncertainty is the hard part of this product. Gemini was chosen instead for its free tier, which on a zero budget academic project is a fair trade. Gemini has a response schema facility of its own, so the structure is still obtainable. The residual risk is narrow and specific, that a model's self reported confidence may not be well calibrated on the check manually path, and it has a concrete mitigation: the proxy validates the returned JSON against the attribute schema and rejects anything that does not match, and the rule engine treats a missing or low confidence attribute as a reason to say check manually rather than trusting the number the model reported. Zustand was chosen over plain hooks and context. It is slightly more machinery than an app this size needs, but it is small, it is well understood, and the load bearing principle survives either way: the database stays the source of truth and screens read a scan by its ID rather than having the object handed to them.

## Revision, 2026-10-11: the styling layer changed

The original decision above chose React Native's built in `StyleSheet` plus a single `src/theme.ts`, on the reasoning that it has zero build configuration to break. That has been replaced by NativeWind 5 over Tailwind CSS v4, and the warm eco visual direction has been replaced by an Apple inspired one. Both changes were already made in the code before this record was written, so this section documents what was decided and why, rather than reopening it.

### What changed

| | Before | After |
|---|---|---|
| Styling mechanism | `StyleSheet.create` at the bottom of each component file | Tailwind classes on the component, through NativeWind 5 and `react-native-css` |
| Token location | `src/theme.ts` | `src/global.css`, with `src/theme.ts` kept as a small mirror for colour props |
| Visual direction | Warm eco: `#FAF7F0` paper, `#1F4D36` forest green, Nunito Sans | Apple inspired: white and `#F5F5F7` surfaces, `#0062C4` blue, system type at the iOS scale |
| Build configuration | None | Metro plugin, PostCSS, `lightningcss`, and an `.npmrc` workaround |

### Why the styling mechanism changed

**The token file was the weak point, not the styles.** With `StyleSheet`, a token in `theme.ts` is only a token by convention. Nothing stops a component writing `#6E6E73` inline, and nothing catches it later. In `global.css` the token is the only way to name the colour, because `text-ink-soft` has no meaning unless the variable exists. The original row chose `StyleSheet` for having nothing to break, which was correct about the build and wrong about the discipline.

**The accessibility work pushed the decision.** The real driver was not ergonomics. It was that every Apple system colour had to be measured and corrected, and several had to be darkened until they passed 4.5:1. That is a set of values you expect to revise more than once, probably during the accessibility pass that sits in the scope's deferred list. In one CSS file a revision is one line and the whole app follows. Spread across a dozen `StyleSheet` blocks it is a hunt, and the kind of hunt that quietly misses one.

**The cost is real and was accepted.** This brings a build pipeline into a project that had none, and it brings it in at release candidate quality. It also already cost real time: `lightningcss` ships its platform binary as an optional dependency, a global `omit=optional` setting skipped it, and the failure surfaced as a missing `.node` module with no hint about the cause. The `.npmrc` in the repository is that scar. On a two week deadline this is the least boring choice in the stack, and it is the one most likely to cost a lost afternoon.

### Why the visual direction changed

**Apple's published palette does not pass its own accessibility bar at small sizes.** Apple's `#86868b` secondary text scores 3.62:1 on white, below the 4.5:1 that Apple's own guidance asks for, and the system accent greens, reds and oranges fail worse as small text. So the palette is Apple inspired rather than Apple's: every value was measured and darkened until it passed, and each carries its reasoning in a comment beside it in `global.css`.

**The type scale came with it.** The Figma prompt implies a web scale with a 48px hero. On a 360px wide Android phone that is not a hero, it is a wrapping mess. The app uses the iOS scale instead: 13 for labels, 17 for body, 28 for titles, 34 for the verdict.

**What this costs.** `docs/figma-prototype-prompt.md` and the three images in `screen-shots/` now describe an app that does not exist. They were the source the component layouts were built from, so they are worth keeping as history, but they are a trap for anyone reading the repository cold. A follow up in `index.md` hands that cleanup to feature 6.

### Options considered for the styling mechanism

**Option A: keep `StyleSheet` and enforce the tokens by review.** Zero new dependencies, nothing new to learn, and no build pipeline. Rejected because the enforcement is a person remembering, and on a one person two week project that person is busy. It also leaves a contrast revision as a file by file edit.

**Option B: NativeWind 5 over Tailwind v4, chosen.** One token file, classes on the component, and the setup path is documented for this exact Expo SDK by the `expo-tailwind-setup` skill. The cost is a build pipeline and two release candidate dependencies.

**Option C: a mature styling library such as Tamagui or Restyle.** Both are past release candidate quality and both centralise tokens properly, which is the actual goal. Rejected because each is a larger system to learn than the remaining schedule justifies, and because neither has a written setup path for this SDK the way the Tailwind route does.

**The honest summary.** Option A is what the boring technology rule in this spec would normally pick, and the record should say so plainly. It lost to the one force the rule does not cover: the palette is going to be revised for contrast, probably more than once, and Option A makes every one of those revisions a file by file hunt.

### What is deliberately not decided here

This revision records the styling **mechanism** and the **direction**, not the design system. The specific colour values, the component conventions, the three verdict treatments, the dark mode question and the tab bar question all belong to feature 6, which is still unbuilt. `global.css` currently holds working values so the scaffold renders; feature 6 owns whether they are the final ones.

## References

**Project sources** (verifiable, in this repo):
- `docs/scope/scope.md`: feature 1 and its done when condition, the Journey build approach, the Beta tier on this feature, and the deferred list that puts offline support and extra regions out of scope
- `Researrch.md`: the problem statement requiring assessment against predefined local guidelines with uncertain cases flagged
- `docs/figma-prototype-prompt.md`: the four screens journey 1 has to produce. Its colour, type and spacing values were superseded by the 2026-10-11 revision and no longer describe the app
- `package.json` and `.npmrc` (2026-10-11): the pinned styling versions, NativeWind `5.0.0-rc.0` and `react-native-css` `3.1.0-rc.0`, and the `include=optional` workaround for lightningcss
- `src/global.css` (2026-10-11): the measured contrast ratios behind each corrected colour, and the reasoning recorded beside each value
- The `expo-tailwind-setup` skill: the documented setup path for Tailwind v4 on Expo SDK 57 with react-native-css and NativeWind 5

**Practices and standards**:
- Proxy a credential rather than shipping it inside a distributable artifact
- Validate model output against a declared schema at the trust boundary, and treat a schema failure as a handled outcome rather than an exception
- Keep the highest risk logic as pure functions so it tests without a device or a network
- The database is the source of truth for screen state, so a fresh result and a reopened past scan take the same path through the code
- Resize an image to the resolution the consumer actually uses, rather than paying to upload pixels that get discarded
- Measure a colour against WCAG AA rather than trusting a published palette, including a palette published by a company known for its design
- Make a design token the only way to name a value, so using it is easier than bypassing it
- Carry a verdict with an icon and a word as well as a colour, so greyscale and colour blindness both still work

**Links** (web verified during the landscape check on 2026-10-10):
- Expo SDK 57 changelog: https://expo.dev/changelog/sdk-57
- Expo installation and project creation: https://docs.expo.dev/get-started/installation/
- expo-camera reference: https://docs.expo.dev/versions/latest/sdk/camera/
- Expo storing data, covering expo-sqlite, expo-secure-store and expo-file-system: https://docs.expo.dev/develop/user-interface/store-data/
- CameraX release notes: https://developer.android.com/jetpack/androidx/releases/camera
- Jetpack Compose release notes: https://android-developers.googleblog.com/2026/08/jetpack-compose-august-2026-release.html
- Gemini API pricing and free tier: https://ai.google.dev/pricing

No web check ran for the 2026-10-11 styling revision, because it documents a decision already made and already in the code. The NativeWind, react-native-css and Tailwind CSS v4 documentation is cited by name above rather than by URL, since no link to it was verified. The version facts in this revision come from `package.json` in this repository, not from memory.

## Evidence: landscape scan, 2026-10-10

A capped web check ran before the stack options were presented, so the versions below are current rather than remembered.

**Confirmed from official sources**:
- Expo SDK 57 is the current stable release, dated 30 June 2026
- `npx create-expo-app@latest` is the current way to start a project
- `expo-camera`, `expo-sqlite`, `expo-secure-store` and `expo-file-system` are all still the recommended modules for their jobs
- Expo Router is production ready and recommended for new apps
- Kotlin 2.4.21, released 8 October 2026
- Jetpack Compose 1.12.1, released 7 October 2026
- CameraX 1.6.2 stable, released 26 August 2026
- Gemini has a free tier with rate limits

**Not confirmed, treat with care**:
- The exact React Native version paired with Expo SDK 57. A blog gave 0.86, but this was not confirmed against official release notes. Check it when you scaffold.
- Whether React Native's New Architecture is now on by default in SDK 57.
- Current Claude vision model pricing was not confirmed by the scan. It did not affect the outcome, since Gemini was chosen.
