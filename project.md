# Recyclens

An Android app that tells you whether a piece of damaged or faded packaging is recyclable where you live, and shows you the reasoning behind the answer instead of just handing you a label.

You photograph a yogurt tub. The app reads what it can see — the material, whether there is a recycling symbol and whether it survived, whether two materials are joined, how clean it is, how good your photo was — then applies a written, cited rule to those observations and tells you what to do with it. If it cannot stand behind an answer, it says so.

The region is Pune, India. The target is a single Android phone running Expo Go. There is no iOS build, no web build, and no store release.

## What makes it different

Most recycling apps hand you a label and ask you to trust it. The claim here is narrower and more defensible:

- **The verdict is traceable.** Every answer carries the rule that produced it and the document that rule came from. The rules are data in a file you can read and diff, not logic buried in code.
- **The model observes, it does not decide.** Gemini is asked only for named observations with a confidence on each. The decision is made locally by a pure TypeScript function over a bundled rule set. A model's opinion never becomes a verdict on its own.
- **"I cannot tell" is a real answer.** Four stop checks run before any rule. A poor photo, an unidentifiable material, two materials joined together, or heavy food residue all halt the decision rather than producing a confident guess.
- **Nothing claims more certainty than it has.** Confidence is the weakest of the attributes the decision actually rested on, never an average that lets a sharp photo prop up an unreadable label.

## How the pieces fit

```
   phone (Expo Go)                  Vercel                Google
┌────────────────────┐         ┌──────────────┐      ┌──────────┐
│  camera / gallery  │         │              │      │          │
│         ↓          │  HTTPS  │  proxy/api/  │      │  Gemini  │
│  resize to ~1568px │ ──────► │  vision.ts   │ ───► │  vision  │
│         ↓          │  base64 │              │ ◄─── │          │
│  six attributes    │ ◄────── │  holds the   │      └──────────┘
│         ↓          │   JSON  │  API key     │
│  src/rules/ engine │         └──────────────┘
│  (local, pure)     │
│         ↓          │
│  verdict + cited   │
│  rule on screen    │
└────────────────────┘
```

The proxy exists for one reason: the Gemini key lives on a server you own, never in the app bundle. Anything shipped inside an installable app can be pulled back out of it.

The rule engine runs on the phone, over a JSON file bundled with the app. That is what keeps the verdict available offline and traceable to a named source.

**The proxy contract** — never a partial result, every failure is one machine readable code:

```
POST  { "image": "<base64 jpeg>", "mimeType": "image/jpeg" }
200   { "itemName": "...", "note": "...", "attributes": { ...six } }
4xx   { "error": "<code>" }
```

## Stack

| Layer | Choice |
|---|---|
| Language | TypeScript |
| App | Expo SDK 57 on React Native 0.86.3, React 19.2.3 |
| Navigation | Expo Router, routes under `src/app`, `@/*` maps to `./src/*` |
| Styling | NativeWind 5 over Tailwind CSS v4, tokens in `src/global.css` |
| Styling runtime | `react-native-css` 3.1, with hand written wrappers in `src/tw` |
| Camera | `expo-camera`, plus `expo-image-picker` for the gallery path |
| Vision | Google Gemini via `@google/genai`, reached only through `proxy/` |
| Rules | A bundled JSON file plus pure TypeScript functions, in `src/rules/` |
| Proxy | One TypeScript function on Vercel, its own package and deploy |
| Dev workflow | Expo Go on a real Android device |
| Package manager | npm, but always add packages with `npx expo install` |

The reasoning behind every row, including the options rejected, is in [spec 0001](docs/specs/0001-stack-and-architecture/index.md). Treat that spec as the source of truth; this table is a summary of it.

## Repo layout

