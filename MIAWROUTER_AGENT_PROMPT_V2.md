# MiawRouter — Agent Build Prompt (v2)

> Paste ke coding agent (Claude Code / Codex / OpenCode / Cursor).
> English on purpose — agent lebih presisi. Komentar kode boleh ID/EN.

---

## 0. ROLE & MISSION

You are a senior systems engineer building **MiawRouter**, a local-first, self-hosted LLM gateway written in **Rust**.

MiawRouter sits between coding agents (Claude Code, Codex CLI, OpenCode, Cursor, Cline, Copilot, Continue, Roo, Kilo) and many LLM providers. It exposes **one OpenAI-compatible endpoint** plus a **native Anthropic Messages endpoint**, and adds: multi-layer caching, quota-aware routing, token compression, a genuinely well-designed real-time dashboard, and honest measured analytics.

### The three things that must be better than the incumbents

The reference points are **9Router** (`decolua/9router`, ~24.7K★) and **OmniRoute** (`diegosouzapw/OmniRoute`, a fork of 9Router, currently v3.8.50, ~23.6K★). Study both. Then beat them on exactly three axes:

1. **Real caching.** Neither implements provider prompt-caching orchestration — they only do client-side text compression and call it token savings. MiawRouter does both, and prevents them from destroying each other.
2. **Measured, not claimed.** Their headline numbers (89% savings, 15–95%) are self-reported and unreproducible; OmniRoute's own issue #4268 documents stacked compression recording ~3% actual against a 89% claim. Every number MiawRouter shows must trace to a runnable benchmark.
3. **Security by default.** 9Router shipped a hardcoded JWT secret that became **CVE-2026-49352 (CVSS 9.8, auth bypass)**; OmniRoute inherited the same pattern (`omniroute-default-secret-change-me`) and additionally had npm 3.8.5 flagged by Socket.dev. MiawRouter must be safe with zero configuration.

Also worth studying (steal the good ideas, skip the ToS-violating ones): `router-for-me/CLIProxyAPI` (Go, the original), `BerriAI/litellm`, `maximhq/bifrost`.

---

## 1. STACK (do not deviate without asking)

| Layer | Choice | Why |
|---|---|---|
| Language | **Rust**, edition 2021, stable | No GC pauses on the proxy hot path, one static binary |
| HTTP server | `axum` + `tower` + `hyper` | Streaming-first, composable middleware |
| Runtime | `tokio` multi-thread | |
| Upstream client | `reqwest` (rustls, HTTP/2, streaming) | |
| DB | SQLite via `sqlx`, WAL mode | Local-first, zero external deps |
| Hot cache | `moka` async (TTL + LRU) | Sub-ms |
| Shared cache | Redis via `fred`, feature-flagged | Multi-instance only |
| Vector index | `hnsw_rs` in-process | No external vector DB |
| Tokenizers | `tiktoken-rs` + `tokenizers` (HF), per-family map | Real counts, never estimates |
| Dashboard | **SvelteKit + TypeScript + Tailwind v4**, static build embedded via `rust-embed` | One binary, no Node at runtime |
| Charts | `uPlot` (time series, tiny + fast) + hand-rolled SVG for the live wire | Recharts/Chart.js are too heavy for 20 ev/s |
| Realtime | **SSE** primary; WebSocket only for bidirectional control | SSE survives proxies; OmniRoute's WS-only choice caused repeated port-collision bugs (see their v3.8.47 notes) |
| Config | TOML + env overrides via `figment` | |
| Errors | `thiserror` (libs) + `anyhow` (bins) | |
| Observability | `tracing` (JSON) + optional OTLP; `metrics` → Prometheus | |
| i18n | `fluent` (server) + typed message catalog (web); ship `en` + `id` | |

Go (`axum`→`chi`/`fiber`, `sqlx`→`sqlc`) is acceptable **only if you justify it first**. Default = Rust.

---

## 2. WORKSPACE

