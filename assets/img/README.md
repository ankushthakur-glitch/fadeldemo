# Images

`colon-diagram.png` — the anatomical drawing behind the Procedure report's
findings diagram (see `js/lib/segment-findings.js`). `colon-diagram.svg` is the
vector it is rendered from; keep the two in step if either is edited.

## Where it came from, and what was done to it

Derived from **"Colon (anatomy).svg"** by Mikael Häggström, from Wikimedia
Commons, released into the **public domain** — so it carries no attribution
requirement and nothing to clear before this ships.

  https://commons.wikimedia.org/wiki/File:Colon_(anatomy).svg

It is the same underlying drawing the design reference uses — the same haustra,
the same taenia band, the same appendix and sigmoid — but it ships tinted
through a green-orange-blue ramp and carries no labels. Three things were done
to it, all in one script kept beside this note in the session scratchpad:

1. **Re-hued.** Every colour re-mapped to the reference's pink with its
   lightness order preserved, so the bead modelling and the pale taenia keep
   doing their work.
2. **Placed.** Scaled and translated so the anatomy lands on the coordinates
   `data/colon-findings.js` calibrates its hotspots against.
3. **Labelled.** The eight callouts and their leader lines drawn on.

## Replacing it

Overwrite `colon-diagram.png`. No code change is needed provided the
replacement keeps the 800 × 533 aspect ratio and roughly the same framing — the
regions are percentage boxes over the image, not pixel offsets.

If the framing differs, turn on **Show regions** above the diagram to see every
target outlined at once, and adjust the `hotspot` percentages in
`data/colon-findings.js` to match. Those numbers were measured off the pixels
rather than eyeballed, so they hug the bowel rather than the label beside it.
