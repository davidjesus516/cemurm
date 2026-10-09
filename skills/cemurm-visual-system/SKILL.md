---
name: cemurm-visual-system
description: "Trigger: UI, styling, color, spacing, radius, motion, tokens, dark mode. Routes a CEMURM interface change to the right visual tier and enforces the contract."
license: Apache-2.0
metadata:
  author: "davidjesus516"
  version: "1.0"
---

# CEMURM Visual System

## Activation Contract

Load when creating or modifying any CEMURM interface — a page, component, token, colour,
spacing, radius, elevation, motion or dark-mode decision — and before reviewing one.

## Hard Rules

1. **No raw colour literals in `src/`.** Colours live in the `cem.*` scale declared
   in `tailwind.config.js` and nowhere else. That config is the single token
   source; `bash scripts/check-visual-contract.sh` reads every colour rule from it
   and from no other file.
2. **One accent, ever.** `cem.amber` at full saturation on the logo mark, the primary CTA, and
   the active or selected state. Nowhere else. A new colour token is a deliberate review, never
   a side effect.
3. **Classify the surface before styling it.** See Decision Gates. Styling tier 3 as tier 1 is
   the defect this skill exists to prevent.
4. **The projector surface is chrome-free.** No radius, no shadow, no translucency, no
   gradient, no personal annotation. `cem.stage.*` is the only palette it may use.
5. **No animation library in the authenticated bundle.** CSS-native motion comes first.
6. **Tailwind stays 3.4.19.** Never flip `checkJs`, never bump Tailwind to 4.
7. **Run `bash scripts/check-visual-contract.sh` and report its output.** A visual change is
   not done until the gate passes.

## Declared Token Source

```
token-source: tailwind.config.js
```

That line is the machine-readable form of Hard Rule 1, and
`scripts/check-visual-contract.sh` fails as **rule 08** if it ever names a file
other than the one the gate itself parses. Declare the token source here; do not
restate it in prose somewhere the gate cannot read it.

## Decision Gates

| The surface is | Tier | macOS language | Radius and depth |
|---|---|---|---|
| Nav, settings, dialogs, forms, auth, empty states | 1 | Full | Full scale, materials allowed |
| Song and setlist lists, tables, editors | 2 | Partial | Tighter; no material, no decorative shadow |
| Stage Mode — the musician's own tablet | 3a | Full | Depth and radius are correct here |
| Overlay / OBS — the projector | 3b | **None** | None. Chrome-free |

If it is read at distance in a dark room, it is tier 3. If it is touched, it is tier 1 or 3a.

## Execution Steps

1. Name the tier. State it in the report.
2. Read only the reference for that tier.
3. Consume tokens from `tailwind.config.js`. Never inline a value the token layer
   already expresses.
4. Run the gate. Fix violations in the source, never by loosening the check.

## Output Contract

Return the tier, the tokens consumed, the gate's PASS/FAIL/WARN lines, and any rule you
suspect is wrong, with evidence. Never present a green gate as covering a rule it skipped.

## References

- `references/apple-macos-visual-language.md` — tiers 1 and 2, with HIG provenance
- `references/tier-3-performance-surfaces.md` — tiers 3a and 3b
- `references/toolchain-options.md` — libraries, motion, external skills
- `assets/tokens.css` — **NON-AUTHORITATIVE.** Design rationale for the ramp:
  where the warm dark steps and the amber come from, and what was rejected. Not
  the token source (that is `tailwind.config.js`), not imported by the app, and
  read by no gate. Read it for the *why*; do not copy a value out of it.
