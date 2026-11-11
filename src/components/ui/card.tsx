import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-xl border border-zinc-200 bg-white p-4 shadow-sm", className)} {...props} />
  );
}

export function Badge({
  className,
  tone = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: "default" | "utah" | "green" | "muted" }) {
  const tones = {
    default: "bg-zinc-100 text-zinc-800",
    utah: "bg-utah/10 text-utah",
    green: "bg-emerald-100 text-emerald-800",
    muted: "bg-zinc-50 text-zinc-500 border border-zinc-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

export function MatchBadge({ score }: { score: number }) {
  const tone = score >= 70 ? "green" : score >= 40 ? "utah" : "default";
  return (
    <Badge tone={tone} className="shrink-0 font-semibold">
      {score}% match
    </Badge>
  );
}

export function Tags({ items, tone }: { items: string[]; tone?: "default" | "utah" | "muted" }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((s) => (
        <Badge key={s} tone={tone}>
          {s}
        </Badge>
      ))}
    </div>
  );
}

export function Alert({ kind, children }: { kind: "error" | "notice"; children: React.ReactNode }) {
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg px-3 py-2 text-sm",
        kind === "error" ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800",
      )}
    >
      {children}
    </div>
  );
}
