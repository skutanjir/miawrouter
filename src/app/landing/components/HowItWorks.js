
import Image from "next/image";
import { Icon } from "@/shared/components/Icon";

export default function HowItWorks() {
  return (
    <section className="border-y border-border-subtle bg-surface-2 py-20" id="how-it-works">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-16">
          <h2 className="mb-4 text-3xl font-semibold tracking-tight md:text-4xl">How MiawRouter Works</h2>
          <p className="max-w-xl text-base leading-relaxed text-text-muted">
            Data flows from your application through the routing layer to the provider selected for the request.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connection line */}


          {/* Step 1: CLI & SDKs */}
          <div className="flex flex-col gap-6 relative group">
            <div className="z-10 mx-auto flex h-20 w-20 items-center justify-center rounded-[10px] border border-border bg-surface md:mx-0">
              <Icon name="terminal" className="text-3xl text-text-muted" />
            </div>
            <div>
              <h3 className="mb-2 text-xl font-semibold">1. Applications &amp; CLI tools</h3>
              <p className="text-sm text-text-muted">
                Connect a compatible client or CLI tool to the local endpoint.
              </p>
            </div>
          </div>

          {/* Step 2: MiawRouter Hub */}
          <div className="flex flex-col gap-6 relative group md:items-center md:text-center">
            <div className="z-10 mx-auto flex h-20 w-20 items-center justify-center rounded-[10px] border border-primary/40 bg-surface">
              <Image src="/miawrouter-mascot-router.png" alt="" aria-hidden width={56} height={56} className="size-14 object-contain" />
            </div>
            <div>
              <h3 className="mb-2 text-xl font-semibold text-primary">2. MiawRouter Hub</h3>
              <p className="text-sm text-text-muted">
                The router selects and routes each request to a configured provider.
              </p>
            </div>
          </div>

          {/* Step 3: AI Providers */}
          <div className="flex flex-col gap-6 relative group md:items-end md:text-right">
            <div className="z-10 mx-auto flex h-20 w-20 items-center justify-center rounded-[10px] border border-border bg-surface md:mx-0">
              <Icon name="cloud" className="text-4xl text-text-muted" />
            </div>
            <div>
              <h3 className="mb-2 text-xl font-semibold">3. AI Providers</h3>
              <p className="text-sm text-text-muted">
                The request is routed to a configured provider such as OpenAI, Anthropic, or Gemini.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
