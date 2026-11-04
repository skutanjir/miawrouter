"use client";

import { useEffect } from "react";
import { CardSkeleton, Toggle, Badge } from "@/shared/components";
import { FEATURE_FLAGS } from "@/lib/settings/dashboardSettings";
import useSettingsStore from "@/store/settingsStore";
import { useNotificationStore } from "@/store/notificationStore";
import { ConfigSection, ConfigRow } from "../../components/ConfigSection";

import { Icon } from "@/shared/components/Icon";

// Categories for backend flags
const FLAG_CATEGORIES = [
  {
    id: "reasoning-agent",
    title: "Reasoning & agent architecture",
    icon: "psychology",
    keys: ["hermesAutonomyEnabled", "aiMemoryEnabled", "aiMemoryAutoCapture", "antiSlopEnabled"],
  },
  {
    id: "caching-dedup",
    title: "Caching & content deduplication",
    icon: "database",
    keys: ["cacheL2Enabled", "cacheL3Enabled"],
  },
  {
    id: "proxy-transforms",
    title: "Proxy & compression transforms",
    icon: "transform",
    keys: ["headroomEnabled", "pxpipeEnabled"],
  },
];

export default function FeatureFlagsClient() {
  const { settings, loading, fetchSettings, patchSettings } = useSettingsStore();
  const notify = useNotificationStore();

  useEffect(() => {
    fetchSettings({ force: true });
  }, [fetchSettings]);

  const setFlag = async (flag, enabled) => {
    const updated = await patchSettings({ [flag.key]: enabled });
    if (updated) notify.success(`${flag.name} ${enabled ? "enabled" : "disabled"}`);
    else notify.error(`Failed to update ${flag.name}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="workspace-heading">
        <div>
          <h1>Feature flags</h1>
          <p>
            Runtime behavior switches that are not part of the routing tables. Each change is written
            to settings immediately — there is no save step.
          </p>
        </div>
      </div>

      {loading && !settings ? (
        <CardSkeleton />
      ) : (
        <div className="flex flex-col gap-6">
          {FLAG_CATEGORIES.map((category) => {
            const flags = FEATURE_FLAGS.filter((f) => category.keys.includes(f.key));
            if (flags.length === 0) return null;

            return (
              <ConfigSection
                key={category.id}
                title={category.title}
                icon={category.icon}
                subtitle={`${flags.length} flag${flags.length === 1 ? "" : "s"}`}
              >
                {flags.map((flag) => {
                  const enabled = settings?.[flag.key] === true;
                  return (
                    <ConfigRow
                      key={flag.key}
                      label={flag.name}
                      help={flag.description}
                      badge={
                        <Badge variant={enabled ? "success" : "default"} size="sm">
                          {enabled ? "On" : "Off"}
                        </Badge>
                      }
                      control={
                        <Toggle
                          checked={enabled}
                          onChange={(value) => setFlag(flag, value)}
                          disabled={!settings || loading}
                          ariaLabel={`Toggle ${flag.name}`}
                        />
                      }
                    >
                      <code className="mt-1.5 inline-block rounded-md border border-border-subtle bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-text-muted">
                        {flag.key}
                      </code>
                    </ConfigRow>
                  );
                })}
              </ConfigSection>
            );
          })}

          <div className="flex items-start gap-3 rounded-[10px] border border-border-subtle bg-surface-2/40 p-4">
            <Icon name="info" className="mt-0.5 text-[16px] text-text-muted" />
            <p className="text-[13px] leading-relaxed text-text-muted">
              Flags here mirror the same keys the router reads at request time. Caching and transform
              flags can also be changed from the Cache and Token saver pages — the value is shared.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
