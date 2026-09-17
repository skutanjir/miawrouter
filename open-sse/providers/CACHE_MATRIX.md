# Provider prompt-cache capability matrix

Generated from the live registry + `open-sse/providers/cacheCapabilities.js`. 111 providers.

| mode | providers |
| --- | --- |
| explicit | 9 |
| implicit | 11 |
| unknown | 91 |

| provider | format | cache mode | marker | injects markers | upstream cache-read fields | upstream cache-write fields | evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ai21 | openai | unknown | — | no | — | — | unknown |
| alicode | openai | explicit | cache_control | yes | prompt_tokens_details.cached_tokens, input_tokens_details.cached_tokens | — | code |
| alicode-intl | openai | explicit | cache_control | yes | prompt_tokens_details.cached_tokens, input_tokens_details.cached_tokens | — | code |
| alims-intl | openai | explicit | cache_control | yes | prompt_tokens_details.cached_tokens, input_tokens_details.cached_tokens | — | code |
| anthropic | claude | explicit | cache_control | yes | cache_read_input_tokens | cache_creation_input_tokens | code |
| antigravity | antigravity | implicit | — | no | cachedContentTokenCount, usageMetadata.cachedContentTokenCount | — | code |
| api-airforce | openai | unknown | — | no | — | — | unknown |
| assemblyai | openai | unknown | — | no | — | — | unknown |
| azure | openai | unknown | — | no | — | — | unknown |
| baidu | openai | unknown | — | no | — | — | unknown |
| bazaarlink | openai | unknown | — | no | — | — | unknown |
| blackbox | openai | unknown | — | no | — | — | unknown |
| bluesminds | openai | unknown | — | no | — | — | unknown |
| byteplus | openai | unknown | — | no | — | — | unknown |
| cerebras | openai | unknown | — | no | — | — | unknown |
| chatgpt-web | openai | unknown | — | no | — | — | unknown |
| chutes | openai | unknown | — | no | — | — | unknown |
| claude | claude | explicit | cache_control | yes | cache_read_input_tokens | cache_creation_input_tokens | code |
| claude-web | openai | unknown | — | no | — | — | unknown |
| cline | openai | unknown | — | no | — | — | unknown |
| clinepass | openai | unknown | — | no | — | — | unknown |
| cloudflare-ai | openai | unknown | — | no | — | — | unknown |
| codebuddy-cn | openai | unknown | — | no | — | — | unknown |
| codebuddy-intl | openai | unknown | — | no | — | — | unknown |
| codex | openai-responses | implicit | — | no | prompt_tokens_details.cached_tokens, input_tokens_details.cached_tokens | — | code |
| cohere | openai | unknown | — | no | — | — | unknown |
| commandcode | commandcode | unknown | — | no | — | — | unknown |
| cursor | cursor | unknown | — | no | — | — | unknown |
| deepgram | openai | unknown | — | no | — | — | unknown |
| deepinfra | openai | unknown | — | no | — | — | unknown |
| deepseek | openai | implicit | — | no | prompt_cache_hit_tokens | — | code |
| deepseek-web | openai | unknown | — | no | — | — | unknown |
| featherless | openai | unknown | — | no | — | — | unknown |
| fireworks | openai | unknown | — | no | — | — | unknown |
| friendliai | openai | unknown | — | no | — | — | unknown |
| gemini | gemini | implicit | — | no | cachedContentTokenCount, usageMetadata.cachedContentTokenCount | — | code |
| gemini-cli | gemini-cli | implicit | — | no | cachedContentTokenCount, usageMetadata.cachedContentTokenCount | — | code |
| gemini-web | openai | unknown | — | no | — | — | unknown |
| genspark | openai | unknown | — | no | — | — | unknown |
| github | openai | unknown | — | no | — | — | unknown |
| github-models | openai | unknown | — | no | — | — | unknown |
| gitlab | openai | unknown | — | no | — | — | unknown |
| glm | claude | explicit | cache_control | yes | cache_read_input_tokens | cache_creation_input_tokens | code |
| glm-cn | openai | unknown | — | no | — | — | unknown |
| gorouter | openai | unknown | — | no | — | — | unknown |
| grok-cli | openai-responses | implicit | — | no | prompt_tokens_details.cached_tokens, input_tokens_details.cached_tokens | — | code |
| grok-web | grok-web | unknown | — | no | — | — | unknown |
| groq | openai | unknown | — | no | — | — | unknown |
| huggingface-router | openai | unknown | — | no | — | — | unknown |
| hyperbolic | openai | unknown | — | no | — | — | unknown |
| iflow | openai | unknown | — | no | — | — | unknown |
| inception | openai | unknown | — | no | — | — | unknown |
| kilo-gateway | openai | unknown | — | no | — | — | unknown |
| kilocode | openai | unknown | — | no | — | — | unknown |
| kimchi | openai | unknown | — | no | — | — | unknown |
| kimi | claude | explicit | cache_control | yes | cache_read_input_tokens | cache_creation_input_tokens | code |
| kimi-web | openai | unknown | — | no | — | — | unknown |
| kiro | kiro | unknown | — | no | — | — | unknown |
| llm7 | openai | unknown | — | no | — | — | unknown |
| manus-web | openai | unknown | — | no | — | — | unknown |
| meta-model-api | openai-responses | implicit | — | no | prompt_tokens_details.cached_tokens, input_tokens_details.cached_tokens | — | code |
| mimo-free | openai | unknown | — | no | — | — | unknown |
| minimax | claude | explicit | cache_control | yes | cache_read_input_tokens | cache_creation_input_tokens | code |
| minimax-cn | claude | explicit | cache_control | yes | cache_read_input_tokens | cache_creation_input_tokens | code |
| mistral | openai | unknown | — | no | — | — | unknown |
| mmf | openai | unknown | — | no | — | — | unknown |
| modelscope | openai | unknown | — | no | — | — | unknown |
| morph | openai | unknown | — | no | — | — | unknown |
| nanobanana | openai | unknown | — | no | — | — | unknown |
| navy | openai | unknown | — | no | — | — | unknown |
| nebius | openai | unknown | — | no | — | — | unknown |
| notion-web | openai | unknown | — | no | — | — | unknown |
| nous-research | openai | unknown | — | no | — | — | unknown |
| nvidia | openai | unknown | — | no | — | — | unknown |
| ollama | ollama | unknown | — | no | — | — | unknown |
| ollama-local | ollama | unknown | — | no | — | — | unknown |
| openagentic | openai | unknown | — | no | — | — | unknown |
| openai | openai | implicit | — | no | prompt_tokens_details.cached_tokens, input_tokens_details.cached_tokens | — | code |
| opencode | openai | unknown | — | no | — | — | unknown |
| opencode-go | openai | unknown | — | no | — | — | unknown |
| opencode-zen | openai | unknown | — | no | — | — | unknown |
| openrouter | openai | implicit | — | no | prompt_tokens_details.cached_tokens, input_tokens_details.cached_tokens | — | test |
| ovh-ai-endpoints | openai | unknown | — | no | — | — | unknown |
| perplexity | openai | unknown | — | no | — | — | unknown |
| perplexity-agent | openai-responses | implicit | — | no | prompt_tokens_details.cached_tokens, input_tokens_details.cached_tokens | — | code |
| perplexity-web | perplexity-web | unknown | — | no | — | — | unknown |
| pollinations | openai | unknown | — | no | — | — | unknown |
| poolside | openai | unknown | — | no | — | — | unknown |
| qoder | openai | unknown | — | no | — | — | unknown |
| qwen-web | openai | unknown | — | no | — | — | unknown |
| reka | openai | unknown | — | no | — | — | unknown |
| sambanova | openai | unknown | — | no | — | — | unknown |
| siliconflow | openai | unknown | — | no | — | — | unknown |
| tabitoken | openai | unknown | — | no | — | — | unknown |
| tencent | openai | unknown | — | no | — | — | unknown |
| together | openai | unknown | — | no | — | — | unknown |
| tokenrouter | openai | unknown | — | no | — | — | unknown |
| unikey | openai | unknown | — | no | — | — | unknown |
| v0-vercel-web | openai | unknown | — | no | — | — | unknown |
| venice | openai | unknown | — | no | — | — | unknown |
| venice-web | openai | unknown | — | no | — | — | unknown |
| vercel-ai-gateway | openai | unknown | — | no | — | — | unknown |
| vertex | vertex | implicit | — | no | cachedContentTokenCount, usageMetadata.cachedContentTokenCount | — | code |
| vertex-partner | openai | unknown | — | no | — | — | unknown |
| volcengine-ark | openai | unknown | — | no | — | — | unknown |
| xai | openai | unknown | — | no | — | — | unknown |
| xiaomi-mimo | openai | unknown | — | no | — | — | unknown |
| xiaomi-tokenplan | openai | unknown | — | no | — | — | unknown |
| zai-web | openai | unknown | — | no | — | — | unknown |
| zed | openai | unknown | — | no | — | — | unknown |
| zenmux | openai | unknown | — | no | — | — | unknown |

