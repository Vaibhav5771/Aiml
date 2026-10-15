# 0007 rationale: the verdict screen

The reasoning behind [index.md](index.md). A build reads `index.md` only.

## Context

> ⚠️ Premise note: this spec designs the most visible screen in the product on top of a chain that has never once run end to end on a phone. Features 3, 5, 6, 7 and 13 are all still `in-progress`, and in every one of them the outstanding milestone is the same sentence: it needs your device. The failure mode is specific, not vague. The screen gets built against `getMockScan` a second time, looks finished, and then the first real read arrives with a `display` string twice as long as the mock's, or a material the rule set has no rule for, and the layout that was signed off was never the layout anyone will see. The right framing is that tasks 1 to 6 of the build plan are safe to run now, because they are pure or storage level and testable with `node --test`, while tasks 7 to 12 should not be called done until one real photo has travelled the chain. That ordering is already what the build plan says; this note is why.
>
> A second, narrower concern: this spec adds `MIGRATIONS[1]` to a table whose `MIGRATIONS[0]` has never executed on real hardware. Spec 0006 proved its statements against real SQLite but its own scope milestones still say the device work is outstanding. Two unproven migrations now have to run in order, on the first phone that opens the app, and a mistake in the first one surfaces as a failure in the second.

Recyclens exists to say more than recyclable or not. Its claim, written into the first line of the scope, is that it shows you the reasoning behind the answer instead of just handing you a label. Everything upstream of this screen has been built to make that possible: spec 0003 returns six named observations with a confidence on each and refuses to let the model state a verdict, spec 0004 turns those into an answer through rules that each carry a citable document, spec 0005 adds a learned stage whose only permitted action is refusal, and spec 0006 stores the whole thing so an old scan still says what it said on the day. This screen is where all of that either becomes legible or does not.

What exists today is a placeholder. `src/screens/result/index.tsx` was built during feature 6 to give the design system something real to be tested against, and its own comment says feature 9 owns the real thing. It runs on mock data, lists all six observations as equal full width cards, draws its own header, and prints a confidence percentage.

Four forces shape the decision:

**Several specs deliberately deferred a question to this one.** Spec 0004 left open whether a present url becomes tappable and whether a national citation should look different from a Pune one, and stripped the `scope` field out of the verdict in the meantime. Spec 0002 left the result screen's hand drawn header on its Known debts list and left `ConfidenceTone` with no caller, because the thresholds belonged to feature 4 and feature 4 never set them. `src/vision/types.ts` left the attribute copy to feature 9. These are not polish items; each is a decision with a visible consequence.

**The confidence number on the card is actively misleading.** `confidenceFrom` computes the weakest score over only the attributes the deciding record names. For a matched rule that is a defensible measure of the answer. For a gate it is not: `gate-photo-unreadable` names only `photoQuality`, so a model that is 95 sure the photo was bad renders "95% confident" directly beside the words "Check manually". And the no match record names nothing at all, so `NO_MATCH_CONFIDENCE` is 0 and the card reads "0% confident". The same field means three different things in three cases and the card presents all three identically.

**The refusal path is the product's honest centre and currently its weakest screen.** Spec 0004's gates each carry real reasoning and a real citation. On the screen as it stands, a refusal renders exactly like an answer, with the gate's text in the rule card and no indication of which of the six reads let it down. The scope's done when for this feature is explicit that a check manually has to say what was missing and what to try next.

**Nothing on screen may claim more certainty than the attributes support.** This is written into the build mandate in `docs/design.md`, into the `DisplayAttribute` type that structurally cannot carry a score, and into the reason `ConfidenceBar` defaults to neutral ink. It is the constraint that every option below has to survive.

**An assumption with no spec behind it.** Feature 8, capture a photo, is still `planned` and has no spec. This screen's entry contract assumes capture hands over a photo and a decided verdict, and navigates by id after the save. That is stated as a constraint here and enrolled as a follow up rather than quietly assumed.

## Options considered

### Option 1: keep the current composition and fix only what is wrong

Leave the order (photo, answer, all six reads, rule, note, actions) and change only the things that are provably misleading: the percentage becomes a band, the citation becomes tappable, the scope chip appears, the check manually names its culprit.

**Pros**:

