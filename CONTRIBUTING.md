# Contributing to MiawRouter

Thank you for your interest in contributing to **MiawRouter**! We welcome bug fixes, documentation improvements, new AI provider integrations, and optimizations.

---

## Code of Conduct

MiawRouter is committed to fostering an inclusive, welcoming, and harassment-free community. Please be respectful, constructive, and collaborative in all discussions, issues, and pull requests.

---

## Getting Started

### Prerequisites

- **Node.js**: `>=18.0.0` (Recommended: Node 20 LTS or later)
- **npm**: `>=9.0.0` (or `bun`)
- **Git**: For version control

### Local Development Setup

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/skutanjir/miawrouter.git
   cd miawrouter
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   # Or with Webpack:
   npm run dev:webpack
   ```

5. Open your browser at [http://127.0.0.1:21127/dashboard](http://127.0.0.1:21127/dashboard).

---

## Project Structure

```
miawrouter/
├── src/                      # Next.js 16 Web Dashboard & Gateway UI
│   ├── app/                  # App Router pages and API routes (/api/*, /v1/*)
│   ├── lib/                  # Database repos, auth services, tunnel adapters
│   ├── mitm/                 # Transparent IDE MITM interception engine
│   ├── shared/               # Shared components, hooks, constants, utils
│   └── sse/                  # SSE streaming handlers & services
├── open-sse/                 # Provider-agnostic routing, translation, and caching
│   ├── cache/                # L0–L3 Token Saver caching layers
│   ├── executors/            # Custom provider execution engines
│   ├── handlers/             # Chat completion core routing
│   ├── providers/registry/   # 40+ provider definitions (one per provider)
│   └── translator/           # Wire-format transformers (OpenAI, Claude, Gemini)
├── cli/                      # CLI binary (npm: miawrouter)
│   ├── cli.js                # Command-line entrypoint & interactive menu
│   └── scripts/build-cli.js  # Standalone bundler & packager
├── tests/                    # Vitest test suite
│   ├── unit/                 # Unit tests for providers, routing, security
│   └── translator/           # Golden snapshots & format translation tests
└── public/                   # Static assets, mascots, and provider brand logos
```

---

## Adding a New Provider

MiawRouter uses a modular registry where each provider lives in its own file under `open-sse/providers/registry/`.

### Steps:

1. **Create the provider definition:**
   Create `open-sse/providers/registry/myprovider.js`:
   ```javascript
   export default {
     id: "myprovider",
     name: "My Provider",
     category: "api_key", // or "oauth", "free", "self_hosted"
     baseUrl: "https://api.myprovider.com/v1",
     apiType: "openai",   // "openai" | "anthropic" | "gemini"
     models: [
       {
         id: "my-model-1",
         name: "My Model 1",
         contextWindow: 128000,
         supportsStreaming: true,
         supportsTools: true,
       },
     ],
     headers: (apiKey) => ({
       Authorization: `Bearer ${apiKey}`,
     }),
   };
   ```

2. **Register the provider:**
   Export the new definition in `open-sse/providers/registry/index.js`.

3. **Add provider icon (optional):**
   Place `myprovider.png` (or `.svg`) in `public/providers/` and register it in `src/shared/utils/providerIcon.js`.

4. **Add unit tests:**
   Add a test case under `tests/unit/` verifying request translation and model discovery.

---

## Running Tests

Run the test suite using:

```bash
# Run unit tests
npm test

# Run translation and snapshot tests
npm --prefix tests test -- unit/
```

Before submitting a pull request, ensure:
- All unit tests pass.
- No secrets, temporary files, or `.db` files are staged (`git status`).
- Next.js builds cleanly with `npm run build`.

---

## Commit Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) convention:

- `feat:` A new feature or provider integration
- `fix:` A bug fix or translation correction
- `docs:` Documentation updates
- `perf:` Performance improvements or cache optimizations
- `refactor:` Code restructuring without functional changes
- `test:` Adding or updating tests
- `chore:` Maintenance, dependency bumps, build script changes

**Example:**
```bash
git commit -m "feat(provider): add SiliconFlow deepseek-v3 streaming support"
```

---

## Security Disclosures

If you discover a security vulnerability, **please do not open a public issue**. Refer to [SECURITY.md](SECURITY.md) for instructions on responsible and private reporting.

---

## License

By contributing to MiawRouter, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
