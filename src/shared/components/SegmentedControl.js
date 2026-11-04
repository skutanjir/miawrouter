"use client";

import { cn } from "@/shared/utils/cn";
import { Icon } from "@/shared/components/Icon";

export default function SegmentedControl({
  options = [],
  value,
  onChange,
  size = "md",
  ariaLabel,
  className,
}) {
  const sizes = {
    sm: "h-7 text-xs",
    md: "h-8 text-xs sm:text-[13px]",
    lg: "h-10 text-sm",
  };

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "ui-segmented-control",
        "inline-flex items-center p-1 rounded-lg overflow-x-auto gap-0.5",
        "bg-surface-2 border border-border",
        className
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "inline-flex items-center justify-center shrink-0 px-3 rounded-md font-medium transition-all duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            sizes[size],
            value === option.value
              ? "bg-surface text-primary font-semibold border border-border-subtle shadow-2xs"
              : "border border-transparent text-text-muted hover:text-text-main"
          )}
        >
          {option.icon && (
            <Icon name={option.icon} className="text-[15px] mr-1.5 shrink-0" aria-hidden="true" />
          )}
          {option.label}
        </button>
      ))}
    </div>
  );
}
