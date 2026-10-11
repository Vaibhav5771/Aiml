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
| `vision/` | The client that calls your proxy, and the attribute types | features 3 and 7 |
| `store/` | The Zustand store | feature 7 onward |
| `hooks/` | Reusable hooks | as needed |
| `theme.ts` | Every colour, type size, spacing value and radius | scaffold, extended by feature 6 |
| `constants.ts` | Non secret app constants: proxy URL, region, photo settings | scaffold |

Two conventions worth keeping, both from the Expo skill:

- Keep each `StyleSheet.create` at the bottom of its own component file rather
  than in a separate styles file.
- Put a test next to the file it tests, so `rules/engine.test.ts` sits beside
  `rules/engine.ts`, rather than in a separate tests folder.
