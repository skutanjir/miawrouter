"use client";

import { Icon } from "@/shared/components/Icon";

/** Inline tooltip, Claude Code CLI style */
export default function Tooltip({ text }) {
  return (
    <span className="relative group inline-flex items-center">
      <Icon name={"help"} className=" text-[14px] text-text-muted cursor-help" />
      <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 z-50 w-64 rounded-md bg-surface-2 text-text-main text-xs px-2.5 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-elevated border border-border">
        {text}
      </span>
    </span>
  );
}
