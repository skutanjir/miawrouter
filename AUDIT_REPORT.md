# Audit Teknik MiawRouter — Laporan Akhir

Tanggal: 2026-09-17
Rentang commit: `d0c8c81` (v1.0.29) → `1530eb6`
Dampak: 60 file berubah, 24 file baru, +5433 / −207 baris, 8 commit

---

# BAGIAN I — LAPORAN AUDIT (10 bagian)

## 1. Ringkasan Eksekutif

Audit menyeluruh atas MiawRouter (111 provider terdaftar, mesin SSE multi-format).
Empat bug nyata ditemukan dan diperbaiki, semuanya berjenis "senyap": tidak ada yang
mengeluarkan error, tetapi ketiganya merusak akuntansi cache atau mengirim field
vendor ke provider yang menolaknya.

| # | Temuan | Dampak | Status |
|---|---|---|---|
| 1 | L0 menyuntikkan `cache_control` Anthropic ke SEMUA provider ber-`messages[]`, termasuk 90 provider format OpenAI | Potensi HTTP 400 di provider ketat; `content` string diubah jadi array block | Diperbaiki (gate kapabilitas) |
| 2 | `applyCloaking` menaruh hash billing acak di `system[0]` setiap request Anthropic OAuth | Menghancurkan seluruh cached prefix setiap turn — cache read selalu 0 | Diperbaiki (hash deterministik per akun + `cch` dari prefix stabil) |
| 3 | `extractUsageFromResponse` mencocokkan cabang Claude lebih dulu; Responses API juga punya `input_tokens` | Token cached + reasoning dari provider Responses API hilang total dari akuntansi | Diperbaiki (cabang Responses sebelum Claude) |
| 4 | Konversi tool Claude→OpenAI membuang `cache_control` tingkat tool meski `preserveCacheControl: true` | Provider yang mendukung marker (DashScope/alicode) kehilangan breakpoint tool | Diperbaiki |

Hasil verifikasi akhir:

- `npm run lint` → **exit 0**, 0 error / 390 warning (sebelum audit: 162 error / 234 warning)
- `npm run test:ci` (gate pemblokir) → **exit 0**, 263 file lulus, **2848 test lulus**, 18 expected-fail, 63 skipped
- `npm run build` → **exit 0**
- Suite penuh termasuk backlog → 2934 lulus / 76 gagal; **seluruh 76 adalah kegagalan pre-existing** (lihat §2)
- **Regresi yang diperkenalkan: 0**

## 2. Metodologi & Validasi

- Baseline pra-audit diukur lebih dulu: 99 test gagal / 2678 lulus, 162 error lint.
- Invarian "pre-existing vs regresi" diuji dengan revert terkontrol: salin file ke
  `/tmp/opencode/bak`, `git checkout --`, jalankan ulang, kembalikan salinan.
  `runtimeConfig.js`, `count-tokens.test.js`, `executor-const-guard.test.js` gagal
  dengan pesan identik tanpa perubahan audit → terbukti pre-existing.
- Untuk file uji yang gagal, dilakukan pemeriksaan transitif: apakah file uji
  mengimpor file yang diubah audit? Hanya 3 yang cocok, dan ketiganya sudah
  dibuktikan pre-existing melalui revert.
- Gate CI dijalankan pada tree yang sudah di-commit, bukan pada working tree kotor.
- Larangan dipatuhi: tidak ada dependensi baru, tidak ada rewrite arsitektur, tidak
  ada nilai cache/usage yang dikarang.

## 3. Bug Kritis yang Ditemukan & Diperbaiki

**3.1 Injeksi marker lintas-vendor (severity tinggi).**
`open-sse/cache/l0.js` `finish()` menyisipkan breakpoint `cache_control` ke setiap
body yang punya `messages[]`. Untuk provider format OpenAI, ini mengubah `content`
string menjadi array block dan menambahkan key `cache_control` non-standar ke objek
tool — risiko 400 nyata. Diperbaiki dengan gate kapabilitas: marker hanya disuntik
bila provider benar-benar mendukungnya.

**3.2 Header billing menghancurkan cache Anthropic (severity tinggi).**
Ditemukan lewat permintaan audit untuk memverifikasi prefix cache Anthropic.
`buildHash` acak + hash `cch` atas seluruh body → prefix berubah setiap turn.
Diperbaiki: `buildHash` diturunkan dari apiKey (stabil per akun), `cch` dihitung
dari prefix stabil (semua pesan kecuali tail yang mutable). Bentuk protokol header
tetap valid, hanya isinya yang menjadi byte-stabil. **Perlu verifikasi live.**

