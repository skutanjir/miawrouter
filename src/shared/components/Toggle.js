"use client";

import { useId } from "react";
import { cn } from "@/shared/utils/cn";

export default function Toggle({
  checked = false,
  onChange,
  label,
  description,
  disabled = false,
  size = "md",
  className,
  title,
  ariaLabel,
  ariaLabelledby,
  ariaDescribedby,
}) {
  const sizes = {
    sm: { track: "w-8 h-[18px]", thumb: "size-3.5", translate: "translate-x-[14px]" },
    md: { track: "w-8 h-[18px]", thumb: "size-3.5", translate: "translate-x-[14px]" },
    lg: { track: "w-9 h-5", thumb: "size-4", translate: "translate-x-4" },
  };

  const autoId = useId();
  const generatedLabelId = `${autoId}-label`;
  const generatedDescId = `${autoId}-desc`;
  const labelledby = ariaLabelledby || (label ? generatedLabelId : undefined);
  const describedby = ariaDescribedby || (description ? generatedDescId : undefined);
  const labelSpanId = !ariaLabelledby && label ? generatedLabelId : undefined;
  const descSpanId = !ariaDescribedby && description ? generatedDescId : undefined;

  const handleClick = () => {
    if (!disabled && onChange) onChange(!checked);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        aria-labelledby={labelledby}
        aria-describedby={describedby}
        title={title}
        disabled={disabled}
        onClick={handleClick}
        className={cn(
          "relative inline-flex shrink-0 cursor-pointer rounded-full",
          "transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          checked ? "bg-primary" : "bg-surface-2 border border-border",
          sizes[size] || sizes.md,
          disabled && "cursor-not-allowed"
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block rounded-full shadow-2xs",
            checked ? "bg-bg" : "bg-text-muted",
            "transition-transform duration-150",
            checked ? sizes[size].translate : "translate-x-0.5",
            sizes[size].thumb
          )}
        />
      </button>
      {(label || description) && (
        <div className="flex flex-col">
          {label && (
            <span id={labelSpanId} className="text-sm font-medium text-text-main">{label}</span>
          )}
          {description && (
            <span id={descSpanId} className="text-xs text-text-muted">{description}</span>
          )}
        </div>
      )}
    </div>
  );
}
