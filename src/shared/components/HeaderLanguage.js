"use client";

import { useState, useEffect } from "react";
import { normalizeLocale, LOCALE_COOKIE } from "@/i18n/config";
import LanguageSwitcher from "./LanguageSwitcher";
import { Icon } from "@/shared/components/Icon";

function getLocaleFromCookie() {
  if (typeof document === "undefined") return "en";
  const cookie = document.cookie
    .split(";")
    .find((c) => c.trim().startsWith(`${LOCALE_COOKIE}=`));
  const value = cookie ? decodeURIComponent(cookie.split("=")[1]) : "en";
  return normalizeLocale(value);
}

export default function HeaderLanguage() {
  const [open, setOpen] = useState(false);
  const [locale, setLocale] = useState("en");

  useEffect(() => {
    setLocale(getLocaleFromCookie());
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main"
        title="Language"
        aria-label={`Language: ${locale}`}
        data-i18n-skip="true"
      >
        <Icon name="language" className="text-[18px]" />
        <span className="text-xs font-medium uppercase">{locale}</span>
      </button>

      <LanguageSwitcher
        hideTrigger
        isOpen={open}
        onClose={(next) => {
          setOpen(false);
          setLocale(next);
        }}
      />
    </>
  );
}