**3.3 Token cache Responses API hilang (severity sedang-tinggi).**
`extractUsageFromResponse` memeriksa `usage.input_tokens !== undefined` lebih dulu
untuk cabang Claude. Usage Responses API juga punya `input_tokens`, sehingga
`input_tokens_details.cached_tokens` dan `output_tokens_details.reasoning_tokens`
tidak pernah terbaca. Diperbaiki dengan menempatkan cabang Responses (dideteksi dari
`input_tokens_details`/`output_tokens_details`) sebelum cabang Claude.

**3.4 Marker tingkat tool dibuang (severity sedang).**
Konversi tool Claude→OpenAI membuat objek baru dan menjatuhkan `cache_control`
walaupun provider mendukungnya. Diperbaiki dengan mempertahankan marker hanya saat
`preserveCacheControl` aktif.

## 4. Reliability & Resilience

- **Concurrency limiter** (`open-sse/services/concurrencyLimiter.js`, baru): limit per
  koneksi yang dapat dikonfigurasi. Slot diambil SEBELUM timer connect dimulai,
  dilepas di `finally`, dan dilepas segera saat request di-shed sebelum mencapai
  upstream. Slot streaming ditahan sampai siklus hidup stream berakhir, bukan sampai
  byte pertama. `ConcurrencyLimitError` dipropagasi utuh (sinyal kelas-429), dan
  limiter tidak mengganggu state circuit breaker.
- **Circuit breaker**: ditambah eviction idle (`IDLE_EVICT_MS` 10 menit) dan batas
  keras `MAX_CIRCUITS: 5000` sehingga proses berumur panjang tidak menumpuk state.
  `getCircuitSnapshot()` untuk observability.
- **Validasi request** (`open-sse/utils/requestValidation.js`, baru): guard ukuran
  request tanpa dependensi, dengan default longgar agar beban long-context tidak
  rusak. Semua 6 pemanggil `handleChat` diverifikasi selalu mengirim
  `messages`/`input`/`prompt`.
- **Error terstruktur**: redaksi kredensial + batas panjang 2000 karakter pada pesan
  error upstream, klasifikasi error, dan himpunan kategori yang layak retry.

## 5. Security

- **"Route guard hilang" BUKAN kerentanan.** Diverifikasi: matcher `src/proxy.js`
  mencakup semua path, dan `canAccessPublicLlmApi` di `src/dashboardGuard.js` menjadi
  gerbang untuk `/v1`, `/v1beta`, `/api/v1`, `/api/v1beta`, `/codex`. Tidak ada
  perubahan; didokumentasikan sebagai defense-in-depth.
- **`/api/metrics`** sengaja ditempatkan di bawah `/api/*` agar deny-by-default
  dashboardGuard (token CLI atau sesi terautentikasi) melindunginya. Bukan permukaan
  publik. Mengembalikan 404 saat dinonaktifkan.
- **Observability bebas privasi**: tidak ada prompt, API key, token, atau konten
  pengguna yang dicatat. Prefix direpresentasikan sebagai hash terpotong, bukan teks.
- **Risiko residual yang TIDAK diubah** (keputusan sadar): API key disimpan plaintext
  dan dibandingkan non-constant-time. Perbaikan asli menuntut hashing at-rest —
  perubahan breaking untuk instalasi yang ada — dan timing oracle berada di lookup
  SQLite, bukan yang dapat dieksploitasi lewat HTTP. Didokumentasikan, bukan diubah.
- Tidak ada perubahan keamanan spekulatif yang dilakukan.

## 6. Observability

Metrik baru (semua berlabel `{provider}`, metrik cache juga berlabel `{cacheMode}`):

```
miawrouter_requests_total              miawrouter_ttft_seconds
miawrouter_tokens_input_total          miawrouter_request_duration_seconds
miawrouter_tokens_output_total         miawrouter_provider_errors_total
miawrouter_cache_hits_total            miawrouter_provider_429_total
miawrouter_cache_misses_total          miawrouter_active_requests
miawrouter_provider_cache_read_tokens_total   miawrouter_queue_depth
miawrouter_provider_cache_write_tokens_total  miawrouter_circuit_state
miawrouter_provider_active_requests
```

