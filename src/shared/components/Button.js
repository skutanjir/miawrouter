"use client";

import { cn } from "@/shared/utils/cn";
import { Icon } from "@/shared/components/Icon";

const variants = {
  primary: "bg-primary text-bg font-semibold hover:bg-primary-hover shadow-xs disabled:bg-surface-2 disabled:text-text-muted",
  secondary: "border border-border bg-surface-2/80 text-text-main hover:bg-surface-3 hover:border-border shadow-2xs",
  outline: "border border-border bg-transparent text-text-main hover:bg-surface-2",
  ghost: "text-text-muted hover:bg-surface-2 hover:text-text-main",
  danger: "bg-danger text-white hover:bg-danger/90 shadow-xs disabled:bg-surface-2 disabled:text-text-muted",
  success: "bg-success text-bg font-semibold hover:bg-success/90 shadow-xs disabled:bg-surface-2 disabled:text-text-muted",
};

const sizes = {
  sm: "h-7.5 px-2.5 text-xs rounded-lg",
  md: "h-9 px-3.5 text-[13.5px] rounded-lg",
  lg: "h-10.5 px-4.5 text-sm rounded-lg",
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  disabled = false,
  loading = false,
  fullWidth = false,
  className,
  ...props
}) {
  return (
    <button
      className={cn(
        "ui-button",
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant] || variants.primary,
        sizes[size],
        fullWidth && "w-full",
        className
      )}
      disabled={disabled || loading}
      data-variant={variant}
      {...props}
    >
      {loading ? (
        <Icon name={"progress_activity"} className="animate-spin text-[17px]" />
      ) : icon ? (
        <Icon name={icon} className="text-[17px]" />
      ) : null}
      {children}
      {iconRight && !loading && (
        <Icon name={iconRight} className="text-[17px]" />
      )}
    </button>
  );
}