## Recorded capability declarations

| key | kind | mode | marker | evidence | note |
| --- | --- | --- | --- | --- | --- |
| claude | format | explicit | cache_control | code | Anthropic Messages API cache_control breakpoints (max 4). |
| gemini | format | implicit | — | code | Automatic caching; reports cachedContentTokenCount. |
| gemini-cli | format | implicit | — | code | Gemini-family usage metadata; no marker dialect. |
| vertex | format | implicit | — | code | Gemini-compatible usage metadata; no marker dialect. |
| antigravity | format | implicit | — | code | Implicit/content-based caching. Preserve stable prefix; never add markers. |
| openai-responses | format | implicit | — | code | OpenAI automatic caching; cached tokens are a subset of input tokens. |
| openai | provider | implicit | — | code | Automatic prompt caching; reports prompt_tokens_details.cached_tokens. |
| deepseek | provider | implicit | — | code | Context caching; reports prompt_cache_hit_tokens / prompt_cache_miss_tokens. |
| openrouter | provider | implicit | — | test | Aggregator: cache reporting is whatever the routed upstream returns. |
| alicode | provider | explicit | cache_control | code | DashScope-compatible; accepts cache_control markers. |
| alicode-intl | provider | explicit | cache_control | code | DashScope-compatible; accepts cache_control markers. |
| alims-intl | provider | explicit | cache_control | code | DashScope-compatible; accepts cache_control markers. |
