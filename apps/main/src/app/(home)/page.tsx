import { HeroSection } from '@/components/homepage';
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Home",
  description:
    "Build APIs and servers at the speed of lightning with Reion. Type-safe, fast, and production ready.",
};

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <HeroSection
        lottieSrc="animations/animation-server1.json"
        title="The backend framework that ships"
        description="APIs and servers at the speed of lightning. Type-safe, fast, and built for production."
        secondaryCtaLabel="Read the docs"
        secondaryCtaHref="/docs"
      />
    </main>
  );
}
