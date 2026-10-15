> **Superseded, kept as history.** This prompt describes a warm eco direction
> (paper tones, soft greens) that the app no longer uses. Spec 0002, on
> 2026-10-11, replaced it with the Apple inspired system that now lives in
> `src/global.css` and is documented in `docs/design.md`.
>
> Why it changed: the warm palette was written before anything was built, and
> every one of its text colours failed the 4.5:1 contrast bar once measured on
> a real screen. The direction was reset around values that pass rather than
> values that photograph well.
>
> Nothing here is the current design. It stays in the repository so the record
> of what was tried, and why it was dropped, is readable rather than lost.
>
> **The current prompt is [`figma-make-prompt.md`](figma-make-prompt.md).**

# Figma Make prompt: Recyclens prototype

Paste the block below into Figma Make. It is written for a high fidelity clickable Android prototype covering the four core screens: scan, a confident result, the uncertain result, and history.

**Swap before you paste:** the prompt names `Pune, India` as the region and cites a Pune rule. Change both to whichever region you end up scoping in `docs/scope/scope.md` feature 4. Everything else works as written.

---

## The prompt

```
Build a high fidelity, clickable mobile prototype for an Android app called Recyclens.

WHAT IT DOES
You photograph a piece of damaged, faded, or unlabelled packaging. The app reads what is
visible on it, checks that against the recycling rules for your city, and tells you whether
it is recyclable. It always shows its reasoning rather than just a verdict, and when it
cannot be sure it says so plainly and tells you why.

DEVICE
Android phone, 360 by 800. Every screen has an Android status bar at the top and room at the
bottom for the gesture bar. Inner screens have a back arrow at the top left. A bottom
navigation bar with two items, Scan and History, sits on the Scan and History screens.

VISUAL DIRECTION: ECO AND WARM
Think recycled paper and growing things. Not clinical, not neon corporate sustainability.
- Background warm off white #FAF7F0. Cards #FFFDF8 with a soft 1px border #E8E0D2.
- Primary deep forest green #1F4D36. Accent moss #8FB996.
- Verdict colours: recyclable #2E7D4F, not recyclable #B4452F (a clay red, not an alarm red),
  check manually #C98A2B (warm amber).
- Text near black warm #2B2621, secondary text #6E655A.
- Type: a warm humanist sans such as Nunito Sans or Inter. Screen title 24. Section labels 13,
  uppercase, wide letter spacing, in secondary text colour. Body 16 with line height 1.5.
- Shape: 20px corner radius on cards, 28px on primary buttons, soft diffuse shadows only.
- Every verdict is carried by an icon AND a word AND its colour, never by colour alone.

SCREEN 1: SCAN (home)
- Top left the word Recyclens, small. Top right a small pill reading "Pune, India" with a
  location dot icon.
- The body is a large rounded viewfinder filling most of the screen, showing a photo of a
  crushed plastic yogurt tub on a wooden table. Thin rounded framing guides sit inside it, and
  a line of helper text near its bottom reads "Fill the frame with the packaging. Include any
  symbols you can see."
- Below it a large circular shutter button in deep forest green, with a small gallery
  thumbnail button to its left labelled Gallery and a flash toggle to its right.
- Bottom navigation: Scan (active) and History.

SCREEN 2: RESULT, RECYCLABLE
- Back arrow, title "Result".
- A small rounded thumbnail of the yogurt tub at the top with a Retake text button beside it.
- The verdict card is the loudest thing on screen: a green circled check icon, the word
  "Recyclable" at 28, and beneath it "Kerbside bin, rinse it first". A chip at the card's top
  right reads "86% confident".
- Section label WHAT I SAW, then four attribute rows, each with a small icon, a label, a
  value, and a thin confidence bar:
    Material         Rigid plastic, likely PP (code 5)     88%
    Recycling symbol Found, partly faded                   74%
    Construction     Single material                       91%
    Photo quality    Good                                  high
- Section label THE RULE I APPLIED, then a quieter card with a moss coloured left border
  reading "Rigid polypropylene containers (code 5) are accepted in Pune kerbside recycling
  when they are clean, dry, and empty." Under it, in small secondary text, "Pune Municipal
  Corporation recycling guidelines, rule 5.2".
- A small warm note row at the bottom: "The symbol was faded, so the material was judged from
  the shape and surface too."
- Two buttons: "Scan another" filled primary, and "Save to history" outlined secondary.

SCREEN 3: RESULT, CHECK MANUALLY
Same layout as screen 2, different content and colour.
- Verdict card in warm amber: a circled question mark icon, the words "Check manually" at 28,
  and beneath it "I am not confident enough to call this". Chip reads "41% confident".
- Section WHAT I SAW:
    Material         Unclear, possibly a film laminate     38%
    Recycling symbol Not found                             high
    Construction     Two materials joined                  67%
    Photo quality    Low light, some blur                  low
- Section WHY I STOPPED, a card with three short rows, each with a small icon:
    "No recycling symbol was visible"
    "The packaging looks like more than one material bonded together"
    "The photo was too dark to read the surface"
- Section WHAT TO TRY, three short rows:
    "Photograph it in brighter light"
    "Flatten the label and shoot it straight on"
    "Look for a symbol on the base or along the seam"
- Two buttons: "Try another photo" filled primary, and "Save anyway" outlined secondary.

SCREEN 4: HISTORY
- Title "History" with "12 scans on this phone" beneath it in secondary text.
- A list of cards, newest first. Each card has a 56px rounded photo thumbnail on the left, the
  item name and when it was scanned in the middle, and a small verdict pill on the right,
  coloured by outcome, carrying an icon and a word.
    Yogurt tub        2 minutes ago    Recyclable
    Snack wrapper     Today 09:14      Not recyclable
    Shampoo bottle    Today 08:02      Recyclable
    Coffee cup        Yesterday        Check manually
    Egg carton        Yesterday        Recyclable
    Blister pack      2 days ago       Not recyclable
    Milk pouch        3 days ago       Check manually
    Cardboard sleeve  3 days ago       Recyclable
- Swiping a card to the left reveals a delete action.
- Bottom navigation with History active.

INTERACTIONS TO WIRE
- The shutter on Scan goes to the recyclable result, passing through a short thinking state
  first: the photo dimmed, a soft pulsing ring over it, and the words "Reading the
  packaging..." for about 1.2 seconds.
- "Scan another" and "Try another photo" return to Scan.
- The back arrow on either result returns to the previous screen.
- The bottom navigation switches between Scan and History.
- Tapping the Coffee cup row in History opens the check manually result. Tapping any other row
  opens the recyclable result.

KEEP IN MIND
- Use the exact copy above. Do not replace it with placeholder text or invented product names.
- The explanation is the product. Give the attribute rows and the rule card real room, and do
  not bury them below the fold as a footnote under the verdict.
- Calm and readable beats dense. One idea per block, generous spacing.
- No sign in, no onboarding, no settings, no account. These four screens only.
```

