"use client";

import { useState } from "react";
import PropTypes from "prop-types";
import { Modal, Button, Input, OAuthModal } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";

import { Icon } from "@/shared/components/Icon";
const GITLAB_COM = "https://gitlab.com";

function getRedirectUri() {
  if (typeof window === "undefined") return "http://localhost/callback";
  const port = window.location.port || (window.location.protocol === "https:" ? "443" : "80");
  return `http://localhost:${port}/callback`;
}

/**
 * GitLab Duo Authentication Modal
 * Supports two modes:
 * - OAuth (PKCE): requires OAuth App Client ID (and optional Client Secret)
 * - PAT: requires Personal Access Token
 */
export default function GitLabAuthModal({ isOpen, providerInfo, onSuccess, onClose }) {
  const [mode, setMode] = useState(null); // null | "oauth" | "pat"
  const [baseUrl, setBaseUrl] = useState(GITLAB_COM);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [pat, setPat] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showOAuth, setShowOAuth] = useState(false);
  const [oauthMeta, setOauthMeta] = useState(null);
  const { copied, copy } = useCopyToClipboard();

  const reset = () => {
    setMode(null);
    setBaseUrl(GITLAB_COM);
    setClientId("");
    setClientSecret("");
    setPat("");
    setError(null);
    setLoading(false);
    setShowOAuth(false);
    setOauthMeta(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleOAuthStart = () => {
    if (!clientId.trim()) {
      setError("Client ID is required. Create a GitLab OAuth application and paste its client ID.");
      return;
    }
    setError(null);
    setOauthMeta({ baseUrl: baseUrl.trim() || GITLAB_COM, clientId: clientId.trim(), clientSecret: clientSecret.trim() });
    setShowOAuth(true);
  };

  const handlePATSubmit = async () => {
    if (!pat.trim()) {
      setError("Personal Access Token is required. Create one with the api, read_user and ai_features scopes.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/oauth/gitlab/pat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: pat.trim(), baseUrl: baseUrl.trim() || GITLAB_COM }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Authentication failed (HTTP ${res.status}).`);
      onSuccess?.();
      handleClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Sub-modal for OAuth PKCE flow
  if (showOAuth && oauthMeta) {
    return (
      <OAuthModal
        isOpen
        provider="gitlab"
        providerInfo={providerInfo}
        oauthMeta={oauthMeta}
        onSuccess={() => { onSuccess?.(); handleClose(); }}
        onClose={() => { setShowOAuth(false); setOauthMeta(null); }}
      />
    );
  }

  const redirectUri = getRedirectUri();
  const host = baseUrl.trim() || GITLAB_COM;

  return (
    <Modal isOpen={isOpen} title="Connect GitLab Duo" onClose={handleClose} size="lg">
      <div className="flex flex-col gap-4">
        {!mode && (
          <>
            <p className="text-[13px] text-text-muted">
              GitLab Duo accepts either a PKCE OAuth application or a personal access token. OAuth keeps a
              rotating token; a PAT is quicker to set up.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setMode("oauth")}
                className="flex flex-col items-start gap-2 rounded-[10px] border border-border bg-surface p-4 text-left transition-colors duration-150 hover:border-primary hover:bg-primary/10"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-text-main">
                  <Icon name="lock_open" className="text-[18px] text-primary" />
                  OAuth application
                </span>
                <span className="text-[13px] text-text-muted">
                  Register an app once; the callback URL is filled in for you.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMode("pat")}
                className="flex flex-col items-start gap-2 rounded-[10px] border border-border bg-surface p-4 text-left transition-colors duration-150 hover:border-primary hover:bg-primary/10"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-text-main">
                  <Icon name="key" className="text-[18px] text-primary" />
                  Personal access token
                </span>
                <span className="text-[13px] text-text-muted">
                  Paste a token with the api, read_user and ai_features scopes.
                </span>
              </button>
            </div>
          </>
        )}

        {mode === "oauth" && (
          <>
            <div className="rounded-[10px] border border-border bg-surface-2 p-3.5">
              <p className="text-[13px] text-text-muted">
                In GitLab, open <span className="text-text-main">Preferences → Applications</span> and create
                an application with scope <span className="font-mono text-xs text-text-main">api</span>.
              </p>
              <div className="mt-2.5 flex flex-col gap-1.5">
                <span className="text-xs text-text-muted">Redirect URI</span>
                <div className="flex items-stretch gap-2">
                  <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-md border border-border bg-surface px-2.5 py-1.5 font-mono text-xs text-text-main">
                    {redirectUri}
                  </code>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={copied === "redirect_uri" ? "check" : "content_copy"}
                    onClick={() => copy(redirectUri, "redirect_uri")}
                    aria-label="Copy redirect URI"
                  />
                </div>
              </div>
              <a
                href={`${host}/-/profile/applications`}
                target="_blank"
                rel="noreferrer"
                className="mt-2.5 inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:text-primary-hover"
              >
                Open GitLab applications
                <Icon name="open_in_new" className="text-[14px]" />
              </a>
            </div>

            <Input
              label="GitLab Base URL"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={GITLAB_COM}
              inputClassName="font-mono text-[13px]"
            />
            <Input
              label="Client ID"
              required
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Client ID of your OAuth application"
              inputClassName="font-mono text-[13px]"
            />
            <Input
              label="Client secret"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="Leave empty for a public PKCE app"
              type="password"
              hint="Optional: PKCE apps don't need a secret."
            />

            {error && (
              <div className="flex items-start gap-2.5 rounded-[10px] border border-danger/20 bg-danger/10 p-3">
                <Icon name="error" className="mt-0.5 text-[18px] text-danger shrink-0" />
                <p className="text-sm text-text-muted">{error}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleOAuthStart} fullWidth disabled={!clientId.trim()}>
                Authorize
              </Button>
              <Button onClick={() => { setMode(null); setError(null); }} variant="ghost" fullWidth>
                Back
              </Button>
            </div>
          </>
        )}

        {mode === "pat" && (
          <>
            <div className="rounded-[10px] border border-border bg-surface-2 p-3.5">
              <p className="text-[13px] text-text-muted">
                Create a token with the scopes{" "}
                <span className="font-mono text-xs text-text-main">api</span>,{" "}
                <span className="font-mono text-xs text-text-main">read_user</span> and{" "}
                <span className="font-mono text-xs text-text-main">ai_features</span>.
              </p>
              <a
                href={`${host}/-/user_settings/personal_access_tokens`}
                target="_blank"
                rel="noreferrer"
                className="mt-2.5 inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:text-primary-hover"
              >
                Open GitLab access tokens
                <Icon name="open_in_new" className="text-[14px]" />
              </a>
            </div>

            <Input
              label="GitLab Base URL"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={GITLAB_COM}
              inputClassName="font-mono text-[13px]"
            />
            <Input
              label="Personal access token"
              required
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
              type="password"
              inputClassName="font-mono text-[13px]"
            />

            {error && (
              <div className="flex items-start gap-2.5 rounded-[10px] border border-danger/20 bg-danger/10 p-3">
                <Icon name="error" className="mt-0.5 text-[18px] text-danger shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-text-main">GitLab rejected the token</p>
                  <p className="mt-1 text-text-muted">{error}</p>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handlePATSubmit} fullWidth disabled={!pat.trim() || loading} loading={loading}>
                Connect
              </Button>
              <Button onClick={() => { setMode(null); setError(null); }} variant="ghost" fullWidth>
                Back
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

GitLabAuthModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  providerInfo: PropTypes.shape({ name: PropTypes.string }),
  onSuccess: PropTypes.func,
  onClose: PropTypes.func.isRequired,
};
