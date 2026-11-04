"use client";

import PropTypes from "prop-types";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { Icon } from "@/shared/components/Icon";

export function StatusRow({ children, className = "", ...props }) {
  return (
    <div className={`flex items-center gap-2 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function ConfigBlock({ label = "Configuration", value, children, className = "" }) {
  const { copied, copy } = useCopyToClipboard();
  return (
    <section className={`min-w-0 rounded-md border border-border-subtle bg-surface-2 ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-3 py-2">
        <h4 className="text-xs font-medium text-text-muted">{label}</h4>
        {typeof value === "string" && (
          <button type="button" onClick={() => copy(value, "tool-config")} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted transition-colors hover:bg-surface hover:text-text-main" aria-label={`Copy ${label}`}>
            <Icon name={copied === "tool-config" ? "check" : "content_copy"} className="text-[14px]" />
            {copied === "tool-config" ? "Copied" : "Copy"}
          </button>
        )}
      </div>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words px-3 py-3 text-xs font-mono text-text-main">{children ?? value}</pre>
    </section>
  );
}

export function ActionsBar({ children, className = "" }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3 ${className}`}>
      {children}
    </div>
  );
}

StatusRow.propTypes = { children: PropTypes.node, className: PropTypes.string };
ConfigBlock.propTypes = { label: PropTypes.string, value: PropTypes.string, children: PropTypes.node, className: PropTypes.string };
ActionsBar.propTypes = { children: PropTypes.node, className: PropTypes.string };
