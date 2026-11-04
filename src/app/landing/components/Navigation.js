"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import BrandAsset from "@/shared/components/BrandAsset";

import { Icon } from "@/shared/components/Icon";
export default function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-border-subtle bg-surface">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <button
          type="button"
          className="flex items-center gap-3 cursor-pointer bg-transparent border-none p-0"
          onClick={() => router.push("/")}
          aria-label="Navigate to home"
        >
          <div className="size-8 overflow-hidden rounded-md border border-border-subtle">
            <BrandAsset kind="icon" className="size-full object-cover" />
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-text-main">MiawRouter</h2>
        </button>

        {/* Desktop menu */}
        <div className="hidden md:flex items-center gap-8">
          <a className="text-text-muted hover:text-text-main text-sm font-medium transition-colors" href="#features">Features</a>
          <a className="text-text-muted hover:text-text-main text-sm font-medium transition-colors" href="#how-it-works">How it Works</a>
          <a className="text-text-muted hover:text-text-main text-sm font-medium transition-colors" href="https://miawrouter.web.id" target="_blank" rel="noopener noreferrer">Docs</a>
          <a className="text-text-muted hover:text-text-main text-sm font-medium transition-colors flex items-center gap-1" href="https://miawrouter.web.id" target="_blank" rel="noopener noreferrer">
            Website <Icon name="open_in_new" className="text-[14px]" />
          </a>
        </div>

        {/* CTA + Mobile menu */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push("/dashboard")}
            className="hidden h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-600 sm:flex"
          >
            Get Started
          </button>
          <button
            className="rounded-md p-2 text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
          >
            <Icon name={mobileMenuOpen ? "close" : "menu"} className="text-[18px]" />
          </button>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="border-t border-border-subtle bg-surface md:hidden">
          <div className="flex flex-col gap-4 p-6">
            <a className="text-sm font-medium text-text-muted transition-colors hover:text-text-main" href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a className="text-sm font-medium text-text-muted transition-colors hover:text-text-main" href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>How it Works</a>
            <a className="text-sm font-medium text-text-muted transition-colors hover:text-text-main" href="https://miawrouter.web.id" target="_blank" rel="noopener noreferrer">Website</a>
            <button
              onClick={() => router.push("/dashboard")}
              className="h-9 rounded-md bg-primary text-sm font-semibold text-white transition-colors hover:bg-brand-600"
            >
              Get Started
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