- Smallest diff by a distance, and the one most likely to ship inside the deadline.
- Nothing about the existing layout has been shown to fail a user, because no user has used it.
- Keeps the scope's own wording, the answer then what it saw then the rule, exactly as written.

**Cons**:

- Six equal weight cards is six equal weight cards. The read that decided the answer looks identical to the one that had no bearing on it, which is the opposite of what the screen should emphasise.
- The citation, the single thing that makes the product defensible rather than confident, stays at the bottom of a long scroll behind evidence most readers will not read.
- Leaves the hand drawn header debt open for someone else to pay.

### Option 2: answer, cited rule, then reads behind a disclosure, with the deciding attributes promoted

The verdict leads. The rule and its citation sit directly under it as the reasoning. The six reads sit below that, with the attributes the deciding record named expanded and toned by band, and the rest behind one control. A check manually names its blocking read and, where the app can act, offers that action as a button.

**Pros**:

- Matches the product's claim directly: the answer, then why, then the evidence, in that order of importance.
- Promotion is derived from the rule's own condition rather than from a designer's guess, so it cannot drift from what actually decided the answer.
- Applies progressive disclosure where it costs nothing, since a read with no bearing on the answer loses nothing by being one tap away.
- Closes every deferred question in one pass rather than leaving three of them for a later feature.

**Cons**:

- Five of six reads are hidden by default on a product whose pitch is showing its working. A strict reading of the scope's done when, every verdict shows the attributes it read, is arguably not met by a disclosure.
- Needs two new contract fields and a migration, so the blast radius reaches the engine and the database rather than staying in the view layer.
- Two new routes and an animation to maintain.

### Option 3: a two tier screen, the answer alone with everything else behind a details push

The verdict and its action fill the first screen with nothing else. A single Show the reasoning control pushes a second screen holding the rule, the citation and all six reads.

**Pros**:

- The purest reading of content leads and chrome recedes, and the fastest possible path to the answer.
- The reasoning screen can be laid out generously with no pressure to compete with the verdict.

**Cons**:

- Puts the citation behind a navigation push. A claim you have to navigate to is a claim most people never see, which undercuts the whole defensibility argument the rule set was built for.
- A check manually is useless on tier one: the entire content of a refusal is its reasoning, so the user is pushed to tier two every time anyway.
- Two screens to keep in step, and feature 12 inherits both.

### Option 4: a narrative screen, one paragraph of generated prose explaining the verdict

Compose the observations, the rule and the confidence into flowing sentences rather than cards.

**Pros**:

- Reads the most naturally for a non expert, which is the stated audience.
- No disclosure question, because there is nothing to collapse.

**Cons**:

- Prose composed from six attributes either hides the confidence on each or becomes unreadable carrying all six. The screen's hardest requirement is that nothing overclaims, and prose is where overclaiming hides best.
- Nothing is scannable. A returning user who wants only the answer has to read a paragraph to find it.
- The composition logic becomes a thing to test and maintain, with far more ways to produce a sentence that is subtly wrong than a card has.

## Rationale

Option 2 was chosen because the force that decides it is the citation, not the layout. The product's defensibility rests entirely on an answer being traceable to a named document, and that is the one element whose position actually changes whether people see it. Option 1 and Option 3 both bury it, Option 1 under evidence and Option 3 behind a push. Putting the rule immediately under the answer is the only arrangement where the reasoning is unavoidable, and once the rule sits there, the six reads become supporting detail rather than the main body, which is what makes collapsing them defensible rather than merely convenient.

The promotion rule is what resolves the tension with the scope's wording. The objection to a disclosure is real: the scope says every verdict shows the attributes it read. The answer is that all six are still shown, and the ones hidden by default are exactly the ones that had no bearing on the answer, chosen by the rule's own `when` condition rather than by anybody's judgment. A reader who wants all six is one tap away; a reader who wants to know what decided it never has to hunt. If `/check verify` reads that criterion strictly and fails it, the honest fix is to open the disclosure by default rather than to abandon the promotion.

Option 4 was rejected on the constraint that governs this whole screen. Nothing may claim more certainty than the attributes support, and generated prose is precisely where unearned certainty hides: a sentence joining a high confidence material read to a low confidence symbol read reads as one confident claim unless it is written very carefully every time, and there is no type that can enforce it, whereas `DisplayAttribute` having no `score` field already enforces the equivalent rule for cards.

