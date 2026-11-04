"use client";

import { useTheme } from "@/shared/hooks/useTheme";
import { cn } from "@/shared/utils/cn";

import { Icon } from "@/shared/components/Icon";
export default function ThemeToggle({ className, variant = "default" }) {
  const { isDark, toggleTheme } = useTheme();

  const variants = {
    default: cn(
      "inline-flex items-center justify-center size-8 rounded-md",
      "text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors"
    ),
    card: cn(
      "inline-flex items-center justify-center size-8 rounded-md",
      "bg-surface border border-border text-text-muted hover:text-primary",
      "transition-colors"
    ),
  };

  return (
    <button
      onClick={toggleTheme}
      className={cn(variants[variant], className)}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      <Icon name={isDark ? "light_mode" : "dark_mode"} className={cn("text-[18px]", variant === "card" && "transition-transform duration-150 group-hover:rotate-12")} />
    </button>
  );
}
