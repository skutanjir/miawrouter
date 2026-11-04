"use client";

import { useState, useEffect, useRef } from "react";
import { Card, Button, Toggle, Input } from "@/shared/components";
import Modal, { ConfirmModal } from "@/shared/components/Modal";
import LanguageSwitcher from "@/shared/components/LanguageSwitcher";
import { useTheme } from "@/shared/hooks/useTheme";
import { cn } from "@/shared/utils/cn";
import { APP_CONFIG } from "@/shared/constants/config";
import { LOCALE_COOKIE, LOCALE_NAMES, normalizeLocale } from "@/i18n/config";
import { ConfigSection, ConfigRow } from "../components/ConfigSection";

import { Icon } from "@/shared/components/Icon";

function getLocaleFromCookie() {
  if (typeof document === "undefined") return "en";
  const cookie = document.cookie
    .split(";")
    .find((c) => c.trim().startsWith(`${LOCALE_COOKIE}=`));
  const value = cookie ? decodeURIComponent(cookie.split("=")[1]) : "en";
  return normalizeLocale(value);
}

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: "light_mode" },
  { value: "dark", label: "Dark", icon: "dark_mode" },
  { value: "system", label: "System", icon: "contrast" },
];

export default function ProfilePage() {
  const { theme, setTheme } = useTheme();
  const [locale, setLocale] = useState("en");
  const [langOpen, setLangOpen] = useState(false);
  const [shutdownOpen, setShutdownOpen] = useState(false);
  const [isShuttingDown, setIsShuttingDown] = useState(false);
  const [settings, setSettings] = useState({ fallbackStrategy: "fill-first" });
  const [loading, setLoading] = useState(true);
  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
  const [passStatus, setPassStatus] = useState({ type: "", message: "" });
  const [passLoading, setPassLoading] = useState(false);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState({ type: "", message: "" });
  const [dbAuth, setDbAuth] = useState({ open: false, mode: "", password: "" });
  const pendingImportRef = useRef(null);
  const [oidcForm, setOidcForm] = useState({
    authMode: "password",
    oidcIssuerUrl: "",
    oidcClientId: "",
    oidcScopes: "openid profile email",
    oidcLoginLabel: "Sign in with OIDC",
  });
  const [oidcClientSecret, setOidcClientSecret] = useState("");
  const [oidcStatus, setOidcStatus] = useState({ type: "", message: "" });
  const [oidcLoading, setOidcLoading] = useState(false);
  const [oidcTestLoading, setOidcTestLoading] = useState(false);
  const [oidcTestStatus, setOidcTestStatus] = useState({ type: "", message: "" });
  const [oidcRedirectUri, setOidcRedirectUri] = useState("/api/auth/oidc/callback");
  const [oidcExpanded, setOidcExpanded] = useState(false);
  const importFileRef = useRef(null);
  const [proxyForm, setProxyForm] = useState({
    outboundProxyEnabled: false,
    outboundProxyUrl: "",
    outboundNoProxy: "",
  });
  const [proxyStatus, setProxyStatus] = useState({ type: "", message: "" });
  const [proxyLoading, setProxyLoading] = useState(false);
  const [proxyTestLoading, setProxyTestLoading] = useState(false);

  useEffect(() => {
    setLocale(getLocaleFromCookie());
  }, [langOpen]);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        setSettings(data);
        setOidcForm({
          authMode: data?.authMode || "password",
          oidcIssuerUrl: data?.oidcIssuerUrl || "",
          oidcClientId: data?.oidcClientId || "",
          oidcScopes: data?.oidcScopes || "openid profile email",
          oidcLoginLabel: data?.oidcLoginLabel || "Sign in with OIDC",
        });
        setOidcClientSecret("");
        if (data?.authMode === "oidc" || data?.authMode === "both") setOidcExpanded(true);
        setProxyForm({
          outboundProxyEnabled: data?.outboundProxyEnabled === true,
          outboundProxyUrl: data?.outboundProxyUrl || "",
          outboundNoProxy: data?.outboundNoProxy || "",
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch settings:", err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOidcRedirectUri(`${window.location.origin}/api/auth/oidc/callback`);
    }
  }, []);

  const updateOutboundProxy = async (e) => {
    e.preventDefault();
    if (settings.outboundProxyEnabled !== true) return;
    setProxyLoading(true);
    setProxyStatus({ type: "", message: "" });

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outboundProxyUrl: proxyForm.outboundProxyUrl,
          outboundNoProxy: proxyForm.outboundNoProxy,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSettings((prev) => ({ ...prev, ...data }));
        setProxyStatus({ type: "success", message: "Proxy settings applied" });
      } else {
        setProxyStatus({ type: "error", message: data.error || "Failed to update proxy settings" });
      }
    } catch (err) {
      setProxyStatus({ type: "error", message: "An error occurred" });
    } finally {
      setProxyLoading(false);
    }
  };

  const testOutboundProxy = async () => {
    if (settings.outboundProxyEnabled !== true) return;

    const proxyUrl = (proxyForm.outboundProxyUrl || "").trim();
    if (!proxyUrl) {
      setProxyStatus({ type: "error", message: "Please enter a Proxy URL to test" });
      return;
    }

    setProxyTestLoading(true);
    setProxyStatus({ type: "", message: "" });

    try {
      const res = await fetch("/api/settings/proxy-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proxyUrl }),
      });

      const data = await res.json();
      if (res.ok && data?.ok) {
        setProxyStatus({
          type: "success",
          message: `Proxy test OK (${data.status}) in ${data.elapsedMs}ms`,
        });
      } else {
        setProxyStatus({
          type: "error",
          message: data?.error || "Proxy test failed",
        });
      }
    } catch (err) {
      setProxyStatus({ type: "error", message: "An error occurred" });
    } finally {
      setProxyTestLoading(false);
    }
  };

  const updateOutboundProxyEnabled = async (outboundProxyEnabled) => {
    setProxyLoading(true);
    setProxyStatus({ type: "", message: "" });

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outboundProxyEnabled }),
      });

      const data = await res.json();
      if (res.ok) {
        setSettings((prev) => ({ ...prev, ...data }));
        setProxyForm((prev) => ({ ...prev, outboundProxyEnabled: data?.outboundProxyEnabled === true }));
        setProxyStatus({
          type: "success",
          message: outboundProxyEnabled ? "Proxy enabled" : "Proxy disabled",
        });
      } else {
        setProxyStatus({ type: "error", message: data.error || "Failed to update proxy settings" });
      }
    } catch (err) {
      setProxyStatus({ type: "error", message: "An error occurred" });
    } finally {
      setProxyLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      setPassStatus({ type: "error", message: "Passwords do not match" });
      return;
    }
    if (passwords.new.length < 8) {
      setPassStatus({ type: "error", message: "New password must be at least 8 characters" });
      return;
    }

    setPassLoading(true);
    setPassStatus({ type: "", message: "" });

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwords.current,
          newPassword: passwords.new,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setPassStatus({ type: "success", message: "Password updated successfully" });
        setPasswords({ current: "", new: "", confirm: "" });
      } else {
        setPassStatus({ type: "error", message: data.error || "Failed to update password" });
      }
    } catch (err) {
      setPassStatus({ type: "error", message: "An error occurred" });
    } finally {
      setPassLoading(false);
    }
  };

  const updateFallbackStrategy = async (strategy) => {
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fallbackStrategy: strategy }),
      });
      if (res.ok) {
        setSettings(prev => ({ ...prev, fallbackStrategy: strategy }));
      }
    } catch (err) {
      console.error("Failed to update settings:", err);
    }
  };

  const updateComboStrategy = async (strategy) => {
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comboStrategy: strategy }),
      });
      if (res.ok) {
        setSettings(prev => ({ ...prev, comboStrategy: strategy }));
      }
    } catch (err) {
      console.error("Failed to update combo strategy:", err);
    }
  };

  const updateStickyLimit = async (limit) => {
    const numLimit = parseInt(limit);
    if (isNaN(numLimit) || numLimit < 1) return;

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stickyRoundRobinLimit: numLimit }),
      });
      if (res.ok) {
        setSettings(prev => ({ ...prev, stickyRoundRobinLimit: numLimit }));
      }
    } catch (err) {
      console.error("Failed to update sticky limit:", err);
    }
  };

  const updateComboStickyLimit = async (limit) => {
    const numLimit = parseInt(limit);
    if (isNaN(numLimit) || numLimit < 1) return;

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comboStickyRoundRobinLimit: numLimit }),
      });
      if (res.ok) {
        setSettings(prev => ({ ...prev, comboStickyRoundRobinLimit: numLimit }));
      }
    } catch (err) {
      console.error("Failed to update combo sticky limit:", err);
    }
  };

  const updateRequireLogin = async (requireLogin) => {
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requireLogin }),
      });
      if (res.ok) {
        setSettings(prev => ({ ...prev, requireLogin }));
      }
    } catch (err) {
      console.error("Failed to update require login:", err);
    }
  };

  const updateOidcForm = (field, value) => {
    setOidcForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveOidcSettings = async (authMode = oidcForm.authMode || "password") => {
    const issuerUrl = oidcForm.oidcIssuerUrl.trim();
    const clientId = oidcForm.oidcClientId.trim();
    const scopes = oidcForm.oidcScopes.trim();
    const loginLabel = oidcForm.oidcLoginLabel.trim();
    const secret = oidcClientSecret.trim();

    if (authMode !== "password" && (!issuerUrl || !clientId || !secret) && !settings.oidcConfigured) {
      setOidcStatus({ type: "error", message: "Issuer URL, client ID, and client secret are required to enable OIDC." });
      return;
    }

    setOidcLoading(true);
    setOidcStatus({ type: "", message: "" });
    setOidcTestStatus({ type: "", message: "" });

    try {
      const payload = {
        authMode,
        oidcIssuerUrl: issuerUrl,
        oidcClientId: clientId,
        oidcScopes: scopes || "openid profile email",
        oidcLoginLabel: loginLabel || "Sign in with OIDC",
      };
      if (secret) {
        payload.oidcClientSecret = secret;
      }

      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setSettings((prev) => ({ ...prev, ...data }));
        setOidcForm({
          authMode: data?.authMode || authMode,
          oidcIssuerUrl: data?.oidcIssuerUrl || issuerUrl,
          oidcClientId: data?.oidcClientId || clientId,
          oidcScopes: data?.oidcScopes || scopes || "openid profile email",
          oidcLoginLabel: data?.oidcLoginLabel || loginLabel || "Sign in with OIDC",
        });
        setOidcClientSecret("");
        setOidcStatus({
          type: "success",
          message:
            authMode === "oidc"
              ? "OIDC login enabled"
              : authMode === "both"
                ? "Password and OIDC login enabled"
                : "OIDC settings saved",
        });
      } else {
        setOidcStatus({ type: "error", message: data.error || "Failed to save OIDC settings" });
      }
    } catch (err) {
      setOidcStatus({ type: "error", message: "An error occurred" });
    } finally {
      setOidcLoading(false);
    }
  };

  const testOidcConnection = async () => {
    const issuerUrl = oidcForm.oidcIssuerUrl.trim();
    const clientId = oidcForm.oidcClientId.trim();
    const scopes = oidcForm.oidcScopes.trim();
    const secret = oidcClientSecret.trim();

    if (!issuerUrl || !clientId) {
      setOidcTestStatus({ type: "error", message: "Issuer URL and client ID are required to test the connection." });
      return;
    }

    setOidcTestLoading(true);
    setOidcStatus({ type: "", message: "" });
    setOidcTestStatus({ type: "", message: "" });

    try {
      const saveRes = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authMode: oidcForm.authMode || settings.authMode || "password",
          oidcIssuerUrl: issuerUrl,
          oidcClientId: clientId,
          oidcScopes: scopes || "openid profile email",
          oidcLoginLabel: oidcForm.oidcLoginLabel.trim() || "Sign in with OIDC",
          ...(secret ? { oidcClientSecret: secret } : {}),
        }),
      });

      const saved = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok) {
        setOidcTestStatus({
          type: "error",
          message: saved.error || "Failed to save OIDC settings before testing",
        });
        return;
      }

      const res = await fetch("/api/auth/oidc/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issuerUrl: saved.oidcIssuerUrl || issuerUrl,
          clientId: saved.oidcClientId || clientId,
          scopes: saved.oidcScopes || scopes || "openid profile email",
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        const statusMessage = data.clientSecretTested
          ? data.clientSecretValid === true
            ? `Connection OK. Discovery loaded from ${data.issuerUrl}. Client secret validated too.`
            : `Connection OK. Discovery loaded from ${data.issuerUrl}. Client secret was not checked.`
          : `Connection OK. Discovery loaded from ${data.issuerUrl}.`;
        setOidcTestStatus({
          type: "success",
          message: statusMessage,
        });
      } else {
        setOidcTestStatus({ type: "error", message: data.error || "OIDC connection test failed" });
      }
    } catch (err) {
      setOidcTestStatus({ type: "error", message: "An error occurred" });
    } finally {
      setOidcTestLoading(false);
    }
  };

  const updateObservabilityEnabled = async (enabled) => {
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enableObservability: enabled }),
      });
      if (res.ok) {
        setSettings(prev => ({ ...prev, enableObservability: enabled }));
      }
    } catch (err) {
      console.error("Failed to update enableObservability:", err);
    }
  };

  const reloadSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) return;
      const data = await res.json();
      setSettings(data);
    } catch (err) {
      console.error("Failed to reload settings:", err);
    }
  };

  const handleExportDatabase = async (password) => {
    setDbLoading(true);
    setDbStatus({ type: "", message: "" });
    try {
      const res = await fetch("/api/settings/database", {
        headers: { "x-miaw-password": password },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to export database");
      }

      const payload = await res.json();
      const content = JSON.stringify(payload, null, 2);
      const blob = new Blob([content], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const stamp = new Date().toISOString().replace(/[.:]/g, "-");
      anchor.href = url;
      anchor.download = `miawrouter-backup-${stamp}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      setDbStatus({ type: "success", message: "Database backup downloaded" });
    } catch (err) {
      setDbStatus({ type: "error", message: err.message || "Failed to export database" });
    } finally {
      setDbLoading(false);
    }
  };

  const handleImportDatabase = (event) => {
    const file = event.target.files?.[0];
    if (importFileRef.current) importFileRef.current.value = "";
    if (!file) return;
    pendingImportRef.current = file;
    setDbStatus({ type: "", message: "" });
    setDbAuth({ open: true, mode: "import", password: "" });
  };

  const runImportDatabase = async (password) => {
    const file = pendingImportRef.current;
    if (!file) return;
    setDbLoading(true);
    try {
      const raw = await file.text();
      const payload = JSON.parse(raw);

      const res = await fetch("/api/settings/database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to import database");
      }

      await reloadSettings();
      setDbStatus({ type: "success", message: "Database imported successfully" });
    } catch (err) {
      setDbStatus({ type: "error", message: err.message || "Invalid backup file" });
    } finally {
      pendingImportRef.current = null;
      setDbLoading(false);
    }
  };

  // Confirm password modal, then run export or import.
  const handleDbAuthConfirm = async () => {
    const { mode, password } = dbAuth;
    setDbAuth({ open: false, mode: "", password: "" });
    if (mode === "export") await handleExportDatabase(password);
    else if (mode === "import") await runImportDatabase(password);
  };

  const observabilityEnabled = settings.enableObservability === true;

  const handleShutdown = async () => {
    setIsShuttingDown(true);
    try {
      await fetch("/api/version/shutdown", { method: "POST" });
    } catch (e) {
      // Expected to fail as server shuts down; ignore error
    }
    setIsShuttingDown(false);
    setShutdownOpen(false);
  };

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        window.location.assign("/login");
      }
    } catch (err) {
      console.error("Failed to logout:", err);
    }
  };

  const oidcActiveLabel =
    settings.authMode === "oidc"
      ? "OIDC only"
      : settings.authMode === "both"
        ? "Password + OIDC"
        : "Password only";

  return (
    <div className="flex flex-col gap-6">
      <div className="workspace-heading">
        <div>
          <h1>Profile</h1>
          <p>
            This instance runs in local mode: the account, settings and usage live on this machine.
            Nothing here is synced to an external service.
          </p>
        </div>
        <span className="font-mono text-xs text-text-muted">
          {APP_CONFIG.name} v{APP_CONFIG.version}
        </span>
      </div>

      {/* Account */}
      <ConfigSection
        title="Account"
        icon="person"
        subtitle="Local account and how this dashboard looks for you."
      >
        <ConfigRow
          label="Local mode"
          help="There is no remote account. Your data stays in the local database below."
          control={<span className="text-[13px] font-medium text-success">Active</span>}
        />
        <ConfigRow
          label="Database location"
          help="SQLite file holding settings, connections, and usage history."
          control={
            <code className="font-mono text-xs text-text-muted">~/.miawrouter/db/data.sqlite</code>
          }
        />
        <ConfigRow
          label="Theme"
          help="Applies to this browser only."
          control={
            <div className="inline-flex rounded-md border border-border bg-surface-2 p-1">
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTheme(option.value)}
                  aria-pressed={theme === option.value}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-[4px] px-2.5 py-1 text-xs font-medium transition-colors",
                    theme === option.value
                      ? "bg-surface text-text-main"
                      : "text-text-muted hover:text-text-main"
                  )}
                >
                  <Icon name={option.icon} className="text-[16px]" />
                  {option.label}
                </button>
              ))}
            </div>
          }
        />
        <ConfigRow
          label="Language"
          help="Dashboard language. English is the default; additional locales appear as their translations are maintained."
          control={
            <>
              <span className="text-[13px] text-text-main">{LOCALE_NAMES[locale] || locale}</span>
              <Button
                variant="secondary"
                size="sm"
                icon="language"
                onClick={() => setLangOpen(true)}
                data-i18n-skip="true"
              >
                Change
              </Button>
            </>
          }
        />
      </ConfigSection>

      {/* Password & sign-in */}
      <ConfigSection
        title="Password & sign-in"
        icon="shield"
        subtitle="How the dashboard authenticates. Model API access uses API keys and is unaffected."
        action={<span className="text-[13px] text-text-muted">{oidcActiveLabel}</span>}
      >
        <ConfigRow
          label="Require login"
          help="On: the dashboard requires a password. Off: it opens without authentication — only safe on a machine nobody else can reach."
          control={
            <Toggle
              checked={settings.requireLogin === true}
              onChange={() => updateRequireLogin(!settings.requireLogin)}
              disabled={loading}
              ariaLabel="Require dashboard login"
            />
          }
        />

        {settings.requireLogin === true && (
          <ConfigRow
            label={settings.hasPassword ? "Change password" : "Set password"}
            help="At least 8 characters. Your current password is required to change it."
          >
            <form onSubmit={handlePasswordChange} className="mt-3 flex flex-col gap-4">
              {settings.hasPassword && (
                <Input
                  id="current-password"
                  type="password"
                  label="Current password"
                  placeholder="Enter current password"
                  autoComplete="current-password"
                  value={passwords.current}
                  onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                  required
                />
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  id="new-password"
                  type="password"
                  label="New password"
                  placeholder="Enter new password"
                  autoComplete="new-password"
                  value={passwords.new}
                  onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                  required
                />
                <Input
                  id="confirm-password"
                  type="password"
                  label="Confirm new password"
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  value={passwords.confirm}
                  onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                  required
                />
              </div>

              {passStatus.message && (
                <p
                  role="status"
                  className={`text-[13px] ${passStatus.type === "error" ? "text-danger" : "text-success"}`}
                >
                  {passStatus.message}
                </p>
              )}

              <div>
                <Button type="submit" variant="primary" size="sm" loading={passLoading}>
                  {settings.hasPassword ? "Update password" : "Set password"}
                </Button>
              </div>
            </form>
          </ConfigRow>
        )}

        <ConfigRow
          label="SSO via OIDC"
          help="Sign in through an OIDC provider such as Authentik, Keycloak or Google. Optional — password login keeps working unless you switch to OIDC only."
          badge={
            settings.authMode === "oidc" || settings.authMode === "both" ? (
              <span className="text-xs font-medium text-success">Configured</span>
            ) : null
          }
          control={
            <Button
              variant="secondary"
              size="sm"
              icon={oidcExpanded ? "expand_less" : "expand_more"}
              onClick={() => setOidcExpanded((v) => !v)}
              aria-expanded={oidcExpanded}
            >
              {oidcExpanded ? "Hide" : "Configure"}
            </Button>
          }
        >
          {oidcExpanded && (
            <div className="mt-3 flex flex-col gap-4">
              <div>
                <p className="mb-2 text-[13px] font-medium text-text-main">Auth mode</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {[
                    { value: "password", title: "Password only", desc: "Keep the legacy password login." },
                    { value: "oidc", title: "OIDC only", desc: "Require OIDC for dashboard access." },
                    { value: "both", title: "Both", desc: "Allow either password or OIDC." },
                  ].map((option) => {
                    const active = oidcForm.authMode === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateOidcForm("authMode", option.value)}
                        disabled={loading || oidcLoading}
                        aria-pressed={active}
                        className={cn(
                          "rounded-md border p-3 text-left transition-colors",
                          active
                            ? "border-primary bg-primary/10"
                            : "border-border bg-surface hover:bg-surface-2"
                        )}
                      >
                        <p className="text-[13px] font-medium text-text-main">{option.title}</p>
                        <p className="mt-0.5 text-xs text-text-muted">{option.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <Input
                  label="Issuer URL"
                  placeholder="https://auth.example.com/application/o/miawrouter/"
                  value={oidcForm.oidcIssuerUrl}
                  onChange={(e) => updateOidcForm("oidcIssuerUrl", e.target.value)}
                  disabled={loading || oidcLoading}
                />
                <Input
                  label="Client ID"
                  placeholder="miawrouter-dashboard"
                  value={oidcForm.oidcClientId}
                  onChange={(e) => updateOidcForm("oidcClientId", e.target.value)}
                  disabled={loading || oidcLoading}
                />
                <Input
                  label="Client secret"
                  type="password"
                  placeholder="Leave blank to keep existing secret"
                  value={oidcClientSecret}
                  onChange={(e) => setOidcClientSecret(e.target.value)}
                  disabled={loading || oidcLoading}
                  hint="Write-only after saving — the stored value is never returned."
                />
                <Input
                  label="Scopes"
                  placeholder="openid profile email"
                  value={oidcForm.oidcScopes}
                  onChange={(e) => updateOidcForm("oidcScopes", e.target.value)}
                  disabled={loading || oidcLoading}
                />
                <Input
                  label="Login button label"
                  placeholder="Sign in with OIDC"
                  value={oidcForm.oidcLoginLabel}
                  onChange={(e) => updateOidcForm("oidcLoginLabel", e.target.value)}
                  disabled={loading || oidcLoading}
                />
              </div>

              <div className="rounded-md border border-border-subtle bg-surface-2/40 p-3">
                <p className="text-[13px] font-medium text-text-main">Redirect URI</p>
                <code className="mt-0.5 block break-all font-mono text-xs text-text-muted">
                  {oidcRedirectUri}
                </code>
                <p className="mt-1 text-xs text-text-muted">
                  Register this exact URI on the OIDC client before testing the connection.
                </p>
              </div>

              <div className="flex flex-col gap-2 border-t border-border-subtle pt-4 sm:flex-row">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  loading={oidcLoading}
                  onClick={() => saveOidcSettings()}
                >
                  Save auth mode
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={oidcTestLoading}
                  onClick={testOidcConnection}
                >
                  Test connection
                </Button>
              </div>

              {oidcTestStatus.message && (
                <p className={`text-[13px] ${oidcTestStatus.type === "error" ? "text-danger" : "text-success"}`}>
                  {oidcTestStatus.message}
                </p>
              )}
              {oidcStatus.message && (
                <p className={`text-[13px] ${oidcStatus.type === "error" ? "text-danger" : "text-success"}`}>
                  {oidcStatus.message}
                </p>
              )}
              {settings.authMode === "oidc" && (
                <p className="text-[13px] text-warning">
                  OIDC login is active: password login is disabled until you switch the mode back.
                </p>
              )}
              {settings.authMode === "both" && (
                <p className="text-[13px] text-warning">
                  Password and OIDC login are both active.
                </p>
              )}
            </div>
          )}
        </ConfigRow>
      </ConfigSection>

      {/* Routing preferences */}
      <ConfigSection
        title="Routing preferences"
        icon="route"
        subtitle="How the router picks between the accounts and models you configured."
      >
        <ConfigRow
          label="Round robin accounts"
          help="Cycle through accounts to spread load instead of always starting with the first."
          control={
            <Toggle
              checked={settings.fallbackStrategy === "round-robin"}
              onChange={() => updateFallbackStrategy(settings.fallbackStrategy === "round-robin" ? "fill-first" : "round-robin")}
              disabled={loading}
              ariaLabel="Round robin accounts"
            />
          }
        />
        {settings.fallbackStrategy === "round-robin" && (
          <ConfigRow
            label="Account sticky limit"
            help="Calls sent to one account before the router switches to the next."
            control={
              <Input
                type="number"
                min="1"
                max="10"
                value={settings.stickyRoundRobinLimit || 3}
                onChange={(e) => updateStickyLimit(e.target.value)}
                disabled={loading}
                aria-label="Account sticky limit"
                className="w-20"
                inputClassName="text-center"
              />
            }
          />
        )}
        <ConfigRow
          label="Round robin combo models"
          help="Cycle through the models inside a combo instead of always starting with the first."
          control={
            <Toggle
              checked={settings.comboStrategy === "round-robin"}
              onChange={() => updateComboStrategy(settings.comboStrategy === "round-robin" ? "fallback" : "round-robin")}
              disabled={loading}
              ariaLabel="Round robin combo models"
            />
          }
        />
        {settings.comboStrategy === "round-robin" && (
          <ConfigRow
            label="Combo sticky limit"
            help="Calls sent to one combo model before rotating to the next."
            control={
              <Input
                type="number"
                min="1"
                max="100"
                value={settings.comboStickyRoundRobinLimit || 1}
                onChange={(e) => updateComboStickyLimit(e.target.value)}
                disabled={loading}
                aria-label="Combo sticky limit"
                className="w-20"
                inputClassName="text-center"
              />
            }
          />
        )}
        <ConfigRow
          label="Record request details"
          help="Stores request and response detail for inspection in Logs. Turning it off reduces local retention."
          control={
            <Toggle
              checked={observabilityEnabled}
              onChange={updateObservabilityEnabled}
              disabled={loading}
              ariaLabel="Enable observability"
            />
          }
        />
        <p className="pt-4 text-xs leading-relaxed text-text-muted">
          {settings.fallbackStrategy === "round-robin"
            ? `Distributing requests across all available accounts, ${settings.stickyRoundRobinLimit || 3} calls per account.`
            : "Using accounts in priority order (fill first)."}
          {settings.comboStrategy === "round-robin"
            ? ` Combos rotate after ${settings.comboStickyRoundRobinLimit || 1} call${(settings.comboStickyRoundRobinLimit || 1) === 1 ? "" : "s"} per model.`
            : " Combos always start with their first model."}
        </p>
      </ConfigSection>

      {/* Network */}
      <ConfigSection
        title="Network"
        icon="wifi"
        subtitle="Outbound egress for OAuth handshakes and provider requests."
      >
        <ConfigRow
          label="Outbound proxy"
          help="Route OAuth and provider requests through a proxy. Per-connection proxy pools are configured on the Proxy pools page."
          control={
            <Toggle
              checked={settings.outboundProxyEnabled === true}
              onChange={() => updateOutboundProxyEnabled(!(settings.outboundProxyEnabled === true))}
              disabled={loading || proxyLoading}
              ariaLabel="Enable outbound proxy"
            />
          }
        />

        {settings.outboundProxyEnabled === true && (
          <ConfigRow
            label="Proxy details"
            help="Leave the URL empty to inherit an existing environment proxy."
          >
            <form onSubmit={updateOutboundProxy} className="mt-3 flex flex-col gap-4">
              <Input
                label="Proxy URL"
                placeholder="http://127.0.0.1:7897"
                value={proxyForm.outboundProxyUrl}
                onChange={(e) => setProxyForm((prev) => ({ ...prev, outboundProxyUrl: e.target.value }))}
                disabled={loading || proxyLoading}
                inputClassName="font-mono text-sm"
              />
              <Input
                label="No proxy"
                placeholder="localhost,127.0.0.1"
                value={proxyForm.outboundNoProxy}
                onChange={(e) => setProxyForm((prev) => ({ ...prev, outboundNoProxy: e.target.value }))}
                disabled={loading || proxyLoading}
                hint="Comma-separated hostnames and domains that bypass the proxy."
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={proxyTestLoading}
                  disabled={loading || proxyLoading}
                  onClick={testOutboundProxy}
                >
                  Test proxy URL
                </Button>
                <Button type="submit" variant="primary" size="sm" loading={proxyLoading}>
                  Apply
                </Button>
              </div>
            </form>
          </ConfigRow>
        )}

        {proxyStatus.message && (
          <p
            className={`pt-4 text-[13px] ${proxyStatus.type === "error" ? "text-danger" : "text-success"}`}
          >
            {proxyStatus.message}
          </p>
        )}
      </ConfigSection>

      {/* Backup & restore */}
      <ConfigSection
        title="Backup & restore"
        icon="database"
        subtitle="The whole local database as one JSON file. Both directions ask for your dashboard password first."
      >
        <ConfigRow
          label="Download backup"
          help="Writes a timestamped JSON snapshot of settings, connections and usage to your downloads folder."
          control={
            <Button
              variant="secondary"
              size="sm"
              icon="download"
              onClick={() => setDbAuth({ open: true, mode: "export", password: "" })}
              loading={dbLoading}
            >
              Download
            </Button>
          }
        />
        <ConfigRow
          label="Restore from backup"
          help="Replaces the current database with the contents of a backup file. This cannot be undone."
          control={
            <>
              <Button
                variant="secondary"
                size="sm"
                icon="upload"
                onClick={() => importFileRef.current?.click()}
                disabled={dbLoading}
              >
                Choose file
              </Button>
              <input
                ref={importFileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={handleImportDatabase}
              />
            </>
          }
        />
        {dbStatus.message && (
          <p className={`pt-4 text-[13px] ${dbStatus.type === "error" ? "text-danger" : "text-success"}`}>
            {dbStatus.message}
          </p>
        )}
      </ConfigSection>

      {/* Session */}
      <Card title="Session" icon="power_settings_new" subtitle="Control the local server process and the dashboard session.">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            icon="power_settings_new"
            onClick={() => setShutdownOpen(true)}
            className="text-danger border-danger/35 hover:bg-danger/10"
          >
            Shut down router
          </Button>
          <Button variant="outline" icon="logout" onClick={handleLogout}>
            Log out
          </Button>
        </div>
        <p className="mt-3 text-xs text-text-muted">
          Shutting down stops the routing process on this machine; the dashboard becomes
          unreachable until it is started again.
        </p>
      </Card>

      <LanguageSwitcher
        hideTrigger
        isOpen={langOpen}
        onClose={(next) => {
          setLangOpen(false);
          setLocale(next);
        }}
      />
      <ConfirmModal
        isOpen={shutdownOpen}
        onClose={() => setShutdownOpen(false)}
        onConfirm={handleShutdown}
        title="Close proxy"
        message="Are you sure you want to close the proxy server?"
        confirmText="Close"
        cancelText="Cancel"
        variant="danger"
        loading={isShuttingDown}
      />

      <Modal
        isOpen={dbAuth.open}
        onClose={() => setDbAuth({ open: false, mode: "", password: "" })}
        title="Confirm password"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDbAuth({ open: false, mode: "", password: "" })} disabled={dbLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleDbAuthConfirm} loading={dbLoading} disabled={!dbAuth.password}>
              Confirm
            </Button>
          </>
        }
      >
        <p className="mb-3 text-[13px] text-text-muted">
          Enter your current password to {dbAuth.mode === "export" ? "export" : "import"} the database.
        </p>
        <Input
          type="password"
          value={dbAuth.password}
          onChange={(e) => setDbAuth((s) => ({ ...s, password: e.target.value }))}
          onKeyDown={(e) => { if (e.key === "Enter" && dbAuth.password) handleDbAuthConfirm(); }}
          placeholder="Current password"
          autoFocus
        />
      </Modal>
    </div>
  );
}