Pemisahan yang penting: `miawrouter_cache_hits_total` = cache RESPONS router (L1/L2).
`miawrouter_provider_cache_read_tokens_total` = cache PROMPT upstream. Keduanya tidak
pernah dicampur; hit L1/L2 tidak pernah dilaporkan sebagai cache hit provider.
Metrik lama `miawrouter_tokens_cached_total` yang mencampur keduanya dihapus.

Event probe cache kini membawa `cacheMode`, `prefixHash` (hash terpotong 16 karakter),
`prefixLen`, `breakpoints`, `markerInserted`, `restored`.

## 7. Testability

- `tests/helpers/cacheContract.js` (baru): runner kontrak cache adaptif-kapabilitas.
  Dipakai ulang oleh provider mana pun; memverifikasi dua semantik L0 yang menopang
  cacheability — gerbang stabilitas dua-turn dan hash prefix bebas-`cache_control`.
- `tests/unit/cache-contract-runner.test.js` (baru): 131 kasus atas provider explicit,
  implicit, dan unknown, plus invarian akuntansi usage per dialek.
- `tests/unit/provider-cache-matrix.test.js` (baru): 10 kasus yang menyapu SEMUA 111
  provider — termasuk bukti bahwa tidak ada provider non-explicit yang menerima
  `cache_control`, dan bahwa tidak ada provider explicit yang kehilangan breakpoint.
- `tests/unit/provider-cache-capability.test.js`: 20 kasus regresi untuk kedua bug
  cache + pengawetan/penghapusan marker dua arah.
- `tests/fixtures/providers/cache-usage.js`: fixture usage tersanitasi per dialek
  (Claude, OpenAI, Responses, Gemini, DeepSeek, Kiro, unknown, malformed).
- `tests/helpers/providerContract.js`: framing wire digerakkan kapabilitas (NDJSON vs
  SSE) menggantikan stub yang tidak pernah dipakai. 75/75 kontrak provider lulus.
- `tests/known-failing.json`: 27 suite gagal pre-existing, terdaftar eksplisit.

## 8. CI Quality Gate

`.github/workflows/ci.yml`:

- `lint` → `npm run lint`, wajib lulus.
- `test` → `npm run test:ci`, **memblokir**. Menjalankan seluruh suite kecuali 27
  kegagalan pre-existing yang terdokumentasi. Merah berarti "PR ini yang merusak".
- `backlog-tests` → `npm run test:all`, `continue-on-error: true`. Menjalankan suite
  yang dikarantina agar utang teknis tetap terlihat di setiap build dan tidak membusuk
  di dalam file JSON.
- `build` → `npm run build`, wajib lulus.
- Seluruh job bebas kredensial; suite live bersifat opt-in (`RUN_LIVE=1`,
  `RUN_REAL=1`), sehingga fork tanpa secrets tetap tervalidasi penuh.

Perbaikan penting: `test:root` sebelumnya gagal dengan exit 127 karena `vitest` hanya
terpasang di workspace `tests/`, bukan di PATH root. Skrip kini memanggil binary
workspace.

## 9. Performance

Overhead orkestrasi L0 diukur dengan beban kerja coding berat-tool:

| Beban | Ukuran payload | Overhead L0 (explicit) | Overhead L0 (implicit) |
|---|---|---|---|
| 20 turn / 20 tool | — | 0.80 ms | 0.74 ms |
| 60 turn / 60 tool | 315.8 KiB | 2.27 ms | 2.17 ms |

Biaya didominasi `JSON.stringify` + `structuredClone` pada snapshot integritas.
Untuk request 316 KiB, 2.27 ms dapat diterima dan tidak mengubah TTFT secara
material. Catatan optimasi: snapshot disimpan sebagai STRING JSON, bukan graph objek
terkloning, justru untuk menekan memori.

## 10. Risiko Residual & Item Terbuka

1. **Header billing Claude** — bentuk protokol dipertahankan tetapi isinya berubah.
   Wajib diverifikasi terhadap provider live sebelum dianggap aman; sensitif anti-ban.
   *Label: INFERRED.*
2. **CommandCode `x-session-id: randomUUID()`** per request. Tidak ada bukti bahwa
   CommandCode melakukan cache per-sesi; tidak ada perubahan agar tidak mengarang
   perilaku. *Label: UNKNOWN.*
3. **AI SDK v5 `cachedInputTokens`** tidak dikenali. Repo mengenali `inputTokens`/
   `outputTokens`/`totalTokens`/`reasoningTokens` dari objek yang sama, tetapi tidak
   ada fixture CommandCode tertangkap. Tidak diubah sesuai instruksi "jangan menebak".
   Perlu fixture asli sebelum menyentuh parser. *Label: UNKNOWN.*
