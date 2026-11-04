"use client";

import { cn } from "@/shared/utils/cn";
import { Icon } from "@/shared/components/Icon";

const variants = {
  default: "bg-surface-2 text-text-muted border border-border-subtle",
  neutral: "bg-surface-2 text-text-muted border border-border-subtle",
  primary: "bg-primary/10 text-primary border border-primary/20",
  success: "bg-success/10 text-success border border-success/20",
  warning: "bg-warning/10 text-warning border border-warning/25",
  danger: "bg-danger/10 text-danger border border-danger/20",
  error: "bg-danger/10 text-danger border border-danger/20",
  info: "bg-primary/10 text-primary border border-primary/20",
};

const sizes = {
  xs: "px-2 py-0.5 text-[11px]",
  sm: "px-2.5 py-0.5 text-xs",
  md: "px-2.5 py-0.5 text-xs",
  lg: "px-3 py-1 text-sm",
};

export default function Badge({
  children,
  variant = "default",
  size = "md",
  dot = false,
  icon,
  className,
}) {
  return (
    <span
      className={cn(
        "ui-badge",
        "inline-flex items-center gap-1.5 rounded-full font-semibold",
        variants[variant] || variants.default,
        sizes[size] || sizes.md,
        className
      )}
      data-variant={variant}
    >
      {dot && (
        <span
          className={cn(
            "size-1.5 rounded-full shrink-0",
            variant === "success" && "bg-success",
            variant === "warning" && "bg-warning",
            (variant === "danger" || variant === "error") && "bg-danger",
            variant === "info" && "bg-primary",
            variant === "primary" && "bg-primary",
            (variant === "default" || variant === "neutral") && "bg-text-subtle"
          )}
        />
      )}
      {icon && <Icon name={icon} className="text-[13.5px] shrink-0" />}
      {children}
    </span>
  );
}
