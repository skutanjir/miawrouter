
import { Icon } from "@/shared/components/Icon";

export default function HeroSection() {
  return (
    <section className="flex min-h-[70vh] flex-col items-center justify-center px-6 pt-24 pb-16">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-7 text-center">
        <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
          One Endpoint for <br/>
          <span className="text-primary">All AI Providers</span>
        </h1>

        {/* Description */}
        <p className="mx-auto max-w-2xl text-base leading-relaxed text-text-muted md:text-lg">
          AI endpoint proxy with web dashboard. A JavaScript port of CLIProxyAPI that supports Claude Code, OpenAI Codex, Cline, Roo Code, and other CLI tools.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 w-full">
          <a href="/dashboard" className="flex h-11 items-center gap-2 rounded-md bg-primary px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-600">
            <Icon name="router" className="text-[16px]" />
            Open dashboard
          </a>
          <a 
            href="https://miawrouter.web.id" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex h-11 items-center gap-2 rounded-md border border-border bg-surface px-6 text-sm font-semibold text-text-main transition-colors hover:bg-surface-2"
          >
            <Icon name="menu_book" className="text-[16px]" />
            Read documentation
          </a>
        </div>
      </div>
    </section>
  );
}
