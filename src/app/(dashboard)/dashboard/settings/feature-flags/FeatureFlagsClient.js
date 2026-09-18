"use client";

import { useEffect } from "react";
import { Card, CardSkeleton, Toggle } from "@/shared/components";
import { FEATURE_FLAGS } from "@/lib/settings/dashboardSettings";
import useSettingsStore from "@/store/settingsStore";
import { useNotificationStore } from "@/store/notificationStore";

// Categories for backend flags
const FLAG_CATEGORIES = [
  {
    id: "reasoning-agent",
    title: "Reasoning & Agent Architecture",
    icon: "psychology",
    keys: ["hermesAutonomyEnabled", "aiMemoryEnabled", "aiMemoryAutoCapture", "antiSlopEnabled"],
  },
  {
    id: "caching-dedup",
    title: "Caching & Content Deduplication",
    icon: "database",
    keys: ["cacheL2Enabled", "cacheL3Enabled"],
  },
  {
    id: "proxy-transforms",
    title: "Proxy & Compression Transforms",
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
    <div className="flex min-w-0 flex-col gap-6 px-1 sm:px-0">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg sm:text-xl font-semibold flex items-center gap-2 leading-tight">
          <span className="material-symbols-outlined text-primary">flag</span>
          Feature Flags
        </h1>
        <p className="text-sm text-text-muted">
          Configure experimental and advanced runtime behaviors. Changes persist immediately in MiawRouter settings.
        </p>
      </div>

      {loading && !settings ? (
        <CardSkeleton />
      ) : (
        <div className="flex flex-col gap-6">
          {FLAG_CATEGORIES.map((category) => {
            const flags = FEATURE_FLAGS.filter((f) => category.keys.includes(f.key));
            if (flags.length === 0) return null;

            return (
              <Card
                key={category.id}
                title={category.title}
                icon={category.icon}
                padding="sm"
              >
                <div className="divide-y divide-border-subtle">
                  {flags.map((flag) => (
                    <div
                      key={flag.key}
                      className="flex items-start justify-between gap-4 py-3.5 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-xs sm:text-sm text-text-main">
                          {flag.name}
                        </p>
                        <p className="mt-0.5 text-xs text-text-muted leading-relaxed">
                          {flag.description}
                        </p>
                        <code className="mt-1 inline-block font-mono text-[10px] text-text-muted bg-surface-2 px-1.5 py-0.5 rounded border border-border-subtle">
                          {flag.key}
                        </code>
                      </div>
                      <div className="shrink-0 pt-0.5">
                        <Toggle
                          checked={settings?.[flag.key] === true}
                          onChange={(enabled) => setFlag(flag, enabled)}
                          disabled={!settings || loading}
                          ariaLabel={`Toggle ${flag.name}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