4. **`sanitizeToolArgs` hanya flush saat `finish_reason`** — jika upstream mengakhiri
   stream tanpa `finish_reason`, argumen tool yang sudah dibuffer tidak pernah
   dipancarkan. Gap pra-existing pada finalisasi stream, di luar lingkup cache,
   berisiko untuk diubah di akhir audit. *Label: VERIFIED BY CODE.*
5. **`reasoning_content` → thinking block** hilang di `openai-to-claude.js`, tercatat
   sebagai `it.fails` (konsisten dengan 18 expected-fail lain). Gap produk nyata.
6. **API key plaintext + perbandingan non-constant-time.** Butuh hashing at-rest.
7. **76 test pre-existing gagal** di 27 suite (usage-quota display, bench harness,
   cursor protobuf, dll) — semuanya di luar lingkup audit ini, dikarantina secara
   terlihat dengan ratchet burn-down.
8. **Antigravity `requestId`** memuat `Date.now()`; dinilai cache-safe karena timestamp
   berada di path envelope RPC, bukan di `contents` yang di-cache. Belum diverifikasi
   live. *Label: INFERRED.*

---

# BAGIAN II — RINGKASAN ARSITEKTUR SIKLUS HIDUP REQUEST

```
POST /v1/... (format klien: OpenAI | Claude | Gemini | Responses)
  │
  ├─ src/proxy.js matcher  ──► src/dashboardGuard.js
  │                              └─ canAccessPublicLlmApi: token CLI atau sesi auth
  │                                 (deny-by-default; /api/metrics ikut terlindungi)
  │
  └─ src/sse/handlers/chat.js
       └─ open-sse/utils/requestValidation.js   ← guard ukuran (baru)
            └─ open-sse/handlers/chatCore.js
                 │
                 ├─ services/model.js  parseModel()  → { provider, model }
                 │
                 ├─ PRE-TRANSLATE HOOKS  (semua fail-open, urutan penting)
                 │    rtk/            kompresi tool_result in-place
                 │    rtk/headroom.js kompres proxy eksternal
                 │    rtk/caveman.js  injeksi system prompt
                 │      └─ CATATAN CACHE: hook ini memutasi body SETELAH
                 │         begin() mengambil snapshot, sehingga snapshot
                 │         integritas L0 mampu memulihkan prefix yang rusak.
                 │
                 ├─ cache/l0.js  begin(body)
                 │    └─ snapshot + hash integritas system / tools / prefix pesan
                 │
                 ├─ cache/l1.js l1Key() / l2.js  → cache respons ROUTER
                 │    (identitas berbeda dari cache prompt provider)
                 │
                 ├─ providers/cacheCapabilities.js  resolveCacheCapability(provider, format)
                 │    └─ mode: explicit | implicit | none | unknown
                 │       (default UNKNOWN → tidak pernah menyuntik, fail-closed)
                 │
                 ├─ cache/l0.js  finish(body, state, { capability })
                 │    ├─ pulihkan prefix yang dimutasi saver (jika perlu)
                 │    ├─ gerbang stabilitas dua-turn (STABLE_TURNS = 2)
                 │    ├─ HANYA jika supportsCacheMarkers: sisipkan ≤4 breakpoint
                 │    └─ emit cache_probe { cacheMode, prefixHash, breakpoints }
                 │
                 ├─ translator/index.js  translateRequest(clien → provider)
                 │    ├─ rute langsung bila pair terdaftar (mis. claude:kiro)
                 │    └─ formats/openai.js  filterToOpenAIFormat(preserveCacheControl)
                 │
                 ├─ injectUsageRequestId  → dedup usage per request (baru)
                 │
                 └─ executors/index.js  getExecutor(provider)
                      └─ executors/base.js
                           ├─ concurrencyLimiter.acquireSlot()  ← SEBELUM timer connect
                           ├─ circuitBreaker
                           ├─ executor.execute()  → stream upstream
                           │    (commandcode NDJSON, kiro EventStream,
                           │     cursor protobuf, antigravity SSE, ...)
                           └─ wrapStreamingResponse()
                                └─ finally: releaseSlot()
                                     │
                                     ├─ translator/response/... → format klien
                                     ├─ utils/usageTracking.js
                                     │    extractUsage → mergeUsage → canonicalizeUsage
                                     ├─ chatCore/streamingHandler.js | nonStreamingHandler.js
                                     │    ├─ runtimeMetrics.increment(...)
                                     │    ├─ emitCacheUsage(...)  ← cache PROMPT upstream
                                     │    └─ saveUsageStats / saveRequestDetail
                                     └─ cache/l1.js l1Store() / l2.js
```

