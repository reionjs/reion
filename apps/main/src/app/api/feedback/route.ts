import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  category: z.enum(["bug", "feature", "docs", "other"]),
  message: z.string().trim().min(10),
});

export async function POST(req: Request) {
  const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
  if (!scriptUrl) {
    return NextResponse.json(
      { ok: false, error: "Feedback webhook is not configured" },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid feedback payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const payload = {
      ...parsed.data,
      source: "main-docs",
      submittedAt: new Date().toISOString(),
    };

    const response = await fetch(scriptUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: `Webhook request failed (${response.status})` },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Failed to submit feedback to webhook" },
      { status: 502 },
    );
  }
}

