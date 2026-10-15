# Figma Make prompt: Recyclens redesign

Paste the fenced block below into Figma Make. It describes the app as it exists
today — the Apple-inspired system in [`src/global.css`](../src/global.css) and
[`docs/design.md`](design.md) — and asks for a redesign of all nine screens.

Every colour, size and radius in the prompt is copied from `src/global.css`, so
whatever comes back can be built without inventing a value. The copy is the real
copy from `src/screens/`, `src/app/` and `src/vision/mock.ts`.

This replaces [`figma-prototype-prompt.md`](figma-prototype-prompt.md), which
describes a warm eco palette spec 0002 dropped.

---

## The prompt

```
Redesign an Android app called Recyclens. Build every screen listed below as a
high-fidelity, clickable prototype.

WHAT IT DOES
You photograph a piece of damaged, faded or unlabelled packaging. The app reads what
is visible on it, checks that against the recycling rules for your city, and tells you
whether it is recyclable. Its whole claim is that you can READ ITS REASONING and trust
it: it shows the rule that decided, the document that rule came from, and the six
things it observed. When it cannot be sure, it says so plainly and names what let it
down. It never guesses.

DEVICE AND CONSTRAINTS
- Android phone, 360 x 800 dp. Android status bar at the top, gesture bar room at the bottom.
- Light appearance only. There is no dark mode and none should be designed.
- System font only (Roboto on Android). No custom or display typeface.
- A two-item bottom tab bar, Scan and History, on the Scan and History screens only.
  It sits FLUSH: full width, no margin, no corner radius, no shadow, no elevation,
  just a 1px hairline above it. Do not float it as a pill.
- Pushed screens have a back control at the top left.

VISUAL DIRECTION: APPLE-INSPIRED, CONTENT FIRST
Clarity, deference, depth. Surfaces are white and near-white, the accent is used
sparingly, and nothing is decorated that does not need to be. Generous whitespace and
real type hierarchy do the work, not borders and fills. Colour carries MEANING, never
mood. This is deliberately iOS-flavoured styling on Android — keep it consistent
everywhere rather than mixing in Material.

EXACT COLOURS — use these values, do not substitute
Surfaces:   background #FFFFFF · card #F5F5F7 · hairline rgba(0,0,0,0.08) · track #E8E8ED
Accent:     #0062C4 (actions, links, focus ring, citations)
Text:       ink #1D1D1F · secondary #6E6E73
Verdict:    recyclable #176B33 · not recyclable #D70015 · check manually #B25000
Verdict tints (the wash behind a verdict):
            ok #F0F9F2 on edge #D6E9DC
            no #FDF0EF on edge #F5D9D6
            maybe #FDF4EC on edge #F5E3D2
Caveat row: surface #F5F5F7, edge rgba(0,0,0,0.08)

These are NOT Apple's published values. Apple's own secondary grey (#86868B) scores
3.62:1 on white and fails its own guidance, so every value above was darkened until it
passes 4.5:1 as small text. Do not "correct" them back toward Apple's palette.

EXACT TYPE SCALE — four sizes, not five
  13 / 18   section labels, captions, chips, control labels
  17 / 24   body copy, button labels, attribute values
  28 / 34   screen titles, the reading overlay
  34 / 41   the verdict word, and nothing else
Weight does the rest: 400 regular, 500 medium, 600 semibold, 700 bold. A card title is
17 bold, not a fifth size. Never introduce another size.

EXACT RADII
  4px   the confidence bar
  12px  icon tiles
  16px  photo thumbnails, camera control tiles
  18px  every card
  24px  the camera viewfinder, full-width sheets
  980px pills and buttons
Circles are fully round. Nothing else gets a radius.

SPACING RHYTHM — 4px base
  4   inside a tight pair (a label above its value)
  8   a row gap, items on one line
  12  the in-between step, use sparingly
  16  card padding, screen gutter, group gap
  24  a section gap, between blocks
  32  the bottom of a scrolling screen
HARD RULE: row gap 8 < group gap 16 < section gap 24. Do not use one value for all three.

MOTION
150ms a press or toggle · 250ms something entering or leaving · 400ms a whole surface.
Press feedback DIMS to 85% opacity on solid surfaces and 60% on bare text or icons.
No ripples anywhere, on any platform.

=== SCREENS TO BUILD ===

1. SCAN (home, tab 1)
   Header: the Recyclens wordmark, and the region whose rules apply.
   A live camera viewfinder with four white corner guides at 90% opacity.
   Helper text over the frame: "Fill the frame with the packaging. Include any symbols
   you can see."
   Three controls: a Gallery tile, a large round shutter in the accent colour, a Flash
   tile. Each tile is 48dp with its name visible underneath — an icon alone leaves you
   guessing. Bottom tab bar.

2. SCAN — READING (the loading state)
   The same screen with a scrim over the viewfinder, a spinner, the title "Reading the
   packaging..." and the detail line "Checking material and local rules". The controls
   are dimmed and not pressable.

3. SCAN — CAMERA REFUSED
   Icon, title "Recyclens needs the camera", explanation "It reads the packaging from a
   photo you take, which is sent to the Recyclens service to be read. Nothing is sent
   until you press the shutter.", a filled "Allow camera" button and a text-only second
   action "Or pick a photo from your gallery".

4. RESULT — CONFIDENT  (the most important screen in the app)
   Order matters and it is the whole point: THE ANSWER, then THE REASONING, then WHAT
   IT SAW. Do not put the observations above the rule — that leaves the reader
   assembling a conclusion the app already reached.
   a) A small row at the top: photo thumbnail, the label "Scanned item", and "Yogurt tub".
   b) The verdict: a check icon, the word "Recyclable" at 34px in #176B33 on the #F0F9F2
      tint, the action line "Dry waste, rinse it first", and a chip reading
      "High confidence".
   c) Section label "The rule I applied", then a card: "Rigid polypropylene, resin code
      5, is a recyclable plastic. Empty it, rinse it, and keep it with your dry waste."
      Under it the source: "Plastic Waste Management Rules, 2016 (India)", an authority
      chip reading "National", and a link to cpcb.nic.in/plastic-waste.
   d) Section label "What I saw", then six observations. Each has a small icon, a grey
      caption, the read in plain words, and how sure it is. Show the one the rule
      actually turned on — Material — promoted and open; the rest may be collapsed.
        Material           Polypropylene, code 5        High
        Form               Rigid, holds its shape       High
        Recycling symbol   Found, partly faded          Medium
        Construction       Single material              High
        Cleanliness        A little yogurt left inside  Medium
        Photo quality      Sharp and well lit           High
   e) A caveat row: "The symbol was faded, so the material was judged from the shape and
      surface too."
   f) Quiet provenance, last: "Scanned 14 Oct 2026, 11:42 PM" and "Pune, India · rules 1.1.0".
   g) One primary action: "Scan another".

5. RESULT — UNCERTAIN (same layout, the refusal case)
   Item "Coffee cup". Verdict word "Check manually" in #B25000 on #FDF4EC, action line
   "I am not confident enough to call this", chip "Low confidence". A line naming what
   blocked it, then the section label reads "Why I stopped" instead of "The rule I
   applied", over: "Not enough was readable to match a rule. When the material cannot be
   identified with confidence, the safe answer is to check manually rather than guess."
   Source "General recycling practice", chip "General", no link.
   Reads: Material "Could not tell, possibly a laminate" Low · Form "Moulded paper fibre"
   Medium · Recycling symbol "Looked, and there is none" High · Construction "Two
   materials joined" Medium · Cleanliness "Too dark inside to see" Low · Photo quality
   "Low light, some blur" High.
   Caveat: "No symbol was visible and the photo was too dark to read the surface."
   Here there are TWO actions: a filled "Take another photo" (the thing the verdict just
   recommended) and an outlined "Scan another". The filled one must never steer away
   from the advice the card gave.

6. RESULT — UNREADABLE
   Icon, title "That scan is gone", explanation "It looks like it was deleted. Everything
   else in your history is still here.", one button "Scan something".

7. HISTORY (tab 2)
   Past scans, newest first, grouped by day. Each row: photo thumbnail, item name, the
   verdict as an icon and a coloured word, and the time. Two rows exist:
     Yogurt tub · Recyclable · 11:42 PM
     Coffee cup · Check manually · 11:40 PM
   Swipe a row to delete it.

8. HISTORY — EMPTY
   Icon, a title, a sentence explaining that scans are kept on this phone only, and one
   button that goes to Scan.

9. PHOTO (a full-screen modal)
   The photo you took, fitted on a #1D1D1F background — never on white, because a white
   surround throws a colour cast onto the thing you are trying to look at. One "Done"
   button. Also design its failure: "That photo is gone" / "The file is no longer on this
   device. The scan itself is still here, with everything it read and the rule it
   applied." with a "Back to the result" button.

=== RULES THAT ARE NOT NEGOTIABLE ===

1. A verdict is ALWAYS an icon AND a word AND a colour. Never colour alone. Take a
   greyscale screenshot: if the three verdicts are not still distinguishable, it is wrong.
2. NEVER show a confidence percentage. Confidence is three words only: High, Medium, Low.
   A number next to "Check manually" reads as a contradiction and is banned outright.
3. Nothing tappable is under 48 x 48 dp, in either dimension, ever.
4. Nothing claims more certainty than it has. A confidence bar is NEUTRAL GREY by
   default, not green. Green is earned, not assumed.
5. Every piece of text must survive the phone's font size being set to 200%. Use minimum
   heights, let rows wrap onto a second line, and never truncate with an ellipsis.
6. Small text must clear 4.5:1 contrast on whatever sits behind it.
7. One primary action per screen. Never two filled buttons competing.
8. Every interactive element has a visible focus state: a 2px ring in #0062C4, drawn
   2px outside the control's own edge.

=== WHAT TO DELIVER ===
- All nine screens as frames at 360 x 800.
- A component set: button (filled and outlined, with pressed, focused, disabled and
  loading states), icon tile (34dp and 48dp), verdict card, attribute row with its
  confidence bar, rule card with its source and authority chip, caveat row, section
  label, screen header, tab bar, and one empty/error state layout that all five
  non-happy paths are built from.
- A colour style and a text style per token above, named for the token.
- A clickable flow: Scan -> reading -> confident result -> photo modal -> back ->
  Scan another; and Scan -> reading -> uncertain result -> take another photo.
```

