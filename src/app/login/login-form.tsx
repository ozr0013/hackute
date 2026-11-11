"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isUtahEmail } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/card";

export function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const clean = email.trim().toLowerCase();
    if (!isUtahEmail(clean)) {
      setError("Use your University of Utah email (ending in utah.edu).");
      return;
    }
    setStatus("sending");
    const supabase = createClient();
    const callback = new URL("/auth/callback", window.location.origin);
    if (next) callback.searchParams.set("next", next);
    const { error } = await supabase.auth.signInWithOtp({
      email: clean,
      options: { emailRedirectTo: callback.toString() },
    });
    if (error) {
      setStatus("idle");
      setError(
        error.message.includes("Database error")
          ? "Only utah.edu email addresses can sign up."
          : error.message,
      );
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <Alert kind="notice">
        Check <strong>{email.trim()}</strong> for a sign in link. You can close this tab.
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="University email" htmlFor="email">
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="u1234567@utah.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </Field>
      {error && <Alert kind="error">{error}</Alert>}
      <Button type="submit" className="w-full" disabled={status === "sending"}>
        {status === "sending" ? "Sending link..." : "Email me a sign in link"}
      </Button>
    </form>
  );
}
