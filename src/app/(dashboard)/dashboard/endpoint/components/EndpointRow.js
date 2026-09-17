"use client";

import PropTypes from "prop-types";
import { Input } from "@/shared/components";

/** Reusable endpoint row component formatted as a console instrument row */
export default function EndpointRow({ label, url, copyId, copied, onCopy, badge, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 rounded-lg border border-border-subtle bg-surface hover:bg-surface-2/40 transition-colors">
      <div className="flex items-center gap-2 shrink-0">
        <span
          className={`text-xs font-mono font-medium uppercase tracking-wider px-2 py-1 rounded shrink-0 min-w-[88px] text-center border ${
            badge === "CF" || badge === "TS"
              ? "bg-primary/10 text-primary border-primary/20"
              : "bg-surface-2 text-text-muted border-border-subtle"
          }`}
        >
          {label}
        </span>
      </div>
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <Input value={url} readOnly className="flex-1 font-mono text-xs sm:text-sm bg-bg" />
        <button
          onClick={() => onCopy(url, copyId)}
          className="p-2 hover:bg-surface-2 rounded-md border border-border-subtle text-text-muted hover:text-primary transition-colors shrink-0 cursor-pointer"
          title="Copy URL"
          aria-label={`Copy ${label} URL`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {copied === copyId ? "check" : "content_copy"}
          </span>
        </button>
        {actions}
      </div>
    </div>
  );
}

EndpointRow.propTypes = {
  label: PropTypes.string.isRequired,
  url: PropTypes.string.isRequired,
  copyId: PropTypes.string.isRequired,
  copied: PropTypes.string,
  onCopy: PropTypes.func.isRequired,
  badge: PropTypes.string,
  actions: PropTypes.node,
};
