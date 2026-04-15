import { ShieldCheck, Gauge, Layers, Puzzle, Sparkles } from "lucide-react";
import { DecorativeOrbitSVG } from "./decorative-orbit-svg";

const FEATURES = [
  {
    title: "Production-first defaults",
    description:
      "Build with sensible defaults for validation, middleware composition, and predictable request handling.",
    icon: ShieldCheck,
  },
  {
    title: "Fast developer feedback",
    description:
      "Iterate quickly with file-based routing and a workflow optimized for rapid API development.",
    icon: Gauge,
  },
  {
    title: "Composable architecture",
    description:
      "Split large backends into clean modules with shared middleware, events, and route-level contracts.",
    icon: Layers,
  },
  {
    title: "Plugin-friendly design",
    description:
      "Extend runtime capabilities with plugins for cron jobs, tooling, and custom platform integrations.",
    icon: Puzzle,
  },
];

export function FeaturesSection() {
  return (
    <section className="border-border/60 bg-background relative w-full overflow-hidden border-t px-4 py-16 sm:px-6 md:py-24">
      <div
        aria-hidden
        className="bg-primary/10 absolute top-16 -left-32 h-72 w-72 rounded-full blur-3xl"
      />
      <DecorativeOrbitSVG className="text-primary/80 pointer-events-none absolute -top-24 -right-20 size-72 opacity-35" />
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-col gap-6 md:mb-14 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl text-center md:text-left">
            <p className="text-primary inline-flex items-center gap-2 text-sm font-medium tracking-wide uppercase">
              <Sparkles className="size-4" />
              Why Reion
            </p>
            <h2 className="text-foreground mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Everything you need to ship backend features
            </h2>
            <p className="text-muted-foreground mt-4 text-base sm:text-lg">
              Reion is built to keep your backend simple as it grows, without giving up speed or type safety.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="border-border/60 bg-card rounded-lg border px-4 py-3 text-center">
              <p className="text-foreground text-xl font-semibold">10x</p>
              <p className="text-muted-foreground text-xs">Faster setup</p>
            </div>
            <div className="border-border/60 bg-card rounded-lg border px-4 py-3 text-center">
              <p className="text-foreground text-xl font-semibold">TS</p>
              <p className="text-muted-foreground text-xs">Type-safe by default</p>
            </div>
            <div className="border-border/60 bg-card rounded-lg border px-4 py-3 text-center">
              <p className="text-foreground text-xl font-semibold">0 → 1</p>
              <p className="text-muted-foreground text-xs">In minutes</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="border-border/70 bg-card/80 hover:border-primary/40 hover:bg-card relative rounded-xl border p-6 transition-all"
            >
              <div className="bg-primary/10 mb-4 inline-flex rounded-lg p-2">
                <feature.icon className="text-primary size-5" />
              </div>
              <h3 className="text-foreground mt-4 text-lg font-semibold">
                {feature.title}
              </h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

