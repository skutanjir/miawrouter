# Live Model Catalog Sync Design

## Goal

Automatically discover and persist models from active provider connections every five minutes, including all provider-supported reasoning efforts and Codex CLI model metadata.

## Scope

- Reuse the existing background OAuth scheduler and its 10-second initial pass.
- Query only active connections that already have usable credentials.
- Reuse the existing provider model resolver used by the dashboard and `/v1/models`.
- Upsert successful live results into the existing `customModels` KV store without deleting older entries on provider failure.
- Normalize provider-prefixed IDs and preserve live metadata such as display name, kind, capabilities, context limits, and upstream IDs.
- For Codex, derive effort variants from live `supported_reasoning_levels`; fall back to the existing Codex thinking-level rules when the endpoint omits them.
- Merge Codex model and effort records into `~/.codex/models_cache.json` without replacing unrelated user data.

## Non-goals

- No new provider endpoints or browser polling loop.
- No deletion of manually added models.
- No changes to request routing semantics beyond making persisted models discoverable.
- No new dependencies.

## Architecture

The existing `backgroundTokenRefresh` interval becomes the shared maintenance tick. It loads active connections once, refreshes due OAuth credentials, and independently runs a fail-open catalog sync for each connected provider. Catalog fetching remains delegated to `resolveProviderConnectionModels`, so provider-specific authentication, token refresh, and parsers stay in one place.

The catalog sync writes through a focused database helper that uses the existing KV transaction pattern. Each model is keyed by provider alias, model ID, and type, making repeated ticks idempotent. Codex cache merging is isolated in a pure helper so effort expansion and preservation of existing cache fields can be tested without touching the filesystem.

## Data Flow

1. Server startup starts the existing scheduler.
2. After 10 seconds and every 5 minutes, load active provider connections.
3. For each connection, resolve the live model catalog with the existing resolver.
4. Normalize IDs, model type, names, metadata, and Codex effort variants.
5. Upsert records into `customModels`.
6. When the provider is Codex, merge the same normalized records into `~/.codex/models_cache.json`.
7. Swallow per-provider/network/cache errors, log only provider and count context, and retain the last successful data.

## Testing

- Unit test model normalization and Codex effort expansion, including GPT-6 Sol, GPT-6 Luna, and a model whose effort list is absent.
- Unit test idempotent metadata upsert behavior.
- Unit test scheduler behavior with injected loader/resolver dependencies so one provider failure does not stop other providers or token refresh.
- Unit test Codex cache merge preserves unrelated entries and adds missing effort levels.
- Run the focused unit tests, then the repository test command and lint/build checks appropriate for the touched files.

## Acceptance Criteria

- A connected provider's newly exposed model appears in `customModels` after the next scheduler tick.
- Repeated ticks do not create duplicate records or remove manual records.
- Codex GPT-6 Sol, GPT-6 Luna, and any live model with supported effort metadata expose every supported effort variant.
- Existing Codex cache entries retain their fields while missing models/efforts are added.
- A failed provider fetch leaves its previous records intact and does not prevent other providers from syncing.
