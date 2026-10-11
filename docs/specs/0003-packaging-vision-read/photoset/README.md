# The photo set

Ten or more real photos with a written expectation per attribute, run against
the deployed proxy. This is what turns the confidence bands from a plausible
guess into evidence, and it is the one part of spec 0003 that needs your hands
and your camera.

Run it with:

```bash
npm run check:photoset -- https://your-proxy.vercel.app
```

It prints the code you expected beside the code that came back, per attribute.
It sets no pass bar and never fails on a mismatch, because a wrong answer on a
deliberately terrible photo is the right answer. Judging the result is yours.

It spends real Gemini quota, one call per photo.

## What to shoot

Spec 0003 names five of these. The rest are yours. Shoot them on the phone the
app runs on, in the light you would actually use.

- [ ] A clear rigid plastic tub with a readable recycling symbol
- [ ] The same kind of item with a **faded or worn symbol**, the case the whole
      product exists for
- [ ] A **laminate pouch**, the one `material` and `form` are most likely to
      disagree about
- [ ] A **dirty container** with food residue still in it
- [ ] A **clear glass jar**
- [ ] Something that is **not packaging at all**, a plant or a mug, which
      should come back `no_packaging_found`
- [ ] A metal can
- [ ] Corrugated cardboard
- [ ] A thin plastic film wrapper
- [ ] A dark or blurry photo, so `photoQuality` has something to say

## Writing expected.json

An array, one entry per photo. `expected` holds the code you believe is
correct for each attribute; leave out any attribute you genuinely cannot call
yourself, and the script will print what came back without scoring it.

```json
[
  {
    "file": "yogurt-tub-faded.jpg",
    "note": "symbol worn almost smooth",
    "expected": {
      "material": "pp",
      "form": "rigid",
      "recyclingSymbol": "faded",
      "construction": "single_material",
      "contamination": "light_residue",
      "photoQuality": "good"
    }
  },
  {
    "file": "houseplant.jpg",
    "note": "not packaging at all",
    "expected": { "error": "no_packaging_found" }
  }
]
```

The codes are the six closed lists in
[the spec](../index.md#feature-design), mirrored in `proxy/api/schema.ts`.

## Why the images are committed

They are small, and a baseline you cannot rerun is not a baseline. If you
change the prompt meaningfully, bump `PROMPT_VERSION` in `proxy/api/prompt.ts`
and run this again: the old results describe a prompt that no longer exists.
