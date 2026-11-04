"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import useThemeStore from "@/store/themeStore";

// Subscribe to system theme changes
function subscribeToSystemTheme(callback) {
  if (typeof window === "undefined") return () => {};
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

// Get current system theme preference
function getSystemThemeSnapshot() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// Server snapshot defaults to true (dark carbon theme)
function getServerSnapshot() {
  return true;
}

export function useTheme() {
  const { theme, setTheme, toggleTheme, initTheme } = useThemeStore();

  // Use useSyncExternalStore to safely subscribe to system theme
  const systemPrefersDark = useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemThemeSnapshot,
    getServerSnapshot
  );

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  // Listen for system theme changes when theme is "system"
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => initTheme();

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme, initTheme]);

  // Compute isDark from current state (defaults to dark unless explicitly light)
  const isDark = theme !== "light" && (theme === "dark" || systemPrefersDark || theme === "system");

  return {
    theme,
    setTheme,
    toggleTheme,
    isDark,
  };
}

