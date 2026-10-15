# Rationale: 0004, the local recycling rule set

The reasoning behind [index.md](index.md). A build reads `index.md` only.

## Context

Spec 0003 ended with six named observations about a piece of packaging and deliberately no judgement. That was the whole point: the model is never told where the person is, and never returns a verdict, because a verdict that cannot be traced to a local rule is an opinion with a confidence number stapled to it.

That leaves a gap only this feature can close. The app has `material: pp, score 84` and has to turn it into a sentence someone acts on while standing over a bin. Three things make that harder than a lookup table.

First, **the answer has to be defensible**. The scope's own words are that the rule set is "what makes the verdict defensible instead of a guess", and every rule must carry the source it came from. That is a structural requirement, not a nicety: it decides the shape of the data, because a citation has to live beside the rule rather than in a document nobody ships.

Second, **the input is uncertain in a way the output must respect**. Spec 0003 gives every attribute a self reported score and forces an `unknown` code to a `low` band. Those signals exist so something downstream can decline to answer. If this feature ignores them and always produces a verdict, the care taken in 0003 is wasted and the product overclaims exactly where it promised not to.

Third, **the sourcing turns out to be the hard part**. A check run while writing this spec could not load one quotable rule document. PMC's solid waste page returns HTTP 200 but serves only navigation, 606 characters with no mention of waste at all. SWaCH's site returns 406 to anything that is not a browser. CPCB's plastic waste section loads but its rule documents sit behind navigation that a fetch does not follow. The national Rules that legally govern Pune are real and are the strongest available basis, but nothing was confirmed as a directly quotable page. Any design here has to stay honest about that rather than decorate rules with citations nobody checked.

The cost of not deciding is that features 9 and 10 stay blocked. The verdict screen has nothing to render and the failure states have no "I cannot tell" to show, so the whole of journey 1 waits.

## Options considered

### Option 1: A declarative JSON rule set with ordered first match, stop checks as data

Rules, stop checks and caveats are records in one bundled file sharing one shape, each with plain words text and its own citation. A pure function runs the stop checks, then takes the first matching rule.

**Pros**:
- The citation requirement is satisfied structurally. A rule without a source is a malformed record a test rejects, not a discipline someone has to remember.
- The reason the app declined to answer is itself quotable, because a stop check is the same shape as a rule and carries its own text and source.
- A correction is a one line diff in version control with its citation beside it, reviewable without reading any code.
- A second region is a second file. The deferred "more regions" item stays genuinely cheap.
- Evaluation order is visible in the file, so why a given rule won is readable rather than computed.

**Cons**:
- File position becomes meaningful. A rule added in the wrong place silently changes answers, and a reachability test catches only fully shadowed rules, not partially shadowed ones.
- Conditions expressed as data are less expressive than code. A rule needing arithmetic or a relationship between two attributes cannot be written without extending the format.
- JSON has no types of its own, so enum drift against spec 0003 is caught by a test rather than by the compiler.

### Option 2: A hardcoded TypeScript decision tree

The rules live as a function: nested conditions returning verdicts, with the citation as a string beside each return.

**Pros**:
- Fully typed end to end. A code outside the enum is a compile error, with no validation test needed.
- Arbitrarily expressive. Any condition you can write in TypeScript is available immediately.
- Fewer moving parts: no file to parse, no schema to validate, no reachability concern.

**Cons**:
- Changing a rule becomes a code change, which puts the rule set behind the same review and release weight as the engine. The scope's intent is that rules are data.
- Citations in a decision tree drift. Nothing structurally prevents a branch returning a verdict with no source, which is precisely the failure this product cannot afford.
- A second region means a second function and a branch, rather than a second file.
- The rules stop being reviewable by anyone who does not read TypeScript, which rules out the person most likely to know Pune's actual practice.

### Option 3: A weighted scoring system

Every rule contributes a score toward each verdict and the highest total wins.

**Pros**:
- Handles conflicting evidence gracefully, with no ordering question and no first match subtlety.
- Naturally produces a confidence number as a by product of the margin between the top two verdicts.

**Cons**:
- **The verdict stops being traceable to one named rule**, which breaks the product's central claim and the `AppliedRule` contract the screens already render.
- The weights would be invented numbers with nothing measured behind them, the exact trap spec 0003 flagged about its own confidence bands, repeated one layer up.
- Far harder to explain to a user, and impossible to explain in one sentence on a card.

### Option 4: A flat lookup table keyed by material and form

A map from `material` plus `form` to a verdict record.

**Pros**:
- The simplest thing that could work, and lookups are unambiguous by construction with no ordering and no conflicts.
- Trivially exhaustive: a missing key is obvious.

**Cons**:
- Cannot express the stop checks at all. Poor photo quality, a joined construction and heavy residue are not material and form, so they would have to live in code anyway, splitting the logic across two places.
- Combinatorially wasteful: fourteen materials crossed with five forms is seventy entries, most meaningless, each needing its own citation.
- No way to say "any form" without repeating the entry, so one correction becomes five edits.

## Rationale

Option 1 is chosen because the forces in Context are mostly about **traceability under uncertainty**, and only Option 1 makes both of those structural rather than voluntary.

