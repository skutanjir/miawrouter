/**
 * AddMemoryModal — form modal for creating a new memory entry.
 *
 * Uses the project's Modal, Input, Button, and Badge components.
 * Sends `content` (not `text`) to match the backend contract.
 */

"use client";

import { useState } from "react";
import { Button, Modal } from "@/shared/components";
import { Icon } from "@/shared/components/Icon";

export default function AddMemoryModal({ isOpen, onClose, onAdd, loading }) {
  const [content, setContent] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState([]);
  const [error, setError] = useState("");

  const reset = () => {
    setContent("");
    setTagInput("");
    setTags([]);
    setError("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags((prev) => [...prev, tag]);
    }
    setTagInput("");
  };

  const removeTag = (tag) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleTagKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  };

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed) {
      setError("Content cannot be empty");
      return;
    }

    const metadata = {};
    if (tags.length > 0) {
      metadata.tags = tags;
    }

    const result = await onAdd({ content: trimmed, metadata });
    if (result?.ok) {
      handleClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Memory"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={loading}
            icon="add"
          >
            Add Memory
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 font-sans text-xs">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-text-main">
            Content <span className="text-danger ml-0.5">*</span>
          </label>
          <textarea
            placeholder="Enter memory text, preference, or context snippet…"
            value={content}
            onChange={(e) => { setContent(e.target.value); if (error) setError(""); }}
            rows={4}
            className="w-full py-2 px-3 text-xs text-text-main bg-surface-2 rounded-md border border-border placeholder:text-text-muted outline-none focus:border-primary transition-colors resize-y"
          />
          {error && (
            <p className="text-xs text-danger flex items-center gap-1">
              <Icon name="error" className="text-[14px]" />
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-text-main">Tags</label>
          <div className="flex flex-wrap items-center gap-1.5 p-2 min-h-[38px] bg-surface-2 rounded-md border border-border focus-within:border-primary transition-colors">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-medium rounded bg-primary/10 text-primary border border-primary/20"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="hover:opacity-70 transition-opacity cursor-pointer"
                  aria-label={`Remove tag ${tag}`}
                >
                  <Icon name="close" className="text-[12px]" />
                </button>
              </span>
            ))}
            <input
              type="text"
              placeholder={tags.length === 0 ? "Add tags (press Enter or comma)…" : ""}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={addTag}
              className="flex-1 min-w-[120px] bg-transparent text-xs text-text-main placeholder:text-text-muted outline-none"
            />
          </div>
          <p className="text-[11px] text-text-muted">
            Press Enter or comma to add a tag. Stored in memory metadata.
          </p>
        </div>
      </div>
    </Modal>
  );
}
