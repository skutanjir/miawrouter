"use client";

import PropTypes from "prop-types";
import { Input } from "@/shared/components";

import { Icon } from "@/shared/components/Icon";
/** Reusable endpoint row component formatted as a console instrument row */
export default function EndpointRow({ label, url, copyId, copied, onCopy, badge, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 p-2.5 rounded-xl border border-border-subtle bg-surface-2/40 hover:border-border transition-colors">
      <div className="flex items-center gap-2 shrink-0">
        <span
          className={`text-xs font-mono font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md shrink-0 min-w-[96px] text-center border ${
            badge === "CF" || badge === "TS"
              ? "bg-primary/10 text-primary border-primary/25"
              : "bg-surface text-text-main border-border"
          }`}
        >
          {label}
        </span>
      </div>
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <Input value={url} readOnly className="flex-1 font-mono text-xs sm:text-sm bg-bg" />
        <button
          onClick={() => onCopy(url, copyId)}
          className="p-2 hover:bg-surface rounded-lg border border-border text-text-muted hover:text-primary transition-colors shrink-0 cursor-pointer"
          title="Copy URL"
          aria-label={`Copy ${label} URL`}
        >
          <Icon name={copied === copyId ? "check" : "content_copy"} className=" text-[18px]" />
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
