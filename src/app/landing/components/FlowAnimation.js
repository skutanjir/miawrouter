import Image from "next/image";
import ProviderIcon from "@/shared/components/ProviderIcon";

const CLI_TOOLS = [
  { id: "claude", name: "Claude Code", image: "/providers/claude.png" },
  { id: "codex", name: "OpenAI Codex", image: "/providers/codex.png" },
  { id: "cline", name: "Cline", image: "/providers/cline.png" },
  { id: "cursor", name: "Cursor", image: "/providers/cursor.png" },
];

const PROVIDERS = ["OpenAI", "Anthropic", "Gemini", "GitHub Copilot"];

export default function FlowAnimation() {
  return (
    <div className="mx-auto mt-8 hidden w-full max-w-5xl grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-5 md:grid">
      <section className="rounded-[10px] border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold">Clients</h2>
        <ul className="space-y-2">
          {CLI_TOOLS.map((tool) => (
            <li key={tool.id} className="flex items-center gap-2 text-sm text-text-muted">
              <ProviderIcon
                src={tool.image}
                alt={tool.name}
                size={24}
                className="size-6 rounded object-contain"
                fallbackText={tool.name.slice(0, 2).toUpperCase()}
              />
              {tool.name}
            </li>
          ))}
        </ul>
      </section>
      <span className="h-px w-8 bg-border" aria-hidden="true" />
      <section className="flex flex-col items-center gap-2 rounded-[10px] border border-primary/40 bg-surface p-5 text-center">
        <Image src="/miawrouter-mascot-router.png" alt="" aria-hidden width={64} height={64} className="size-16 object-contain" />
        <h2 className="text-sm font-semibold">MiawRouter</h2>
      </section>
      <span className="h-px w-8 bg-border" aria-hidden="true" />
      <section className="rounded-[10px] border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold">Providers</h2>
        <ul className="space-y-2">
          {PROVIDERS.map((provider) => (
            <li key={provider} className="rounded-md border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-text-muted">
              {provider}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
