<p align="center">
  <img src="public/miawrouter-banner.png" alt="MiawRouter Banner" width="100%">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/miawrouter"><img src="https://img.shields.io/npm/v/miawrouter.svg?style=flat-square&color=38bdf8" alt="npm version"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18.0.0-emerald.svg?style=flat-square" alt="Node version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License: MIT"></a>
  <a href="SECURITY.md"><img src="https://img.shields.io/badge/security-0600%20Zero--Leak-0284c7.svg?style=flat-square" alt="Security Posture"></a>
  <a href="#mitm-interception-engine"><img src="https://img.shields.io/badge/MITM-Antigravity%20%7C%20Cursor%20%7C%20Copilot-818cf8.svg?style=flat-square" alt="IDE MITM"></a>
  <a href="#providers-and-routing"><img src="https://img.shields.io/badge/providers-40%2B%20LLMs-cyan.svg?style=flat-square" alt="Supported Providers"></a>
</p>

<p align="center">
  <strong>MiawRouter</strong> is a high-performance local AI gateway, universal model router, and IDE traffic interceptor with a built-in web dashboard. It exposes a single OpenAI-compatible endpoint (<code>/v1/*</code>) and routes across 40+ AI providers with zero key leakage, format transformation, intelligent fallback combos, and multi-tier caching.
</p>

---

## Highlights

- 🐱 **Local-First & Private**: Runs 100% on your machine. Nothing leaves localhost unless explicitly routed to an upstream provider.
- 🔌 **Universal Compatibility**: One `/v1/*` endpoint for all your tools (Claude Code, Cursor, Codex, Cline, OpenCode, Hermes, etc.).
- 🎯 **IDE MITM Interceptor**: Transparently intercepts and reroutes network traffic from Google Antigravity IDE, Cursor, GitHub Copilot, and Amazon Q without editing config files.
- 🛡️ **Zero-Leak Security**: Auto-generated 0600 cryptographic secrets, TCP-socket IP verification, X-Forwarded-For stripping, SSRF protection, and weak-secret rejection gates.
- 💾 **L0–L3 Token Saver**: Fail-open multi-layer cache (Prompt-cache orchestration, Exact-match LRU, Semantic embeddings, and Context dedup).
- 🔀 **Fallback Combos & Multi-Account**: Define automatic failover chains (`subscription → cheap → free tier`) and round-robin multi-account pools.
- 🖥️ **Self-Hosted Integrations**: Native support for local LLMs, embeddings, STT, and TTS (whisper.cpp, llama.cpp, vLLM, Kokoro-FastAPI).

---

## Quick Start

### 1. Install Globally (Recommended)

```bash
npm install -g miawrouter
miawrouter
```

The web dashboard opens automatically at `http://127.0.0.1:21128/dashboard`.

### 2. Run from Source

```bash
git clone https://github.com/skutanjir/miawrouter.git
cd miawrouter
cp .env.example .env
npm install
PORT=21128 npm run dev
```

For production builds:
```bash
npm run build
PORT=21128 HOSTNAME=127.0.0.1 npm run start
```

### 3. Docker Container

```bash
docker build -t miawrouter .
docker run -d --name miawrouter \
  -p 21128:21128 \
  -v "$HOME/.miawrouter:/app/data" \
  -e DATA_DIR=/app/data \
  miawrouter
```

---

## First Run & Setup

1. **Create Dashboard Password**: Open `http://127.0.0.1:21128` from localhost. There is **no default password**; first boot requires setting an 8+ character password over loopback.
2. **Retrieve Your API Key**: Copy the generated API key from **Dashboard → API Keys**.
3. **Connect Providers**: Add your API keys, OAuth subscriptions, or free providers in **Dashboard → Providers**.
4. **Point Your Tools**: Set your CLI or IDE base URL to `http://127.0.0.1:21128/v1` with your MiawRouter API key.

---

## Configuring CLI Tools & IDEs

| Client Tool | Base URL | API Key | Model Format |
| --- | --- | --- | --- |
| **Claude Code** | `http://127.0.0.1:21128/v1` | MiawRouter Key | `claude-3-7-sonnet`, `gemini-2.5-pro`, combos |
| **Codex CLI** | `http://127.0.0.1:21128/v1` | MiawRouter Key | `o3`, `gpt-4.1`, combo IDs |
| **Cursor IDE** | `http://127.0.0.1:21128/v1` | MiawRouter Key | Any registered model ID |
| **Cline / Roo Code** | `http://127.0.0.1:21128/v1` | MiawRouter Key | OpenAI-compatible format |
| **OpenCode / Hermes** | `http://127.0.0.1:21128/v1` | MiawRouter Key | Any provider model |

---

## MITM Interception Engine

MiawRouter includes a built-in, transparent TLS MITM proxy (`src/mitm/`) designed to intercept, analyze, and reroute traffic directly from desktop coding tools without requiring custom base URL settings.

```
[ IDE (Antigravity / Cursor / Copilot) ]
               │
               ▼ (TLS redirected via local hosts/DNS)
      [ MiawRouter MITM :443 ]
               │
      ├── Decrypt with ephemeral local root CA (0600)
      ├── Normalize wire protocol (Protobuf / SSE / JSON)
      ├── Route through Model Synonyms & Fallback Combos
      └── Forward to chosen provider (OpenAI, Claude, Gemini, Local)
```

### Supported IDEs & Targets

- **Google Antigravity IDE**:
  - Intercepts `cloudcode-pa.googleapis.com` and `daily-cloudcode-pa.googleapis.com` (`:generateContent`, `:streamGenerateContent`).
  - Translates internal models (`gemini-3.8-flash-high`, `gemini-3.7-flash`, `gemini-pro-agent`) to any desired backend model.
- **Cursor**:
  - Intercepts `api2.cursor.sh` and `agent*.api5.cursor.sh` (`/BidiAppend`, `/RunSSE`, `/RunPoll`, `/Run`).
  - Supports byte-transparent Protobuf relay and optional wire capture.
- **GitHub Copilot**:
  - Intercepts `api.individual.githubcopilot.com` (`/chat/completions`, `/v1/messages`, `/responses`).
- **Amazon Q / Kiro**:
  - Intercepts `q.us-east-1.amazonaws.com`, `codewhisperer.us-east-1.amazonaws.com`, and `runtime.us-east-1.kiro.dev`.

### Wire Capture Mode (Opt-In & Privacy-Bounded)

To inspect raw gRPC/Protobuf and SSE frames for debugging without leaking sensitive prompt context:
```bash
# Metadata-only capture (method, path, byte counts, header names)
export MITM_CURSOR_CAPTURE=1

# Explicit raw bytes capture (stored strictly under $DATA_DIR/logs/mitm/ mode 0600)
export MITM_CURSOR_CAPTURE_FULL=1
```

---

## Security Architecture

MiawRouter is engineered with a strict defense-in-depth model:

```
                      INCOMING TRAFFIC
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
   [ Loopback (127.0.0.1) ]           [ Remote Network ]
            │                                 │
     Full Access Permitted          ┌─────────┴─────────┐
                                    ▼                   ▼
                            Dashboard (403)     /v1/* (Requires API Key)
                                                        │
                                                [ SSRF Guard Check ]
                                                        │
                                                [ TCP Socket IP Verified ]
```

1. **Loopback-Only Binding by Default**: Binds to `127.0.0.1:21128`. Remote requests to dashboard setup routes fail closed with HTTP 403.
2. **Auto-Generated Mode 0600 Secrets**: `JWT_SECRET`, `API_KEY_SECRET`, and `MACHINE_ID_SALT` are created on first boot as 32-byte cryptographic random values and saved with POSIX mode `0600`.
3. **Weak Secret Rejection Gate (`secret-policy.cjs`)**: Hardcoded or placeholder secrets (like `change-me`, `123456`, or documented examples) are rejected at startup before the server binds.
4. **Spoof-Proof Client IP**: `custom-server.js` derives client IP strictly from the underlying TCP socket and strips forged `X-Forwarded-For` headers unless behind a trusted loopback reverse proxy.
5. **SSRF Guard (`src/shared/utils/ssrfGuard.js`)**: Prohibits outbound requests and webhooks from targeting cloud metadata services (e.g. `169.254.169.254`), private IP ranges, or local loopback addresses.
6. **Isolated Build Packaging**: CLI packaging runs inside an isolated OS temporary directory with strict exclusion filters, guaranteeing that developer database files (`.db`), JWT tokens, or local credentials can never leak into published npm releases.

See [SECURITY.md](SECURITY.md) for the complete threat model and vulnerability disclosure policy.

---

## Providers and Routing

MiawRouter provides out-of-the-box drivers for 40+ providers located in `open-sse/providers/registry/`:

- **Leading Cloud Providers**: OpenAI, Anthropic, Google Gemini, DeepSeek, xAI, Groq, Mistral, Cohere, Together AI, SiliconFlow, Cerebras, OpenRouter.
- **Subscription OAuth Extraction**: Connect your active Claude Code, Codex, GitHub Copilot, or Cursor subscriptions. MiawRouter automatically refreshes tokens and maintains authenticated sessions.
- **Free Tier Catalog**: Built-in free provider models (Kiro, OpenCode Free, Vertex Free, etc.).
- **Self-Hosted & Local Runtimes**: Connect local speech-to-text (whisper.cpp), text-to-speech (Kokoro-FastAPI), embeddings, and LLMs (vLLM, Ollama, llama.cpp).

### Intelligent Fallback Combos

Create priority fallback groups directly in the dashboard:
```
Primary: Anthropic Claude 3.7 Sonnet (OAuth)
  ↳ Fallback 1: DeepSeek-V3 via SiliconFlow
      ↳ Fallback 2: Gemini 2.5 Flash (Free Tier)
```

---

## L0–L3 Token Saver Cache

MiawRouter features four fail-open caching layers in `open-sse/cache/` to minimize API latency and token expenses:

- **L0 (Prompt Cache Orchestrator)**: Preserves stable request prefixes so provider-side KV prompt caching remains active.
- **L1 (Exact Match LRU)**: High-speed in-memory cache for deterministic (`temperature=0`), tool-free completions.
- **L2 (Semantic Vector Cache)**: Identifies semantically identical queries using local vector embeddings and cosine similarity.
- **L3 (Content Deduplicator)**: Eliminates redundant conversational blocks and context payloads.

*Note: You can bypass caching on any individual request by passing `X-Miaw-Token-Saver: off`.*

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Local development workflow and tests.
- Step-by-step guide to adding a new provider in `open-sse/providers/registry/`.
- Conventional commit conventions and pull request checklists.

---

## License

MiawRouter is open-source software licensed under the [MIT License](LICENSE).