---

## Follow ups worth sending after the first result

Send these one at a time, after you have looked at what came back.

1. **The third verdict.** "Add a fifth screen, the not recyclable result, using the snack wrapper from the history list. Verdict card in clay red with a circled cross, the words Not recyclable, and beneath it General waste bin. Confidence 92%. Attributes: Material, Metallised film laminate, 89%. Recycling symbol, Not found, high. Construction, Two materials bonded, 94%. Photo quality, Good, high. The rule reads: Flexible multi layer films are not accepted in Pune kerbside recycling because the layers cannot be separated. Wire the Snack wrapper row in History to it."

2. **The states that make it real.** "Add three more states to the Scan screen: camera permission refused, with a plain explanation and a button to open settings; no network, shown after the shutter is pressed, with a Try again button; and nothing recognised, saying the photo did not look like packaging and offering a retake."

3. **Make the empty case honest.** "Add an empty version of the History screen for someone who has not scanned anything yet: a simple illustration, the line Nothing scanned yet, a sentence explaining that scans stay on this phone, and a button that goes to Scan."

4. **Tighten it.** "Reduce the type to four sizes only, increase the space around the verdict card so it clearly owns the top of the screen, and make the confidence bars thinner and quieter so they support the values rather than compete with them."

## If you would rather I drove Figma directly

There is a Figma connector available in this session, but it is not authorised yet. Turn it on in your claude.ai connector settings and I can create the file and the frames myself instead of handing you a prompt to paste.
