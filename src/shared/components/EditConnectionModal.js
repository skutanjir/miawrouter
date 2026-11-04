"use client";

import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Modal from "@/shared/components/Modal";
import Input from "@/shared/components/Input";
import Button from "@/shared/components/Button";
import Badge from "@/shared/components/Badge";
import { isOpenAICompatibleProvider, isAnthropicCompatibleProvider, AI_PROVIDERS } from "@/shared/constants/providers";
import Select from "@/shared/components/Select";

import { Icon } from "@/shared/components/Icon";
function SectionHeading({ children }) {
  return <h3 className="text-[15px] font-semibold text-text-main">{children}</h3>;
}

export default function EditConnectionModal({ isOpen, connection, proxyPools, onSave, onClose }) {
  const [formData, setFormData] = useState({
    name: "",
    priority: 1,
    apiKey: "",
  });
  const [azureData, setAzureData] = useState({
    azureEndpoint: "",
    apiVersion: "2024-10-01-preview",
    deployment: "",
    organization: "",
  });
  const [cloudflareData, setCloudflareData] = useState({ accountId: "" });
  const [region, setRegion] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (connection) {
      setFormData({
        name: connection.name || "",
        priority: connection.priority || 1,
        apiKey: "",
      });
      // Load Azure-specific data if present
      if (connection.provider === "azure" && connection.providerSpecificData) {
        setAzureData({
          azureEndpoint: connection.providerSpecificData.azureEndpoint || "",
          apiVersion: connection.providerSpecificData.apiVersion || "2024-10-01-preview",
          deployment: connection.providerSpecificData.deployment || "",
          organization: connection.providerSpecificData.organization || "",
        });
      }
      if (connection.provider === "cloudflare-ai" && connection.providerSpecificData) {
        setCloudflareData({ accountId: connection.providerSpecificData.accountId || "" });
      }
      // Load region for providers that support it (e.g. xiaomi-tokenplan)
      const providerCfg = AI_PROVIDERS?.[connection.provider];
      if (providerCfg?.regions) {
        const savedRegion = connection.providerSpecificData?.region || providerCfg.defaultRegion || providerCfg.regions[0]?.id || "";
        setRegion(savedRegion);
      }
      setTestResult(null);
      setValidationResult(null);
    }
  }, [connection]);

  const isOAuth = connection?.authType === "oauth";
  const isAzure = connection?.provider === "azure";
  const isCloudflareAi = connection?.provider === "cloudflare-ai";
  const isCompatible = connection
    ? (isOpenAICompatibleProvider(connection.provider) || isAnthropicCompatibleProvider(connection.provider))
    : false;
  const providerRegions = connection ? (AI_PROVIDERS?.[connection.provider]?.regions || null) : null;

  // Build providerSpecificData for region-aware providers
  const buildRegionSpecificData = () => {
    if (providerRegions && region) return { ...((connection?.providerSpecificData) || {}), region };
    return undefined;
  };

  const handleTest = async () => {
    if (!connection?.provider) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/providers/${connection.id}/test`, { method: "POST" });
      const data = await res.json();
      setTestResult(data.valid ? "success" : "failed");
    } catch {
      setTestResult("failed");
    } finally {
      setTesting(false);
    }
  };

  const handleValidate = async () => {
    if (!connection?.provider || !formData.apiKey) return;
    setValidating(true);
    setValidationResult(null);
    try {
      const res = await fetch("/api/providers/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: connection.provider,
          apiKey: formData.apiKey,
          ...(isAzure ? { providerSpecificData: azureData } : {}),
          ...(isCloudflareAi ? { providerSpecificData: cloudflareData } : {}),
          ...(providerRegions ? { providerSpecificData: buildRegionSpecificData() } : {}),
        }),
      });
      const data = await res.json();
      setValidationResult(data.valid ? "success" : "failed");
    } catch {
      setValidationResult("failed");
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async () => {
    if (!connection) return;
    setSaving(true);
    try {
      const updates = {
        name: formData.name,
        priority: formData.priority,
      };
      if (!isOAuth && formData.apiKey) {
        updates.apiKey = formData.apiKey;
        let isValid = validationResult === "success";
        if (!isValid) {
          try {
            setValidating(true);
            setValidationResult(null);
            const res = await fetch("/api/providers/validate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                provider: connection.provider,
                apiKey: formData.apiKey,
                ...(isAzure ? { providerSpecificData: azureData } : {}),
                ...(isCloudflareAi ? { providerSpecificData: cloudflareData } : {}),
                ...(providerRegions ? { providerSpecificData: buildRegionSpecificData() } : {}),
              }),
            });
            const data = await res.json();
            isValid = !!data.valid;
            setValidationResult(isValid ? "success" : "failed");
          } catch {
            setValidationResult("failed");
          } finally {
            setValidating(false);
          }
        }
        if (isValid) {
          updates.testStatus = "active";
          updates.lastError = null;
          updates.lastErrorAt = null;
        }
      }
      
      // Add Azure-specific data if this is an Azure connection
      if (isAzure) {
        updates.providerSpecificData = {
          azureEndpoint: azureData.azureEndpoint,
          apiVersion: azureData.apiVersion,
          deployment: azureData.deployment,
          organization: azureData.organization,
        };
      }
      if (isCloudflareAi) {
        updates.providerSpecificData = { accountId: cloudflareData.accountId };
      }
      // Persist updated region for region-aware providers
      if (providerRegions && region) {
        updates.providerSpecificData = buildRegionSpecificData();
      }
      
      await onSave(updates);
    } finally {
      setSaving(false);
    }
  };

  if (!connection) return null;

  return (
    <Modal isOpen={isOpen} title="Edit Connection" onClose={onClose}>
      <div className="flex flex-col gap-5">
        {/* Identity */}
        <div className="flex flex-col gap-4">
          <SectionHeading>Connection</SectionHeading>
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder={isOAuth ? "Account name" : "Production Key"}
          />
          {isOAuth && connection.email && (
            <div className="flex items-center justify-between gap-3 rounded-[10px] border border-border bg-surface-2 px-3.5 py-2.5">
              <span className="text-sm text-text-muted">Signed-in email</span>
              <span className="font-mono text-[13px] text-text-main">{connection.email}</span>
            </div>
          )}
          <Input
            label="Priority"
            type="number"
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: Number.parseInt(e.target.value, 10) || 1 })}
            hint="Lower numbers are tried first when several keys serve the same provider."
          />
        </div>

        {/* Credentials */}
        {!isOAuth && (
          <div className="flex flex-col gap-4 border-t border-border-subtle pt-5">
            <SectionHeading>Credentials</SectionHeading>
            <div className="flex items-start gap-2">
              <Input
                label="API Key"
                type="password"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                placeholder="Enter new API key"
                hint="Leave blank to keep the current API key."
                className="flex-1"
                inputClassName="font-mono text-[13px]"
              />
              <div className="pt-6">
                <Button
                  onClick={handleValidate}
                  disabled={!formData.apiKey || validating || saving}
                  variant="secondary"
                >
                  {validating ? "Checking…" : "Check"}
                </Button>
              </div>
            </div>

            {validationResult === "success" && (
              <div className="flex items-center gap-2">
                <Badge variant="success" dot>
                  Key accepted
                </Badge>
                <span className="text-[13px] text-text-muted">The provider answered a test request.</span>
              </div>
            )}
            {validationResult === "failed" && (
              <div className="flex items-start gap-2.5 rounded-[10px] border border-danger/20 bg-danger/10 p-3">
                <Icon name="error" className="mt-0.5 text-[18px] text-danger shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-text-main">The provider rejected this key</p>
                  <p className="mt-1 text-text-muted">
                    Check for a truncated paste or a revoked key, then run Check again. Saving without a
                    valid key stores the key and marks the connection inactive.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Provider-specific settings */}
        {isAzure && (
          <section className="flex flex-col gap-4 border-t border-border-subtle pt-5">
            <SectionHeading>Azure OpenAI</SectionHeading>
            <Input
              label="Azure Endpoint"
              value={azureData.azureEndpoint}
              onChange={(e) => setAzureData({ ...azureData, azureEndpoint: e.target.value })}
              placeholder="https://your-resource.openai.azure.com"
              hint="Your Azure OpenAI resource endpoint URL"
              inputClassName="font-mono text-[13px]"
            />
            <Input
              label="Deployment Name"
              value={azureData.deployment}
              onChange={(e) => setAzureData({ ...azureData, deployment: e.target.value })}
              placeholder="gpt-4"
              hint="The deployment name in your Azure resource"
              inputClassName="font-mono text-[13px]"
            />
            <Input
              label="API Version"
              value={azureData.apiVersion}
              onChange={(e) => setAzureData({ ...azureData, apiVersion: e.target.value })}
              placeholder="2024-10-01-preview"
              hint="Azure OpenAI API version to use"
              inputClassName="font-mono text-[13px]"
            />
            <Input
              label="Organization"
              value={azureData.organization}
              onChange={(e) => setAzureData({ ...azureData, organization: e.target.value })}
              placeholder="Organization ID"
              hint="Required for billing"
              inputClassName="font-mono text-[13px]"
            />
          </section>
        )}

        {isCloudflareAi && (
          <section className="flex flex-col gap-4 border-t border-border-subtle pt-5">
            <SectionHeading>Cloudflare AI</SectionHeading>
            <Input
              label="Account ID"
              value={cloudflareData.accountId}
              onChange={(e) => setCloudflareData({ ...cloudflareData, accountId: e.target.value })}
              placeholder="Cloudflare account ID"
              inputClassName="font-mono text-[13px]"
            />
          </section>
        )}

        {providerRegions && (
          <section className="flex flex-col gap-4 border-t border-border-subtle pt-5">
            <SectionHeading>Region</SectionHeading>
            <Select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              options={providerRegions.map((r) => ({ value: r.id, label: r.label }))}
            />
          </section>
        )}

        {/* Diagnostics */}
        {!isCompatible && !isAzure && !isCloudflareAi && (
          <section className="flex flex-col gap-4 border-t border-border-subtle pt-5">
            <SectionHeading>Diagnostics</SectionHeading>
            <p className="text-[13px] text-text-muted">
              Sends one request through the stored credentials and reports what the provider answered.
            </p>
            <div className="flex items-center gap-2.5">
              <Button onClick={handleTest} variant="secondary" disabled={testing} loading={testing}>
                {testing ? "Testing…" : "Test connection"}
              </Button>
              {testResult === "success" && (
                <Badge variant="success" dot>
                  Working
                </Badge>
              )}
              {testResult === "failed" && (
                <Badge variant="error" dot>
                  Failed
                </Badge>
              )}
            </div>
            {testResult === "failed" && (
              <div className="flex items-start gap-2.5 rounded-[10px] border border-danger/20 bg-danger/10 p-3">
                <Icon name="error" className="mt-0.5 text-[18px] text-danger shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-text-main">The test request did not succeed</p>
                  <p className="mt-1 text-text-muted">
                    The provider refused the stored credentials or was unreachable. Verify the key and the
                    region, then test again.
                  </p>
                </div>
              </div>
            )}
          </section>
        )}

        <div className="flex gap-2 border-t border-border-subtle pt-5">
          <Button onClick={onClose} variant="ghost" fullWidth>
            Cancel
          </Button>
          <Button onClick={handleSubmit} fullWidth disabled={saving} loading={saving}>
            Save connection
          </Button>
        </div>
      </div>
    </Modal>
  );
}

EditConnectionModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  connection: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    email: PropTypes.string,
    priority: PropTypes.number,
    authType: PropTypes.string,
    provider: PropTypes.string,
    providerSpecificData: PropTypes.object,
  }),
  proxyPools: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
  })),
  onSave: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
