import { NextResponse } from "next/server";
import { getProviderConnectionById } from "@/models";
import { isOpenAICompatibleProvider, isAnthropicCompatibleProvider } from "@/shared/constants/providers";
import { GEMINI_CONFIG } from "@/lib/oauth/constants/oauth";
import { refreshGoogleToken, refreshCodexToken, refreshClaudeOAuthToken, updateProviderCredentials } from "@/sse/services/tokenRefresh";
import { resolveOllamaLocalHost } from "open-sse/config/providers.js";
import { getModelsByProviderId } from "open-sse/config/providerModels.js";
import { resolveKiroModels } from "open-sse/services/kiroModels.js";
import { resolveKimchiModels } from "open-sse/services/kimchiModels.js";
import { resolveQoderModels } from "open-sse/services/qoderModels.js";
import { resolveGrokCliModels } from "open-sse/services/grokCliModels.js";
import { resolveConnectionProxyConfig } from "@/lib/network/connectionProxy";
import { resolveCursorModels } from "open-sse/services/cursorModels.js";
import { findRegistryModelSource, fetchRegistryModels } from "@/lib/catalog/providerModelSources.js";
import { normalizeLiveModels } from "@/lib/catalog/liveModelCatalog.js";
import { upsertCustomModels } from "@/lib/db/repos/aliasRepo.js";

const GEMINI_CLI_MODELS_URL = "https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels";

// The /codex/models endpoint gates each entry by minimal_client_version against this
// value, and codex CLI's own manifest (openai/codex codex-rs/models-manager/models.json)
// already requires 0.144.0 for its newest models, so a stale client_version here comes
// back 200 with those entries quietly missing instead of erroring.
const CODEX_CLIENT_VERSION = "0.144.6";
const CODEX_MODELS_URL = `https://chatgpt.com/backend-api/codex/models?client_version=${CODEX_CLIENT_VERSION}`;

const parseOpenAIStyleModels = (data) => {
  if (Array.isArray(data)) return data;
  return data?.data || data?.models || data?.results || [];
};

const parseGeminiCliModels = (data) => {
  if (Array.isArray(data?.models)) {
    return data.models
      .map((item) => {
        const id = item?.id || item?.model || item?.name;
        if (!id) return null;
        return { id, name: item?.displayName || item?.name || id };
      })
      .filter(Boolean);
  }

  if (data?.models && typeof data.models === "object") {
    return Object.entries(data.models)
      .filter(([, info]) => !info?.isInternal)
      .map(([id, info]) => ({
        id,
        name: info?.displayName || info?.name || id,
      }));
  }

  return [];
};

const appendCodexReviewModels = (models) => models.flatMap((model) => {
  const id = model?.id || model?.slug || model?.model || model?.name;
  if (!id) return [];
  const name = model?.display_name || model?.displayName || model?.name || id;
  const normalized = { ...model, id, name };
  const isChatModel = (model?.type || "llm") !== "image" && !id.toLowerCase().includes("embed");
  if (!isChatModel || id.endsWith("-review")) return [normalized];
  return [
    normalized,
    {
      ...normalized,
      id: `${id}-review`,
      name: `${name} Review`,
      upstreamModelId: id,
      quotaFamily: "review",
    },
  ];
});

const parseCodexModels = (data) => appendCodexReviewModels(parseOpenAIStyleModels(data));

const createOpenAIModelsConfig = (url) => ({
  url,
  method: "GET",
  headers: { "Content-Type": "application/json" },
  authHeader: "Authorization",
  authPrefix: "Bearer ",
  parseResponse: parseOpenAIStyleModels
});

const getStaticProviderModels = (providerId) =>
  getModelsByProviderId(providerId).map((model) => ({
    ...model,
    id: model.id,
    name: model.name || model.id,
  }));

