"use client";

import Link from "next/link";
import Image from "next/image";
import PropTypes from "prop-types";
import { Icon } from "@/shared/components/Icon";

export default function MitmLinkCard({ tool }) {
  return (
    <Link href="/dashboard/mitm" className="group block min-w-0">
      <div className="relative flex flex-col justify-between gap-3.5 rounded-xl border border-border bg-surface p-4 transition-all duration-200 hover:border-border-strong hover:bg-surface-2/60 hover:shadow-elevated min-h-[148px]">
        {/* Top row: Avatar, Info, MITM Pill */}
        <div className="flex items-start justify-between gap-3 min-w-0">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 p-1.5 shadow-2xs transition-transform duration-200 group-hover:scale-105 group-hover:border-primary/30">
              {tool.image ? (
                <Image
                  src={tool.image}
                  alt={tool.name}
                  width={28}
                  height={28}
                  className="size-[28px] rounded-xs object-contain"
                  sizes="28px"
                  onError={(e) => { e.target.style.display = "none"; }}
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <Icon name="security" weight="duotone" className="text-[22px] text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <h3 className="truncate text-[14px] font-bold text-text-main group-hover:text-primary transition-colors">
                  {tool.name}
                </h3>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-mono text-[10.5px] font-medium text-text-muted">
                  TLS MITM Interceptor
                </span>
                <span className="text-[10px] text-text-subtle">·</span>
                <span className="text-[10.5px] text-text-muted">
                  Zero Config
                </span>
              </div>
            </div>
          </div>

          {/* Status pill */}
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10.5px] font-mono text-primary font-semibold">
            <span className="status-dot status-dot-live" />
            <span>Active MITM</span>
          </span>
        </div>

        {/* Middle description */}
        <p className="line-clamp-2 text-xs leading-relaxed text-text-muted min-h-[32px]">
          {tool.description || `Intercept and proxy outbound ${tool.name} telemetry, tool calls, and model requests.`}
        </p>

        {/* Bottom footer: Domain pill + Action button */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border-subtle/70">
          <code className="inline-flex items-center gap-1 font-mono text-[11px] text-text-muted/90 bg-surface-2/80 px-2 py-0.5 rounded border border-border-subtle" title={`Domain: ${tool.mitmDomain || "Transparent Proxy"}`}>
            <Icon name="lock" className="text-[11px] text-primary shrink-0" />
            <span className="truncate max-w-[140px]">{tool.mitmDomain || "Loopback Proxy"}</span>
          </code>

          <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold transition-all px-2.5 py-1 rounded-lg border border-border bg-surface-2 text-text-main group-hover:border-primary/40 group-hover:bg-primary/10 group-hover:text-primary">
            <span>Route MITM</span>
            <Icon name="arrow_forward" className="text-[12px] transition-transform duration-150 group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

MitmLinkCard.propTypes = {
  tool: PropTypes.shape({
    name: PropTypes.string.isRequired,
    image: PropTypes.string,
    description: PropTypes.string,
    mitmDomain: PropTypes.string,
  }).isRequired,
};
