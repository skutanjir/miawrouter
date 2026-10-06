# MiawRouter Test Suite

Vitest suite covering the gateway engine (`open-sse/`), the Next.js app (`src/`),
and the translators. Run through the wrapper, not bare `vitest`, so config
resolution and the known-failing gate apply.

## Setup

```bash
npm install
npm --prefix tests install
```

## Running

From the repository root:

| Command | What it runs |
| --- | --- |
| `npm run test:ci` | Gated run — everything except `tests/known-failing.json` (currently empty). This is the CI gate. |
| `npm test` | Everything, including the quarantined backlog. |
| `npm run test:root` | Bare `vitest` for the whole repo (no gate). |
| `npx vitest run --config tests/vitest.config.js --root . <file>` | One file or pattern. |

`tests/vitest.config.js` aliases `@/` → `src/`, `open-sse/` → `open-sse/`, sets
`environment: node`, and runs with `maxConcurrency: 60`. `scripts/run-tests.mjs`
is the wrapper: no flags = gated, `--all` = everything, explicit paths = just
those files.

## Layout

| Path | Contents |
| --- | --- |
| `unit/` | ~300 focused tests: translators/executors, cache L0–L3, DB, API route contracts, auth/security, combos, headroom/pxpipe, antigravity, benchmark harness. |
| `translator/` | Data-driven matrix over `PROVIDER_MODELS`, golden snapshots, format round-trips, `bugs-*.test.js` (bug exposure via `it.fails`). |
| `translator/real/` | Live provider smoke tests, gated behind `RUN_REAL=1`; reads credentials from the local `~/.miawrouter` DB. 401/402/403/429 are skipped as credential issues. |
| `__baseline__/` | Characterization snapshots and the phase-1 gate artifacts (see below). |
| `helpers/` | `providerContract.js`, `cacheContract.js` shared harnesses. |
| `fixtures/providers/` | Provider-specific request/response fixtures. |

## Characterization baseline

`tests/__baseline__/phase1-characterization.json` pins the known failure set
(ids + SHA-256 signatures). The gate `scripts/test-baseline.mjs` allows only
failures that match an existing, categorized signature and never auto-rewrites
the baseline:

```bash
node scripts/test-baseline.mjs            # compare; exit 0 only if all matches
node scripts/test-baseline.mjs --record   # deliberate rewrite (requires categories)
node scripts/test-baseline.mjs --json F   # compare against a pre-captured run
```

`__baseline__/` also holds provider/alias/OAuth URL snapshots with their own
`--snapshot` verifiers (`verify-providers.mjs`, `verify-alias.mjs`,
`verify-oauth-urls.mjs`).

## Known failing

`tests/known-failing.json` quarantines pre-existing failing suites from the
blocking CI job. It is currently empty — quarantined suites were either fixed or
replaced with an explicit self-skip. Add an entry only with the evidence a fix
would need.