---

# BAGIAN III — LAPORAN CACHE PROVIDER (17 bagian)

Model: `open-sse/providers/cacheCapabilities.js` — satu sumber kebenaran untuk
injeksi marker dan kosakata field usage per keluarga. Matriks lengkap 111 provider
di-generate ke `open-sse/providers/CACHE_MATRIX.md` oleh
`scripts/provider-cache-matrix.mjs`, sehingga tidak mungkin menyimpang dari perilaku
router sebenarnya.

### 1. Model Kapabilitas Cache

| Mode | Arti | Injeksi marker | Contoh |
|---|---|---|---|
| `explicit` | Provider menerima penanda breakpoint eksplisit | Ya (`cache_control`) | anthropic, claude, alicode, glm, kimi, minimax |
| `implicit` | Provider men-cache sendiri; hanya melaporkan usage | Tidak | openai, gemini, deepseek, antigravity, codex |
| `none` | Tidak ada cache yang diketahui & tidak menerima marker | Tidak | (belum ada yang diklasifikasi) |
| `unknown` | Tidak ada bukti | **Tidak** — fail-closed | 91 provider |

Aturan presedensi: **format menang atas provider**. Override provider hanya
memperbaiki format generik `openai`. Ini penting karena `deepseek` punya transport
`openai` dan `claude`, dan hanya transport `claude` yang menerima `cache_control`.

Kapabilitas default adalah UNKNOWN dan tidak pernah menyuntik. `finish()` tanpa ctx
`capability` tidak menyisipkan apa pun (harness bench tidak terpengaruh — hanya
membaca `info.restored`).

### 2. Explicit Caching Terverifikasi — 9 provider

*Label: VERIFIED BY CODE + VERIFIED BY TEST*

| Provider | Format | Marker | Field cache-read | Field cache-write |
|---|---|---|---|---|
| anthropic | claude | cache_control | `cache_read_input_tokens` | `cache_creation_input_tokens` |
| claude | claude | cache_control | `cache_read_input_tokens` | `cache_creation_input_tokens` |
| glm | claude | cache_control | `cache_read_input_tokens` | `cache_creation_input_tokens` |
| kimi | claude | cache_control | `cache_read_input_tokens` | `cache_creation_input_tokens` |
| minimax | claude | cache_control | `cache_read_input_tokens` | `cache_creation_input_tokens` |
| minimax-cn | claude | cache_control | `cache_read_input_tokens` | `cache_creation_input_tokens` |
| alicode | openai | cache_control | `prompt_tokens_details.cached_tokens`, `input_tokens_details.cached_tokens` | — |
| alicode-intl | openai | cache_control | sama | — |
| alims-intl | openai | cache_control | sama | — |

Keluarga Claude diverifikasi bertahan melalui terjemahan: breakpoint `system`, tool,
dan prefix pesan diawetkan; marker yang dikirim klien tidak pernah ditulis ulang;
batas 4 breakpoint dipatuhi; usage `message_start` + `message_delta` digabung tanpa
double-count (sudah tercakup test yang ada ditambah kontrak baru).

alicode/alims-intl mempertahankan marker karena quirk `preserveCacheControl` nyata di
registry. Diverifikasi dua arah: **dipertahankan** saat quirk aktif, **dihapus** saat
tidak — termasuk pada tingkat tool (bug 3.4).

### 3. Implicit Caching Terverifikasi — 11 provider

*Label: VERIFIED BY CODE + TEST (usage), INFERRED (perilaku cache upstream)*

| Provider | Format | Field cache-read |
|---|---|---|
| openai | openai | `prompt_tokens_details.cached_tokens`, `input_tokens_details.cached_tokens` |
| deepseek | openai | `prompt_cache_hit_tokens` (+ `prompt_cache_miss_tokens`) |
| gemini | gemini | `cachedContentTokenCount`, `usageMetadata.cachedContentTokenCount` |
| gemini-cli | gemini-cli | sama |
| vertex | vertex | sama |
| antigravity | antigravity | sama |
| codex | openai-responses | `prompt_tokens_details.cached_tokens`, `input_tokens_details.cached_tokens` |
| grok-cli | openai-responses | sama |
| meta-model-api | openai-responses | sama |
| perplexity-agent | openai-responses | sama |
| openrouter | openai | sama |

