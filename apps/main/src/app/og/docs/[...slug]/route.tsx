import { ImageResponse } from "@takumi-rs/image-response";
import { notFound } from "next/navigation";

import { getPageImage, source } from "@/lib/source";

export const revalidate = false;

export async function GET(
  _req: Request,
  { params }: RouteContext<"/og/docs/[...slug]">
) {
  const { slug } = await params
  const page = source.getPage(slug.slice(0, -1));
  if (!page) notFound();

  const pageTitle = page.data.title;
  const pageDescription =
    page.data.description ??
    "Reion docs for building APIs and servers with type safety.";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
        overflow: "hidden",
        background: "#0f0a05",
        color: "#f8f8f8",
        fontFamily:
          "Inter, Geist, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
        padding: "56px 64px",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "0",
          background: "linear-gradient(135deg, #140d06 0%, #241508 55%, #1a1209 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "-140px",
          left: "-100px",
          width: "420px",
          height: "420px",
          borderRadius: "999px",
          background: "rgba(245, 158, 11, 0.35)",
          opacity: 0.8,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "-120px",
          right: "-120px",
          width: "420px",
          height: "420px",
          borderRadius: "999px",
          background: "rgba(251, 191, 36, 0.22)",
          opacity: 0.9,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "0",
          left: "0",
          right: "0",
          height: "6px",
          background: "#f59e0b",
          opacity: 0.95,
        }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: "12px", zIndex: 1 }}>
        <div
          style={{
            width: "14px",
            height: "14px",
            borderRadius: "999px",
            background: "#f59e0b",
            boxShadow: "0 0 26px rgba(245, 158, 11, 0.82)",
          }}
        />
        <div
          style={{
            fontSize: "28px",
            fontWeight: 600,
            letterSpacing: "0.02em",
          }}
        >
          Reion Docs
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "20px", zIndex: 1 }}>
        <div
          style={{
            display: "inline-flex",
            alignSelf: "flex-start",
            border: "1px solid rgba(245, 158, 11, 0.55)",
            borderRadius: "999px",
            padding: "8px 14px",
            fontSize: "20px",
            color: "rgba(255,255,255,0.88)",
            background: "rgba(34, 22, 8, 0.7)",
          }}
        >
          /docs/{page.slugs.join("/")}
        </div>
        <div
          style={{
            fontSize: "70px",
            lineHeight: 1.05,
            fontWeight: 700,
            letterSpacing: "-0.025em",
            maxWidth: "1020px",
          }}
        >
          {pageTitle}
        </div>
        <div
          style={{
            fontSize: "32px",
            lineHeight: 1.25,
            color: "rgba(255,255,255,0.82)",
            maxWidth: "980px",
          }}
        >
          {pageDescription}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 1,
          fontSize: "24px",
          color: "rgba(255,255,255,0.86)",
        }}
      >
        <div>reionjs.com</div>
        <div
          style={{
            border: "1px solid rgba(245, 158, 11, 0.45)",
            borderRadius: "999px",
            padding: "8px 14px",
            background: "rgba(42, 27, 10, 0.72)",
          }}
        >
          Type-safe APIs and servers
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      format: "webp",
    }
  );
}

export function generateStaticParams() {
  return source.getPages().map((page) => ({
    lang: page.locale,
    slug: getPageImage(page).segments,
  }));
}
