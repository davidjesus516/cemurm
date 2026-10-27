## What changed and why

<!-- One or two sentences. Reference related issues (e.g. "Closes #42"). -->

## Checklist

- [ ] Focused on a single change; related issue referenced
- [ ] `pnpm lint` passes with zero warnings
- [ ] `pnpm test` is green
- [ ] `pnpm typecheck` is green — **CI does not run it**, so it must be run locally
- [ ] `bash scripts/check-visual-contract.sh` passes
- [ ] ≤400 changed lines, or this PR is part of a documented `-prN-` chain
- [ ] Screenshots attached for UI changes
- [ ] At least one review requested (never self-approve)