**The engineer's preference was followed throughout, with one place worth naming.** The percentage was replaced with a band at the engineer's choice, which fixes two of the three cases. It does not by itself fix the gate case, because "High confidence" beside "Check manually" still reads oddly. Two recommendations close the remaining gap: the chip's noun changes with the verdict kind, so a check manually says the confidence belongs to the blocking read rather than to the answer, and the chip is omitted entirely where the deciding record named no attribute, which removes the no match case rather than rewording it. The runner up was suppressing the chip on every check manually, which is simpler but throws away real information on the four gates where the number does mean something.

## Decisions made during writing, not asked

These were settled with the full design in view rather than put to the engineer. Each states the pick and the alternative that lost.

1. **The confidence chip's wording and presence.** Noun by verdict kind, omitted where `decidedOn` is empty. Runner up: suppress on every check manually. Covered above.
2. **The next step button's label.** A record keyed by rule id in the screen layer, carrying a short verb phrase and the action, rather than reading `Verdict.action` directly. The gate actions are sentences ("Separate the parts if you can, then check each one") and a sentence is not a button label. The gate's full action still renders on the card, so nothing is lost. Today only `gate-photo-unreadable` has a next step the app can itself perform, so only it gets a button; the record is where a future gate adds one. Runner up: a `nextStep` field on every gate in `pune.json`, which the engineer declined earlier for good reason, since it duplicates the action line in the data.
3. **Where the band is computed.** In `engine.ts`, beside the number, reusing spec 0003's thresholds through a `bandFor` in `src/vision/types.ts`. Runner up: compute it on the screen. Rejected because `src/vision/types.ts` already states that the app never computes a band of its own, and two threshold definitions in one product is exactly the drift that file exists to prevent.
4. **The unsaved entry.** A static route `src/app/result/unsaved.tsx`, which wins over `[id]` in Expo Router, reading a `pending` slot on the scans store. Runner up: a reserved sentinel id, or the verdict JSON encoded into a route param. Both work; a sentinel puts a magic string in the id space and a JSON param puts a whole object in a url.
5. **The photo viewer.** A modal route at `src/app/photo.tsx` with `presentation: 'modal'`, per the `expo-router` skill, taking the uri as a param. Runner up: a hand built overlay inside the screen, which the skill explicitly advises against.
6. **Motion.** The verdict card enters with a fade and a small rise, and the disclosure animates its height, both at `duration-250`, using `react-native-reanimated` which is already installed. Everything else is still. Reduce motion is honoured. Runner up: no motion at all, which is cheaper and gives up the one place where animation carries meaning, the disclosure revealing content in place.
7. **The safe area.** Once the stack header draws the top, `Screen` takes `edges={['bottom']}` on this route. Stated explicitly because a double inset is the obvious way to get task 7 wrong.
8. **A missing photo file.** The existing placeholder tile, and the thumbnail is not tappable when there is nothing to open. Runner up: an error state, which is a lot of screen for a case that only arises after the orphan sweep has already failed.
9. **Attribute copy.** The existing `ATTRIBUTE_LABEL` record stands as written, including Cleanliness for `contamination`. It was already chosen on the right principle, that the caption is the reader's word rather than the machine's.

## Evidence: what the current screen does today

Read from `src/screens/result/index.tsx` at the time of writing, for comparison against the build plan.

| Element | Today | After this spec |
|---|---|---|
| Header | hand drawn `ScreenHeader`, no back swipe | Expo Router stack header |
| Photo | 48dp thumbnail, not tappable | 48dp thumbnail, opens full screen |
| Order | photo, verdict, reads, rule, note, actions | photo, verdict, rule, reads, note, actions |
| Confidence | `{n}% confident` chip, always shown | band word, noun by kind, omitted when nothing was named |
| Reads | six equal cards, all neutral, absent keys skipped silently | deciding reads promoted and toned, rest behind a disclosure, absent keys say not recorded |
| Rule | text plus document name, not tappable, no scope | text, document, scope chip, tappable where a url exists |
| Actions | Scan another, Save to history | Scan another, plus a gate driven next step where the app can act |
| Data | `getMockScan` | `useScans.open(id)`, or the `pending` slot |

`Save to history` is removed rather than rewired: spec 0006 made saving automatic the moment the engine answers, so the button offers an action that has already happened.
