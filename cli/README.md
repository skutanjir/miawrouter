# miawrouter

CLI launcher for the MiawRouter local AI routing gateway and dashboard.

`miawrouter` installs, starts, and manages the MiawRouter server locally. The server exposes one OpenAI-compatible endpoint (`/v1`) and a dashboard, and routes requests across 40+ upstream providers with format translation, fallback, credential management, quota tracking, and token refresh.

---

## Install

```bash
npm install -g miawrouter
```

Or run directly:

```bash
npx miawrouter
```

## Bundled Antigravity Fixer

The package includes the MIT-licensed `fulldiagnose/antigravity-fixer` source.
With Python 3.10+ installed, the install hook prepares its isolated Python environment.
If install scripts are disabled, Python is missing, or the download fails, install
Python and run `miawrouter antigravity-fixer setup` to finish setup. Git is not required.

```bash
miawrouter antigravity-fixer --help
miawrouter antigravity-fixer setup
miawrouter antigravity-fixer clean --confirm-clean
```

Cleanup never runs during installation. The clean command stops Antigravity and
deletes local credentials, data, cache, settings, and extensions. Back up first
and run on the computer where Antigravity is installed. The full upstream terminal
workflow is available with `miawrouter antigravity-fixer interactive --confirm-clean`;
it downloads its browser when invoked and prompts for Google credentials there.
The dashboard uses Google verification links and MiawRouter OAuth instead.
English is the default in both the recovery panel and terminal workflow.
The panel distinguishes Antigravity eligibility, Gemini Code Assist eligibility,
Google validation requests, expired tokens, and generic access errors. It starts
with verification or OAuth where appropriate; local cleanup is an optional
Advanced step with a data-deletion acknowledgment, never a universal repair.

## Start

```bash
miawrouter
```

- Dashboard: `http://127.0.0.1:21128/dashboard`
- API: `http://127.0.0.1:21128/v1`
- Data directory: `~/.miawrouter`

### CLI options

```bash
miawrouter                    # start with default settings
miawrouter --port 8080        # custom port
miawrouter --no-browser       # don't open the browser
miawrouter --log              # show server logs
miawrouter --tray             # run in system tray mode
miawrouter --skip-update      # skip the auto-update check
miawrouter --help             # show all options
```

## Point a CLI tool at MiawRouter

```
Claude Code / Codex / Cursor / Cline / any OpenAI-compatible tool:
  Endpoint: http://127.0.0.1:21128/v1
  API Key:  [from the dashboard → API Keys]
  Model:    cc/claude-opus-4-7   (or any model/combo id)
```

Any tool that supports an OpenAI- or Claude-compatible API works.

---

## Data location

- **macOS/Linux**: `~/.miawrouter` (SQLite at `~/.miawrouter/db/data.sqlite`)
- **Windows**: `%APPDATA%\miawrouter`
- **Docker**: `/app/data` (mount `~/.miawrouter` to persist)

---

## Documentation

- [Full README](../README.md)
- [Docker guide](../DOCKER.md)
- [Security policy](../SECURITY.md)

## License

MIT — see [LICENSE](LICENSE).
