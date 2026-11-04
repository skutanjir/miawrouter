"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import PropTypes from "prop-types";
import { Modal, Button, Input, SegmentedControl } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";

import { Icon } from "@/shared/components/Icon";
// Providers using the dynamic-port local callback proxy.
// Browser OAuth: popup → auto callback → auto exchange → poll-status.
const PROXY_OAUTH_PROVIDERS = new Set(["trae", "windsurf", "zed"]);

// Providers offering a paste-token fallback (import-token flow).
// UX warns if the IDE (which issues the token) is not installed.
const PASTE_TOKEN_PROVIDERS = {
  trae: {
    label: "Cloud-IDE-JWT",
    instructions:
      "Sign in at trae.ai (or solo.trae.ai), open DevTools → Network, copy the Cloud-IDE-JWT token from any request's Authorization header (~14-day lifetime).",
    placeholder: "Paste Cloud-IDE-JWT here...",
    ideName: "Trae",
    ideOptional: true, // token can be grabbed from DevTools without the IDE
  },
  windsurf: {
    label: "Windsurf API key",
    instructions:
      "In the Windsurf/VS Code IDE, run the \"Windsurf: Provide Auth Token\" command, then copy the displayed sk-ws-... key.",
    placeholder: "Paste sk-ws-... key here...",
    ideName: "Windsurf",
    ideOptional: false,
  },
};

/**
 * OAuth Modal Component
 * - Localhost: Auto callback via popup message
 * - Remote: Manual paste callback URL
 */
