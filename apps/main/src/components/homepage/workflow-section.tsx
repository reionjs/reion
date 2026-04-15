const STEPS = [
  {
    title: "Create your app",
    description:
      "Bootstrap a new Reion project and start with a clean, opinionated backend structure.",
  },
  {
    title: "Build routes and middleware",
    description:
      "Add file-based routes, shared middleware, and schema validation where it matters.",
  },
  {
    title: "Ship with confidence",
    description:
      "Use plugins, tracing, and production-ready defaults to deploy faster with fewer surprises.",
  },
];

export function WorkflowSection() {
  return (
    <section className="bg-muted/20 relative w-full overflow-hidden px-4 py-16 sm:px-6 md:py-24">
      <div
        aria-hidden
        className="bg-primary/10 absolute right-0 -bottom-24 h-80 w-80 rounded-full blur-3xl"
      />
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 text-center md:mb-14">
          <p className="text-primary text-sm font-medium tracking-wide uppercase">
            Workflow
          </p>
          <h2 className="text-foreground mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            From idea to API in minutes
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-base sm:text-lg">
            A clear, repeatable flow that keeps your backend shipping fast as complexity grows.
          </p>
        </div>

        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map((step, idx) => (
            <li
              key={step.title}
              className="border-border/70 bg-background/90 relative rounded-xl border p-6 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="text-primary bg-primary/10 inline-flex rounded-full px-3 py-1 text-xs font-semibold">
                  Step {idx + 1}
                </div>
                <span className="text-muted-foreground text-xs">
                  0{idx + 1}
                </span>
              </div>
              <h3 className="text-foreground text-lg font-semibold">{step.title}</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

