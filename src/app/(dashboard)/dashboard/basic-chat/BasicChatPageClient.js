"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button } from "@/shared/components";
import { getModelsByProviderId } from "@/shared/constants/models";
import { isAnthropicCompatibleProvider, isOpenAICompatibleProvider } from "@/shared/constants/providers";
import { Icon } from "@/shared/components/Icon";

const STORAGE_KEYS = {
  sessions: "basic-chat.sessions",
  activeSessionId: "basic-chat.activeSessionId",
  activeProviderId: "basic-chat.activeProviderId",
  draft: "basic-chat.draft",
  paramsOpen: "basic-chat.paramsOpen",
  systemPrompt: "basic-chat.systemPrompt",
  temperature: "basic-chat.temperature",
  maxTokens: "basic-chat.maxTokens",
  topP: "basic-chat.topP",
};

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `chat_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function safeParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function textValue(value) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(textValue).filter(Boolean).join(" ");
  if (typeof value === "object") {
    if (typeof value.message === "string") return value.message;
    if (typeof value.error === "string") return value.error;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function humanize(value = "") {
  return String(value)
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim() || "Unknown";
}

function formatRelativeTime(value) {
  if (!value) return "Now";
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "Now";
  const diffMinutes = Math.max(1, Math.round((Date.now() - time) / 60000));
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  return `${Math.round(diffHours / 24)}d`;
}

function makeSessionTitle(text = "") {
  const normalized = textValue(text).replace(/\s+/g, " ").trim();
  if (!normalized) return "New chat";
  return normalized.length > 52 ? `${normalized.slice(0, 52).trimEnd()}…` : normalized;
}

function buildUserContent(message) {
  const text = textValue(message.content).trim();
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];

  if (attachments.length === 0) return text;

  const content = [];
  if (text) content.push({ type: "text", text });

  for (const attachment of attachments) {
    if (attachment?.dataUrl) {
      content.push({ type: "image_url", image_url: { url: attachment.dataUrl } });
    }
  }

  return content.length > 0 ? content : text;
}

function readAssistantText(chunk) {
  if (!chunk || typeof chunk !== "object") return "";
  const choice = chunk.choices?.[0];
  const delta = choice?.delta || {};
  const pieces = [delta.content, choice?.message?.content, chunk.output_text, chunk.text]
    .map(textValue)
    .filter(Boolean);
  return pieces[0] || "";
}

async function fileToDataUrl(file) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function cloneSession(session) {
  return {
    ...session,
    messages: Array.isArray(session.messages) ? session.messages.map((message) => ({ ...message })) : [],
  };
}

function getProviderLabel(connection) {
  return connection?.name || humanize(connection?.provider || connection?.id || "provider");
}

function normalizeStaticModel(model, connection) {
  if (!model?.id) return null;
  return {
    id: `${connection.provider}/${model.id}`,
    requestModel: `${connection.provider}/${model.id}`,
    name: model.name || model.id,
    providerId: connection.provider,
    providerName: getProviderLabel(connection),
    source: "static",
  };
}

function normalizeLiveModel(model, connection) {
  const rawId = typeof model === "string" ? model : model?.id || model?.name || model?.model || "";
  if (!rawId) return null;

  const displayName = typeof model === "string"
    ? model
    : model?.name || model?.displayName || rawId;

  let requestModel = rawId;
  const isCompatible = isOpenAICompatibleProvider(connection.provider) || isAnthropicCompatibleProvider(connection.provider);
  if (isCompatible && !rawId.includes("/")) {
    requestModel = `${connection.provider}/${rawId}`;
  }

  return {
    id: requestModel,
    requestModel,
    name: displayName,
    providerId: connection.provider,
    providerName: getProviderLabel(connection),
    source: "live",
  };
}

function parseProviderModelsPayload(data) {
  if (Array.isArray(data?.models)) return data.models;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data)) return data;
  return [];
}

function dedupeModels(models) {
  const map = new Map();
  for (const model of models) {
    if (!model?.id) continue;
    if (!map.has(model.id)) map.set(model.id, model);
  }
  return Array.from(map.values());
}

export default function BasicChatPageClient() {
  const [providerGroups, setProviderGroups] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [activeProviderId, setActiveProviderId] = useState("");
  const [activeModelId, setActiveModelId] = useState("");
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [isHydrated, setIsHydrated] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [paramsOpen, setParamsOpen] = useState(false);

  // Parameters
  const [systemPrompt, setSystemPrompt] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState("");
  const [topP, setTopP] = useState(1.0);

  const fileInputRef = useRef(null);
  const abortRef = useRef(null);
  const initializedRef = useRef(false);
  const modelMenuRef = useRef(null);
  const historyMenuRef = useRef(null);
  const chatBottomRef = useRef(null);

  useEffect(() => {
    try {
      const saved = safeParse(globalThis.localStorage?.getItem(STORAGE_KEYS.sessions), []);
      if (Array.isArray(saved) && saved.length > 0) {
        setSessions(saved.map((session) => ({
          ...session,
          messages: Array.isArray(session.messages) ? session.messages : [],
        })));
      }
      const savedActiveSessionId = globalThis.localStorage?.getItem(STORAGE_KEYS.activeSessionId) || "";
      if (savedActiveSessionId) setActiveSessionId(savedActiveSessionId);
      const savedActiveProviderId = globalThis.localStorage?.getItem(STORAGE_KEYS.activeProviderId) || "";
      if (savedActiveProviderId) setActiveProviderId(savedActiveProviderId);
      const savedDraft = globalThis.localStorage?.getItem(STORAGE_KEYS.draft) || "";
      if (savedDraft) setDraft(savedDraft);
      const savedParamsOpen = globalThis.localStorage?.getItem(STORAGE_KEYS.paramsOpen);
      if (savedParamsOpen != null) setParamsOpen(savedParamsOpen === "true");
      const savedSystemPrompt = globalThis.localStorage?.getItem(STORAGE_KEYS.systemPrompt);
      if (savedSystemPrompt != null) setSystemPrompt(savedSystemPrompt);
      const savedTemp = globalThis.localStorage?.getItem(STORAGE_KEYS.temperature);
      if (savedTemp != null && !Number.isNaN(Number(savedTemp))) setTemperature(Number(savedTemp));
      const savedMaxTokens = globalThis.localStorage?.getItem(STORAGE_KEYS.maxTokens);
      if (savedMaxTokens != null) setMaxTokens(savedMaxTokens);
      const savedTopP = globalThis.localStorage?.getItem(STORAGE_KEYS.topP);
      if (savedTopP != null && !Number.isNaN(Number(savedTopP))) setTopP(Number(savedTopP));
    } catch {}
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoadingData(true);
      setLoadError("");

      try {
        const providersRes = await fetch("/api/providers", { cache: "no-store" });
        const providersData = await providersRes.json().catch(() => ({}));
        const connections = Array.isArray(providersData.connections)
          ? providersData.connections.filter((connection) => connection?.isActive !== false)
          : [];

        if (connections.length === 0) {
          if (!cancelled) {
            setProviderGroups([]);
            setLoadError("No providers connected yet. Configure a provider in Providers settings.");
          }
          return;
        }

        const providerMap = new Map();

        for (const connection of connections) {
          const providerId = connection.provider || connection.id;
          const providerName = getProviderLabel(connection);
          const providerType = isOpenAICompatibleProvider(providerId)
            ? "openai-compatible"
            : isAnthropicCompatibleProvider(providerId)
              ? "anthropic-compatible"
              : providerId;

          if (!providerMap.has(providerId)) {
            providerMap.set(providerId, {
              providerId,
              providerName,
              providerType,
              connections: [],
              models: [],
            });
          }

          const group = providerMap.get(providerId);
          group.providerName = group.providerName || providerName;
          group.providerType = group.providerType || providerType;
          group.connections.push(connection);

          const staticModels = getModelsByProviderId(providerId)
            .map((model) => normalizeStaticModel(model, connection))
            .filter(Boolean);
          group.models.push(...staticModels);
        }

        const liveResults = await Promise.all(
          connections.map(async (connection) => {
            try {
              const response = await fetch(`/api/providers/${connection.id}/models`, { cache: "no-store" });
              const data = await response.json().catch(() => ({}));
              if (!response.ok) return { connection, models: [] };
              const models = parseProviderModelsPayload(data)
                .map((model) => normalizeLiveModel(model, connection))
                .filter(Boolean);
              return { connection, models };
            } catch {
              return { connection, models: [] };
            }
          })
        );

        for (const result of liveResults) {
          const providerId = result.connection.provider || result.connection.id;
          const group = providerMap.get(providerId);
          if (!group) continue;
          group.models.push(...result.models);
        }

        const normalized = Array.from(providerMap.values())
          .map((group) => ({
            ...group,
            models: dedupeModels(group.models).sort((a, b) => a.name.localeCompare(b.name)),
          }))
          .filter((group) => group.models.length > 0)
          .sort((a, b) => a.providerName.localeCompare(b.providerName));

        if (!cancelled) {
          setProviderGroups(normalized);
          if (normalized.length === 0) {
            setLoadError("Providers connected but no models available.");
          }
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(textValue(error?.message) || "Failed to load providers and models.");
          setProviderGroups([]);
        }
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(event.target)) {
        setModelMenuOpen(false);
      }
      if (historyMenuRef.current && !historyMenuRef.current.contains(event.target)) {
        setHistoryOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const modelIndex = useMemo(() => {
    const map = new Map();
    for (const group of providerGroups) {
      for (const model of group.models) {
        map.set(model.id, {
          ...model,
          providerId: group.providerId,
          providerName: group.providerName,
        });
      }
    }
    return map;
  }, [providerGroups]);

  const activeProviderGroup = useMemo(() => {
    return providerGroups.find((group) => group.providerId === activeProviderId) || providerGroups[0] || null;
  }, [providerGroups, activeProviderId]);

  const activeModel = useMemo(() => {
    if (activeModelId && modelIndex.has(activeModelId)) return modelIndex.get(activeModelId);
    if (activeSessionId) {
      const session = sessions.find((item) => item.id === activeSessionId);
      if (session?.modelId && modelIndex.has(session.modelId)) return modelIndex.get(session.modelId);
    }
    return activeProviderGroup?.models?.[0] || null;
  }, [activeModelId, modelIndex, activeProviderGroup, sessions, activeSessionId]);

  const currentSession = useMemo(() => sessions.find((session) => session.id === activeSessionId) || null, [sessions, activeSessionId]);
  const currentMessages = currentSession?.messages || [];
  const sessionItems = useMemo(() => [...sessions].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()), [sessions]);
  const canSend = !isSending && !!activeModel && (draft.trim().length > 0 || attachments.length > 0);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      globalThis.localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(sessions));
      globalThis.localStorage.setItem(STORAGE_KEYS.activeSessionId, activeSessionId);
      globalThis.localStorage.setItem(STORAGE_KEYS.activeProviderId, activeProviderId);
      globalThis.localStorage.setItem(STORAGE_KEYS.draft, draft);
      globalThis.localStorage.setItem(STORAGE_KEYS.paramsOpen, String(paramsOpen));
      globalThis.localStorage.setItem(STORAGE_KEYS.systemPrompt, systemPrompt);
      globalThis.localStorage.setItem(STORAGE_KEYS.temperature, String(temperature));
      globalThis.localStorage.setItem(STORAGE_KEYS.maxTokens, maxTokens);
      globalThis.localStorage.setItem(STORAGE_KEYS.topP, String(topP));
    } catch {
      // Ignore storage errors.
    }
  }, [isHydrated, sessions, activeSessionId, activeProviderId, draft, paramsOpen, systemPrompt, temperature, maxTokens, topP]);

  useEffect(() => {
    if (!isHydrated || loadingData || initializedRef.current) return;
    if (providerGroups.length === 0) return;

    const savedProvider = providerGroups.find((group) => group.providerId === activeProviderId) || providerGroups[0];
    const savedModel = activeModelId && modelIndex.has(activeModelId)
      ? modelIndex.get(activeModelId)
      : savedProvider.models[0];

    if (sessions.length > 0) {
      const session = sessions.find((item) => item.id === activeSessionId) || sessions[0];
      const sessionModel = session?.modelId && modelIndex.has(session.modelId)
        ? modelIndex.get(session.modelId)
        : savedModel;
      initializedRef.current = true;
      setActiveSessionId(session.id);
      setActiveProviderId(sessionModel?.providerId || savedProvider.providerId);
      setActiveModelId(sessionModel?.id || savedModel.id);
      return;
    }

    const session = {
      id: createId(),
      title: "New chat",
      providerId: savedProvider.providerId,
      providerName: savedProvider.providerName,
      modelId: savedModel.id,
      modelName: savedModel.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };

    initializedRef.current = true;
    setSessions([session]);
    setActiveSessionId(session.id);
    setActiveProviderId(savedProvider.providerId);
    setActiveModelId(savedModel.id);
  }, [isHydrated, loadingData, providerGroups, modelIndex, sessions, activeSessionId, activeProviderId, activeModelId]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages.length, streamingText]);

  const updateSession = (sessionId, updater) => {
    setSessions((prev) => prev.map((session) => (session.id === sessionId ? updater(cloneSession(session)) : session)));
  };

  const ensureSessionForModel = (model) => {
    if (!model) return null;
    return {
      id: createId(),
      title: "New chat",
      providerId: model.providerId,
      providerName: model.providerName,
      modelId: model.id,
      modelName: model.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };
  };

  const handleNewChat = () => {
    if (!activeModel) return;
    const session = ensureSessionForModel(activeModel);
    if (!session) return;
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(session.id);
    setActiveProviderId(session.providerId);
    setActiveModelId(session.modelId);
    setDraft("");
    setAttachments([]);
    setStreamingMessageId("");
    setStreamingText("");
  };

  const handleSelectSession = (sessionId) => {
    const session = sessions.find((item) => item.id === sessionId);
    if (!session) return;
    setActiveSessionId(sessionId);
    setActiveProviderId(session.providerId || activeProviderId);
    setActiveModelId(session.modelId || activeModelId);
    setHistoryOpen(false);
  };

  const handleDeleteCurrentChat = () => {
    if (!activeSessionId) return;
    const nextSessions = sessions.filter((session) => session.id !== activeSessionId);
    const fallback = nextSessions[0] || null;
    setSessions(nextSessions);
    if (fallback) {
      setActiveSessionId(fallback.id);
      setActiveProviderId(fallback.providerId);
      setActiveModelId(fallback.modelId);
    } else {
      setActiveSessionId("");
      setActiveProviderId("");
      setActiveModelId("");
    }
  };

  const handleSelectModel = (modelId) => {
    const model = modelIndex.get(modelId);
    if (!model) return;

    const current = sessions.find((session) => session.id === activeSessionId);
    if (current && current.messages.length > 0) {
      const session = ensureSessionForModel(model);
      if (!session) return;
      setSessions((prev) => [session, ...prev]);
      setActiveSessionId(session.id);
    } else if (current) {
      setSessions((prev) => prev.map((item) => (item.id === current.id ? {
        ...item,
        providerId: model.providerId,
        providerName: model.providerName,
        modelId: model.id,
        modelName: model.name,
      } : item)));
      setActiveSessionId(current.id);
    } else {
      const session = ensureSessionForModel(model);
      if (!session) return;
      setSessions((prev) => [session, ...prev]);
      setActiveSessionId(session.id);
    }

    setActiveProviderId(model.providerId);
    setActiveModelId(model.id);
    setModelMenuOpen(false);
  };

  const handleAttachFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const images = files.filter((file) => file.type.startsWith("image/"));
    if (images.length === 0) {
      event.target.value = "";
      return;
    }

    const converted = await Promise.all(images.map(async (file) => ({
      id: createId(),
      name: file.name,
      type: file.type,
      size: file.size,
      dataUrl: await fileToDataUrl(file),
    })));

    setAttachments((prev) => [...prev, ...converted]);
    event.target.value = "";
  };

  const removeAttachment = (attachmentId) => {
    setAttachments((prev) => prev.filter((attachment) => attachment.id !== attachmentId));
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const sendMessage = async () => {
    const model = activeModel || activeProviderGroup?.models?.[0] || null;
    if (!model) return;

    const userText = draft.trim();
    if (!userText && attachments.length === 0) return;

    let sessionId = activeSessionId;
    let session = sessions.find((item) => item.id === sessionId);
    if (!session) {
      session = ensureSessionForModel(model);
      if (!session) return;
      sessionId = session.id;
      setSessions((prev) => [session, ...prev]);
      setActiveSessionId(sessionId);
    }

    const userMessage = {
      id: createId(),
      role: "user",
      content: userText,
      attachments: attachments.map((attachment) => ({
        id: attachment.id,
        name: attachment.name,
        type: attachment.type,
        dataUrl: attachment.dataUrl,
      })),
      createdAt: new Date().toISOString(),
    };

    const assistantMessageId = createId();
    const assistantMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
      status: "streaming",
    };

    const nextMessages = [...(session.messages || []), userMessage, assistantMessage];
    setSessions((prev) => prev.map((item) => (item.id === sessionId ? {
      ...item,
      providerId: model.providerId,
      providerName: model.providerName,
      modelId: model.id,
      modelName: model.name,
      messages: nextMessages,
      updatedAt: new Date().toISOString(),
      title: item.title === "New chat" ? makeSessionTitle(userText) : item.title,
    } : item)));
    setDraft("");
    setAttachments([]);
    setIsSending(true);
    setStreamingMessageId(assistantMessageId);
    setStreamingText("");
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const requestMessages = nextMessages
      .filter((message) => !(message.role === "assistant" && message.id === assistantMessageId))
      .map((message) => ({
        role: message.role,
        content: message.role === "user" ? buildUserContent(message) : message.content,
      }));

    if (systemPrompt.trim()) {
      requestMessages.unshift({
        role: "system",
        content: systemPrompt.trim(),
      });
    }

    const requestBody = {
      model: model.requestModel || model.id,
      messages: requestMessages,
      stream: true,
    };
    if (temperature !== undefined && !Number.isNaN(Number(temperature))) {
      requestBody.temperature = Number(temperature);
    }
    if (maxTokens && !Number.isNaN(Number(maxTokens))) {
      requestBody.max_tokens = Number(maxTokens);
    }
    if (topP !== undefined && topP < 1.0) {
      requestBody.top_p = Number(topP);
    }

    let assistantText = "";

    try {
      const response = await fetch("/api/dashboard/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(requestBody),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(textValue(errorData.error || errorData.message || `Request failed (${response.status})`));
      }

      const reader = response.body?.getReader();
      if (!reader) {
        const data = await response.json().catch(() => ({}));
        const fallbackText = textValue(data?.choices?.[0]?.message?.content || data?.output_text || data?.error || data?.message || "");
        updateSession(sessionId, (currentSessionState) => ({
          ...currentSessionState,
          messages: currentSessionState.messages.map((message) => (message.id === assistantMessageId ? { ...message, content: fallbackText, status: "done" } : message)),
          updatedAt: new Date().toISOString(),
        }));
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") break;

          try {
            const parsed = JSON.parse(payload);
            const delta = readAssistantText(parsed);
            if (delta) {
              assistantText += delta;
              setStreamingText(assistantText);
            }
          } catch {
            // Ignore parse errors from partial lines
          }
        }
      }

      updateSession(sessionId, (currentSessionState) => ({
        ...currentSessionState,
        messages: currentSessionState.messages.map((message) => (message.id === assistantMessageId ? {
          ...message,
          content: assistantText || "No response received.",
          status: "done",
        } : message)),
        updatedAt: new Date().toISOString(),
      }));
    } catch (error) {
      if (error?.name === "AbortError") {
        updateSession(sessionId, (currentSessionState) => ({
          ...currentSessionState,
          messages: currentSessionState.messages.map((message) => (message.id === assistantMessageId ? {
            ...message,
            content: assistantText || "Request cancelled.",
            status: "aborted",
          } : message)),
          updatedAt: new Date().toISOString(),
        }));
      } else {
        const messageText = textValue(error?.message || "Failed to complete chat request");
        updateSession(sessionId, (currentSessionState) => ({
          ...currentSessionState,
          messages: currentSessionState.messages.map((message) => (message.id === assistantMessageId ? {
            ...message,
            content: `Error: ${messageText}`,
            status: "error",
          } : message)),
          updatedAt: new Date().toISOString(),
        }));
      }
    } finally {
      setIsSending(false);
      setStreamingMessageId("");
      setStreamingText("");
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSend) sendMessage();
    }
  };

  const filteredGroups = useMemo(() => {
    if (!modelSearch.trim()) return providerGroups;
    const q = modelSearch.toLowerCase();
    return providerGroups
      .map((g) => ({
        ...g,
        models: g.models.filter((m) => m.name.toLowerCase().includes(q) || m.requestModel.toLowerCase().includes(q)),
      }))
      .filter((g) => g.models.length > 0);
  }, [providerGroups, modelSearch]);

  const modelLabel = activeModel ? activeModel.name : "Select model";
  const modelSubLabel = activeModel ? activeModel.providerName : "Connected providers";

  return (
    <div className="relative flex flex-1 h-full min-h-0 min-w-0 bg-bg text-text-main font-sans">
      {/* ── Main Chat Column ────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col h-full min-h-0 min-w-0">
        {/* Top Toolbar */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6 border-b border-border bg-surface">
          {/* Model Picker */}
          <div ref={modelMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setModelMenuOpen((v) => !v)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-md border border-border bg-surface-2 hover:bg-surface-3 transition-colors text-left cursor-pointer"
            >
              <Icon name="model" className="text-primary text-[18px] shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm font-semibold text-text-main truncate max-w-[180px] sm:max-w-[280px]">
                    {modelLabel}
                  </span>
                  <Icon name="expand_more" className="text-[16px] text-text-muted shrink-0" />
                </div>
                <p className="truncate text-[11px] font-mono text-text-muted">{modelSubLabel}</p>
              </div>
            </button>

            {modelMenuOpen && (
              <div className="absolute left-0 top-[calc(100%+8px)] z-40 w-[min(500px,calc(100vw-2rem))] overflow-hidden rounded-[10px] border border-border bg-surface shadow-elevated">
                <div className="p-3 border-b border-border bg-surface-2/60">
                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border bg-surface">
                    <Icon name="search" className="text-text-muted text-[16px]" />
                    <input
                      type="text"
                      placeholder="Filter models…"
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
                      className="w-full bg-transparent text-xs text-text-main placeholder:text-text-muted outline-none"
                      autoFocus
                    />
                    {modelSearch && (
                      <button type="button" onClick={() => setModelSearch("")} className="text-text-muted hover:text-text-main">
                        <Icon name="close" className="text-[14px]" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="max-h-[55vh] overflow-y-auto p-2 space-y-2 custom-scrollbar">
                  {filteredGroups.length === 0 ? (
                    <div className="p-6 text-center text-xs text-text-muted">
                      No matching models found.
                    </div>
                  ) : (
                    filteredGroups.map((group) => (
                      <div key={group.providerId} className="rounded-md border border-border-subtle bg-surface-2/30 p-2">
                        <div className="flex items-center justify-between px-2 py-1 mb-1">
                          <span className="text-xs font-semibold text-text-main">{group.providerName}</span>
                          <span className="text-[10px] font-mono text-text-muted">{group.models.length}</span>
                        </div>
                        <div className="grid gap-1 sm:grid-cols-2">
                          {group.models.map((model) => {
                            const isActive = model.id === activeModelId;
                            return (
                              <button
                                key={model.id}
                                type="button"
                                onClick={() => handleSelectModel(model.id)}
                                className={`rounded-md border px-2.5 py-2 text-left transition-colors cursor-pointer ${
                                  isActive
                                    ? "border-primary/40 bg-primary/10 text-primary"
                                    : "border-border-subtle bg-surface hover:bg-surface-2 text-text-main"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-1.5">
                                  <div className="min-w-0">
                                    <p className="truncate text-xs font-medium">{model.name}</p>
                                    <p className="truncate text-[10px] font-mono text-text-muted">{model.requestModel}</p>
                                  </div>
                                  {isActive && <Icon name="check" className="text-[14px] text-primary shrink-0 mt-0.5" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              icon="add"
              onClick={handleNewChat}
              title="Start a new chat session"
            >
              <span className="hidden sm:inline">New</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon="history"
              onClick={() => {
                setHistoryOpen((v) => !v);
                if (!historyOpen) setParamsOpen(false);
              }}
              title="Recent conversations"
            >
              <span className="hidden sm:inline">History</span>
              {sessionItems.length > 0 && (
                <span className="ml-1 text-[10px] font-mono text-text-muted">({sessionItems.length})</span>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon="delete"
              onClick={handleDeleteCurrentChat}
              disabled={!activeSessionId || sessions.length === 0}
              title="Delete current conversation"
              aria-label="Delete current conversation"
            />
            <Button
              variant={paramsOpen ? "primary" : "secondary"}
              size="sm"
              icon="tune"
              onClick={() => {
                setParamsOpen((v) => !v);
                if (!paramsOpen) setHistoryOpen(false);
              }}
              title="Toggle Parameters"
              aria-label="Toggle Parameters"
            >
              <span className="hidden md:inline">Params</span>
            </Button>
          </div>
        </div>

        {/* Load error alert */}
        {loadError && (
          <div className="shrink-0 px-4 py-2 bg-error/10 border-b border-error/20 text-xs text-error flex items-center gap-2">
            <Icon name="error" className="text-[16px] shrink-0" />
            <span className="truncate">{loadError}</span>
          </div>
        )}

        {/* Message list */}
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 custom-scrollbar">
          {currentMessages.length === 0 ? (
            <div className="flex min-h-[50vh] items-center justify-center text-center px-4">
              <div className="max-w-md space-y-4">
                <div className="mx-auto flex size-12 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
                  <Icon name="chat" className="text-[24px]" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-base font-semibold text-text-main">Start a conversation</h2>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Test completions, reasoning, and multimodal inputs against connected models. Pinned bottom composer, configurable parameters.
                  </p>
                </div>
                <div className="pt-2 flex flex-wrap gap-2 justify-center">
                  {[
                    "Explain your routing architecture",
                    "List models supported by this endpoint",
                    "Write an SSE client in Node.js",
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDraft(preset)}
                      className="px-2.5 py-1.5 rounded-md border border-border bg-surface hover:bg-surface-2 text-xs text-text-muted hover:text-text-main transition-colors cursor-pointer text-left"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
              {currentMessages.map((message) => {
                const isUser = message.role === "user";
                const isAssistant = message.role === "assistant";
                const isStreaming = isAssistant && message.id === streamingMessageId && message.status === "streaming";
                const content = textValue(message.content) || (isAssistant ? streamingText : "");

                if (isUser) {
                  return (
                    <div key={message.id} className="flex w-full justify-end">
                      <div className="max-w-[min(88%,38rem)] rounded-[10px] bg-surface-2 border border-border px-4 py-3 text-text-main">
                        <div className="mb-1 flex items-center justify-between gap-3 text-[11px] font-mono text-text-muted">
                          <span className="font-medium text-text-main">You</span>
                          <span>{formatRelativeTime(message.createdAt)}</span>
                        </div>

                        {message.attachments?.length ? (
                          <div className="mb-2 grid grid-cols-2 gap-2 mt-2">
                            {message.attachments.map((attachment) => (
                              <a
                                key={attachment.id}
                                href={attachment.dataUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="overflow-hidden rounded-md border border-border bg-surface"
                              >
                                <img
                                  src={attachment.dataUrl}
                                  alt={attachment.name}
                                  className="h-28 w-full object-cover"
                                  loading="lazy"
                                  decoding="async"
                                />
                              </a>
                            ))}
                          </div>
                        ) : null}

                        <div className="whitespace-pre-wrap break-words text-[14px] leading-relaxed select-text font-sans">
                          {content}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={message.id} className="flex w-full justify-start">
                    <div className="w-full max-w-full text-text-main py-1">
                      <div className="mb-1.5 flex items-center gap-2 text-xs text-text-muted">
                        <Icon name="model" className="text-primary text-[14px]" />
                        <span className="font-semibold text-text-main">
                          {activeModel?.name || "Assistant"}
                        </span>
                        <span className="text-[11px] font-mono text-text-muted">
                          {formatRelativeTime(message.createdAt)}
                        </span>
                      </div>

                      <div className="whitespace-pre-wrap break-words text-[14px] leading-relaxed select-text font-sans">
                        {content}
                        {isStreaming && (
                          <span className="inline-block w-1.5 h-4 ml-0.5 align-middle bg-primary animate-pulse" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={chatBottomRef} />
            </div>
          )}
        </div>

        {/* Pinned Bottom Composer */}
        <div className="shrink-0 border-t border-border bg-bg/95 backdrop-blur-sm p-3 sm:p-4">
          <div className="mx-auto w-full max-w-3xl space-y-2">
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-1">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-text-muted"
                  >
                    <span className="max-w-[12rem] truncate text-text-main">{attachment.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(attachment.id)}
                      className="text-text-muted hover:text-text-main cursor-pointer"
                      aria-label="Remove attachment"
                    >
                      <Icon name="close" className="text-[14px]" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-[10px] border border-border bg-surface p-3 focus-within:border-primary transition-colors">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={activeModel ? `Message ${activeModel.name}…` : "Select a model to begin…"}
                rows={2}
                className="w-full resize-none bg-transparent text-[14px] leading-6 text-text-main outline-none placeholder:text-text-muted max-h-[180px] overflow-y-auto custom-scrollbar font-sans"
              />

              <div className="mt-2 flex items-center justify-between gap-3 pt-2 border-t border-border-subtle">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!activeModel || loadingData}
                    className="p-1.5 rounded-md text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors cursor-pointer"
                    title="Attach image"
                  >
                    <Icon name="attach_file" className="text-[18px]" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleAttachFiles}
                  />
                  <span className="text-[11px] font-mono text-text-muted truncate max-w-[200px]">
                    {activeModel ? activeModel.requestModel : "No model"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {isSending && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="stop"
                      onClick={handleStop}
                      title="Stop generation"
                    >
                      Stop
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    icon="arrow_upward"
                    onClick={sendMessage}
                    disabled={!canSend}
                    title="Send (Enter)"
                  >
                    Send
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-text-muted px-1">
              <span>Shift+Enter for newline</span>
              <span className="font-mono">
                {temperature !== undefined ? `T=${temperature}` : ""}
                {maxTokens ? ` · Max=${maxTokens}` : ""}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Collapsible Parameters Side Panel ───────────────────────── */}
      {paramsOpen && (
        <aside className="w-72 shrink-0 border-l border-border bg-surface p-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Icon name="tune" className="text-primary text-[18px]" />
              <h3 className="text-sm font-semibold text-text-main">Parameters</h3>
            </div>
            <button
              type="button"
              onClick={() => setParamsOpen(false)}
              className="p-1 rounded-md text-text-muted hover:text-text-main hover:bg-surface-2 cursor-pointer"
              aria-label="Close parameters"
            >
              <Icon name="close" className="text-[16px]" />
            </button>
          </div>

          <div className="space-y-4 text-xs">
            {/* System Prompt */}
            <div className="space-y-1.5">
              <label className="font-semibold text-text-main">System Prompt</label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="You are a helpful assistant…"
                rows={4}
                className="w-full rounded-md border border-border bg-surface-2 p-2.5 text-xs text-text-main placeholder:text-text-muted outline-none focus:border-primary transition-colors resize-y custom-scrollbar font-sans"
              />
              <p className="text-[11px] text-text-muted">Prepended to the chat history.</p>
            </div>

            {/* Temperature */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-text-main">Temperature</label>
                <span className="font-mono tabular-nums text-text-muted">{temperature.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
              <p className="text-[11px] text-text-muted">Lower is more deterministic; higher is more creative.</p>
            </div>

            {/* Max Output Tokens */}
            <div className="space-y-1.5">
              <label className="font-semibold text-text-main">Max Tokens</label>
              <input
                type="number"
                min="1"
                max="131072"
                step="256"
                value={maxTokens}
                onChange={(e) => setMaxTokens(e.target.value)}
                placeholder="Provider default"
                className="w-full rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-text-main placeholder:text-text-muted outline-none focus:border-primary transition-colors font-mono"
              />
            </div>

            {/* Top P */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-text-main">Top P</label>
                <span className="font-mono tabular-nums text-text-muted">{topP.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="1.0"
                step="0.05"
                value={topP}
                onChange={(e) => setTopP(parseFloat(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
            </div>

            <div className="pt-2 border-t border-border-subtle">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSystemPrompt("");
                  setTemperature(0.7);
                  setMaxTokens("");
                  setTopP(1.0);
                }}
                className="w-full text-text-muted hover:text-text-main"
              >
                Reset to Defaults
              </Button>
            </div>
          </div>
        </aside>
      )}

      {/* ── History Drawer / Panel ──────────────────────────────────── */}
      {historyOpen && (
        <aside
          ref={historyMenuRef}
          className="w-80 shrink-0 border-l border-border bg-surface p-4 flex flex-col gap-3 overflow-y-auto custom-scrollbar z-30"
        >
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Icon name="history" className="text-primary text-[18px]" />
              <h3 className="text-sm font-semibold text-text-main">Recent Chats</h3>
            </div>
            <button
              type="button"
              onClick={() => setHistoryOpen(false)}
              className="p-1 rounded-md text-text-muted hover:text-text-main hover:bg-surface-2 cursor-pointer"
              aria-label="Close history"
            >
              <Icon name="close" className="text-[16px]" />
            </button>
          </div>

          <div className="flex-1 space-y-1.5 overflow-y-auto custom-scrollbar">
            {sessionItems.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-text-muted">
                No conversations yet.
              </div>
            ) : (
              sessionItems.map((session) => {
                const isActive = session.id === activeSessionId;
                const latestMessage = [...(session.messages || [])]
                  .reverse()
                  .find((m) => m.role === "user") || session.messages?.[0];

                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => handleSelectSession(session.id)}
                    className={`w-full rounded-md border p-2.5 text-left transition-colors cursor-pointer ${
                      isActive
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border-subtle bg-surface hover:bg-surface-2 text-text-main"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold">{session.title}</p>
                        <p className="mt-0.5 truncate text-[11px] text-text-muted">
                          {textValue(latestMessage?.content) || "Empty chat"}
                        </p>
                      </div>
                      <span className="text-[10px] font-mono text-text-muted shrink-0">
                        {formatRelativeTime(session.updatedAt)}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
