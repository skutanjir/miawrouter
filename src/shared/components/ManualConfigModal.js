"use client";

import { useState } from "react";
import Modal from "./Modal";
import Button from "./Button";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";

import { Icon } from "@/shared/components/Icon";
export default function ManualConfigModal({ isOpen, onClose, title = "Manual Configuration", configs = [] }) {
  const { copy } = useCopyToClipboard();
  const [copiedIndex, setCopiedIndex] = useState(null);

  const copyConfig = (text, index) => {
    copy(text, `manualconfig-${index}`);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="xl">
      <div className="flex flex-col gap-5">
        {configs.length === 0 && (
          <div className="flex items-start gap-3 rounded-[10px] border border-border bg-surface-2 p-4">
            <Icon name="info" className="text-[20px] text-text-muted shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-text-main">No config files to copy</p>
              <p className="mt-1 text-text-muted">
                Pick a base URL and at least one model in the tool card first, then reopen this dialog.
              </p>
            </div>
          </div>
        )}

        {configs.map((config, index) => (
          <section key={index} className="flex flex-col gap-2">
            <header className="flex items-center justify-between gap-3">
              <span className="font-mono text-[13px] text-text-main truncate">{config.filename}</span>
              <Button
                variant="ghost"
                size="sm"
                icon={copiedIndex === index ? "check" : "content_copy"}
                onClick={() => copyConfig(config.content, index)}
              >
                {copiedIndex === index ? "Copied" : "Copy"}
              </Button>
            </header>
            <pre className="max-h-60 overflow-auto custom-scrollbar whitespace-pre-wrap break-all rounded-[10px] border border-border bg-surface-2 p-3 font-mono text-xs leading-relaxed text-text-main">
              {config.content}
            </pre>
          </section>
        ))}
      </div>
    </Modal>
  );
}
