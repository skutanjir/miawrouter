"use client";

import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { marked } from "marked";
import { GITHUB_CONFIG } from "@/shared/constants/config";
import Modal from "./Modal";
import Button from "./Button";

import { Icon } from "@/shared/components/Icon";
marked.setOptions({ gfm: true, breaks: true });

export default function ChangelogModal({ isOpen, onClose }) {
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadChangelog = useCallback(() => {
    setLoading(true);
    setError("");
    fetch(GITHUB_CONFIG.changelogUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((md) => setHtml(marked.parse(md)))
      .catch((err) => setError(err.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isOpen || html) return;
    loadChangelog();
  }, [isOpen, html, loadChangelog]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Change Log" size="full">
      {loading && (
        <div className="flex items-center gap-2 py-10 text-sm text-text-muted">
          <Icon name="progress_activity" className="animate-spin text-[18px]" />
          Loading the release notes from GitHub…
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-col gap-3 rounded-[10px] border border-danger/20 bg-danger/10 p-4">
          <div className="flex items-start gap-2.5">
            <Icon name="error" className="mt-0.5 text-[18px] text-danger shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-text-main">Couldn&apos;t load the changelog</p>
              <p className="mt-1 text-text-muted">
                {GITHUB_CONFIG.changelogUrl} responded with {error}. Check your network connection or GitHub
                availability, then try again.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" icon="refresh" onClick={loadChangelog} className="self-start">
            Try again
          </Button>
        </div>
      )}

      {!loading && !error && html && (
        <div className="changelog-body text-text-main" dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </Modal>
  );
}

ChangelogModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};
