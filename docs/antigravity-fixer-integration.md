# Bundled Antigravity Fixer

MiawRouter CLI ships the MIT-licensed source of
[fulldiagnose/antigravity-fixer](https://github.com/fulldiagnose/antigravity-fixer)
at revision `ea7dbd46d4139b1b84dfd5b68824b9a7ad410800` under
`cli/vendor/antigravity-fixer`, including its license and provenance.
No Git clone or separate fixer installation is needed.

The dashboard and CLI default to English. The bundled `fix.py` has a documented
local change: `--lang` is honored in interactive mode and defaults to English.
It no longer prompts with Indonesian as the default selection.

Recovery follows the error, rather than applying one cleanup to every failure:

- Antigravity eligibility: review the account requirements, reconnect, and retry onboarding.
- Gemini Code Assist eligibility: review individual-account/location requirements and service access.
- `VALIDATION_REQUIRED`: complete the check requested by Google, then reconnect.
- Expired or revoked token: reconnect through OAuth first.
- Generic 403: inspect the full details before choosing recovery.

Guidance uses [Google's sign-in troubleshooting](https://github.com/google-gemini/gemini-cli/blob/main/docs/resources/troubleshooting.md).
Google may require support for account-side provisioning or eligibility failures;
local cleanup cannot override those decisions or complete verification.

The CLI postinstall hook creates a Python venv in MiawRouter's user-writable
runtime directory and installs the upstream requirements. Python 3.10+ is
required. A setup failure does not fail MiawRouter installation. If install
scripts were disabled, Python was unavailable, or the network failed, resolve
the prerequisite and run:

```sh
miawrouter antigravity-fixer setup
```

Each invocation probes dependency imports and repairs incomplete setup.
Environments are versioned by upstream revision. No cleanup, Google login,
or browser download runs during installation.

Open **Dashboard → Providers → Antigravity → Buka Antigravity Fixer** for
connection checks, Google verification/permission links, bundled CLI commands,
OAuth reconnection, and onboarding. Run cleanup on the computer where
Antigravity is installed, even if the MiawRouter server is hosted elsewhere:

```sh
miawrouter antigravity-fixer clean --confirm-clean
```

This stops Antigravity processes, removes local credentials, and deletes
CLI/IDE data/cache folders, potentially including settings and extensions.
Save work and back up first. Only the user's explicitly confirmed command
executes cleanup. Setup and help never clean. Unsupported flags are rejected
before Python launches. MiawRouter's database is not a cleanup target.
The dashboard keeps cleanup in a collapsed Advanced section and requires an
acknowledgment of data deletion before enabling its copy button. Copying a command
does not run it. Successful connection checks do not show stale historical errors.

The complete upstream interactive workflow is also available:

```sh
miawrouter antigravity-fixer interactive --confirm-clean
```

This fetches the Camoufox browser on demand and runs the upstream terminal
workflow, including its Google credential prompt. Credentials are not
collected by the dashboard or passed through the MiawRouter server.
The upstream `diagnose` command mentioned in its README is not implemented;
MiawRouter uses its own connection test. Cleanup cannot guarantee Google
account eligibility, model availability, or quota.