export default function OAuthModal({ isOpen, provider, providerInfo, onSuccess, onClose, oauthMeta, idcConfig }) {
  const [step, setStep] = useState("waiting"); // select_mode | waiting | input | success | error
  const [authData, setAuthData] = useState(null);
  const [callbackUrl, setCallbackUrl] = useState("");
  const [error, setError] = useState(null);
  const [isDeviceCode, setIsDeviceCode] = useState(false);
  const [deviceData, setDeviceData] = useState(null);
  const [polling, setPolling] = useState(false);
  // trae/windsurf: choose between browser OAuth (proxy) and paste-token (import)
  const [authMode, setAuthMode] = useState("browser"); // "browser" | "paste-token"
  const [pasteToken, setPasteToken] = useState("");
  const [ideStatus, setIdeStatus] = useState(null);
  const popupRef = useRef(null);
  const pollingAbortRef = useRef(false);
  const openedRef = useRef(false);
  const { copied, copy } = useCopyToClipboard();

  // State for client-only values to avoid hydration mismatch
  const [isLocalhost, setIsLocalhost] = useState(false);
  const [placeholderUrl, setPlaceholderUrl] = useState("/callback?code=...");
  const callbackProcessedRef = useRef(false);

  const notifyParent = useCallback((result) => {
    const connectionId = result?.connection?.id || result?.connectionId;
    if (connectionId) {
      const message = { type: "miawrouter_oauth_success", provider, connectionId };
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(message, "*");
      }
      if (window.parent !== window) {
        window.parent.postMessage(message, "*");
      }
    }
    onSuccess?.(result);
  }, [onSuccess, provider]);

  // Detect if running on localhost (client-side only)
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsLocalhost(
        window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      );
      setPlaceholderUrl(`${window.location.origin}/callback?code=...`);
    }
  }, []);

  // Define all useCallback hooks BEFORE the useEffects that reference them

  // Exchange tokens
  const exchangeTokens = useCallback(async (code, state) => {
    if (!authData) return;
    try {
      const res = await fetch(`/api/oauth/${provider}/exchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          redirectUri: authData.redirectUri,
          codeVerifier: authData.codeVerifier,
          state,
          ...(oauthMeta ? { meta: oauthMeta } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setStep("success");
      notifyParent(data);
    } catch (err) {
      setError(err.message);
      setStep("error");
    }
  }, [authData, provider, notifyParent, oauthMeta]);

  const completeXaiManualCode = useCallback(async (code) => {
    if (!authData?.state) return;
    try {
      const res = await fetch("/api/oauth/xai/manual-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, state: authData.state }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setStep("success");
      notifyParent(data);
    } catch (err) {
      setError(err.message);
      setStep("error");
    }
  }, [authData, notifyParent]);

  // Poll for device code token
  const startPolling = useCallback(async (deviceCode, codeVerifier, interval, extraData, deadlineMs) => {
    pollingAbortRef.current = false;
    setPolling(true);
    // Honor the upstream's expires_in when supplied (qoder sets 300s) so we
    // don't time out earlier than the device code itself. Default 120s
    // matches the prior behavior for providers that don't surface a value.
    const startedAt = Date.now();
    const deadline = startedAt + (Number.isFinite(deadlineMs) && deadlineMs > 0 ? deadlineMs : 120_000);

    while (Date.now() < deadline) {
      // Check if polling should be aborted
      if (pollingAbortRef.current) {
        console.log("[OAuthModal] Polling aborted");
        setPolling(false);
        return;
      }

      await new Promise((r) => setTimeout(r, interval * 1000));

      // Check again after sleep
      if (pollingAbortRef.current) {
        console.log("[OAuthModal] Polling aborted after sleep");
        setPolling(false);
        return;
      }

      try {
        const res = await fetch(`/api/oauth/${provider}/poll`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceCode, codeVerifier, extraData }),
        });

        const data = await res.json();

        if (data.success) {
          pollingAbortRef.current = true; // Stop polling immediately
          setStep("success");
          setPolling(false);
          notifyParent(data);
          return;
        }

        if (data.error === "expired_token" || data.error === "access_denied") {
          throw new Error(data.errorDescription || data.error);
        }

        if (data.error === "slow_down") {
          interval = Math.min(interval + 5, 30);
        }
      } catch (err) {
        setError(err.message);
        setStep("error");
        setPolling(false);
        return;
      }
    }

    setError("Authorization timeout");
    setStep("error");
    setPolling(false);
  }, [provider, notifyParent]);

  // Trae/Windsurf proxy OAuth flow: dynamic-port local callback → auto exchange.
  const startProxyFlow = useCallback(async (providerId) => {
    // 1. Start the local callback server (returns a dynamic port + callback URL).
    const startRes = await fetch(`/api/oauth/${providerId}/start-proxy`);
    const startData = await startRes.json();
    if (!startRes.ok || !startData.success || !startData.callbackUrl) {
      throw new Error(startData.reason || startData.error || `Failed to start ${providerId} callback server`);
    }
    // 2. Build the authorize URL with redirect_uri = proxy callback URL.
    const authorizeUrl = new URL(`/api/oauth/${providerId}/authorize`, window.location.origin);
    authorizeUrl.searchParams.set("redirect_uri", startData.callbackUrl);
    const authRes = await fetch(authorizeUrl);
    const authData = await authRes.json();
    if (!authRes.ok) throw new Error(authData.error);
    // 3. Register the session so the proxy can match the incoming callback.
    //    Zed also passes code_verifier (encodes the RSA private key for decrypt);
    //    sent via POST body so the private key never lands in URL/query logs.
    const regBody = { state: authData.state };
    if (authData.codeVerifier) regBody.codeVerifier = authData.codeVerifier;
    await fetch(`/api/oauth/${providerId}/register-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(regBody),
    });
    // 4. Open popup; proxy auto-exchanges on callback, modal polls poll-status.
    setAuthData({ ...authData, proxyProvider: providerId });
    setStep("waiting");
    popupRef.current = window.open(authData.authUrl, "oauth_popup", "width=600,height=700");
    if (!popupRef.current) setStep("input"); // popup blocked → fall back to manual paste
  }, []);

  // Start OAuth flow
  const startOAuthFlow = useCallback(async () => {
    if (!provider) return;
    try {
      setError(null);

      // Trae/Windsurf: proxy OAuth (browser mode) — handled by dedicated flow.
      // Paste-token mode is handled by handleManualSubmit (no /authorize call).
      if (PROXY_OAUTH_PROVIDERS.has(provider) && authMode === "browser") {
        await startProxyFlow(provider);
        return;
      }

      // Device code flow providers (must match oauth providers with flowType: "device_code")
      const deviceCodeProviders = [
        "github",
        "kiro",
        "kimi",
        "kimi-coding",
        "kilocode",
        "codebuddy-cn",
        "codebuddy-intl",
        "qoder",
        "grok-cli",
      ];
      if (deviceCodeProviders.includes(provider)) {
        setIsDeviceCode(true);
        setStep("waiting");

        const deviceCodeUrl = new URL(`/api/oauth/${provider}/device-code`, window.location.origin);
        if (provider === "kiro" && idcConfig?.startUrl) {
          deviceCodeUrl.searchParams.set("start_url", idcConfig.startUrl);
          if (idcConfig.region) {
            deviceCodeUrl.searchParams.set("region", idcConfig.region);
          }
          deviceCodeUrl.searchParams.set("auth_method", "idc");
        }
        const res = await fetch(deviceCodeUrl.toString());
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        setDeviceData(data);

        // Auto-open verification URL in new tab
        const verifyUrl = data.verification_uri_complete || data.verification_uri;
        if (verifyUrl) window.open(verifyUrl, "_blank", "noopener,noreferrer");

        // Pass extraData for Kiro (contains _clientId, _clientSecret) and
        // Qoder (contains _qoderMachineId / _qoderNonce — needed so mapTokens
        // can persist the machine id alongside the token).
        const extraData = provider === "kiro"
          ? {
              _clientId: data._clientId,
              _clientSecret: data._clientSecret,
              _region: data._region,
              _authMethod: data._authMethod,
              _startUrl: data._startUrl,
            }
          : provider === "qoder"
          ? {
              _qoderNonce: data._qoderNonce,
              _qoderMachineId: data._qoderMachineId,
              _qoderVerifier: data.codeVerifier,
            }
          : (provider === "kimi" || provider === "kimi-coding")
          ? { _kimiDeviceId: data._kimiDeviceId }
          : null;
        startPolling(
          data.device_code,
          data.codeVerifier,
          data.interval || 5,
          extraData,
          // Use the upstream's expires_in if present so we don't time out
          // before the device code itself (qoder gives 300s).
          Number.isFinite(data.expires_in) && data.expires_in > 0
            ? data.expires_in * 1000
            : undefined,
        );
        return;
      }

      // Authorization code flow - build redirect URI (some providers require fixed ports)
      const appPort = window.location.port || (window.location.protocol === "https:" ? "443" : "80");
      let redirectUri;
      if (provider === "codex") {
        redirectUri = "http://localhost:1455/auth/callback";
      } else if (provider === "xai") {
        redirectUri = "http://127.0.0.1:56121/callback";
      } else {
        redirectUri = `http://localhost:${appPort}/callback`;
      }

      // Build authorize URL first to get codeVerifier/state for codex server-side mode
      const authorizeUrl = new URL(`/api/oauth/${provider}/authorize`, window.location.origin);
      authorizeUrl.searchParams.set("redirect_uri", redirectUri);
      if (oauthMeta) {
        Object.entries(oauthMeta).forEach(([k, v]) => { if (v) authorizeUrl.searchParams.set(k, v); });
      }
      const res = await fetch(authorizeUrl.toString());
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Codex: start proxy with server-side session (auto-exchange) + fallback to channels
      let codexProxyActive = false;
      let codexServerSide = false;
      if (provider === "codex") {
        try {
          const proxyUrl = new URL(`/api/oauth/codex/start-proxy`, window.location.origin);
          proxyUrl.searchParams.set("app_port", appPort);
          proxyUrl.searchParams.set("state", data.state);
          proxyUrl.searchParams.set("code_verifier", data.codeVerifier);
          proxyUrl.searchParams.set("redirect_uri", redirectUri);
          const proxyRes = await fetch(proxyUrl.toString());
          const proxyData = await proxyRes.json();
          codexProxyActive = proxyData.success;
          codexServerSide = !!proxyData.serverSide;
        } catch {
          codexProxyActive = false;
        }
      }

      // xAI: same fixed-port server-side proxy pattern as codex (port 56121)
      let xaiProxyActive = false;
      let xaiServerSide = false;
      if (provider === "xai") {
        try {
          const proxyUrl = new URL(`/api/oauth/xai/start-proxy`, window.location.origin);
          proxyUrl.searchParams.set("app_port", appPort);
          proxyUrl.searchParams.set("state", data.state);
          proxyUrl.searchParams.set("code_verifier", data.codeVerifier);
          proxyUrl.searchParams.set("redirect_uri", redirectUri);
          const proxyRes = await fetch(proxyUrl.toString());
          const proxyData = await proxyRes.json();
          xaiProxyActive = proxyData.success;
          xaiServerSide = !!proxyData.serverSide;
          if (!xaiProxyActive && proxyData.reason === "port_busy") {
            throw new Error("Port 56121 in use; close the conflicting process and retry");
          }
        } catch (e) {
          if (e?.message) throw e;
          xaiProxyActive = false;
        }
      }

      setAuthData({ ...data, redirectUri, codexServerSide, xaiServerSide });

      // Guard: device_code providers return authUrl:null from /authorize. Never window.open(null)
      // (browsers coerce it to the relative path ".../null").
      if (!data.authUrl) {
        if (data.flowType === "device_code") {
          throw new Error(
            `Provider ${provider} uses device-code login but is not wired in the OAuth modal device-code list`
          );
        }
        throw new Error("No authorization URL returned from OAuth provider");
      }

      if (provider === "codex" && codexProxyActive) {
        // Proxy active: callback will be handled server-side (auto-exchange) or via channels (fallback)
        setStep("waiting");
        popupRef.current = window.open(data.authUrl, "oauth_popup", "width=600,height=700");
        if (!popupRef.current) {
          setStep("input");
        }
      } else if (provider === "xai" && xaiProxyActive) {
        setStep("waiting");
        popupRef.current = window.open(data.authUrl, "oauth_popup", "width=600,height=700");
        if (!popupRef.current) {
          setStep("input");
        }
      } else if (!isLocalhost || provider === "codex" || provider === "xai") {
        // Non-localhost or proxy failed: manual input mode
        setStep("input");
        window.open(data.authUrl, "_blank");
      } else {
        // Localhost (non-Codex/xAI): Open popup and wait for message
        setStep("waiting");
        popupRef.current = window.open(data.authUrl, "oauth_popup", "width=600,height=700");
        if (!popupRef.current) {
          setStep("input");
        }
      }
    } catch (err) {
      setError(err.message);
      setStep("error");
    }
  }, [provider, isLocalhost, startPolling, oauthMeta, idcConfig, authMode, startProxyFlow]);

  // Reset state and start OAuth when modal opens
  useEffect(() => {
    if (isOpen && provider) {
      // Guard against StrictMode/effect re-runs auto-opening multiple tabs.
      if (openedRef.current) return;
      openedRef.current = true;
      setAuthData(null);
      setCallbackUrl("");
      setError(null);
      setIsDeviceCode(false);
      setDeviceData(null);
      setPolling(false);
      setAuthMode("browser");
      setPasteToken("");
      setIdeStatus(null);
      pollingAbortRef.current = false;
      // Best-effort IDE detection for paste-token providers (Trae/Windsurf)
      if (PASTE_TOKEN_PROVIDERS[provider]) {
        fetch(`/api/oauth/${provider}/ide-status`)
          .then((r) => r.json())
          .then((data) => setIdeStatus(data))
          .catch(() => setIdeStatus({ installed: false, path: null }));
      }
      setStep("waiting");
      startOAuthFlow();
    } else if (!isOpen) {
      // Abort polling and cleanup proxy when modal closes
      pollingAbortRef.current = true;
      openedRef.current = false;
      if (provider === "codex") {
        fetch("/api/oauth/codex/stop-proxy").catch(() => {});
      } else if (provider === "xai") {
        fetch("/api/oauth/xai/stop-proxy").catch(() => {});
      } else if (provider === "trae") {
        fetch("/api/oauth/trae/stop-proxy").catch(() => {});
      } else if (provider === "windsurf") {
        fetch("/api/oauth/windsurf/stop-proxy").catch(() => {});
      } else if (provider === "zed") {
        fetch("/api/oauth/zed/stop-proxy").catch(() => {});
      }
    }
  }, [isOpen, provider, startOAuthFlow]);

  // Server-side proxy mode (codex/xai fixed-port + trae/windsurf dynamic-port):
  // poll status until the proxy auto-exchanges and saves the connection.
  useEffect(() => {
    const pollProvider = authData?.codexServerSide
      ? "codex"
      : authData?.xaiServerSide
        ? "xai"
        : authData?.proxyProvider
          ? authData.proxyProvider
          : null;
    if (!pollProvider || !authData?.state) return;
    if (callbackProcessedRef.current) return;
    let cancelled = false;
    const POLL_INTERVAL_MS = 1500;
    const MAX_ATTEMPTS = 200; // ~5 minutes
    let attempts = 0;

    const tick = async () => {
      if (cancelled || callbackProcessedRef.current) return;
      attempts += 1;
      try {
          const res = await fetch(`/api/oauth/${pollProvider}/poll-status?state=${encodeURIComponent(authData.state)}`);
        const data = await res.json();
        if (cancelled || callbackProcessedRef.current) return;
        if (data.status === "done") {
          callbackProcessedRef.current = true;
          setStep("success");
          notifyParent(data);
          return;
        }
        if (data.status === "error") {
          callbackProcessedRef.current = true;
          setError(data.error || "Authentication failed");
          setStep("error");
          return;
        }
      } catch {
        // Network error, keep polling
      }
      if (attempts >= MAX_ATTEMPTS) {
        callbackProcessedRef.current = true;
        setError("Authentication timeout");
        setStep("error");
        return;
      }
      setTimeout(tick, POLL_INTERVAL_MS);
    };
    setTimeout(tick, POLL_INTERVAL_MS);
    return () => { cancelled = true; };
  }, [authData, notifyParent]);

  // Listen for OAuth callback via multiple methods
  useEffect(() => {
    if (!authData) return;
    callbackProcessedRef.current = false; // Reset when authData changes

    // Handler for callback data - only process once
    const handleCallback = async (data) => {
      if (callbackProcessedRef.current) return; // Already processed

      const { code, token, state, error: callbackError, errorDescription } = data;

      if (callbackError) {
        callbackProcessedRef.current = true;
        setError(errorDescription || callbackError);
        setStep("error");
        return;
      }

      if (token || code) {
        callbackProcessedRef.current = true;
        await exchangeTokens(token || code, state);
      }
    };

    // Method 1: postMessage from popup
    const handleMessage = (event) => {
      // Allow messages from same origin or localhost (any port)
      const isLocalhost = event.origin.includes("localhost") || event.origin.includes("127.0.0.1");
      const isSameOrigin = event.origin === window.location.origin;
      if (!isLocalhost && !isSameOrigin) return;
      
      if (event.data?.type === "oauth_callback") {
        handleCallback(event.data.data);
      }
    };
    window.addEventListener("message", handleMessage);

    // Method 2: BroadcastChannel
    let channel;
    try {
      channel = new BroadcastChannel("oauth_callback");
      channel.onmessage = (event) => handleCallback(event.data);
    } catch (e) {
      console.log("BroadcastChannel not supported");
    }

    // Method 3: localStorage event
    const handleStorage = (event) => {
      if (event.key === "oauth_callback" && event.newValue) {
        try {
          const data = JSON.parse(event.newValue);
          handleCallback(data);
          localStorage.removeItem("oauth_callback");
        } catch (e) {
          console.log("Failed to parse localStorage data");
        }
      }
    };
    window.addEventListener("storage", handleStorage);

    // Also check localStorage on mount (in case callback already happened)
    try {
      const stored = localStorage.getItem("oauth_callback");
      if (stored) {
        const data = JSON.parse(stored);
        if (data.timestamp && Date.now() - data.timestamp < 30000) {
          handleCallback(data);
        }
        localStorage.removeItem("oauth_callback");
      }
    } catch {
      // localStorage may be unavailable or data may be malformed - ignore silently
    }

    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("storage", handleStorage);
      if (channel) channel.close();
    };
  }, [authData, exchangeTokens]);

  // Handle manual URL input
  const handleManualSubmit = async () => {
    try {
      setError(null);

      // Paste-token mode (Trae/Windsurf): token goes straight to /exchange
      if (authMode === "paste-token" && PASTE_TOKEN_PROVIDERS[provider]) {
        const token = pasteToken.trim();
        if (!token) throw new Error("Missing token");
        const res = await fetch(`/api/oauth/${provider}/exchange`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: token }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setStep("success");
        notifyParent(data);
        return;
      }

      const input = callbackUrl.trim();

      // Trae/Windsurf proxy flow fallback (popup blocked): paste the full callback URL
      if (PROXY_OAUTH_PROVIDERS.has(provider) && input) {
        const res = await fetch(`/api/oauth/${provider}/exchange`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: input, state: authData?.state }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setStep("success");
        notifyParent(data);
        return;
      }

      // Detect raw JWT access token (starts with eyJ) — skip URL parsing
      if (input.startsWith("eyJ") && input.includes(".")) {
        await exchangeTokens(input, null);
        return;
      }

      if (provider === "xai" && input && !input.includes("://") && !input.includes("?") && !input.includes("code=")) {
        await completeXaiManualCode(input);
        return;
      }

      if (provider === "kimchi" && input && !input.includes("://") && !input.includes("?")) {
        await exchangeTokens(input, null);
        return;
      }

      const url = new URL(input);
      const code = url.searchParams.get("code");
      const token = url.searchParams.get("token");
      const state = url.searchParams.get("state");
      const errorParam = url.searchParams.get("error");

      if (errorParam) {
        throw new Error(url.searchParams.get("error_description") || errorParam);
      }

      if (!code && !token) {
        throw new Error(
          provider === "xai"
            ? "Paste the callback URL or copied xAI code"
            : provider === "kimchi"
              ? "No Kimchi token found in URL"
              : "No authorization code found in URL"
        );
      }

      await exchangeTokens(token || code, state);
    } catch (err) {
      setError(err.message);
      setStep("error");
    }
  };

  // Clear session on modal close + cleanup proxy
  const handleClose = useCallback(() => {
    if (provider === "codex") {
      fetch("/api/oauth/codex/stop-proxy").catch(() => {});
    } else if (provider === "xai") {
      fetch("/api/oauth/xai/stop-proxy").catch(() => {});
    } else if (provider === "trae") {
      fetch("/api/oauth/trae/stop-proxy").catch(() => {});
    } else if (provider === "windsurf") {
      fetch("/api/oauth/windsurf/stop-proxy").catch(() => {});
    } else if (provider === "zed") {
      fetch("/api/oauth/zed/stop-proxy").catch(() => {});
    }
    onClose();
  }, [onClose, provider]);

  if (!provider || !providerInfo) return null;
  const isXaiProvider = provider === "xai";
  const isKimchiProvider = provider === "kimchi";
  const deviceLoginUrl = deviceData?.verification_uri_complete || deviceData?.verification_uri || "";
  const modalTitle = isXaiProvider ? "Connect Grok Build OAuth" : `Connect ${providerInfo.name}`;
  const manualPlaceholder = isXaiProvider
    ? "http://127.0.0.1:56121/callback?code=... or copied code"
    : isKimchiProvider
      ? `${placeholderUrl.replace("code=...", "token=...")} or copied token`
      : placeholderUrl;

  return (
    <Modal isOpen={isOpen} title={modalTitle} onClose={handleClose} size="lg">
      <div className="flex flex-col gap-4">
        {/* Trae/Windsurf: browser OAuth (proxy) + paste-token fallback */}
        {PROXY_OAUTH_PROVIDERS.has(provider) && (step === "waiting" || step === "input" || step === "error") && (
          <div className="flex flex-col gap-4">
            <SegmentedControl
              ariaLabel="Authentication mode"
              value={authMode}
              onChange={(next) => {
                if (next === "browser") {
                  setAuthMode("browser");
                  setError(null);
                  setStep("waiting");
                  startOAuthFlow();
                } else {
                  setAuthMode("paste-token");
                  setError(null);
                  setStep("input");
                }
              }}
              options={[
                { value: "browser", label: "Sign in with browser", icon: "public" },
                { value: "paste-token", label: "Paste token", icon: "key" },
              ]}
            />

            {authMode === "browser" && (
              <>
                {step === "waiting" && (
                  <div className="flex items-center gap-2.5 rounded-[10px] border border-border bg-surface-2 px-3 py-2.5 text-sm text-text-muted">
                    <Icon name="progress_activity" className="animate-spin text-[18px] text-primary" />
                    Waiting for authorization in the browser window that just opened…
                  </div>
                )}
                {step === "input" && (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start gap-2.5 rounded-[10px] border border-warning/20 bg-warning/10 p-3">
                      <Icon name="warning" weight="fill" className="mt-0.5 text-[18px] text-warning shrink-0" />
                      <p className="text-sm text-text-muted">
                        The popup was blocked, so finish the login in the browser tab and paste the callback
                        URL it lands on.
                      </p>
                    </div>
                    <Input
                      label="Callback URL"
                      value={callbackUrl}
                      onChange={(e) => setCallbackUrl(e.target.value)}
                      placeholder="http://127.0.0.1:.../callback?..."
                      inputClassName="font-mono text-xs"
                    />
                    <div className="flex gap-2">
                      <Button onClick={handleManualSubmit} fullWidth disabled={!callbackUrl}>Connect</Button>
                      <Button onClick={handleClose} variant="ghost" fullWidth>Cancel</Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {authMode === "paste-token" && (
              <div className="flex flex-col gap-4">
                {ideStatus && !ideStatus.installed && (
                  <div
                    className={`flex items-start gap-2.5 rounded-[10px] p-3 text-sm ${
                      PASTE_TOKEN_PROVIDERS[provider].ideOptional
                        ? "border border-border bg-surface-2"
                        : "border border-warning/20 bg-warning/10"
                    }`}
                  >
                    <Icon
                      name={PASTE_TOKEN_PROVIDERS[provider].ideOptional ? "info" : "warning"}
                      weight={PASTE_TOKEN_PROVIDERS[provider].ideOptional ? "regular" : "fill"}
                      className={`mt-0.5 text-[18px] shrink-0 ${
                        PASTE_TOKEN_PROVIDERS[provider].ideOptional ? "text-text-muted" : "text-warning"
                      }`}
                    />
                    <p className="text-text-muted">
                      <span className="font-medium text-text-main">
                        {PASTE_TOKEN_PROVIDERS[provider].ideName} was not detected on this machine.
                      </span>{" "}
                      {PASTE_TOKEN_PROVIDERS[provider].ideOptional
                        ? "You can still copy the token from DevTools."
                        : `Install ${PASTE_TOKEN_PROVIDERS[provider].ideName} to get the token, or use "Sign in with browser" instead.`}
                    </p>
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm text-text-muted">{PASTE_TOKEN_PROVIDERS[provider].instructions}</p>
                  <Input
                    label={PASTE_TOKEN_PROVIDERS[provider].label}
                    value={pasteToken}
                    onChange={(e) => setPasteToken(e.target.value)}
                    placeholder={PASTE_TOKEN_PROVIDERS[provider].placeholder}
                    inputClassName="font-mono text-xs"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleManualSubmit} fullWidth disabled={!pasteToken}>Connect</Button>
                  <Button onClick={handleClose} variant="ghost" fullWidth>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Waiting + Manual Input combined (non-device-code, non-proxy) */}
        {(step === "waiting" || step === "input") && !isDeviceCode && !PROXY_OAUTH_PROVIDERS.has(provider) && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2.5 rounded-[10px] border border-border bg-surface-2 px-3 py-2.5 text-sm text-text-muted">
              <Icon name="progress_activity" className="animate-spin text-[18px] text-primary" />
              {isXaiProvider
                ? "Waiting for the Grok Build authorization window…"
                : "Waiting for the authorization window that just opened…"}
            </div>

            <p className="text-[13px] text-text-muted">
              Popup blocked or on a headless machine? Open the URL yourself, then paste the callback it lands
              on.
            </p>

            <div className="flex flex-col gap-1.5">
              <span className="flex items-center gap-2 text-sm font-medium text-text-main">
                <span className="flex size-5 items-center justify-center rounded-md bg-surface-2 text-xs font-semibold tabular-nums text-text-muted">
                  1
                </span>
                Open this {isXaiProvider ? "Grok Build OAuth URL" : "URL"} in your browser
              </span>
              <div className="flex items-stretch gap-2">
                <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-md border border-border bg-surface-2 px-2.5 py-2 font-mono text-xs text-text-main">
                  {authData?.authUrl || ""}
                </code>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={copied === "auth_url" ? "check" : "content_copy"}
                  onClick={() => copy(authData?.authUrl, "auth_url")}
                  disabled={!authData?.authUrl}
                  aria-label="Copy authorization URL"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="flex items-center gap-2 text-sm font-medium text-text-main">
                <span className="flex size-5 items-center justify-center rounded-md bg-surface-2 text-xs font-semibold tabular-nums text-text-muted">
                  2
                </span>
                Paste the {provider === "xai" ? "callback URL or copied code" : isKimchiProvider ? "callback URL or copied token" : "callback URL"}
              </span>
              {provider === "xai" ? (
                <p className="text-xs text-text-muted">
                  If xAI shows a code instead of redirecting, paste that code here.
                </p>
              ) : isKimchiProvider ? (
                <p className="text-xs text-text-muted">
                  After authorizing, copy the callback URL or the token your browser is showing.
                </p>
              ) : (
                <p className="text-xs text-text-muted">
                  Copy the whole address from the browser tab that finished the login.
                </p>
              )}
              <Input
                value={callbackUrl}
                onChange={(e) => setCallbackUrl(e.target.value)}
                placeholder={manualPlaceholder}
                inputClassName="font-mono text-xs"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleManualSubmit} fullWidth disabled={!callbackUrl}>
                Connect
              </Button>
              <Button onClick={handleClose} variant="ghost" fullWidth>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Device Code Flow - Waiting */}
        {step === "waiting" && isDeviceCode && deviceData && (
          <div className="flex flex-col gap-4">
            <p className="text-[13px] text-text-muted">
              A browser tab already opened on the verification page. Enter the code below there to authorize
              this router.
            </p>

            <div className="flex flex-col items-center gap-1.5 rounded-[10px] border border-primary/20 bg-primary/10 p-4">
              <span className="text-xs text-text-muted">Code to enter</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-2xl font-semibold tracking-[0.08em] text-primary tabular-nums">
                  {deviceData.user_code}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={copied === "user_code" ? "check" : "content_copy"}
                  onClick={() => copy(deviceData.user_code, "user_code")}
                  aria-label="Copy code"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-text-muted">Verification URL</span>
              <div className="flex items-stretch gap-2">
                <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-md border border-border bg-surface-2 px-2.5 py-2 font-mono text-xs text-text-main">
                  {deviceLoginUrl}
                </code>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={copied === "login_url" ? "check" : "content_copy"}
                  onClick={() => copy(deviceLoginUrl, "login_url")}
                  disabled={!deviceLoginUrl}
                  aria-label="Copy verification URL"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  icon="open_in_new"
                  onClick={() => window.open(deviceLoginUrl, "_blank", "noopener,noreferrer")}
                  disabled={!deviceLoginUrl}
                  aria-label="Open verification URL"
                />
              </div>
            </div>

            {polling && (
              <div className="flex items-center gap-2.5 text-sm text-text-muted">
                <Icon name="progress_activity" className="animate-spin text-[18px]" />
                Polling the provider until the code is authorized…
              </div>
            )}
          </div>
        )}

        {/* Success Step */}
        {step === "success" && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <span className="flex size-10 items-center justify-center rounded-md bg-success/10">
              <Icon name="check_circle" weight="fill" className="text-[22px] text-success" />
            </span>
            <p className="text-[15px] font-semibold text-text-main">
              {providerInfo.name} connected
            </p>
            <p className="text-sm text-text-muted">
              The connection is saved and its models are available in the model picker.
            </p>
            <Button onClick={handleClose} fullWidth className="mt-2">
              Done
            </Button>
          </div>
        )}

        {/* Error Step */}
        {step === "error" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-2.5 rounded-[10px] border border-danger/20 bg-danger/10 p-3">
              <Icon name="error" className="mt-0.5 text-[18px] text-danger shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-text-main">
                  {providerInfo.name} could not be connected
                </p>
                <p className="mt-1 text-text-muted">{error}</p>
                <p className="mt-1 text-text-muted">
                  Run the flow again — if it keeps failing, check that the provider is reachable from this
                  machine and that no other process holds its callback port.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={startOAuthFlow} variant="secondary" fullWidth>
                Try again
              </Button>
              <Button onClick={handleClose} variant="ghost" fullWidth>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

OAuthModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  provider: PropTypes.string,
  providerInfo: PropTypes.shape({ name: PropTypes.string }),
  onSuccess: PropTypes.func,
  onClose: PropTypes.func.isRequired,
  /** Extra metadata passed to /authorize and /exchange (e.g. gitlab clientId/baseUrl) */
  oauthMeta: PropTypes.object,
  /** Optional Kiro IDC config for AWS IAM Identity Center device flow */
  idcConfig: PropTypes.shape({
    startUrl: PropTypes.string,
    region: PropTypes.string,
  }),
};
