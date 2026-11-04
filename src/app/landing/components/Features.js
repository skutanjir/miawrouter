
import { Icon } from "@/shared/components/Icon";

const FEATURES = [
  {
    icon: "link",
    title: "Unified endpoint",
    desc: "Route requests through a single endpoint for your configured providers.",
  },
  {
    icon: "terminal",
    title: "Local setup",
    desc: "Install MiawRouter with the npm package and configure it in the dashboard.",
  },
  {
    icon: "route",
    title: "Fallback routing",
    desc: "Configure fallback providers for requests that fail.",
  },
  {
    icon: "monitoring",
    title: "Usage tracking",
    desc: "Review request usage, cache activity, and provider statistics.",
  },
  {
    icon: "key",
    title: "Provider credentials",
    desc: "Manage API keys and OAuth connections in the dashboard.",
  },
  {
    icon: "image",
    title: "Media providers",
    desc: "Configure image, audio, video, and web search providers.",
  },
  {
    icon: "terminal",
    title: "CLI tools",
    desc: "Connect supported clients such as Claude Code, Codex, and Cline.",
  },
  {
    icon: "dashboard",
    title: "Dashboard",
    desc: "Configure providers and inspect request activity.",
  },
];

export default function Features() {
  return (
    <section className="px-6 py-20" id="features">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12">
          <h2 className="mb-4 text-3xl font-semibold tracking-tight md:text-4xl">Routing features</h2>
          <p className="max-w-xl text-base text-text-muted">
            Configurable providers, credentials, fallbacks, and request usage in one dashboard.
          </p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((feature) => (
            <div 
              key={feature.title}
              className="group rounded-[10px] border border-border-subtle bg-surface p-5 transition-colors duration-150 hover:border-primary/40 hover:bg-primary/5"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon name={feature.icon} className="text-[18px]" />
              </div>
              <h3 className="mb-2 text-base font-semibold transition-colors group-hover:text-primary">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-text-muted">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
