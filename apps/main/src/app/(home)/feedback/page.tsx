"use client";

import { FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FeedbackFormState = {
  name: string;
  email: string;
  category: "bug" | "feature" | "docs" | "other";
  message: string;
};

const initialFormState: FeedbackFormState = {
  name: "",
  email: "",
  category: "other",
  message: "",
};

export default function FeedbackPage() {
  const [form, setForm] = useState<FeedbackFormState>(initialFormState);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [error, setError] = useState<string>("");

  const canSubmit = useMemo(
    () =>
      form.name.trim().length > 0 &&
      form.email.trim().length > 0 &&
      form.message.trim().length >= 10 &&
      status !== "sending",
    [form, status],
  );

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Failed to submit feedback");
      }
      setStatus("success");
      setForm(initialFormState);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to submit feedback");
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Feedback</h1>
      <p className="text-fd-muted-foreground mt-2">
        Share bugs, feature requests, or docs feedback. Submissions are stored in our
        Google Sheet.
      </p>

      <form
        onSubmit={onSubmit}
        className="bg-fd-card border-fd-border mt-8 space-y-4 rounded-xl border p-5 sm:p-6"
      >
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="feedback-name">
            Name
          </label>
          <Input
            id="feedback-name"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="Your name"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="feedback-email">
            Email
          </label>
          <Input
            id="feedback-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            placeholder="you@example.com"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="feedback-category">
            Category
          </label>
          <Select
            value={form.category}
            onValueChange={(value) =>
              setForm((p) => ({ ...p, category: value as FeedbackFormState["category"] }))
            }
          >
            <SelectTrigger id="feedback-category" className="w-full">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bug">Bug</SelectItem>
              <SelectItem value="feature">Feature request</SelectItem>
              <SelectItem value="docs">Documentation</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="feedback-message">
            Message
          </label>
          <Textarea
            id="feedback-message"
            rows={6}
            value={form.message}
            onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
            placeholder="Tell us what you think..."
            required
          />
          <p className="text-fd-muted-foreground text-xs">Minimum 10 characters.</p>
        </div>

        <Button
          type="submit"
          disabled={!canSubmit}
        >
          {status === "sending" ? "Sending..." : "Submit feedback"}
        </Button>

        {status === "success" && (
          <p className="text-sm text-emerald-600">Thanks! Your feedback has been submitted.</p>
        )}
        {status === "error" && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </main>
  );
}

