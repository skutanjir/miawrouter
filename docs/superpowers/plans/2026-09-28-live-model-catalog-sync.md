# Live Model Catalog Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist live models from every active provider connection every five minutes and keep Codex CLI model/effort metadata current.

**Architecture:** Extend the existing background token-refresh tick instead of starting another timer. A focused catalog-sync service normalizes provider responses, expands Codex effort presets, upserts them through the existing custom-model KV repository, and merges Codex records into `~/.codex/models_cache.json`.

**Tech Stack:** Next.js 16 route handlers, Node.js filesystem APIs, existing SQLite/sql.js KV adapter, Vitest.

## Global Constraints

- Reuse the existing five-minute scheduler and 10-second initial delay.
- No new dependencies, endpoints, or browser polling.
- Provider and filesystem failures remain fail-open and never delete the last successful catalog.
- Manual custom-model fields win when an auto-discovered model has the same key.
- Codex effort presets route to the base upstream model; review models are not expanded into invalid `review-effort` IDs.

---

### Task 1: Catalog Normalization and Persistence

**Files:**
- Create: `src/lib/catalog/liveModelCatalog.js`
- Modify: `src/lib/db/repos/aliasRepo.js`
- Modify: `src/lib/db/index.js`
- Test: `tests/unit/live-model-catalog.test.js`

**Interfaces:**
- Produces: `normalizeLiveModels(connection, models)` returning custom-model records.
- Produces: `mergeCodexModelsCache(cache, models)` returning a cache object without filesystem effects.
- Produces: `syncConnectionModelCatalog(connection, dependencies?)` for scheduler use.
- Produces: `upsertCustomModels(models)` returning `{ added, updated }`.

- [ ] **Step 1: Write failing normalization and cache-merge tests**

Cover provider-prefix stripping, metadata retention, Codex GPT-6 Sol/Luna effort expansion, review-model exclusion from effort expansion, fallback through `getThinkingLevels`, and preservation of unrelated Codex cache entries.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm --prefix tests exec -- vitest run --config tests/vitest.config.js --root . tests/unit/live-model-catalog.test.js`

Expected: FAIL because `liveModelCatalog.js` and `upsertCustomModels` do not exist.

- [ ] **Step 3: Implement the minimum normalization, batch upsert, and cache merge**

Use `getProviderAlias`, `getThinkingLevels`, the existing KV transaction pattern, and `fs.rename` after writing a sibling temporary cache file. Keep all resolver/filesystem dependencies injectable for tests.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm --prefix tests exec -- vitest run --config tests/vitest.config.js --root . tests/unit/live-model-catalog.test.js`

Expected: PASS.

### Task 2: Shared Five-Minute Scheduler Integration

**Files:**
- Modify: `src/sse/services/backgroundTokenRefresh.js`
- Modify: `tests/unit/background-token-refresh.test.js`

**Interfaces:**
- Consumes: `syncConnectionModelCatalog(connection)` from Task 1.
- Produces: one tick that independently performs due-token refresh and live-catalog sync for all active connections.

- [ ] **Step 1: Write failing scheduler tests**

Assert every active connection is offered to the catalog synchronizer, one catalog failure does not stop another, token refresh still runs only for due OAuth connections, and an empty due-token list no longer exits before catalog sync.

- [ ] **Step 2: Run scheduler tests and verify RED**

Run: `npm --prefix tests exec -- vitest run --config tests/vitest.config.js --root . tests/unit/background-token-refresh.test.js`

Expected: FAIL because the tick does not call a catalog synchronizer.

- [ ] **Step 3: Add catalog sync to the existing tick**

Load connections once, run token refresh and model sync as separate `Promise.allSettled` batches, and retain the existing overlap guard and kill switch.

- [ ] **Step 4: Run scheduler tests and verify GREEN**

Run: `npm --prefix tests exec -- vitest run --config tests/vitest.config.js --root . tests/unit/background-token-refresh.test.js`

Expected: PASS.

### Task 3: Codex Settings Cache Repair

**Files:**
- Modify: `src/app/api/cli-tools/codex-settings/route.js`
- Modify: `tests/unit/cli-tool-settings-roundtrip.test.js`

**Interfaces:**
- Consumes: `mergeCodexModelsCache(cache, models)` and `writeCodexModelsCache(models)` from Task 1.
- Produces: every Codex settings apply repairs an existing cache entry instead of skipping it.

- [ ] **Step 1: Write a failing round-trip test**

Pre-create a Codex cache entry for `cx/gpt-6-sol` with only `low` effort, apply settings, then assert the entry contains all supported GPT-6 Sol efforts while unrelated entries remain unchanged.

- [ ] **Step 2: Run the round-trip test and verify RED**

Run: `npm --prefix tests exec -- vitest run --config tests/vitest.config.js --root . tests/unit/cli-tool-settings-roundtrip.test.js -t "Codex settings"`

Expected: FAIL because the route skips existing cache entries.

- [ ] **Step 3: Replace append-only cache logic with the shared merge helper**

Normalize the selected full model ID, derive its supported levels, and atomically merge it into the cache on every apply.

- [ ] **Step 4: Run the round-trip test and verify GREEN**

Run: `npm --prefix tests exec -- vitest run --config tests/vitest.config.js --root . tests/unit/cli-tool-settings-roundtrip.test.js -t "Codex settings"`

Expected: PASS.

### Task 4: Verification

**Files:**
- Verify all files changed above.

- [ ] **Step 1: Run focused regression tests**

Run: `npm --prefix tests exec -- vitest run --config tests/vitest.config.js --root . tests/unit/live-model-catalog.test.js tests/unit/background-token-refresh.test.js tests/unit/thinking-levels-gpt56-sol.test.js tests/unit/cli-tool-settings-roundtrip.test.js`

- [ ] **Step 2: Run lint and production build**

Run: `npm run lint`

Run: `npm run build`

- [ ] **Step 3: Inspect the final diff**

Run: `git diff --check`

Run: `git status --short`