// Generic custom resolver for OAuth providers that need refresh-on-401 + token persist.
// Receives a `fetchFn(token)` and returns parsed models or throws.
const buildOAuthResolver = ({ refreshFn, fetchFn, parseFn, errorLabel }) => async (connection) => {
  const { accessToken, refreshToken } = connection;
  if (!accessToken) {
    return { error: "No valid token found", status: 401 };
  }
  let warning;
  try {
    let response = await fetchFn(accessToken, connection);
    if (!response.ok && (response.status === 401 || response.status === 403) && refreshToken) {
      const refreshed = await refreshFn(connection);
      if (refreshed?.accessToken) {
        await updateProviderCredentials(connection.id, {
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken || refreshToken,
          expiresIn: refreshed.expiresIn,
        });
        connection.accessToken = refreshed.accessToken;
        if (refreshed.refreshToken) connection.refreshToken = refreshed.refreshToken;
        response = await fetchFn(refreshed.accessToken, connection);
      }
    }
    if (response.ok) {
      const data = await response.json();
      const models = parseFn(data);
      if (models.length > 0) return { models };
    } else {
      const errorText = await response.text();
      warning = `${errorLabel}: ${response.status} ${errorText}`;
      console.log(`${errorLabel} (falling back to static):`, errorText);
    }
  } catch (error) {
    warning = `${errorLabel}: ${error.message}`;
    console.log(`${errorLabel} (falling back to static):`, error.message);
  }
  return { models: [], warning };
};

