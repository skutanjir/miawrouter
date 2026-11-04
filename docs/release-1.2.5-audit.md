# MiawRouter 1.2.5 audit notes

Status: work in progress. The version number identifies the development target; it does not establish release readiness.

## Comparison

Compared against `decolua/9router` master commit `1fe586b` (2026-10-28), under its MIT license. No code was copied from that checkout. The comparison is limited to the routing, retry, account fallback, and cache paths inspected; it is not a provider-by-provider certification.

| Area | Findings |
| --- | --- |
| Combo routing | Both implement ordered fallback and round-robin. MiawRouter also has race, fusion and capacity-based reordering. 9Router has a System One / smart session routing path; an equivalent classifier was not verified in MiawRouter. |
| Retry and cancellation | Both inspected executors used an uncancellable retry sleep. MiawRouter now aborts that sleep and releases its slot; request cancellation is passed through the main chat entry point. Other modality paths require separate review. |
| Account fallback | Invalid and cancelled requests no longer trigger account fallback. Model capability-specific retry remains an area for further review. |
| Cache | MiawRouter has scoped exact and optional semantic caches; semantic cache is disabled by default. Seed alone no longer qualifies a request for response caching. Even temperature zero is not a provider guarantee of deterministic output. Provider correctness and every modality have not been independently verified. |
| OpenCode Free | The bundled third-party bridge describes reproducing client identity to access a restricted free tier. The CLI no longer starts it automatically. Existing configuration and files are retained; supported upstream access should be preferred. |
| Provider capabilities, OAuth, MITM, tools, dashboard | Not comprehensively verified. Live tests need appropriate accounts and must not require secrets in chat. |

More specifically, 9Router's inspected `handleComboChat` accepts `smartPolicy`, `sessionSticky`, and `resolveSmartChoice`, and supports strict and per-turn session policies. MiawRouter's inspected combo implementation rotates by combo request count, which is different from pinning a specific conversation. Latency- or cost-based selection, complete quota-aware routing, and classifier behavior remain unverified. Neither the presence of these options nor a README claim proves superior routing or lower cost.

## Security and verification limits

- Optional request logging now redacts credential-bearing headers and URL fields. Request and response bodies can contain private content and must still be protected; existing logs are not modified.
- `npm audit --omit=dev` returned zero reported vulnerabilities after dependency updates on 2026-11-04. This is not a claim that the application or all development dependencies are secure.
- The CLI has no committed lockfile, so its direct production dependencies were separately resolved in a temporary directory and audited: npm reported zero vulnerabilities for that fresh resolution. It does not verify bundled application modules or reproduce a prior installation.
- On Windows, `npm run test:ci` passed 321 files; 14 were skipped, with 11 expected-failure tests and 91 skipped tests. POSIX permission-mode assertions are not applicable on Windows.
- Full lint completed with zero errors and 413 warnings after the missing Guardrails icon import was fixed. The warnings have not all been reviewed.
- Full `npm audit` still reports 16 moderate development-tool dependency findings. The suggested remediation includes major downgrades of ESLint tooling and has not been applied without compatibility validation.
- Root and CLI package metadata now require Node.js 20.18.1 or newer, matching the installed Undici dependency. The prior Node 18 CLI declaration was inconsistent with the bundled Next.js application.
- The locally installed tests workspace has a 1.2.5 lockfile, but `tests/package-lock.json` is ignored by the existing `tests/.gitignore`; it is not part of the tracked release diff.
- The CLI and MITM were rebuilt into a new temporary staging directory without replacing the existing `cli/app`. A staged server returned HTTP 200 from `/api/health` with an isolated temporary database. A subsequently packed 1.2.5 archive contained 3,794 entries; a limited scan found no suspicious secret filenames, complete PEM-like private-key blocks, or npm-token-pattern matches. The package includes 9Router attribution. This cannot establish that it contains no other secrets, nor does the health check verify every route.
- An earlier production build reported eight traced files outside its output tracing root, including throwaway build-home database/secret files and a temporary Devin client file; Next.js reported these were excluded. The Devin script is generated at runtime from source in a unique temporary directory; its final packaged behavior still needs a CLI integration test.
- The offline `cache-integrity` benchmark (mock upstream, one warmup and five measured iterations) exposed a streaming-completion `ReferenceError`. After passing the provider format into the completion callback, a repeat completed without that error. The original run was faulty, so its timing is not a valid before/after performance comparison.
- Before isolation was corrected, those benchmark runs used the repository's `.bench-data` directory and may have written mock usage records there. The directory was not deleted. Future runs use a new temporary data directory unless `MIAW_BENCH_DATA_DIR` is explicitly set.
- Windows does not implement POSIX mode bits as Unix does. POSIX permission assertions are not evidence of Windows ACL protection; explicit Windows ACL verification remains outstanding.
- Provider API keys and OAuth token fields are serialized into the SQLite connection data; encryption at rest was not found in the inspected repository path. Protect the database and backups. A compatible encryption migration and recovery design remain outstanding.
- The CLI build script now refuses to recursively clean an existing custom output directory or a symlinked default output. It still replaces the managed `cli/app` build directory; back up anything kept there before running the CLI build.
- The CLI now binds to loopback by default. Existing LAN users must opt in with `--host 0.0.0.0`; the Docker configuration remains separately configured to listen on container interfaces.
- CLI startup now checks the requested port and exits on conflict instead of terminating other processes, including unrelated Next.js applications. Stale process-cleanup routines remain in source but are no longer invoked at startup or by the update menu.
- Upstream provider availability, 503s, and account-specific behavior have not been tested with live user credentials.
- Distinguishing a genuinely empty successful stream from a valid tool-only or reasoning-only stream still needs end-to-end coverage. Ordered combo fallback returns once a successful response is handed to the client; post-output recovery for every strategy has not been independently verified.
- Streaming request detail is recorded as pending until normal completion; interrupted-stream detail finalization requires additional coverage.
- Capability reordering retains lower-ranked models when none is known to support a hard modality. Capability defaults do not consistently distinguish unsupported from unknown, so safe fail-closed routing for image/audio inputs remains unresolved.
- No npm publication, deployment, or user-data migration was performed for 1.2.5 during this audit.

## Outstanding release work

Check Windows ACLs and a clean global installation, validate real provider behavior when authorized credentials are available, and measure relevant performance before and after under reproducible conditions. Comparison of the remaining 9Router subsystems, full UI review, and provider-by-provider audit are not complete. The 1.2.5 archive has not been published.
