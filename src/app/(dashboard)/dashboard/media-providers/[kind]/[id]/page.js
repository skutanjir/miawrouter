"use client";

import { useParams, notFound, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Card, Badge, Button, AddCustomEmbeddingModal, NoAuthProxyCard, ProviderInfoCard } from "@/shared/components";
import ProviderIcon from "@/shared/components/ProviderIcon";
import { MEDIA_PROVIDER_KINDS, AI_PROVIDERS, isCustomEmbeddingProvider } from "@/shared/constants/providers";
import ConnectionsCard from "@/app/(dashboard)/dashboard/providers/components/ConnectionsCard";
import ModelsCard from "@/app/(dashboard)/dashboard/providers/components/ModelsCard";
import { KIND_EXAMPLE_CONFIG } from "./components/exampleShared";
import { EmbeddingExampleCard } from "./components/EmbeddingExampleCard";
import { TtsExampleCard } from "./components/TtsExampleCard";
import { GenericExampleCard } from "./components/GenericExampleCard";
import { SttExampleCard } from "./components/SttExampleCard";

import { Icon } from "@/shared/components/Icon";
// MediaProviderDetailPage
export default function MediaProviderDetailPage() {
  const { kind, id } = useParams();
  const router = useRouter();
  const kindConfig = MEDIA_PROVIDER_KINDS.find((k) => k.id === kind);
  const isCustom = isCustomEmbeddingProvider(id) && kind === "embedding";

  const handleDeleteCustom = async () => {
    if (!confirm("Delete this Custom Embedding node?")) return;
    try {
      const res = await fetch(`/api/provider-nodes/${id}`, { method: "DELETE" });
      if (res.ok) router.push(`/dashboard/media-providers/${kind}`);
    } catch (error) {
      console.log("Error deleting custom embedding node:", error);
    }
  };

  const [customNode, setCustomNode] = useState(null);
  const [customLoading, setCustomLoading] = useState(isCustom);
  const [showEditModal, setShowEditModal] = useState(false);

  // Fetch custom node info from API for custom embedding nodes
  useEffect(() => {
    if (!isCustom) return;
    let cancelled = false;
    fetch("/api/provider-nodes", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setCustomNode((d.nodes || []).find((n) => n.id === id) || null);
        setCustomLoading(false);
      })
      .catch(() => { if (!cancelled) setCustomLoading(false); });
    return () => { cancelled = true; };
  }, [id, isCustom]);

  if (!kindConfig) return notFound();

  const builtInProvider = AI_PROVIDERS[id];

  // For custom embedding nodes, build a synthetic provider object
  const provider = isCustom
    ? (customNode ? { id, name: customNode.name || "Custom Embedding", color: "#6366F1", textIcon: "CE" } : null)
    : builtInProvider;

  if (!isCustom && !builtInProvider) return notFound();
  if (isCustom && !customLoading && !customNode) return notFound();
  if (isCustom && customLoading) {
    return <div className="text-text-muted text-sm py-12 text-center">Loading...</div>;
  }

  const kinds = isCustom ? ["embedding"] : (provider.serviceKinds ?? ["llm"]);
  if (!isCustom && !kinds.includes(kind)) return notFound();

  return (
    <div className="flex flex-col gap-6">
      {/* Back */}
      <div>
        <Link
          href={`/dashboard/media-providers/${kind}`}
          className="mb-4 inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-primary"
        >
          <Icon name={"arrow_back"} className=" text-lg" />
          {kindConfig.label}
        </Link>

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="size-12 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${provider.color}15` }}>
            <ProviderIcon
              src={`/providers/${provider.id}.png`}
              alt={provider.name}
              size={48}
              className="object-contain rounded-lg max-w-[48px] max-h-[48px]"
              fallbackText={provider.textIcon || provider.id.slice(0, 2).toUpperCase()}
              fallbackColor={provider.color}
            />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="text-[22px] font-semibold tracking-tight text-text-main">{provider.name}</h1>
              {!isCustom && provider.notice?.apiKeyUrl && (
                <a
                  href={provider.notice.apiKeyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  <Icon name={"open_in_new"} className=" text-sm" />
                  Get API Key
                </a>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {isCustom && <Badge variant="default" size="sm">Custom · {customNode?.prefix}</Badge>}
              {kinds.map((k) => (
                <Badge key={k} variant={k === kind ? "primary" : "default"} size="sm">
                  {MEDIA_PROVIDER_KINDS.find((entry) => entry.id === k)?.label || k}
                </Badge>
              ))}
            </div>
          </div>
          {isCustom && (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Button size="sm" variant="secondary" icon="edit" onClick={() => setShowEditModal(true)}>
                Edit
              </Button>
              <Button size="sm" variant="secondary" icon="delete" onClick={handleDeleteCustom}>
                Delete
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Kind-specific notice (e.g. codex/image requires Plus) */}
      {!isCustom && provider.kindNotice?.[kind] && (
        <div className="flex items-start gap-3 rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-warning">
          <Icon name={"warning"} className="mt-0.5 text-[20px]" />
          <p className="text-sm">{provider.kindNotice[kind]}</p>
        </div>
      )}

      {/* Provider notice text (only when there's actual text content) */}
      {!isCustom && provider.notice?.text && !provider.deprecated && (
        <div className="flex flex-col gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-primary sm:flex-row sm:items-center">
          <Icon name={"info"} className="shrink-0 text-[16px]" />
          <p className="min-w-0 flex-1 text-xs leading-relaxed">{provider.notice.text}</p>
          {provider.notice.apiKeyUrl && (
            <a
              href={provider.notice.apiKeyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex justify-center rounded-md bg-primary px-2 py-1 text-xs font-semibold text-bg transition-colors hover:bg-primary-hover sm:py-0.5"
            >
              Get API key
            </a>
          )}
        </div>
      )}

      {/* Connections */}
      {!isCustom && provider.noAuth ? (
        <NoAuthProxyCard providerId={id} />
      ) : (
        <ConnectionsCard providerId={id} isOAuth={false} />
      )}

      {/* Models - hidden for tts/webSearch/webFetch (provider IS the model); custom uses prefix as alias */}
      {kind !== "tts" && kind !== "webSearch" && kind !== "webFetch" && (
        <ModelsCard
          providerId={id}
          kindFilter={kind}
          providerAliasOverride={isCustom ? customNode?.prefix : undefined}
        />
      )}

      {/* Provider Info — config-driven, supports searchConfig, fetchConfig, ttsConfig, embeddingConfig, searchViaChat */}
      {!isCustom && (provider.searchConfig || provider.fetchConfig || provider.ttsConfig || provider.sttConfig || provider.embeddingConfig || provider.searchViaChat) && (
        <ProviderInfoCard
          config={
            kind === "webFetch" ? provider.fetchConfig
              : kind === "tts" ? provider.ttsConfig
              : kind === "stt" ? provider.sttConfig
              : kind === "embedding" ? provider.embeddingConfig
              : provider.searchConfig || { mode: "chat-completions", defaultModel: provider.searchViaChat?.defaultModel, pricingUrl: provider.searchViaChat?.pricingUrl, freeTier: provider.searchViaChat?.freeTier }
          }
          provider={provider}
          title={`${kindConfig.label} Config`}
        />
      )}

      {/* Example — per kind */}
      {kind === "embedding" && (
        <EmbeddingExampleCard providerId={id} customAlias={customNode?.prefix} />
      )}
      {kind === "tts" && <TtsExampleCard providerId={id} />}
      {kind === "stt" && !isCustom && <SttExampleCard providerId={id} />}
      {!isCustom && KIND_EXAMPLE_CONFIG[kind] && <GenericExampleCard providerId={id} kind={kind} />}

      {isCustom && (
        <AddCustomEmbeddingModal
          isOpen={showEditModal}
          node={customNode}
          onClose={() => setShowEditModal(false)}
          onSaved={(updated) => {
            setCustomNode(updated);
            setShowEditModal(false);
          }}
        />
      )}
    </div>
  );
}
