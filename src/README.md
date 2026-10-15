# Source layout

From spec 0001, following the official `expo-project-structure` skill.
Routes live under `src/app` and `@/*` resolves to `./src/*`.

| Folder | What belongs here | Built by |
|---|---|---|
| `app/` | Expo Router routes only. Every file is a screen. | scaffold, then each screen feature |
| `screens/` | Screen bodies that the route files render, once a screen outgrows its route file | features 8 to 12 |
| `components/` | Reusable UI in kebab-case files: verdict card, attribute row, buttons | feature 6 |
| `db/` | The SQLite schema and queries over `expo-sqlite` | feature 5, used by 11 and 12 |
| `rules/` | `pune.json` plus the pure rule engine and its colocated tests | feature 4 |
| `ml/` | The learned second opinion: the feature extractor, the pure scorer, and the `model.json` artifact `ml/train.py` writes. Nothing here decides anything; `rules/` binds it | feature 13 |
| `vision/` | The client that calls your proxy, and the attribute types | features 3 and 7 |
| `store/` | The Zustand store | feature 7 onward |
| `hooks/` | Reusable hooks | as needed |
| `tw/` | The className enabled wrappers. Import `View`, `Text` and the rest from `@/tw`, never from `react-native` | feature 6 |
| `global.css` | The design tokens, declared with Tailwind's `@theme`: every colour, type size, spacing value and radius. The source of truth | feature 6 |
| `theme.ts` | A small JS mirror of the colours only, for the props that take a value rather than a className | scaffold, narrowed by feature 6 |
| `constants.ts` | Non secret app constants: proxy URL, region, photo settings | scaffold |

Two conventions worth keeping:

- Style with NativeWind classes on the component, through the `@/tw` wrappers,
  rather than `StyleSheet.create`. Every value comes from `global.css`:
  `npm run check:tokens` fails when a raw colour, size, spacing value or radius
  lands in `src/`.
- Put a test next to the file it tests, so `rules/engine.test.ts` sits beside
  `rules/engine.ts`, rather than in a separate tests folder.
