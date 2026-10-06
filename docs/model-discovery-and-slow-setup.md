# Model discovery and slow Headroom setup

## Slow installations

Headroom setup now starts a background job and returns immediately. The dashboard polls job status and logs instead of holding one HTTP request open while Python dependencies download. Each setup step allows 45 minutes. HTTP download timeouts are 120 seconds with five retries; downloaded package caches are retained for subsequent attempts.

Keep MiawRouter running. You can close the setup panel and reopen it to resume monitoring. Restarting the server interrupts an in-process setup job. Base Headroom, code compression, and ML extras remain separate choices: the ML extra includes PyTorch and can require substantially larger downloads.

The reported five-minute timeout was observed while uv downloaded a 118.4 MiB PyTorch wheel for `headroom-ai[proxy,code,ml]`. The new behavior is covered by fake-clock tests that keep the process alive past five minutes and enforce the 45-minute limit.

## Get New Models

Every provider detail page has **Get New Models**. Choose an active account when several are connected, fetch the catalog, search or select models, then click **Save Selected**. Public catalogs can be previewed without a connection; saving requires an active connection so the server can validate the selection against the account catalog.

Saving upserts local model entries without deleting existing models or overwriting manual names. The server rechecks model identities and stores supported reasoning efforts. Upstream metadata takes priority; known model capability rules provide the fallback. **Auto** preserves the upstream default. Unsupported effort choices are not appended to a copied model id. Bundled fallbacks are labeled and cannot be saved as freshly discovered models.

## Catalog refresh on September 30, 2026

- OpenCode Go: 43 live upstream models; four missing base ids added to the bundled catalog.
- OpenCode Zen: 84 live upstream models; seven missing ids added.
- CommandCode: 86 live upstream models; ten missing ids added.
- Kiro: added the documented Opus 5.5 family and experimental Fable 5.1; account model discovery forces a fresh lookup and saves refreshed OAuth tokens if needed. Availability remains account/region dependent.

The full registry now contains 146 providers and 2,067 bundled entries, including existing synthetic variants. No duplicate identities within the same service kind were found.

OpenCode Go GPT/Grok models use the Responses endpoint; Qwen models use Messages. Format rules also cover future discovered models. Kiro GPT-5.6 supports `none`, `low`, `medium`, `high`, `xhigh`, and `max`; `max` is preserved on the wire. Native Claude `max` is also preserved, with unsupported `xhigh` on Claude 4.6 reduced to `high`.

Sources: [OpenCode Go](https://opencode.ai/docs/go/), [CommandCode Provider API](https://commandcode.ai/docs/provider), [Kiro models](https://kiro.dev/docs/models/), [Kiro reasoning effort](https://kiro.dev/docs/models/effort/).
