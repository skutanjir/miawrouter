# MiawRouter — Clone & Remediate Playbook

> Semua dikerjain agent, termasuk download source-nya (Phase −1).
> Kalau folder `miawrouter/` udah ada isinya, agent auto-skip ke Phase 0.
> Bukan fork, bukan clone, tanpa git sama sekali. Standalone & private.
> Paste ke coding agent. English on purpose.
> Pasangannya: `MIAWROUTER_AGENT_PROMPT_V2.md` (spec greenfield) — pakai itu sebagai target arsitektur akhir.

---

## PHASE −1 — BOOTSTRAP (agent does this too)

**Skip this phase entirely if you are already inside a `miawrouter/` directory that contains the extracted source.** Check first: `ls package.json` — if it's there and the project is 9Router, go straight to Phase 0.

Otherwise, acquire the source yourself:

```bash
# 1. find the current tag — do not assume a version, they release frequently
curl -s https://api.github.com/repos/decolua/9router/releases/latest | grep '"tag_name"'
curl -s https://registry.npmjs.org/9router/latest | grep -o '"version":"[^"]*"'

# 2. download that exact tag as a tarball — pin a tag, never refs/heads/master
TAG=<the tag you just found>
curl -L -o 9router-src.tar.gz \
  "https://codeload.github.com/decolua/9router/tar.gz/refs/tags/${TAG}"

# 3. extract into a folder named miawrouter
tar -tzf 9router-src.tar.gz | head -1        # check the top-level dir name first
tar -xzf 9router-src.tar.gz
mv "9router-${TAG#v}" miawrouter             # extracted dir usually drops the leading v
rm 9router-src.tar.gz
cd miawrouter
```

Notes:
- The archive arrives with **no `.git`** — nothing to delete. Verify with `ls -la` anyway.
- **Pin a tag, never a branch.** A `refs/heads/master` tarball is a moving target, and then nothing downstream can say which version this project started from.
- Report the tag you resolved and used before continuing. If the download fails or the tag doesn't exist, stop and report — do not silently fall back to a branch tarball.

Everything from Phase 0 onward assumes your working directory is `miawrouter/` with the source in it.

---

## 0. ROLE & MISSION

You are a senior engineer taking an existing open-source codebase as a **starting point for an independent project** and remediating it into a production-quality product.

**Working directory: `miawrouter/`, containing the extracted 9Router source.** No `git clone`, no `git init`, no `.git` anywhere in this project, ever.

**Source lineage:** `decolua/9router` (MIT, ~24.9K★, JavaScript/TypeScript + Next.js).
**Target:** **MiawRouter** — same core idea (local-first LLM gateway, one endpoint, many providers), but with the three things the original gets wrong actually fixed:

1. **Security that's safe by default** — the original requires manual hardening and shipped an auth-bypass CVE.
2. **Real provider prompt-caching orchestration** — the original has none; it only does client-side text compression.
3. **Honest, measured metrics** — every number traceable to a runnable benchmark.

You are not writing a competitor from scratch. You are inheriting ~180 contributors' worth of provider integrations and fixing what's broken around them.

---

## PHASE 0 — VIABILITY AUDIT (do this before writing a single line)

Do not start refactoring until you have answered these and reported back. If any answer is a blocker, stop and say so.

### 0.1 First four actions — before touching a single line of code

You are inside `miawrouter/` with the source present. Do these in order.

**1. Identify what you have.** The version is not in a git tag, so recover it from the files:

```bash
grep -m1 '"version"' package.json
ls -la                                   # confirm no .git — if one exists, rm -rf it
find . -maxdepth 2 -name "*.md" | head   # README, CHANGELOG often name the version
```

**2. Write `docs/UPSTREAM.md` immediately.** Record: lineage is `decolua/9router` (MIT), the version string you just found, the tag if determinable, and today's date. Cross-check how current your base is:

```bash
curl -s https://api.github.com/repos/decolua/9router/releases/latest | grep '"tag_name"'
curl -s https://registry.npmjs.org/9router/latest | grep -o '"version":"[^"]*"'
```

