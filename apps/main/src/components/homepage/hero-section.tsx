"use client";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCheckIcon,
  CopyIcon,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";
import { Button } from "../ui/button";
import { LottieSVG } from "../icons/lottie-svg";

export interface HeroSectionProps {
  /** Main headline */
  title?: string;
  /** Supporting line below the headline */
  description?: string;
  /** Lottie animation URL (e.g. /hero-animation.json) */
  lottieSrc?: string;
  /** Secondary CTA label */
  secondaryCtaLabel?: string;
  /** Secondary CTA href */
  secondaryCtaHref?: string;
  className?: string;
}

const defaults = {
  title: "Build something great",
  description:
    "Get started with the docs and ship faster. Everything you need in one place.",
  primaryCtaLabel: "Get started",
  primaryCtaHref: "/docs",
  secondaryCtaLabel: "Read the docs",
  secondaryCtaHref: "/docs",
};

export function HeroSection({
  title = defaults.title,
  description = defaults.description,
  lottieSrc = "/hero-animation.json",
  secondaryCtaLabel = defaults.secondaryCtaLabel,
  secondaryCtaHref = defaults.secondaryCtaHref,
  className,
}: HeroSectionProps) {
  const [copied, setCopied] = useState(false);
  const createCommand = `npx reion@latest create`;
  const featurePills = useMemo(
    () => ["File-based routing", "Typed middleware", "Built-in security"],
    []
  );

  const handleCopyCommand = async () => {
    await navigator.clipboard.writeText(createCommand);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  return (
    <section
      className={cn(
        "relative isolate overflow-hidden px-4 pt-14 pb-10 sm:px-6 md:pt-24 md:pb-20 lg:pt-28",
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden
        style={{
          background:
            "radial-gradient(65% 55% at 20% 20%, color-mix(in oklch, var(--primary) 24%, transparent), transparent 60%), radial-gradient(70% 60% at 82% 18%, color-mix(in oklch, var(--primary) 16%, transparent), transparent 64%)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,color-mix(in_oklch,var(--border)_45%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklch,var(--border)_45%,transparent)_1px,transparent_1px)] bg-size-[42px_42px] opacity-25" />
      {lottieSrc ? (
        <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center opacity-10">
          <div className="h-[85%] w-[85%] max-w-5xl translate-x-4 translate-y-4 md:translate-x-1/3 md:translate-y-6">
            <LottieSVG
              src={lottieSrc}
              className="h-full w-full"
              applyTheme={true}
              width="100%"
              height="100%"
            />
          </div>
          <div className="absolute inset-0 bg-linear-to-b from-transparent via-background/30 to-background/80" />
        </div>
      ) : null}

      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <div className="border-border/70 bg-background/70 text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs backdrop-blur">
            <Sparkles className="text-primary size-3.5" />
            Modern TypeScript framework for APIs
          </div>

          <h1 className="text-foreground mt-5 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl md:text-6xl">
            <span className="block">{title}</span>
            <span className="from-primary via-chart-3 to-primary block bg-linear-to-r bg-clip-text text-transparent">
              in minutes, not weeks
            </span>
          </h1>

          <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-base leading-relaxed sm:text-lg">
            {description}
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {featurePills.map((item) => (
              <span
                key={item}
                className="border-border/70 bg-background/75 text-muted-foreground inline-flex items-center rounded-full border px-3 py-1 text-xs backdrop-blur-sm"
              >
                {item}
              </span>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              onClick={handleCopyCommand}
              className={cn(
                "h-10 gap-3 rounded-lg px-4 text-sm shadow-sm transition-transform hover:-translate-y-0.5 hover:cursor-pointer"
              )}
            >
              {createCommand}
              <span className="border-primary-foreground/30 border-l pl-2">
                {copied ? (
                  <CheckCheckIcon className="size-4" />
                ) : (
                  <CopyIcon className="size-4" />
                )}
              </span>
            </Button>
            <Link
              href={secondaryCtaHref}
              className={cn(
                "border-border bg-background/70 text-foreground inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium backdrop-blur-sm",
                "hover:bg-muted focus-visible:ring-ring transition-colors focus-visible:ring-2 focus-visible:outline-none"
              )}
            >
              <BookOpen className="size-4" />
              {secondaryCtaLabel}
              <ArrowRight className="size-4" />
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="border-border/70 bg-background/70 rounded-xl border p-3 backdrop-blur">
              <p className="text-foreground text-lg font-semibold">100%</p>
              <p className="text-muted-foreground text-xs">Type-safe handlers</p>
            </div>
            <div className="border-border/70 bg-background/70 rounded-xl border p-3 backdrop-blur">
              <p className="text-foreground text-lg font-semibold">&lt; 1m</p>
              <p className="text-muted-foreground text-xs">Bootstrap to first API</p>
            </div>
            <div className="border-border/70 bg-background/70 col-span-2 rounded-xl border p-3 backdrop-blur sm:col-span-1">
              <p className="text-foreground text-lg font-semibold">Core + Plugins</p>
              <p className="text-muted-foreground text-xs">Cron, auth, and custom extensions</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
