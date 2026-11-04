"use client";

import { CAPACITY_META } from "@/shared/constants/models";
import Tooltip from "./Tooltip";

import { Icon } from "@/shared/components/Icon";
// Render small icon badges for a model's capabilities (only those set true).
// colorOverride: force a single color class for all badges (default: muted).
// size: icon font-size in px (default 16).
export default function CapacityBadges({ caps, className = "", colorOverride, size = 16 }) {
  if (!caps) return null;
  const active = Object.keys(CAPACITY_META).filter((k) => caps[k]);
  if (active.length === 0) return null;

  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {active.map((k) => (
        <Tooltip key={k} text={`${CAPACITY_META[k].label} · ${CAPACITY_META[k].desc}`}>
          <Icon name={CAPACITY_META[k].icon} className={`leading-none cursor-help ${colorOverride || "text-text-muted"}`} style={{ fontSize: `${size}px` }} />
        </Tooltip>
      ))}
    </span>
  );
}