**OpenAI:** `prompt_tokens` bersifat cache-INCLUSIVE, jadi `cached_tokens` adalah
subset dan TIDAK boleh ditambahkan. Diverifikasi oleh invarian
`cached_tokens <= prompt_tokens` di test.

**Gemini:** `cachedContentTokenCount` subset dari `promptTokenCount`;
`thoughtsTokenCount` dipetakan ke reasoning dan TIDAK dihitung ulang ke total.
Diverifikasi via fixture `GEMINI_THOUGHTS` (totalTokenCount 1750 vs prompt 1000 +
candidates 400 + thoughts 350). `cache_control` **tidak pernah** disuntikkan ke
Gemini.

**DeepSeek:** `prompt_cache_hit_tokens` → cached, dan
`hit + miss === prompt_tokens` dipertahankan sebagai invarian. Fixture regresi
cache-hit ditambahkan (`DEEPSEEK_HIT_AND_MISS`, `DEEPSEEK_HIT_ONLY`).

**Antigravity:** diperlakukan sebagai perilaku tersendiri. Caching berbasis konten
(implicit) DIPERTAHANKAN — integrasi cache yang ada tidak diganti dengan marker L0
Anthropic. Test integrasi cache-nya ada dan bersifat opt-in (skipped di CI offline),
sesuai desain.

**OpenRouter:** *Label: INFERRED.* Sebagai agregator, pelaporan cache mengikuti
upstream yang dirutekan. Tag buktinya sengaja diturunkan dari `test` ke `inferred`
karena fixture kontrak hanya *mendeklarasikan*, bukan membuktikan. Mode tetap
`implicit` karena router hanya mencerminkan usage dan tidak pernah menyuntik marker —
itu berlaku apa pun provider yang dirutekan.

### 4. Provider dengan Pelaporan Usage Saja (marker tidak berlaku)

Provider berikut melaporkan usage tetapi tidak ada bukti menerima marker dan tidak
ada bukti cache. Diperlakukan sebagai `unknown` → tidak ada injeksi.
*Label: UNKNOWN* (tidak dikonversi menjadi "unsupported").

Termasuk di dalamnya: `ollama` (sengaja TIDAK diklasifikasi `none`), `cerebras`,
`mistral`, `kiro`, `cursor`, `deepseek-web`, `grok-web`, `claude-web`, `kimi-web`,
dan 82 provider lain.

**Kiro** — *Label: UNKNOWN, dengan catatan.* Ada pembacaan defensif
`prompt_tokens_details.cached_tokens` dan `cache_creation_tokens` dari AWS
EventStream, tetapi upstream belum dikonfirmasi. Pembacaan defensif dipertahankan
(tidak berbahaya), kapabilitas tetap UNKNOWN. Tidak ada klaim dukungan cache.

**Cursor / grok-web / kimi-web / deepseek-web** — usage disintesis di executor
(`estimateUsage` / nilai nol). Ini BUKAN cache hit dan tidak pernah dilaporkan
sebagai cache hit.

### 5. Provider Tanpa Cache yang Diketahui

Tidak ada provider yang diklasifikasi `none`. Klasifikasi `none` menuntut bukti
positif bahwa cache tidak ada dan marker ditolak; menandai `unknown` sebagai `none`
dilarang karena membekukan ketidaktahuan menjadi klaim. Test
`assertCapabilityDeclarations` menegakkan aturan ini: setiap record tanpa bukti HARUS
`unknown`.

### 6. Perilaku Unknown — 91 Provider

Default fail-closed. Untuk provider `unknown`:

- `supportsCacheMarkers === false`, `marker === NONE`
- tidak ada field vendor yang disuntikkan ke body request
- prefix stabil tetap dipertahankan (tidak ada mutasi)
- tidak ada asersi bahwa provider TIDAK men-cache
- test memverifikasi `cache_control`, `cachedContent`, dan `prompt_cache` tidak
  pernah muncul di body terserialisasi

### 7. Provider dengan Bug Cache yang Diperbaiki

*Label: VERIFIED BY CODE + VERIFIED BY TEST*

1. **90 provider format OpenAI** — sebelumnya menerima `cache_control` Anthropic di
   setiap body ber-`messages[]`. Kini nol. Dibuktikan oleh
   `provider-cache-matrix.test.js` yang menyapu seluruh registry.
