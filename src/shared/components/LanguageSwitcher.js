"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { LOCALES, LOCALE_COOKIE, normalizeLocale } from "@/i18n/config";
import { reloadTranslations } from "@/i18n/runtime";

import { Icon } from "@/shared/components/Icon";
function getLocaleFromCookie() {
  if (typeof document === "undefined") return "en";
  const cookie = document.cookie
    .split(";")
    .find((c) => c.trim().startsWith(`${LOCALE_COOKIE}=`));
  const value = cookie ? decodeURIComponent(cookie.split("=")[1]) : "en";
  return normalizeLocale(value);
}

// Locale display names are kept in one place for the language picker.
const getLocaleInfo = (locale) => {
  const locales = {
    en: { name: "English" },
    id: { name: "Bahasa Indonesia" },
  };
  return locales[locale] || { name: locale };
};

export default function LanguageSwitcher({ className = "", isOpen: controlledOpen, onClose, hideTrigger = false }) {
  const [locale, setLocale] = useState("en");
  const [isPending, setIsPending] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);
  const modalRef = useRef(null);

  const isControlled = typeof controlledOpen === "boolean";
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = (value, nextLocale = locale) => {
    if (isControlled) {
      if (!value && onClose) onClose(nextLocale);
    } else {
      setInternalOpen(value);
    }
  };

  useEffect(() => {
    setLocale(getLocaleFromCookie());
  }, []);

  // Close modal when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleSetLocale = async (nextLocale) => {
    if (nextLocale === locale || isPending) return;

    setIsPending(true);
    try {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: nextLocale }),
      });
      
      // Reload translations without full page reload
      await reloadTranslations();
      setLocale(nextLocale);
      setIsOpen(false, nextLocale);
    } catch (err) {
      console.error("Failed to set locale:", err);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className={className}>
      {/* Trigger button */}
      {!hideTrigger && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={isPending}
          className="flex items-center gap-2 rounded-md px-2.5 py-2 text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main"
          title="Language"
          data-i18n-skip="true"
        >
          <Icon name="language" className="text-[18px]" />
          <span className="text-sm font-medium">{getLocaleInfo(locale).name}</span>
        </button>
      )}

      {/* Portal modal - renders at document.body to avoid parent layout constraints */}
      {isOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-i18n-skip="true">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal content */}
          <div
            ref={modalRef}
            className="relative flex max-h-[80vh] w-full max-w-2xl flex-col rounded-[14px] border border-border bg-surface shadow-elevated"
          >
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-border-subtle p-3">
              <h2 className="text-lg font-semibold text-text-main">Select Language</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface-2"
                aria-label="Close"
              >
                <Icon name={"close"} className=" text-[20px]" />
              </button>
            </div>

            {/* Modal body - fixed grid columns, equal sizing */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
                {LOCALES.map((item) => {
                  const active = locale === item;
                  const info = getLocaleInfo(item);
                  return (
                    <button
                      key={item}
                      onClick={() => handleSetLocale(item)}
                      disabled={isPending}
                      className={`flex w-full flex-col items-center justify-start gap-1 rounded-md px-2 py-3 text-xs font-medium transition-colors ${
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-text-main hover:bg-surface-2"
                      } ${isPending ? "opacity-70 cursor-wait" : ""}`}
                      title={info.name}
                    >
                      <span className="text-sm font-mono font-medium uppercase">{item}</span>
                      {/* Fixed 2-line height so all cards are uniform */}
                      <span className="text-center leading-tight line-clamp-2 h-8 flex items-center">{info.name}</span>
                      {active && (
                        <Icon name={"check"} className=" text-sm" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
