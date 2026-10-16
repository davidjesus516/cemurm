# E2E: pull the Supabase stack from GHCR instead of ECR Public

## Objective

Make the `E2E Tests` workflow stop failing with `toomanyrequests` from Docker
image pulls, by pointing the Supabase CLI at a registry whose limits we control.

## Problem

`tests/e2e/global-setup.js` runs `supabase start` inside each of the three
browser jobs, which pulls the whole local stack. Supabase CLI 2.120.0
(`package.json`, `pnpm-lock.yaml`) resolves those images from
`public.ecr.aws/supabase/*` — AWS ECR Public — by default. Anonymous ECR Public
pulls are rate limited and GitHub-hosted runners share IPs, so the budget is
consumed by unrelated jobs as well.

Evidence this is the live failure, not a theory:

- `main` E2E run `38846066970` (`2f06b1f`): 36 × `toomanyrequests: Data limit
  exceeded`; every one of the 12 `Retrying after 4s:` lines names
  `public.ecr.aws/supabase/*`.
- PR #361's E2E run `38899435501` (`b9996c8`) with a successful
  `docker/login-action` step: 16 × `toomanyrequests: Rate exceeded`, again every
  retry on `public.ecr.aws/supabase/*`.

## Why #361's approach does not work

#361 authenticates Docker Hub (`docker/login-action@v3`). The workflow's own
post-step says `Logout from docker.io` / `Removing login credentials for
docker.io`, so the credential is scoped to `docker.io` only. The failing pulls
are `public.ecr.aws` — a different registry that a Docker Hub credential cannot
raise the limit for. The login genuinely succeeds and genuinely changes nothing.

## Why not just point at Docker Hub

The CLI does support `SUPABASE_INTERNAL_IMAGE_REGISTRY`, and it special-cases
`docker.io` to emit bare `supabase/<name>`. But three images CI needs are **not
published to Docker Hub** (checked against the Docker Hub tag API):

| image | Docker Hub | GHCR |
|---|---|---|
| `supabase/kong:2.8.1` | 404 | 200 |
| `supabase/vector:0.58.0-alpine` | 404 | 200 |
| `supabase/mailpit:v1.31.3` | 404 | 200 |

The other eight (`postgres:17.11.0.004`, `gotrue:v2.197.0`, `logflare:1.52.0`,
`postgres-meta:v0.100.0`, `realtime:v2.140.10`, `storage-api:v1.79.36`,
`edge-runtime:v1.77.4`, `studio:2026.10.05-sha-94b8b06`) exist on both. A Docker
Hub override would therefore fail on those three.

## Mechanism

The 2.120.0 binary carries the resolution function and its constants:

```js
var eBr = "SUPABASE_INTERNAL_IMAGE_REGISTRY",
    I9t = "public.ecr.aws",   // default
    nBr = "ghcr.io",
    rBr = "docker.io";
tBr = `${I9t}/supabase`;      // public.ecr.aws/supabase
E9t = `${nBr}/supabase`;      // ghcr.io/supabase

function b9t(e, n) {
  let r = registryFromEnv(n) ?? "public.ecr.aws";
  return r === "docker.io" ? e : `${r}/supabase/${imageWithTag(e)}`;
}
```

So any non-`docker.io` value becomes `${registry}/supabase/<name>:<tag>`, and
the CLI already knows `ghcr.io/supabase` as a first-class prefix. Setting the
variable to `ghcr.io` resolves every image to `ghcr.io/supabase/<name>:<tag>`,
which exists for all eleven.

## Scope

- `.github/workflows/e2e.yml` only.
- Set `SUPABASE_INTERNAL_IMAGE_REGISTRY: ghcr.io` at workflow level so
  `global-setup.js` inherits it in all three browser jobs.
- Authenticate GHCR with the automatic `GITHUB_TOKEN` (`packages: read`) rather
  than configured secrets, which also removes the fork-PR failure mode: a fork
  PR has no repo secrets but does have a `GITHUB_TOKEN`.
- No credentials to configure, so no silent-skip guard is needed.

## Acceptance criteria

1. All three browser jobs pull from `ghcr.io/supabase/*` (visible in the job log).
2. No `toomanyrequests` in any job.
3. E2E green on the PR, verified from the step list — not from the badge alone.

## Checks

- `yaml.safe_load` parses the workflow.
- CI: the real verdict. This unit is not "done" on a local parse alone; absence
  of `toomanyrequests` in the run log is the evidence.

## Progress

- [ ] Add `SUPABASE_INTERNAL_IMAGE_REGISTRY: ghcr.io` to workflow env
- [ ] Add `packages: read` to `permissions`
- [ ] Add GHCR login step to the three browser jobs
- [ ] Push and verify in CI (ghcr.io pulls, no toomanyrequests, E2E green)
- [ ] Open PR

## Deviations / notes

- PR #361 (Docker Hub login) is superseded by this unit. Its pushed guard commit
  is retained only inside that branch and dies with it.
