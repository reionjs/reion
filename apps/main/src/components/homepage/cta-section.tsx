import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";

export function CtaSection() {
  return (
    <section className="w-full px-4 py-16 sm:px-6 md:py-20">
      <div className="from-primary/10 via-primary/5 to-background border-primary/20 relative mx-auto max-w-6xl overflow-hidden rounded-2xl border bg-linear-to-br p-8 text-center sm:p-10 md:p-12">
        <div
          aria-hidden
          className="bg-primary/20 absolute -top-20 -right-16 h-56 w-56 rounded-full blur-3xl"
        />
        <p className="text-primary text-sm font-medium tracking-wide uppercase">
          Start Building
        </p>
        <h2 className="text-foreground mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Build your next backend with Reion
        </h2>
        <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-base sm:text-lg">
          Explore the docs, scaffold your first project, and start shipping APIs that stay maintainable as they grow.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/docs/get-started"
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors"
          >
            Get started
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/docs"
            className="border-border bg-background hover:bg-muted text-foreground inline-flex items-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-medium transition-colors"
          >
            <BookOpen className="size-4" />
            Browse docs
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-3 text-left sm:mx-auto sm:max-w-xl">
          <div className="border-border/60 bg-background/70 rounded-lg border px-3 py-2">
            <p className="text-foreground text-sm font-semibold">Type-safe</p>
            <p className="text-muted-foreground text-xs">Schema-first APIs</p>
          </div>
          <div className="border-border/60 bg-background/70 rounded-lg border px-3 py-2">
            <p className="text-foreground text-sm font-semibold">Composable</p>
            <p className="text-muted-foreground text-xs">Middleware + plugins</p>
          </div>
          <div className="border-border/60 bg-background/70 rounded-lg border px-3 py-2">
            <p className="text-foreground text-sm font-semibold">Fast</p>
            <p className="text-muted-foreground text-xs">Built for shipping</p>
          </div>
        </div>
      </div>
    </section>
  );
}