// Provider models endpoints configuration
const PROVIDER_MODELS_CONFIG = {
  // Claude Code (OAuth) and Anthropic (API key) share the /v1/models endpoint
  // but not the auth scheme: an OAuth token sent as `x-api-key` is answered
  // 401 "API key is invalid". OAuth must go as `Authorization: Bearer` with
  // the oauth-2025-04-20 beta, and refresh once on 401/403.
  claude: {
    customResolver: async (connection) => {
      const isOAuth = connection.authType === "oauth" || (!connection.apiKey && !!connection.accessToken);
      const url = "https://api.anthropic.com/v1/models?limit=1000";
      const headersFor = (token) => isOAuth
        ? {
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01",
            "anthropic-beta": "oauth-2025-04-20",
            "Authorization": `Bearer ${token}`,
          }
        : {
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01",
            "x-api-key": token,
          };
      const request = (token) => fetch(url, {
        method: "GET",
        headers: headersFor(token),
        redirect: "error",
        signal: AbortSignal.timeout(30000),
      });

      let token = isOAuth ? connection.accessToken : connection.apiKey;
      if (!token) return { error: "No valid token found", status: 401 };

      let response = await request(token);
      if (!response.ok && isOAuth && (response.status === 401 || response.status === 403) && connection.refreshToken) {
        try {
          const refreshed = await refreshClaudeOAuthToken(connection.refreshToken);
          if (refreshed?.accessToken) {
            await updateProviderCredentials(connection.id, {
              accessToken: refreshed.accessToken,
              refreshToken: refreshed.refreshToken || connection.refreshToken,
              expiresIn: refreshed.expiresIn,
            });
            token = refreshed.accessToken;
            response = await request(token);
          }
        } catch (error) {
          console.log("Failed to refresh Claude token for model discovery:", error.message);
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.log("Failed to fetch Claude models:", response.status, errorText);
        return { models: getStaticProviderModels("claude"), source: "static", warning: `Failed to fetch Claude models: ${response.status}` };
      }
      const data = await response.json();
      const models = (data.data || []).map((m) => ({ id: m.id, name: m.display_name || m.name || m.id }));
      if (models.length) return { models, source: "live", fetchedAt: new Date().toISOString() };
      return { models: getStaticProviderModels("claude"), source: "static", warning: "Claude returned no models; showing the bundled catalog." };
    },
  },
  gemini: {
    url: "https://generativelanguage.googleapis.com/v1beta/models",
    method: "GET",
    headers: { "Content-Type": "application/json" },
    authQuery: "key", // Use query param for API key
    parseResponse: (data) => data.models || []
  },
  codex: {
    customResolver: buildOAuthResolver({
      refreshFn: (conn) => refreshCodexToken(conn.refreshToken),
      fetchFn: (token) => fetch(CODEX_MODELS_URL, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${token}`,
          "originator": "codex_cli_rs"
        }
      }),
      parseFn: parseCodexModels,
      errorLabel: "Failed to fetch Codex models"
    })
  },
  antigravity: {
    customResolver: async () => ({
      models: getStaticProviderModels("antigravity"),
      source: "static",
      warning: "This integration uses the bundled catalog; live model discovery is unavailable.",
    }),
  },
  github: {
    url: "https://api.githubcopilot.com/models",
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Copilot-Integration-Id": "vscode-chat",
      "editor-version": "vscode/1.107.1",
      "editor-plugin-version": "copilot-chat/0.26.7",
      "user-agent": "GitHubCopilotChat/0.26.7"
    },
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    parseResponse: (data) => {
      if (!data?.data) return [];
      // Filter out embeddings, non-chat models, and disabled models
      return data.data
        .filter(m => m.capabilities?.type === "chat")
        .filter(m => m.policy?.state !== "disabled") // Only return explicitly enabled models
        .map(m => ({
          id: m.id,
          name: m.name || m.id,
          version: m.version,
          capabilities: m.capabilities,
          isDefault: m.model_picker_enabled === true
        }));
    }
  },
  openai: createOpenAIModelsConfig("https://api.openai.com/v1/models"),
  openrouter: createOpenAIModelsConfig("https://openrouter.ai/api/v1/models"),
  anthropic: {
    url: "https://api.anthropic.com/v1/models",
    method: "GET",
    headers: {
      "Anthropic-Version": "2023-06-01",
      "Content-Type": "application/json"
    },
    authHeader: "x-api-key",
    parseResponse: (data) => data.data || []
  },

  alicode: {
    url: "https://coding.dashscope.aliyuncs.com/v1/models",
    method: "GET",
    headers: { "Content-Type": "application/json" },
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    parseResponse: (data) => data.data || []
  },
  "alicode-intl": {
    url: "https://coding-intl.dashscope.aliyuncs.com/v1/models",
    method: "GET",
    headers: { "Content-Type": "application/json" },
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    parseResponse: (data) => data.data || []
  },
  "alims-intl": {
    url: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/models",
    method: "GET",
    headers: { "Content-Type": "application/json" },
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    parseResponse: (data) => data.data || []
  },
  "volcengine-ark": createOpenAIModelsConfig("https://ark.cn-beijing.volces.com/api/coding/v3/models"),
  byteplus: createOpenAIModelsConfig("https://ark.ap-southeast.bytepluses.com/api/coding/v3/models"),

  // OpenAI-compatible API key providers
  deepseek: createOpenAIModelsConfig("https://api.deepseek.com/models"),
  groq: createOpenAIModelsConfig("https://api.groq.com/openai/v1/models"),
  xai: createOpenAIModelsConfig("https://api.x.ai/v1/models"),
  mistral: createOpenAIModelsConfig("https://api.mistral.ai/v1/models"),
  perplexity: { customResolver: async () => ({ models: getStaticProviderModels("perplexity"), source: "static", warning: "Sonar does not expose a model-list API; showing the bundled catalog." }) },
  "perplexity-agent": createOpenAIModelsConfig("https://api.perplexity.ai/v1/models"),
  together: createOpenAIModelsConfig("https://api.together.xyz/v1/models"),
  fireworks: createOpenAIModelsConfig("https://api.fireworks.ai/inference/v1/models"),
  cerebras: createOpenAIModelsConfig("https://api.cerebras.ai/v1/models"),
  cohere: createOpenAIModelsConfig("https://api.cohere.ai/v1/models"),
  nebius: createOpenAIModelsConfig("https://api.studio.nebius.ai/v1/models"),
  siliconflow: createOpenAIModelsConfig("https://api.siliconflow.com/v1/models"),
  hyperbolic: createOpenAIModelsConfig("https://api.hyperbolic.xyz/v1/models"),
  ollama: createOpenAIModelsConfig("https://ollama.com/api/tags"),
  // ollama-local: url resolved dynamically below via providerSpecificData.baseUrl
  nanobanana: createOpenAIModelsConfig("https://api.nanobananaapi.ai/v1/models"),
  chutes: createOpenAIModelsConfig("https://llm.chutes.ai/v1/models"),
  nvidia: createOpenAIModelsConfig("https://integrate.api.nvidia.com/v1/models"),
  assemblyai: createOpenAIModelsConfig("https://api.assemblyai.com/v1/models"),
  "vercel-ai-gateway": createOpenAIModelsConfig("https://ai-gateway.vercel.sh/v1/models"),
  tokenrouter: createOpenAIModelsConfig("https://api.tokenrouter.com/v1/models"),
  kimchi: {
    customResolver: async (connection) => {
      const result = await resolveKimchiModels({
        accessToken: connection.accessToken,
        apiKey: connection.apiKey,
        providerSpecificData: connection.providerSpecificData || {},
      }, { forceRefresh: true, log: console });
      if (result?.models?.length) {
        return { models: result.models };
      }
      return {
        models: getStaticProviderModels("kimchi"),
        warning: "Kimchi returned no live models; falling back to static catalog.",
      };
    }
  },
  cursor: {
    customResolver: async (connection) => {
      const result = await resolveCursorModels({
        accessToken: connection.accessToken,
        providerSpecificData: connection.providerSpecificData || {},
      }, { forceRefresh: true, log: console });
      if (result?.models?.length) return { models: result.models };
      return {
        models: getStaticProviderModels("cursor"),
        warning: "Cursor returned no live models; falling back to static catalog.",
      };
    },
  },

  // Custom resolvers (non-OpenAI-shaped APIs / token-refresh flows)
  kiro: {
    customResolver: async (connection) => {
      const credentials = {
        accessToken: connection.accessToken,
        refreshToken: connection.refreshToken,
        providerSpecificData: connection.providerSpecificData || {}
      };
      let warning;
      try {
        const result = await resolveKiroModels(credentials, {
          forceRefresh: true,
          log: console,
          onCredentialsRefreshed: async (refreshed) => {
            if (refreshed?.accessToken) {
              await updateProviderCredentials(connection.id, {
                accessToken: refreshed.accessToken,
                refreshToken: refreshed.refreshToken || connection.refreshToken,
                expiresIn: refreshed.expiresIn,
              });
              connection.accessToken = refreshed.accessToken;
              if (refreshed.refreshToken) connection.refreshToken = refreshed.refreshToken;
            }
          }
        });
        if (result?.models?.length) {
          return {
            source: "live",
            models: result.models.map((m) => ({
              id: m.id,
              name: m.name,
              upstreamModelId: m.upstreamModelId,
              contextLength: m.contextLength,
              rateMultiplier: m.rateMultiplier,
              capabilities: m.capabilities,
              description: m.description
            }))
          };
        }
        warning = "Kiro returned no models; falling back to static catalog.";
      } catch (error) {
        warning = `Failed to fetch Kiro models: ${error.message}`;
        console.log("Failed to fetch Kiro models dynamically, falling back to static:", error.message);
      }
      return { models: getStaticProviderModels("kiro"), source: "static", warning };
    }
  },
  qoder: {
    customResolver: async (connection) => {
      const credentials = {
        accessToken: connection.accessToken,
        apiKey: connection.apiKey,
        refreshToken: connection.refreshToken,
        email: connection.email,
        displayName: connection.displayName,
        providerSpecificData: connection.providerSpecificData || {},
      };
      let warning;
      try {
        const result = await resolveQoderModels(credentials, { forceRefresh: true });
        if (result?.models?.length) {
          return {
            models: result.models.map((m) => ({
              // Use the canonical "qoder/<key>" id so the dashboard
              // surfaces the same identifier the chat router expects.
              id: `qoder/${m.id}`,
              name: m.name,
              contextLength: m.contextLength,
              isVL: m.isVL,
              isReasoning: m.isReasoning,
              maxOutputTokens: m.maxOutputTokens,
              description: m.description,
            })),
          };
        }
        warning = "Qoder returned no models; falling back to static catalog.";
      } catch (error) {
        warning = `Failed to fetch Qoder models: ${error.message}`;
        console.log("Failed to fetch Qoder models dynamically, falling back to static:", error.message);
      }
      return { models: [], warning };
    },
  },
  "gemini-cli": {
    customResolver: buildOAuthResolver({
      refreshFn: (conn) => refreshGoogleToken(conn.refreshToken, GEMINI_CONFIG.clientId, GEMINI_CONFIG.clientSecret),
      fetchFn: (token, conn) => {
        const projectId = conn.projectId || conn.providerSpecificData?.projectId;
        const body = projectId ? { project: projectId } : {};
        return fetch(GEMINI_CLI_MODELS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "User-Agent": "google-api-nodejs-client/9.15.1",
            "X-Goog-Api-Client": "google-cloud-sdk vscode_cloudshelleditor/0.1"
          },
          body: JSON.stringify(body)
        });
      },
      parseFn: parseGeminiCliModels,
      errorLabel: "Failed to fetch Gemini CLI models"
    })
  },
  "grok-cli": {
    customResolver: async (connection) => {
      const proxy = await resolveConnectionProxyConfig(connection.providerSpecificData || {});
      const result = await resolveGrokCliModels({
        ...connection,
        connectionId: connection.id,
      }, {
        log: console,
        proxyOptions: {
          connectionProxyEnabled: proxy.connectionProxyEnabled === true,
          connectionProxyUrl: proxy.connectionProxyUrl || "",
          connectionNoProxy: proxy.connectionNoProxy || "",
          vercelRelayUrl: proxy.vercelRelayUrl || "",
          strictProxy: proxy.strictProxy === true,
        },
        onCredentialsRefreshed: async (refreshed) => {
          await updateProviderCredentials(connection.id, {
            ...refreshed,
            existingProviderSpecificData: connection.providerSpecificData || {},
          });
        },
      });
      if (result.models.length) return result;
      return {
        models: getStaticProviderModels("grok-cli"),
        warning: result.warning || "Grok CLI returned no live models; using static catalog.",
      };
    },
  },
  "ollama-local": {
    customResolver: async (connection) => {
      const url = `${resolveOllamaLocalHost(connection)}/api/tags`;
      const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.log("Error fetching models from ollama-local:", errorText);
        return { error: `Failed to fetch models: ${response.status}`, status: response.status };
      }
      const data = await response.json();
      return { models: parseOpenAIStyleModels(data) };
    }
  }
};

export async function resolveProviderConnectionModels(connection) {
  if (isOpenAICompatibleProvider(connection.provider)) {
    const baseUrl = connection.providerSpecificData?.baseUrl;
    if (!baseUrl) return { error: "No base URL configured for OpenAI compatible provider", status: 400 };
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/models`, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${connection.apiKey}`,
      },
    });
    if (!response.ok) return { error: `Failed to fetch models: ${response.status}`, status: response.status };
    const data = await response.json();
    return { models: data.data || data.models || [] };
  }

  if (isAnthropicCompatibleProvider(connection.provider)) {
    let baseUrl = connection.providerSpecificData?.baseUrl;
    if (!baseUrl) return { error: "No base URL configured for Anthropic compatible provider", status: 400 };
    baseUrl = baseUrl.replace(/\/$/, "").replace(/\/messages$/, "");
    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": connection.apiKey,
        "anthropic-version": "2023-06-01",
        "Authorization": `Bearer ${connection.apiKey}`,
      },
    });
    if (!response.ok) return { error: `Failed to fetch models: ${response.status}`, status: response.status };
    const data = await response.json();
    return { models: data.data || data.models || [] };
  }

  const config = PROVIDER_MODELS_CONFIG[connection.provider];
  if (!config) {
    const source = findRegistryModelSource(connection.provider);
    let warning = "No live model-list endpoint is registered; showing the bundled catalog.";
    if (source) {
      try {
        const result = await fetchRegistryModels(source, connection);
        if (result.models.length) return result;
        warning = result.warning;
      } catch { warning = "Live model refresh failed or timed out; showing the bundled catalog."; }
    }
    const models = getStaticProviderModels(connection.provider);
    return { models, source: "static", warning, fetchedAt: new Date().toISOString() };
  }
  if (typeof config.customResolver === "function") return config.customResolver(connection);

  // Prefer the credential that matches the config's scheme: key-header
  // providers (x-api-key, x-goog-api-key) must never receive an OAuth token.
  const usesKeyHeader = !!config.authHeader && config.authHeader.toLowerCase() !== "authorization";
  const token = usesKeyHeader
    ? (connection.apiKey || connection.accessToken)
    : (connection.providerSpecificData?.copilotToken || connection.accessToken || connection.apiKey);
  if (!token) return { error: "No valid token found", status: 401 };

  let url = config.url;
  if (config.authQuery) url += `?${config.authQuery}=${token}`;
  const headers = { ...config.headers };
  if (config.authHeader && !config.authQuery) {
    headers[config.authHeader] = (config.authPrefix || "") + token;
  }
  const fetchOptions = { method: config.method, headers, signal: AbortSignal.timeout(30000), redirect: "error" };
  if (config.body && config.method === "POST") fetchOptions.body = JSON.stringify(config.body);

  const response = await fetch(url, fetchOptions);
  if (!response.ok) return { error: `Failed to fetch models: ${response.status}`, status: response.status };
  const data = await response.json();
  return { models: config.parseResponse(data), source: "live", fetchedAt: new Date().toISOString() };
}

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const connection = await getProviderConnectionById(id);
    if (!connection) return NextResponse.json({ error: "Connection not found" }, { status: 404 });

    const result = await resolveProviderConnectionModels(connection);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 });
    }
    return NextResponse.json({
      provider: connection.provider,
      connectionId: connection.id,
      models: normalizeLiveModels(connection, result.models || []),
      ...(result.source ? { source: result.source } : {}),
      ...(result.fetchedAt ? { fetchedAt: result.fetchedAt } : {}),
      ...(result.warning ? { warning: result.warning } : {}),
    });
  } catch (error) {
    console.log("Error fetching provider models:", error);
    return NextResponse.json({ error: "Failed to fetch models" }, { status: 500 });
  }
}

// Save only identities from a freshly resolved account catalog, never arbitrary client metadata.
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const connection = await getProviderConnectionById(id);
    if (!connection) return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    const { modelIds } = await request.json();
    if (!Array.isArray(modelIds) || !modelIds.length || modelIds.some((id) => typeof id !== "string")) return NextResponse.json({ error: "Select at least one model to save" }, { status: 400 });
    const result = await resolveProviderConnectionModels(connection);
    if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 502 });
    if (result.source === "static" || result.warning) return NextResponse.json({ error: result.warning || "Live model discovery is unavailable for this provider" }, { status: 409 });
    const wanted = new Set(modelIds);
    const rows = normalizeLiveModels(connection, result.models || []).filter((model) => wanted.has(model.id));
    if (new Set(rows.map((row) => row.id)).size !== wanted.size) return NextResponse.json({ error: "The upstream catalog changed. Get New Models again before saving." }, { status: 409 });
    const saved = await upsertCustomModels(rows);
    return NextResponse.json({ success: true, ...saved, saved: rows.length, models: rows });
  } catch {
    return NextResponse.json({ error: "Failed to save the live model catalog" }, { status: 500 });
  }
}
