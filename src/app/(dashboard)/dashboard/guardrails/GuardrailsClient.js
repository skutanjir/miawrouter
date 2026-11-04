"use client";

import { useEffect } from "react";
import { Badge, Card, CardSkeleton, Icon, Toggle } from "@/shared/components";
import { GUARDRAILS } from "@/lib/settings/dashboardSettings";
import useSettingsStore from "@/store/settingsStore";
import { useNotificationStore } from "@/store/notificationStore";
import { ConfigSection, ConfigRow } from "../components/ConfigSection";

export default function GuardrailsClient() {
  const { settings, loading, error, fetchSettings, patchSettings } = useSettingsStore();
  const notify = useNotificationStore();

  useEffect(() => {
    fetchSettings({ force: true });
  }, [fetchSettings]);

  const setGuardrail = async (guardrail, enabled) => {
    const updated = await patchSettings({ [guardrail.settingKey]: enabled });
    if (updated) notify.success(`${guardrail.name} ${enabled ? "enabled" : "disabled"}`);
    else notify.error(`Failed to update ${guardrail.name}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="workspace-heading">
        <div>
          <h1>Guardrails</h1>
          <p>
            Access and network protections this instance enforces. Toggles change the configured
            ones; built-in protections are always on and cannot be switched off here.
          </p>
        </div>
      </div>

      {loading && !settings ? (
        <CardSkeleton />
      ) : error && !settings ? (
        <Card padding="lg">
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <Icon name="error" className="text-[24px] text-danger" />
            <p className="text-[13px] text-text-muted">
              Could not load guardrail settings — {error}
            </p>
            <p className="text-xs text-text-muted">
              Nothing is mis-configured by this page; the settings endpoint did not answer.
            </p>
            <button
              type="button"
              onClick={() => fetchSettings({ force: true })}
              className="mt-1 rounded-md border border-border px-3 py-1 text-xs font-medium text-text-main transition-colors hover:bg-surface-2"
            >
              Retry
            </button>
          </div>
        </Card>
      ) : (
        <ConfigSection
          title="Active protections"
          icon="security"
          subtitle="Configurable controls and built-in request boundaries."
        >
          {GUARDRAILS.map((guardrail) => {
            const configurable = Boolean(guardrail.settingKey);
            const enabled = configurable ? settings?.[guardrail.settingKey] === true : guardrail.enforced;
            const locked = guardrail.settingKey === "requireApiKey" && settings?.requireApiKeyLocked === true;

            return (
              <ConfigRow
                key={guardrail.id}
                label={guardrail.name}
                help={guardrail.description}
                badge={
                  <>
                    <Badge variant={enabled ? "success" : "warning"} size="sm" dot>
                      {enabled ? "Enforced" : "Disabled"}
                    </Badge>
                    {locked && <Badge size="sm">Environment locked</Badge>}
                    {!configurable && <Badge size="sm">Built-in</Badge>}
                  </>
                }
                control={
                  configurable ? (
                    <Toggle
                      checked={enabled}
                      onChange={(value) => setGuardrail(guardrail, value)}
                      disabled={!settings || loading || locked}
                      ariaLabel={`Toggle ${guardrail.name}`}
                    />
                  ) : (
                    <span className="text-xs text-text-muted">Always on</span>
                  )
                }
              />
            );
          })}
        </ConfigSection>
      )}
    </div>
  );
}
