"use client";

import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Modal, Button, Input } from "@/shared/components";

import { Icon } from "@/shared/components/Icon";
const METHODS = [
  {
    id: "builder-id",
    icon: "shield",
    title: "AWS Builder ID",
    description: "Device-code login. Recommended for most users; a free AWS account is enough.",
  },
  {
    id: "idc",
    icon: "business",
    title: "AWS IAM Identity Center",
    description: "For organizations that run their own AWS Identity Center start URL.",
  },
  {
    id: "api-key",
    icon: "key",
    title: "API key",
    description: "Headless: paste a long-lived Kiro/CodeWhisperer key and a region.",
  },
  {
    id: "import",
    icon: "file_upload",
    title: "Import refresh token",
    description: "Read the token from the local Kiro IDE cache, or paste it by hand.",
  },
  {
    id: "import-cli-proxy",
    icon: "data_object",
    title: "Import CLIProxyAPI JSON",
    description: "Paste an external_idp auth JSON produced by CLIProxyAPI or Kiro's Microsoft login.",
  },
];

/**
 * Kiro Auth Method Selection Modal
 * Auto-detects token from AWS SSO cache or allows manual import
 */
export default function KiroAuthModal({ isOpen, onMethodSelect, onClose }) {
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [idcStartUrl, setIdcStartUrl] = useState("");
  const [idcRegion, setIdcRegion] = useState("us-east-1");
  const [refreshToken, setRefreshToken] = useState("");
  const [cliProxyJson, setCliProxyJson] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyRegion, setApiKeyRegion] = useState("us-east-1");
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [autoDetecting, setAutoDetecting] = useState(false);
  const [autoDetected, setAutoDetected] = useState(false);
  const [detectError, setDetectError] = useState(null);
  const [idcCredentials, setIdcCredentials] = useState(null);

  // Auto-detect token when import method is selected
  useEffect(() => {
    if (selectedMethod !== "import" || !isOpen) return;

    const autoDetect = async () => {
      setAutoDetecting(true);
      setError(null);
      setDetectError(null);
      setAutoDetected(false);
      setIdcCredentials(null);

      try {
        const res = await fetch("/api/oauth/kiro/auto-import");
        const data = await res.json();

        if (data.found) {
          setRefreshToken(data.refreshToken);
          setAutoDetected(true);
          // Store IDC/organization credentials if present
          if (data.clientId && data.clientSecret) {
            setIdcCredentials({
              clientId: data.clientId,
              clientSecret: data.clientSecret,
              region: data.region,
              authMethod: data.authMethod,
              profileArn: data.profileArn,
            });
          }
        } else {
          setDetectError(data.error || "Could not auto-detect token");
        }
      } catch (err) {
        setDetectError("Failed to auto-detect token");
      } finally {
        setAutoDetecting(false);
      }
    };

    autoDetect();
  }, [selectedMethod, isOpen]);

  const handleMethodSelect = (method) => {
    setSelectedMethod(method);
    setError(null);
  };

  const handleBack = () => {
    setSelectedMethod(null);
    setError(null);
  };

  const handleImportToken = async () => {
    if (!refreshToken.trim()) {
      setError("No refresh token. Open the Kiro IDE once so the cache exists, or paste a token below.");
      return;
    }

    setImporting(true);
    setError(null);

    try {
      const res = await fetch("/api/oauth/kiro/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refreshToken: refreshToken.trim(),
          ...(idcCredentials || {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Import failed (HTTP ${res.status}).`);
      }

      // Success - notify parent to refresh connections
      onMethodSelect("import");
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleImportCliProxyJson = async () => {
    if (!cliProxyJson.trim()) {
      setError("No JSON pasted. Paste the CLIProxyAPI auth object containing auth_method=external_idp.");
      return;
    }

    setImporting(true);
    setError(null);

    try {
      const res = await fetch("/api/oauth/kiro/import-cli-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: cliProxyJson.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `CLIProxyAPI import failed (HTTP ${res.status}).`);
      }

      onMethodSelect("import-cli-proxy");
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleIdcContinue = () => {
    if (!idcStartUrl.trim()) {
      setError("No start URL. Copy it from your AWS IAM Identity Center access portal settings.");
      return;
    }
    onMethodSelect("idc", { startUrl: idcStartUrl.trim(), region: idcRegion });
  };

  const handleApiKeyImport = async () => {
    if (!apiKey.trim()) {
      setError("No API key. Paste a long-lived Kiro/CodeWhisperer key, or pick another method.");
      return;
    }

    setImporting(true);
    setError(null);

    try {
      const res = await fetch("/api/oauth/kiro/api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          region: apiKeyRegion.trim() || "us-east-1",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Import failed (HTTP ${res.status}).`);
      }

      // Success - notify parent to refresh connections
      onMethodSelect("api-key");
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleSocialLogin = (provider) => {
    onMethodSelect("social", { provider });
  };

  const errorBlock = (title) =>
    error && (
      <div className="flex items-start gap-2.5 rounded-[10px] border border-danger/20 bg-danger/10 p-3">
        <Icon name="error" className="mt-0.5 text-[18px] text-danger shrink-0" />
        <div className="text-sm">
          <p className="font-medium text-text-main">{title}</p>
          <p className="mt-1 text-text-muted">{error}</p>
        </div>
      </div>
    );

  return (
    <Modal isOpen={isOpen} title="Connect Kiro" onClose={onClose} size="lg">
      <div className="flex flex-col gap-4">
        {/* Method Selection */}
        {!selectedMethod && (
          <div className="flex flex-col gap-2">
            <p className="text-[13px] text-text-muted">
              Pick how this account authenticates. Device-code and API-key methods list Kiro models right
              after the connection is saved.
            </p>

            {METHODS.map((method) => (
              <button
                key={method.id}
                type="button"
                onClick={() => handleMethodSelect(method.id)}
                className="flex w-full items-start gap-3 rounded-md border border-border bg-surface px-3.5 py-3 text-left transition-colors duration-150 hover:border-primary/40 hover:bg-surface-2"
              >
                <Icon name={method.icon} weight="duotone" className="mt-0.5 text-[20px] text-primary shrink-0" />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-text-main">{method.title}</span>
                  <span className="text-[13px] leading-relaxed text-text-muted">{method.description}</span>
                </span>
              </button>
            ))}

            {/* Google Social Login - HIDDEN */}
            <button onClick={() => handleMethodSelect("social-google")} className="hidden">
              Google account
            </button>

            {/* GitHub Social Login - HIDDEN */}
            <button onClick={() => handleMethodSelect("social-github")} className="hidden">
              GitHub account
            </button>
          </div>
        )}

        {/* IDC Configuration */}
        {selectedMethod === "idc" && (
          <div className="flex flex-col gap-4">
            <p className="text-[13px] text-text-muted">
              The device-code flow needs your Identity Center start URL, not your account ID.
            </p>

            <Input
              label="IDC start URL"
              required
              value={idcStartUrl}
              onChange={(e) => setIdcStartUrl(e.target.value)}
              placeholder="https://your-org.awsapps.com/start"
              inputClassName="font-mono text-[13px]"
              hint="The access portal URL of your AWS IAM Identity Center."
            />

            <Input
              label="AWS region"
              value={idcRegion}
              onChange={(e) => setIdcRegion(e.target.value)}
              placeholder="us-east-1"
              inputClassName="font-mono text-[13px]"
              hint="Region that hosts your Identity Center. Default us-east-1."
            />

            {errorBlock("Start URL required")}

            <div className="flex gap-2">
              <Button onClick={handleIdcContinue} fullWidth>
                Continue
              </Button>
              <Button onClick={handleBack} variant="ghost" fullWidth>
                Back
              </Button>
            </div>
          </div>
        )}

        {/* API Key */}
        {selectedMethod === "api-key" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-2.5 rounded-[10px] border border-border bg-surface-2 p-3">
              <Icon name="info" className="mt-0.5 text-[18px] text-text-muted shrink-0" />
              <p className="text-sm text-text-muted">
                The key is validated against AWS and stored as a bearer credential — there is no refresh, so
                a revoked key has to be replaced here.
              </p>
            </div>

            <Input
              label="API key"
              required
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your Kiro API key"
              type="password"
              inputClassName="font-mono text-[13px]"
            />

            <Input
              label="AWS region"
              value={apiKeyRegion}
              onChange={(e) => setApiKeyRegion(e.target.value)}
              placeholder="us-east-1"
              inputClassName="font-mono text-[13px]"
              hint="Region the key was issued for. Default us-east-1."
            />

            {errorBlock("The API key was rejected")}

            <div className="flex gap-2">
              <Button onClick={handleApiKeyImport} fullWidth disabled={importing || !apiKey.trim()} loading={importing}>
                Add API key
              </Button>
              <Button onClick={handleBack} variant="ghost" fullWidth>
                Back
              </Button>
            </div>
          </div>
        )}

        {/* Social Login Info (Google) */}
        {selectedMethod === "social-google" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-2.5 rounded-[10px] border border-warning/20 bg-warning/10 p-3">
              <Icon name="warning" weight="fill" className="mt-0.5 text-[18px] text-warning shrink-0" />
              <p className="text-sm text-text-muted">
                Google sign-in returns its code on a callback URL. After the login you copy that URL out of
                the address bar and paste it back into the next screen.
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => handleSocialLogin("google")} fullWidth>
                Continue with Google
              </Button>
              <Button onClick={handleBack} variant="ghost" fullWidth>
                Back
              </Button>
            </div>
          </div>
        )}

        {/* Social Login Info (GitHub) */}
        {selectedMethod === "social-github" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-2.5 rounded-[10px] border border-warning/20 bg-warning/10 p-3">
              <Icon name="warning" weight="fill" className="mt-0.5 text-[18px] text-warning shrink-0" />
              <p className="text-sm text-text-muted">
                GitHub sign-in returns its code on a callback URL. After the login you copy that URL out of
                the address bar and paste it back into the next screen.
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => handleSocialLogin("github")} fullWidth>
                Continue with GitHub
              </Button>
              <Button onClick={handleBack} variant="ghost" fullWidth>
                Back
              </Button>
            </div>
          </div>
        )}

        {/* Import Token */}
        {selectedMethod === "import" && (
          <div className="flex flex-col gap-4">
            {autoDetecting && (
              <div className="flex items-center gap-2.5 py-4 text-sm text-text-muted">
                <Icon name="progress_activity" className="animate-spin text-[18px] text-primary" />
                Reading the refresh token from the local AWS SSO cache…
              </div>
            )}

            {!autoDetecting && (
              <>
                {autoDetected && (
                  <div className="flex items-start gap-2.5 rounded-[10px] border border-success/20 bg-success/10 p-3">
                    <Icon name="check_circle" weight="fill" className="mt-0.5 text-[18px] text-success shrink-0" />
                    <p className="text-sm text-text-main">
                      Refresh token found in the local Kiro IDE cache. Import to store it.
                    </p>
                  </div>
                )}

                {!autoDetected && (detectError ? (
                  <div className="flex items-start gap-2.5 rounded-[10px] border border-warning/20 bg-warning/10 p-3">
                    <Icon name="warning" weight="fill" className="mt-0.5 text-[18px] text-warning shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-text-main">No cached refresh token found</p>
                      <p className="mt-1 text-text-muted">{detectError}</p>
                      <p className="mt-1 text-text-muted">
                        Open the Kiro IDE once, go Back and pick this method again — or paste a token below.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2.5 rounded-[10px] border border-border bg-surface-2 p-3">
                    <Icon name="info" className="mt-0.5 text-[18px] text-text-muted shrink-0" />
                    <p className="text-sm text-text-muted">
                      No Kiro IDE cache was found. Paste a refresh token manually, or go Back and pick this
                      method again after opening the IDE once.
                    </p>
                  </div>
                ))}

                <Input
                  label="Refresh token"
                  required
                  value={refreshToken}
                  onChange={(e) => setRefreshToken(e.target.value)}
                  placeholder="Token will be auto-filled when detected"
                  type="password"
                  inputClassName="font-mono text-[13px]"
                />

                {errorBlock("The import failed")}

                <div className="flex gap-2">
                  <Button
                    onClick={handleImportToken}
                    fullWidth
                    disabled={importing || !refreshToken.trim()}
                    loading={importing}
                  >
                    Import token
                  </Button>
                  <Button onClick={handleBack} variant="ghost" fullWidth>
                    Back
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Import CLIProxyAPI JSON */}
        {selectedMethod === "import-cli-proxy" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-2.5 rounded-[10px] border border-border bg-surface-2 p-3">
              <Icon name="info" className="mt-0.5 text-[18px] text-text-muted shrink-0" />
              <p className="text-sm text-text-muted">
                Paste the Kiro auth JSON whose <span className="font-mono text-xs">auth_method</span> is{" "}
                <span className="font-mono text-xs">external_idp</span>. Only Microsoft login token endpoints
                are accepted.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="kiro-cli-proxy-json" className="text-sm font-medium text-text-main">
                CLIProxyAPI auth JSON
                <span className="ml-1 text-danger">*</span>
              </label>
              <textarea
                id="kiro-cli-proxy-json"
                value={cliProxyJson}
                onChange={(e) => setCliProxyJson(e.target.value)}
                placeholder={'{"auth_method":"external_idp","access_token":"...","refresh_token":"...","client_id":"...","token_endpoint":"https://login.microsoftonline.com/.../oauth2/v2.0/token","profile_arn":"...","scopes":"..."}'}
                className="min-h-40 w-full resize-y rounded-md border border-border bg-surface-2 p-3 font-mono text-xs text-text-main placeholder:text-text-subtle focus:outline-none focus:border-primary"
              />
            </div>

            {errorBlock("The JSON was rejected")}

            <div className="flex gap-2">
              <Button
                onClick={handleImportCliProxyJson}
                fullWidth
                disabled={importing || !cliProxyJson.trim()}
                loading={importing}
              >
                Import CLIProxyAPI JSON
              </Button>
              <Button onClick={handleBack} variant="ghost" fullWidth>
                Back
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

KiroAuthModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onMethodSelect: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
