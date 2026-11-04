"use client";

import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { GITHUB_CONFIG } from "@/shared/constants/config";
import Modal from "./Modal";
import Button from "./Button";

import { Icon } from "@/shared/components/Icon";
export default function DonateModal({ isOpen, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadDonateInfo = useCallback(() => {
    setLoading(true);
    setError("");
    fetch(GITHUB_CONFIG.donateUrl, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => setData(json))
      .catch((err) => setError(err.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isOpen || data) return;
    loadDonateInfo();
  }, [isOpen, data, loadDonateInfo]);

  const channels = data?.channels || [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={data?.title || "Support MiawRouter"} size="full">
      {loading && (
        <div className="flex items-center gap-2 py-10 text-sm text-text-muted">
          <Icon name="progress_activity" className="animate-spin text-[18px]" />
          Loading donation channels…
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-col gap-3 rounded-[10px] border border-danger/20 bg-danger/10 p-4">
          <div className="flex items-start gap-2.5">
            <Icon name="error" className="mt-0.5 text-[18px] text-danger shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-text-main">Couldn&apos;t load the donation channels</p>
              <p className="mt-1 text-text-muted">
                {GITHUB_CONFIG.donateUrl} responded with {error}. Check your network connection, then try
                again.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" icon="refresh" onClick={loadDonateInfo} className="self-start">
            Try again
          </Button>
        </div>
      )}

      {!loading && !error && data && (
        <div className="flex flex-col gap-5">
          {data.message && <p className="text-sm text-text-muted">{data.message}</p>}

          {channels.length === 0 ? (
            <div className="flex items-start gap-3 rounded-[10px] border border-border bg-surface-2 p-4">
              <Icon name="info" className="mt-0.5 text-[20px] text-text-muted shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-text-main">No donation channels available</p>
                <p className="mt-1 text-text-muted">
                  The donation list returned nothing. Try again later or open the project on GitHub.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {channels.map((ch) => (
                <DonateChannelCard key={ch.id} channel={ch} />
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function DonateChannelCard({ channel }) {
  const { label, description, icon, color, url, qr } = channel;

  return (
    <div className="flex flex-col rounded-[10px] border border-border bg-surface p-4">
      <div className="flex items-center gap-2.5">
        <span
          className="flex size-8 items-center justify-center rounded-md bg-surface-2"
          style={{ color }}
        >
          <Icon name={icon} className="text-[18px]" />
        </span>
        <span className="text-sm font-semibold text-text-main">{label}</span>
      </div>

      {description && <p className="mt-2 text-[13px] leading-relaxed text-text-muted">{description}</p>}

      {qr && (
        <img
          src={qr}
          alt={`${label} QR code`}
          className="mt-3 w-full max-w-[180px] self-center rounded-md border border-border bg-white p-1"
          loading="lazy"
          decoding="async"
        />
      )}

      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex h-8 items-center gap-1.5 self-start rounded-md border border-border bg-surface-2 px-3 text-xs font-medium text-text-main transition-colors duration-150 hover:bg-surface-3"
        >
          Open {label}
          <Icon name="open_in_new" className="text-[16px]" />
        </a>
      )}
    </div>
  );
}

DonateModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};