```
miawrouter/
├── crates/
│   ├── miaw-core/        # domain types, config, errors, traits
│   ├── miaw-proto/       # OpenAI | Anthropic | Gemini schemas + translators
│   ├── miaw-provider/    # Provider trait + one module per provider
│   ├── miaw-catalog/     # provider/model catalog, pricing, free-tier registry
│   ├── miaw-cache/       # L0–L3 (see §4)
│   ├── miaw-compress/    # compression engines (see §6)
│   ├── miaw-router/      # strategies, health, circuit breaker, quota
│   ├── miaw-store/       # sqlx models, migrations, analytics queries
│   ├── miaw-telemetry/   # metrics, tracing, SSE event bus
│   ├── miaw-mcp/         # MCP server exposing MiawRouter as tools
│   ├── miaw-server/      # axum app, auth, embedded dashboard
│   ├── miaw-cli/         # setup wizard, doctor, bench, catalog verify
│   └── miaw-bench/       # benchmark harness (see §10)
├── web/                  # SvelteKit dashboard
├── catalog/              # *.toml provider & model catalog (hot-reloadable)
├── migrations/
└── docs/
```

---

## 3. PROVIDER LAYER

### 3.1 Trait

```rust
#[async_trait]
pub trait Provider: Send + Sync {
    fn id(&self) -> &ProviderId;
    fn capabilities(&self) -> Capabilities; // streaming, tools, vision, prompt_cache,
                                            // thinking/reasoning_effort, max_ctx, embeddings
    fn native_format(&self) -> WireFormat;  // OpenAI | Anthropic | Gemini | Custom

    async fn chat(&self, req: ChatRequest, ctx: &CallCtx)
        -> Result<BoxStream<'static, ChatChunk>, ProviderError>;
    async fn embeddings(&self, req: EmbedRequest) -> Result<EmbedResponse, ProviderError>;
    async fn models(&self) -> Result<Vec<ModelDescriptor>, ProviderError>;
    async fn health(&self) -> HealthReport;
    async fn quota(&self) -> Option<QuotaSnapshot>;
}
```

Adding a provider = one file + one registry line + one integration test against recorded fixtures. **Zero provider-specific `if` branches in the router.**

### 3.2 Credentials — READ CAREFULLY

Supported:

1. **API keys** — primary path. Per-provider multi-key pools, round-robin + gap-fill (bulk-add must never overwrite existing keys — that was a real 9Router bug), per-key quota + spend tracking, per-key enable/disable.
2. **Standard OAuth 2.0 + PKCE** — only where a provider publishes a documented third-party OAuth flow and the user registers their own client credentials. Generic implementation: auth-code + PKCE, refresh at 75% of TTL, encrypted token storage, per-provider scopes, revocation from the dashboard.
3. **Local endpoints** — Ollama, llama.cpp, LM Studio, vLLM, TGI, any OpenAI-compatible base URL.

**OUT OF SCOPE — do not implement, scaffold, or leave TODOs for:**

- Extracting/reusing/proxying OAuth session tokens belonging to subscription CLI or IDE products (Claude Code, Codex CLI, Antigravity, Copilot, Cursor, Kiro) to serve traffic those subscriptions were not sold for.
- Any MITM / TLS-interception / traffic-hijack bridge against those tools.
- TLS fingerprint spoofing (uTLS-style) or anti-bot evasion against provider infrastructure.
- Keep-warm pings or synthetic traffic designed to game a provider's quota window.

These violate every affected provider's terms and get user accounts banned — and they're the specific features that make the incumbents legally fragile. Build the abstraction, not the circumvention: if a provider ships a real third-party OAuth app flow later, it drops into mode (2) with no special-casing. That's the point of the trait.

### 3.3 Provider catalog — target 60+ at v1, all via API key or local endpoint

**Free / no-card tiers (flag these `tier = "free"` in the catalog):**

- **OpenCode Zen** — `https://opencode.ai/zen/v1`, OpenAI-compatible, Bearer token from `opencode.ai/auth`, no billing details required for free-tagged models. Model list: `GET /zen/v1/models`.
  - **Free-only filter is a first-class feature.** The Zen free set *rotates* (Big Pickle, MiMo V2 Pro Free, MiMo V2 Omni Free, MiniMax M2.5 Free, Nemotron 3 Super/Ultra Free, DeepSeek V4 Flash, North Mini Code Free, GPT-5 Nano have all appeared). So: never hardcode the list. Poll `/models`, detect free models by (a) a `-free` id suffix, (b) zero/absent pricing in the metadata, (c) an explicit catalog override — then expose a toggle **"OpenCode Zen: free models only"** that hard-filters routing to that set. Re-poll every 6h, diff, and surface "3 free models added, 1 removed" in the dashboard.
  - **Data-retention warning is mandatory.** Zen documents that some free models retain and train on submitted data (Big Pickle and North Mini Code during their free periods; Nemotron 3 Ultra Free is trial-use only). Show a persistent, non-dismissible badge on any route using those models, and a one-time confirmation before first use. Store the retention flag in the catalog per model; default to warning when unknown.
