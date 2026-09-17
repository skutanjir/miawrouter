"use client";

import Link from "next/link";
import Image from "next/image";
import PropTypes from "prop-types";
import { cn } from "@/shared/utils/cn";

/**
 * Clickable card for MITM tools — navigates to /dashboard/mitm on click.
 */
export default function MitmLinkCard({ tool }) {
  return (
    <Link href="/dashboard/mitm" className="group block min-w-0">
      <div
        className={cn(
          "relative flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface px-3 py-2.5 transition-all duration-150 cursor-pointer overflow-hidden",
          "hover:border-border hover:bg-surface-2/60"
        )}
      >
        <span
          className="absolute inset-y-0 left-0 w-[3px] bg-primary transition-colors"
          aria-hidden="true"
        />
        <div className="flex min-w-0 items-center gap-2.5 pl-1.5 flex-1">
          <div className="size-8 shrink-0 rounded-md flex items-center justify-center border border-border-subtle/50 bg-bg">
            {tool.image ? (
              <Image
                src={tool.image}
                alt={tool.name}
                width={22}
                height={22}
                className="size-[22px] object-contain rounded-xs"
                sizes="22px"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
                loading="lazy"
                decoding="async"
              />
            ) : (
              <span
                className="material-symbols-outlined text-[18px] text-primary"
              >
                security
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="truncate text-xs sm:text-sm font-semibold text-text-main group-hover:text-primary transition-colors leading-tight">
                {tool.name}
              </h3>
              <span className="shrink-0 text-[10px] font-mono font-medium uppercase tracking-wider text-primary px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20">
                MITM
              </span>
            </div>
            <p className="text-[11px] text-text-muted truncate mt-0.5">
              {tool.description || "Intercept and proxy tool requests"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center pl-1 text-text-muted group-hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        </div>
      </div>
    </Link>
  );
}

MitmLinkCard.propTypes = {
  tool: PropTypes.shape({
    name: PropTypes.string,
    image: PropTypes.string,
    description: PropTypes.string,
  }).isRequired,
};
