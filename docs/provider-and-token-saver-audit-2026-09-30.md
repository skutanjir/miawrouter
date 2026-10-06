# Provider and Token Saver audit — September 30, 2026

All 146 registry entries and 2,041 bundled model entries were checked. Model identity is scoped by service kind: an LLM and a speech model may intentionally share an id. No structural errors were found.

The read-only public catalog probe covered 57 registered HTTPS model-list sources:

| Result | Providers |
| --- | ---: |
| Recognized live model list | 25 |
| Credentials required (401/403) | 24 |
| Unavailable or empty upstream catalog | 3 |
| Network failure or timeout | 5 |
| Bundled catalog or specialized integration | 89 |

See [the complete report](provider-audit-2026-09-30.json). These are catalog probes, not inference tests or proof that every account can use every model. Credentials were not used in this report. OAuth, local, browser-session, and specialized providers need their own connection tests. Bundled entries are fallback choices and are not presented as freshly verified upstream models.

Model discovery now preserves each provider's authentication headers and prefixes, excludes account-only validation endpoints, normalizes Gemini/Ollama/string lists, and provides a bounded registry-based fallback for connection model refresh. OpenAI, Anthropic, and Gemini have explicit catalog sources. Redirects are disabled for authenticated registry catalog requests. Sonar's nonexistent model-list endpoint is replaced with a clearly labeled bundled catalog.

Primary references: [OpenAI models API](https://platform.openai.com/docs/api-reference/models), [Anthropic models API](https://platform.claude.com/docs/en/api/models/list), [Gemini models API](https://ai.google.dev/api/models), and [Perplexity's explanation of the missing models endpoint](https://community.perplexity.ai/t/request-for-clarification-and-activation-of-api-access-invalid-model-error-ai-risk-analysis-project/2177/2).

Run the audit again with `node scripts/audit-providers.mjs --live`. Its output goes to `node_modules/.cache/provider-audit.json`; omitting `--live` performs only structural checks.

## Token Saver setup

RTK runs inside MiawRouter and does not require Python. PXPIPE uses Node.js/npm. Headroom is an optional Python compression proxy; open **Token Saver → Setup Headroom** to see Python, uv, and pip detection.

- **Auto** prefers uv and falls back to pip.
- **uv** creates a private virtual environment and can download Python 3.12 when no supported interpreter is detected.
- **pip** requires Python 3.10+ with pip and venv, including the Windows `py` launcher.

Click **Install Headroom**, review the progress log, then **Start Headroom**. Installations target MiawRouter's private data directory. Existing global installations remain discoverable. Optional code/ML extras use the selected installer; removal is restricted to the private environment. Setup failures report actionable messages and can be retried.

The uv behavior follows [its environment documentation](https://docs.astral.sh/uv/pip/environments/). No Python packages were installed as part of the automated tests; installation commands were tested with isolated process mocks.
