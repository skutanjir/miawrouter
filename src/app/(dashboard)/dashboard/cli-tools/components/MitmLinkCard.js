"use client";

import Link from "next/link";
import { Card } from "@/shared/components";
import Image from "next/image";

/**
 * Clickable card for MITM tools — navigates to /dashboard/mitm on click.
 */
export default function MitmLinkCard({ tool }) {
  return (
    <Link href="/dashboard/mitm" className="block">
      <Card padding="sm" className="border border-border-subtle hover:border-primary/40 transition-colors">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-8 flex items-center justify-center shrink-0 rounded border border-border-subtle bg-bg">
              {tool.image ? (
                <Image
                  src={tool.image}
                  alt={tool.name}
                  width={24}
                  height={24}
                  className="size-6 object-contain rounded-xs"
                  sizes="24px"
                  onError={(e) => {
                    e.target.style.display = "none";
                  }}
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <span
                  className="material-symbols-outlined text-[20px]"
                  style={{
                    color: tool.color || "var(--color-primary)",
                  }}
                >
                  security
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-medium text-xs sm:text-sm text-text-main truncate">{tool.name}</h3>
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary rounded">MITM</span>
              </div>
              <p className="text-[11px] text-text-muted truncate">{tool.description}</p>
            </div>
          </div>
          <span className="material-symbols-outlined text-text-muted text-[16px] shrink-0">chevron_right</span>
        </div>
      </Card>
    </Link>
  );
}
