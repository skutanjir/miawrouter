"use client";

import { cn } from "@/shared/utils/cn";

export default function Card({
  children,
  title,
  subtitle,
  icon,
  action,
  padding = "md",
  hover = false,
  elev = false,
  className,
  ...props
}) {
  const paddings = {
    none: "",
    xs: "p-3",
    sm: "p-3.5",
    md: "p-5",
    lg: "p-7",
  };

  return (
    <div
      className={cn(
        "bg-surface border border-border-subtle",
        elev ? "rounded-[var(--radius-brand-lg)] shadow-[var(--shadow-elev)]" : "rounded-[var(--radius-brand)] shadow-[var(--shadow-soft)]",
        hover && "hover:border-primary/40 transition-colors",
        paddings[padding],
        className
      )}
      {...props}
    >
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            {icon && (
              <div className="size-7 rounded flex items-center justify-center bg-bg border border-border-subtle text-text-muted shrink-0">
                <span className="material-symbols-outlined text-[17px]">{icon}</span>
              </div>
            )}
            <div>
              {title && (
                <h3 className="text-text-main font-semibold text-sm tracking-tight">{title}</h3>
              )}
              {subtitle && (
                <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>
              )}
            </div>
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

Card.Section = function CardSection({ children, className, ...props }) {
  return (
    <div
      className={cn(
        "p-3.5 rounded-[var(--radius-brand)]",
        "bg-bg border border-border-subtle",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

Card.Row = function CardRow({ children, className, ...props }) {
  return (
    <div
      className={cn(
        "p-2.5 -mx-2.5 px-2.5 transition-colors",
        "border-b border-border-subtle last:border-b-0",
        "hover:bg-bg-alt/60",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

Card.ListItem = function CardListItem({
  children,
  actions,
  className,
  ...props
}) {
  return (
    <div
      className={cn(
        "group flex items-center justify-between p-2.5 -mx-2.5 px-2.5",
        "border-b border-border-subtle last:border-b-0",
        "hover:bg-bg-alt/60 transition-colors",
        className
      )}
      {...props}
    >
      <div className="flex-1 min-w-0">{children}</div>
      {actions && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {actions}
        </div>
      )}
    </div>
  );
};
