"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import {
  SKILLS,
  SKILLS_REPO_URL,
  getSkillRawUrl,
  getSkillBlobUrl,
} from "@/shared/constants/skills";
import { Icon } from "@/shared/components/Icon";

function CopyButton({ value, label = "Copy Link" }) {
  const { copied, copy } = useCopyToClipboard(2000);
  return (
    <button
      type="button"
      onClick={() => copy(value)}
      className="px-2.5 py-1 rounded-md border border-border bg-surface text-text-main text-xs font-medium hover:bg-surface-2 transition-colors cursor-pointer shrink-0 inline-flex items-center gap-1.5"
      title={value}
    >
      <Icon name={copied ? "check" : "content_copy"} className="text-[12px] text-text-muted" />
      <span>{copied ? "Copied" : label}</span>
    </button>
  );
}

export default function SkillsPage() {
  const [search, setSearch] = useState("");

  const filteredSkills = useMemo(() => {
    if (!search.trim()) return SKILLS;
    const q = search.toLowerCase();
    return SKILLS.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q))
    );
  }, [search]);

  return (
    <div className="flex min-w-0 flex-col gap-6 px-1 sm:px-0 font-sans">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2.5 leading-tight text-text-main">
            <Icon name="extension" className="text-primary text-[24px]" />
            Agent Skills
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            Agent capabilities, routing prompts, and system instructions for AI coding assistants.
          </p>
        </div>
        <a
          href={`${SKILLS_REPO_URL}/skills`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-surface text-xs font-semibold text-text-main hover:bg-surface-2 transition-colors"
        >
          <Icon name="open_in_new" className="text-[14px] text-text-muted" />
          GitHub Repository
        </a>
      </div>

      {/* ── Quick Instruction Banner ─────────────────────────────── */}
      <div className="p-3.5 rounded-[10px] border border-border bg-surface flex flex-col gap-2">
        <span className="text-xs font-semibold text-text-main">System Prompt Quick-Inject:</span>
        <div className="flex items-center justify-between gap-2 p-2.5 rounded-md bg-surface-2 border border-border-subtle font-mono text-xs">
          <code className="truncate text-text-main">
            Read this skill and use it: {getSkillRawUrl("miawrouter")}
          </code>
          <CopyButton value={`Read this skill and use it: ${getSkillRawUrl("miawrouter")}`} label="Copy Snippet" />
        </div>
      </div>

      {/* ── Toolbar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 max-w-sm">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-surface text-xs">
            <Icon name="search" className="text-text-muted text-[16px] shrink-0" />
            <input
              type="text"
              placeholder="Filter skills by keyword…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-text-main outline-none placeholder:text-text-muted text-xs font-sans"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="text-text-muted hover:text-text-main cursor-pointer">
                <Icon name="close" className="text-[14px]" />
              </button>
            )}
          </div>
        </div>

        <span className="text-xs font-mono text-text-muted">
          {filteredSkills.length} of {SKILLS.length} skills
        </span>
      </div>

      {/* ── Dense Catalog List ───────────────────────────────────── */}
      <div className="rounded-[10px] border border-border bg-surface overflow-hidden divide-y divide-border-subtle">
        {filteredSkills.map((skill) => {
          const url = getSkillRawUrl(skill.id);
          const isEntry = skill.isEntry;

          return (
            <div
              key={skill.id}
              className={`flex items-start justify-between gap-4 p-4 transition-colors ${
                isEntry ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-surface-2/60"
              }`}
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div
                  className={`size-8 rounded-md flex items-center justify-center shrink-0 mt-0.5 border ${
                    isEntry
                      ? "bg-primary text-bg border-primary"
                      : "bg-surface-2 text-text-muted border-border-subtle"
                  }`}
                >
                  <Icon name={skill.icon || "extension"} className="text-[16px]" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xs font-semibold text-text-main">{skill.name}</h2>
                    {isEntry && (
                      <Badge variant="primary" size="sm">
                        Recommended Entry
                      </Badge>
                    )}
                    {skill.endpoint && (
                      <code className="text-[10px] font-mono text-text-muted px-1.5 py-0.5 rounded bg-surface-2 border border-border-subtle">
                        {skill.endpoint}
                      </code>
                    )}
                  </div>

                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    {skill.description}
                  </p>

                  <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[11px]">
                    <a
                      href={getSkillBlobUrl(skill.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-text-muted hover:text-primary transition-colors inline-flex items-center gap-1 truncate max-w-sm"
                    >
                      <span>{url}</span>
                      <Icon name="open_in_new" className="text-[11px] shrink-0" />
                    </a>
                  </div>
                </div>
              </div>

              <div className="shrink-0 pt-0.5">
                <CopyButton value={url} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
