"use client";

import Card from "@/shared/components/Card";
import { cn } from "@/shared/utils/cn";

/**
 * Settings section wrapper: card header (title + optional actions) with a
 * divided list of ConfigRow children.
 */
export function ConfigSection({ id, title, subtitle, icon, action, children, className }) {
  return (
    <Card id={id} title={title} subtitle={subtitle} icon={icon} action={action} className={className}>
      <div className="divide-y divide-border-subtle">{children}</div>
    </Card>
  );
}

/**
 * Two-column settings row on >=640px: label + help text on the left, the
 * control right-aligned. Stacks on narrow screens. `children` renders extra
 * content (forms, detail blocks) below the label column.
 */
export function ConfigRow({
  label,
  help,
  control,
  badge,
  disabled = false,
  className,
  children,
  ...props
}) {
  return (
    <div
      className={cn(
        "grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-6",
        disabled && "opacity-55",
        className
      )}
      {...props}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-text-main">{label}</p>
          {badge}
        </div>
        {help ? <p className="mt-0.5 text-[13px] leading-relaxed text-text-muted">{help}</p> : null}
        {children}
      </div>
      {control ? <div className="flex shrink-0 items-center gap-2 sm:pt-0.5">{control}</div> : null}
    </div>
  );
}

export default ConfigSection;