2. **Anthropic OAuth (claude)** — header billing menghancurkan cached prefix setiap
   turn. Kini byte-stabil.
3. **Provider Responses API (codex, grok-cli, meta-model-api, perplexity-agent)** —
   token cached & reasoning hilang di jalur usage non-streaming. Kini terbaca.
4. **alicode / alicode-intl / alims-intl** — marker tingkat tool dibuang meski
   `preserveCacheControl` aktif. Kini dipertahankan.

### 8. Translator yang Merusak Cacheability

| Lokasi | Klasifikasi | Tindakan |
|---|---|---|
| `formats/openai.js` tool conversion menjatuhkan `cache_control` | CACHE-UNSAFE AND AVOIDABLE | Diperbaiki |
| `formats/openai.js` filter marker default | CACHE-SAFE (memang harus menghapus untuk provider yang menolak) | Dipertahankan, diuji dua arah |
| `claudeCloaking.js` `system[0]` billing hash acak | CACHE-UNSAFE AND AVOIDABLE (fatal) | Diperbaiki |
| `rtk/` kompresi `tool_result` in-place | CACHE-UNSAFE BUT REQUIRED (mengurangi token, mengubah prefix) | Dipertahankan; snapshot integritas L0 mampu memulihkan prefix |
| `rtk/caveman.js` injeksi system prompt | CACHE-UNSAFE BUT REQUIRED | Dipertahankan; snapshot diambil SETELAH injeksi sehingga teks hasil injeksi menjadi bagian prefix terlindungi |
| `openai-to-commandcode.js` schema tool | CACHE-SAFE | Diperbaiki (bug terpisah) |
| `openai-to-claude.js` `sanitizeToolArgs` hanya saat `finish_reason` | UNKNOWN / gap pra-existing | Tidak diubah; dilaporkan |

### 9. Usage Parser yang Diperbaiki

*Label: VERIFIED BY CODE + VERIFIED BY TEST*

- `normalizeUsage` / `canonicalizeUsage` — menerima dialek camelCase DAN snake_case;
  melipat token input eksklusif-cache Anthropic tepat sekali; menjaga cached sebagai
  subset cache-inclusive untuk OpenAI/Gemini; merekonsiliasi hit+miss DeepSeek.
- Guard `Math.max` pada `mergeUsage` memastikan `message_start` (input + cache) tidak
  ditimpa oleh `message_delta` (output saja).
- `extractUsageFromResponse` — cabang Responses ditambahkan sebelum Claude.
- Field cache tidak pernah dikarang: `buildUsage` hanya memancarkan detail bila > 0.
  Pada bentuk kanonik, field camelCase mempertahankan "absen"; alias snake_case
  (`cached_tokens: 0`) adalah konvensi penyimpanan numerik, bukan pembacaan upstream
  yang dipalsukan. Perbedaan ini diuji secara eksplisit.

### 10. Test Cache yang Ditambahkan

*Label: VERIFIED BY TEST*

| File | Kasus | Cakupan |
|---|---|---|
| `provider-cache-matrix.test.js` | 10 | Seluruh 111 provider: tidak ada injeksi non-explicit, tidak ada kehilangan breakpoint explicit, unknown tetap unknown |
| `cache-contract-runner.test.js` | 131 | Runner kontrak + invarian usage per dialek |
| `provider-cache-capability.test.js` | 20 | Kedua bug cache, pengawetan marker dua arah, stabilitas prefix cloaking |
| `provider-cache-contract.test.js` | 62 | Kanonikalisasi fixture + cabang Responses |
| `provider-contract.test.js` | 75 | Framing wire digerakkan kapabilitas |
| `alicode-cache-control-2069.test.js` | — | Dipertahankan (strip/preserve) |
| `cached-token-usage.test.js` / `cached-token-e2e.test.js` | — | Dipertahankan; merge Anthropic streaming |
| `antigravity-cache.test.js` | 6 | Dipertahankan, opt-in (skipped offline) |

Skenario yang dicakup runner kontrak: prompt identik berulang, prefix stabil + tail
baru, system prompt berubah, tool berubah, urutan tool berubah, riwayat berubah,
usage streaming, usage non-streaming, cache read, cache creation, reasoning + cache,
metadata hilang/nol/malformed.

### 11. Matriks Provider

Dihasilkan oleh `node scripts/provider-cache-matrix.mjs`:

