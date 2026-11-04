"use client";

import { cn } from "@/shared/utils/cn";
import { Icon } from "@/shared/components/Icon";

const variants = {
  default: "bg-surface border-border",
  metric: "bg-surface border-border",
  section: "bg-surface border-border",
  interactive: "bg-surface border-border hover:border-primary/45 focus-within:border-primary",
  danger: "bg-surface border-danger/35",
};

export default function Card({
  children,
  title,
  subtitle,
  icon,
  action,
  padding = "md",
  hover = false,
  elev = false,
  variant = "default",
  className,
  ...props
}) {
  const paddings = {
    none: "",
    xs: "p-3",
    sm: "p-4",
    md: "p-5",
    lg: "p-6",
  };

  return (
    <div
      className={cn(
        "ui-card",
        "border rounded-xl",
        variants[variant] || variants.default,
        elev ? "shadow-elev" : "shadow-soft",
        (hover || variant === "interactive") && "transition-all duration-150",
        hover && "hover:border-primary/45 hover:shadow-warm",
        paddings[padding],
        className
      )}
      data-variant={variant}
      {...props}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            {icon && (
              <div className="icon-box text-primary shrink-0">
                <Icon name={icon} weight="duotone" className="text-[18px]" />
              </div>
            )}
            <div className="min-w-0">
              {title && (
                <h3 className="ui-card-title text-text-main font-semibold text-[15px] tracking-tight leading-snug">{title}</h3>
              )}
              {subtitle && (
                <p className="text-[12.5px] text-text-muted mt-0.5 leading-relaxed">{subtitle}</p>
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
        "p-3.5 rounded-lg",
        "bg-surface-2/80 border border-border-subtle",
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
        "hover:bg-surface-2/60",
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
        "hover:bg-surface-2/60 transition-colors",
        className
      )}
      {...props}
    >
      <div className="flex-1 min-w-0">{children}</div>
      {actions && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
          {actions}
        </div>
      )}
    </div>
  );
};
