# OpenAI and Claude catalog verification — 2026-09-30

Direct provider catalogs include GPT-6.1 Sol and Claude Sonnet 5.5. Older models
remain available where already listed; this update does not claim every model
is enabled for every account or third-party provider.

| Model / transport | Effort choices |
| --- | --- |
| GPT-6.1 Sol / GPT-6 Astra, OpenAI API | low, medium, high, xhigh, max |
| GPT-6 Sol / Luna and GPT-5.6 Sol / Terra / Luna, OpenAI API | none, low, medium, high, xhigh, max |
| GPT-5.5 / GPT-5.4 | none, low, medium, high, xhigh |
| GPT-5.5 Pro / GPT-5.4 Pro | medium, high, xhigh |
| GPT-5.2 | none, low, medium, high, xhigh |
| GPT-5.1 | none, low, medium, high |
| GPT-5 / Mini / Nano | minimal, low, medium, high |
| GPT-6.1 Sol / GPT-6 Astra / GPT-6 Sol, Codex presets | low, medium, high, xhigh, max, ultra |
| GPT-6 Luna, Codex presets | low, medium, high, xhigh, max |
| Claude Fable 5.1 / Opus 5.5 / Sonnet 5.5 | low, medium, high, xhigh, max |
| Claude Opus / Sonnet 4.6 | low, medium, high, max |
| Claude Opus 4.5 | low, medium, high; extended thinking uses a token budget |
| Claude Haiku 5.5 | low, medium, high, xhigh, max |

`auto` is a router setting: omit effort and use the provider's default. Claude
Opus 5.5 defaults to medium; Fable 5.1 and Sonnet 5.5 default to high.
Fable 5.1 and Opus 5.5 cannot disable thinking. Sonnet 5.5 uses `between_tools`
to turn off up-front thinking at high effort or below, never `disabled`.
Codex live `supported_reasoning_levels` metadata remains authoritative for
catalog discovery; Ultra is a ChatGPT/Codex preset, not an OpenAI API enum.

Sources checked:

- https://developers.openai.com/api/docs/models/gpt-6.1-sol
- https://developers.openai.com/api/docs/models/gpt-6-astra
- https://developers.openai.com/api/docs/models/gpt-6-sol
- https://developers.openai.com/api/docs/models/gpt-6-luna
- https://developers.openai.com/api/docs/models/gpt-5.6-sol
- https://developers.openai.com/api/docs/models/gpt-5.6-terra
- https://developers.openai.com/api/docs/models/gpt-5.6-luna
- https://developers.openai.com/api/docs/models/gpt-5.5
- https://developers.openai.com/api/docs/models/gpt-5.4
- https://developers.openai.com/api/docs/models/gpt-5.5-pro
- https://developers.openai.com/api/docs/models/gpt-5.4-pro
- https://developers.openai.com/api/docs/models/gpt-5.2
- https://developers.openai.com/api/docs/models/gpt-5.1
- https://developers.openai.com/api/docs/models/gpt-5
- https://learn.chatgpt.com/docs/models
- https://platform.claude.com/docs/en/models/overview
- https://platform.claude.com/docs/en/build-with-claude/effort
- https://platform.claude.com/docs/en/build-with-claude/thinking