If the extracted copy is several releases behind, say so in your Phase 0 report — it changes whether hand-porting recent upstream fixes is worth doing early.

Without git history this file is the **only** record of where this codebase came from and which version it started at. Write it first.

**3. Make the pristine reference copy — now, before any edit.**

```bash
cd .. && cp -R miawrouter 9router-reference && chmod -R a-w 9router-reference && cd miawrouter
```

If you cannot write outside your working directory, fall back to an internal location instead:

```bash
mkdir -p .miaw/reference && cp -R ./* .miaw/reference/ 2>/dev/null
```

If you use the internal path, add `.miaw/` to `.gitignore`-equivalents, the build ignore list, the packaging exclude list, and the Phase 8 branding-check allowlist — otherwise you will be rebranding your own baseline and scanning it forever. Report which location you used.

This is your diff baseline for the life of the project (Phase 8.4). It must be an exact copy **as received**. Once you start editing you can never recreate it, and with no git it is the only way to answer "what did I change?" or to pull a later upstream fix.

**4. Set up the version-control substitute — mandatory, before any code changes.** Refactoring tens of thousands of inherited lines with no way to revert is the most likely way to lose a week of work: one bad multi-file edit and there is no undo.

- `make snapshot` — timestamped `tar.gz` of the working tree into `../miawrouter-snapshots/` (or `.miaw/snapshots/` if the parent isn't writable), excluding `node_modules`, build output, and the reference copy.
- Snapshot **before starting each phase** and **before any multi-file refactor**. Non-negotiable.
- Keep the last 20; prune older.
- `make restore SNAP=<name>` to roll back.
- Take snapshot #1 right now, labelled `phase0-as-received`.
- Also enable your editor's local history (VS Code keeps it by default) and any filesystem-level snapshots available.

If you find yourself wanting `git diff` more than twice in a session, say so — that's a signal worth raising, not working around silently.

### 0.2 License & attribution — private repo, minimal footprint

This is a **private project, not intended for public release.** That changes what's practical, but keep this straight: the MIT condition attaches to *copies and substantial portions* of the software, not specifically to public ones. A private copy is still a copy.

The practical reading:

- **Keep exactly two files: `LICENSE` and `docs/UPSTREAM.md`.** Nothing else. `LICENSE` holds the original MIT text with decolua's copyright line, plus our line beneath it. `UPSTREAM.md` records the source URL, the version, the tag if known, and the extraction date.
- That's the entire attribution footprint — two files nobody looks at in a private repo. They cost nothing and they're the difference between "independent project built on an MIT base" and a problem, the moment this repo ever becomes public, gets pushed to a shared account, is shown to an employer or examiner, or gets handed to a collaborator. Those things happen to side projects more often than people plan for, and reconstructing attribution after the fact — after 200 commits of rebranding — is genuinely hard.
- **Everything else gets stripped.** No upstream branding in code, config, logs, UI, docs, package metadata, or the README. See Phase 8 — that purge is thorough and non-negotiable, and it's what "make it mine" actually means. The two files above are the only exception.
- If this project is ever published, expand these into a proper `NOTICE.md` / `CREDITS.md` crediting `decolua/9router`, `router-for-me/CLIProxyAPI` (the Go implementation 9Router was ported from), and the upstream RTK and Caveman projects the token savers came from.

Skipping git removes the *history*, not the *provenance*. Two small files keep the provenance recorded without putting anyone else's name in front of a user.

### 0.3 ⚠️ Source completeness — the likely blocker
The 9Router README states the app package (`9router-app`) is **private**, and that source or Docker execution is the expected local dev path. **Verify what is actually in the public repo before committing to this codebase.**

Check and report:
- Does the repo contain the full server implementation (routing engine, provider adapters, dashboard), or only a CLI wrapper + build scripts around a private/published artifact?
- Is the npm package (`9router`, currently ~v0.5.50) shipping prebuilt/bundled output rather than buildable source?
- Can you run `npm install && npm run dev` from a clean clone and get a working server?

**If a meaningful part is closed or prebuilt-only, this codebase is not a viable starting point** — you would be patching a black box, and no amount of remediation fixes that. In that case report it and recommend one of:
- (a) clone **OmniRoute** (`diegosouzapw/OmniRoute`) instead — a full TypeScript rewrite of the same project, MIT, source-complete;
- (b) clone **`codestorm-official/9router-v3`** or **`ahwanulm/9router-v2`** — community rewrites on Express + Vite/React;
- (c) fall back to the greenfield Rust build in `MIAWROUTER_AGENT_PROMPT_V2.md`.

Do not silently pick one. Report the finding and the recommendation, then wait.

### 0.4 Codebase inventory
Produce `docs/AUDIT.md` covering:
- LOC by area, language/framework versions, build system, test coverage as it stands.
- Module map: entry point → routing → provider adapters → dashboard → storage.
- Dependency audit: `npm audit`, plus flag any obfuscated, minified-only, or vendored-binary dependencies. (OmniRoute's npm 3.8.5 was blocked by Socket.dev over suspicious install scripts — check whether anything similar exists here.)
- Every hardcoded secret, default credential, and `process.env.X || "some-default"` fallback. List them all; these are Phase 1's worklist.
- Which features are ToS-violating (Phase 2's removal list).

---

## PHASE 1 — SECURITY REMEDIATION (before any feature work)

The upstream project's own docs tell users that production deployments *require* manually changing `JWT_SECRET` and `INITIAL_PASSWORD` and enabling `REQUIRE_API_KEY`. **That is the bug.** Security that depends on the user reading the docs is security that fails. The hardcoded-default-secret pattern here became **CVE-2026-49352 (CVSS 9.8, authentication bypass)**, and the OmniRoute fork inherited it verbatim (`omniroute-default-secret-change-me`).

Fix, in this order:

1. **Kill every default secret.** Replace every `env.SECRET || "constant"` with: read env → else read generated secret file (0600) → else generate cryptographically random and persist. Never a constant fallback. Refuse to boot if a supplied secret matches a known-weak list (include the upstream defaults in that list explicitly).
2. **`REQUIRE_API_KEY` defaults to ON.** Opt out, not opt in.
3. **No default password.** First run forces admin password creation through the setup flow; no `INITIAL_PASSWORD` default.
4. **Bind `127.0.0.1` by default.** `0.0.0.0` requires an explicit `--allow-remote` flag AND configured auth, else refuse with a clear error message.
5. **Mandatory credential encryption at rest.** AES-256-GCM or XChaCha20-Poly1305, key derived via Argon2id from an OS-keyring master secret. Remove any code path that stores keys in plaintext. (OmniRoute's encryption only activates when an env var happens to be set — don't inherit that.)
6. **Redact by default.** No prompt bodies or credentials in logs. Full-body logging becomes per-route opt-in with a visible dashboard banner while active.
7. CORS whitelist (no `*`), CSRF on state-changing dashboard routes, rate limiting on auth endpoints, constant-time credential comparison, scoped + expiring remote-mode tokens with revocation.
8. **Release integrity gate.** Upstream shipped at least three releases that crashed on boot because a file was missing from the published tarball. Add a `check:pack-artifact` step: build the package, install it into a clean container, boot it, hit `/healthz` — fail the release if it doesn't come up.
9. `cargo-audit` equivalent for Node: `npm audit --audit-level=high` + `socket.dev` or `osv-scanner` in CI. Pinned lockfile. No network access in install scripts.

Write `SECURITY.md`: threat model, disclosure path, and an explicit statement of what changed versus upstream.

**Regression tests for every one of the above.** A test that boots with no env vars and asserts the server either generates a secret or refuses to start — never uses a constant.

---

## PHASE 2 — REMOVE OUT-OF-SCOPE FEATURES

Upstream's headline pitch is routing subscription-tier access (Claude Code, Codex, Antigravity, Copilot, Kiro) through the gateway. Strip all of it. Non-negotiable:

- OAuth session extraction/reuse/proxying for subscription CLI and IDE products, including any bulk account-import endpoints (e.g. the Codex account-export import path).
- Any MITM / TLS-interception bridge against those tools.
- TLS fingerprint spoofing (uTLS-style) or anti-bot evasion.
- Quota keep-warm pings or synthetic traffic that games a provider's quota window.

These violate every affected provider's terms, get user accounts banned, and are the reason the upstream projects are legally fragile. Removing them is a feature, not a regression — say so in the README.

**Keep and preserve:** API-key providers, local model endpoints (Ollama/vLLM/llama.cpp/LM Studio), and standard OAuth 2.0 + PKCE where a provider publishes a real third-party app flow with user-registered client credentials.

Removal must be surgical: delete the code paths, their routes, their UI entry points, their config keys, and their tests. No dead flags, no commented-out blocks, no "disabled by default" toggles that a user can flip back on.

---

## PHASE 3 — ARCHITECTURE STABILIZATION

Before adding anything new, make the inherited code safe to change:

1. **TypeScript strict mode**, `noUncheckedIndexedAccess`, no implicit `any`. Fix the fallout.
2. **Extract the provider adapters behind one interface** (see `MIAWROUTER_AGENT_PROMPT_V2.md` §3.1 for the shape). Every provider-specific `if` branch in the router moves into an adapter. This is the prerequisite for everything in Phase 4.
3. **Characterization tests first.** Before refactoring a module, write tests that pin its *current* behavior — including behavior you think is wrong. Then refactor. Then fix the wrong behavior deliberately, with the test change in the same commit as the reason.
4. **Kill the WebSocket-only realtime layer.** Upstream hit repeated port-collision bugs from an in-process WS server on a fixed port. Replace with SSE at `/api/events` (see V2 §8). Keep WS only if something genuinely needs bidirectional control.
5. Replace estimate-based token counting with real tokenizers (`tiktoken` + HF `tokenizers`), per model family.
6. Introduce a proper migration system for the datastore if one doesn't exist.

---

## PHASE 4 — THE CACHE SUBSYSTEM (the reason this project exists)

Implement L0–L3 exactly as specified in `MIAWROUTER_AGENT_PROMPT_V2.md` §4. Summary of what must land:

- **L0 — provider prompt-cache orchestration.** `cache_control` passthrough preserved byte-identically through translation, compression, and routing. Auto-breakpoint insertion. Prefix-stability tracking (≥2 turns before placing). Cache-sticky provider routing while TTL is warm. Accounting from provider-reported `cache_creation_input_tokens` / `cache_read_input_tokens`, never estimates.
- **Compression interlock.** The compressor must be structurally incapable of touching a cached prefix — enforce with types, not a runtime guard. Property test: cached-prefix bytes identical pre/post pipeline. **This is the single highest-value change in the whole project**, because upstream's aggressive compression actively destroys provider caches and their own docs admit it as a tradeoff rather than treating it as the bug it is.
- **L1** exact-response cache (temperature 0 / pinned seed only).
- **L2** semantic cache with the full guardrail set + false-hit review UI + measured false-hit rate.
- **L3** cross-turn content dedup, auto-disabled inside cached prefixes.

**Keep upstream's RTK tool-output filters** — they're genuinely good work (git-diff, git-status, grep, find, ls, tree, dedup-log, smart-truncate, read-numbered, search-list, auto-detect from the first 1KB, fail-safe to original on filter error). Credit them. Refactor them behind the new pipeline so they only ever receive the compressible segment.

**Fix the honesty problem.** Upstream reports stacked savings that don't reconcile with reality (OmniRoute issue #4268: 472 of 475 requests fell through to a mode averaging 3% against an advertised 89%). Requirements:
- Report measured `tokens_before` / `tokens_after` per request from the real tokenizer.
- When a mode saved nothing, record **"attempted, 0 saved"** with the reason — never silently skip.
- Delete every inherited marketing number from the README, dashboard, and docs. Re-derive each one from the benchmark harness or delete the claim.

---

## PHASE 5 — PROVIDERS

Keep every working API-key provider adapter you inherit (that's the main value of starting from this codebase). Then extend to 60+ per V2 §3.3. Priority additions:

- **OpenCode Zen** (`https://opencode.ai/zen/v1`, OpenAI-compatible, Bearer key from `opencode.ai/auth`) with the **free-only filter** as a first-class feature: never hardcode the free list — it rotates. Poll `/models` every 6h; classify free by `-free` suffix, zero/absent pricing, or catalog override; expose a "free models only" toggle that hard-filters routing; surface an added/removed diff feed.
- **Data-retention warnings are mandatory** on Zen free models — Zen documents that some retain and train on submitted data during their free period, and that certain trial endpoints are not for confidential data. Persistent non-dismissible badge + one-time confirmation before first use. Default to warning when the retention flag is unknown.
- **OpenCode Go** as a separate `subscription` tier, never folded into the free filter.
- Free/no-card tier: Google AI Studio, Groq, Cerebras, NVIDIA NIM, Cloudflare Workers AI, OpenRouter free models, GitHub Models, Mistral free tier.
- Catalog moves to versioned, hot-reloadable config with pricing (incl. cache-write/cache-read rates), context windows, capabilities, free-tier and retention flags, deprecation dates. Add `catalog verify` to diff against live `/models`.
- **Free-tier aggregator page** — worth porting from OmniRoute: dedupe shared upstream pools, publish the methodology, never round up.

---

## PHASE 6 — DASHBOARD: NEW DESIGN LANGUAGE

The inherited dashboard is a dark Next.js + Tailwind + shadcn card grid — the same look as every other AI-tooling dashboard, plus gamification. **Do not restyle it. Replace the design language entirely.** If a screenshot of MiawRouter is recognizable as 9Router with different colors, this phase failed.

### 6.0 Anti-patterns — explicitly do not carry over

- **Gamification.** No streaks, badges, achievements, levels, celebratory confetti. This is infrastructure.
- **The counterfactual savings headline.** Upstream's dashboard shows an estimated dollar figure representing "what you would have paid using paid APIs directly" and frames it as money saved. That number is fiction — the user never owed it. MiawRouter shows **actual spend** and, separately, **measured cache savings against what the same requests would have cost without caching**, which is a real counterfactual with a benchmark behind it. Never merge the two into one hero number.
- Dark-mode shadcn card grid, glassmorphism, gradient hero cards, purple/blue tech gradients, emoji in UI chrome, giant single-stat cards.
- Also avoid the three AI-default looks: cream ground + high-contrast serif + terracotta accent; near-black + acid-green; broadsheet hairline-rule columns. All are defaults, not choices.

### 6.1 Direction

**Light-first laboratory instrument.** Nearly every gateway dashboard is dark; going light is itself the differentiator, and it reads as a measurement instrument rather than a hacker tool. Think rack-mounted panel meters and lab equipment: cool neutral chassis, precise rules, one saturated signal color that only appears when something happens.

Dark mode ships too, but as a proper inversion with its own token values — not `dark:` classes bolted on.

### 6.2 Tokens

**Color — 6 values, light theme:**

| Token | Hex | Use |
|---|---|---|
| `--chassis` | `#E7EAEE` | Page ground, cool gray (not cream) |
| `--panel` | `#FBFCFD` | Card and panel surfaces |
| `--ink` | `#14161A` | Primary text, axis lines |
| `--muted` | `#666E7B` | Secondary text, labels |
| `--rule` | `#CFD5DC` | Borders, grid lines, dividers |
| `--signal` | `#FF4F00` | **Cache hit only** — nothing else may use it |

Two utility states outside the palette: `--warn #A16207`, `--fail #B42318`. Use sparingly.

**The `--signal` rule is the discipline of the whole design.** Blaze orange appears exclusively when a cache layer hits. Nowhere else — not on buttons, not on links, not on the logo. That way the eye learns it instantly, and the product's core value becomes the most visually satisfying event on screen. If everything is accented, nothing is.

Dark theme inverts `--chassis #15171B`, `--panel #1D2025`, `--ink #E8EBEF`, `--rule #2E333A`; `--signal` stays.

**Type — three roles:**

- Display (section headers, page titles): **Archivo**, weight 600, slight negative tracking, used at large sizes only and sparingly.
- Body / UI: **IBM Plex Sans**, 400/500.
- Data: **IBM Plex Mono** with `font-variant-numeric: tabular-nums` — **mandatory on every number**. Figures must not jitter as they update; a live dashboard with proportional digits looks broken.

Scale: 11 / 13 / 15 / 18 / 24 / 34. No sizes between. Line height 1.45 body, 1.15 display.

**Geometry:** border-radius 3px maximum (panels feel machined, not soft). 1px rules in `--rule`. 8px spacing grid. No drop shadows anywhere — depth comes from rules and surface value, which is what keeps it from reading as another card-grid dashboard.

### 6.3 Layout concept

A **persistent instrument rail**: the live wire is not a widget on the Overview page, it is a fixed strip across the top of the entire application, visible on every route — like a rack-mounted meter you never stop seeing. Navigation is a narrow left column with text labels. Content fills the rest.

```
┌──────────────────────────────────────────────────────────┐
│  MiawRouter        [ ═══ LIVE WIRE (persistent) ═══ ]    │  56px
├────────┬─────────────────────────────────────────────────┤
│Overview│                                                 │
│Cache   │   page content                                  │
│Provid. │                                                 │
│Free    │                                                 │
│Routing │                                                 │
│Request │                                                 │
│Compres.│                                                 │
│Costs   │                                                 │
│Settings│                                                 │
└────────┴─────────────────────────────────────────────────┘
```

### 6.4 Signature element — the live wire

SVG flow, always on screen: **client → MiawRouter → [L0 L1 L2 L3] → provider**.

- Requests render as small marks travelling left to right along the wire.
- A **cache hit short-circuits back** at the layer that caught it, flashing `--signal`. This is the one moment of color and motion in the product.
- A failover visibly re-routes to a different provider node mid-flight.
- Provider nodes size by traffic share; a node dims and gains a hatch fill when its circuit opens.
- Idle state is not empty: the wire shows a slow baseline pulse, so the panel always reads as live equipment.

Fed by SSE, throttled to ≤20 events/sec with coalescing above that (`+142 more/s`). Never let the animation queue outrun real time.

### 6.5 Responsive — three tested breakpoints

- **≥1280px** — full rail: persistent wire, left nav with labels, multi-column content.
- **768–1279px** — wire stays but compresses to a single lane; left nav collapses to icons; tables switch to priority columns.
- **<768px** — wire becomes a compact vertical flow above the fold; nav moves to a bottom tab bar; every table becomes a card list. This is a designed layout, not a squeezed desktop — build it as its own composition.

Test all three for real. Screenshot each.

### 6.6 Quality floor

- Virtualized tables (the request log will exceed 100k rows), sticky headers.
- `⌘K` command palette; `j/k` row navigation on the request log.
- WCAG AA contrast on every pair — verify `--muted` on `--panel` and `--signal` on `--panel` numerically, don't eyeball it.
- Visible keyboard focus everywhere. `prefers-reduced-motion`: the wire becomes a static flow diagram with live numeric counters — same information, no movement.
- Live regions announce circuit changes and errors only, never every event.
- Every displayed number gets a tooltip stating how it was computed and from which fields.
- Empty states are instructions with the action inline: "Add a key to start routing here." Errors say what happened and what to do — no apologies, no vagueness.
- Fix the inherited UI lies: no fake "100% used" bars — real reset countdowns parsed from provider headers ("Exhausted — resets in 2h14m").
- i18n: `en` + `id`. Check that Indonesian strings, which run longer, don't break the rail or table headers.

### 6.7 Process gate

Before writing any UI code, produce and show:
1. The token table as actual CSS custom properties.
2. Font loading strategy (self-hosted woff2, subset, `font-display: swap`).
3. ASCII wireframes of **Overview** at all three breakpoints.
4. A one-paragraph self-critique: name anything in the plan that you would have produced for any other dashboard brief, and change it.

Then build.

---

## PHASE 7 — ROUTING & RESILIENCE

Per V2 §5. Specifically fix these inherited weaknesses:
- Replace the generic flat cooldown with **error classification**: `rate_limit_tpm`, `quota_exhausted_period`, `auth_failure`, `context_overflow`, `server_error`, `content_filter`, `permanent_ban` — each with its own retry/backoff/lockout policy.
- Replace the fill-first sequential cascade with a **scored candidate model** (health, remaining quota, p95 latency, cost/token, success rate, cache warmth, context fit), and expose the full scoring table in the dashboard so routing is explainable.
- Circuit breaker per provider+account (closed → open → half-open probe → closed).
- Failover reads from an in-memory health cache, <1ms — never a DB read on the hot path.
- Fix the bulk-key-add path so it never overwrites existing keys.
- Peer-loop guard when chained to another gateway instance.
- Fix the known non-streaming 500 when an upstream returns SSE for a `stream=false` request: buffer and translate rather than erroring.

---

## PHASE 8 — TOTAL REBRAND

Only after Phases 1–2 land. **Goal: zero occurrences of upstream branding anywhere a user, log reader, or filesystem sees.** The only permitted survivors are `LICENSE` and `docs/UPSTREAM.md`.

### 8.1 Identifier map

Apply consistently. Build a table in `docs/REBRAND.md` and drive the change from it.

| Kind | From | To |
|---|---|---|
| Product name | 9Router / 9router | MiawRouter |
| Package name | `9router` | `miawrouter` |
| Binary / CLI | `9router` | `miawrouter` |
| Scope (if any) | `@9router/*` | `@miawrouter/*` |
| Docker image | `decolua/9router` | `miawrouter` |
| Default port | `20128` | pick a new one (e.g. `21128`) — must not collide |
| Config dir | `~/.9router` | `~/.miawrouter` |
| Env prefix | `NINEROUTER_` / bare names | `MIAW_` |
| HTTP headers | `X-9Router-*` (e.g. `X-9Router-Token-Saver`) | `X-Miaw-*` |
| DB / table prefix | any `9r*` | `miaw_*` |
| Log tags, metric names | `9router_*` | `miaw_*` |
| Domain references | `9router.com` | `miawrouter.web.id` |
| Repo/module paths | `github.com/decolua/9router` | local module path (no remote) |

### 8.2 Execution

1. **Inventory first.** `rg -i -n '9\s*router|9r_|X-9Router|20128|decolua|\.9router|9router\.com' --hidden` — write the full hit list to `docs/REBRAND.md` *before* changing anything. Count them. You need the before/after number to prove completeness.
2. **Don't blind sed.** A global find-replace will corrupt: `LICENSE` (must stay), lockfile integrity hashes, vendored dependency code, base64 blobs, and any legitimate use of the digit 9. Go directory by directory, review each hit, and keep a list of deliberate skips with reasons.
3. **Order:** identifiers and imports → config keys and env vars → HTTP headers and API surface → DB schema (with a migration) → log/metric names → UI strings and i18n catalogs → package metadata → docs and README → filenames and directory names.
4. **Check the non-obvious places:** `package.json` (name, bin, repository, keywords, author), lockfile, Dockerfile + compose, CI workflows, `.env.example`, systemd/launchd units, PWA manifest, favicon and icon assets, OG/meta tags, error message strings, i18n JSON catalogs (all locales), test fixture names, MCP tool names, npm publish config, and any embedded skill/agent definition files.
5. **Assets:** replace logo, favicon, icons, and any wordmark — new marks drawn to the Phase 6 design language, not upstream's artwork recolored. This is the rebrand step people skip and it's the most visible one.
6. **README rewritten from scratch.** Not edited — rewritten. State what MiawRouter is, what it does, how to run it. Link every performance claim to its benchmark or delete the claim.
7. **Migration helper:** `miawrouter migrate --from-9router` reads an existing `~/.9router` config and imports providers and keys, re-encrypting properly on the way in. This is the one place the old name legitimately appears in a flag, because it names the thing being read.
8. **Lint gate:** add a `make check-branding` script (run it in CI if you add CI later) that greps for upstream branding and fails on any hit outside the allowlist (`LICENSE`, `docs/UPSTREAM.md`, `docs/REBRAND.md`, the migrate flag). This is what keeps the rebrand from rotting as you keep pulling upstream fixes by hand.
9. **Verify:** re-run the Step 1 inventory. Expected result: only allowlisted hits. Report the before and after counts.

### 8.3 Domain

Public domain: **`miawrouter.web.id`**.

- Replace every `9router.com` reference with it: docs, README, PWA manifest `start_url`/`scope`, OG and Twitter meta tags, canonical links, email/support strings, and any hardcoded base URL fallback.
- The dashboard must **not** assume the public domain at runtime. Default `BASE_URL` stays `http://127.0.0.1:<port>`; the public domain is config, never a hardcoded default. Anything that reaches out to a remote host by default is a bug — this is a local-first tool.
- If you later put anything on that domain, it is a landing page and docs only. Do **not** build a hosted relay endpoint: upstream's public endpoint has documented failure modes (non-streaming requests 500 when the provider returns SSE), and running one means holding other people's traffic and credentials. Out of scope.
- `.web.id` requires Indonesian registrant identity documents at registration — worth knowing before you plan a launch around it.

### 8.4 Upstream tracking without git

Add `make upstream-diff`: a plain `diff -ru ../9router-reference/ .` wrapper that excludes `node_modules`, build output, and snapshots, and applies the rebrand map in reverse so the output stays readable. This is your only mechanism for seeing how far the project has drifted from its base.

To pull a later upstream fix: download the newer tag as a tarball into `../9router-<newtag>/`, then `diff -ru ../9router-reference/ ../9router-<newtag>/` to isolate what upstream actually changed between your base and that release. Hand-apply only the relevant hunks. Snapshot before you start, and update `docs/UPSTREAM.md` with what you pulled and from which tag.

```bash
curl -s https://api.github.com/repos/decolua/9router/releases/latest | grep '"tag_name"'
TAG=<newer-tag>
curl -L -o "9router-${TAG}.tar.gz" \
  "https://codeload.github.com/decolua/9router/tar.gz/refs/tags/${TAG}"
```

---

## PHASE 9 — BENCHMARK HARNESS

Per V2 §10. This is what makes MiawRouter credible rather than just another rebrand: replay recorded session fixtures across a config matrix, mock provider by default (deterministic, CI-runnable), publish fixtures and exact commands in `docs/BENCHMARKS.md`, include a cache-integrity fixture, and fail CI on regression.

**Every performance claim anywhere in the project must link to the benchmark that produces it.**

---

## EXECUTION ORDER

| Phase | Gate |
|---|---|
| −1 | Resolve tag, download, extract, `cd miawrouter` (skip if already there) |
| 0 | Provenance + reference copy + snapshot #1, then audit & viability report → **stop and wait for confirmation** |
| 1 | Security remediation + regression tests |
| 2 | Out-of-scope removal |
| 3 | TS strict, provider interface extraction, characterization tests, SSE |
| 4 | Cache subsystem L0–L3 + compression interlock + honesty fixes |
| 5 | Providers incl. OpenCode Zen free filter + Go |
| 6 | New design language + dashboard rebuild (token plan reviewed before any UI code) |
| 7 | Routing & resilience |
| 8 | Rebrand + migration path |
| 9 | Benchmarks + docs |

---

## WORKING RULES

- **Phase 0 ends with a report, not a refactor.** The initial-import commit is fine; changing code is not. If the source isn't complete enough to build on, say so plainly — recommending against this starting point is a valid and useful outcome.
- Characterization test before refactor. Always.
- Never stub and claim done. State explicitly what's incomplete in every summary.
- Never inherit a metric. If you can't reproduce a number with the benchmark harness, delete the claim.
- No git, so no commits: instead, end every work unit by appending a dated entry to `docs/CHANGELOG.md` describing what changed and which files it touched. This replaces commit history — keep it granular enough that it would read like one.
- Keep `docs/AUDIT.md`, `docs/UPSTREAM.md`, `docs/REBRAND.md`, and `docs/CHANGES-VS-UPSTREAM.md` current as you go. With no git history at all, these files are the *entire* memory of this project — what it inherited, what changed, and why. Treat them as source, not documentation.
- **Snapshot before every phase and every multi-file refactor.** There is no undo. Never begin a large refactor without confirming a fresh snapshot exists, and say so in your summary.

**Start with Phase 0. Report, then wait.**