```
src/
  app/              Expo Router routes ONLY. Every file here is a screen.
    _layout.tsx
    (tabs)/         Scan + History
    result/[id].tsx the verdict screen, found by scan id
    result/unsaved  the same screen for a scan the database could not keep
    photo.tsx       the full screen photo viewer, a modal route
    dev-scan.tsx    throwaway, proves the vision chain. Feature 8 deletes it
    dev-data.tsx    throwaway, proves the data layer. Feature 11 deletes it
  screens/          screen bodies that the route files render
  components/       the shared UI pieces, kebab-case filenames
  rules/            pune.json + the engine. Pure, no I/O, no device needed
  ml/               the learned second opinion: features, scorer, model.json
  db/               the SQLite schema, migrations and row mapping
  store/            the Zustand store
  vision/           the attribute vocabulary, the proxy client, mock scans
  tw/               className enabled wrappers. Import View/Text from here
  global.css        the design tokens, declared with Tailwind's @theme
  theme.ts          a small JS mirror of the colours, for props taking a value
  constants.ts
proxy/              the Vercel function. Its own package.json, tests and deploy
docs/
  scope/scope.md    the feature plan and what state each feature is in
  specs/            one folder per decision: index.md is the contract,
                    rationale.md is the reasoning beside it
  design.md         what colour, size, spacing and radius to use
scripts/            check-tokens.mjs, check-photoset.mjs
```

`src/hooks/` is reserved by spec 0001 and still empty. Everything else above exists.

## Running it

