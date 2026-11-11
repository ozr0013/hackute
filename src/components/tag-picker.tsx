"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Chip picker with free text. Submits selected values as repeated hidden inputs named `name`. */
export function TagPicker({
  name,
  options,
  defaultValue = [],
  max = 20,
  placeholder = "Add your own",
}: {
  name: string;
  options: string[];
  defaultValue?: string[];
  max?: number;
  placeholder?: string;
}) {
  const [selected, setSelected] = useState<string[]>(defaultValue);
  const [draft, setDraft] = useState("");

  const has = (v: string) => selected.some((s) => s.toLowerCase() === v.toLowerCase());
  const toggle = (v: string) =>
    setSelected((cur) =>
      has(v) ? cur.filter((s) => s.toLowerCase() !== v.toLowerCase()) : cur.length >= max ? cur : [...cur, v],
    );

  function addDraft() {
    const v = draft.trim().slice(0, 40);
    if (v && !has(v) && selected.length < max) setSelected((cur) => [...cur, v]);
    setDraft("");
  }

  const custom = selected.filter((s) => !options.some((o) => o.toLowerCase() === s.toLowerCase()));

  return (
    <div className="space-y-2">
      {selected.map((s) => (
        <input key={s} type="hidden" name={name} value={s} />
      ))}
      <div className="flex flex-wrap gap-2">
        {[...options, ...custom].map((o) => {
          const on = has(o);
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(o)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                on
                  ? "border-utah bg-utah text-white"
                  : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400",
              )}
            >
              {o}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addDraft();
            }
          }}
          placeholder={placeholder}
          maxLength={40}
          className="h-10 flex-1 rounded-lg border border-zinc-300 px-3 text-base focus:border-utah focus:outline-none"
        />
        <button
          type="button"
          onClick={addDraft}
          className="h-10 rounded-lg border border-zinc-300 px-3 text-sm hover:bg-zinc-50"
        >
          Add
        </button>
      </div>
      <p className="text-xs text-zinc-500">
        {selected.length}/{max} selected
      </p>
    </div>
  );
}