- **OpenCode Go** — the low-cost subscription tier (~$10/mo, first month $5) with a curated open-model set (Kimi K2.5 with vision, among others). Same base URL family, separate credential entry, separate catalog tier `tier = "subscription"`. Do **not** conflate it with the free tier in the filter.
- Google AI Studio (free tier), Groq (free tier), Cerebras, NVIDIA NIM, Cloudflare Workers AI, OpenRouter free models, Mistral free tier, GitHub Models, Scaleway, Together (trial), Chutes, Targon.

**API-key providers:** Anthropic, OpenAI, Google Vertex, Azure OpenAI, AWS Bedrock, DeepSeek, Moonshot/Kimi, Zhipu/GLM, MiniMax, Qwen/DashScope, xAI, Mistral, Cohere, Perplexity, Fireworks, Together, Anyscale, Hyperbolic, DeepInfra, Novita, Nebius, SambaNova, Lambda, Baseten, Replicate, OpenRouter, LLM Gateway, AI21, Reka, Upstage, Inflection.

**Embeddings:** Voyage, Jina, OpenAI, Cohere, Mistral, NVIDIA, Together, Fireworks.

**Local:** Ollama, llama.cpp, LM Studio, vLLM, TGI, KoboldCpp.

**Catalog requirements:**
- `catalog/*.toml`, hot-reloadable, versioned, each model carrying: context window, max output, pricing (input / output / cache-write / cache-read), capabilities (tools, vision, reasoning-effort, prompt-cache), free-tier flag, data-retention flag, deprecation date.
- `miawrouter catalog verify` diffs the local catalog against every provider's live `/models` and reports drift. Run it in CI weekly.
- **Free-tier aggregator page** (OmniRoute does this well and it's genuinely useful): compute total documented free capacity across connected providers, dedupe shared upstream pools, and show one honest number with a "how this is computed" link. Publish the methodology. Never round up.
- **Effort-tier aliases**: expose `model:low` / `model:medium` / `model:high` that map to a provider's reasoning-effort or thinking-budget parameter where supported, normalized across providers.

---

## 4. CACHE SUBSYSTEM — the core of the project

Four independent layers. Each separately toggleable, separately measured. Every request records which layers hit or missed and why.

### L0 — Provider prompt-cache orchestration (the layer nobody else builds)

Not our cache — making the *provider's* cache work as well as possible. This is where the real money is: Anthropic cache reads run ~10% of input price, writes ~125%.

- **Passthrough & preserve.** Anthropic `cache_control: {type:"ephemeral"}` blocks and OpenAI/DeepSeek/Gemini implicit-cache prefixes must survive translation, compression, and routing **byte-identically**. Any mutation upstream of a breakpoint destroys the cache — that is a correctness bug, not a tradeoff.
- **Automatic breakpoint insertion** when the client sends none: system prompt → tool definitions → stable document blocks → conversation-history prefix. Respect the 4-breakpoint limit; place at the largest stable prefixes by token count.
- **Prefix-stability tracking.** Per session, hash the token prefix at each candidate breakpoint. Only place one where the hash held stable ≥2 turns — a breakpoint on churning content costs 1.25× for nothing.
- **Sticky provider routing.** Once a request warms a provider's cache, subsequent same-session requests return to that provider+account while TTL is warm, unless unhealthy or quota-dead. Track TTL per breakpoint (5 min default, 1h where offered). Surface "cache warm — expires in 4m12s" live.
- **Compression interlock (critical).** Enforce in the *type system*, not a runtime check: the compressor only ever receives a `Compressible` segment; the cached prefix is a distinct non-compressible type it cannot access. Property test: cached-prefix bytes identical pre- and post-pipeline.
- **Accounting from actuals.** Parse `cache_creation_input_tokens` / `cache_read_input_tokens` and per-provider equivalents. Compute real money saved from catalog pricing. Never estimate when the provider reports actuals.

### L1 — Exact-response cache

Key = BLAKE3 of `(normalized_body, model, temperature, top_p, tools, seed)`. Only when `temperature == 0` or `seed` pinned — anything else isn't reproducible and must not be served from cache (config knob, safe default). Never cache: mid-conversation tool-call turns, `no-store` header, errored responses. `moka` + optional Redis mirror. Headers: `X-Miaw-Cache: hit|miss|bypass`, `X-Miaw-Cache-Layer: L1`.

### L2 — Semantic cache

Embed the final user turn + rolling context summary; HNSW cosine, default threshold `0.97`, per-route overridable.

Guardrails — a wrong semantic hit is worse than a miss:
- Never serve when tool definitions or tool results are present.
- Never serve for code-generation intents — near-identical prompts want different code.
- Require model-*family* match, not just model match.
- Log similarity for every hit; ship a **review queue** UI where the user marks false hits, feeding threshold auto-tuning.
- Track and display **false-hit rate**, not just hit rate.
- Fail-closed: embedding call fails → miss, never block or error.

### L3 — Cross-turn content dedup

Content-address large blocks (file contents, tool output, pasted docs). On repeat within a session, replace with a reference marker + compact restatement, full text only at first occurrence, with a legend block so the model can resolve references. Auto-disable when the block sits inside a cached prefix — L0 always wins.

### Per-request cache metrics (all must appear in the dashboard)

```
cache_l0_write_tokens, cache_l0_read_tokens, cache_l0_breakpoints_placed,
cache_l0_prefix_stable, cache_l1_hit, cache_l2_hit, cache_l2_similarity,
cache_l2_false_hit_marked, cache_l3_bytes_elided,
provider_sticky_kept, provider_sticky_broken_reason,
cost_without_cache_usd, cost_actual_usd, savings_usd
```

**If you cannot measure a savings claim, you may not display it.**

---

## 5. ROUTING ENGINE

Strategies (all implemented, selectable per-route and per-combo): `priority-fill-first`, `round-robin`, `weighted`, `least-used`, `least-latency`, `p2c`, `cost-optimized`, `context-fit`, `cache-sticky` (default when L0 active), `quality-tier`, `random`, `strict-random`, `failover-chain`.

Plus **auto**: score candidates on health, remaining quota, p95 latency, cost/token, recent success rate, cache warmth, context fit, and freshness. Weights configurable. **Expose the full scoring table per candidate in the dashboard** — routing decisions must be explainable, never a black box.

Resilience:
- **Circuit breaker** per provider+account: closed → open after N failures in window → half-open probe → closed.
- **Error classification, not blanket cooldowns.** Distinguish `rate_limit_tpm` (short backoff, retry same provider), `quota_exhausted_period` (cooldown until the known reset time), `auth_failure` (mark account bad, notify, no retry), `context_overflow` (re-route to a larger-context model automatically), `server_error` (next provider), `content_filter` (do not retry blindly), `permanent_ban` (long lockout, loud dashboard alert). 9Router's flat 30m/1h generic cooldown is the anti-pattern here.
- **Real reset times.** Parse `retry-after` and provider reset headers. Show "Exhausted — resets in 2h14m", never a fake 100% bar (a documented 9Router UI bug).
- Failover reads from an **in-memory health cache, target <1ms** — never a DB read on the hot path.
- Per-provider concurrency limits via semaphores, tunable per provider.
- **Peer-loop guard**: if MiawRouter is configured to route through another gateway instance, detect and refuse cycles.

---

## 6. COMPRESSION PIPELINE (always secondary to caching)

Engines, independently toggleable, stackable in configured order:

1. `lite` — whitespace/format normalization, lossless, safe default-on.
2. `tool-output` — command-aware filters for noisy tool results: git diff/status, grep, find, ls, tree, npm/cargo/pip/go logs, docker, test runners, stack traces, JSON blobs. Auto-detect by sniffing the first 1KB. **If a filter throws, produces larger output, or fails validation → silently keep the original.** Errors must never break a request.
3. `prose` — filler/hedging removal, non-system messages only.
4. `history-aging` — summarize turns older than N, keep last K verbatim.
5. `columnar` — lossless compaction of homogeneous JSON arrays into a columnar form with a legend.
6. `semantic-prune` — optional ONNX token classifier, worker thread, never blocks the event loop.

**Learn loop** (good idea from OmniRoute's RTK MCP tools): capture raw tool-output samples, detect repeated noise patterns, and *suggest* new filters for the user to approve. Suggest — never auto-apply an unreviewed filter.

**Hard preservation rules (property-tested):** code fences, URLs, JSON/YAML, file paths, tool schemas, system prompts, and anything inside an active cache prefix are never modified.

**Honesty rule:** report measured `tokens_before` / `tokens_after` from the real tokenizer, per request. Never multiply upstream project claims to manufacture a headline. If a mode saved nothing, analytics must say **"attempted, 0 saved"** with a reason — never silently skip and leave the user wondering why the number didn't move. (This is exactly what OmniRoute #4268 got wrong.)

Per-request bypass header: `X-Miaw-Bypass: compression,cache-l2`.

Explicitly **not** implementing: context-as-image / OCR-style compression. It's provider-specific, fragile, and its accuracy claims are unverifiable.

---

## 7. HTTP SURFACE

```
POST /v1/chat/completions     # OpenAI-compatible, streaming + non-streaming
POST /v1/messages             # Anthropic-native, full cache_control passthrough
POST /v1/embeddings
GET  /v1/models               # merged catalog, filterable: ?tier=free&capability=vision

GET  /api/providers           # status, quota, health, circuit state
POST /api/providers/:id/connect
GET  /api/catalog/free-tiers  # aggregate free capacity + methodology
GET  /api/routes  /api/combos # CRUD
GET  /api/analytics?since=    # tokens, cost, savings by layer
GET  /api/requests            # filterable, paginated log
GET  /api/requests/:id        # full trace
GET  /api/events              # SSE live stream (§8)
GET  /metrics                 # Prometheus
GET  /healthz  /readyz
```

Model addressing: `provider/model`, user-defined aliases, `auto`, and effort suffixes (`model:high`).

**MCP server** (`miaw-mcp`): expose MiawRouter itself as MCP tools — `miaw_list_providers`, `miaw_route_status`, `miaw_analytics`, `miaw_suggest_filter`, `miaw_cache_stats`. Tools must report honest action states (`planned` vs `applied`) — never claim an action succeeded when it was only queued.

---

## 8. DASHBOARD — design brief, not a checklist

Read this section as a design brief. The incumbents' dashboards are dense but generic: gamification streaks, achievement badges, vanity counters. MiawRouter's dashboard should read like an **instrument panel for a network operator** — the aesthetic of a trading terminal or an oscilloscope, not a SaaS marketing page.

### Direction

- **Subject-grounded:** this thing watches traffic move. The signature element is the **live wire** (below). Everything else stays quiet so it carries the page.
- **Palette:** dark-first, but not the default near-black + acid-green. Pick a deliberate 5–6 color token set and state it before building. Reserve exactly one saturated accent for "cache hit" — that event should be the most visually satisfying thing in the product, because it's the thing the product is for.
- **Type:** one characterful display face used sparingly for section headers, one clean UI face for body, and a **tabular-figure mono for every number** (critical — figures must not jitter as they update). Set an explicit type scale.
- **Density:** high information density, generous within rows. No hero card that says "1,247" in 72px.
- **Motion:** the wire animates; nothing else does. Respect `prefers-reduced-motion` — when set, the wire becomes a static flow diagram with live counters instead.

### The live wire (signature element)

An SVG flow: **client → MiawRouter → [L0 L1 L2 L3] → provider**. Requests visibly travel the wire. Cache hits short-circuit back with the accent color before ever reaching the provider. Failovers visibly re-route to a different provider node. Provider nodes size by traffic share and dim when their circuit opens.

Fed by SSE at `/api/events` with typed events: `request_started`, `provider_selected` (with scoring breakdown), `cache_probe` (per layer, hit/miss + similarity), `compression_applied` (before/after), `upstream_first_token`, `stream_chunk` (throttled), `request_completed` (full accounting), `provider_health_changed`, `quota_updated`, `circuit_state_changed`.

Throttle to ≤20 events/sec to the browser; coalesce beyond that and show "+142 more/s". Never let the animation queue outrun real time.

### Pages

| Page | Contents |
|---|---|
| **Overview** | Live wire, req/s, p50/p95/p99 latency, tokens/min, spend today, cumulative measured savings |
| **Cache** | Hit rate per layer over time, L0 warm-prefix inspector with TTL countdowns, semantic-hit review queue with similarity scores and a "mark false hit" action |
| **Providers** | Health grid, real quota with real reset countdowns, circuit state, latency histograms, per-key breakdown |
| **Free tiers** | Aggregate free capacity, per-provider breakdown, data-retention warnings, "3 free models added since yesterday" diff feed |
| **Routing** | Combo builder, strategy picker, live candidate scoring table |
| **Requests** | Searchable log; each row expands to a waterfall trace: routing decision → cache probes → compression → upstream TTFB → completion |
| **Compression** | Per-engine measured savings with attempted / skipped / no-op / saved states **and the reason for each** |
| **Costs** | Spend by provider/model/day, cost-without-cache vs actual, budget alerts |
| **Settings** | Providers, keys, cache, compression, security, language |

### Responsive & quality floor (non-negotiable)

- Three real breakpoints: **≥1280px** (full instrument panel, wire + side rail), **768–1279px** (wire collapses above a single stacked column, tables become priority columns), **<768px** (wire becomes a compact vertical flow; tables become cards; bottom tab bar). Test all three.
- Tables: sticky headers, virtualized rows (`svelte-virtual-list` or equivalent) — the request log will hit 100k rows.
- Keyboard: visible focus rings everywhere, `⌘K` command palette, `j/k` row navigation on the request log.
- Accessibility: WCAG AA contrast, semantic landmarks, live regions announcing state changes (not every event — that's a screen-reader firehose; announce circuit changes and errors only).
- Every displayed number gets a tooltip explaining exactly how it was computed and from which fields.
- Empty states are instructions, not decoration: a provider with no key says "Add a key to start routing here," with the button inline.
- Errors say what happened and what to do. No apologies, no vagueness.
- **No gamification.** No streaks, no badges, no achievements. This is infrastructure.
- PWA manifest + offline shell for the dashboard. Optional Tauri desktop wrapper (not Electron — keep the binary small).

Before writing dashboard code: produce a short token plan (palette hexes, type pairing, layout concept, signature element) and an ASCII wireframe of Overview at all three breakpoints. Review it against this brief for genericness, revise, *then* build.

---

## 9. SECURITY — non-negotiable

The incumbents' failure mode is the spec here. Do not repeat it.

1. **No default secrets, ever.** First boot generates a random JWT secret, stored 0600. If unset and none exists → generate. Never fall back to a constant. Refuse to start if a supplied secret matches a known-weak list.
2. **Bind `127.0.0.1` by default.** `0.0.0.0` requires an explicit `--allow-remote` flag **and** configured auth; otherwise refuse with a clear error.
3. **Credential encryption is mandatory, not opt-in.** AES-256-GCM or XChaCha20-Poly1305, key via Argon2id from an OS-keyring master secret. No plaintext path exists. (OmniRoute's encryption only activates if an env var is set — that's the bug.)
4. **Forced admin password** at first-run setup. No default password.
5. **Never log prompt bodies or credentials.** Redacted by default; full-body logging is per-route opt-in with a visible dashboard banner while active.
6. CORS whitelist (no `*`), CSRF on state-changing routes, rate limiting on auth endpoints, constant-time credential comparison, scoped tokens for remote mode with expiry and revocation.
7. **Supply chain:** `cargo-deny` + `cargo-audit` in CI, pinned lockfile, no network in `build.rs`, no vendored obfuscated/minified code, reproducible builds, signed releases with published checksums, SBOM per release.
8. **Release integrity:** a `check:pack-artifact` equivalent that boots the packaged binary in a clean container before publish. OmniRoute shipped three separate releases that crashed on boot because a file was missing from the tarball — a smoke test would have caught all three.

Ship `SECURITY.md` with the threat model and a disclosure path.

---

## 10. BENCHMARK HARNESS — the credibility feature

`crates/miaw-bench` + `miawrouter bench`.

- Replays recorded session fixtures (real coding-agent traffic: tool calls, large file reads, multi-turn refactors) across a config matrix: each cache layer on/off, each compression mode, each routing strategy.
- **Mock provider by default** — deterministic, free, CI-runnable. Real providers behind an explicit flag.
- Outputs reproducible reports: tokens sent, per-layer cache hit rate, measured cost, p50/p95/p99, TTFB, semantic false-hit rate, delta vs no-cache baseline.
- Fixtures and exact commands published in `docs/BENCHMARKS.md`. **Every performance claim in the README must link to the benchmark that produces it.**
- Include a **cache-integrity fixture**: assert compression + translation + routing leaves cached-prefix bytes byte-identical.
- CI runs the suite on every PR and fails on regression beyond a threshold.

---

## 11. DATA MODEL

`providers`, `provider_accounts`, `api_keys` (encrypted), `models` (catalog snapshot), `routes`, `combos`, `sessions`, `requests` (every §4 field), `cache_entries`, `semantic_index_meta`, `semantic_false_hits`, `quota_snapshots`, `health_events`, `settings`, `audit_log`.

Indexes: `requests(created_at)`, `requests(provider_id, created_at)`, `requests(session_id)`, `cache_entries(key)`, `cache_entries(expires_at)`. Configurable retention with a background pruner. `miawrouter db export` / `import` for backup.

---

## 12. QUALITY BAR

- Unit tests per crate; provider integration tests against `wiremock` fixtures.
- **Property tests** for the invariants that matter: cached-prefix byte integrity, compression never touching preserved constructs, translator round-trip fidelity across OpenAI ↔ Anthropic ↔ Gemini.
- Fuzz the proto translators.
- `criterion` on the hot path. Hard budget: **cache lookup <1ms p99, total added overhead <5ms p99** excluding upstream.
- Zero `unwrap()`/`expect()` in library crates on non-const paths.
- `#![deny(warnings)]` in CI, `clippy::pedantic` with documented exceptions.
- CI matrix: linux/macos/windows × amd64/arm64. Ship: single binary, Docker multi-arch, Homebrew, `cargo install`, and a Termux-compatible build.

---

## 13. BUILD ORDER — ship vertically, working software each step

| M | Deliverable |
|---|---|
| **M1** | Workspace, config, SQLite, `/v1/chat/completions` proxying to ONE provider with streaming. End-to-end working. |
| **M2** | Provider trait + 8 providers incl. **OpenCode Zen with the free-only filter** + local (Ollama). Catalog + `/v1/models`. |
| **M3** | Proto translators (OpenAI ↔ Anthropic ↔ Gemini) + fuzz + round-trip property tests. `/v1/messages` native. |
| **M4** | **L0 cache orchestration** — passthrough, auto-breakpoints, prefix stability, sticky routing, real accounting. Prove integrity with property tests. |
| **M5** | Routing engine: all strategies, health cache, circuit breaker, error classification, real quota + reset times, peer-loop guard. |
| **M6** | L1 + L3 + compression pipeline with the cached-prefix interlock enforced in types. |
| **M7** | Telemetry: metrics, SSE event bus, request tracing, analytics queries. |
| **M8** | Dashboard pass 1: token plan → wireframes → Overview with live wire, Providers, Requests waterfall. All three breakpoints. |
| **M9** | L2 semantic cache + guardrails + false-hit review UI. |
| **M10** | Dashboard pass 2: Cache, Free tiers, Routing, Compression, Costs, Settings, command palette, i18n (en + id). |
| **M11** | Security hardening (§9), `SECURITY.md`, cargo-deny/audit, packaged-binary smoke test. |
| **M12** | Benchmark harness + published reproducible numbers + `docs/BENCHMARKS.md`. |
| **M13** | Remaining providers to 60+, MCP server, CLI setup wizard, `miawrouter doctor`, packaging, docs. |

---

## 14. WORKING RULES FOR YOU (the agent)

- Work milestone by milestone. After each: run the full suite, report what passes, report what you stubbed.
- **Never stub something and claim it works.** If a piece is incomplete, say so explicitly in the summary.
- Ask before adding anything not in this spec.
- Every performance or savings number appearing anywhere — README, dashboard, docs, commit messages — must trace to a benchmark in `miaw-bench`. **No inherited claims, no multiplied estimates, no upstream marketing numbers.** Treat a fabricated metric as a build-breaking bug; it is the one thing this project exists to do better.
- Prefer boring, obvious code on the hot path. Spend cleverness on cache logic, not the proxy loop.
- Conventional commits, granular. Write `docs/ARCHITECTURE.md` as you go.
- Credit upstream work honestly in `docs/CREDITS.md` — the ideas from 9Router, OmniRoute, CLIProxyAPI, RTK and Caveman that shaped this. Attribution costs nothing and the incumbents did it well.

**Start with M1.** Print the workspace plan first, then build it.
