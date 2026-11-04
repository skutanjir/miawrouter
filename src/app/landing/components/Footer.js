"use client";

import BrandAsset from "@/shared/components/BrandAsset";

import { Icon } from "@/shared/components/Icon";
export default function Footer() {
  return (
    <footer className="border-t border-border-subtle bg-bg px-6 pt-12 pb-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
          {/* Brand */}
          <div className="col-span-2 lg:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="size-6 overflow-hidden rounded">
                <BrandAsset kind="icon" className="size-full object-cover" />
              </div>
              <h3 className="text-lg font-semibold text-text-main">MiawRouter</h3>
            </div>
            <p className="mb-6 max-w-xs text-sm text-text-muted">
              One endpoint for routing requests across configured AI providers.
            </p>
            <div className="flex gap-4">
              <a className="text-text-muted transition-colors hover:text-primary" href="https://miawrouter.web.id" target="_blank" rel="noopener noreferrer" aria-label="MiawRouter website">
                <Icon name="code" className="text-[18px]" />
              </a>
            </div>
          </div>
          
          {/* Product */}
          <div className="flex flex-col gap-4">
            <h4 className="font-semibold text-text-main">Product</h4>
            <a className="text-sm text-text-muted transition-colors hover:text-primary" href="#features">Features</a>
            <a className="text-sm text-text-muted transition-colors hover:text-primary" href="/dashboard">Dashboard</a>
            <a className="text-sm text-text-muted transition-colors hover:text-primary" href="https://miawrouter.web.id" target="_blank" rel="noopener noreferrer">Changelog</a>
          </div>
          
          {/* Resources */}
          <div className="flex flex-col gap-4">
            <h4 className="font-semibold text-text-main">Resources</h4>
            <a className="text-sm text-text-muted transition-colors hover:text-primary" href="https://miawrouter.web.id" target="_blank" rel="noopener noreferrer">Documentation</a>
            <a className="text-sm text-text-muted transition-colors hover:text-primary" href="https://miawrouter.web.id" target="_blank" rel="noopener noreferrer">Website</a>
            <a className="text-sm text-text-muted transition-colors hover:text-primary" href="https://www.npmjs.com/package/miawrouter" target="_blank" rel="noopener noreferrer">NPM</a>
          </div>
          
          {/* Legal */}
          <div className="flex flex-col gap-4">
            <h4 className="font-semibold text-text-main">Legal</h4>
            <a className="text-sm text-text-muted transition-colors hover:text-primary" href="https://miawrouter.web.id" target="_blank" rel="noopener noreferrer">MIT License</a>
          </div>
        </div>
        
        {/* Bottom */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-border-subtle pt-6 md:flex-row">
          <p className="text-sm text-text-muted">© {new Date().getFullYear()} MiawRouter. All rights reserved.</p>
          <div className="flex gap-6">
            <a className="text-sm text-text-muted transition-colors hover:text-text-main" href="https://miawrouter.web.id" target="_blank" rel="noopener noreferrer">Website</a>
            <a className="text-sm text-text-muted transition-colors hover:text-text-main" href="https://www.npmjs.com/package/miawrouter" target="_blank" rel="noopener noreferrer">NPM</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
