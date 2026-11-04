"use client";

import { useState } from "react";
import PropTypes from "prop-types";
import { getProviderIconSrc, markProviderIconMissing } from "@/shared/utils/providerIcon";

import { Icon } from "@/shared/components/Icon";
function resolveSrc(src, providerId) {
  if (providerId) return getProviderIconSrc(providerId);
  if (!src) return null;
  const m = String(src).match(/^\/providers\/([^/]+)\.(?:png|svg|ico)$/i);
  if (m) return getProviderIconSrc(m[1]);
  return src;
}

export default function ProviderIcon({
  src,
  providerId,
  alt,
  size = 32,
  className = "",
  fallbackIcon,
  fallbackText = "?",
  fallbackColor,
}) {
  const effectiveSrc = resolveSrc(src, providerId);
  const [errored, setErrored] = useState(false);

  if (!effectiveSrc || errored) {
    if (fallbackIcon) {
      return (
        <Icon name={fallbackIcon} className={`inline-flex items-center justify-center rounded-md border border-border bg-surface-2 ${className}`.trim()} style={{
            width: size,
            height: size,
            color: fallbackColor,
            fontSize: Math.max(12, Math.floor(size * 0.56)),
          }} />
      );
    }
    return (
      <span
        className={`inline-flex items-center justify-center font-medium rounded-md border border-border bg-surface-2 ${className}`.trim()}
        style={{
          width: size,
          height: size,
          color: fallbackColor,
          fontSize: Math.max(10, Math.floor(size * 0.38)),
        }}
      >
        {fallbackText}
      </span>
    );
  }

  return (
    <img
      src={effectiveSrc}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      className={`rounded-md border border-border bg-surface object-contain ${className}`.trim()}
      decoding="async"
      onError={() => {
        const m = effectiveSrc.match(/^\/providers\/([^/]+)\.(?:png|svg|ico)$/i);
        if (m) markProviderIconMissing(m[1]);
        if (providerId) markProviderIconMissing(providerId);
        setErrored(true);
      }}
    />
  );
}

ProviderIcon.propTypes = {
  src: PropTypes.string,
  providerId: PropTypes.string,
  alt: PropTypes.string,
  size: PropTypes.number,
  className: PropTypes.string,
  /** Legacy icon name rendered when the provider image is unavailable. */
  fallbackIcon: PropTypes.string,
  fallbackText: PropTypes.string,
  fallbackColor: PropTypes.string,
};
