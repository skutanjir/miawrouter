"use client";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";

export default function GetStarted() {
  const { copied, copy } = useCopyToClipboard();

  const handleCopy = (text) => {
    copy(text, "landing");
  };

  return (
    <section className="border-y border-border-subtle bg-surface-2 px-6 py-20">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-start gap-12 lg:flex-row">
          <div className="flex-1">
            <h2 className="mb-6 text-3xl font-semibold tracking-tight md:text-4xl">Get started</h2>
            <p className="mb-8 text-base text-text-muted">
              Install MiawRouter, configure providers in the dashboard, then route requests through the local endpoint.
            </p>

            <div className="flex flex-col gap-6">
              <div className="flex gap-4">
                <span className="font-mono text-xs text-text-subtle">01</span>
                <div>
                  <h3 className="font-semibold">Install MiawRouter</h3>
                  <p className="mt-1 text-sm text-text-muted">Run the npm command to start the server.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <span className="font-mono text-xs text-text-subtle">02</span>
                <div>
                  <h3 className="font-semibold">Configure providers</h3>
                  <p className="mt-1 text-sm text-text-muted">Add provider credentials in the dashboard.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <span className="font-mono text-xs text-text-subtle">03</span>
                <div>
                  <h3 className="font-semibold">Route requests</h3>
                  <p className="mt-1 text-sm text-text-muted">Point client tools to your MiawRouter endpoint.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full flex-1">
            <div className="overflow-hidden rounded-[10px] border border-border bg-surface">
              <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
                <span className="text-sm font-medium">Install command</span>
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-xs text-primary transition-colors hover:bg-primary/10"
                  onClick={() => handleCopy("npx miawrouter")}
                >
                  {copied === "landing" ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="overflow-x-auto p-4 font-mono text-sm text-text-main"><code>npx miawrouter</code></pre>
              <div className="flex flex-col gap-2 border-t border-border-subtle px-4 py-3 text-sm">
                <span className="text-text-muted">Local endpoint</span>
                <code className="break-all font-mono text-primary">http://localhost:21128</code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
