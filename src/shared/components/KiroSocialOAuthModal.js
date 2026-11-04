"use client";

import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { Modal, Button, Input } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";

import { Icon } from "@/shared/components/Icon";
/**
 * Kiro Social OAuth Modal (Google/GitHub)
 * Handles manual callback URL flow for social login
 */
export default function KiroSocialOAuthModal({ isOpen, provider, onSuccess, onClose }) {
  const [step, setStep] = useState("loading"); // loading | input | success | error
  const [authUrl, setAuthUrl] = useState("");
  const [authData, setAuthData] = useState(null);
  const [callbackUrl, setCallbackUrl] = useState("");
  const [error, setError] = useState(null);
  const { copied, copy } = useCopyToClipboard();
  const openedRef = useRef(false);

  // Reset auto-open guard when modal closes so it can re-open next session.
  useEffect(() => {
    if (!isOpen) openedRef.current = false;
  }, [isOpen]);

  // Initialize auth flow
  useEffect(() => {
    if (!isOpen || !provider) return;

    const initAuth = async () => {
      try {
        setError(null);
        setStep("loading");

        const res = await fetch(`/api/oauth/kiro/social-authorize?provider=${provider}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error);
        }

        setAuthData(data);
        setAuthUrl(data.authUrl);
        setStep("input");

        // Auto-open browser once per modal session.
        if (!openedRef.current) {
          openedRef.current = true;
          window.open(data.authUrl, "_blank");
        }
      } catch (err) {
        setError(err.message);
        setStep("error");
      }
    };

    initAuth();
  }, [isOpen, provider]);

  const handleManualSubmit = async () => {
    try {
      setError(null);

      // Parse callback URL - can be either kiro:// or http://localhost format
      let url;
      try {
        url = new URL(callbackUrl);
      } catch (e) {
        // If URL parsing fails, might be malformed
        throw new Error("Invalid callback URL format");
      }

      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const errorParam = url.searchParams.get("error");

      if (errorParam) {
        throw new Error(url.searchParams.get("error_description") || errorParam);
      }

      if (!code) {
        throw new Error("No authorization code found in URL");
      }

      // Exchange code for tokens
      const res = await fetch("/api/oauth/kiro/social-exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          codeVerifier: authData.codeVerifier,
          provider,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setStep("success");
      onSuccess?.();
    } catch (err) {
      setError(err.message);
      setStep("error");
    }
  };

  const providerName = provider === "google" ? "Google" : "GitHub";

  return (
    <Modal isOpen={isOpen} title={`Connect Kiro via ${providerName}`} onClose={onClose} size="lg">
      {step === "loading" && (
        <div className="flex items-center gap-2.5 py-6 text-sm text-text-muted">
          <Icon name="progress_activity" className="animate-spin text-[18px] text-primary" />
          Requesting a {providerName} authorization URL from Kiro…
        </div>
      )}

      {step === "input" && (
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-text-muted">
            Kiro hands back the authorization code on a callback URL, so the browser tab that opens can stay
            open while you copy its address.
          </p>

          <div className="flex flex-col gap-1.5">
            <span className="flex items-center gap-2 text-sm font-medium text-text-main">
              <span className="flex size-5 items-center justify-center rounded-md bg-surface-2 text-xs font-semibold tabular-nums text-text-muted">
                1
              </span>
              Open this URL and authorize
            </span>
            <div className="flex items-stretch gap-2">
              <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-md border border-border bg-surface-2 px-2.5 py-2 font-mono text-xs text-text-main">
                {authUrl}
              </code>
              <Button
                variant="secondary"
                size="sm"
                icon={copied === "auth_url" ? "check" : "content_copy"}
                onClick={() => copy(authUrl, "auth_url")}
                aria-label="Copy authorization URL"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="flex items-center gap-2 text-sm font-medium text-text-main">
              <span className="flex size-5 items-center justify-center rounded-md bg-surface-2 text-xs font-semibold tabular-nums text-text-muted">
                2
              </span>
              Paste the callback URL
            </span>
            <Input
              value={callbackUrl}
              onChange={(e) => setCallbackUrl(e.target.value)}
              placeholder="kiro://kiro.kiroAgent/authenticate-success?code=..."
              inputClassName="font-mono text-xs"
              hint="Copy the whole address from the browser tab that finished the login."
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleManualSubmit} fullWidth disabled={!callbackUrl}>
              Connect
            </Button>
            <Button onClick={onClose} variant="ghost" fullWidth>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {step === "success" && (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <span className="flex size-10 items-center justify-center rounded-md bg-success/10">
            <Icon name="check_circle" weight="fill" className="text-[22px] text-success" />
          </span>
          <p className="text-[15px] font-semibold text-text-main">Kiro connected via {providerName}</p>
          <p className="text-sm text-text-muted">
            The account is active now. Its models appear in the model picker.
          </p>
          <Button onClick={onClose} fullWidth className="mt-2">
            Done
          </Button>
        </div>
      )}

      {step === "error" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-2.5 rounded-[10px] border border-danger/20 bg-danger/10 p-3">
            <Icon name="error" className="mt-0.5 text-[18px] text-danger shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-text-main">The {providerName} connection failed</p>
              <p className="mt-1 text-text-muted">{error}</p>
              <p className="mt-1 text-text-muted">
                Start the flow again and make sure the callback URL still holds a fresh{" "}
                <span className="font-mono text-xs">code</span> parameter.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setStep("input")} variant="secondary" fullWidth>
              Back to the URL
            </Button>
            <Button onClick={onClose} variant="ghost" fullWidth>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

KiroSocialOAuthModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  provider: PropTypes.oneOf(["google", "github"]).isRequired,
  onSuccess: PropTypes.func,
  onClose: PropTypes.func.isRequired,
};