**You need:** Node, an Android phone with [Expo Go](https://expo.dev/go) installed, and a USB cable. Android Studio is optional — only if you would rather use an emulator than a real device.

```bash
npm install
cp .env.example .env     # then fill in EXPO_PUBLIC_PROXY_URL
npx expo start
```

Scan the QR code with Expo Go, or if the phone is on USB:

```bash
adb reverse tcp:8081 tcp:8081
adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081" host.exp.exponent
```

`adb reverse` is what lets the phone reach Metro on your machine's `localhost`. Without it the app will not find the dev server over USB.

You can jump straight to a route with a deep link, which is handy for screens that sit behind a camera flow:

```bash
adb shell am start -a android.intent.action.VIEW \
  -d "exp://127.0.0.1:8081/--/result/demo" host.exp.exponent
```

`result/demo` and `result/uncertain` are the two mock scans in `src/vision/mock.ts`.

Two throwaway dev routes are reachable the same way and are the quickest way to exercise the
layers without a camera. `dev-scan` reports each stage of the vision chain separately, and
`dev-data` seeds, lists, reopens and deletes real rows through `expo-sqlite`.

If Expo Go opens on "Something went wrong" or "Failed to download remote update", warm the
bundle from your machine first, then force stop it and launch again:

```bash
curl -s -o /dev/null "http://127.0.0.1:8081/.expo/.virtual-metro-entry.bundle?platform=android&dev=true"
adb shell am force-stop host.exp.exponent
```

**The proxy** is a separate deploy with its own folder, package and environment:

```bash
cd proxy
vercel            # first deploy, links the project
vercel --prod
```

Set `GEMINI_API_KEY` in the Vercel project settings, set the root directory to `proxy` so Vercel does not try to build the Expo app as a website, and put the resulting function URL into the app's `.env`.

## Checks

| Command | What it does |
|---|---|
| `npx tsc --noEmit` | typecheck |
| `npx expo lint` | lint |
| `npm test` | the `node:test` suites: `src/db/`, `src/ml/`, `src/rules/`, `src/screens/result/`, `src/vision/`. 189 tests, no device needed |
| `npm run check:tokens` | fails when a raw colour, size, spacing or radius lands in `src/` |
| `npm run check:photoset` | runs the vision photo set against a deployed proxy. Spends Gemini quota |
| `npx expo-doctor` | diagnose dependency and config issues |

Run lint and typecheck before calling anything done. The proxy has its own suite, run from inside `proxy/` with `npm test`.

`npm test` covers pure logic only. There is no component renderer and no end to end runner, which is a deliberate choice recorded in `test-preferences.json`. Screens are proved by driving the real app on a device with `/check verify`.

## Where the thinking lives

Four kinds of document, each with one job:

- **[docs/scope/scope.md](docs/scope/scope.md)** — the feature plan. Thirteen features across Foundation, Skeleton, two Journeys and the learned stage, each with what "done" means and which boxes are ticked. Start here to see where the build is.
- **[docs/specs/](docs/specs/)** — one folder per load bearing decision. `index.md` is the contract, with numbered acceptance criteria; `rationale.md` beside it holds the reasoning and the options rejected. A build reads `index.md` only.
- **[docs/design.md](docs/design.md)** — the design system. What colour, type size, spacing and radius to use, and the component contract. Token values live in `src/global.css`, never in a component.
- **[AGENTS.md](AGENTS.md)** — the context AI tools load, mirroring the above. `CLAUDE.md` is a thin pointer to it.

## Where the build actually is

| # | Feature | Phase | State |
|---|---|---|---|
| 1 | Stack & architecture | Foundation | done |
| 2 | Coding standards & tooling | Foundation | done |
| 3 | Packaging vision read | Foundation | proxy written and unit tested; the deploy and the photo set are outstanding and need your Vercel account and Gemini key |
| 4 | Local recycling rule set | Foundation | done, verified on device |
| 5 | Data model | Foundation | built; save, list, reopen and delete all confirmed on a real device, surviving a cold restart. The orphan sweep and the induced failure paths are still unproven |
| 6 | Design system & UI foundation | Foundation | tokens, components and the JS tab bar built; the large text and focus sweeps still need the phone |
| 7 | Walking skeleton | Skeleton | written and unit tested, waiting on the feature 3 deploy for its one real run |
| 8 | Capture a photo | Journey 1 | planned, and the next thing to build |
| 9 | The verdict screen | Journey 1 | built and driven on device; four accessibility sweeps still need developer options unlocked on the phone |
| 10 | Waiting and failure states | Journey 1 | planned |
| 11 | Scan history list | Journey 2 | planned |
| 12 | Past scan detail | Journey 2 | planned |
| 13 | Learned second opinion | Learned stage | the gate and the stub are in place; the dataset, the training pipeline and the real model are outstanding |

The build approach is **Journey**: one complete user path is finished, states and polish included, before the next one starts.

What this means in practice today: the rule engine is wired and the verdict screen renders real verdicts from it, but the reads still come from `src/vision/mock.ts` rather than from a live call. No photo has travelled the whole chain yet. Feature 3's deploy is what unblocks that, and feature 8 is what replaces the mock with a real capture.

## Things that will trip you up

- **`README.md` is still `create-expo-app` boilerplate.** It talks about iOS, web and a `reset-project` script that does not exist here. Ignore it. (`readme.md` is a byte identical duplicate of it.)
- **Android only.** No iOS target, no web target, no Play Store release. Check spec 0001 before adding work for another platform.
- **Import `View`, `Text` and friends from `@/tw`, never from `react-native`.** The styling runtime does not patch React Native globally, so each styleable component is wrapped once in `src/tw`.
- **Every colour, size, spacing value and radius comes from `src/global.css`.** There is no `tailwind.config.js` — Tailwind v4 declares tokens with `@theme` inside that one file. `npm run check:tokens` fails the build when a raw value lands in `src/`.
- **`.npmrc` pins `include=optional` and `lightningcss` to 1.30.1.** Without it the build dies on a confusing missing `.node` module. Do not remove it.
- **NativeWind 5 and `react-native-css` 3.1 are release candidates.** This is the one knowingly risky choice in the stack. A bug in a release candidate is yours to work around.
- **Never put a secret behind `EXPO_PUBLIC_`.** Anything with that prefix is baked into the app bundle and readable by anyone holding the build.
- **Add packages with `npx expo install`, not `npm install`**, so versions stay SDK compatible.
- **Expo ships breaking changes every SDK release.** APIs you remember may be renamed, moved or gone. Check the versioned docs at `https://docs.expo.dev/versions/v57.0.0/` rather than going from memory.
- **Expo Go only carries its own bundled native modules.** Adding a library with native code means moving to a development build.
- **The Pune sourcing is the biggest open risk in the product, bigger than any code in it.** No quotable Pune specific rule document could be found, so most rules currently rest on national rules and say so in their `scope` field. Nothing automated can prove a citation says what the rule claims it says.