---

## Optional: ask for one structural direction

The prompt above describes the content and the system but leaves the layout open. If
you would rather pin the structure, append ONE of these four lines, drawn from
[`design-explorations/all-screens.html`](../design-explorations/all-screens.html):

- **Grouped Inset** — "Lay every screen out as iOS grouped inset lists: white cards on a #F5F5F7 canvas, uppercase section headers outside the cards, chevron rows inside them."
- **Answer First** — "Give the verdict the entire first screenful as a tinted hero, and collapse the rule and all six reads behind a single 'Why this answer' disclosure row."
- **Evidence Record** — "Lay the result out as an audit record: a compact verdict band, the cited rule promoted directly beneath it, then all six reads as a dense evidence table with the deciding row highlighted."
- **Sheet over Photo** — "Keep the photo on screen after the shutter and bring the answer up over it on a draggable sheet, with a segmented control switching between Answer, Rule and Reads."

## Before you paste

- The region is hard-coded as `Pune, India` and the rule set version as `1.1.0`. Both are real today; change them if `src/rules/pune.json` moves.
- Whatever comes back, check it against `docs/design.md` before building. The prompt
  carries the values but not the reasoning, and the reasoning is what decides the next
  value nobody wrote down.
- Figma Make will not know about `npm run check:tokens`. Anything it invents outside the
  lists above will fail that check when it reaches `src/`.
