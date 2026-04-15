import { RootProvider } from "fumadocs-ui/provider/next";
import "./global.css";
import { Inter, Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { Provider } from "@/components/provider";
import type { Metadata, Viewport } from "next";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const inter = Inter({
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://reion.onlydev.in";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Reion",
    template: "%s | Reion",
  },
  description:
    "Reion is a backend framework for APIs and servers that is type-safe, fast, and built for production.",
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "Reion",
    description:
      "Reion is a backend framework for APIs and servers that is type-safe, fast, and built for production.",
    images: [{ url: "/og", width: 1200, height: 630, alt: "Reion Open Graph Image" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Reion",
    description:
      "Reion is a backend framework for APIs and servers that is type-safe, fast, and built for production.",
    images: ["/og"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn(inter.className, "font-sans", geist.variable)}
      suppressHydrationWarning
    >
      <body className="flex flex-col min-h-screen overflow-hidden relative" suppressHydrationWarning>
        <Provider>
          <RootProvider>{children}</RootProvider>
        </Provider>
      </body>
    </html>
  );
}
