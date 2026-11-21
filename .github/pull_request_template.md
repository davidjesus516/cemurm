## What changed and why

<!-- One or two sentences. Reference related issues (e.g. "Closes #42"). -->

## Chain Context

<!-- Delete this section for a standalone PR. For a stack, fill every field.
     "Starts at" is parsed by scripts/check-stack-diff.mjs: use the immediate
     parent branch, or `main` for the bottom slice. -->

| Field | Value |
|-------|-------|
| Chain | <feature or stack name> |
| Tracker PR | <#NNN or "Not needed"> |
| Position | <N of total> |
| Base | `<target branch>` |
| Depends on | <PR/issue/link or "None"> |
| Follow-up | <next PR or "None"> |
| Starts at | `<immediate parent branch>` or `main` for the bottom slice |
| Review budget | <changed lines> / 400 |
| Ends with | <standalone result delivered by this PR> |

### Chain Overview

```text
main
 └── #NNN Previous PR
      └── 📍 #NNN This PR
           └── #NNN Next PR
```

### Scope
- Includes: <focused unit>
- Excludes: <deferred work>

### Autonomy
- [ ] CI is expected to pass for this PR branch
- [ ] This PR has one deliverable scope
- [ ] This PR can be rolled back without unrelated changes
- [ ] Tests, docs, or manual verification cover this unit

## Checklist

- [ ] Focused on a single change; related issue referenced
- [ ] `pnpm lint` passes with zero warnings
- [ ] `pnpm test` is green
- [ ] `pnpm typecheck` is green
- [ ] `bash scripts/check-visual-contract.sh` passes
- [ ] ≤400 changed lines, or this PR is part of a documented `-prN-` chain
- [ ] Screenshots attached for UI changes
- [ ] At least one review requested (never self-approve)
