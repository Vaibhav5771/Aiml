# Data manifest — `all-screens.html`

Every data-bound element in the four directions, against the data that actually
exists today. Counted from `src/vision/mock.ts` (2 fixtures),
`src/rules/pune.json` (21 records: 5 gates + 16 rules), and the types in
`src/vision/types.ts` / `src/db/types.ts`.

**Classes** — ✅ Real (reliably populated) · ⚠️ Sometimes (often absent) · ❌ Aspirational (no data today).

## Result screen

| Element | Field path | Class | Count / note |
|---|---|---|---|
| Verdict word, icon, colour | `Verdict.verdict` → `VERDICT[kind]` | ✅ Real | 2/2 fixtures. The engine always produces one of three. |
| Action line | `Verdict.action` | ✅ Real | 2/2. Composed by the engine, never empty. |
| Confidence chip ("High") | `Verdict.confidenceBand` | ✅ Real | 2/2. Derived once in the engine via `bandFor`. |
| Item name | `Scan.itemName` | ✅ Real | 2/2. Proxy guarantees it. |
| Rule text | `AppliedRule.text` | ✅ Real | 21/21 records carry one. |
| Rule id (shown in C, D) | `AppliedRule.id` | ✅ Real | 21/21. Added by spec 0006. |
| Source document name | `RuleSource.document` | ✅ Real | 21/21. |
| Authority chip (National / General / Model) | `RuleSource.scope` | ⚠️ Sometimes | 21/21 in today's rule set, but **optional on a stored scan** — a scan saved before `MIGRATIONS[1]` has no scope. Spec 0007 AC-18: show no chip at all. |
| Source link | `RuleSource.url` | ⚠️ Sometimes | **14 of 21** records. A missing URL is a name-only citation, not a dead link. C's citation block must collapse the link row. |
| Caveat / note row | `Verdict.note` | ⚠️ Sometimes | 2/2 fixtures have one, but the field is optional on `Verdict`. |
| Six attribute reads | `Scan.attributes.*` | ⚠️ Sometimes | 6/6 on both fixtures, but `StoredAttributes` is `Partial` by design — a scan saved before a seventh attribute existed simply lacks the key. **B's "6 reads" counter must count, not print 6.** |
| Per-read confidence word | `DisplayAttribute.confidence` | ✅ Real | Present on every attribute that exists. |
| Deciding-read highlight (C) | `Verdict.decidedOn` | ✅ Real | 2/2, and empty is meaningful — the learned gate and the no-match rule name none. **C's `lead` row must not render when `decidedOn` is empty.** |
| Photo thumbnail | `Scan.photoUri` | ⚠️ Sometimes | **0 of 2 fixtures** carry a real path today (both are `''`). `src/db/index.ts` also warns the path can outlive the file; `photo.tsx` already ships the "That photo is gone" state. |
| Timestamp | `Scan.scannedAt` | ✅ Real | 2/2 ISO strings. |
| Region · rule version | `Scan.region`, `Scan.ruleSetVersion` | ✅ Real | 2/2 (`Pune, India`, `1.1.0`). |
| Model line ("Held back by…") | `Scan.modelVersion` + `gateFired` | ⚠️ Sometimes | Both fixtures are `unavailable` / `false`. Shown only when the learned gate fired (AC-19). |
| Confidence **percentage** | `AttributeRead.score` | ❌ Forbidden | Not aspirational — **impossible by design.** `DisplayAttribute` omits `score`, so a screen cannot print one. None of the four variants shows a number; keep it that way. |
| Trust score | `ScanLearnedFields.trustScore` | ❌ Forbidden | Spec 0007 AC-19: the model is **named, never scored.** The number must not reach any state of this screen. |

## History screen

`listScans` selects six columns and never parses a stored attribute payload
(spec 0006, AC-8). `ScanSummary` is `id`, `photoUri`, `itemName`, `scannedAt`,
`verdict`, `confidence` — **nothing else is available without widening it.**

| Element | Field path | Class | Count / note |
|---|---|---|---|
| Item name | `ScanSummary.itemName` | ✅ Real | 2 rows exist today. |
| Verdict word + colour | `ScanSummary.verdict` | ✅ Real | 2/2. |
| Time | `ScanSummary.scannedAt` | ✅ Real | 2/2. |
| Row thumbnail (A, C) / grid tile (D) | `ScanSummary.photoUri` | ⚠️ Sometimes | Same gap as above: the path can outlive the file. **D is a photo grid — it needs a per-tile fallback that A's and C's small thumbs can survive without.** |
| Rule id + scope sub-line (C) | — | ❌ Aspirational | `ScanSummary` carries neither. Showing it means widening the query and parsing the payload, which AC-8 deliberately avoids. **Decide: widen, or drop the sub-line.** |
| Filter chips: All / Recyclable / Check manually (C) | derived from `verdict` | ✅ Real | Derivable with no schema change. |
| Day grouping ("Today") | derived from `scannedAt` | ✅ Real | Derivable. |
| Confidence on a row | `ScanSummary.confidence` | ⚠️ Decide | The number **is** stored, but spec 0007 deliberately replaced percentages with bands on the Result screen. Showing a band here is free (`bandFor`); showing `86%` would contradict the Result screen. **No variant shows it — confirm that is what you want.** |
| Scan count / streak / "items recycled this month" | — | ❌ Aspirational | No such data exists anywhere. Deliberately absent from all four. |
| Empty state | — | ❌ Not drawn | Feature 11 owns it. Not explored here; it comes from `StateView`. |

## Scan screen

| Element | Source | Class |
|---|---|---|
| Helper text | hard-coded copy in `src/screens/scan/index.tsx` | ✅ Real |
| Region chip "Pune · rules 1.1.0" (C) | `PUNE_RULES.version` + region | ✅ Real |
| Privacy strip (C) | the permission-state copy, reused | ✅ Real |
| "Recent scans" peek strip (D) | `listScans()` | ⚠️ Sometimes | Needs the same photo fallback as D's grid, and a 0-scan state. |
| Torch / gallery controls | `expo-camera`, `expo-image-picker` | ✅ Real — both already wired. |

## What the implement phase must resolve

1. **B's "1 rule, 6 reads" counter** — count the keys actually present.
2. **C's history sub-line** — widen `ScanSummary`, or cut it.
3. **D's photo grid** — a per-tile missing-photo fallback, or drop the grid.
4. **C's citation link row** — must collapse for the 7 of 21 records with no URL.
5. **C's 11px uppercase captions** — below the four-size scale. Promote to `text-label` (13px) or add a fifth size to `src/global.css` with a written reason. `npm run check:tokens` will fail otherwise.
6. **History confidence** — band, or nothing. Never a percentage.
