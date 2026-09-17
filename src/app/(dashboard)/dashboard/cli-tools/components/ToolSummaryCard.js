"use client";

import Link from "next/link";
import Image from "next/image";
import { Card } from "@/shared/components";

// Derive simple connected/configured/not-installed status from API payload
function getStatus(status) {
  if (!status) return { label: "Unknown", cls: "bg-gray-500/10 text-gray-500" };
  if (!status.installed) return { label: "Not installed", cls: "bg-gray-500/10 text-gray-500" };
  if (status.has9Router) return { label: "Connected", cls: "bg-green-500/10 text-green-600 dark:text-green-400" };
  return { label: "Not configured", cls: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" };
}

export default function ToolSummaryCard({ toolId, tool, status }) {
  const s = getStatus(status);
  return (
    <Link href={`/dashboard/cli-tools/${toolId}`} className="block">
      <Card padding="sm" className="h-full border border-border-subtle hover:border-primary/40 transition-colors">
        <div className="flex h-full items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-8 flex items-center justify-center shrink-0 rounded border border-border-subtle bg-bg">
              {tool.image ? (
                <Image
                  src={tool.image}
                  alt={tool.name}
                  width={24}
                  height={24}
                  className="size-6 object-contain rounded-xs"
                  sizes="24px"
                  onError={(e) => {
                    e.target.style.display = "none";
                  }}
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <span
                  className="material-symbols-outlined text-[20px]"
                  style={{
                    color: tool.color || "var(--color-primary)",
                  }}
                >
                  {tool.icon || "terminal"}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-medium text-xs sm:text-sm text-text-main truncate">{tool.name}</h3>
              <span className={`inline-block mt-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded ${s.cls}`}>{s.label}</span>
            </div>
          </div>
          <span className="material-symbols-outlined text-text-muted text-[16px] shrink-0">chevron_right</span>
        </div>
      </Card>
    </Link>
  );
}