The citation requirement decides it on its own. The scope requires every rule to carry its source, and Option 2's decision tree and Option 3's scoring both allow a verdict to emerge with no single named rule behind it. In Option 3 that is not a lapse but the design: a weighted result has no one rule to cite. Given the source check could not confirm a single quotable document, the product's citation discipline is under more strain than expected, not less, so the shape that enforces it mechanically is the right one.

The uncertainty requirement decides the stop checks. Spec 0003 deliberately produces signals whose only purpose is to let something downstream decline, and treating those checks as data rather than code means the refusal arrives in the same shape as any other answer, with its own text and its own citation. That is what lets feature 10 render "I cannot tell" as a real explained outcome instead of an empty state.

Option 1's main cost, that file order matters, is real and is accepted with a mitigation rather than waved away. A reachability test catches the fully shadowed rule, and the follow up records that partial shadowing stays uncaught and is worth revisiting past roughly twenty rules. The alternative orderings each cost something worse: most specific wins makes it harder to explain which rule won, and explicit priority numbers drift into constants nobody dares change.

On the thresholds the engineer chose 50, reusing the boundary between `low` and `medium` that spec 0003 already fixed, rather than inventing a third number. That is right for now, and it is also the weakest number in the spec: spec 0003's first live run returned 85 and above on every attribute of a clear photo, so this gate may almost never fire until the photo set includes genuinely hard shots. It ships as one named constant and the follow up says plainly that it is provisional.

The confidence calculation takes the weakest link over only the attributes the matched rule names. It was chosen over an average because an average lets a perfect photo quality score prop up an unreadable material, which is precisely the overclaiming the product promises not to do, and over the single deciding attribute because a rule often rests on more than one read.

## The sourcing check, and what it found

Run on 2026-10-11, capped at a handful of pages. This is recorded in full because it is the single biggest risk in the feature and a later reader should not have to rediscover it.

| Source | Result |
|---|---|
| `https://pmc.gov.in/` | 200 |
| `https://pmc.gov.in/en/solid-waste-management` | 200, but 606 characters of navigation chrome only, zero occurrences of "waste", "dry", "segregation" or "recycling" in the served HTML |
| `https://swachcoop.com/` | 406, the site rejects non browser requests |
| `https://cpcb.nic.in/plastic-waste/` | 200, a real page, but the rule documents sit behind navigation a plain fetch does not follow |
| `https://cpcb.nic.in/rules-2/` | 200 |
| `https://www.indiacode.nic.in/` | 200, the official repository of Indian statutes |
| `https://cpcb.nic.in/uploads/plasticwaste/PWM_Rules_2016.pdf` | 404, a guessed path, not a real one |

**Nothing quotable was retrieved.** Two useful facts came out of it anyway. The Pune municipal guidance is not available as a fetchable document, so rules claiming `pune` scope need a document obtained another way, by contacting PMC or SWaCH directly. And the two national Rules that legally govern waste handling in Pune are the realistic citation base for most materials, which is why `scope` became a required field on every source rather than a nicety.

A background research helper reported that PMC's page returned 404. That was checked directly and is **wrong**: the page returns 200. The practical conclusion happened to match, but for an entirely different reason, which is a reminder that a research summary is a lead to verify rather than a finding to cite.

## References

**Project sources** (verifiable in this repo):

- `docs/specs/0003-packaging-vision-read/index.md`: the six attribute vocabulary, the closed enums, the `score` field, and the follow up handing the verdict thresholds to this feature.
- `docs/specs/0001-stack-and-architecture/index.md`: rules as a JSON file bundled in the app with a per rule source citation, and a pure TypeScript rule engine beside them.
- `docs/specs/0002-design-system-ui-foundation/index.md`: the three verdict outcomes, and the rule that a verdict is carried by an icon and a word and a colour, never colour alone.
- `src/vision/types.ts`: `VerdictKind`, `AppliedRule` and `Scan`, the output contract this feature must satisfy.
- `src/constants.ts`: `REGION`, already set to Pune, India, which AC-12 asserts the rule set matches.
- `src/components/rule-card.tsx`: renders the citation, and its own comment anticipates this feature reshaping the type.
- `AGENTS.md`: pure functions by default, immutable data, explicit error values over thrown exceptions.

**Practices and standards**:

- First match rule evaluation with an explicit ordering, the standard shape for a small auditable rule set where tracing the winning rule matters more than conflict tolerance.
- Weakest link confidence, so an aggregate never claims more certainty than its least certain input.
- Solid Waste Management Rules 2016 (India), which establish the dry and wet waste segregation vocabulary this feature uses.
- Plastic Waste Management Rules 2016 (India), which govern resin identification codes and treat multilayer plastic as a distinct category.

**Links** (only pages confirmed to load during the check above; none of them is a quotable rule text, which is the point):

- Pune Municipal Corporation, solid waste section: https://pmc.gov.in/en/solid-waste-management (loads, but serves no content to a plain fetch)
- Central Pollution Control Board, plastic waste: https://cpcb.nic.in/plastic-waste/
- Central Pollution Control Board, rules: https://cpcb.nic.in/rules-2/
- India Code, the official statute repository, where the 2016 Rules can be located: https://www.indiacode.nic.in/
- SWaCH Cooperative: https://swachcoop.com/ (returns 406 to a plain fetch, reachable in a browser)
