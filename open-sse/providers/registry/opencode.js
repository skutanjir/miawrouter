export default {
  id: "opencode",
  priority: 40,
  hasFree: true,
  alias: "oc",
  uiAlias: "oc",
  // Keyless OpenCode Free cannot work through a third-party router. Upstream's
  // Console inference backend answers every out-of-client request with
  // `403 FreeTierError` — verified 2026-09-18 with `Bearer public` plus the full
  // official header set (User-Agent opencode/<channel>/<version>/<client>,
  // x-opencode-client/session/request/project) on both Node and Bun, and the
  // error text does not exist anywhere in the open-source tree, so it is decided
  // server-side. `hidden` keeps the registry entry (aliases, model metadata and
  // the executor stay intact for anyone who wires this up behind a real OpenCode
  // client) while dropping it from provider pickers and the synthetic keyless
  // connection list. Flip to false only with live evidence that the gate lifted.
  hidden: true,
  display: {
    name: "OpenCode Free",
    icon: "terminal",
    color: "#E87040",
    textIcon: "OC",
    website: "https://opencode.ai",
    notice: {
      text: "OpenCode's free models are gated to the OpenCode client itself and return 403 FreeTierError from any other router, so this provider is hidden. Use the OpenCode CLI for free models, connect OpenCode Zen with an API key, or pick a keyless free provider such as Pollinations (pol).",
      apiKeyUrl: "https://opencode.ai/auth",
    },
  },
  category: "free",
  noAuth: true,
  transport: {
    baseUrl: "https://opencode.ai",
    headers: {
      "x-opencode-client": "desktop",
    },
    noAuth: true,
  },
  models: [
    {
      id: "big-pickle",
      name: "Big Pickle",
      supportsReasoning: true,
      interleavedField: "reasoning_content",
      isFreeTier: true
    },
    {
      id: "deepseek-v4-flash-free",
      name: "DeepSeek V4 Flash Free",
      supportsReasoning: true,
      isFreeTier: true
    },
    {
      id: "muse-spark-1.2-contributor-free",
      name: "Muse Spark 1.2 Contributor Free",
      contextLength: 1048576,
      isFreeTier: true
    },
    {
      id: "muse-spark-1.3-contributor-free",
      name: "Muse Spark 1.3 Contributor Free",
      contextLength: 1048576,
      isFreeTier: true
    },
    {
      id: "mimo-v2.5-free",
      name: "MiMo V2.5 Free",
      contextLength: 131000,
      isFreeTier: true
    },
    {
      id: "ling-3.0-flash-fin-free",
      name: "Ling 3.0 Flash Fin Free",
      contextLength: 131000,
      isFreeTier: true
    },
    {
      id: "nemotron-3-ultra-free",
      name: "Nemotron 3 Ultra Free",
      contextLength: 1000000,
      isFreeTier: true
    },
    {
      id: "nemotron-3.5-lightning-free",
      name: "Nemotron 3.5 Lightning Free",
      contextLength: 1000000,
      isFreeTier: true
    }
  ],
  modelsFetcher: { url: "https://opencode.ai/zen/v1/models", type: "opencode-free" },
  passthroughModels: true,
};