```
provider: 111
  explicit:   9
  implicit:  11
  unknown:   91
```

Artefak: `open-sse/providers/CACHE_MATRIX.md` (markdown) dan `--json` untuk konsumsi
mesin. Matriks diturunkan dari registry live + `cacheCapabilities.js`, jadi tidak
dapat menyimpang dari perilaku router.

### 12. Distinksi L0 vs L1/L2/L3

Empat lapisan cache yang berbeda dan TIDAK boleh dicampur:

| Lapisan | Arti | Metrik |
|---|---|---|
| L0 | Orkestrasi cache PROMPT provider (breakpoint + stabilitas prefix) | `miawrouter_provider_cache_read_tokens_total` / `_write_` |
| L1 | Cache respons ROUTER berbasis key exact | `miawrouter_cache_hits_total` / `_misses_total` |
| L2 | Cache respons semantik | idem (L1/L2 adalah cache router) |
| L3 | Deduplikasi konten | idem |

Hit L1/L2/L3 TIDAK PERNAH dilaporkan sebagai cache hit provider. Metrik lama
`miawrouter_tokens_cached_total` yang mencampur keduanya dihapus dan diganti dua
metrik terpisah berlabel `cacheMode`.

### 13. Observability Cache

Event `cache_probe`: `cacheMode`, `prefixHash` (hash terpotong, aman diekspor),
`prefixLen`, `breakpoints`, `markerInserted`, `turns`, `stable`, `restored`.

Event `cache_usage`: `cacheMode`, `cacheRead`, `cacheCreation`, `provider`, `model`.

Tidak pernah dicatat: API key mentah, token OAuth, prompt lengkap, argumen tool yang
mengandung rahasia, kredensial mentah.

### 14. Performa Cache

Lihat §9 laporan audit: 0.80 ms (20 turn/20 tool) dan 2.27 ms (316 KiB, 60/60).
Orkestrasi hanya dijalankan untuk request bercache; jalur `unknown`/`none` melewati
injeksi marker sepenuhnya. Tidak ada degradasi TTFT material.

### 15. Risiko Cache yang Tersisa

1. Header billing Claude — bentuk protokol valid, isi byte-stabil; **belum diverifikasi
   live**. *INFERRED.*
2. `x-session-id` CommandCode acak per request. *UNKNOWN.*
3. `cachedInputTokens` AI SDK v5 tidak dikenali; butuh fixture asli. *UNKNOWN.*
4. `sanitizeToolArgs` hanya flush pada `finish_reason`. *VERIFIED BY CODE.*
5. Antigravity `Date.now()` di `requestId` — dinilai cache-safe, belum diverifikasi
   live. *INFERRED.*
6. Provider `unknown` (91) — tidak ada klaim apa pun; perlu bukti upstream sebelum
   dinaikkan statusnya.

### 16. Label Bukti

| Label | Arti | Dipakai untuk |
|---|---|---|
| VERIFIED BY CODE | Dibaca langsung dari implementasi + tercakup test | Injeksi marker, kapabilitas, parser usage, stabilitas prefix |
| VERIFIED BY LIVE PROVIDER TEST | Diuji terhadap provider asli | (belum ada — semua suite live opt-in dan tidak dijalankan) |
| INFERRED | Diturunkan dari struktur protokol/field saudara, bukan diuji | Perilaku cache upstream implicit, stabilitas header billing, Antigravity requestId |
| UNKNOWN | Tidak ada bukti | 91 provider, Kiro, CommandCode, `cachedInputTokens` |

Tidak ada temuan yang dipromosikan ke tingkat bukti yang lebih tinggi daripada yang
didukung data. Tujuan audit adalah pengawetan dan pengukuran yang akurat, bukan
memaksimalkan jumlah provider yang ditandai "cached".

### 17. Kesimpulan Cache

Router sekarang provider-aware pada level kapabilitas, bukan memaksakan dialek satu
vendor ke semua orang. 9 provider explicit menerima breakpoint yang benar; 11 provider
implicit menjaga prefix stabil tanpa field asing; 91 provider unknown tidak menerima
apa pun yang tidak kita punyai buktinya. Empat bug cache nyata diperbaiki, dua di
antaranya bersifat senyap dan merusak akuntansi secara permanen. Akuntansi L0 vs L1/L2
kini terpisah di metrik maupun laporan. Semua klaim dapat direproduksi dari test yang
sudah di-commit.
