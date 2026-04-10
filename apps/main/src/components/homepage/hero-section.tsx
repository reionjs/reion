"use client";
import Link from "next/link";
import { BookOpen, CheckCheckIcon, CopyIcon, Server } from "lucide-react";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";

const LazyLottieSVG = dynamic(
  () => import("../icons/lottie-svg").then((mod) => mod.LottieSVG),
  { ssr: false }
);

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
  const [showAnimation, setShowAnimation] = useState(false);
  const createCommand = `npx reion@latest create`;

  useEffect(() => {
    const win = window as Window & {
      requestIdleCallback?: (callback: () => void) => number;
    };

    if (win.requestIdleCallback) {
      win.requestIdleCallback(() => setShowAnimation(true));
      return;
    }

    const timeout = setTimeout(() => setShowAnimation(true), 200);
    return () => clearTimeout(timeout);
  }, []);

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(createCommand);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };
  return (
    <section
      className={cn(
        "relative min-h-[calc(100vh-var(--header-height))] w-full px-4 pt-12 pb-6 sm:px-6 md:py-28 lg:py-32",
        className
      )}
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-12 md:flex-row md:items-center md:justify-between md:gap-16 lg:gap-20">
        {/* Left: copy */}
        <div className="flex flex-1 flex-col text-center md:max-w-xl md:text-left lg:max-w-2xl">
          <h1 className="text-foreground text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            {title}
          </h1>
          <p className="text-muted-foreground mt-4 text-lg sm:text-xl md:mt-6">
            {description}
          </p>
          <div className="text-muted-foreground mt-6 flex flex-wrap items-center justify-center gap-6 text-sm md:justify-start">
            <span className="inline-flex items-center gap-2">
              <Server className="text-primary size-4" aria-hidden />
              APIs
            </span>
            <span className="inline-flex items-center gap-2">
              <Server className="text-primary size-4" aria-hidden />
              Servers
            </span>
            <span>Type-safe</span>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4 md:justify-start">
            <Button
              onClick={handleCopyCommand}
              className={cn(
                "hover:bg-background hover:text-foreground hover:border-border hover:drop-shadow-primary h-10 gap-4 hover:scale-105 hover:cursor-pointer hover:drop-shadow-md transition-all"
              )}
            >
              {createCommand}
              <span className="border-l pl-2">
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
                "border-border bg-background text-foreground inline-flex items-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-medium",
                "hover:bg-muted hover:text-foreground focus-visible:ring-ring transition-colors focus-visible:ring-2 focus-visible:outline-none"
              )}
            >
              <BookOpen className="size-4" />
              {secondaryCtaLabel}
            </Link>
          </div>
        </div>
        {/* Right: Lottie */}
        {lottieSrc && (
          <div
            className={cn(
              "pointer-events-none relative w-3/5 md:w-full shrink-0 overflow-visible rounded-xl p-4 md:max-w-sm lg:max-w-md"
            )}
          >
            {/* Glow behind the SVG */}
            <div
              className="pointer-events-none absolute inset-0 rounded-xl opacity-90"
              style={{
                background:
                  "radial-gradient(ellipse 75% 65% at 50% 50%, rgba(234,88,12,0.35) 0%, rgba(234,88,12,0.15) 40%, transparent 65%)",
              }}
              aria-hidden
            />
            <div className="relative z-10">
              {showAnimation ? (
                <LazyLottieSVG
                  src={lottieSrc}
                  className="h-auto w-full"
                  applyTheme={true}
                  width="100%"
                  height="auto"
                />
              ) : (
                <div className="h-56 w-full md:h-72" aria-hidden />
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
